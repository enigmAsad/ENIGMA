# ENIGMA Frontend Implementation (Phase 1 + Admin Portal)

Complete documentation of the frontend implementation for ENIGMA's bias-free admissions system.

**Implementation Date:** 2025-10-11 (Phase 1), 2025-10-12 (Admin Portal)
**Framework:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
**Status:** ✅ Phase 1 Complete + Admin Portal Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [API Client](#api-client)
4. [UI Components](#ui-components)
5. [Pages](#pages)
6. [Features](#features)
7. [Styling](#styling)
8. [Data Flow](#data-flow)
9. [Security](#security)
10. [Testing Guide](#testing-guide)
11. [Future Enhancements](#future-enhancements)

---

## Overview

The ENIGMA frontend provides a complete user interface for the Phase 1 blind AI evaluation system. It enables applicants to:
- Submit applications securely
- Track evaluation progress in real-time
- View detailed results with score breakdowns
- Verify cryptographic hashes for integrity
- Access public fairness metrics

### Key Technologies

- **Next.js 15**: App Router with Server Components
- **React 19**: Latest with Suspense boundaries
- **TypeScript**: Full type safety throughout
- **Tailwind CSS 4**: Utility-first styling
- **REST API**: Integration with FastAPI backend

---

## Architecture

### Directory Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with Navigation
│   │   ├── page.tsx            # Landing page (/) - Updated with admission status
│   │   ├── apply/
│   │   │   └── page.tsx        # Application form - Updated with admission checks
│   │   ├── status/
│   │   │   └── page.tsx        # Status checker & results
│   │   ├── verify/
│   │   │   └── page.tsx        # Hash verification portal
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Public fairness dashboard
│   │   ├── admin/              # ⭐ NEW: Admin portal
│   │   │   ├── login/
│   │   │   │   └── page.tsx    # Admin login page
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx    # Admin dashboard (overview)
│   │   │   └── cycles/
│   │   │       └── page.tsx    # Admission cycle management
│   │   └── globals.css         # Global styles
│   │
│   ├── components/             # Reusable UI components
│   │   ├── Button.tsx          # Button with variants & loading states
│   │   ├── Card.tsx            # Card container with header
│   │   ├── Input.tsx           # Text input with validation
│   │   ├── TextArea.tsx        # Multi-line input with char counter
│   │   └── Navigation.tsx      # Top navigation bar
│   │
│   ├── hooks/                  # ⭐ NEW: Custom React hooks
│   │   └── useAdminAuth.ts     # Admin authentication hook
│   │
│   └── lib/
│       ├── api.ts              # Public API client & TypeScript types
│       └── adminApi.ts         # ⭐ NEW: Admin API client
│
├── public/                     # Static assets
├── .env.local.example          # Environment variables template
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript configuration
├── tailwind.config.ts          # Tailwind configuration
└── FRONTEND.md                 # This file
```

### Design Principles

1. **Component Reusability**: Shared components for consistency
2. **Type Safety**: TypeScript interfaces for all data structures
3. **Progressive Enhancement**: Works without JavaScript (SSR)
4. **Responsive Design**: Mobile-first approach
5. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation
6. **Performance**: Code splitting, lazy loading, optimized images

---

## API Client

### File: `src/lib/api.ts`

Central API client for all backend communication.

#### Key Features

- **Singleton Pattern**: Single instance exported as `apiClient`
- **Type-Safe**: Full TypeScript interfaces for requests/responses
- **Error Handling**: Structured error parsing from backend
- **Centralized Config**: `NEXT_PUBLIC_API_URL` environment variable

#### Interfaces Defined

```typescript
// Request/Response Models
- ApplicationSubmitRequest
- ApplicationSubmitResponse
- ApplicationStatusResponse
- ResultsResponse
- VerifyRequest
- VerifyResponse
- DashboardStatsResponse

// API Methods
- submitApplication(data)
- getApplicationStatus(id)
- getResults(anonymizedId)
- verifyHash(data)
- verifyChain()
- getDashboardStats()
- healthCheck()
```

#### Usage Example

```typescript
import { apiClient } from '@/lib/api';

// Submit application
const response = await apiClient.submitApplication({
  name: "John Doe",
  email: "john@example.com",
  gpa: 3.8,
  // ...
});

// Check status
const status = await apiClient.getApplicationStatus("APP_12345678");

// Get results
const results = await apiClient.getResults("ANON_1234567890_ABC123");
```

#### Configuration

Set `NEXT_PUBLIC_API_URL` in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Defaults to `http://localhost:8000` if not set.

---

## UI Components

### 1. Button (`src/components/Button.tsx`)

Reusable button with variants and loading states.

**Props:**
- `variant`: `'primary' | 'secondary' | 'outline' | 'danger'`
- `size`: `'sm' | 'md' | 'lg'`
- `isLoading`: boolean - Shows spinner when true
- Standard HTML button props

**Variants:**
- **Primary**: Blue background, white text (CTAs)
- **Secondary**: Gray background (less important actions)
- **Outline**: Border only (tertiary actions)
- **Danger**: Red background (destructive actions)

**Example:**
```tsx
<Button
  variant="primary"
  size="lg"
  isLoading={submitting}
  onClick={handleSubmit}
>
  Submit Application
</Button>
```

**Features:**
- Disabled state handling
- Loading spinner with animation
- Hover/active state transitions
- Fully accessible

---

### 2. Card (`src/components/Card.tsx`)

Container component for content sections.

**Props:**
- `title`: Optional header title
- `subtitle`: Optional header subtitle
- `className`: Additional CSS classes
- `children`: Card content

**Example:**
```tsx
<Card
  title="Personal Information"
  subtitle="This will be anonymized"
>
  <Input label="Name" />
  <Input label="Email" />
</Card>
```

**Features:**
- Consistent shadow and border
- Optional header section
- Responsive padding
- Rounded corners

---

### 3. Input (`src/components/Input.tsx`)

Text input with label and validation.

**Props:**
- `label`: Input label
- `error`: Error message (red text)
- `helperText`: Help text (gray text)
- `required`: Shows red asterisk
- Standard HTML input props

**Example:**
```tsx
<Input
  label="GPA"
  type="number"
  step="0.01"
  min="0"
  max="4.0"
  value={gpa}
  onChange={(e) => setGpa(e.target.value)}
  error={errors.gpa}
  helperText="Enter your GPA on a 4.0 scale"
  required
/>
```

**Features:**
- Automatic error styling
- Focus ring animation
- Helper text support
- Required indicator

---

### 4. TextArea (`src/components/TextArea.tsx`)

Multi-line input with character counter.

**Props:**
- `label`: Input label
- `error`: Error message
- `helperText`: Help text
- `characterCount`: boolean - Show counter
- `maxLength`: Maximum characters
- Standard HTML textarea props

**Example:**
```tsx
<TextArea
  label="Essay"
  value={essay}
  onChange={(e) => setEssay(e.target.value)}
  rows={10}
  maxLength={5000}
  characterCount
  helperText="Minimum 100 characters"
  required
/>
```

**Features:**
- Real-time character count
- Visual feedback approaching limit
- Auto-sizing support
- Error state styling

---

### 5. Navigation (`src/components/Navigation.tsx`)

Top navigation bar with routing.

**Routes:**
- Home (`/`)
- Apply (`/apply`)
- Check Status (`/status`)
- Verify (`/verify`)
- Dashboard (`/dashboard`)

**Features:**
- Active route highlighting
- Responsive design
- Mobile menu support (ready for expansion)
- ENIGMA branding

**Example:**
```tsx
// Automatically included in layout.tsx
<Navigation />
```

---

## Pages

### 1. Landing Page (`src/app/page.tsx`)

**Route:** `/`

**Purpose:** Marketing and education about ENIGMA system

**Sections:**

1. **Hero Section**
   - Large ENIGMA heading
   - Mission statement
   - CTA buttons (Apply Now, View Dashboard)
   - Gradient blue background

2. **Mission Section**
   - Core mission statement
   - Emphasis on bias elimination and transparency

3. **How It Works**
   - Three cards explaining Phase 1, Phase 2, Cryptographic Audit
   - Bullet points for each process step
   - Visual icons

4. **Trust Signals**
   - Four trust factors with icons:
     - Blind Evaluation
     - Statistical Validation
     - Complete Transparency
     - Cryptographic Proof

5. **CTA Section**
   - Secondary call-to-action
   - Blue background section

6. **Features Grid**
   - Four feature highlights with icons
   - Merit-based, Fast Results, Detailed Feedback, Public Dashboard

**Design Notes:**
- Clean, professional aesthetic
- Blue primary color (#2563eb)
- Generous whitespace
- Clear visual hierarchy

---

### 2. Application Form (`src/app/apply/page.tsx`)

**Route:** `/apply`

**Purpose:** Applicant submission interface

**Form Sections:**

#### Personal Information
- Full Name (required)
- Email (required, validated)
- Phone Number (optional)
- Address (optional, textarea)

**Privacy Notice:** Clearly states this information will be removed before evaluation.

#### Academic Information
- GPA (required, 0.0-4.0 scale, 0.01 step)
- SAT Score (optional, 400-1600 range)
- ACT Score (optional, 1-36 range)

**Validation:** At least one test score required.

#### Essay
- Multi-line textarea
- Required, 100-5000 characters
- Real-time character counter
- Placeholder guidance

#### Achievements
- Multi-line textarea
- Required, 10-3000 characters
- Real-time character counter
- Examples in placeholder

**Validation Rules:**

```typescript
// Name
- Required, 2-200 characters

// Email
- Required, valid email format

// GPA
- Required, 0.0-4.0 range, float

// Test Scores
- At least one required (SAT or ACT)
- SAT: 400-1600
- ACT: 1-36

// Essay
- Required, 100-5000 characters

// Achievements
- Required, 10-3000 characters
```

**User Experience:**

1. User fills form
2. Client-side validation on submit
3. Background processing (non-blocking)
4. Success screen with Application ID
5. Auto-redirect to status page after 3 seconds

**Error Handling:**
- Field-level error messages (red text)
- Form-level error banner
- Clear error descriptions
- Non-blocking (user can continue editing)

---

### 3. Status & Results Viewer (`src/app/status/page.tsx`)

**Route:** `/status`

**Purpose:** Check application status and view evaluation results

**Query Parameters:**
- `id`: Application ID (auto-populates form)

**Features:**

#### Status Checking
- Input field for Application ID
- Real-time status polling
- Visual status indicators with emojis
- Status color coding:
  - Blue: Submitted
  - Purple: Identity Scrubbing
  - Yellow: Worker Evaluation
  - Orange: Judge Review
  - Indigo: Final Scoring
  - Green: Completed
  - Red: Failed

#### Results Display (when completed)

**1. Score Overview**
- Large final score display (0-100)
- Gradient background
- Visual emphasis

**2. Score Breakdown**
- Academic Performance (progress bar)
- Test Scores (progress bar)
- Achievements (progress bar)
- Essay Quality (progress bar)
- Color-coded bars

**3. Evaluation Explanation**
- Full text explanation from AI
- Whitespace-preserved formatting

**4. Key Strengths**
- Bulleted list with checkmarks
- Green visual styling
- Extracted from results

**5. Areas for Improvement**
- Bulleted list with arrows
- Blue visual styling
- Constructive feedback

**6. Cryptographic Verification**
- SHA-256 hash display (monospace)
- Explanation of hash purpose
- Link to verification portal
- Metadata (timestamp, worker attempts)

**Data Flow:**
```
User enters ID →
API call to /applications/{id} →
Display status →
If completed → API call to /results/{anonymized_id} →
Display comprehensive results
```

**Error States:**
- Application not found
- API connection error
- Results not yet available

---

### 4. Verification Portal (`src/app/verify/page.tsx`)

**Route:** `/verify`

**Purpose:** Verify cryptographic integrity of decisions

**Query Parameters:**
- `id`: Anonymized ID (auto-populates)
- `hash`: Expected hash (auto-populates)

**Features:**

#### Individual Hash Verification

**Inputs:**
- Anonymized ID (e.g., `ANON_1234567890_ABC123`)
- Expected Hash (64-character SHA-256 hex)

**Output:**
- ✅ **Valid**: Green success message
  - Stored hash matches expected hash
  - Explanation of what this means
  - Assurance of data integrity

- ⚠️ **Invalid**: Red warning message
  - Hash mismatch detected
  - Possible causes listed
  - Contact support guidance

**Display:**
- Side-by-side comparison of hashes
- Anonymized ID confirmation
- Visual pass/fail indicator
- Educational content

#### Chain Verification

**Purpose:** Verify entire decision chain integrity

**Output:**
- 🔒 **Valid**: All entries intact
  - Chain length
  - First/last entry timestamps
  - Confirmation message

- 🔓 **Invalid**: Chain compromised
  - Number of invalid entries
  - List of compromised entries
  - Alert message

**Educational Section:**
- How cryptographic hashing works
- What hash chains are
- Why public verification matters
- Importance for fairness

**Use Cases:**
1. Applicant verifies their own results
2. Third-party audits system integrity
3. Public verification of fairness claims
4. Research/transparency purposes

---

### 5. Public Dashboard (`src/app/dashboard/page.tsx`)

**Route:** `/dashboard`

**Purpose:** Aggregate fairness and transparency metrics

**Sections:**

#### Overview Stats (3 cards)
1. **Total Applications**
   - Count of all submitted applications
   - 📝 icon

2. **Completed Evaluations**
   - Count of finished evaluations
   - ✅ icon

3. **Average Score**
   - Mean final score (0-100)
   - ⊘ "N/A" if no completions
   - 📊 icon

#### Processing Pipeline
- Visual progress bars for each stage
- Percentages of total applications
- Color-coded by stage:
  - Blue: Submitted
  - Purple: Identity Scrubbing
  - Yellow: Worker Evaluation
  - Orange: Judge Review
  - Indigo: Final Scoring
  - Green: Completed
  - Red: Failed

#### Score Distribution
- Five ranges: 90-100, 80-89, 70-79, 60-69, below 60
- Progress bars showing distribution
- Emoji indicators: 🌟 ✨ ⭐ 💫 📌
- Color-coded (green to red gradient)
- Empty state when no completions

#### Fairness Guarantees (4 cards)
1. **Blind Evaluation** ✅
   - 100% identity scrubbing
   - Green styling

2. **Worker-Judge Validation** 🤖
   - Two-tier AI system
   - Blue styling

3. **Cryptographic Audit** 🔒
   - SHA-256 hash chain
   - Purple styling

4. **Complete Transparency** 📊
   - Detailed explanations
   - Orange styling

#### System Health (3 metrics)
1. **Success Rate** ⚡
   - Completed / Total percentage
   - Count display

2. **In Progress** 🔄
   - Applications currently processing
   - Count display

3. **Merit-Based** 🎯
   - Always 100%
   - No demographic factors

#### About Phase 1
- Process description
- Five-step explanation:
  1. Identity Scrubbing
  2. Worker AI Evaluation
  3. Judge AI Validation
  4. Retry Loop
  5. Final Scoring
- Educational prose

**Data Source:**
- `GET /dashboard/stats` endpoint
- Refreshable (button in header)
- Real-time updates

**Privacy:**
- No individual applicant data exposed
- Aggregate statistics only
- Anonymized throughout

---

### 6. Admin Portal (`src/app/admin/*`)

**⭐ NEW: Complete admin portal for managing admissions cycles**

#### Admin Login (`src/app/admin/login/page.tsx`)

**Route:** `/admin/login`

**Purpose:** Secure authentication for administrative users

**Features:**
- Username/password authentication
- JWT token-based session management
- Error handling for invalid credentials
- Automatic redirect to dashboard on success
- Clean gradient design matching main site

**Form Fields:**
- Username (required)
- Password (required, password type)

**Authentication Flow:**
```
User enters credentials →
POST /admin/auth/login →
Backend validates & generates JWT →
Frontend stores token in localStorage →
Redirect to /admin/dashboard
```

**Security:**
- Tokens stored in localStorage
- Bearer token authentication
- 24-hour token expiry (configurable)
- Secure HTTP-only cookies (recommended for production)

---

#### Admin Dashboard (`src/app/admin/dashboard/page.tsx`)

**Route:** `/admin/dashboard`

**Purpose:** Overview of current admission cycle and system status

**Authentication:** Protected route (requires valid JWT token)

**Sections:**

**1. Active Cycle Status Card**
- Cycle name and open/closed status
- Current seat occupancy (filled/total)
- Application window dates (start, end, result)
- Visual status indicator (green=open, red=closed)

**2. Statistics Overview (3 cards)**
- Total Applications: Count of all submissions
- Completed Evaluations: Finished assessments
- Average Score: Mean across all completed evaluations

**3. Quick Actions**
- Manage Cycles: Navigate to cycle management
- View Applications: (Future feature)
- System Settings: (Future feature)

**Data Flow:**
```
Page load →
Check authentication (useAdminAuth hook) →
Fetch active cycle (GET /admin/cycles/active/current) →
Fetch dashboard stats (GET /dashboard/stats) →
Display overview
```

**Features:**
- Auto-redirect to /admin/login if not authenticated
- Loading states while fetching data
- Error handling for API failures
- Logout functionality
- Real-time data refresh

---

#### Admission Cycles Management (`src/app/admin/cycles/page.tsx`)

**Route:** `/admin/cycles`

**Purpose:** Complete CRUD operations for admission cycles

**Authentication:** Protected route (requires valid JWT token)

**Key Features:**

**1. Create New Cycle**
- Toggle-able creation form
- Required fields:
  - Cycle Name (e.g., "Fall 2025 Admissions")
  - Maximum Seats (integer, min 1)
  - Start Date (datetime-local)
  - End Date (datetime-local)
  - Result Date (datetime-local)
- Client-side validation
- Success feedback and auto-refresh

**2. List All Cycles**
- Displays all admission cycles (past and present)
- Each cycle shows:
  - Cycle name and open/closed status badge
  - Seat occupancy: X / Y (Z available)
  - Start, end, and result dates with times
  - Unique cycle ID
  - Open/Close toggle button
- Color-coded status badges (green=open, red=closed)
- Real-time seat tracking

**3. Open/Close Cycles**
- One-click buttons to toggle cycle status
- Only one cycle can be open at a time (enforced by backend)
- Loading states during API calls
- Immediate UI update on success

**Data Flow:**
```
Page load →
Authenticate →
GET /admin/cycles (fetch all cycles) →
Display cycle list →

User creates cycle →
POST /admin/cycles →
Reload cycle list →

User opens cycle →
PUT /admin/cycles/{id}/open →
Backend closes other cycles →
Reload cycle list
```

**Empty State:**
- Displays when no cycles exist
- Encourages creation of first cycle

**Error Handling:**
- Form validation errors displayed inline
- API errors shown as alerts
- Network failures handled gracefully

---

### 7. Admin API Client (`src/lib/adminApi.ts`)

**Purpose:** Type-safe API client for admin operations

**Key Features:**
- Singleton pattern (single exported instance)
- Automatic JWT token injection via Authorization header
- Token management (storage, retrieval, removal)
- Full TypeScript interfaces

**Authentication Methods:**
```typescript
// Login
async login(username: string, password: string): Promise<AdminLoginResponse>
  → POST /admin/auth/login
  → Stores JWT token in localStorage
  → Returns { token, expires_at, admin: { username, email, ... } }

// Logout
async logout(): Promise<void>
  → POST /admin/auth/logout
  → Removes token from localStorage

// Check if authenticated
isAuthenticated(): boolean
  → Checks if token exists in localStorage

// Get current admin
async getCurrentAdmin(): Promise<AdminUser>
  → GET /admin/auth/me
  → Returns admin details
```

**Cycle Management Methods:**
```typescript
// Get all cycles
async getAllCycles(): Promise<AdmissionCycle[]>
  → GET /admin/cycles

// Create cycle
async createCycle(data: CreateCycleRequest): Promise<AdmissionCycle>
  → POST /admin/cycles

// Get cycle by ID
async getCycle(id: string): Promise<AdmissionCycle>
  → GET /admin/cycles/{id}

// Update cycle
async updateCycle(id: string, data: UpdateCycleRequest): Promise<AdmissionCycle>
  → PUT /admin/cycles/{id}

// Open cycle
async openCycle(id: string): Promise<AdmissionCycle>
  → PUT /admin/cycles/{id}/open

// Close cycle
async closeCycle(id: string): Promise<AdmissionCycle>
  → PUT /admin/cycles/{id}/close

// Get active cycle
async getActiveCycle(): Promise<AdmissionCycle | null>
  → GET /admin/cycles/active/current
```

**Public Admission Info (No Auth Required):**
```typescript
// Get admission info for public display
async getAdmissionInfo(): Promise<AdmissionInfo>
  → GET /admission/info
  → Returns { is_open, cycle_name, max_seats, seats_available, end_date, message }
```

**TypeScript Interfaces:**
```typescript
interface AdmissionCycle {
  cycle_id: string;
  cycle_name: string;
  is_open: boolean;
  max_seats: number;
  current_seats: number;
  result_date: string;
  start_date: string;
  end_date: string;
  created_at: string;
  created_by: string;
}

interface CreateCycleRequest {
  cycle_name: string;
  max_seats: number;
  result_date: string;
  start_date: string;
  end_date: string;
}

interface AdmissionInfo {
  is_open: boolean;
  cycle_name?: string;
  max_seats?: number;
  seats_available?: number;
  start_date?: string;
  end_date?: string;
  result_date?: string;
  message?: string;
}
```

**Error Handling:**
```typescript
try {
  const cycles = await adminApiClient.getAllCycles();
} catch (error: any) {
  if (error.status === 401) {
    // Unauthorized - redirect to login
  } else {
    // Other error - display message
  }
}
```

---

### 8. Admin Authentication Hook (`src/hooks/useAdminAuth.ts`)

**Purpose:** Reusable React hook for admin authentication state

**Features:**
- Automatic authentication check on mount
- Auto-redirect to login if not authenticated
- Centralized auth state management
- Logout functionality

**Usage:**
```typescript
import { useAdminAuth } from '@/hooks/useAdminAuth';

function AdminPage() {
  const { isAuthenticated, isLoading, admin, logout } = useAdminAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <p>Welcome, {admin?.username}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

**Return Values:**
```typescript
{
  isAuthenticated: boolean;    // True if valid token exists
  isLoading: boolean;           // True while checking auth status
  admin: AdminUser | null;      // Admin user details
  logout: () => Promise<void>;  // Logout function
}
```

**Authentication Flow:**
```
Hook mounts →
Check localStorage for token →
If no token: redirect to /admin/login →
If token exists: GET /admin/auth/me →
If valid: set admin state →
If invalid: remove token, redirect to login
```

**Automatic Redirect:**
- Protects admin pages from unauthorized access
- Seamless redirect to login when token expires
- Preserves user experience

---

### 9. Updated Public Pages

#### Landing Page Updates (`src/app/page.tsx`)

**NEW: Admission Status Banner**
- Displays at top of page (above hero section)
- Shows current admission cycle status:
  - **Green banner** (open): "Admissions are OPEN for [Cycle Name]! X of Y seats available."
  - **Red banner** (closed): "Admissions are currently CLOSED. [Message]"
- Fetches data from GET /admission/info on page load
- Real-time seat availability display
- Application deadline shown when open

**Hero Section Updates:**
- "Apply Now" button disabled when admissions closed
- Button text changes: "Apply Now" → "Applications Closed"
- Deadline information displayed when open

**Data Fetching:**
```typescript
useEffect(() => {
  const fetchAdmissionInfo = async () => {
    const info = await adminApiClient.getAdmissionInfo();
    setAdmissionInfo(info);
  };
  fetchAdmissionInfo();
}, []);
```

---

#### Application Form Updates (`src/app/apply/page.tsx`)

**NEW: Admission Status Enforcement**

**1. Status Check on Load**
- Fetches admission info before rendering form
- Shows loading state while checking
- Displays "Admissions Closed" message if not accepting applications
- Only renders form if admissions are open

**2. Closed State Display:**
```typescript
if (!admissionInfo?.is_open) {
  return (
    <Card>
      <div className="text-center py-8">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-3xl font-bold text-red-600 mb-4">
          Admissions Closed
        </h2>
        <p className="text-lg text-gray-700 mb-6">
          {admissionInfo?.message || 'Applications not being accepted'}
        </p>
        <Button onClick={() => router.push('/')}>
          Return to Home
        </Button>
      </div>
    </Card>
  );
}
```

**3. Open State Banner:**
- Green banner at top of form
- Shows cycle name, seat availability, deadline
- Encourages timely submission

**4. Backend Validation:**
- Form submission triggers backend checks:
  - Is cycle open?
  - Is current date within application window?
  - Are seats available?
- Backend increments seat counter on successful submission
- Frontend displays appropriate error messages

**User Flow:**
```
User visits /apply →
Check admission status →
If closed: Show closed message →
If open: Show form with status banner →
User submits →
Backend validates cycle status →
Backend checks seat availability →
Backend increments seat counter →
Return success/error
```

---

## Features

### NEW: Admin Portal Features

**1. Admission Cycle Management**
- Create multiple admission cycles
- Set maximum seats per cycle
- Define application windows (start/end dates)
- Set result announcement dates
- Open/close cycles with one click
- Only one cycle can be active at a time
- Real-time seat tracking

**2. Seat Management**
- Automatic seat counting on application submission
- Visual seat availability display
- Prevents applications when seats full
- Real-time updates across admin portal

**3. Admin Authentication**
- JWT token-based authentication
- 24-hour token expiry (configurable)
- Secure password hashing (bcrypt)
- Session management via localStorage
- Auto-logout on token expiration

**4. Admission Window Enforcement**
- Application form checks cycle status
- Date range validation (start/end dates)
- Automatic closure when deadline passes
- User-friendly closed state messaging

**5. Public Transparency**
- Landing page shows admission status
- Real-time seat availability display
- Application deadlines prominently displayed
- Clear messaging when closed

---

## Features

### 1. Client-Side Form Validation

**Location:** Application form (`/apply`)

**Validation Rules:**
- Real-time validation on field blur
- Comprehensive error messages
- Visual error indicators
- Form-level submission check

**Implementation:**
```typescript
const validateForm = (): boolean => {
  const newErrors: Record<string, string> = {};

  // Name validation
  if (!formData.name.trim()) {
    newErrors.name = 'Name is required';
  }

  // GPA validation
  const gpa = parseFloat(formData.gpa);
  if (isNaN(gpa) || gpa < 0 || gpa > 4.0) {
    newErrors.gpa = 'GPA must be between 0.0 and 4.0';
  }

  // ... more validations

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

---

### 2. Real-Time Status Updates

**Location:** Status page (`/status`)

**Mechanism:**
- Polling-based status checks
- Manual refresh via button
- URL parameter support for deep linking

**Flow:**
```
User enters ID →
Fetch status →
Display current stage →
If completed, fetch results →
Display comprehensive breakdown
```

---

### 3. Cryptographic Verification

**Location:** Verification portal (`/verify`)

**Methods:**

1. **Individual Verification**
   - User provides Anonymized ID + Hash
   - Backend compares stored vs. expected
   - Visual pass/fail feedback

2. **Chain Verification**
   - Checks entire hash chain
   - Validates each link
   - Reports any invalid entries

**Security:**
- No private data exposed
- Public verification mechanism
- Tamper-evident design

---

### 4. Progress Visualization

**Locations:**
- Status page (application progress)
- Dashboard (pipeline visualization)
- Dashboard (score distribution)

**Components:**
- Progress bars with percentages
- Color-coded stages
- Emoji indicators
- Responsive design

---

### 5. Responsive Design

**Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Adaptations:**
- Navigation: Collapsible on mobile (ready for expansion)
- Grid layouts: Stack vertically on mobile
- Font sizes: Scale appropriately
- Touch targets: Minimum 44px

**Tailwind Classes:**
```tsx
// Responsive grid
className="grid md:grid-cols-2 gap-4"

// Responsive text
className="text-lg md:text-xl lg:text-2xl"

// Responsive padding
className="px-4 sm:px-6 lg:px-8"
```

---

### 6. Loading States

**Implementation:**
- Buttons show spinners when loading
- Pages show loading messages
- Suspense boundaries for async content
- Skeleton screens (ready for implementation)

**Example:**
```tsx
<Button isLoading={submitting}>
  {submitting ? 'Submitting...' : 'Submit'}
</Button>
```

---

### 7. Error Handling

**Levels:**

1. **Field-Level**
   - Red border on input
   - Error text below field
   - Icon indicator

2. **Form-Level**
   - Banner at top of form
   - Summary of errors
   - Scrolls to first error

3. **API-Level**
   - Error banners
   - Retry buttons
   - User-friendly messages

**Error Messages:**
- Clear, actionable
- No technical jargon
- Suggest solutions

---

### 8. Deep Linking

**Supported:**
- `/status?id=APP_12345678` - Auto-load status
- `/verify?id=ANON_123&hash=abc123...` - Auto-verify

**Implementation:**
```tsx
const searchParams = useSearchParams();
const urlId = searchParams.get('id');

useEffect(() => {
  if (urlId) {
    checkStatus(urlId);
  }
}, [urlId]);
```

---

## Styling

### Tailwind CSS Configuration

**Primary Colors:**
- Blue: `#2563eb` (primary brand)
- Green: `#059669` (success)
- Red: `#dc2626` (error)
- Gray: `#6b7280` (text/borders)

**Spacing Scale:**
- Base: 0.25rem (4px)
- Standard padding: 1.5rem (24px)
- Section spacing: 4rem (64px)

**Typography:**
- Sans-serif: Geist (variable font)
- Monospace: Geist Mono (for IDs/hashes)
- Base size: 16px
- Scale: 0.875rem → 1rem → 1.125rem → 1.25rem

**Shadows:**
- sm: Light shadow for cards
- md: Medium shadow for elevated elements
- lg: Heavy shadow for modals (future)

**Animations:**
- Transitions: 200ms ease
- Hover states: Scale, opacity, background
- Loading spinners: Continuous rotation

---

## Data Flow

### Application Submission Flow

```
User fills form →
Client validation →
POST /applications →
Backend: Create Application →
Backend: Queue for processing →
Response: { application_id, status: "submitted" } →
Frontend: Show success + ID →
Auto-redirect to /status?id={id}
```

**Background Processing:**
- Identity scrubbing
- Worker evaluation
- Judge review
- Final scoring
- Hash generation

### Status Checking Flow

```
User enters ID →
GET /applications/{id} →
Backend: Query applications.csv →
Response: { status, anonymized_id, message } →
Frontend: Display status indicator →

IF status === "completed" AND anonymized_id exists:
  GET /results/{anonymized_id} →
  Backend: Query final_scores.csv →
  Response: { scores, explanation, strengths, ... } →
  Frontend: Display comprehensive results
```

### Verification Flow

```
User enters ID + Hash →
POST /verify →
Backend: Query final_scores.csv →
Backend: Compare hashes →
Response: { is_valid, stored_hash, expected_hash } →
Frontend: Display pass/fail with visual feedback
```

### Dashboard Flow

```
Page load →
GET /dashboard/stats →
Backend: Aggregate all CSV data →
Backend: Calculate statistics →
Response: {
  total_applications,
  completed_evaluations,
  average_score,
  score_distribution,
  processing_stats
} →
Frontend: Render charts and metrics
```

---

## Security

### Client-Side Security

1. **Input Sanitization**
   - Pydantic validation on backend
   - Client-side validation for UX only
   - Never trust client input

2. **API Key Protection**
   - No API keys in frontend
   - All sensitive operations on backend
   - Environment variables for configuration

3. **XSS Prevention**
   - React automatic escaping
   - No `dangerouslySetInnerHTML` used
   - Sanitized user-generated content

4. **CSRF Protection**
   - SameSite cookies (when implemented)
   - CORS restricted to frontend domain
   - No sensitive GET endpoints

### API Communication

**CORS Configuration:**
```python
# backend/api.py
allow_origins=["http://localhost:3000", "http://localhost:3001"]
```

**Production:** Restrict to actual domain.

**HTTPS:**
- Required in production
- Certificate validation
- Secure cookie flags

---

## Testing Guide

### Manual Testing Checklist

#### Application Submission
- [ ] Submit valid application
- [ ] Verify all fields required
- [ ] Test GPA validation (0-4.0)
- [ ] Test SAT validation (400-1600)
- [ ] Test ACT validation (1-36)
- [ ] Test essay min/max length
- [ ] Test achievements min/max length
- [ ] Verify success screen shows
- [ ] Verify Application ID displayed
- [ ] Verify auto-redirect works

#### Status Checking
- [ ] Enter valid Application ID
- [ ] Verify status displays
- [ ] Wait for completion
- [ ] Verify results appear
- [ ] Check all score components present
- [ ] Verify explanation renders
- [ ] Check strengths list
- [ ] Check improvement areas
- [ ] Verify hash displays

#### Verification
- [ ] Enter valid ID + Hash
- [ ] Verify pass shows green
- [ ] Enter invalid hash
- [ ] Verify fail shows red
- [ ] Test chain verification
- [ ] Verify educational content displays

#### Dashboard
- [ ] Verify stats load
- [ ] Check all metrics present
- [ ] Verify progress bars render
- [ ] Check score distribution
- [ ] Test refresh button
- [ ] Verify empty states

#### Responsive Design
- [ ] Test on mobile (< 768px)
- [ ] Test on tablet (768-1024px)
- [ ] Test on desktop (> 1024px)
- [ ] Verify navigation works
- [ ] Check form usability on mobile
- [ ] Verify touch targets adequate

#### Accessibility
- [ ] Tab through all forms
- [ ] Test with screen reader
- [ ] Verify labels present
- [ ] Check contrast ratios
- [ ] Test keyboard-only navigation

### Automated Testing (Future)

**Unit Tests:**
```typescript
// Component tests with React Testing Library
describe('Button', () => {
  it('shows loading spinner when isLoading=true', () => {
    // ...
  });
});
```

**Integration Tests:**
```typescript
// API client tests
describe('apiClient', () => {
  it('submits application successfully', async () => {
    // ...
  });
});
```

**E2E Tests:**
```typescript
// Playwright/Cypress tests
test('submit application end-to-end', async ({ page }) => {
  await page.goto('/apply');
  // Fill form...
  // Submit...
  // Verify success...
});
```

---

## Future Enhancements

### Phase 2 Integration
- [ ] Live interview scheduling interface
- [ ] WebRTC integration for video calls
- [ ] Real-time bias monitoring display
- [ ] Evaluator dashboard
- [ ] Conflict of interest declaration form

### UX Improvements
- [ ] Application save/resume (local storage)
- [ ] File upload for essays (PDF/DOCX)
- [ ] Multi-language support (Urdu, Spanish, etc.)
- [ ] Dark mode toggle
- [ ] Accessibility enhancements (ARIA, focus management)

### Features
- [ ] Application preview before submit
- [ ] Email notifications (opt-in)
- [ ] Application edit capability (before processing)
- [ ] PDF export of results
- [ ] Compare scores feature (anonymized)
- [ ] Mobile app (React Native)

### Analytics
- [ ] Google Analytics integration
- [ ] User flow tracking
- [ ] Conversion funnel analysis
- [ ] A/B testing framework
- [ ] Performance monitoring (Sentry, LogRocket)

### Performance
- [ ] Image optimization (Next.js Image)
- [ ] Code splitting refinement
- [ ] Service worker for offline support
- [ ] Redis caching for dashboard
- [ ] GraphQL for complex queries

### Security
- [ ] Rate limiting on client
- [ ] CAPTCHA for form submission
- [ ] Two-factor authentication (for operators)
- [ ] Audit logging on frontend actions
- [ ] CSP headers configuration

### Developer Experience
- [ ] Storybook for component library
- [ ] Unit test suite (Jest + RTL)
- [ ] E2E test suite (Playwright)
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Pre-commit hooks (Husky + lint-staged)

---

## Development Workflow

### Getting Started

1. **Clone Repository**
   ```bash
   git clone <repo-url>
   cd ENIGMA/frontend
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API URL
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Open Browser**
   ```
   http://localhost:3000
   ```

### Commands

```bash
# Development
npm run dev          # Start dev server with hot reload

# Building
npm run build        # Production build
npm run start        # Start production server

# Linting
npm run lint         # Run ESLint
```

### Code Style

- **Formatting**: Prettier (future)
- **Linting**: ESLint with Next.js config
- **TypeScript**: Strict mode enabled
- **Naming**: camelCase for variables, PascalCase for components

### Git Workflow

1. Create feature branch
2. Make changes
3. Test thoroughly
4. Commit with descriptive message
5. Push and create PR
6. Code review
7. Merge to main

---

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod
```

**Environment Variables:**
- Set `NEXT_PUBLIC_API_URL` in Vercel dashboard
- Point to production backend URL

### Netlify

```bash
# Build command
npm run build

# Publish directory
.next
```

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Variables (Production)

```env
# Production API URL
NEXT_PUBLIC_API_URL=https://api.enigma.edu

# Analytics (optional)
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

---

## Performance Metrics

### Target Metrics

- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Cumulative Layout Shift**: < 0.1
- **Lighthouse Score**: > 90

### Optimization Techniques

1. **Code Splitting**: Automatic with Next.js
2. **Image Optimization**: Next.js Image component
3. **Font Optimization**: Variable fonts (Geist)
4. **CSS Optimization**: Tailwind purge
5. **JavaScript Minification**: Next.js default

---

## Troubleshooting

### Common Issues

**Issue: API Connection Failed**
```
Error: Failed to fetch
```
**Solution:**
1. Verify backend is running on port 8000
2. Check `.env.local` has correct `NEXT_PUBLIC_API_URL`
3. Verify CORS settings in backend `api.py`

**Issue: Hydration Error**
```
Error: Text content does not match server-rendered HTML
```
**Solution:**
1. Ensure no browser extensions interfere
2. Check for date/time rendering mismatches
3. Use `suppressHydrationWarning` if necessary

**Issue: Module Not Found**
```
Error: Cannot find module '@/components/Button'
```
**Solution:**
1. Verify `tsconfig.json` has path mappings
2. Restart TypeScript server
3. Run `npm install` again

---

## API Integration Reference

### Endpoint Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/applications` | Submit new application |
| GET | `/applications/{id}` | Get application status |
| GET | `/results/{anonymized_id}` | Get evaluation results |
| POST | `/verify` | Verify individual hash |
| GET | `/verify/chain` | Verify entire chain |
| GET | `/dashboard/stats` | Get aggregate statistics |
| GET | `/health` | Health check |

### Request/Response Examples

**Submit Application:**
```typescript
// Request
POST /applications
{
  "name": "John Doe",
  "email": "john@example.com",
  "gpa": 3.8,
  "test_scores": { "SAT": 1450 },
  "essay": "...",
  "achievements": "..."
}

// Response
{
  "success": true,
  "application_id": "APP_12345678",
  "message": "Application submitted successfully",
  "status": "submitted",
  "timestamp": "2025-10-11T12:00:00Z"
}
```

**Get Results:**
```typescript
// Request
GET /results/ANON_1234567890_ABC123

// Response
{
  "anonymized_id": "ANON_1234567890_ABC123",
  "final_score": 87.5,
  "academic_score": 90.0,
  "test_score": 85.0,
  "achievement_score": 88.0,
  "essay_score": 87.0,
  "explanation": "...",
  "strengths": ["...", "..."],
  "areas_for_improvement": ["...", "..."],
  "hash": "abc123...",
  "timestamp": "2025-10-11T12:30:00Z",
  "worker_attempts": 1
}
```

---

## Contributing

### Guidelines

1. **Code Quality**
   - Write TypeScript, not JavaScript
   - Use functional components
   - Follow React Hooks best practices
   - Add PropTypes or TypeScript interfaces

2. **Component Structure**
   - One component per file
   - Co-locate styles (Tailwind)
   - Extract reusable logic to hooks

3. **Testing**
   - Write tests for new features
   - Maintain > 80% coverage
   - Test accessibility

4. **Documentation**
   - Update this file for major changes
   - Add JSDoc comments for complex logic
   - Include usage examples

### Pull Request Process

1. Branch from `main`
2. Make changes
3. Test thoroughly
4. Update documentation
5. Create PR with description
6. Request review
7. Address feedback
8. Merge when approved

---

## Support & Resources

### Documentation
- Next.js: https://nextjs.org/docs
- React: https://react.dev
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript: https://www.typescriptlang.org/docs

### Internal Documentation
- Backend API: `http://localhost:8000/docs` (FastAPI auto-docs)
- Setup Guide: `../SETUP.md`
- Architecture: `../backend/ARCHITECTURE.md`
- System Plan: `../PLAN.md`

### Contact
- **Project Lead**: [Your Name]
- **Repository**: [GitHub URL]
- **Issues**: [GitHub Issues URL]

---

## Changelog

### v1.1.0 (2025-10-12) - Admin Portal Release

**Added:**
- Complete admin portal with authentication
- Admin login page (`/admin/login`)
- Admin dashboard page (`/admin/dashboard`)
- Admission cycles management page (`/admin/cycles`)
- Admin API client (`src/lib/adminApi.ts`)
- Admin authentication hook (`src/hooks/useAdminAuth.ts`)
- JWT token-based authentication system
- Protected routes with auto-redirect
- Admission cycle CRUD operations
- Seat management and tracking
- Real-time admission status enforcement

**Updated:**
- Landing page: Added admission status banner
- Application form: Added admission status checks and enforcement
- Public pages now display real-time admission cycle information
- Backend integration with admin endpoints

**Security:**
- Bearer token authentication for admin operations
- JWT token storage in localStorage
- Protected admin routes
- Session expiration handling (24-hour tokens)

**Features:**
- Create and manage multiple admission cycles
- Open/close admissions with one click
- Set maximum seats and track availability
- Define application windows (start/end dates)
- Prevent applications when cycles closed or seats full
- Public visibility of admission status
- Admin logout functionality

---

### v1.0.0 (2025-10-11) - Initial Release

**Added:**
- Complete frontend implementation
- 5 pages (Landing, Apply, Status, Verify, Dashboard)
- 5 reusable UI components
- API client with full TypeScript support
- Responsive design for all screen sizes
- Comprehensive form validation
- Real-time status tracking
- Cryptographic verification portal
- Public transparency dashboard

**Security:**
- CORS configuration
- Input validation
- XSS prevention
- Secure API communication

**Documentation:**
- This implementation guide
- Setup instructions
- API integration reference
- Testing guide

---

## License

Proprietary - ENIGMA Project
Copyright © 2025 ENIGMA Team. All rights reserved.

---

**Last Updated:** 2025-10-12
**Version:** 1.1.0
**Status:** Production Ready (Phase 1 + Admin Portal) ✅
