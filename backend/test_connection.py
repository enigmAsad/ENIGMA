#!/usr/bin/env python3
"""Test database connection directly."""

import psycopg2

# Test the DATABASE_URL from .env
DATABASE_URL = "postgresql://postgres.xruyqeynikwainatqqog:enigmAsad@aws-1-us-east-1.pooler.supabase.com:6543/postgres"

try:
    print(f"Attempting to connect to: {DATABASE_URL[:50]}...")
    conn = psycopg2.connect(DATABASE_URL)
    print("✅ Direct psycopg2 connection successful!")

    # Test a simple query
    with conn.cursor() as cursor:
        cursor.execute("SELECT 1")
        result = cursor.fetchone()
        print(f"✅ Query executed successfully: {result}")

    conn.close()
    print("✅ Connection closed successfully")

except Exception as e:
    print(f"❌ Direct connection failed: {e}")
    print(f"Error type: {type(e).__name__}")

    # Try with different connection parameters
    try:
        print("\nTrying with connection parameters...")
        conn = psycopg2.connect(
            host="aws-1-us-east-1.pooler.supabase.com",
            port=6543,
            database="postgres",
            user="postgres.xruyqeynikwainatqqog",
            password="enigmAsad",
            connect_timeout=10
        )
        print("✅ Connection with explicit parameters successful!")
        conn.close()
    except Exception as e2:
        print(f"❌ Connection with explicit parameters also failed: {e2}")
