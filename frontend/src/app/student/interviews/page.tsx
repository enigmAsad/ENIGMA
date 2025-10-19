'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { studentApiClient } from '@/lib/studentApi';
import type { InterviewDetails } from '@/lib/adminApi';
import Card from '@/components/Card';
import Button from '@/components/Button';

const StudentInterviewsPage = () => {
  const router = useRouter();
  const [interviews, setInterviews] = useState<InterviewDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await studentApiClient.getInterviews();
        setInterviews(data);
      } catch (e: any) {
        setError(e?.message || 'Failed to load interviews');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  if (isLoading) {
    return <div className="p-4">Loading interviews...</div>;
  }

  if (error) {
    return <div className="p-4 text-red-600">{error}</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">My Interviews</h1>

      <Card title="Scheduled Interviews">
        {interviews.length === 0 ? (
          <p>No interviews found.</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {interviews.map((interview) => {
              const interviewTime = new Date(interview.interview_time);
              const now = new Date();
              const oneDay = 24 * 60 * 60 * 1000;
              const isScheduled = interview.status === 'scheduled';
              const withinWindow =
                now.getTime() >= interviewTime.getTime() - oneDay &&
                now.getTime() <= interviewTime.getTime() + oneDay;
              const canJoin = isScheduled && withinWindow;

              return (
                <li key={interview.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p><strong>Application ID:</strong> {interview.application_id}</p>
                    <p><strong>Time:</strong> {interviewTime.toLocaleString()}</p>
                    <p><strong>Status:</strong> {interview.status}</p>
                  </div>
                  <div className="text-right">
                    <Button
                      onClick={() => router.push(`/interview/${interview.id}`)}
                      disabled={!canJoin}
                      className="disabled:bg-gray-500 disabled:cursor-not-allowed"
                    >
                      Join Interview
                    </Button>
                    {isScheduled && !withinWindow && (
                      <p className="text-xs text-yellow-500 mt-1">Joinable 24h before/after scheduled time.</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default StudentInterviewsPage;


