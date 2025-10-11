/**
 * Landing page - ENIGMA mission and overview
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import Card from '@/components/Card';
import { adminApiClient, type AdmissionInfo } from '@/lib/adminApi';

export default function Home() {
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);

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
        <div className={`${admissionInfo.is_open ? 'bg-green-600' : 'bg-red-600'} text-white py-3`}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
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
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              ENIGMA
            </h1>
            <p className="text-2xl md:text-3xl mb-4 text-blue-100">
              Bias-Free AI Admissions
            </p>
            <p className="text-xl md:text-2xl mb-8 text-blue-200 max-w-3xl mx-auto">
              Fair, transparent, and merit-based university admissions powered by AI
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/apply">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-gray-100"
                  disabled={!admissionInfo?.is_open}
                >
                  {admissionInfo?.is_open ? 'Apply Now' : 'Applications Closed'}
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" size="lg" className="border-white text-white hover:bg-blue-700">
                  View Dashboard
                </Button>
              </Link>
            </div>
            {admissionInfo?.is_open && admissionInfo.end_date && (
              <p className="mt-4 text-blue-200">
                Application deadline: {new Date(admissionInfo.end_date).toLocaleDateString()}
              </p>
            )}
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
            <Card title="Phase 1: AI Screening">
              <div className="text-4xl mb-4">🎓</div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Identity scrubbing removes all personal information</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>AI Worker evaluates merit: GPA, tests, achievements, essay</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>AI Judge validates for bias and quality</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Retry loop ensures fair evaluation</span>
                </li>
              </ul>
            </Card>

            {/* Phase 2 */}
            <Card title="Phase 2: Monitored Interviews">
              <div className="text-4xl mb-4">👥</div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Live interviews with human evaluators</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Real-time AI monitors evaluator language for bias</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Instant nudges for inappropriate questions</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Statistical validation ensures consistency</span>
                </li>
              </ul>
            </Card>

            {/* Transparency */}
            <Card title="Cryptographic Audit">
              <div className="text-4xl mb-4">🔒</div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Every decision is hashed with SHA-256</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Public verification portal for integrity checks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Tamper-evident audit trail</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
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
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start">
              <div className="text-3xl mr-4">✅</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Blind Evaluation</h3>
                <p className="text-gray-700">
                  All identifying information is removed before AI evaluation.
                  No names, gender, ethnicity, or location data reaches the evaluation system.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="text-3xl mr-4">📊</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Statistical Validation</h3>
                <p className="text-gray-700">
                  Inter-rater agreement checks, outlier detection, and drift monitoring
                  ensure consistent and fair evaluations across all applicants.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="text-3xl mr-4">🔍</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Complete Transparency</h3>
                <p className="text-gray-700">
                  Every applicant receives detailed explanations with score breakdowns,
                  strengths identified, and constructive feedback.
                </p>
              </div>
            </div>

            <div className="flex items-start">
              <div className="text-3xl mr-4">🛡️</div>
              <div>
                <h3 className="text-xl font-semibold mb-2">Cryptographic Proof</h3>
                <p className="text-gray-700">
                  SHA-256 hash chain provides tamper-evident logging. Anyone can verify
                  the integrity of decisions through our public verification portal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Experience Fair Admissions?</h2>
          <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto">
            Submit your application and be evaluated purely on merit, with complete transparency and integrity.
          </p>
          <Link href="/apply">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
              Start Your Application
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Features</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="font-semibold mb-2">Merit-Based</h3>
              <p className="text-sm text-gray-600">Pure merit evaluation with no demographic factors</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="font-semibold mb-2">Fast Results</h3>
              <p className="text-sm text-gray-600">AI-powered processing delivers results quickly</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="font-semibold mb-2">Detailed Feedback</h3>
              <p className="text-sm text-gray-600">Comprehensive explanations and improvement areas</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm text-center">
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
