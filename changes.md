# Changes Summary

This document summarizes the changes made to the ENIGMA application during this session.

## v2.4.3 (Interview & Configuration Fixes)

### Backend

#### `backend/api.py`

-   **Fix**: Resolved a `NameError` in the `schedule_interview` endpoint by importing `AdmissionPhaseEnum`.
-   **Reason**: The endpoint was unable to validate the cycle phase because the required enum was not available in the file's scope.

#### `backend/src/services/stt_service.py` & `backend/src/services/bias_monitoring_workflow.py`

-   **Fix**: Corrected an `ImportError` by changing how the settings object is imported. The code now correctly imports and calls the `get_settings()` function.
-   **Fix**: Resolved an `AttributeError` by correcting the case-sensitive names for `openai_api_key` and `stt_chunk_duration_seconds` to match the lowercase names defined in the settings model.
-   **Reason**: These errors were causing crashes when initializing services that depend on configuration values, such as starting a virtual interview.

### Frontend

#### `frontend/src/app/admin/interviews/page.tsx`

-   **Fix**: Updated the interview scheduling page to look for an admission cycle in the `SELECTION` phase instead of the `SCORED` phase.
-   **Reason**: This aligns the frontend with the corrected backend workflow, ensuring that the UI for scheduling interviews appears at the correct stage of the admission process.

---

## v2.4.2 (Admission Workflow Fix)

### Backend

#### `backend/src/services/phase_manager.py`

-   **Fix**: Corrected the two-step selection workflow logic to align with the documented process.
    -   The `perform_selection` (shortlisting) function now correctly transitions the cycle's phase from `SCORED` to `SELECTION`.
    -   The `perform_final_selection` function was fixed to execute only when the cycle is in the `SELECTION` phase and now uses the correct database query to identify top candidates based on interview scores.
    -   Added a validation guard to the `publish_results` function to prevent publishing before the final selection has been run.
-   **Reason**: The previous implementation had a critical bug that stalled the admission workflow after the shortlisting step, preventing admins from completing the cycle. These changes restore the intended workflow and add robustness.

### Frontend

#### `frontend/src/app/admin/cycles/page.tsx`

-   **Fix**: Clarified the user interface for admin actions during the selection process.
-   **Reason**: The UI previously showed confusing and out-of-sequence actions. It has been updated to guide the administrator through the now-corrected workflow, showing only the next logical action for each step of the selection and publishing process.

---

## Previous Changes

## Backend

### `backend/alembic/versions/20251019_1241_0c5810f251cb_add_shortlisted_status.py`

-   **Change**: Modified the Alembic migration to add the `SHORTLISTED` status to the `applicationstatusenum` enum in uppercase.
-   **Reason**: To fix a database error caused by a case-sensitivity mismatch between the application code and the database schema.

### `backend/src/services/phase_manager.py`

-   **Change 1**: In the `perform_selection` method, the line that moves the cycle phase to `SELECTION` was commented out.
-   **Reason 1**: To keep the cycle in the `SCORED` phase after shortlisting, allowing interviews to be scheduled in this phase as per the new workflow.

-   **Change 2**: In the `perform_final_selection` method, the required phase check was changed from `SELECTION` to `SCORED`.
-   **Reason 2**: To allow final selection to be performed after interviews are completed, while the cycle is still in the `SCORED` phase.

-   **Change 3**: In the `perform_final_selection` method, a line was added to transition the cycle to the `SELECTION` phase after the final selection is complete.
-   **Reason 3**: To ensure the cycle progresses to the next logical phase after final selection.

### `backend/api.py`

-   **Change**: The `schedule_interview` endpoint was modified to require the admission cycle to be in the `SCORED` phase for an interview to be scheduled.
-   **Reason**: To align with the new workflow where interviews are scheduled after shortlisting, which now occurs in the `SCORED` phase.

## Frontend

### `frontend/src/app/admin/cycles/page.tsx`

-   **Change 1**: Added a descriptive text below the "Perform Shortlisting" button to clarify that it selects the top `2 * max_seats` applicants for interviews.
-   **Reason 1**: To improve the user interface by making the behavior of the shortlisting feature clear to the admin user.

-   **Change 2**: Corrected a case-sensitive comparison for `cycle.phase`. Changed `cycle.phase === 'COMPLETED'` to `cycle.phase === 'completed'`.
-   **Reason 2**: To fix a TypeScript error caused by comparing the lowercase `cycle.phase` property with an uppercase string literal.

### `frontend/src/app/admin/interviews/page.tsx`

-   **Change 1**: Modified the page to look for an active cycle in the `scored` phase for scheduling interviews, instead of the `selection` phase.
-   **Reason 1**: To align the frontend with the new workflow where interview scheduling is enabled in the `SCORED` phase.

-   **Change 2**: Changed the applicant fetching logic to retrieve applicants with the `shortlisted` status instead of `selected`.
-   **Reason 2**: To ensure that the correct list of candidates (those who have been shortlisted) is displayed for interview scheduling.

-   **Change 3**: Updated UI text to reflect that interview scheduling is now done in the `scored` phase.
-   **Reason 3**: To provide accurate information to the user in the UI.
