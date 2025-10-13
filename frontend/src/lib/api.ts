/**
 * API client for ENIGMA Phase 1 backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface ApplicationSubmitRequest {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  gpa: number;
  test_scores: Record<string, number>;
  essay: string;
  achievements: string;
}

export interface ApplicationSubmitResponse {
  success: boolean;
  application_id: string;
  message: string;
  status: string;
  timestamp: string;
}

export interface ApplicationStatusResponse {
  application_id: string;
  anonymized_id: string | null;
  status: string;
  message: string;
  timestamp: string;
}

export interface ResultsResponse {
  anonymized_id: string;
  status: string;  // SELECTED, NOT_SELECTED, or PUBLISHED
  final_score: number;
  academic_score: number;
  test_score: number;
  achievement_score: number;
  essay_score: number;
  explanation: string;
  strengths: string[];
  areas_for_improvement: string[];
  hash: string;
  timestamp: string;
  worker_attempts: number;
}

export interface VerifyRequest {
  anonymized_id: string;
  expected_hash: string;
}

export interface VerifyResponse {
  anonymized_id: string;
  is_valid: boolean;
  stored_hash: string;
  expected_hash: string;
  message: string;
}

export interface DashboardStatsResponse {
  total_applications: number;
  completed_evaluations: number;
  average_score: number | null;
  score_distribution: Record<string, number>;
  processing_stats: Record<string, number>;
  timestamp: string;
}

class APIClient {
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
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(error.detail || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Submit a new application
   */
  async submitApplication(data: ApplicationSubmitRequest): Promise<ApplicationSubmitResponse> {
    return this.request<ApplicationSubmitResponse>('/applications', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get application status by ID
   */
  async getApplicationStatus(applicationId: string): Promise<ApplicationStatusResponse> {
    return this.request<ApplicationStatusResponse>(`/applications/${applicationId}`);
  }

  /**
   * Get final results by anonymized ID
   */
  async getResults(anonymizedId: string): Promise<ResultsResponse> {
    return this.request<ResultsResponse>(`/results/${anonymizedId}`);
  }

  /**
   * Verify a hash
   */
  async verifyHash(data: VerifyRequest): Promise<VerifyResponse> {
    return this.request<VerifyResponse>('/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Verify entire hash chain
   */
  async verifyChain(): Promise<{
    is_valid: boolean;
    chain_length: number;
    first_entry: string;
    last_entry: string;
    invalid_entries: any[];
    timestamp: string;
  }> {
    return this.request('/verify/chain');
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<DashboardStatsResponse> {
    return this.request<DashboardStatsResponse>('/dashboard/stats');
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    status: string;
    timestamp: string;
    data_dir: string;
    api_configured: boolean;
  }> {
    return this.request('/health');
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export class for custom instances
export default APIClient;
