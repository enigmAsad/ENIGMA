### **Guiding Principles**

*   **Simplicity:** We will add this feature alongside the existing 9-phase workflow rather than inserting new, complex phases. This minimizes risk and implementation time.
*   **Modularity:** The plan is broken into distinct backend and frontend stages, each of which can be built and tested independently.
*   **Data-Driven:** The implementation starts with the data model, ensuring a solid foundation before building services and UI.

---

### **The Plan**

#### **Phase 1: Backend Foundation (Database & Models)**

1.  **Create the `interviews` Table:**
    *   I will define a new SQLAlchemy model in `src/database/models.py`.
    *   **Columns:** `id`, `application_id` (link to applicant), `student_id` (link to student account), `admin_id` (link to interviewer), `admission_cycle_id`, `interview_time`, `interview_link` (for the meeting URL), `status` (e.g., `SCHEDULED`, `COMPLETED`), and `notes`.
2.  **Generate Database Migration:**
    *   I will use `alembic` to create a new migration script that adds the `interviews` table to your PostgreSQL database.
3.  **Define API Schemas:**
    *   I will create Pydantic schemas in `src/models/schemas.py` for handling API requests and responses related to interviews (e.g., `InterviewCreate`, `InterviewDetails`).

*   **Testing Milestone:** At the end of this phase, the database schema will be updated. We can verify the new `interviews` table exists and has the correct structure.

#### **Phase 2: Backend Logic (API Endpoints & Services)**

1.  **Create `InterviewRepository`:**
    *   I will implement a new repository at `src/database/repositories/interview_repository.py` to handle all database operations for interviews (create, read, update).
2.  **Implement API Endpoints:**
    *   I will add new endpoints to `api.py`:
        *   **Admin:**
            *   `POST /admin/interviews/schedule`: To schedule a new interview. The logic will enforce that only applicants with a `SELECTED` status are eligible.
            *   `GET /admin/interviews/cycle/{cycle_id}`: To list all scheduled interviews for an admission cycle.
            *   `PUT /admin/interviews/{interview_id}`: To update an interview (e.g., add notes or change status).
        *   **Student:**
            *   `GET /student/interviews/me`: To allow an authenticated student to retrieve their upcoming interview schedule.
3.  **Add Authorization:**
    *   I will secure the endpoints, ensuring only admins can schedule/manage interviews and students can only view their own.

*   **Testing Milestone:** The backend API will be fully functional. We can use the auto-generated API documentation to test scheduling an interview for a "SELECTED" applicant and retrieving the schedule for both admin and student roles.

#### **Phase 3: Frontend - Admin Scheduling UI**

1.  **Update Admin API Client:**
    *   I will add the new interview-related functions to `src/lib/adminApi.ts`.
2.  **Create Interview Management Page:**
    *   I will build a new admin page at `src/app/admin/interviews/page.tsx`.
    *   This page will fetch and display a list of all applicants with a `SELECTED` status for the active admission cycle.
3.  **Build Scheduling Component:**
    *   For each selected applicant, I will add a "Schedule Interview" feature. This will be a simple form where the admin can input a date/time and a meeting link.
    *   The page will also display a list of already scheduled interviews for the cycle.

*   **Testing Milestone:** Admins will be able to log in, see a list of eligible candidates, and schedule interviews through a functional UI.

#### **Phase 4: Frontend - Student Viewing UI**

1.  **Update Student API Client:**
    *   I will add the function to fetch a student's interview schedule to `src/lib/studentApi.ts`.
2.  **Enhance Student Dashboard:**
    *   I will update the student dashboard at `src/app/student/dashboard/page.tsx`.
    *   It will now fetch and display a card with the details of any scheduled interviews (date, time, meeting link, and interviewer name).
3.  **Update Status Page:**
    *   I will also add this information to the `status` page, so a student sees their interview details immediately after checking their application status.

*   **Testing Milestone:** A student who has been selected and has an interview scheduled will be able to log in and see the details on their dashboard and status pages.

#### **Phase 5: Documentation**

1.  **Update Markdown Files:**
    *   I will update `BACKEND.md` and `FRONTEND.md` to document the new `interviews` table, API endpoints, and UI components.
