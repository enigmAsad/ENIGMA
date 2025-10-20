# ENIGMA Frontend Implementation (Phase 1 + Admin Portal + Student Accounts + Phase 2 Bias Monitoring)

**Implementation Date:** 2025-10-11 (Phase 1), 2025-10-12 (Admin Portal & Bug Fixes), 2025-10-13 (Internal LLM Integration & Results Display), 2025-10-14 (Student Accounts & OAuth), 2025-10-19 (Phase 2 Bias Monitoring - Complete)
**Framework:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
**Status:** ✅ Phase 1 + Admin Portal + Student Accounts + **Phase 2 Bias Monitoring (Complete)**

---

## 1. Overview

The ENIGMA frontend provides a complete UI for a blind AI evaluation system. It enables applicants to submit applications, track progress, view results, and verify integrity. It also includes a full-featured admin portal for managing admission cycles.

**Key Technologies:**
- **Next.js 15**: App Router with Server Components
- **React 19**: Latest with Suspense boundaries
- **TypeScript**: Full type safety
- **Tailwind CSS 4**: Utility-first styling
- **REST API**: Integration with FastAPI backend

---

## 2. Architecture

### Directory Structure
```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with Navigation & auth context
│   │   ├── page.tsx            # Landing page
│   │   ├── apply/page.tsx      # Application form (requires student session)
│   │   ├── status/page.tsx     # Status checker & results (student-aware)
│   │   ├── verify/page.tsx     # Hash verification
│   │   ├── dashboard/page.tsx  # Public fairness dashboard
│   │   ├── auth/google/        # Student OAuth callback route
│   │   │   └── callback/page.tsx
│   │   ├── student/            # ⭐ Student portal
│   │   │   ├── login/page.tsx
│   │   │   └── dashboard/page.tsx
│   │   ├── admin/              # ⭐ Admin portal
│   │   │   ├── login/page.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── cycles/page.tsx
│   │   │   ├── interviews/page.tsx
│   │   │   └── bias/page.tsx         # ⭐ NEW: Phase 2 bias dashboard
│   │   └── interview/          # ⭐ Interview room
│   │       └── [interviewId]/page.tsx  # WebRTC + bias monitoring
│   ├── components/             # Reusable UI components
│   │   ├── NudgeOverlay.tsx    # ⭐ NEW: Phase 2 real-time nudges
│   │   └── ... (Button, Card, Input, etc.)
│   ├── hooks/                  # ⭐ Custom React hooks
│   │   ├── useAdminAuth.ts
│   │   ├── useStudentAuth.ts
│   │   └── useInterviewAudio.ts      # ⭐ NEW: Phase 2 audio streaming
│   └── lib/                    # API clients
│       ├── api.ts              # Public API
│       ├── adminApi.ts         # Admin API (includes bias endpoints)
│       └── studentApi.ts       # Student API
├── public/
├── .env.local.example
└── ... (config files)
```

### Design Principles
- **Component Reusability**: Shared components for consistency.
- **Type Safety**: TypeScript interfaces for all data structures.
- **Progressive Enhancement**: Works without JavaScript (SSR).
- **Responsive & Accessible**: Mobile-first, semantic HTML, ARIA.
- **Performance**: Code splitting, lazy loading, optimized images.

---

## 3. API Clients

### Public API Client (`src/lib/api.ts`)
Handles all public-facing backend communication.
- **Singleton Pattern**: Exported as `apiClient`.
- **Type-Safe**: Full TypeScript interfaces for requests/responses.
- **Error Handling**: Structured error parsing.
- **Configuration**: Uses `NEXT_PUBLIC_API_URL` from `.env.local`.

**Core Methods & Interfaces:**
```typescript
// Interfaces
- ApplicationSubmitRequest / Response
- ApplicationStatusResponse
- ResultsResponse (includes status: SELECTED/NOT_SELECTED/PUBLISHED)
- VerifyRequest / Response
- DashboardStatsResponse

// API Methods
- submitApplication(data)
- getApplicationStatus(id)
- getResults(anonymizedId)
- verifyHash(data) / verifyChain()
- getDashboardStats()
```

### Admin API Client (`src/lib/adminApi.ts`)
Type-safe API client for admin operations with automatic JWT injection.
- **Token Management**: Handles JWT in `localStorage` (`login`, `logout`, `isAuthenticated`).

**Core Methods:**
```typescript
// Authentication
- login(username, password)
- logout()
- getCurrentAdmin()

// Cycle Management
- getAllCycles()
- createCycle(data)
- openCycle(id) / closeCycle(id)
- getActiveCycle()

// Phase 2: Bias Monitoring (NEW)
- getBiasFlags(filters)
- resolveBiasFlag(flagId, resolution)
- getAdminBiasHistory(adminId)
- getBiasMetrics(cycleId)

// Public Admission Info (No Auth)
- getAdmissionInfo()
```
**Key Interfaces**: `AdmissionCycle`, `CreateCycleRequest`, `AdmissionInfo`.

### Student API Client (`src/lib/studentApi.ts`)
Manages the Google OAuth flow, student session lifecycle, and authenticated submission state.
- **Session Handling**: Exchanges OAuth codes for sessions, stores HttpOnly cookies (server-managed).
- **Profile Access**: Fetches current student profile (`getMe`) for dashboard and status pages.
- **Utilities**: Provides `studentApiClient` singleton used across hooks/components.

**Core Methods:**
```typescript
- startGoogleLogin()
- completeGoogleLogin(code, state, code_verifier, redirect_uri)
- getMe()
- logout()
```
**Key Interfaces**: `Student`, `StudentSessionResponse`.

---

## 4. UI Components (`src/components/`)

A library of reusable, styled, and accessible components.

### 1. Button (`Button.tsx`)
**Props:**
- `variant`: `'primary' | 'secondary' | 'outline' | 'danger'`
- `size`: `'sm' | 'md' | 'lg'`
- `isLoading`: `boolean` (shows spinner)

### 2. Card (`Card.tsx`)
**Props:**
- `title?`: `string`
- `subtitle?`: `string`
- `className?`: `string`
- `children`: `React.ReactNode`

### 3. Input (`Input.tsx`)
**Props:**
- `label`: `string`
- `error?`: `string`
- `helperText?`: `string`
- `required?`: `boolean`

### 4. TextArea (`TextArea.tsx`)
**Props:**
- `label`: `string`
- `characterCount?`: `boolean`
- `maxLength?`: `number`

### 5. Navigation (`Navigation.tsx`)
Top navigation bar with active route highlighting.
- **Adaptive Links**: Home, Apply, Check Status, Verify, Dashboard remain always visible.
- **Student Session Awareness**: Displays authenticated student name/email, adds quick link to Student Dashboard, and exposes Logout action.
- **Login Shortcut**: Renders a primary "Student Login" button that triggers the Google OAuth flow when no session exists.

### 6. NudgeOverlay (`NudgeOverlay.tsx`) - **Phase 2**
Real-time bias alert overlay for admin evaluators during live interviews.

**Props:**
- `interviewId`: `number` - The interview ID
- `adminId`: `string` - The admin conducting the interview
- `onBlock?`: `() => void` - Callback when interview is blocked

**Features:**
- Automatic WebSocket URL derivation from `NEXT_PUBLIC_API_URL` (HTTP→WS conversion)
- Graceful degradation with yellow warning banner if connection fails
- Green "Bias monitoring active" indicator when connected
- Displays three types of nudges with distinct UI:
  - **INFO**: Blue gradient banner at bottom, auto-dismiss after 5s
  - **WARNING**: Yellow/orange banner at top, requires acknowledgment, adds strike
  - **BLOCK**: Red full-screen modal, interview terminated, creates flag
- Sends acknowledgments back to server via WebSocket
- Handles multiple concurrent nudges with priority queuing
- Enhanced error logging with connection state and close event codes

**UI States:**
```typescript
- info: "bg-gradient-to-r from-primary-500 to-primary-600"
- warning: "bg-gradient-to-r from-yellow-400 to-orange-500"
- block: "bg-gradient-to-r from-red-600 to-red-700"
```

### 7. Modal (`Modal.tsx`) - **v1.5.0 NEW**
Beautiful custom modal component replacing JavaScript alerts/confirms.

**Props:**
- `isOpen`: `boolean` - Controls modal visibility
- `onClose`: `() => void` - Close callback
- `title`: `string` - Modal title
- `message`: `string` - Modal message (supports newlines with `\n`)
- `type`: `'success' | 'error' | 'info' | 'warning'` - Modal style
- `confirmText?`: `string` - Confirm button text (default: "OK")
- `showCancel?`: `boolean` - Show cancel button for confirmations
- `onConfirm?`: `() => void` - Confirm callback

**Features:**
- 4 themed variants with gradient headers and custom icons
- Smooth fade-in + scale animation
- Backdrop blur effect
- ESC key to close
- Body scroll lock when open
- Click outside to close (unless confirmation mode)
- Multiline message support

**Type Styles:**
```typescript
- success: Green gradient with CheckCircle2 icon
- error: Red gradient with XCircle icon
- info: Blue gradient with Info icon
- warning: Yellow/orange gradient with AlertTriangle icon
```

### 8. PipelineProgressModal (`PipelineProgressModal.tsx`) - **v1.5.0 NEW**
Real-time progress tracker for automated admin workflow pipeline.

**Props:**
- `isOpen`: `boolean` - Controls modal visibility
- `steps`: `PipelineStep[]` - Array of pipeline steps
- `onClose?`: `() => void` - Close callback
- `canClose?`: `boolean` - Allow closing (disabled during processing)

**PipelineStep Interface:**
```typescript
{
  key: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  errorMessage?: string;
}
```

**Features:**
- Live progress bar with percentage tracking
- 4-step automated workflow visualization
- Color-coded step states:
  - Pending: Gray with Circle icon
  - Running: Blue with spinning Loader icon + pulsing dots
  - Completed: Green with CheckCircle icon
  - Error: Red with XCircle icon + error message
- Animated grid pattern background
- Step-by-step numbered badges
- Cannot close during processing (locked modal)
- Success/error footer button after completion

**UI Elements:**
- Gradient header: Purple→Indigo→Blue
- Progress bar: Blue (processing), Green (complete), Red (error)
- Step cards: Expand/highlight for active step
- Responsive layout with mobile support

### 9. PhaseProgress (`PhaseProgress.tsx`)
Visual progress tracker for admission cycle phases.

**Props:**
- `currentPhase`: `string` - Current backend phase (lowercase with underscores)
- `className?`: `string` - Additional CSS classes

**Features:**
- 9-phase workflow with emoji icons (v1.5.0 updated):
  - 📝 Submission - Applications Open
  - 🔒 Frozen - Data Locked
  - 🧹 Preprocessing - Scrubbing PII + Metrics
  - 📦 Batch Prep - Export Ready
  - 🤖 Processing - Phase 1 LLM Evaluation
  - 🎥 **Interviews** - Phase 2 Interviews (2k shortlisted) ← Updated in v1.5.0
  - 🎯 Selection - Final Selection (k selected)
  - 📤 Published - Results Live
  - ✅ Completed - Cycle Closed
- Live progress bar with percentage
- Color-coded phases: Completed (green), Active (blue), Pending (gray)
- "Current" badge for active phase
- Smooth transitions

---

## 5. Pages (`src/app/`)

### 1. Landing Page (`/page.tsx`)
Marketing and educational page about the ENIGMA system.
- **Admission Status Banner**: Displays if admissions are open/closed with seat availability, fetched from `GET /admission/info`.
- **Hero Section**: Mission statement and CTAs. "Apply Now" button is disabled if admissions are closed.
- **How It Works**: Explains the evaluation phases (Phase 1, Phase 2, Cryptographic Audit).
- **Trust Signals**: Highlights Blind Evaluation, Transparency, and Cryptographic Proof.
- **Student CTA**: Provides direct link to the student login/dashboard when authenticated.

### 2. Application Form (`/apply/page.tsx`)
Secure interface for applicant submissions.
- **Admission Enforcement**: The page first checks if admissions are open. If closed, it displays a message; otherwise, it renders the form.
- **Form Sections**: Personal Information, Academic Information, Essay, Achievements.
- **Authentication**: Requires an active student session; unauthenticated users are redirected to the student login flow.
- **Validation**: Comprehensive client-side validation for all required fields (name, GPA, test scores, essay/achievements length). Email is derived from the authenticated student profile.
- **UX**: On success, displays an Application ID and auto-redirects to the status page.

### 3. Status & Results Viewer (`/status/page.tsx`)
Check application status and view detailed results. Supports deep linking via `?id=` query parameter.
- **Status Checker**: Input for Application ID with visual progress indicators for each stage (Submitted, Scrubbing, Evaluation, etc.).
- **Selection Result Banners**: When results are published, displays prominent decision banners:
  - **SELECTED**: Large green gradient banner with celebration emoji and congratulatory message
  - **NOT_SELECTED**: Respectful gray gradient banner with encouragement to review feedback
- **Results Display**: When completed, shows:
  - **Score Overview**: Large final score (0-100).
  - **Score Breakdown**: Progress bars for Academic, Test, Achievements, and Essay scores.
  - **AI Explanation**: Full text from the evaluation.
  - **Strengths & Improvements**: Bulleted lists.
  - **Cryptographic Hash**: SHA-256 hash for verification.
- **Student Context**: When accessed with an authenticated student, preloads their latest application and provides shortcuts to dashboard actions.

### 4. Verification Portal (`/verify/page.tsx`)
Verify the cryptographic integrity of decisions. Supports deep linking with `?id=` and `?hash=`.
- **Individual Hash Verification**: Compares a user-provided hash against the stored hash for an anonymized ID. Shows a clear ✅ Valid or ⚠️ Invalid result.
- **Chain Verification**: Button to trigger a backend check of the entire decision hash chain.
- **Educational Content**: Explains hashing and its importance for transparency.

### 5. Public Dashboard (`/dashboard/page.tsx`)
Displays aggregate, anonymized fairness and transparency metrics from `GET /dashboard/stats`.
- **Overview Stats**: Cards for Total Applications, Completed Evaluations, and Average Score.
- **Processing Pipeline**: Progress bars showing the percentage of applications in each stage.
- **Score Distribution**: Bar chart of score ranges (e.g., 90-100, 80-89).
- **Fairness Guarantees**: Cards highlighting Blind Evaluation, Two-Tier AI, Cryptographic Audit, and Transparency.

### 6. Student Login (`/student/login/page.tsx`)
Entry point for the Google OAuth login flow.
- **Flow**: Initiates PKCE-secured OAuth login, redirects to Google, then back to `/auth/google/callback`.
- **UX**: Provides status messaging during redirects and handles error states (invalid state, missing code).

### 7. Student Dashboard (`/student/dashboard/page.tsx`)
Authenticated student portal showing submission status and shortcuts.
- **Profile Summary**: Displays student name, email, and ENIGMA student ID.
- **Application Overview**: Highlights latest submission status with quick link to `/status`.
- **Session Management**: Offers logout and refresh controls wired to `useStudentAuth`.

### 8. OAuth Callback (`/auth/google/callback/page.tsx`)
Handles the Google OAuth redirect, exchanges authorization code for a student session, and redirects to the student dashboard.
- **Security**: Validates PKCE verifier/state pair before completing login.
- **Error Handling**: Renders clear messaging for expired codes or tampered state.
- **Side Effects**: Updates the global student auth context and refreshes navigation state.

---

## 6. Student Accounts (`src/app/auth` & `src/app/student/`)

### useStudentAuth Hook (`/hooks/useStudentAuth.tsx`)
- **Context Provider**: Wraps the app to expose student session data across routes.
- **Session Recovery**: Automatically calls `studentApiClient.getMe()` on mount to restore sessions.
- **Actions**: Supplies `login`, `logout`, `setStudent`, and `refreshStudent` helpers.

### Application Form Integration (`/apply/page.tsx`)
- **Guarded Access**: Redirects unauthenticated users to `/student/login` before rendering the form.
- **Profile Binding**: Automatically injects authenticated student name/email into submission payloads.

### Status Page Enhancements (`/status/page.tsx`)
- **Student Prefill**: When logged in, displays the student’s latest submission without requiring manual ID entry.
- **Dashboard Shortcut**: Provides quick navigation back to `/student/dashboard`.

### Navigation Updates (`src/components/Navigation.tsx`)
- Adds a `Student Login`/`Student Dashboard` link that adapts based on session state.
- Highlights the authenticated student’s name in the header.

### Student Portal (`/student/dashboard/page.tsx`)
- **Overview Cards**: Shows application status, last updated timestamp, and cycle details.
- **Actions**: Buttons to start a new application (when allowed) or view detailed results.

### OAuth Callback (`/auth/google/callback/page.tsx`)
- Handles PKCE verifier validation, exchanges auth code for a session, and updates the auth context before redirecting to `/student/dashboard`.

## 7. Admin Portal (`src/app/admin/`)

A secure, token-protected area for managing the admissions process.

### 1. Admin Login (`/login/page.tsx`)
Secure authentication form for administrators.
- **Flow**: User enters credentials → `POST /admin/auth/login` → Backend returns JWT → Token stored in `localStorage` → Redirect to `/admin/dashboard`.

### 2. Admin Authentication Hook (`/hooks/useAdminAuth.ts`)
A reusable hook to protect admin pages.
- **Functionality**:
  - Checks for a valid JWT in `localStorage` on component mount.
  - If token is invalid, redirects to `/admin/login`.
  - Fetches current admin user details if authenticated.
  - Provides `isAuthenticated`, `isLoading`, `admin`, and `logout` properties.

### 3. Admin Dashboard (`/dashboard/page.tsx`)
Overview of the current admission cycle and system status.
- **Active Cycle Card**: Shows current cycle name, open/closed status, and seat occupancy (e.g., "150 / 500 seats filled").
- **Statistics**: Cards for Total Applications, Completed Evaluations, Average Score.
- **Quick Actions**: Links to manage cycles and other admin areas.

### 4. Admission Cycles Management (`/cycles/page.tsx`)
Full CRUD interface for managing admission cycles.
- **Create New Cycle**: A form to define a new cycle with a name, max seats, and start/end/result dates.
- **List All Cycles**: A table displaying all past and present cycles with their status, seat occupancy, and key dates.
- **LLM Evaluation Trigger**: Admins can launch or re-run the backend LLM evaluation directly from the UI once a cycle reaches Phase 4 (Batch Prep).
- **Open/Close Cycles**: One-click toggle buttons to open or close a cycle. The backend ensures only one cycle can be open at a time.

### Key Admin Features
- **Admission Cycle Management**: Create distinct admission periods with specific start/end dates and seat limits.
- **Seat Management**: Automatically track filled seats. The public application form is disabled when a cycle is closed or full.
- **Admin Authentication**: Secure, JWT-based authentication for all admin routes.
- **Public Transparency**: The public-facing site automatically reflects the current admission status (open/closed, seats available).

---

## 7. Styling & Data Flow

### Styling
- **Framework**: Tailwind CSS (utility-first).
- **Colors**: Blue (`#2563eb`) primary, green for success, red for error.
- **Typography**: Geist Sans and Geist Mono.
- **Responsive**: Mobile-first breakpoints (`sm`, `md`, `lg`).

### Data Flow
1.  **Application**: `User` → `Apply Form` → `POST /applications` → `Backend`
2.  **Status Check**: `User` → `Status Page` → `GET /applications/{id}` → `Backend`
3.  **Results**: `User` → `Status Page` → `GET /results/{anonymized_id}` → `Backend`
4.  **Admin Cycles**: `Admin` → `Cycles Page` → `GET/POST/PUT /admin/cycles` → `Backend`

---

## 8. Development & Deployment

### Development Workflow
1.  `git clone <repo-url> && cd ENIGMA/frontend`
2.  `npm install`
3.  `cp .env.local.example .env.local` (and edit `NEXT_PUBLIC_API_URL`)
4.  `npm run dev` (starts on `http://localhost:3000`)

**Commands**: `npm run dev`, `npm run build`, `npm run start`, `npm run lint`.
**Style**: ESLint (Next.js config), Strict TypeScript, PascalCase for components.
**Git**: Standard feature-branch workflow with Pull Requests.

### Deployment
- **Recommended**: Vercel. Set `NEXT_PUBLIC_API_URL` in the Vercel dashboard.
- **Alternatives**: Netlify, Docker.

---

## 9. Future Enhancements

- **Phase 2 Integration**: Live interview scheduling, evaluator dashboard.
- **UX Improvements**: Dark mode, multi-language support, save/resume application.
- **Features**: PDF export of results, email notifications.
- **Developer Experience**: Storybook, Jest/RTL unit tests, Playwright E2E tests.

---

### v1.5.0 (2025-10-20) - Automated Pipeline + Interview Integration + Enhanced UX

**MAJOR RELEASE: Streamlined Admin Workflow with Automated Processing Pipeline**

#### **🚀 Automated Pipeline System**
- **Added**: `PipelineProgressModal` component - Beautiful real-time progress tracker with step-by-step visualization
  - Live progress bar with percentage tracking
  - 4-step automated workflow: Preprocessing → Export → LLM Evaluation → Shortlisting (2k students)
  - Color-coded step states (pending/running/completed/error)
  - Pulsing indicators for active steps
  - Graceful error handling with specific step failure identification
  - Success summary with key metrics (applications processed, shortlisted count, cutoff score)
- **Updated**: Admin Cycles workflow simplified from 6+ manual buttons to **3-button system**:
  1. **🔒 Freeze Cycle** - Locks submissions and prepares for processing
  2. **⚡ Start Phase 1 Pipeline** - Automated 4-step pipeline (stops at interview shortlisting)
  3. **🎯 Perform Final Selection** - Selects final k students after Phase 2 interviews complete
  4. **📤 Publish Results** - Makes results visible to selected applicants
  5. **✅ Complete Cycle** - Archives the cycle
- **Improved**: Pipeline stops at shortlisting phase to allow Phase 2 interviews (2k candidates → k final selections)
- **Added**: Clear next-steps messaging after pipeline completion directing admins to interview management

#### **💬 Custom Modal System**
- **Added**: `Modal.tsx` - Beautiful themed modal component replacing JavaScript alerts
  - 4 modal types: success (green), error (red), info (blue), warning (yellow/orange)
  - Gradient headers with icons
  - Smooth animations (fade-in + scale)
  - Backdrop blur effect
  - ESC key support
  - Confirmation mode with cancel button
  - Body scroll lock when open
- **Replaced**: All `alert()` and `confirm()` dialogs with custom modals throughout admin cycles page
  - Export success notifications
  - Shortlisting completion
  - Final selection confirmation
  - Cycle freeze/open/close/publish/complete confirmations
  - Delete cycle confirmation with detailed warning
  - Error messages with helpful troubleshooting text

#### **🎥 Interview Integration & Phase Tracking**
- **Updated**: `PhaseProgress.tsx` component now correctly shows interview phase
  - 9-phase workflow visualization with emoji icons
  - "Scored" phase renamed to "Interviews" with description "Phase 2 Interviews (2k shortlisted)"
  - "Selection" phase shows "Final Selection (k selected)"
  - Visual indication that interviews happen DURING the scored phase
  - Updated descriptions to reflect Phase 1 (LLM) vs Phase 2 (Interviews) distinction
- **Fixed**: Workflow now correctly separates:
  - Phase 1 Pipeline: Automated LLM evaluation → Shortlist 2k candidates
  - **[Manual Phase 2]**: Admins schedule and conduct bias-monitored interviews
  - Final Selection: Selects k students from interview pool based on combined scores

#### **🔧 WebSocket Error Handling (NudgeOverlay)**
- **Improved**: Automatic WebSocket URL derivation from `NEXT_PUBLIC_API_URL` (HTTP→WS, HTTPS→WSS)
- **Added**: Graceful degradation when bias monitoring WebSocket fails:
  - Yellow warning banner: "Bias Monitoring Unavailable"
  - Clear explanation that interview can proceed
  - Dismissible error message
  - Green "Bias monitoring active" indicator when connected
- **Enhanced**: Detailed error logging with connection state, URL, and close event codes
- **Fixed**: Try-catch around WebSocket creation to prevent crashes
- **Improved**: Distinguishes clean vs unexpected disconnections

#### **📊 UI/UX Enhancements**
- **Updated**: Admin cycle action buttons now full-width with distinct color coding:
  - Pipeline button: Purple→Indigo→Blue gradient with pulsing Zap icon
  - Final Selection button: Green→Emerald→Teal gradient with Target icon
  - Primary actions: Blue gradient
  - Secondary actions: Gray
- **Added**: Hover scale effect and enhanced shadows on all action buttons
- **Improved**: Action button descriptions provide context and guidance
- **Updated**: Button labels include emoji icons for visual clarity

#### **🎯 Workflow Clarity**
- **Documentation**: Added inline comments explaining correct 10-step workflow:
  ```
  1. Freeze Cycle (submission → frozen)
  2. Start Pipeline (frozen → scored) - Automated, stops at shortlisting
  3. [Manual: Schedule & Complete Interviews for 2k shortlisted students]
  4. Perform Final Selection (scored → selection) - Selects k students
  5. Publish Results (selection → published)
  6. Complete Cycle (published → completed)
  ```
- **Updated**: Success modals now include clear next-step instructions
- **Enhanced**: Phase descriptions explicitly mention "2k shortlisted" and "k selected"

#### **Technical Details**
- **Location**: `src/components/Modal.tsx`, `src/components/PipelineProgressModal.tsx`, `src/components/PhaseProgress.tsx`, `src/components/NudgeOverlay.tsx`, `src/app/admin/cycles/page.tsx`
- **Dependencies**: No new dependencies added - uses existing Tailwind CSS and Lucide icons
- **Breaking Changes**: None - all updates are backward compatible
- **Performance**: Pipeline runs sequentially with `async/await`, refreshes cycle data after each step

---

### v1.4.0 (2025-10-19) - Two-Step Selection Workflow UI
- **Updated**: The Admin Cycles page (`/admin/cycles`) now supports the new two-step selection process.
- **Updated**: In the `scored` phase, the action button is now **"Perform Shortlisting"** to trigger the initial selection for interviews.
- **Added**: In the `selection` phase, a new **"Perform Final Selection"** button is now available to trigger the final choice based on interview scores.
- **Updated**: The `adminApi.ts` client was updated with a new `performFinalSelection` method to communicate with the new backend endpoint.

### v1.3.0 (2025-10-14) - Student Accounts & Authenticated Submissions
- **Added**: Google OAuth student login flow with PKCE, HttpOnly session cookies, and context-aware navigation.
- **Added**: `studentApi.ts`, `useStudentAuth.tsx`, dedicated student login/dashboard pages, and OAuth callback handler.
- **Updated**: Application form now requires authenticated student sessions and auto-binds student profile data.
- **Enhanced**: Status page preloads latest student application when authenticated and links back to the dashboard.
- **Documentation**: This file updated to reflect student-facing architecture and workflow changes.

## 10. Changelog

### v1.2.1 (2025-10-13) - Selection Status Display & Results Fix
- **Added**: `status` field to `ResultsResponse` interface in `api.ts` to receive selection decision from backend (SELECTED/NOT_SELECTED/PUBLISHED).
- **Added**: Prominent selection result banners in `status/page.tsx` that display before evaluation results:
  - **SELECTED**: Green gradient banner with celebration emoji and congratulatory message
  - **NOT_SELECTED**: Gray gradient banner with respectful messaging and encouragement
- **Fixed**: Results fetching logic now checks for `['published', 'selected', 'not_selected']` statuses instead of non-existent `'completed'` status, enabling results to display correctly after publication.
- **Impact**: Applicants now immediately see their selection decision (accepted/rejected) along with detailed evaluation feedback.
- **Location**: `src/lib/api.ts:36`, `src/app/status/page.tsx:41-49,212-242`

### v1.1.1 (2025-10-12) - Bug Fixes & UX Improvements
- **Fixed**: React NaN warning in admission cycle creation form. Changed `max_seats` initial value from `0` to `1` to prevent invalid number states.
- **Improved**: Enhanced input handler for seats field with fallback value (`parseInt(e.target.value) || 1`) to prevent NaN errors during user input.
- **UX**: Form now maintains valid state at all times, eliminating console warnings and improving user experience.
- **Automation**: Added inline LLM processing controls to `src/app/admin/cycles/page.tsx` and `src/app/admin/dashboard/page.tsx` so admins can trigger evaluations without leaving the app.
- **Location**: `src/app/admin/cycles/page.tsx:19,152,273`, `src/app/admin/dashboard/page.tsx`

### v1.1.0 (2025-10-12) - Admin Portal
- **Added**: Complete admin portal with login, dashboard, and admission cycle management.
- **Added**: `adminApi.ts` client and `useAdminAuth.ts` hook for protected routes.
- **Updated**: Landing and Apply pages now display real-time admission status (open/closed, seat availability) based on the active cycle.
- **Automation**: Admin cycles page now exposes a "Run LLM Evaluation" action that drives the new backend batch processing pipeline.
- **Security**: Implemented JWT Bearer token authentication for all admin operations.

### v1.0.0 (2025-10-11) - Initial Release
- **Added**: Core public-facing application with 5 pages: Landing, Apply, Status, Verify, Dashboard.
- **Added**: Reusable UI component library and a type-safe public API client.
- **Features**: Responsive design, form validation, status tracking, cryptographic verification, and a public transparency dashboard.

---
**Last Updated:** 2025-10-20
**Version:** 1.5.0
**Status:** Production Ready (Phase 1 + Admin Portal + Student Accounts + Automated Pipeline + Interview Integration) ✅
