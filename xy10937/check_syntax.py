import sys
import os

def check_syntax(filename):
    try:
        with open(filename, 'r') as f:
            compile(f.read(), filename, 'exec')
        print(f"✅ {filename}: 语法正确")
        return True
    except SyntaxError as e:
        print(f"❌ {filename}: 语法错误 - 第{e.lineno}行: {e.text}")
        return False
    except Exception as e:
        print(f"❌ {filename}: 错误 - {e}")
        return False

if __name__ == "__main__":
    files = ['main.py', 'models.py', 'schemas.py', 'crud.py', 'database.py', 'test_api.py']
    all_ok = True
    for f in files:
        if os.path.exists(f):
            if not check_syntax(f):
                all_ok = False
        else:
            print(f"⚠️  {f}: 文件不存在")
    
    if all_ok:
        print("\n🎉 所有 Python 文件语法检查通过！")
    else:
        print("\n❌ 部分文件存在语法错误")
        sys.exit(1)