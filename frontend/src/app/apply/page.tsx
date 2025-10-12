/**
 * Application submission form
 */

'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import TextArea from '@/components/TextArea';
import Button from '@/components/Button';
import { apiClient, ApplicationSubmitRequest } from '@/lib/api';
import { adminApiClient, type AdmissionInfo } from '@/lib/adminApi';

export default function ApplyPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);
  const [loadingAdmissionInfo, setLoadingAdmissionInfo] = useState(true);

  useEffect(() => {
    const fetchAdmissionInfo = async () => {
      try {
        const info = await adminApiClient.getAdmissionInfo();
        setAdmissionInfo(info);
      } catch (error) {
        console.error('Failed to fetch admission info:', error);
      } finally {
        setLoadingAdmissionInfo(false);
      }
    };
    fetchAdmissionInfo();
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    gpa: '',
    sat: '',
    act: '',
    essay: '',
    achievements: '',
  });

  // Form errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.email.includes('@')) newErrors.email = 'Invalid email format';

    const gpa = parseFloat(formData.gpa);
    if (!formData.gpa) newErrors.gpa = 'GPA is required';
    else if (isNaN(gpa) || gpa < 0 || gpa > 4.0) newErrors.gpa = 'GPA must be between 0.0 and 4.0';

    if (!formData.sat && !formData.act) {
      newErrors.sat = 'At least one test score (SAT or ACT) is required';
      newErrors.act = 'At least one test score (SAT or ACT) is required';
    }

    if (formData.sat) {
      const sat = parseFloat(formData.sat);
      if (isNaN(sat) || sat < 400 || sat > 1600) {
        newErrors.sat = 'SAT must be between 400 and 1600';
      }
    }

    if (formData.act) {
      const act = parseFloat(formData.act);
      if (isNaN(act) || act < 1 || act > 36) {
        newErrors.act = 'ACT must be between 1 and 36';
      }
    }

    if (!formData.essay.trim()) newErrors.essay = 'Essay is required';
    else if (formData.essay.length < 100) newErrors.essay = 'Essay must be at least 100 characters';
    else if (formData.essay.length > 5000) newErrors.essay = 'Essay must not exceed 5000 characters';

    if (!formData.achievements.trim()) newErrors.achievements = 'Achievements are required';
    else if (formData.achievements.length < 10) newErrors.achievements = 'Please provide more detail (min 10 characters)';
    else if (formData.achievements.length > 3000) newErrors.achievements = 'Achievements must not exceed 3000 characters';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!validateForm()) {
      setError('Please fix the errors above');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build test scores object
      const test_scores: Record<string, number> = {};
      if (formData.sat) test_scores.SAT = parseFloat(formData.sat);
      if (formData.act) test_scores.ACT = parseFloat(formData.act);

      const requestData: ApplicationSubmitRequest = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        gpa: parseFloat(formData.gpa),
        test_scores,
        essay: formData.essay.trim(),
        achievements: formData.achievements.trim(),
      };

      const response = await apiClient.submitApplication(requestData);

      setSuccess(true);
      setApplicationId(response.application_id);

      // Reset form
      setFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        gpa: '',
        sat: '',
        act: '',
        essay: '',
        achievements: '',
      });

      // Redirect to status page after 3 seconds
      setTimeout(() => {
        router.push(`/status?id=${response.application_id}`);
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success && applicationId) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card>
          <div className="text-center">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="text-3xl font-bold text-green-600 mb-4">Application Submitted!</h2>
            <p className="text-lg text-gray-700 mb-6">
              Your application has been received and is being processed.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600 mb-1">Your Application ID:</p>
              <p className="text-2xl font-mono font-bold text-blue-600">{applicationId}</p>
              <p className="text-xs text-gray-500 mt-2">Save this ID to check your status</p>
            </div>
            <p className="text-gray-600 mb-6">
              Redirecting to status page in 3 seconds...
            </p>
            <Button onClick={() => router.push(`/status?id=${applicationId}`)}>
              View Status Now
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Show loading state while checking admission status
  if (loadingAdmissionInfo) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Checking admission status...</p>
      </div>
    );
  }

  // Show closed message if admissions are not open
  if (!admissionInfo?.is_open) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Card>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-3xl font-bold text-red-600 mb-4">Admissions Closed</h2>
            <p className="text-lg text-gray-700 mb-6">
              {admissionInfo?.message || 'Applications are not being accepted at this time.'}
            </p>
            <Button onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Admission Status Banner */}
      {admissionInfo && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-green-900">
                Admissions Open for {admissionInfo.cycle_name}
              </p>
              <p className="text-sm text-green-700 mt-1">
                {admissionInfo.seats_available} of {admissionInfo.max_seats} seats available
                {admissionInfo.end_date && (
                  <> • Deadline: {new Date(admissionInfo.end_date).toLocaleDateString()}</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Submit Your Application</h1>
        <p className="text-lg text-gray-600">
          All information will be anonymized before evaluation. You will be judged purely on merit.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Information */}
        <Card title="Personal Information" subtitle="This information will be removed before AI evaluation">
          <div className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              error={errors.name}
              required
              placeholder="John Doe"
            />

            <Input
              label="Email Address"
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              error={errors.email}
              required
              placeholder="john@example.com"
            />

            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              error={errors.phone}
              placeholder="+1 (555) 123-4567"
              helperText="Optional"
            />

            <TextArea
              label="Address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              error={errors.address}
              rows={2}
              placeholder="123 Main St, City, State, ZIP"
              helperText="Optional"
            />
          </div>
        </Card>

        {/* Academic Information */}
        <Card title="Academic Information" subtitle="Your grades and test scores">
          <div className="space-y-4">
            <Input
              label="GPA (4.0 scale)"
              type="number"
              step="0.01"
              min="0"
              max="4.0"
              value={formData.gpa}
              onChange={(e) => handleInputChange('gpa', e.target.value)}
              error={errors.gpa}
              required
              placeholder="3.75"
              helperText="Enter your GPA on a 4.0 scale"
            />

            <div className="grid md:grid-cols-2 gap-4">
              <Input
                label="SAT Score"
                type="number"
                min="400"
                max="1600"
                value={formData.sat}
                onChange={(e) => handleInputChange('sat', e.target.value)}
                error={errors.sat}
                placeholder="1450"
                helperText="400-1600"
              />

              <Input
                label="ACT Score"
                type="number"
                min="1"
                max="36"
                value={formData.act}
                onChange={(e) => handleInputChange('act', e.target.value)}
                error={errors.act}
                placeholder="32"
                helperText="1-36"
              />
            </div>

            <p className="text-sm text-gray-500 italic">
              At least one test score (SAT or ACT) is required
            </p>
          </div>
        </Card>

        {/* Essay */}
        <Card title="Application Essay" subtitle="Tell us about yourself and your goals">
          <TextArea
            label="Essay"
            value={formData.essay}
            onChange={(e) => handleInputChange('essay', e.target.value)}
            error={errors.essay}
            required
            rows={10}
            maxLength={5000}
            characterCount
            placeholder="Write about your academic interests, goals, motivations, and why you're a great fit..."
            helperText="Minimum 100 characters, maximum 5000 characters"
          />
        </Card>

        {/* Achievements */}
        <Card title="Achievements & Activities" subtitle="Awards, competitions, projects, extracurriculars">
          <TextArea
            label="Achievements"
            value={formData.achievements}
            onChange={(e) => handleInputChange('achievements', e.target.value)}
            error={errors.achievements}
            required
            rows={8}
            maxLength={3000}
            characterCount
            placeholder="List your awards, competitions, projects, leadership roles, volunteer work, etc."
            helperText="Minimum 10 characters, maximum 3000 characters"
          />
        </Card>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Privacy & Fairness Guarantee</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>✓ Your name, contact information, and identifiable details will be removed before AI evaluation</li>
            <li>✓ Evaluation is based purely on academic merit: GPA, test scores, essay quality, and achievements</li>
            <li>✓ No demographic factors (gender, ethnicity, location) are considered</li>
            <li>✓ Every decision is cryptographically hashed for transparency and verification</li>
            <li>✓ You will receive detailed explanations and feedback with your results</li>
          </ul>
        </div>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="w-full md:w-auto px-12"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      </form>
    </div>
  );
}
