'use client';

import React, { useState, useEffect } from 'react';
import { adminApiClient, AdmissionCycle, InterviewDetails, InterviewCreate, ApplicationDetails } from '@/lib/adminApi';
import  Button  from '@/components/Button';
import  Card  from '@/components/Card';
import  Input  from '@/components/Input';

const AdminInterviewsPage = () => {
  const [activeCycle, setActiveCycle] = useState<AdmissionCycle | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<ApplicationDetails[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<InterviewDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const allCycles = await adminApiClient.getAllCycles();
        const selectionCycle = allCycles.find(c => c.phase === 'selection');

        if (selectionCycle) {
          setActiveCycle(selectionCycle);
          const applicants = await adminApiClient.getCycleApplications(selectionCycle.cycle_id, 'SELECTED');
          setSelectedApplicants(applicants);

          const interviews = await adminApiClient.getInterviewsForCycle(selectionCycle.cycle_id);
          setScheduledInterviews(interviews);
        }
      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSchedule = async (applicationId: string, interviewTime: string, interviewLink: string) => {
    if (!activeCycle) return;

    try {
      const newInterview: InterviewCreate = {
        application_id: applicationId,
        interview_time: new Date(interviewTime).toISOString(),
        interview_link: interviewLink,
      };
      const scheduled = await adminApiClient.scheduleInterview(newInterview);
      setScheduledInterviews([...scheduledInterviews, scheduled]);
    } catch (err) {
      alert('Failed to schedule interview. The applicant may not be in the SELECTED status.');
      console.error(err);
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
          <h2 className="text-xl mb-2">Active Cycle: {activeCycle.cycle_name}</h2>
          
          <Card title="Selected Applicants (Ready for Interview)" className="mb-6">
            {selectedApplicants.length > 0 ? (
              <ul>
                {selectedApplicants.map(app => (
                  <li key={app.application_id} className="border-b py-2">
                    <p>Applicant ID: {app.application_id}</p>
                    <p>Name: {app.name}</p>
                    <p>Email: {app.email}</p>
                    <ScheduleForm applicationId={app.application_id} onSchedule={handleSchedule} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>No applicants are currently in the 'SELECTED' status for this cycle.</p>
            )}
          </Card>

          <Card title="Scheduled Interviews">
            {scheduledInterviews.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {scheduledInterviews.map(interview => (
                  <li key={interview.id} className="py-3 flex justify-between items-center">
                    <div>
                      <p><strong>Applicant ID:</strong> {interview.application_id}</p>
                      <p><strong>Time:</strong> {new Date(interview.interview_time).toLocaleString()}</p>
                      <p><strong>Status:</strong> {interview.status}</p>
                    </div>
                    <Button 
                      onClick={() => window.location.href = interview.interview_link}
                      disabled={interview.status !== 'SCHEDULED'}
                    >
                      Join Interview
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No interviews scheduled for this cycle yet.</p>
            )}
          </Card>
        </div>
      ) : (
        <p>No active admission cycle in the 'selection' phase found.</p>
      )}
    </div>
  );
};

const ScheduleForm = ({ applicationId, onSchedule }: { applicationId: string, onSchedule: (applicationId: string, time: string, link: string) => void }) => {
  const [time, setTime] = useState('');
  const [link, setLink] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSchedule(applicationId, time, link);
    setTime('');
    setLink('');
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <Input
        type="datetime-local"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        required
        label="Interview Time"
      />
      <Input
        type="text"
        value={link}
        onChange={(e) => setLink(e.target.value)}
        placeholder="Meeting Link"
        required
        label="Meeting Link"
      />
      <Button type="submit" size="sm">Schedule</Button>
    </form>
  );
}

export default AdminInterviewsPage;
