'use client';

import Camera from '@/components/Camera';
import { api, VerifyResponse } from '@/lib/api';
import Link from 'next/link';
import { useState } from 'react';

export default function VerifyPage() {
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<VerifyResponse | null>(null);
    const [capturedImages, setCapturedImages] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = async (imagesBase64: string[]) => {
        setCapturedImages(imagesBase64);
        setIsProcessing(true);
        setError(null);
        setResult(null);

        try {
            const response = await api.verify({ images_base64: imagesBase64 });
            setResult(response);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Verification failed';
            setError(message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setResult(null);
        setCapturedImages([]);
        setError(null);
    };

    const getScoreColor = (score: number) => {
        if (score >= 0.6) return 'text-green-400';
        if (score >= 0.45) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 0.6) return 'High Confidence';
        if (score >= 0.45) return 'Moderate Confidence';
        return 'Low Confidence';
    };

    return (
        <div className="min-h-screen py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold gradient-text mb-4">Verify Identity</h1>
                    <p className="text-gray-400">
                        Capture your face to verify against registered identities
                    </p>
                </div>

                {/* Result State */}
                {result ? (
                    <div className="space-y-6 animate-fade-in">
                        {/* Result Card */}
                        <div className={`glass-card p-8 text-center ${result.matched ? 'border-green-500/30' : 'border-red-500/30'}`}>
                            {/* Result Icon */}
                            <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${result.matched
                                ? 'bg-green-500/20 success-pulse'
                                : 'bg-red-500/20'
                                }`}>
                                {result.matched ? (
                                    <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </div>

                            {/* Result Title */}
                            <h2 className={`text-2xl font-bold mb-2 ${result.matched ? 'text-green-400' : 'text-red-400'}`}>
                                {result.matched ? 'Identity Verified!' : 'No Match Found'}
                            </h2>

                            {/* Match Details */}
                            {result.matched && result.name && result.user_id ? (
                                <div className="mb-6">
                                    <p className="text-gray-400 mb-2">Welcome back,</p>
                                    <p className="text-3xl font-bold text-white mb-1">{result.name}</p>
                                    <p className="text-cyan-400 font-mono text-sm">ID: {result.user_id}</p>
                                </div>
                            ) : (
                                <p className="text-gray-400 mb-6">{result.message}</p>
                            )}

                            {/* Score Display */}
                            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full">
                                <span className="text-gray-400 text-sm">Confidence:</span>
                                <span className={`font-bold ${getScoreColor(result.score)}`}>
                                    {(result.score * 100).toFixed(1)}%
                                </span>
                                <span className={`text-xs ${getScoreColor(result.score)}`}>
                                    ({getScoreLabel(result.score)})
                                </span>
                            </div>
                        </div>

                        {/* Captured Image Preview */}
                        {capturedImages.length > 0 && (
                            <div className="glass-card p-4">
                                <p className="text-sm text-gray-400 text-center mb-3">Captured Photos</p>
                                <div className="flex justify-center flex-wrap gap-4">
                                    {capturedImages.map((img, i) => (
                                        <img
                                            key={i}
                                            src={img}
                                            alt={`Captured face ${i}`}
                                            className={`w-28 h-28 object-cover rounded-xl border-2 ${result.matched ? 'border-green-500/50' : 'border-red-500/50'
                                                }`}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={handleReset}
                                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all"
                            >
                                Verify Again
                            </button>
                            {!result.matched && (
                                <Link
                                    href="/register"
                                    className="px-6 py-3 bg-white/10 border border-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors text-center"
                                >
                                    Register New Face
                                </Link>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Camera */}
                        <Camera onCapture={handleCapture} isCapturing={isProcessing} />

                        {/* Error Message */}
                        {error && (
                            <div className="glass-card p-4 border-red-500/50 bg-red-500/10 animate-shake">
                                <div className="flex items-center gap-3 text-red-400">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                                <button
                                    onClick={handleReset}
                                    className="mt-4 w-full px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                                >
                                    Try Again
                                </button>
                            </div>
                        )}

                        {/* Info */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span className="text-cyan-400">💡</span> Tips for Verification
                            </h3>
                            <ul className="space-y-2 text-gray-400 text-sm">
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-400">•</span>
                                    Ensure good lighting on your face
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-400">•</span>
                                    Look directly at the camera
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-400">•</span>
                                    Remove glasses or hats if possible
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-cyan-400">•</span>
                                    Keep a neutral expression
                                </li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
