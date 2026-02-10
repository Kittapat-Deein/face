'use client';

import { useState, useEffect } from 'react';
import { api, UserInfo } from '@/lib/api';
import Link from 'next/link';

export default function UsersPage() {
    const [users, setUsers] = useState<UserInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.getUsers();
            setUsers(response.users);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to fetch users';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleDelete = async (userId: string, userName: string) => {
        if (!confirm(`Are you sure you want to delete "${userName}" (${userId})?`)) {
            return;
        }

        setDeletingId(userId);
        try {
            await api.deleteUser(userId);
            setUsers(users.filter(u => u.user_id !== userId));
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to delete user';
            alert(message);
        } finally {
            setDeletingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(date);
    };

    return (
        <div className="min-h-screen py-12 px-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
                    <div>
                        <h1 className="text-4xl font-bold gradient-text mb-2">Registered Users</h1>
                        <p className="text-gray-400">
                            {users.length} {users.length === 1 ? 'user' : 'users'} registered
                        </p>
                    </div>
                    <Link
                        href="/register"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-cyan-500/25 transition-all hover:scale-105"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add New User
                    </Link>
                </div>

                {/* Loading State */}
                {isLoading && (
                    <div className="glass-card p-12 text-center">
                        <div className="w-12 h-12 mx-auto border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-gray-400">Loading users...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="glass-card p-6 border-red-500/50 bg-red-500/10">
                        <div className="flex items-center gap-3 text-red-400 mb-4">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">Failed to load users</span>
                        </div>
                        <p className="text-gray-400 mb-4">{error}</p>
                        <button
                            onClick={fetchUsers}
                            className="px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !error && users.length === 0 && (
                    <div className="glass-card p-12 text-center">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                            <svg className="w-10 h-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Users Registered</h3>
                        <p className="text-gray-400 mb-6">Get started by registering the first face</p>
                        <Link
                            href="/register"
                            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-xl"
                        >
                            Register First User
                        </Link>
                    </div>
                )}

                {/* Users List */}
                {!isLoading && !error && users.length > 0 && (
                    <div className="space-y-4">
                        {users.map((user, index) => (
                            <div
                                key={user.user_id}
                                className="glass-card p-6 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-white/5 transition-colors animate-fade-in"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                {/* Avatar */}
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                                    {user.name.charAt(0).toUpperCase()}
                                </div>

                                {/* User Info */}
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold text-white truncate">
                                        {user.name}
                                    </h3>
                                    <p className="text-cyan-400 font-mono text-sm">
                                        ID: {user.user_id}
                                    </p>
                                    <p className="text-gray-500 text-sm mt-1">
                                        Registered: {formatDate(user.created_at)}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleDelete(user.user_id, user.name)}
                                        disabled={deletingId === user.user_id}
                                        className="px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                                    >
                                        {deletingId === user.user_id ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                                Deleting...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
