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

type UserRole = 'anonymous' | 'student' | 'admin';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { student, login: studentLogin, logout: studentLogout } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('anonymous');
  const [adminData, setAdminData] = useState<any>(null);

  const isActive = (path: string) => pathname === path;

  // Determine user role on mount and when student state changes
  useEffect(() => {
    const checkRole = async () => {
      // Check admin auth first
      if (adminApiClient.isAuthenticated()) {
        try {
          const admin = await adminApiClient.getCurrentAdmin();
          setAdminData(admin);
          setUserRole('admin');
          return;
        } catch (error) {
          // Admin token is invalid, clear it
          adminApiClient.logout();
        }
      }

      // Check student auth
      if (student) {
        setUserRole('student');
      } else {
        setUserRole('anonymous');
      }
    };

    checkRole();
  }, [student]);

  const handleAdminLogout = async () => {
    await adminApiClient.logout();
    setUserRole('anonymous');
    setAdminData(null);
    router.push('/admin/login');
  };

  // Define navigation links based on role
  const getNavLinks = () => {
    switch (userRole) {
      case 'student':
        return [
          { href: '/', label: 'Home' },
          { href: '/student/apply', label: 'Apply' },
          { href: '/student/dashboard', label: 'My Dashboard' },
        ];
      case 'admin':
        return [
          { href: '/', label: 'Home' },
          { href: '/admin/dashboard', label: 'Admin Dashboard' },
          { href: '/admin/cycles', label: 'Manage Cycles' },
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
            <div className="text-2xl font-bold text-blue-600">ENIGMA</div>
            <div className="ml-2 text-sm text-gray-600 hidden sm:block">
              Bias-Free Admissions
            </div>
          </Link>

          <div className="flex items-center space-x-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* Student Auth UI */}
            {userRole === 'student' && student && (
              <div className="flex items-center space-x-3 ml-3 pl-3 border-l border-gray-300">
                <div className="hidden sm:flex flex-col text-sm text-gray-600 text-right">
                  <span className="font-medium text-gray-900">
                    {student.display_name || 'Student'}
                  </span>
                  <span className="text-xs text-gray-500">{student.primary_email}</span>
                </div>
                <button
                  type="button"
                  onClick={studentLogout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            )}

            {/* Admin Auth UI */}
            {userRole === 'admin' && adminData && (
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
            {userRole === 'anonymous' && (
              <div className="flex items-center space-x-2 ml-3">
                <button
                  type="button"
                  onClick={studentLogin}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
