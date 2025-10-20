/**
 * Landing page - ENIGMA mission and overview
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Button from '@/components/Button';
import Card from '@/components/Card';
import {
  CheckCircle, Ban, GraduationCap, Users, Lock, ShieldCheck, Search,
  BarChart3, Target, Zap, TrendingUp, Globe, Award, FileText, Video,
  Sparkles, ArrowRight, Shield, Eye, Clock, ChevronRight, Star,
  Verify, Database, RefreshCw, CheckCircle2
} from 'lucide-react';
import { adminApiClient, type AdmissionInfo } from '@/lib/adminApi';
import { useAuth } from '@/hooks/useStudentAuth';

export default function Home() {
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);
  const { student } = useAuth();

  // Determine where to send users for application
  const getApplicationLink = () => {
    if (student) {
      return '/student/dashboard';
    }
    return '/student/login';
  };

  useEffect(() => {
    const fetchAdmissionInfo = async () => {
      try {
        const info = await adminApiClient.getAdmissionInfo();
        setAdmissionInfo(info);
      } catch (error) {
        console.error('Failed to fetch admission info:', error);
      }
    };
    fetchAdmissionInfo();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Admission Status Banner */}
      {admissionInfo && (
        <div className={`relative overflow-hidden ${
          admissionInfo.is_open
            ? 'bg-gradient-to-r from-green-600 via-emerald-600 to-green-600'
            : 'bg-gradient-to-r from-gray-600 via-slate-600 to-gray-600'
        } text-white`}>
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-3">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center">
              <span aria-hidden className="shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-white/20 flex items-center justify-center">
                {admissionInfo.is_open ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </span>
              <div className="flex flex-col sm:flex-row items-center gap-2">
                <p className="font-semibold text-sm sm:text-base">
                  {admissionInfo.is_open ? (
                    <>Admissions are OPEN for {admissionInfo.cycle_name}!</>
                  ) : (
                    <>Admissions are currently CLOSED. {admissionInfo.message}</>
                  )}
                </p>
                {admissionInfo.is_open && admissionInfo.seats_available !== undefined && (
                  <span className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-0.5 rounded-full bg-white/20 text-xs">
                    <Users className="h-3 w-3" />
                    {admissionInfo.seats_available} of {admissionInfo.max_seats} seats
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-700">
        {/* Animated background elements */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-purple-400/10 blur-3xl"></div>
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-5 py-2 text-sm mb-8 shadow-lg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
              </span>
              <span className="text-white font-medium">Bias-Free AI Admissions Platform</span>
              <Award className="h-4 w-4 text-yellow-300" />
            </div>

            {/* Main heading */}
            <div className="mb-6">
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-extrabold tracking-tight text-white mb-2">
                ENIGMA
              </h1>
              <div className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
                <div className="h-1 w-8 sm:w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full"></div>
                <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300" />
                <div className="h-1 w-8 sm:w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full"></div>
              </div>
            </div>

            <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl text-white/95 max-w-4xl mx-auto leading-relaxed mb-3 sm:mb-4 font-light px-4">
              Fair, transparent, and merit-based university admissions powered by AI
            </p>

            <p className="text-sm sm:text-base md:text-lg text-white/80 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4">
              Eliminate bias, ensure fairness, and provide complete transparency in every admission decision
              with cryptographically verifiable proof.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-4 mb-6 sm:mb-8 max-w-lg sm:max-w-none mx-auto">
              <Link href={getApplicationLink()} className="w-full sm:w-auto">
                <button
                  disabled={!admissionInfo?.is_open}
                  className="w-full group relative inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white text-primary-700 font-semibold text-base sm:text-lg shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden touch-manipulation"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-white to-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                  <span className="relative flex items-center gap-2">
                    {admissionInfo?.is_open ? (student ? 'Go to Dashboard' : 'Apply Now') : 'Applications Closed'}
                    {admissionInfo?.is_open && <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />}
                  </span>
                </button>
              </Link>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <button className="w-full group inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold text-base sm:text-lg hover:bg-white/20 hover:scale-105 transition-all shadow-lg touch-manipulation">
                  <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" />
                  Public Dashboard
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>

            {/* Deadline */}
            {admissionInfo?.is_open && admissionInfo.end_date && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 text-white/90 text-sm">
                <Clock className="h-4 w-4" />
                <span>Application deadline: <span className="font-semibold">{new Date(admissionInfo.end_date).toLocaleDateString()}</span></span>
              </div>
            )}

            {/* Trust indicators */}
            <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 text-white/80 text-xs sm:text-sm px-4">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>100% Bias-Free</span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-white/30"></div>
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Cryptographically Secure</span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-white/30"></div>
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span>Fully Transparent</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-12 sm:h-16 text-slate-50" preserveAspectRatio="none" viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48h1440V0C1440 0 1080 48 720 48S0 0 0 0v48z" fill="currentColor"/>
          </svg>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="relative -mt-12 sm:-mt-16 z-10 py-6 sm:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            <div className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-4 sm:px-6 py-6 sm:py-8 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 mb-4 shadow-md">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent mb-1">10k+</div>
                <div className="text-sm font-medium text-gray-600">Applications Processed</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-purple-100 to-pink-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-6 py-8 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-md">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">1,200+</div>
                <div className="text-sm font-medium text-gray-600">Bias Nudges Delivered</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-6 py-8 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-md">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-1">~24h</div>
                <div className="text-sm font-medium text-gray-600">Avg. Turnaround Time</div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-6 py-8 text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-4 shadow-md">
                  <CheckCircle2 className="h-6 w-6 text-white" />
                </div>
                <div className="text-3xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-1">100%</div>
                <div className="text-sm font-medium text-gray-600">Auditable Decisions</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-white"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-200 mb-6">
              <Target className="h-4 w-4 text-primary-600" />
              <span className="text-sm font-semibold text-primary-700">Our Mission</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Fairness Through <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">Technology</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-4xl mx-auto leading-relaxed">
              ENIGMA eliminates bias from university admissions through blind AI evaluation and
              real-time monitoring. We ensure every applicant is judged solely on merit, with
              complete transparency and cryptographic proof of integrity.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-indigo-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center mb-4 shadow-md">
                  <Shield className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Zero Bias</h3>
                <p className="text-gray-600 leading-relaxed">
                  All identifying information is completely removed before evaluation. Only merit matters.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mb-4 shadow-md">
                  <Eye className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Full Transparency</h3>
                <p className="text-gray-600 leading-relaxed">
                  Every decision is explained with detailed feedback and cryptographic verification.
                </p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
              <div className="relative bg-white rounded-2xl p-8 shadow-lg border border-gray-100 hover:shadow-xl transition-all">
                <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4 shadow-md">
                  <Award className="h-7 w-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Merit-Based</h3>
                <p className="text-gray-600 leading-relaxed">
                  AI evaluates applications purely on academic achievement and potential.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-gray-50 via-slate-50 to-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200 mb-6">
              <RefreshCw className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-700">The Process</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              How ENIGMA <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">Works</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our three-phase evaluation process ensures fairness, transparency, and merit-based selection
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Phase 1 */}
            <div className="relative group">
              <div className="absolute -top-4 -left-4 h-16 w-16 bg-primary-100 rounded-2xl opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="relative bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden hover:shadow-2xl hover:border-primary-200 transition-all duration-300">
                <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-white/80 font-medium">Phase 1</div>
                      <h3 className="text-xl font-bold text-white">AI Screening</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-primary-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Identity scrubbing removes all personal information</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-primary-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">AI Worker evaluates merit: GPA, tests, achievements, essay</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-primary-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">AI Judge validates for bias and quality</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-primary-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Retry loop ensures fair evaluation</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Phase 2 */}
            <div className="relative group">
              <div className="absolute -top-4 -left-4 h-16 w-16 bg-purple-100 rounded-2xl opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="relative bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden hover:shadow-2xl hover:border-purple-200 transition-all duration-300">
                <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Video className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-white/80 font-medium">Phase 2</div>
                      <h3 className="text-xl font-bold text-white">Monitored Interviews</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Live interviews with human evaluators</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Real-time AI monitors evaluator language for bias</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Instant nudges for inappropriate questions</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Statistical validation ensures consistency</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Transparency */}
            <div className="relative group">
              <div className="absolute -top-4 -left-4 h-16 w-16 bg-emerald-100 rounded-2xl opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="relative bg-white rounded-2xl shadow-lg border-2 border-gray-100 overflow-hidden hover:shadow-2xl hover:border-emerald-200 transition-all duration-300">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                      <Lock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="text-xs text-white/80 font-medium">Phase 3</div>
                      <h3 className="text-xl font-bold text-white">Cryptographic Audit</h3>
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <ul className="space-y-4">
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Every decision is hashed with SHA-256</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Public verification portal for integrity checks</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Tamper-evident audit trail</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-emerald-100 flex items-center justify-center mt-0.5">
                        <CheckCircle className="h-4 w-4 text-emerald-600" />
                      </div>
                      <span className="text-gray-700 leading-relaxed">Complete transparency and accountability</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(64,186,186,0.05),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(99,102,241,0.05),transparent_50%)]"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-50 border border-emerald-200 mb-6">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700">Trust & Security</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Why Trust <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">ENIGMA</span>?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Built on principles of fairness, transparency, and technological excellence
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-bl-full opacity-30"></div>
              <div className="relative flex items-start gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Eye className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Blind Evaluation</h3>
                  <p className="text-gray-600 leading-relaxed">
                    All identifying information is removed before AI evaluation. No names, gender, ethnicity,
                    or location data reaches the evaluation system.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-bl-full opacity-30"></div>
              <div className="relative flex items-start gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Statistical Validation</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Inter-rater agreement checks, outlier detection, and drift monitoring ensure consistent
                    and fair evaluations across all applicants.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-bl-full opacity-30"></div>
              <div className="relative flex items-start gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Search className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Complete Transparency</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Every applicant receives detailed explanations with score breakdowns, strengths identified,
                    and constructive feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg border border-gray-100 hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-bl-full opacity-30"></div>
              <div className="relative flex items-start gap-5">
                <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                  <Lock className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Cryptographic Proof</h3>
                  <p className="text-gray-600 leading-relaxed">
                    SHA-256 hash chain provides tamper-evident logging. Anyone can verify the integrity of decisions
                    through our public verification portal.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-indigo-700">
        {/* Animated background */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-0 left-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-8 shadow-lg">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-white/90 font-medium text-sm">Join the Future of Admissions</span>
            </div>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white mb-4 sm:mb-6 leading-tight px-4">
              Ready to Experience{' '}
              <span className="inline-block bg-white/10 backdrop-blur-sm px-3 sm:px-4 py-1 rounded-xl">
                Fair Admissions?
              </span>
            </h2>

            <p className="text-base sm:text-lg md:text-xl text-white/90 mb-8 sm:mb-10 leading-relaxed px-4">
              {student
                ? 'Access your dashboard to submit your application and track your progress in real-time.'
                : 'Submit your application and be evaluated purely on merit, with complete transparency and cryptographic integrity.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-stretch sm:items-center px-4 max-w-lg sm:max-w-none mx-auto">
              <Link href={getApplicationLink()} className="w-full sm:w-auto">
                <button
                  disabled={!admissionInfo?.is_open}
                  className="w-full group relative inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white text-primary-700 font-bold text-base sm:text-lg shadow-2xl hover:shadow-white/20 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 touch-manipulation"
                >
                  {student ? 'Go to Dashboard' : 'Start Your Application'}
                  {(student || admissionInfo?.is_open) && (
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  )}
                </button>
              </Link>
              <Link href="/verify" className="w-full sm:w-auto">
                <button className="w-full group inline-flex items-center justify-center gap-2 min-h-[48px] sm:min-h-[52px] px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold text-base sm:text-lg hover:bg-white/20 hover:scale-105 transition-all shadow-lg touch-manipulation">
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                  Verify Results
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 md:gap-8 text-white/70 text-xs sm:text-sm px-4">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <span>No credit card required</span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-white/30"></div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <span>100% Secure</span>
              </div>
              <div className="hidden sm:block h-4 w-px bg-white/30"></div>
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                </div>
                <span>Results in ~24h</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200 mb-6">
              <Star className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-700">Platform Features</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
              Everything You <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">Need</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              A comprehensive platform built for fairness, speed, and transparency
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 mb-5 shadow-md group-hover:scale-110 transition-transform">
                <Target className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Merit-Based</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Pure merit evaluation with no demographic factors influencing decisions</p>
            </div>

            <div className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-5 shadow-md group-hover:scale-110 transition-transform">
                <Zap className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Fast Results</h3>
              <p className="text-sm text-gray-600 leading-relaxed">AI-powered processing delivers comprehensive results in ~24 hours</p>
            </div>

            <div className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-5 shadow-md group-hover:scale-110 transition-transform">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Detailed Feedback</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Comprehensive explanations with improvement areas for every applicant</p>
            </div>

            <div className="group bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 mb-5 shadow-md group-hover:scale-110 transition-transform">
                <Globe className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-3">Public Dashboard</h3>
              <p className="text-sm text-gray-600 leading-relaxed">Aggregate fairness metrics and statistics available to everyone</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
