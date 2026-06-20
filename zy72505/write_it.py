import sys
with open('app.py', 'w') as f:
    f.write(sys.stdin.read())
print(f"Wrote {sys.stdin.buffer.tell() if hasattr(sys.stdin.buffer, 'tell') else '?'} bytes")
