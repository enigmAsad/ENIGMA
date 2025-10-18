### **Guiding Principles**

*   **Simplicity:** We will add this feature alongside the existing 9-phase workflow rather than inserting new, complex phases. This minimizes risk and implementation time.
*   **Performance:** For the virtual interview, we will use WebRTC for a direct peer-to-peer connection. The backend will only act as a lightweight "signaling" server to set up the call, not to process any video or audio data.
*   **Modularity:** The plan is broken into distinct backend and frontend stages, each of which can be built and tested independently.
*   **Data-Driven:** The implementation starts with the data model, ensuring a solid foundation before building services and UI.

---

### **Post-Completion Fixes & Enhancements (2025-10-19)**

Following the initial implementation, a series of fixes and quality-of-life improvements were made to enhance the stability and usability of the interview feature.

1.  **Corrected "Join Interview" Button Logic:** Fixed a persistent bug on the admin interviews page where the "Join Interview" button was incorrectly disabled. The logic was simplified to match the student dashboard, now depending only on the interview's status (`scheduled`) and whether the current time is within the 48-hour access window. The confusing and incorrect dependency on the cycle's phase was removed.

2.  **Streamlined Interview Scheduling:** The manual "Meeting Link" input field was removed from the admin scheduling form. The backend now automatically generates a unique, internal link for the WebRTC interview room (e.g., `/interview/{id}`) upon creation, removing a redundant step for the admin.

3.  **Added Interview Deletion Feature:** Admins can now delete scheduled interviews. This involved adding a new `DELETE` endpoint to the backend API and a corresponding "Delete" button with a confirmation dialog on the frontend.

4.  **Expanded Admin Interview View:** The admin interviews page was updated to display a comprehensive list of all interviews from cycles in the `selection`, `published`, and `completed` phases. Previously, it only showed interviews from the single cycle currently in `selection`.

5.  **Improved Admin Navigation:** A "Manage Interviews" link was added to the "Quick Actions" section of the admin dashboard for easier access.

---

### **Summary of Working Features (As of 2025-10-18)**

After a series of fixes and enhancements, the interview feature is now fully functional and robust. Key working features include:

1.  **Internal WebRTC Room:** Both students and admins correctly join an internal, self-hosted interview room, replacing the previous, flawed implementation that relied on external links.
2.  **Stable Connections:** The WebRTC logic has been hardened to prevent common race conditions and errors, ensuring that two-way video and audio are established reliably.
3.  **Time-Based Access Control:** The "Join Interview" button is now intelligently enabled and disabled based on a clear rule: interviews can only be joined within a 48-hour window (24 hours before and 24 hours after the scheduled time).
4.  **Clear User Feedback:**
    *   When an interview is outside the joinable time window, a message now appears explaining the rule to the user.
    *   Validation errors on the scheduling form (e.g., invalid meeting link) are now properly displayed next to the input field.
5.  **Intuitive Call Controls:**
    *   The "Start Call" button is disabled after being clicked to prevent errors.
    *   A new "End Call" button allows users to gracefully terminate the connection.
6.  **Smart Redirects:** After ending a call, users are automatically redirected to their respective dashboards (the student dashboard for students, and the interviews page for admins).

---

### **The Plan**

#### **Phase 1: Backend Foundation (Database & Models)** (Completed)

1.  **Create the `interviews` Table:** (Completed)
    *   Defined a new SQLAlchemy model in `src/database/models.py`.
    *   **Columns:** `id`, `application_id`, `student_id`, `admin_id`, `admission_cycle_id`, `interview_time`, `interview_link`, `status`, and `notes`.
2.  **Generate Database Migration:** (Completed)
    *   Used `alembic` to create and apply the migration script.
3.  **Define API Schemas:** (Completed)
    *   Created Pydantic schemas in `src/models/schemas.py` for API validation.

*   **Result:** The database schema is successfully updated with the `interviews` table.

#### **Phase 2: Backend Logic (API Endpoints & Services)** (Completed)

1.  **Create `InterviewRepository`:** (Completed)
    *   Implemented `src/database/repositories/interview_repository.py` for all database operations.
2.  **Implement API Endpoints:** (Completed)
    *   Added endpoints to `api.py` for scheduling, viewing, and updating interviews for both admin and student roles.
3.  **Add Authorization:** (Completed)
    *   Secured endpoints to ensure admins manage interviews and students can only view their own.

*   **Result:** The backend API is fully functional and secure.

#### **Phase 3: Backend - WebSocket Signaling Server** (Completed)

1.  **Create WebSocket Endpoint:** (Completed)
    *   Implemented a WebSocket endpoint in `api.py` at `/ws/interview/{interview_id}`.
2.  **Add WebSocket Dependency:** (Completed)
    *   Added the `websockets` library to `pyproject.toml` and installed it to enable `uvicorn` to handle WebSocket connections.
3.  **Implement Signaling Logic:** (Completed)
    *   The server correctly manages interview "rooms" and relays WebRTC signaling messages (offers, answers, candidates) between participants.

*   **Result:** The signaling server runs correctly, enabling peer-to-peer connections.

#### **Phase 4: Frontend - Admin Scheduling UI** (Completed & Hardened)

1.  **Update Admin API Client:** (Completed)
    *   Added interview-related functions to `src/lib/adminApi.ts`.
2.  **Create Interview Management Page:** (Completed)
    *   Built the admin page at `src/app/admin/interviews/page.tsx`.
3.  **Build Scheduling & Joining Component:** (Completed & Fixed)
    *   **Fixed:** The "Join Interview" button now correctly routes the admin to the internal `/interview/{interview_id}` page.
    *   **Added:** The button is now disabled outside of a 48-hour window around the scheduled time (24 hours before/after).
    *   **Added:** A message now informs the admin about the valid join window if the button is disabled.
    *   **Added:** The scheduling form now displays specific validation errors from the backend.

*   **Result:** Admins can successfully schedule interviews and join the internal video call at the appropriate time.

#### **Phase 5: Frontend - Student Viewing UI** (Completed & Hardened)

1.  **Update Student API Client:** (Completed)
    *   Added the function to fetch a student's interview schedule to `src/lib/studentApi.ts`.
2.  **Enhance Student Dashboard:** (Completed & Fixed)
    *   **Fixed:** The dashboard now correctly displays a "Join Interview" button that routes to the internal `/interview/{interview_id}` page.
    *   **Added:** The button is now disabled outside of the 48-hour valid joining window.
    *   **Added:** A message now informs the student about the valid join window.

*   **Result:** A student with a scheduled interview will see the "Join Interview" button on their dashboard and can join the call at the appropriate time.

#### **Phase 6: Frontend - The Virtual Interview Room** (Completed & Hardened)

1.  **Create Interview Page:** (Completed)
    *   Created the page at `/app/interview/[interviewId]/page.tsx`.
2.  **Integrate Webcam and Mic:** (Completed)
    *   Integrated `react-webcam` to capture user's video and audio.
3.  **Implement Robust WebRTC Logic:** (Completed & Fixed)
    *   **Fixed:** Refactored the component to use React `refs` for connection objects, resolving an infinite re-render loop ("Maximum update depth exceeded").
    *   **Fixed:** Solved a critical race condition where the remote video would not appear. The logic now ensures a participant's media stream is active before processing a connection offer.
4.  **Build UI & Call Controls:** (Completed & Enhanced)
    *   **Fixed:** The "Start Call" button is now correctly disabled after being clicked once, preventing connection errors.
    *   **Added:** A new "End Call" button allows users to gracefully exit the interview.
    *   **Enhanced:** The "End Call" button now intelligently redirects admins and students back to their respective dashboards.

*   **Result:** The admin and student can both join the interview room and have a stable, two-way, real-time video and audio conversation.

#### **Phase 7: Finalization & Documentation** (Completed)

1.  **Update Markdown Files:** (Completed)
    *   This document (`PLAN-Interview-v2.md`) has been updated to reflect all fixes, features, and the current working state of the interview implementation.