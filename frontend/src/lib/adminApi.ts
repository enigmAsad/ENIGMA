/**
 * Admin API Client for ENIGMA
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  success: boolean;
  token: string;
  admin_id: string;
  username: string;
  email: string;
  role: string;
  expires_at: string;
}

export interface AdmissionCycle {
  cycle_id: string;
  cycle_name: string;
  // Backend returns lowercase phase values with underscores (e.g., 'submission', 'batch_prep')
  phase: 'submission' | 'frozen' | 'preprocessing' | 'batch_prep' | 'processing' | 'scored' | 'selection' | 'published' | 'completed';
  is_open: boolean;
  max_seats: number;
  current_seats: number;
  selected_count?: number;
  result_date: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
  closed_at?: string;
  closed_by?: string;
}

export interface DeleteCycleResponse {
  success: boolean;
  message: string;
}

export interface CycleStatus {
  cycle_id: string;
  cycle_name: string;
  phase: string;
  is_open: boolean;
  max_seats: number;
  current_seats: number;
  selected_count: number;
  stats: {
    total_applications: number;
    submitted: number;
    finalized: number;
    scored: number;
    selected: number;
  };
  dates: {
    start_date: string;
    end_date: string;
    result_date: string;
    created_at: string;
    closed_at?: string;
  };
}

export interface BatchStatus {
  batch_id: number;
  cycle_id: string;
  batch_type: string;
  status: string;
  model_name: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  progress_percent: number;
  started_at?: string;
  completed_at?: string;
  error_log?: string;
}

export interface BatchExportResponse {
  cycle_id: string;
  file_path: string;
  record_count: number;
  batch_id: number;
  message: string;
}

export interface LLMImportResponse {
  imported_count: number;
  cycle_id: string;
  message: string;
}

export interface SelectionResponse {
  selected_count: number;
  not_selected_count: number;
  cutoff_score: number;
  selection_criteria: any;
}

export interface CreateCycleRequest {
  cycle_name: string;
  max_seats: number;
  result_date: string;
  start_date: string;
  end_date: string;
}

export interface AdmissionInfo {
  is_open: boolean;
  cycle_name?: string;
  seats_available?: number;
  max_seats?: number;
  current_seats?: number;
  start_date?: string;
  end_date?: string;
  result_date?: string;
  message: string;
}

class AdminAPIClient {
  private getAuthHeader(): HeadersInit {
    const token = localStorage.getItem('admin_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Authentication
  async login(username: string, password: string): Promise<AdminLoginResponse> {
    const response = await fetch(`${API_BASE}/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data: AdminLoginResponse = await response.json();

    // Store token
    localStorage.setItem('admin_token', data.token);
    localStorage.setItem('admin_user', JSON.stringify({
      admin_id: data.admin_id,
      username: data.username,
      email: data.email,
      role: data.role,
    }));

    return data;
  }

  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/admin/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeader(),
      });
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
    }
  }

  async getCurrentAdmin(): Promise<any> {
    const response = await fetch(`${API_BASE}/admin/auth/me`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Not authenticated');
    }

    return response.json();
  }

  // Admission Cycles
  async getAllCycles(): Promise<AdmissionCycle[]> {
    const response = await fetch(`${API_BASE}/admin/cycles`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch cycles');
    }

    return response.json();
  }

  async createCycle(data: CreateCycleRequest): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to create cycle');
    }

    return response.json();
  }

  async getCycle(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch cycle');
    }

    return response.json();
  }

  async updateCycle(cycleId: string, data: Partial<CreateCycleRequest>): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update cycle');
    }

    return response.json();
  }

  async openCycle(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/open`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to open cycle');
    }

    return response.json();
  }

  async closeCycle(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/close`, {
      method: 'PUT',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to close cycle');
    }

    return response.json();
  }

  async deleteCycle(cycleId: string): Promise<DeleteCycleResponse> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete cycle');
    }

    return response.json();
  }

  async getActiveCycle(): Promise<AdmissionCycle | null> {
    const response = await fetch(`${API_BASE}/admin/cycles/active/current`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  }

  // Phase Management Methods
  async freezeCycle(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/freeze`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to freeze cycle');
    }

    return response.json();
  }

  async startPreprocessing(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/preprocess`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start preprocessing');
    }

    return response.json();
  }

  async exportBatchData(cycleId: string): Promise<BatchExportResponse> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/export`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to export batch data');
    }

    return response.json();
  }

  async startLLMProcessing(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/processing`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to start LLM processing');
    }

    return response.json();
  }

  async importLLMResults(batchId: number, resultsFile: string): Promise<LLMImportResponse> {
    const response = await fetch(`${API_BASE}/admin/batch/${batchId}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ results_file: resultsFile }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to import LLM results');
    }

    return response.json();
  }

  async performSelection(cycleId: string): Promise<SelectionResponse> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/select`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to perform selection');
    }

    return response.json();
  }

  async publishResults(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/publish`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to publish results');
    }

    return response.json();
  }

  async completeCycle(cycleId: string): Promise<AdmissionCycle> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/complete`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to complete cycle');
    }

    return response.json();
  }

  // Status & Monitoring
  async getCycleStatus(cycleId: string): Promise<CycleStatus> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/status`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get cycle status');
    }

    return response.json();
  }

  async getBatchStatus(batchId: number): Promise<BatchStatus> {
    const response = await fetch(`${API_BASE}/admin/batch/${batchId}/status`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get batch status');
    }

    return response.json();
  }

  // Public admission info (no auth)
  async getAdmissionInfo(): Promise<AdmissionInfo> {
    const response = await fetch(`${API_BASE}/admission/info`);

    if (!response.ok) {
      throw new Error('Failed to fetch admission info');
    }

    return response.json();
  }

  // Helper
  isAuthenticated(): boolean {
    return !!localStorage.getItem('admin_token');
  }

  getStoredUser(): any {
    const user = localStorage.getItem('admin_user');
    return user ? JSON.parse(user) : null;
  }
}

export const adminApiClient = new AdminAPIClient();
