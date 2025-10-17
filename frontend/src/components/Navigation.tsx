/**
 * Navigation bar component
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';

export default function Navigation() {
  const pathname = usePathname();
  const { student, login, logout } = useAuth();

  const isActive = (path: string) => pathname === path;

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/apply', label: 'Apply' },
    { href: '/status', label: 'Check Status' },
    { href: '/verify', label: 'Verify' },
    { href: '/dashboard', label: 'Dashboard' },
  ];

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
            {student ? (
              <div className="flex items-center space-x-3 ml-3">
                <div className="hidden sm:flex flex-col text-sm text-gray-600 text-right">
                  <span className="font-medium text-gray-900">{student.name}</span>
                  <span className="text-xs text-gray-500">{student.email}</span>
                </div>
                <Link
                  href="/student/dashboard"
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive('/student/dashboard')
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Student Dashboard
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="px-3 py-2 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={login}
                className="ml-3 px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Student Login
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
