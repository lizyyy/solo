import base64
import ast
import os
import sys

_B64 = ""

def main():
    if not _B64:
        print("ERROR: _B64 is empty")
        sys.exit(1)
    decoded = base64.b64decode(_B64).decode("utf-8")
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(decoded)
    try:
        ast.parse(decoded)
        print("语法验证通过")
    except SyntaxError as e:
        print("语法错误:", e)
        sys.exit(1)
    size = os.path.getsize(output_path)
    print("app.py 生成完成，大小: {} 字节".format(size))

if __name__ == "__main__":
    main()
