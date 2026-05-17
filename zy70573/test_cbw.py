#!/usr/bin/env python3
"""Test script for Crontab Black Window Checker"""
import subprocess
import sys

print("=" * 60)
print("TEST 1: Create sample crontab")
print("=" * 60)
result = subprocess.run([sys.executable, "cbw.py", "--create-sample", "test_cron.txt"], 
                       capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
print()

print("=" * 60)
print("TEST 2: Run conflict check")
print("=" * 60)
result = subprocess.run([sys.executable, "cbw.py", "--file", "test_cron.txt", 
                        "--black-window", "2:00-5:00", "--output", "terminal"], 
                       capture_output=True, text=True)
print("STDOUT:")
print(result.stdout[:2000])
print()
print("STDERR:")
print(result.stderr)
print()

print("=" * 60)
print("TEST 3: Generate JSON report")
print("=" * 60)
result = subprocess.run([sys.executable, "cbw.py", "--file", "test_cron.txt", 
                        "--black-window", "2:00-5:00", "--output", "json",
                        "--output-file", "report"], 
                       capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
print()

print("=" * 60)
print("TEST 4: Generate Markdown report")
print("=" * 60)
result = subprocess.run([sys.executable, "cbw.py", "--file", "test_cron.txt", 
                        "--black-window", "2:00-5:00", "--output", "markdown",
                        "--output-file", "report"], 
                       capture_output=True, text=True)
print(result.stdout)
print(result.stderr)
print()

print("=" * 60)
print("ALL TESTS COMPLETED")
print("=" * 60)
print()
print("Generated files:")
subprocess.run(["ls", "-la", "test_cron.txt", "report.json", "report.md"], 
               capture_output=False)
