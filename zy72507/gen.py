import base64, sys

def w(s):
    with open('/Users/lzy/pro/solo/workspaces/zy72507/app.py', 'a') as f:
        f.write(s)

def main():
    part = sys.argv[1]
    data = sys.stdin.read()
    code = base64.b64decode(data).decode('utf-8')
    if part == '1':
        with open('/Users/lzy/pro/solo/workspaces/zy72507/app.py', 'w') as f:
            f.write(code)
    else:
        w(code)
    print('OK')

if __name__ == '__main__':
    main()
