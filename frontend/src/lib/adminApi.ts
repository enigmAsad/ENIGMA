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

export interface FinalSelectionResponse {
  selected_count: number;
  not_selected_count: number;
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

export interface InterviewDetails {
  id: number;
  application_id: string;
  student_id: string;
  admin_id: string;
  admission_cycle_id: string;
  interview_time: string;
  interview_link: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface InterviewCreate {
  application_id: string;
  interview_time: string;
}

export interface InterviewUpdate {
  interview_time?: string;
  interview_link?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface ApplicationDetails {
    application_id: string;
    student_id: string | null;
    admission_cycle_id: string;
    name: string;
    email: string;
    status: string;
    timestamp: string;
    interview: InterviewDetails | null;
}

// Phase 2: Bias Monitoring Interfaces
export interface BiasFlag {
  id: number;
  interview_id: number;
  admin_id: string;
  application_id: string | null;
  flag_type: string;
  severity: 'high' | 'critical';
  description: string;
  evidence: any;
  action_taken: string;
  automatic: boolean;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution: string | null;
  created_at: string;
}

export interface AdminBiasHistory {
  admin_id: string;
  total_interviews_conducted: number;
  total_bias_incidents: number;
  total_blocks_received: number;
  current_status: 'active' | 'warned' | 'suspended' | 'banned';
  strikes: number;
  suspension_count: number;
  last_incident_date: string | null;
  strike_reset_date: string | null;
  nudge_counts: {
    info?: number;
    warning?: number;
    block?: number;
  };
  recent_incidents: Array<{
    id: number;
    interview_id: number;
    bias_detected: boolean;
    bias_types: string[];
    severity: string;
    confidence_score: number;
    recommended_action: string;
    analyzed_at: string;
  }>;
}

export interface BiasMetrics {
  summary: {
    total_admins: number;
    active_admins: number;
    warned_admins: number;
    suspended_admins: number;
    banned_admins: number;
    total_incidents: number;
    total_interviews: number;
    incident_rate: number;
  };
  admin_risks: Array<{
    admin_id: string;
    current_status: string;
    strikes: number;
    total_interviews: number;
    total_incidents: number;
    incident_rate: number;
  }>;
  drift_metrics: Array<{
    id: number;
    admin_id: string;
    period_start: string;
    period_end: string;
    total_interviews: number;
    bias_incidents: number;
    risk_score: number;
    risk_level: string;
  }>;
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
  async getAllCycles(includeStats: boolean = false): Promise<AdmissionCycle[]> {
    const url = includeStats
      ? `${API_BASE}/admin/cycles?include_stats=true`
      : `${API_BASE}/admin/cycles`;

    const response = await fetch(url, {
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

  async getCycleApplications(cycleId: string, status?: string): Promise<ApplicationDetails[]> {
    let url = `${API_BASE}/admin/cycles/${cycleId}/applications`;
    if (status) {
      url += `?status=${status}`;
    }
    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch cycle applications');
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
      throw new Error(error.detail || 'Failed to perform shortlisting');
    }

    return response.json();
  }

  async performFinalSelection(cycleId: string): Promise<FinalSelectionResponse> {
    const response = await fetch(`${API_BASE}/admin/cycles/${cycleId}/final-select`, {
      method: 'POST',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to perform final selection');
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

  // Interview Management
  async scheduleInterview(data: InterviewCreate): Promise<InterviewDetails> {
    const response = await fetch(`${API_BASE}/admin/interviews/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to schedule interview');
    }

    return response.json();
  }

  async getInterviewsForCycle(cycleId: string): Promise<InterviewDetails[]> {
    const response = await fetch(`${API_BASE}/admin/interviews/cycle/${cycleId}`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch interviews for cycle');
    }

    return response.json();
  }

  async updateInterview(interviewId: number, data: InterviewUpdate): Promise<InterviewDetails> {
    const response = await fetch(`${API_BASE}/admin/interviews/${interviewId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to update interview');
    }

    return response.json();
  }

  async deleteInterview(interviewId: number): Promise<void> {
    const response = await fetch(`${API_BASE}/admin/interviews/${interviewId}`, {
      method: 'DELETE',
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to delete interview');
    }
  }

  // Public admission info (no auth)
  async getAdmissionInfo(): Promise<AdmissionInfo> {
    const response = await fetch(`${API_BASE}/admission/info`);

    if (!response.ok) {
      throw new Error('Failed to fetch admission info');
    }

    return response.json();
  }

  // ============================================================================
  // Phase 2: Bias Monitoring Methods
  // ============================================================================

  async getBiasFlags(filters?: {
    reviewed?: boolean;
    severity?: string;
    admin_id?: string;
  }): Promise<BiasFlag[]> {
    const params = new URLSearchParams();
    if (filters?.reviewed !== undefined) params.append('reviewed', String(filters.reviewed));
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.admin_id) params.append('admin_id', filters.admin_id);

    const url = `${API_BASE}/admin/bias/flags${params.toString() ? '?' + params.toString() : ''}`;

    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch bias flags');
    }

    return response.json();
  }

  async resolveBiasFlag(flagId: number, resolution: string): Promise<any> {
    const response = await fetch(`${API_BASE}/admin/bias/flags/${flagId}/resolve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeader(),
      },
      body: JSON.stringify({ resolution }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to resolve bias flag');
    }

    return response.json();
  }

  async getAdminBiasHistory(adminId: string): Promise<AdminBiasHistory> {
    const response = await fetch(`${API_BASE}/admin/bias/history/${adminId}`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch admin bias history');
    }

    return response.json();
  }

  async getBiasMetrics(cycleId?: number): Promise<BiasMetrics> {
    const url = cycleId
      ? `${API_BASE}/admin/bias/metrics?cycle_id=${cycleId}`
      : `${API_BASE}/admin/bias/metrics`;

    const response = await fetch(url, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch bias metrics');
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