/**
 * Role-based navigation bar component
 * Supports three modes: Anonymous, Student, Admin
 */

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { useEffect, useState } from 'react';
import { adminApiClient } from '@/lib/adminApi';
import Image from 'next/image';

type UserRole = 'anonymous' | 'student' | 'admin';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { student, loading: studentLoading, login: studentLogin, logout: studentLogout } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('anonymous');
  const [adminData, setAdminData] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authPing, setAuthPing] = useState(0);

  const isActive = (path: string) => pathname === path;

  // Determine user role: prioritize admin auth immediately; fall back to student/public
  useEffect(() => {
    let cancelled = false;

    const checkRole = async () => {
      setIsCheckingAuth(true);

      // 1) Admin auth has priority and should not wait on student auth
      if (adminApiClient.isAuthenticated()) {
        // Optimistically use stored admin user to avoid flicker
        const stored = adminApiClient.getStoredUser();
        if (stored) {
          setAdminData(stored);
        }
        setUserRole('admin');
        setIsCheckingAuth(false);

        // Validate token in background; if invalid, logout and fallback
        try {
          const admin = await adminApiClient.getCurrentAdmin();
          if (!cancelled) {
            setAdminData(admin);
          }
        } catch (error) {
          adminApiClient.logout();
          if (!cancelled) {
            if (student) {
              setUserRole('student');
            } else {
              setUserRole('anonymous');
            }
          }
        }
        return;
      }

      // 2) No admin token; check student auth
      if (student) {
        setUserRole('student');
      } else {
        setUserRole('anonymous');
      }
      setIsCheckingAuth(false);
    };

    checkRole();
    return () => {
      cancelled = true;
    };
  }, [student, studentLoading, pathname, authPing]);

  // Listen for explicit admin auth changes (login/logout) to re-evaluate immediately
  useEffect(() => {
    const onAuthChanged = () => setAuthPing((v) => v + 1);
    window.addEventListener('admin-auth-changed', onAuthChanged);
    return () => window.removeEventListener('admin-auth-changed', onAuthChanged);
  }, []);

  const handleAdminLogout = async () => {
    await adminApiClient.logout();
    setUserRole('anonymous');
    setAdminData(null);
    router.push('/admin/login');
  };

  const handleStudentLogout = async () => {
    await studentLogout();
    setUserRole('anonymous');
    router.push('/student/login');
  };

  // Define navigation links based on role
  const getNavLinks = () => {
    switch (userRole) {
      case 'student':
        return [
          { href: '/student/apply', label: 'Apply' },
          { href: '/student/applications', label: 'My Applications' },
          { href: '/student/interviews', label: 'Interviews' },
          { href: '/student/dashboard', label: 'Dashboard' },
        ];
      case 'admin':
        return [
          { href: '/admin/dashboard', label: 'Admin Dashboard' },
          { href: '/admin/cycles', label: 'Manage Cycles' },
          { href: '/admin/interviews', label: 'Interviews' },
        ];
      case 'anonymous':
      default:
        return [
          { href: '/', label: 'Home' },
          { href: '/dashboard', label: 'Public Dashboard' },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
            <Image
              src="/images/eNigma-logo.png"
              alt="ENIGMA logo"
              width={32}
              height={32}
              className="h-8 w-8 mr-2"
              priority
            />
            <div className="text-2xl font-bold text-primary-600">ENIGMA</div>
            <div className="ml-2 text-sm text-gray-600 hidden sm:block">
              Bias-Free Admissions
            </div>
          </Link>

          <div className="flex items-center space-x-1">
            {!isCheckingAuth && navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Loading skeleton during auth check */}
            {isCheckingAuth && (
              <div className="flex items-center space-x-2">
                <div className="h-8 w-20 bg-gray-200 rounded-lg animate-pulse"></div>
                <div className="h-8 w-32 bg-gray-200 rounded-lg animate-pulse"></div>
              </div>
            )}

            {/* Student Auth UI */}
            {!isCheckingAuth && userRole === 'student' && student && (
              <div className="flex items-center space-x-3 ml-3 pl-3 border-l border-gray-300">
                <div className="hidden sm:flex flex-col text-sm text-gray-600 text-right">
                  <span className="font-medium text-gray-900">
                    {student.display_name || 'Student'}
                  </span>
                  <span className="text-xs text-gray-500">{student.primary_email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleStudentLogout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}

            {/* Admin Auth UI */}
            {!isCheckingAuth && userRole === 'admin' && adminData && (
              <div className="flex items-center space-x-3 ml-3 pl-3 border-l border-gray-300">
                <div className="hidden sm:flex flex-col text-sm text-gray-600 text-right">
                  <span className="font-medium text-gray-900">
                    {adminData.username}
                  </span>
                  <span className="text-xs text-gray-500 uppercase">{adminData.role}</span>
                </div>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}

            {/* Anonymous User UI */}
            {!isCheckingAuth && userRole === 'anonymous' && (
              <div className="flex items-center space-x-2 ml-3">
                <button
                  type="button"
                  onClick={studentLogin}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                >
                  Student Login
                </button>
                <Link
                  href="/admin/login"
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Admin
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
