import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_health_check():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    response = client.get('/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'healthy'


def test_verify_fixes_script():
    import subprocess
    result = subprocess.run(
        [sys.executable, 'verify_fixes.py'],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    assert result.returncode == 0


def test_verify_report_trace_script():
    import subprocess
    result = subprocess.run(
        [sys.executable, 'verify_report_trace_fixes.py'],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    )
    assert result.returncode == 0
