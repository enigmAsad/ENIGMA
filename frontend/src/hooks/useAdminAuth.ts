'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApiClient } from '@/lib/adminApi';

export function useAdminAuth() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!adminApiClient.isAuthenticated()) {
        router.push('/admin/login');
        setIsLoading(false);
        return;
      }

      try {
        const adminData = await adminApiClient.getCurrentAdmin();
        setAdmin(adminData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/admin/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const logout = async () => {
    await adminApiClient.logout();
    router.push('/admin/login');
  };

  return { isAuthenticated, isLoading, admin, logout };
}
