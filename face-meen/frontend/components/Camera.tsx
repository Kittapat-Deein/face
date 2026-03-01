'use client';

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';

interface CameraProps {
    onCapture: (imagesBase64: string[]) => void;
    isCapturing?: boolean;
}

export default function Camera({ onCapture, isCapturing = false }: CameraProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null); // For extracting the image
    const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);

    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);


    // Status feedback for user
    const [poseStatus, setPoseStatus] = useState<string>('Initializing...');
    const [isFaceStraight, setIsFaceStraight] = useState(false);

    // Liveness Tracking
    const [currentStep, setCurrentStep] = useState(0);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);

    // Auto-capture tracking
    const straightFaceStartTimeRef = useRef<number | null>(null);
    const animationFrameRef = useRef<number>(0);
    const lastVideoTimeRef = useRef<number>(-1);
    const lastProcessedTimeRef = useRef<number>(-1);

    // Initialize MediaPipe FaceLandmarker
    useEffect(() => {
        let isMounted = true;

        async function loadModel() {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
                );

                // Mute console.error during initialization to prevent Next.js error overlays from WASM INFO logs
                const originalConsoleError = console.error;
                let landmarker: FaceLandmarker;

                try {
                    console.error = () => { };
                    landmarker = await FaceLandmarker.createFromOptions(vision, {
                        baseOptions: {
                            modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                            delegate: "GPU"
                        },
                        outputFaceBlendshapes: false,
                        outputFacialTransformationMatrixes: true, // Crucial for head pose
                        runningMode: "VIDEO",
                        numFaces: 1
                    });
                } finally {
                    console.error = originalConsoleError;
                }

                if (isMounted) {
                    faceLandmarkerRef.current = landmarker;
                    setIsModelLoaded(true);
                    setPoseStatus('Step 1: หันไปทางขวาหน่อย');
                }
            } catch (err) {
                console.error("Failed to load FaceLandmarker", err);
                if (isMounted) setError("Failed to load face detection model");
            }
        }

        loadModel();

        return () => {
            isMounted = false;
            if (faceLandmarkerRef.current) {
                faceLandmarkerRef.current.close();
            }
        };
    }, []);

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
                try {
                    await videoRef.current.play();
                    setIsStreaming(true);
                } catch (playError) {
                    if (playError instanceof Error && playError.name !== 'AbortError') {
                        throw playError;
                    }
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
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
    }, []);

    // Capture the image from video to canvas
    const captureImageToDataURL = useCallback((): string | null => {
        if (!videoRef.current || !canvasRef.current) return null;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx) return null;

        const vW = video.videoWidth;
        const vH = video.videoHeight;
        if (vW === 0 || vH === 0) return null;

        const rect = video.getBoundingClientRect();
        const scale = Math.max(rect.width / vW, rect.height / vH);

        const PADDING = 1.3;
        const cropW = Math.min(Math.round((192 / scale) * PADDING), vW);
        const cropH = Math.min(Math.round((256 / scale) * PADDING), vH);

        const sx = Math.max(0, Math.round(vW / 2 - cropW / 2));
        const sy = Math.max(0, Math.round(vH / 2 - cropH / 2));

        const minOut = 640;
        const upscale = cropW < minOut ? minOut / cropW : 1;
        const outW = Math.round(cropW * upscale);
        const outH = Math.round(cropH * upscale);

        canvas.width = outW;
        canvas.height = outH;

        ctx.translate(outW, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, sx, sy, cropW, cropH, 0, 0, outW, outH);
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        return canvas.toDataURL('image/jpeg', 0.95);
    }, []);

    // Detection Loop
    useEffect(() => {
        if (!isStreaming || !isModelLoaded || !videoRef.current || !faceLandmarkerRef.current || isCapturing) {
            return;
        }

        const video = videoRef.current;
        const landmarker = faceLandmarkerRef.current;

        const predict = () => {
            if (video.paused || video.readyState !== 4 || isCapturing) return;

            // Only process new frames
            if (video.currentTime !== lastVideoTimeRef.current) {
                lastVideoTimeRef.current = video.currentTime;

                // Ensure timestamp is monotonically increasing
                let nowInMs = performance.now();
                if (nowInMs <= lastProcessedTimeRef.current) {
                    nowInMs = lastProcessedTimeRef.current + 1;
                }
                lastProcessedTimeRef.current = nowInMs;

                try {
                    // Mute console.error temporarily to prevent Next.js from catching WASM info logs
                    const originalConsoleError = console.error;
                    let results;
                    try {
                        console.error = () => { };
                        results = landmarker.detectForVideo(video, nowInMs);
                    } finally {
                        console.error = originalConsoleError;
                    }

                    if (results && results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
                        const matrix = results.facialTransformationMatrixes[0].data;

                        // Simple rotation extraction from 4x4 matrix
                        // https://math.stackexchange.com/questions/237369/given-this-transformation-matrix-how-do-i-decompose-it-into-translation-rotati
                        const r11 = matrix[0], r12 = matrix[1], r13 = matrix[2];
                        const r21 = matrix[4], r22 = matrix[5], r23 = matrix[6];
                        const r31 = matrix[8], r32 = matrix[9], r33 = matrix[10];

                        // Calculate angles in degrees
                        const pitch = Math.atan2(-r32, r33) * (180 / Math.PI); // Up / Down
                        const yaw = Math.atan2(r31, Math.sqrt(r32 * r32 + r33 * r33)) * (180 / Math.PI); // Left / Right

                        let conditionMet = false;
                        let newPoseStatus = "";

                        if (currentStep === 0) {
                            if (yaw < -15) {
                                newPoseStatus = "หันขวา ค้างไว้นะ";
                                conditionMet = true;
                            } else {
                                newPoseStatus = "Step 1: หันไปทางขวาหน่อย";
                            }
                        } else if (currentStep === 1) {
                            if (yaw > 15) {
                                newPoseStatus = "หันซ้าย ค้างไว้นะ";
                                conditionMet = true;
                            } else {
                                newPoseStatus = "Step 2: หันไปทางซ้ายหน่อย";
                            }
                        } else if (currentStep === 2) {
                            if (yaw >= -15 && yaw <= 15 && pitch >= -10 && pitch <= 15) {
                                newPoseStatus = "หันหน้าตรง ค้างไว้นะ";
                                conditionMet = true;
                            } else {
                                newPoseStatus = "Step 3: มองไปข้างหน้าหน่อย";
                            }
                        } else {
                            newPoseStatus = "Processing...";
                        }

                        setPoseStatus(newPoseStatus);
                        setIsFaceStraight(conditionMet);

                        if (conditionMet && currentStep < 3) {
                            if (straightFaceStartTimeRef.current === null) {
                                straightFaceStartTimeRef.current = nowInMs;
                            } else {
                                if (nowInMs - straightFaceStartTimeRef.current > 1000) {
                                    // Capture
                                    straightFaceStartTimeRef.current = null;
                                    setIsFaceStraight(false);

                                    const imageBase64 = captureImageToDataURL();
                                    if (imageBase64) {
                                        const nextImages = [...capturedImages, imageBase64];
                                        setCapturedImages(nextImages);

                                        if (currentStep === 2) {
                                            setPoseStatus("Capturing...");
                                            setCurrentStep(3);
                                            onCapture(nextImages);
                                            return;
                                        } else {
                                            setCurrentStep(currentStep + 1);
                                        }
                                    }
                                }
                            }
                        } else {
                            straightFaceStartTimeRef.current = null;
                        }

                    } else {
                        setPoseStatus("No face detected");
                        setIsFaceStraight(false);
                        straightFaceStartTimeRef.current = null;
                    }
                } catch (err) {
                    // Use console.warn instead of console.error to prevent Next.js error overlay in Dev mode
                    console.warn("detectForVideo error:", err);
                }
            }

            animationFrameRef.current = requestAnimationFrame(predict);
        };

        predict();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isStreaming, isModelLoaded, isCapturing, captureImageToDataURL, currentStep, capturedImages, onCapture]);

    useEffect(() => {
        startCamera();
        return () => stopCamera();
    }, [startCamera, stopCamera]);

    return (
        <div className="relative w-full max-w-lg mx-auto">
            {/* Camera View */}
            <div className={`relative aspect-[4/3] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border transition-colors duration-300 ${isFaceStraight ? 'border-green-500 shadow-green-500/50' : 'border-white/10'}`}>

                {/* Status Indicator Bar */}
                <div className={`absolute top-0 left-0 right-0 z-10 px-4 py-2 text-center text-sm font-semibold transition-colors duration-300 ${isFaceStraight ? 'bg-green-500/80 text-white' :
                    poseStatus === 'Initializing...' ? 'bg-blue-500/80 text-white' :
                        'bg-red-500/80 text-white'
                    }`}>
                    {poseStatus}
                </div>

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
                    <div className={`w-48 h-64 border-2 border-dashed rounded-full transition-colors duration-300 ${isFaceStraight ? 'border-green-400' : 'border-cyan-400/50'}`} />
                </div>

                {/* Loading/Capturing Overlay */}
                {isCapturing && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-white font-medium">Processing...</span>
                        </div>
                    </div>
                )}

                {/* Error Overlay */}
                {error && (
                    <div className="absolute inset-0 bg-red-900/80 flex items-center justify-center p-6 z-20">
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
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-20">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                            <span className="text-gray-400 text-sm">Starting camera...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Instructions */}
            <p className="mt-4 text-center text-sm text-gray-400">
                Follow the 3-step instructions on the screen. The system will auto-capture at each step.
            </p>
        </div>
    );
}

