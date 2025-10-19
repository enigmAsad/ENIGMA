'use client';

import { useEffect, useState } from 'react';
import { adminApiClient } from '@/lib/adminApi';

export function useOptionalAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!adminApiClient.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      try {
        const adminData = await adminApiClient.getCurrentAdmin();
        setAdmin(adminData);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Optional auth check failed:', error);
        // Do not redirect, just fail silently
        setIsAuthenticated(false);
        setAdmin(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = async () => {
    await adminApiClient.logout();
    // No redirect here either, let the component decide
    setAdmin(null);
    setIsAuthenticated(false);
  };

  return { isAuthenticated, isLoading, admin, logout };
}
