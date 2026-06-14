import sys, os
content = sys.stdin.read()
with open(sys.argv[1], 'a') as f:
    f.write(content)
print(f"Appended {len(content)} bytes, total: {os.path.getsize(sys.argv[1])}")
