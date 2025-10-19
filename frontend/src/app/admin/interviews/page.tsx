'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminApiClient, AdmissionCycle, InterviewDetails, InterviewCreate, ApplicationDetails } from '@/lib/adminApi';
import  Button  from '@/components/Button';
import  Card  from '@/components/Card';
import  Input  from '@/components/Input';

const AdminInterviewsPage = () => {
  const router = useRouter();
  const [activeCycle, setActiveCycle] = useState<AdmissionCycle | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<ApplicationDetails[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<InterviewDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const allCycles = await adminApiClient.getAllCycles();

        // For scheduling, find the single cycle in the 'selection' phase
        const selectionCycle = allCycles.find(c => c.phase === 'selection');
        if (selectionCycle) {
          setActiveCycle(selectionCycle);
          const applicants = await adminApiClient.getCycleApplications(selectionCycle.cycle_id, 'selected');
          setSelectedApplicants(applicants);
        }

        // For displaying, get interviews from all relevant cycles
        const validPhases = ['selection', 'published', 'completed'];
        const interviewCycles = allCycles.filter(c => validPhases.includes(c.phase));

        const interviewPromises = interviewCycles.map(cycle =>
          adminApiClient.getInterviewsForCycle(cycle.cycle_id)
        );

        const interviewsPerCycle = await Promise.all(interviewPromises);
        const allInterviews = interviewsPerCycle.flat();

        setScheduledInterviews(allInterviews);

      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSchedule = async (applicationId: string, interviewTime: string): Promise<boolean> => {
    if (!activeCycle) return false;

    setScheduleErrors(prev => ({ ...prev, [applicationId]: '' }));

    try {
      const newInterview: InterviewCreate = {
        application_id: applicationId,
        interview_time: new Date(interviewTime).toISOString(),
      };
      const scheduled = await adminApiClient.scheduleInterview(newInterview);
      setScheduledInterviews([...scheduledInterviews, scheduled]);
      return true;
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      let errorMessage = 'An unknown error occurred while scheduling.';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        // Handle Pydantic validation errors
        errorMessage = errorDetail.map(d => `${d.loc.join('.')} - ${d.msg}`).join(', ');
      }
      
      setScheduleErrors(prev => ({ ...prev, [applicationId]: errorMessage }));
      console.error(err);
      return false;
    }
  };

  const handleDelete = async (interviewId: number) => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await adminApiClient.deleteInterview(interviewId);
        setScheduledInterviews(scheduledInterviews.filter(i => i.id !== interviewId));
      } catch (err) {
        alert('Failed to delete interview.');
        console.error('Failed to delete interview', err);
      }
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

            return (
              <div className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-4">Interview Management</h1>
  
                {activeCycle ? (
                  <div>
                    <h2 className="text-xl mb-2">Active Cycle for Scheduling: {activeCycle.cycle_name}</h2>
                    <Card title="Selected Applicants (Ready for Interview)" className="mb-6">
                      {selectedApplicants.length > 0 ? (
                        <ul>
                          {selectedApplicants.map(app => (
                            <li key={app.application_id} className="border-b py-2">
                              <p>Applicant ID: {app.application_id}</p>
                              <p>Name: {app.name}</p>
                              <p>Email: {app.email}</p>
                              <ScheduleForm 
                                applicationId={app.application_id} 
                                onSchedule={handleSchedule} 
                                error={scheduleErrors[app.application_id]}
                              />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>No applicants are currently in the 'SELECTED' status for this cycle.</p>
                      )}
                    </Card>
                  </div>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                      <p className="text-blue-800">
                        There is no active cycle in the 'selection' phase. Scheduling new interviews is disabled.
                      </p>
                  </div>
                )}
  
                <Card title="Scheduled Interviews">
                  {scheduledInterviews.length > 0 ? (
                    <ul className="divide-y divide-gray-200">
                      {scheduledInterviews.map(interview => {
                        const now = new Date();
                        const interviewTime = new Date(interview.interview_time);
                        const oneDay = 24 * 60 * 60 * 1000;
                        const isScheduled = interview.status === 'scheduled';
                        const isWithinWindow = 
                          now.getTime() >= (interviewTime.getTime() - oneDay) &&
                          now.getTime() <= (interviewTime.getTime() + oneDay);
                        
                        const isJoinable = isScheduled && isWithinWindow;
                        const showTimeWindowMessage = isScheduled && !isWithinWindow;
  
                        return (
                          <li key={interview.id} className="py-3 flex justify-between items-center">
                            <div>
                              <p><strong>Applicant ID:</strong> {interview.application_id}</p>
                              <p><strong>Time:</strong> {interviewTime.toLocaleString()}</p>
                              <p><strong>Status:</strong> {interview.status}</p>
                            </div>
                            <div className="text-right">
                              <Button 
                                onClick={() => router.push(`/interview/${interview.id}`)}
                                disabled={!isJoinable}
                                className="disabled:bg-gray-500 disabled:cursor-not-allowed"
                              >
                                Join Interview
                              </Button>
                              <Button 
                                onClick={() => handleDelete(interview.id)}
                                variant="danger"
                                size="sm"
                                className="ml-2"
                              >
                                Delete
                              </Button>
                              {showTimeWindowMessage && (
                                <p className="text-xs text-yellow-500 mt-1">
                                  Joinable 24 hours before/after scheduled time.
                                </p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p>No interviews found for cycles in selection, published, or completed phases.</p>
                  )}
                </Card>
              </div>
            );};

const ScheduleForm = ({ applicationId, onSchedule, error }: { applicationId: string, onSchedule: (applicationId: string, time: string) => Promise<boolean>, error?: string }) => {
  const [time, setTime] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSchedule(applicationId, time);
    if (success) {
      setTime('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <Input
        type="datetime-local"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required
        label="Interview Time"
        error={error}
      />
      <Button type="submit" size="sm">Schedule</Button>
    </form>
  );
}

export default AdminInterviewsPage;
