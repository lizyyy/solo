#!/usr/bin/env python3
"""
Script to create sample SQLite databases for testing.
"""

import sqlite3
import os
from pathlib import Path


def create_seed_db():
    """Create a properly structured sample SQLite database."""
    db_path = Path(__file__).parent / "seed" / "config.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    sample_configs = [
        ("app.version", "1.0.0", "Application version"),
        ("app.build_number", "1234", "Build number"),
        ("feature.dark_mode", "true", "Enable dark mode feature"),
        ("feature.notifications", "true", "Enable push notifications"),
        ("cache.ttl_seconds", "300", "Cache TTL in seconds"),
        ("cache.max_entries", "10000", "Maximum cache entries"),
        ("security.session_timeout", "3600", "Session timeout in seconds"),
        ("security.max_login_attempts", "5", "Maximum failed login attempts"),
    ]
    
    cursor.executemany("""
        INSERT OR REPLACE INTO config (key, value, description)
        VALUES (?, ?, ?)
    """, sample_configs)
    
    conn.commit()
    conn.close()
    
    print(f"Created seed database: {db_path}")


def create_bad_db():
    """Create a SQLite database with various issues for testing."""
    db_path = Path(__file__).parent / "bad" / "config.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT,
            description TEXT
        )
    """)
    
    bad_configs = [
        ("app.debug", "true", "Debug mode enabled - INSECURE"),
        ("security.ssl_enabled", "false", "SSL disabled - INSECURE"),
        ("database.password", "password123", "Plaintext password - BAD PRACTICE"),
        ("api.openai_key", "sk-abcdefghijklmnopqrstuvwxyz1234567890abcd", "Hardcoded API key"),
        ("admin.secret", "super_secret_123", "Plaintext secret"),
        ("redis.password", "", "Empty password"),
        ("log.level", "VERBOSE", "Invalid log level"),
        ("environment", "dev_mode", "Invalid environment value"),
    ]
    
    cursor.executemany("""
        INSERT OR REPLACE INTO config (key, value, description)
        VALUES (?, ?, ?)
    """, bad_configs)
    
    conn.commit()
    conn.close()
    
    print(f"Created bad database: {db_path}")


def create_migration_dbs():
    """Create multiple versions for migration testing."""
    versions_dir = Path(__file__).parent / "migration"
    
    for i, version in enumerate(["v1", "v2", "v3"], 1):
        version_dir = versions_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)
        
        db_path = version_dir / "config.db"
        
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS config (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        """)
        
        if version == "v1":
            configs = [
                ("app.version", "1.0.0"),
                ("feature.old_ui", "true"),
                ("cache.ttl", "60"),
                ("security.legacy_auth", "true"),
            ]
        elif version == "v2":
            configs = [
                ("app.version", "1.1.0"),
                ("feature.old_ui", "true"),
                ("feature.new_ui", "false"),
                ("cache.ttl", "300"),
                ("security.legacy_auth", "true"),
                ("new_feature.enabled", "true"),
            ]
        else:
            configs = [
                ("app.version", "2.0.0"),
                ("feature.new_ui", "true"),
                ("cache.ttl", "600"),
                ("security.legacy_auth", "false"),
                ("new_feature.enabled", "true"),
                ("beta.experimental", "true"),
            ]
        
        cursor.executemany("""
            INSERT OR REPLACE INTO config (key, value)
            VALUES (?, ?)
        """, configs)
        
        conn.commit()
        conn.close()
        
        print(f"Created migration database: {db_path}")


if __name__ == "__main__":
    create_seed_db()
    create_bad_db()
    create_migration_dbs()
    print("\nAll sample databases created successfully!")
