## Changes Summary (Session on 2025-10-21)

### Bug Fixes

1.  **Fixed Critical API Error on Admin Interviews Page**
    -   **Issue:** The `/admin/interviews` page was crashing with a `TypeError: Failed to fetch` when trying to load shortlisted applicants.
    -   **Root Cause:** A server-side serialization error occurred because the backend API was trying to build a response containing nested interview details without a proper data schema.
    -   **Solution:**
        1.  Updated the `ApplicationDetails` Pydantic model in `backend/src/api/schemas/api_models.py` to use the specific `InterviewDetails` schema for the `interview` field, ensuring correct data structuring.
        2.  Proactively added a `joinedload` to the SQLAlchemy query in `backend/src/database/repositories/application_repository.py` to prevent lazy-loading issues.

2.  **Corrected Audio Streaming Logic in Interview Room**
    -   **Issue:** The audio streaming for transcription was being incorrectly initiated for all users (students and admins), even though it was only configured to connect to the backend for admins.
    -   **Root Cause:** The call to `startCapture()` was not conditional.
    -   **Solution:** Wrapped the `audioStreaming.startCapture(localStream)` call inside an `if (isAdmin)` block in `frontend/src/app/interview/[interviewId]/page.tsx` to ensure it only runs for admin users.

### New Features

1.  **Added Frontend Logging for Audio Streaming**
    -   **Enhancement:** To provide visibility into the real-time transcription process, console logging was added.
    -   **Implementation:** Added a `console.log()` statement to the `useInterviewAudio.ts` hook, which now outputs the speaker (`admin`) and the size of each audio chunk being sent to the backend for transcription.
