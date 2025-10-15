
/**
 * API client for ENIGMA Student Authentication
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

import { ApplicationStatusResponse, ResultsResponse, ApplicationSubmitRequest, ApplicationSubmitResponse } from './api';

export interface Student {
  student_id: string;
  primary_email: string;
  display_name: string | null;
  status: string;
  application?: {
    status: ApplicationStatusResponse;
    results: ResultsResponse | null;
  } | null;
}

export interface StudentSessionResponse {
  success: boolean;
  student: Student;
}

export interface StartAuthResponse {
  authorization_url: string;
  state: string;
}

class StudentAPIClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;

    const response = await fetch(url, {
      credentials: 'include', // Send cookies with requests
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      // FastAPI validation errors are often in a nested `detail` array
      const errorMessage = Array.isArray(errorData.detail)
        ? errorData.detail.map((e: any) => `${e.loc.join('.')} - ${e.msg}`).join(', ')
        : errorData.detail || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.json();
  }

  async startGoogleLogin(redirect_uri: string, code_challenge: string): Promise<StartAuthResponse> {
    const params = new URLSearchParams({
      redirect_uri,
      code_challenge,
    });
    return this.request<StartAuthResponse>(`/auth/student/google/start?${params.toString()}`, {
      method: 'POST',
    });
  }

  async completeGoogleLogin(code: string, state: string, code_verifier: string, redirect_uri: string): Promise<StudentSessionResponse> {
    return this.request<StudentSessionResponse>('/auth/student/google/callback', {
      method: 'POST',
      body: JSON.stringify({ code, state, code_verifier, redirect_uri }),
    });
  }

  async getMe(): Promise<Student> {
    return this.request<Student>('/auth/student/me');
  }

  async logout(): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>('/auth/student/logout', {
      method: 'POST',
    });
  }

  async submitApplication(data: ApplicationSubmitRequest): Promise<ApplicationSubmitResponse> {
    return this.request<ApplicationSubmitResponse>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const studentApiClient = new StudentAPIClient();
export default StudentAPIClient;
