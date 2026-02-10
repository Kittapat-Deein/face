'use client';

import { useState } from 'react';
import Camera from '@/components/Camera';
import { api, RegisterResponse } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
    const [userId, setUserId] = useState('');
    const [name, setName] = useState('');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [result, setResult] = useState<RegisterResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCapture = (imageBase64: string) => {
        setCapturedImage(imageBase64);
        setResult(null);
        setError(null);
    };

    const handleRetake = () => {
        setCapturedImage(null);
        setResult(null);
        setError(null);
    };

    const handleSubmit = async () => {
        if (!userId.trim() || !name.trim() || !capturedImage) {
            setError('Please fill in all fields and capture a photo');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await api.register({
                user_id: userId.trim(),
                name: name.trim(),
                image_base64: capturedImage,
            });
            setResult(response);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Registration failed';
            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReset = () => {
        setUserId('');
        setName('');
        setCapturedImage(null);
        setResult(null);
        setError(null);
    };

    return (
        <div className="min-h-screen py-12 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold gradient-text mb-4">Register Face</h1>
                    <p className="text-gray-400">
                        Register your face to enable identity verification
                    </p>
                </div>

                {/* Success State */}
                {result?.success ? (
                    <div className="glass-card p-8 text-center animate-fade-in">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center success-pulse">
                            <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-green-400 mb-2">Registration Successful!</h2>
                        <p className="text-gray-400 mb-6">
                            <span className="text-white font-medium">{result.name}</span> has been registered with ID{' '}
                            <span className="text-cyan-400 font-mono">{result.user_id}</span>
                        </p>

                        {capturedImage && (
                            <div className="mb-6">
                                <img
                                    src={capturedImage}
                                    alt="Registered face"
                                    className="w-32 h-32 mx-auto rounded-2xl object-cover border-2 border-green-500/50"
                                />
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={handleReset}
                                className="px-6 py-3 bg-white/10 border border-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
                            >
                                Register Another
                            </button>
                            <Link
                                href="/verify"
                                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium rounded-xl hover:shadow-cyan-500/25 transition-all"
                            >
                                Go to Verify
                            </Link>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Form Fields */}
                        <div className="glass-card p-6 space-y-4">
                            <div>
                                <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                                    User ID
                                </label>
                                <input
                                    type="text"
                                    id="userId"
                                    value={userId}
                                    onChange={(e) => setUserId(e.target.value)}
                                    placeholder="e.g., u001 or employee123"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                                />
                            </div>
                            <div>
                                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g., John Doe"
                                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        {/* Camera or Preview */}
                        {capturedImage ? (
                            <div className="space-y-4">
                                <div className="glass-card p-4 text-center">
                                    <p className="text-sm text-gray-400 mb-4">Captured Photo</p>
                                    <img
                                        src={capturedImage}
                                        alt="Captured face"
                                        className="max-w-sm mx-auto rounded-xl border border-white/10"
                                    />
                                </div>
                                <div className="flex gap-4 justify-center">
                                    <button
                                        onClick={handleRetake}
                                        className="px-6 py-3 bg-white/10 border border-white/10 text-white font-medium rounded-xl hover:bg-white/20 transition-colors"
                                    >
                                        Retake Photo
                                    </button>
                                    <button
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !userId.trim() || !name.trim()}
                                        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Registering...
                                            </span>
                                        ) : (
                                            'Register Face'
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <Camera onCapture={handleCapture} isCapturing={false} />
                        )}

                        {/* Error Message */}
                        {error && (
                            <div className="glass-card p-4 border-red-500/50 bg-red-500/10 animate-shake">
                                <div className="flex items-center gap-3 text-red-400">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>{error}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
