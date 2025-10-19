/**
 * Landing page - ENIGMA mission and overview
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import Card from '@/components/Card';
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
    <div className="min-h-screen">
      {/* Admission Status Banner */}
      {admissionInfo && (
        <div className={`${admissionInfo.is_open ? 'bg-green-600' : 'bg-red-600'} text-white py-2.5`}> 
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-3 text-center">
              <span className="text-xl" aria-hidden>
                {admissionInfo.is_open ? '✅' : '⛔️'}
              </span>
              <p className="font-semibold">
                {admissionInfo.is_open ? (
                  <>
                    Admissions are OPEN for {admissionInfo.cycle_name}!
                    {admissionInfo.seats_available !== undefined && (
                      <> {admissionInfo.seats_available} of {admissionInfo.max_seats} seats available.</>
                    )}
                  </>
                ) : (
                  <>Admissions are currently CLOSED. {admissionInfo.message}</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-gradient-to-br from-primary-600 to-primary-700 text-white py-24 sm:py-28">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 right-10 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/20 px-4 py-1.5 text-sm mb-5">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              <span className="text-primary-50">Bias-Free AI Admissions</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">ENIGMA</h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Fair, transparent, and merit-based university admissions powered by AI
            </p>
            <div className="mt-8 flex gap-4 justify-center flex-wrap">
              <Link href={getApplicationLink()}>
                <Button
                  variant="outline"
                  size="lg"
                  className="!border-white/80 !text-white hover:bg-white/10 disabled:opacity-100"
                  disabled={!admissionInfo?.is_open}
                >
                  {admissionInfo?.is_open ? (student ? 'Go to Dashboard' : 'Apply Now') : 'Applications Closed'}
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/80 text-white hover:bg-white/10"
                >
                  View Public Dashboard
                </Button>
              </Link>
            </div>
            {admissionInfo?.is_open && admissionInfo.end_date && (
              <p className="mt-5 text-white/80">
                Application deadline: {new Date(admissionInfo.end_date).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="-mt-10 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-6 text-center">
              <div className="text-2xl font-bold text-gray-900">10k+</div>
              <div className="text-sm text-gray-600">Applications processed</div>
            </div>
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-6 text-center">
              <div className="text-2xl font-bold text-gray-900">1,200+</div>
              <div className="text-sm text-gray-600">Bias nudges delivered</div>
            </div>
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-6 text-center">
              <div className="text-2xl font-bold text-gray-900"><span className="align-top text-base">~</span>24h</div>
              <div className="text-sm text-gray-600">Avg. turnaround</div>
            </div>
            <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 px-5 py-6 text-center">
              <div className="text-2xl font-bold text-gray-900">100%</div>
              <div className="text-sm text-gray-600">Auditable decisions</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Our Mission</h2>
          <p className="text-lg text-gray-700 text-center max-w-4xl mx-auto leading-relaxed">
            ENIGMA eliminates bias from university admissions through blind AI evaluation and
            real-time monitoring. We ensure every applicant is judged solely on merit, with
            complete transparency and cryptographic proof of integrity.
          </p>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Phase 1 */}
            <Card className="border-t-4 border-transparent hover:border-primary-600 transition-all hover:shadow-lg hover:-translate-y-0.5" title="Phase 1: AI Screening">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 text-2xl">🎓</div>
              <ul className="space-y-3 text-gray-700 leading-relaxed">
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Identity scrubbing removes all personal information</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>AI Worker evaluates merit: GPA, tests, achievements, essay</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>AI Judge validates for bias and quality</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Retry loop ensures fair evaluation</span>
                </li>
              </ul>
            </Card>

            {/* Phase 2 */}
            <Card className="border-t-4 border-transparent hover:border-primary-600 transition-all hover:shadow-lg hover:-translate-y-0.5" title="Phase 2: Monitored Interviews">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 text-2xl">👥</div>
              <ul className="space-y-3 text-gray-700 leading-relaxed">
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Live interviews with human evaluators</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Real-time AI monitors evaluator language for bias</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Instant nudges for inappropriate questions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Statistical validation ensures consistency</span>
                </li>
              </ul>
            </Card>

            {/* Transparency */}
            <Card className="border-t-4 border-transparent hover:border-primary-600 transition-all hover:shadow-lg hover:-translate-y-0.5" title="Cryptographic Audit">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 text-2xl">🔒</div>
              <ul className="space-y-3 text-gray-700 leading-relaxed">
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Every decision is hashed with SHA-256</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Public verification portal for integrity checks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Tamper-evident audit trail</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary-600 mr-2">•</span>
                  <span>Complete transparency and accountability</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Why Trust ENIGMA?</h2>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md">
              <div className="flex items-start">
                <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 text-xl">✅</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">Blind Evaluation</h3>
                  <p className="text-gray-700 leading-relaxed">
                    All identifying information is removed before AI evaluation. No names, gender, ethnicity,
                    or location data reaches the evaluation system.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md">
              <div className="flex items-start">
                <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 text-xl">📊</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">Statistical Validation</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Inter-rater agreement checks, outlier detection, and drift monitoring ensure consistent
                    and fair evaluations across all applicants.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md">
              <div className="flex items-start">
                <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 text-xl">🔍</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">Complete Transparency</h3>
                  <p className="text-gray-700 leading-relaxed">
                    Every applicant receives detailed explanations with score breakdowns, strengths identified,
                    and constructive feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200 transition hover:shadow-md">
              <div className="flex items-start">
                <div className="mr-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600 text-xl">🛡️</div>
                <div>
                  <h3 className="text-lg font-semibold mb-1.5">Cryptographic Proof</h3>
                  <p className="text-gray-700 leading-relaxed">
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
      <section className="relative isolate overflow-hidden py-16 bg-primary-600 text-white">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute -top-10 left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 right-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Experience Fair Admissions?</h2>
          <p className="text-lg md:text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
            {student
              ? 'Access your dashboard to submit your application and track your progress.'
              : 'Submit your application and be evaluated purely on merit, with complete transparency and integrity.'}
          </p>
          <Link href={getApplicationLink()}>
            <Button
              variant="outline"
              size="lg"
              className="!border-white/80 !text-white hover:bg-white/10 disabled:opacity-100"
              disabled={!admissionInfo?.is_open}
            >
              {student ? 'Go to Dashboard' : 'Start Your Application'}
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 text-center transition hover:shadow-md">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold mb-2">Merit-Based</h3>
              <p className="text-sm text-gray-600">Pure merit evaluation with no demographic factors</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 text-center transition hover:shadow-md">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold mb-2">Fast Results</h3>
              <p className="text-sm text-gray-600">AI-powered processing delivers results quickly</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 text-center transition hover:shadow-md">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold mb-2">Detailed Feedback</h3>
              <p className="text-sm text-gray-600">Comprehensive explanations and improvement areas</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 text-center transition hover:shadow-md">
              <div className="text-3xl mb-3">🌐</div>
              <h3 className="font-semibold mb-2">Public Dashboard</h3>
              <p className="text-sm text-gray-600">Aggregate fairness metrics available to everyone</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
