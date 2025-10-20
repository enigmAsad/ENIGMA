'use client';

import Image from 'next/image';
import {
  Heart, Shield, Zap, Code, Brain, Lock, Eye, Users,
  Sparkles, Target, TrendingUp, Award, Rocket, Star,
  CheckCircle2, Globe, Lightbulb, Database, GitBranch
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        {/* Animated background */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-3 sm:mb-4 shadow-lg">
              <Heart className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-pink-300" />
              <span className="text-white/90 font-medium text-xs sm:text-sm">Built with passion</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-3 sm:mb-4">
              About ENIGMA
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-white/90 mb-2 max-w-3xl mx-auto">
              Two indie hackers on a mission to revolutionize admissions with AI-powered fairness and transparency
            </p>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-12 text-slate-50" preserveAspectRatio="none" viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48h1440V0C1440 0 1080 48 720 48S0 0 0 0v48z" fill="currentColor"/>
          </svg>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

        {/* Mission Statement */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300 -mt-16 relative z-10">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Our Mission</h2>
                <p className="text-purple-100 text-sm">Why we built ENIGMA</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <p className="text-gray-700 leading-relaxed text-lg mb-4">
              We believe that <span className="font-bold text-gray-900">merit should be the only factor</span> in academic admissions.
              Traditional processes are plagued by unconscious bias, lack of transparency, and inconsistent evaluation criteria.
            </p>
            <p className="text-gray-700 leading-relaxed text-lg">
              ENIGMA leverages cutting-edge AI and cryptographic techniques to create a <span className="font-bold text-gray-900">completely fair,
              bias-free, and verifiable</span> admissions process that gives every applicant an equal opportunity to succeed based purely on their merits.
            </p>
          </div>
        </div>

        {/* Group Photo */}
        <div className="mb-8">
          <div className="group relative overflow-hidden rounded-2xl border-2 border-primary-200 bg-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-primary-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-bl-full opacity-50"></div>
            <div className="relative p-2">
              <div className="overflow-hidden rounded-xl">
                <Image
                  src="/images/our-pic-together.HEIC"
                  alt="Asad Ghaffar and Arsalan Sikander - The ENIGMA Team"
                  width={1920}
                  height={1080}
                  className="h-auto w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  priority
                />
              </div>
            </div>
            <div className="px-8 py-6 bg-gradient-to-r from-primary-50 to-indigo-50 border-t-2 border-primary-100">
              <p className="text-center text-gray-700 font-medium">
                <span className="font-bold text-primary-900">Asad Ghaffar</span> and <span className="font-bold text-primary-900">Arsalan Sikander</span> –
                Building the future of fair admissions
              </p>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Meet the Team</h2>
                <p className="text-indigo-100 text-sm">The indie hackers behind ENIGMA</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">

              {/* Asad Ghaffar */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-50 to-indigo-50 p-6 border-2 border-primary-200 hover:border-primary-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-200/30 rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-start gap-5 mb-4">
                    <div className="flex-shrink-0 h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden border-4 border-white shadow-xl group-hover:scale-105 transition-transform">
                      <Image
                        src="/images/asad.png"
                        alt="Asad Ghaffar - AI Engineer"
                        width={256}
                        height={256}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">Asad Ghaffar</h3>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary-500 to-indigo-600 text-white text-sm font-semibold shadow-md mb-3">
                        <Brain className="h-4 w-4" />
                        AI Engineer
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-800 leading-relaxed mb-4">
                    Focused on model alignment, privacy-preserving inference, and building reliable AI systems
                    that enhance fairness and transparency.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      <span>AI Model Development & Fine-tuning</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      <span>Bias Detection & Mitigation</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-primary-600" />
                      <span>Privacy-Preserving ML</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Arsalan Sikander */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 border-2 border-emerald-200 hover:border-emerald-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-bl-full"></div>
                <div className="relative">
                  <div className="flex items-start gap-5 mb-4">
                    <div className="flex-shrink-0 h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden border-4 border-white shadow-xl group-hover:scale-105 transition-transform">
                      <Image
                        src="/images/arsalan.HEIC"
                        alt="Arsalan Sikander - Full Stack Developer"
                        width={256}
                        height={256}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-1">Arsalan Sikander</h3>
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold shadow-md mb-3">
                        <Code className="h-4 w-4" />
                        Full Stack Developer
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-800 leading-relaxed mb-4">
                    Specializes in robust, scalable web apps with great UX; turns complex product ideas
                    into fast, accessible experiences.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Full Stack Architecture</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>User Experience Design</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>Performance Optimization</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Core Values */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Star className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Our Core Values</h2>
                <p className="text-emerald-100 text-sm">What drives us every day</p>
              </div>
            </div>
          </div>
          <div className="p-8 grid md:grid-cols-3 gap-6">

            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 to-indigo-50 p-6 border-2 border-primary-200 hover:border-primary-300 transition-all hover:shadow-lg">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-200/30 rounded-bl-full"></div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform mb-4">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-bold text-primary-900 mb-2 text-xl">Fairness First</h3>
                <p className="text-sm text-primary-800 leading-relaxed">
                  Every applicant deserves an equal chance. We eliminate bias through blind evaluation and cryptographic verification.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 border-2 border-emerald-200 hover:border-emerald-300 transition-all hover:shadow-lg">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-bl-full"></div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform mb-4">
                  <Eye className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-bold text-emerald-900 mb-2 text-xl">Transparency</h3>
                <p className="text-sm text-emerald-800 leading-relaxed">
                  Complete openness in our process. Public dashboards, detailed explanations, and verifiable decisions.
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-lg">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/30 rounded-bl-full"></div>
              <div className="relative flex flex-col items-center text-center">
                <div className="flex-shrink-0 h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform mb-4">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-bold text-purple-900 mb-2 text-xl">Innovation</h3>
                <p className="text-sm text-purple-800 leading-relaxed">
                  Pushing boundaries with AI. We combine cutting-edge technology with human-centered design.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Company & Projects */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">The enigmA Family</h2>
                <p className="text-primary-100 text-sm">Our company and bootstrapped projects</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            {/* Company Intro */}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-8 p-6 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-2xl border-2 border-primary-200">
              <div className="flex-shrink-0">
                <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl overflow-hidden bg-white shadow-xl border-4 border-white">
                  <Image
                    src="/images/enigmA-logo.jpg"
                    alt="enigmA Company Logo"
                    width={200}
                    height={200}
                    className="h-full w-full object-contain p-2"
                  />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-3xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent mb-3">
                  enigmA
                </h3>
                <p className="text-gray-800 leading-relaxed text-lg">
                  Our company dedicated to building innovative AI-powered solutions. We bootstrap passion projects
                  that solve real problems and push the boundaries of what's possible with modern technology.
                </p>
              </div>
            </div>

            {/* Projects Grid */}
            <div className="grid md:grid-cols-3 gap-6">

              {/* ENIGMA */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/30 rounded-bl-full"></div>
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <Shield className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-purple-900 text-xl mb-2">ENIGMA</h4>
                  <div className="inline-block px-2 py-1 rounded-md bg-purple-200 text-purple-800 text-xs font-semibold mb-3">
                    Current Project
                  </div>
                  <p className="text-sm text-purple-800 leading-relaxed">
                    AI-powered fair admissions platform. Eliminates bias through blind evaluation and cryptographic verification.
                  </p>
                </div>
              </div>

              {/* eNigma */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 border-2 border-emerald-200 hover:border-emerald-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-bl-full"></div>
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <Zap className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-emerald-900 text-xl mb-2">eNigma</h4>
                  <div className="inline-block px-2 py-1 rounded-md bg-emerald-200 text-emerald-800 text-xs font-semibold mb-3">
                    Bootstrapped
                  </div>
                  <p className="text-sm text-emerald-800 leading-relaxed">
                    AI-powered ecommerce website builder. Create beautiful, conversion-optimized online stores in minutes.
                  </p>
                </div>
              </div>

              {/* enigMATE */}
              <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-50 to-yellow-50 p-6 border-2 border-orange-200 hover:border-orange-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200/30 rounded-bl-full"></div>
                <div className="relative">
                  <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-yellow-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                    <Globe className="h-7 w-7 text-white" />
                  </div>
                  <h4 className="font-bold text-orange-900 text-xl mb-2">enigMATE</h4>
                  <div className="inline-block px-2 py-1 rounded-md bg-orange-200 text-orange-800 text-xs font-semibold mb-3">
                    Bootstrapped
                  </div>
                  <p className="text-sm text-orange-800 leading-relaxed">
                    Full website-aware browser extension. Intelligent browsing companion that understands entire web pages.
                  </p>
                </div>
              </div>

            </div>

            <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                </div>
                <p className="text-gray-800 leading-relaxed flex-1">
                  All three projects are <span className="font-bold text-gray-900">bootstrapped and built from scratch</span> by our team.
                  We believe in creating products that make a real difference, funded by passion and driven by purpose.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Journey & Stats */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-gray-700 via-slate-800 to-gray-900 px-8 py-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">Our Journey</h2>
                <p className="text-gray-300 text-sm">Building ENIGMA from the ground up</p>
              </div>
            </div>
          </div>
          <div className="p-8">
            <div className="grid sm:grid-cols-3 gap-6 mb-8">

              <div className="group text-center bg-gradient-to-br from-primary-50 to-indigo-50 rounded-2xl p-8 border-2 border-primary-200 hover:border-primary-300 transition-all hover:shadow-lg">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <Lightbulb className="h-8 w-8 text-white" />
                </div>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  2024
                </p>
                <p className="text-sm text-gray-600">Founded</p>
              </div>

              <div className="group text-center bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 border-2 border-emerald-200 hover:border-emerald-300 transition-all hover:shadow-lg">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <GitBranch className="h-8 w-8 text-white" />
                </div>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-2">
                  100+
                </p>
                <p className="text-sm text-gray-600">Commits</p>
              </div>

              <div className="group text-center bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-lg">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                  ∞
                </p>
                <p className="text-sm text-gray-600">Passion</p>
              </div>

            </div>

            <div className="p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-600 to-indigo-700 flex items-center justify-center">
                    <Award className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Why We Started</h3>
                  <p className="text-gray-800 leading-relaxed">
                    We witnessed firsthand how talented individuals were overlooked due to unconscious bias in traditional
                    admissions processes. ENIGMA is our answer to this problem – <span className="font-bold text-gray-900">a system that judges
                    merit, not demographics</span>. As indie hackers, we have the freedom to innovate rapidly and build
                    something truly revolutionary.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
