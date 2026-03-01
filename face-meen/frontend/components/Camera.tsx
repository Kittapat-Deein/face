'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface CameraProps {
    onCapture: (imageBase64: string) => void;
    isCapturing?: boolean;
}

export default function Camera({ onCapture, isCapturing = false }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    // Start camera stream
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                },
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Handle play() promise properly to avoid interruption errors
                try {
                    await videoRef.current.play();
                    setIsStreaming(true);
                } catch (playError) {
                    // Ignore AbortError which happens when play() is interrupted
                    if (playError instanceof Error && playError.name !== 'AbortError') {
                        throw playError;
                    }
                    // Still set streaming true if video is playing despite abort
                    if (videoRef.current && !videoRef.current.paused) {
                        setIsStreaming(true);
                    }
                }
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to access camera';
            setError(message);
            console.error('Camera error:', err);
        }
    }, []);

    // Stop camera stream
    const stopCamera = useCallback(() => {
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
            setIsStreaming(false);
        }
    }, []);

    // Capture image from video
    const captureImage = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        const vW = video.videoWidth;
        const vH = video.videoHeight;

        if (vW === 0 || vH === 0) return;

        // Container dimensions (displayed video)
        const rect = video.getBoundingClientRect();
        const containerW = rect.width;
        const containerH = rect.height;

        // Video is styled with object-cover, calculate actual scale
        const scale = Math.max(containerW / vW, containerH / vH);

        // Guide dimensions in screen pixels (w-48 = 192px, h-64 = 256px)
        const guideW = 192;
        const guideH = 256;

        // Calculate crop dimensions on the intrinsic video
        const cropW = guideW / scale;
        const cropH = guideH / scale;

        // Center coordinates in video source
        const cx = vW / 2;
        const cy = vH / 2;

        const sx = cx - cropW / 2;
        const sy = cy - cropH / 2;

        // Set canvas size to the cropped dimensions
        canvas.width = Math.round(cropW);
        canvas.height = Math.round(cropH);

        // Draw cropped region (mirror for selfie
        //  mode)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(
            video,
            sx, sy, cropW, cropH,   // Source coordinates
            0, 0, canvas.width, canvas.height // Destination coordinates
        );
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Convert to base64 JPEG
        const imageBase64 = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(imageBase64);
    }, [onCapture]);

    // Capture with countdown
    const captureWithCountdown = useCallback(() => {
        setCountdown(3);
    }, []);

    // Countdown effect
    useEffect(() => {
        if (countdown === null) return;

        if (countdown === 0) {
            captureImage();
            setCountdown(null);
            return;
        }

        const timer = setTimeout(() => {
            setCountdown(countdown - 1);
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown, captureImage]);

    // Start camera on mount
    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    return (
        <div className="relative w-full max-w-lg mx-auto">
            {/* Camera View */}
            <div className="relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
                {/* Video Element */}
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                />

                {/* Hidden Canvas for Capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Face Guide Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-64 border-2 border-dashed border-cyan-400/50 rounded-full" />
                </div>

                {/* Countdown Overlay */}
                {countdown !== null && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-8xl font-bold text-white animate-pulse">
                            {countdown}
                        </span>
                    </div>
                )}

                {/* Loading/Capturing Overlay */}
                {isCapturing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-white font-medium">Processing...</span>
                        </div>
                    </div>
                )}

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center p-6">
                        <div className="text-center">
                            <p className="text-white font-medium mb-4">{error}</p>
                            <button
                                onClick={startCamera}
                                className="px-4 py-2 bg-white text-red-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                {/* Not Streaming Overlay */}
                {!isStreaming && !error && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                        <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Capture Button */}
            <div className="mt-6 flex justify-center">
                <button
                    onClick={captureWithCountdown}
                    disabled={!isStreaming || isCapturing || countdown !== null}
                    className="group relative px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 active:scale-95"
                >
                    <span className="flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Capture
                    </span>
                </button>
            </div>

            {/* Instructions */}
            <p className="mt-4 text-center text-sm text-gray-400">
                Position your face within the oval guide and click Capture
            </p>
        </div>
    );
}
