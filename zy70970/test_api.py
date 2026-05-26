#!/usr/bin/env python3
import urllib.request
import json

print("=== API Test Results ===")

try:
    with urllib.request.urlopen('http://localhost:8000/health') as r:
        print("1. Health:", r.read().decode())

    with urllib.request.urlopen('http://localhost:8000/report/summary') as r:
        data = json.loads(r.read())
        print("2. Summary OK: total=%d, valid=%d, invalid=%d" % (
            data['total_jobs'], data['valid_jobs'], data['invalid_jobs']
        ))

    with urllib.request.urlopen('http://localhost:8000/jobs/job_5/explanation') as r:
        data = json.loads(r.read())
        print("3. Job job_5: status=%s" % data['review_status'])
        print("   Reason: %s" % data['decision_reason'][:60])

    with urllib.request.urlopen('http://localhost:8000/report/export/csv') as r:
        csv_text = r.read().decode('utf-8')
        print("4. CSV Export OK: %d lines" % len(csv_text.split('\n')))

    print("\n✓ All API tests passed!")
except Exception as e:
    print("Error:", str(e))
