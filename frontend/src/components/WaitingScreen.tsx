'use client';

import React from 'react';
import { Clock, User, Video, Sparkles } from 'lucide-react';

const WaitingScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-8 text-white">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center animate-pulse">
                <Video className="h-8 w-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">Interview Room</h1>
            <p className="text-white/90 text-center text-lg">
              Waiting for Interviewer
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-12">
            {/* Animated Clock */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="h-32 w-32 rounded-full bg-gradient-to-br from-primary-100 to-indigo-100 flex items-center justify-center animate-pulse">
                  <Clock className="h-16 w-16 text-primary-600" />
                </div>
                {/* Pulsing rings */}
                <div className="absolute inset-0 rounded-full border-4 border-primary-300 animate-ping opacity-20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary-400 animate-ping opacity-30" style={{ animationDelay: '0.5s' }}></div>
              </div>
            </div>

            {/* Message */}
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                Please Wait
              </h2>
              <p className="text-lg text-gray-700 mb-6">
                Waiting for the interviewer to start the session...
              </p>
              <p className="text-gray-600">
                The interview will begin shortly. Please remain on this page.
              </p>
            </div>

            {/* Status Indicator */}
            <div className="flex items-center justify-center gap-2 mb-8">
              <div className="flex gap-1">
                <div className="h-3 w-3 rounded-full bg-primary-500 animate-bounce"></div>
                <div className="h-3 w-3 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="h-3 w-3 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12">
              <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-white/80 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Stay Ready</h3>
                </div>
                <p className="text-sm text-gray-700">
                  Ensure your camera and microphone are working properly
                </p>
              </div>

              <div className="p-5 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-lg bg-white/80 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-bold text-gray-900">Auto-Start</h3>
                </div>
                <p className="text-sm text-gray-700">
                  The interview will automatically begin when the interviewer joins
                </p>
              </div>
            </div>

            {/* Guidelines */}
            <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold">!</span>
                While You Wait
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Check that you have good lighting and minimal background noise</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Position your camera at eye level for best visibility</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Keep this window open – do not navigate away</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Stay calm and be yourself – good luck!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Checking for interviewer status every 5 seconds...
          </p>
        </div>
      </div>
    </div>
  );
};

export default WaitingScreen;
