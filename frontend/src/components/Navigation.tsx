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
import {
  Home, BarChart3, FileText, Video, LayoutDashboard,
  Calendar, LogOut, Menu, X, User, Users, Shield, ChevronDown,
  Sparkles
} from 'lucide-react';

type UserRole = 'anonymous' | 'student' | 'admin';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { student, loading: studentLoading, login: studentLogin, logout: studentLogout } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>('anonymous');
  const [adminData, setAdminData] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authPing, setAuthPing] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const isActive = (path: string) => pathname === path;

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
          { href: '/student/apply', label: 'Apply', icon: Sparkles },
          { href: '/student/applications', label: 'My Applications', icon: FileText },
          { href: '/student/interviews', label: 'Interviews', icon: Video },
          { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        ];
      case 'admin':
        return [
          { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/admin/cycles', label: 'Manage Cycles', icon: Calendar },
          { href: '/admin/interviews', label: 'Interviews', icon: Video },
        ];
      case 'anonymous':
      default:
        return [
          { href: '/', label: 'Home', icon: Home },
          { href: '/about', label: 'About', icon: Users },
          { href: '/dashboard', label: 'Public Dashboard', icon: BarChart3 },
        ];
    }
  };

  const navLinks = getNavLinks();

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/95 backdrop-blur-lg shadow-lg border-b border-gray-200/50'
        : 'bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-200/30'
    }`}>
      {/* Gradient accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500 opacity-60"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo Section */}
          <Link href="/" className="flex items-center group">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-indigo-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 p-1.5 shadow-md group-hover:shadow-lg transition-all group-hover:scale-105">
                <Image
                  src="/images/eNigma-logo.png"
                  alt="ENIGMA logo"
                  width={32}
                  height={32}
                  className="h-full w-full object-contain"
                  priority
                />
              </div>
            </div>
            <div className="ml-3 flex items-center">
              <div className="text-2xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                ENIGMA
              </div>
              <div className="ml-2 text-xs font-medium text-gray-600 hidden lg:block border-l border-gray-300 pl-2">
                Bias-Free Admissions
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {!isCheckingAuth && navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive(link.href)
                      ? 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                  }`}
                >
                  <Icon className={`h-4 w-4 transition-transform duration-200 ${
                    isActive(link.href) ? '' : 'group-hover:scale-110'
                  }`} />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            {/* Loading skeleton */}
            {isCheckingAuth && (
              <div className="flex items-center space-x-2">
                <div className="h-9 w-24 bg-gray-200 rounded-xl animate-pulse"></div>
                <div className="h-9 w-32 bg-gray-200 rounded-xl animate-pulse"></div>
              </div>
            )}

            {/* Student Auth UI */}
            {!isCheckingAuth && userRole === 'student' && student && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-gray-200">
                <div className="hidden lg:flex flex-col text-xs text-right">
                  <span className="font-semibold text-gray-900">
                    {student.display_name || 'Student'}
                  </span>
                  <span className="text-gray-500 truncate max-w-[150px]">
                    {student.primary_email}
                  </span>
                </div>
                <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-primary-100 to-indigo-100 flex items-center justify-center border-2 border-primary-200">
                  <User className="h-5 w-5 text-primary-600" />
                </div>
                <button
                  type="button"
                  onClick={handleStudentLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden xl:inline">Logout</span>
                </button>
              </div>
            )}

            {/* Admin Auth UI */}
            {!isCheckingAuth && userRole === 'admin' && adminData && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l-2 border-gray-200">
                <div className="hidden lg:flex flex-col text-xs text-right">
                  <span className="font-semibold text-gray-900">
                    {adminData.username}
                  </span>
                  <span className="text-teal-600 uppercase text-[10px] font-bold flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {adminData.role}
                  </span>
                </div>
                <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center border-2 border-teal-200">
                  <Shield className="h-5 w-5 text-teal-600" />
                </div>
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden xl:inline">Logout</span>
                </button>
              </div>
            )}

            {/* Anonymous User UI */}
            {!isCheckingAuth && userRole === 'anonymous' && (
              <div className="flex items-center gap-2 ml-4">
                <button
                  type="button"
                  onClick={studentLogin}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg hover:scale-105"
                >
                  Student Login
                </button>
                <Link
                  href="/admin/login"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all"
                >
                  <Shield className="h-4 w-4" />
                  Admin
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white/95 backdrop-blur-lg">
          <div className="px-4 py-4 space-y-2">
            {!isCheckingAuth && navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(link.href)
                      ? 'bg-gradient-to-r from-primary-50 to-indigo-50 text-primary-700 shadow-sm'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {link.label}
                </Link>
              );
            })}

            {/* Mobile User Info */}
            {!isCheckingAuth && userRole === 'student' && student && (
              <>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-100 to-indigo-100 flex items-center justify-center border-2 border-primary-200">
                      <User className="h-5 w-5 text-primary-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {student.display_name || 'Student'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {student.primary_email}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleStudentLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </>
            )}

            {!isCheckingAuth && userRole === 'admin' && adminData && (
              <>
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-xl">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center border-2 border-teal-200">
                      <Shield className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        {adminData.username}
                      </p>
                      <p className="text-xs text-teal-600 uppercase font-bold">
                        {adminData.role}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    handleAdminLogout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
                >
                  <LogOut className="h-5 w-5" />
                  Logout
                </button>
              </>
            )}

            {!isCheckingAuth && userRole === 'anonymous' && (
              <div className="border-t border-gray-200 pt-3 mt-3 space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    studentLogin();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-700 hover:to-indigo-700 transition-all shadow-md"
                >
                  Student Login
                </button>
                <Link
                  href="/admin/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-200 transition-all"
                >
                  <Shield className="h-4 w-4" />
                  Admin Login
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
