
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { studentApiClient, Student } from '@/lib/studentApi';
import { createCodeVerifier, createCodeChallenge } from '@/lib/pkce';

interface AuthContextType {
  student: Student | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setStudent: (student: Student | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyStudent = async () => {
      try {
        const currentStudent = await studentApiClient.getMe();
        setStudent(currentStudent);
      } catch (err) {
        setStudent(null);
      } finally {
        setLoading(false);
      }
    };
    verifyStudent();
  }, []);

  const login = async () => {
    try {
      const codeVerifier = createCodeVerifier();
      const codeChallenge = await createCodeChallenge(codeVerifier);
      const redirectUri = `${window.location.origin}/auth/google/callback`;

      sessionStorage.setItem('code_verifier', codeVerifier);
      sessionStorage.setItem('redirect_uri', redirectUri);

      const { authorization_url } = await studentApiClient.startGoogleLogin(redirectUri, codeChallenge);
      window.location.href = authorization_url;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const logout = async () => {
    try {
      await studentApiClient.logout();
      setStudent(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <AuthContext.Provider value={{ student, loading, error, login, logout, setStudent }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
