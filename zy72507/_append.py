import sys, base64
data = sys.stdin.read().strip()
with open("/Users/lzy/pro/solo/workspaces/zy72507/app.py", "ab") as f:
    f.write(base64.b64decode(data))
    f.write(b"\n")
