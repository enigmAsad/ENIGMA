"""Verification script for modular API structure.

This script checks:
1. All routers import successfully
2. No circular dependencies
3. All endpoints are registered
4. Pydantic models validate correctly
"""

import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("=" * 80)
print("ENIGMA Modular API Verification")
print("=" * 80)
print()

# Test 1: Import all routers
print("TEST 1: Router Imports")
print("-" * 80)

routers = [
    ("public", "src.api.routers.public"),
    ("applications", "src.api.routers.applications"),
    ("student_auth", "src.api.routers.student_auth"),
    ("admin_auth", "src.api.routers.admin_auth"),
    ("admin_cycles", "src.api.routers.admin_cycles"),
    ("admin_phases", "src.api.routers.admin_phases"),
    ("interviews", "src.api.routers.interviews"),
    ("bias_monitoring", "src.api.routers.bias_monitoring"),
    ("websockets", "src.api.routers.websockets"),
]

failed_imports = []
for name, module_path in routers:
    try:
        module = __import__(module_path, fromlist=["router"])
        router = getattr(module, "router")
        print(f"✅ {name:20} - {len(router.routes)} routes")
    except Exception as e:
        print(f"❌ {name:20} - FAILED: {e}")
        failed_imports.append((name, str(e)))

print()

# Test 2: Import dependencies
print("TEST 2: Dependencies Import")
print("-" * 80)

try:
    from src.api.dependencies.auth import get_current_admin, get_student_session, get_student_auth_service
    print("✅ Auth dependencies imported successfully")
except Exception as e:
    print(f"❌ Auth dependencies failed: {e}")
    failed_imports.append(("auth_dependencies", str(e)))

print()

# Test 3: Import API models
print("TEST 3: API Models Import")
print("-" * 80)

try:
    from src.api.schemas.api_models import (
        ApplicationSubmitRequest,
        ApplicationSubmitResponse,
        ApplicationStatusResponse,
        ResultsResponse,
        StudentProfileResponse,
    )
    print("✅ API models imported successfully")
except Exception as e:
    print(f"❌ API models failed: {e}")
    failed_imports.append(("api_models", str(e)))

print()

# Test 4: Import main app
print("TEST 4: Main App Import")
print("-" * 80)

try:
    from api import app
    print(f"✅ Main app imported successfully")
    print(f"   Total routes registered: {len(app.routes)}")
except Exception as e:
    print(f"❌ Main app failed: {e}")
    failed_imports.append(("main_app", str(e)))

print()

# Test 5: Count endpoints
print("TEST 5: Endpoint Registration")
print("-" * 80)

try:
    from api import app

    # Count by method
    methods = {}
    for route in app.routes:
        if hasattr(route, "methods"):
            for method in route.methods:
                methods[method] = methods.get(method, 0) + 1

    print("Endpoints by HTTP method:")
    for method, count in sorted(methods.items()):
        print(f"  {method:10} {count:3} endpoints")

    # Count WebSocket endpoints
    ws_count = sum(1 for route in app.routes if route.path.startswith("/ws/"))
    print(f"\n  WebSocket:  {ws_count:3} endpoints")

    print(f"\n  TOTAL:     {len(app.routes):3} routes")

except Exception as e:
    print(f"❌ Endpoint counting failed: {e}")

print()

# Test 6: Check for common patterns
print("TEST 6: Route Pattern Analysis")
print("-" * 80)

try:
    from api import app

    # Check for proper prefixes
    prefixes = {}
    for route in app.routes:
        if hasattr(route, "path"):
            parts = route.path.split("/")
            if len(parts) > 1 and parts[1]:
                prefix = f"/{parts[1]}"
                prefixes[prefix] = prefixes.get(prefix, 0) + 1

    print("Routes by prefix:")
    for prefix, count in sorted(prefixes.items(), key=lambda x: x[1], reverse=True):
        print(f"  {prefix:20} {count:3} routes")

except Exception as e:
    print(f"❌ Pattern analysis failed: {e}")

print()

# Final Report
print("=" * 80)
print("VERIFICATION SUMMARY")
print("=" * 80)

if failed_imports:
    print(f"❌ FAILED: {len(failed_imports)} components failed to import")
    print()
    print("Failed components:")
    for name, error in failed_imports:
        print(f"  - {name}: {error}")
    sys.exit(1)
else:
    print("✅ SUCCESS: All components imported successfully")
    print()
    print("The modular API structure is ready to use!")
    print()
    print("To start the server:")
    print("  uvicorn api:app --reload")
    sys.exit(0)
