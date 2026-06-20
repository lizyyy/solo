import sys,base64
d=sys.stdin.read().strip()
data = base64.b64decode(d)
with open("/Users/lzy/pro/solo/workspaces/zy72507/app.py","ab") as f:
    f.write(data)
    f.write(b"
")
