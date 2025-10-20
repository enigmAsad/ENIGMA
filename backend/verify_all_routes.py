"""Comprehensive route verification script.

Compares current modular API routes with the expected routes from original api.py.
"""

from api import app

print("=" * 80)
print("COMPLETE ROUTE VERIFICATION")
print("=" * 80)
print()

# Expected routes from original api.py
EXPECTED_ROUTES = {
    # Public endpoints (no auth)
    ("GET", "/"): "Root",
    ("GET", "/health"): "Health check",
    ("GET", "/admission/info"): "Admission info",
    ("GET", "/admission/status"): "Admission status",
    ("GET", "/dashboard/stats"): "Dashboard stats",

    # Application endpoints
    ("POST", "/applications"): "Submit application",
    ("GET", "/applications/{application_id}"): "Get application status",
    ("GET", "/results/{anonymized_id}"): "Get results",
    ("POST", "/verify"): "Verify hash",
    ("GET", "/verify/chain"): "Verify chain",

    # Student auth endpoints
    ("POST", "/auth/student/google/start"): "Start Google OAuth",
    ("POST", "/auth/student/google/callback"): "Google OAuth callback",
    ("GET", "/auth/student/me"): "Get student profile",
    ("POST", "/auth/student/logout"): "Student logout",
    ("GET", "/auth/student/applications"): "Get student applications",

    # Student endpoints (non-auth)
    ("GET", "/student/interviews/me"): "Get student interviews",

    # Admin auth endpoints
    ("POST", "/admin/auth/login"): "Admin login",
    ("POST", "/admin/auth/logout"): "Admin logout",
    ("GET", "/admin/auth/me"): "Get admin profile",

    # Admin cycles endpoints
    ("GET", "/admin/cycles"): "Get all cycles",
    ("POST", "/admin/cycles"): "Create cycle",
    ("GET", "/admin/cycles/{cycle_id}"): "Get cycle",
    ("PUT", "/admin/cycles/{cycle_id}"): "Update cycle",
    ("DELETE", "/admin/cycles/{cycle_id}"): "Delete cycle",
    ("PUT", "/admin/cycles/{cycle_id}/open"): "Open cycle",
    ("PUT", "/admin/cycles/{cycle_id}/close"): "Close cycle",
    ("GET", "/admin/cycles/active/current"): "Get active cycle",
    ("GET", "/admin/cycles/{cycle_id}/status"): "Get cycle status",
    ("GET", "/admin/cycles/{cycle_id}/applications"): "Get cycle applications",

    # Admin phase management endpoints
    ("POST", "/admin/cycles/{cycle_id}/freeze"): "Freeze cycle",
    ("POST", "/admin/cycles/{cycle_id}/preprocess"): "Preprocess cycle",
    ("POST", "/admin/cycles/{cycle_id}/export"): "Export batch data",
    ("POST", "/admin/cycles/{cycle_id}/processing"): "Start LLM processing",
    ("POST", "/admin/batch/{batch_id}/import"): "Import LLM results",
    ("POST", "/admin/cycles/{cycle_id}/select"): "Perform selection",
    ("POST", "/admin/cycles/{cycle_id}/final-select"): "Perform final selection",
    ("POST", "/admin/cycles/{cycle_id}/publish"): "Publish results",
    ("POST", "/admin/cycles/{cycle_id}/complete"): "Complete cycle",
    ("GET", "/admin/batch/{batch_id}/status"): "Get batch status",

    # Interview management endpoints
    ("POST", "/admin/interviews/schedule"): "Schedule interview",
    ("GET", "/admin/interviews/cycle/{cycle_id}"): "Get interviews for cycle",
    ("PUT", "/admin/interviews/{interview_id}"): "Update interview",
    ("DELETE", "/admin/interviews/{interview_id}"): "Delete interview",
    ("POST", "/admin/interviews/{interview_id}/scores"): "Add interview score",

    # Bias monitoring endpoints
    ("GET", "/admin/bias/flags"): "Get bias flags",
    ("PUT", "/admin/bias/flags/{flag_id}/resolve"): "Resolve bias flag",
    ("GET", "/admin/bias/history/{admin_id}"): "Get admin bias history",
    ("GET", "/admin/bias/metrics"): "Get bias metrics",

    # WebSocket endpoints
    ("WEBSOCKET", "/ws/interview/{interview_id}/audio"): "Audio streaming",
    ("WEBSOCKET", "/ws/interview/{interview_id}/nudges"): "Nudge delivery",
    ("WEBSOCKET", "/ws/interview/{interview_id}"): "WebRTC signaling",
}

# Get actual routes from app
actual_routes = {}
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        for method in route.methods:
            if method in ['GET', 'POST', 'PUT', 'DELETE']:
                actual_routes[(method, route.path)] = route.name

# Add WebSocket routes
websocket_routes = [r for r in app.routes if r.path.startswith('/ws/')]
for route in websocket_routes:
    actual_routes[("WEBSOCKET", route.path)] = route.name

# Compare
print("VERIFICATION RESULTS:")
print("-" * 80)
print()

missing_routes = []
extra_routes = []

# Check for missing routes
for expected_key, description in EXPECTED_ROUTES.items():
    if expected_key not in actual_routes:
        missing_routes.append((expected_key, description))

# Check for extra routes (excluding OpenAPI routes)
for actual_key in actual_routes:
    if actual_key not in EXPECTED_ROUTES:
        method, path = actual_key
        # Skip OpenAPI/docs routes
        if not any(skip in path for skip in ['/openapi', '/docs', '/redoc']):
            extra_routes.append(actual_key)

# Report missing routes
if missing_routes:
    print("❌ MISSING ROUTES:")
    print("-" * 80)
    for (method, path), description in missing_routes:
        print(f"  {method:10} {path:50} # {description}")
    print()
else:
    print("✅ NO MISSING ROUTES - All expected routes are present!")
    print()

# Report extra routes
if extra_routes:
    print("⚠️  EXTRA ROUTES (not in original):")
    print("-" * 80)
    for method, path in extra_routes:
        print(f"  {method:10} {path}")
    print()

# Summary
print("=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Expected routes: {len(EXPECTED_ROUTES)}")
print(f"Actual routes: {len([k for k in actual_routes if not any(skip in k[1] for skip in ['/openapi', '/docs', '/redoc'])])}")
print(f"Missing: {len(missing_routes)}")
print(f"Extra: {len(extra_routes)}")
print()

if len(missing_routes) == 0 and len(extra_routes) == 0:
    print("✅ SUCCESS: All routes match perfectly!")
    exit(0)
else:
    print("❌ ISSUES FOUND: Please review the differences above")
    exit(1)
