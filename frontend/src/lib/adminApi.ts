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
  is_open: boolean;
  max_seats: number;
  current_seats: number;
  result_date: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
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

  async getActiveCycle(): Promise<AdmissionCycle | null> {
    const response = await fetch(`${API_BASE}/admin/cycles/active/current`, {
      headers: this.getAuthHeader(),
    });

    if (!response.ok) {
      return null;
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
