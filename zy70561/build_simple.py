#!/usr/bin/env python3
import os

def write_file(path, content):
    dirname = os.path.dirname(path)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Created: {path}")

# requirements.txt
write_file('requirements.txt', """click>=8.0.0
rich>=12.0.0
pyyaml>=6.0
jinja2>=3.0.0
""")

# __init__.py
write_file('docker_cache_audit/__init__.py', '__version__ = "0.1.0"\n')

print("Done!")
