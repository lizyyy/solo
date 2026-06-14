import sys

content = sys.stdin.read()
with open('e2e_repeat_import_test.py', 'a') as f:
    f.write(content)
print(f"OK, appended {len(content)} bytes")
