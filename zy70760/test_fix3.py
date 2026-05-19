#!/usr/bin/env python3
import os
os.chdir('/Users/lzy/pro/solo/workspaces/zy70760')

# Clean up old db
if os.path.exists('wheel_metadata.db'):
    os.remove('wheel_metadata.db')

print('=== Full validation ===')

# 0. Init database
print('0. Initialize database...')
from app.database import init_db
init_db()
print('   OK')

# 1. Module import
print('1. Module import...')
from app.main import app
from app.wheel_parser import WheelParser
from app.validator import WheelValidator
print('   OK')

# 2. Test upload with build tag wheel
print('2. Testing API upload endpoint...')
from fastapi.testclient import TestClient
import zipfile
import io

client = TestClient(app)

# Create a wheel with build tag and manylinux_2_28
buffer = io.BytesIO()
with zipfile.ZipFile(buffer, 'w') as zf:
    dist_info = 'demo_pkg-2.0.0.dist-info'
    zf.writestr(f'{dist_info}/METADATA', '''Metadata-Version: 2.1
Name: demo-pkg
Version: 2.0.0
Summary: Test package
''')

buffer.seek(0)
response = client.post(
    '/api/wheels',
    files={'file': ('demo_pkg-2.0.0-1-py3-none-manylinux_2_28_x86_64.whl', buffer)}
)
print(f'   Upload status: {response.status_code}')
assert response.status_code == 200

data = response.json()
print(f'   Package name: {data["package_name"]}')
print(f'   Package version: {data["package_version"]}')
print(f'   Platform tag: {data["platform_tag"]}')

assert data['package_name'] == 'demo_pkg', f'Expected demo_pkg, got {data["package_name"]}'
assert data['package_version'] == '2.0.0', f'Expected 2.0.0, got {data["package_version"]}'
print('   Build tag parsing: OK')

# 3. Test validation with manylinux_2_28
print('3. Testing platform validation...')
wheel_id = data['id']
response = client.post(f'/api/wheels/{wheel_id}/validate')
print(f'   Validate status: {response.status_code}')
assert response.status_code == 200

val_data = response.json()
print(f'   Overall status: {val_data["overall_status"]}')
print(f'   Platform tag check: {val_data["platform_tag_check"]}')
print(f'   Platform tag message: {val_data["platform_tag_message"]}')
assert val_data['platform_tag_check'] is True, 'manylinux_2_28 should be valid'
print('   Platform validation: OK')

# 4. Clean up
if os.path.exists('wheel_metadata.db'):
    os.remove('wheel_metadata.db')

print()
print('All checks passed!')
