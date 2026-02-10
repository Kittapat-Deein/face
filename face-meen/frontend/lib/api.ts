/**
 * API Client for Face Recognition Backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface RegisterRequest {
    user_id: string;
    name: string;
    image_base64: string;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    user_id?: string;
    name?: string;
}

export interface VerifyRequest {
    image_base64: string;
}

export interface VerifyResponse {
    matched: boolean;
    user_id?: string;
    name?: string;
    score: number;
    message: string;
}

export interface UserInfo {
    user_id: string;
    name: string;
    created_at: string;
}

export interface UsersResponse {
    count: number;
    users: UserInfo[];
}

export interface DeleteResponse {
    success: boolean;
    message: string;
}

export interface ApiError {
    detail: string;
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error((data as ApiError).detail || 'API request failed');
        }

        return data as T;
    }

    /**
     * Register a new face
     */
    async register(request: RegisterRequest): Promise<RegisterResponse> {
        return this.request<RegisterResponse>('/register', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Verify a face
     */
    async verify(request: VerifyRequest): Promise<VerifyResponse> {
        return this.request<VerifyResponse>('/verify', {
            method: 'POST',
            body: JSON.stringify(request),
        });
    }

    /**
     * Get all registered users
     */
    async getUsers(): Promise<UsersResponse> {
        return this.request<UsersResponse>('/users');
    }

    /**
     * Delete a user
     */
    async deleteUser(userId: string): Promise<DeleteResponse> {
        return this.request<DeleteResponse>(`/users/${encodeURIComponent(userId)}`, {
            method: 'DELETE',
        });
    }

    /**
     * Health check
     */
    async health(): Promise<{ status: string; registered_faces: number }> {
        return this.request('/health');
    }
}

// Export singleton instance
export const api = new ApiClient();
export default api;
