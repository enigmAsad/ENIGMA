
'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import TextArea from '@/components/TextArea';
import Button from '@/components/Button';
import { ApplicationSubmitRequest } from '@/lib/api';
import { type AdmissionInfo } from '@/lib/adminApi';
import { Student, studentApiClient } from '@/lib/studentApi';

interface ApplicationFormProps {
  student: Student;
  admissionInfo: AdmissionInfo;
  onApplicationSuccess: (applicationId: string) => void;
}

export default function ApplicationForm({ student, admissionInfo, onApplicationSuccess }: ApplicationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state - prefill email from student object
  const [formData, setFormData] = useState({
    name: student.display_name || '',
    email: student.primary_email,
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

  useEffect(() => {
    // Pre-fill form when student data is available
    setFormData(prev => ({
      ...prev,
      name: student.display_name || '',
      email: student.primary_email,
    }));
  }, [student]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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

    if (student.application) {
      setError("You have already submitted an application.");
      return;
    }

    if (!validateForm()) {
      setError('Please fix the errors above');
      return;
    }

    setIsSubmitting(true);

    try {
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

      const response = await studentApiClient.submitApplication(requestData);
      onApplicationSuccess(response.application_id);

    } catch (err: any) {
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Admission Status Banner */}
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

      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Submit Your Application</h1>
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
              disabled // Email should not be editable as it's tied to the student account
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
            helperText="Minimum 100 characters, maximum 3000 characters"
          />
        </Card>

        {/* Privacy Notice */}
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-6">
          <h3 className="font-semibold text-primary-900 mb-2">Privacy & Fairness Guarantee</h3>
          <ul className="text-sm text-primary-800 space-y-2">
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
    </>
  );
}
