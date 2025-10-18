### **Guiding Principles**

*   **Simplicity:** We will add this feature alongside the existing 9-phase workflow rather than inserting new, complex phases. This minimizes risk and implementation time.
*   **Performance:** For the virtual interview, we will use WebRTC for a direct peer-to-peer connection. The backend will only act as a lightweight "signaling" server to set up the call, not to process any video or audio data.
*   **Modularity:** The plan is broken into distinct backend and frontend stages, each of which can be built and tested independently.
*   **Data-Driven:** The implementation starts with the data model, ensuring a solid foundation before building services and UI.

---

### **The Plan**

#### **Phase 1: Backend Foundation (Database & Models)** (Completed)

1.  **Create the `interviews` Table:** (Completed)
    *   I will define a new SQLAlchemy model in `src/database/models.py`.
    *   **Columns:** `id`, `application_id` (link to applicant), `student_id` (link to student account), `admin_id` (link to interviewer), `admission_cycle_id`, `interview_time`, `interview_link` (for the meeting URL), `status` (e.g., `SCHEDULED`, `COMPLETED`), and `notes`.
2.  **Generate Database Migration:** (Completed)
    *   I will use `alembic` to create a new migration script that adds the `interviews` table to your PostgreSQL database.
3.  **Define API Schemas:** (Completed)
    *   I will create Pydantic schemas in `src/models/schemas.py` for handling API requests and responses related to interviews (e.g., `InterviewCreate`, `InterviewDetails`).

*   **Testing Milestone:** At the end of this phase, the database schema will be updated. We can verify the new `interviews` table exists and has the correct structure.

#### **Phase 2: Backend Logic (API Endpoints & Services)** (Completed)

1.  **Create `InterviewRepository`:** (Completed)
    *   I will implement a new repository at `src/database/repositories/interview_repository.py` to handle all database operations for interviews (create, read, update).
2.  **Implement API Endpoints:** (Completed)
    *   I will add new endpoints to `api.py`:
        *   **Admin:**
            *   `POST /admin/interviews/schedule`: To schedule a new interview. The logic will enforce that only applicants with a `SELECTED` status are eligible.
            *   `GET /admin/interviews/cycle/{cycle_id}`: To list all scheduled interviews for an admission cycle.
            *   `PUT /admin/interviews/{interview_id}`: To update an interview (e.g., add notes or change status).
        *   **Student:**
            *   `GET /student/interviews/me`: To allow an authenticated student to retrieve their upcoming interview schedule.
3.  **Add Authorization:** (Completed)
    *   I will secure the endpoints, ensuring only admins can schedule/manage interviews and students can only view their own.

*   **Testing Milestone:** The backend API will be fully functional. We can use the auto-generated API documentation to test scheduling an interview for a "SELECTED" applicant and retrieving the schedule for both admin and student roles.

#### **NEW - Phase 3: Backend - WebSocket Signaling Server** (Completed)

1.  **Create WebSocket Endpoint:** (Completed)
    *   I will implement a new WebSocket endpoint in `api.py` at `/ws/interview/{interview_id}`.
2.  **Implement Signaling Logic:** (Completed)
    *   This server will manage connections for each interview "room." Its only job is to pass signaling messages (WebRTC offers, answers, and ICE candidates) between the two participants (admin and student) to help them establish a direct peer-to-peer connection.

*   **Testing Milestone:** The WebSocket server will be running. We can test it by connecting with a simple client and ensuring messages are broadcast correctly between two participants in the same room.

#### **Phase 4: Frontend - Admin Scheduling UI** (Completed)

1.  **Update Admin API Client:** (Completed)
    *   I will add the new interview-related functions to `src/lib/adminApi.ts`.
2.  **Create Interview Management Page:** (Completed)
    *   I will build a new admin page at `src/app/admin/interviews/page.tsx`.
    *   This page will fetch and display a list of all applicants with a `SELECTED` status for the active admission cycle.
3.  **Build Scheduling & Joining Component:** (Completed)
    *   For each selected applicant, I will add a "Schedule Interview" feature. This will be a simple form where the admin can input a date/time and a meeting link.
    *   The page will also display a list of already scheduled interviews for the cycle.
    *   **Change:** Next to each scheduled interview, there will now be a **"Join Interview"** button that links to the virtual interview room (e.g., `/interview/{interview_id}`).

*   **Testing Milestone:** Admins will be able to schedule interviews. The "Join Interview" button will correctly navigate to the (not-yet-built) interview room page.

#### **Phase 5: Frontend - Student Viewing UI** (Completed)

1.  **Update Student API Client:** (Completed)
    *   I will add the function to fetch a student's interview schedule to `src/lib/studentApi.ts`.
2.  **Enhance Student Dashboard:** (Completed)
    *   I will update the student dashboard at `src/app/student/dashboard/page.tsx`.
    *   **Change:** It will now fetch and display a card with interview details and a **"Join Interview"** button.
3.  **Update Status Page:** (Completed)
    *   I will also add this information to the `status` page, so a student sees their interview details immediately after checking their application status.

*   **Testing Milestone:** A student with a scheduled interview will see the "Join Interview" button on their dashboard.

#### **NEW - Phase 6: Frontend - The Virtual Interview Room** (Completed)

1.  **Create Interview Page:** (Completed)
    *   I will create a new page at `/app/interview/[interviewId]/page.tsx`. This page will be accessible to both the student and the admin scheduled for that specific interview.
2.  **Integrate Webcam and Mic:** (Completed)
    *   Using the `react-webcam` library, I will capture the user's video and audio streams.
3.  **Implement WebRTC Logic:** (Completed)
    *   I will write the client-side logic to connect to our WebSocket signaling server.
    *   This logic will create a peer-to-peer `RTCPeerConnection`, handle the exchange of offers/answers, and establish the video/audio stream with the other participant.
4.  **Build Simple UI:** (Completed)
    *   The UI will be minimal: a large video feed for the remote person, a small preview for the local user, and buttons for mute/unmute and camera on/off.

*   **Testing Milestone:** The admin and student can both join the interview room and have a real-time video and audio conversation.

#### **Phase 7: Documentation**

1.  **Update Markdown Files:**
    *   I will update `BACKEND.md` and `FRONTEND.md` to document the new `interviews` table, API endpoints, WebSocket server, and the new interview room components.
