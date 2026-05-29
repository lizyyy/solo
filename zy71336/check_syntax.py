"""检查所有Python文件的语法正确性"""
import os
import py_compile
import sys

def main():
    project_root = os.path.dirname(__file__)
    python_files = []

    for root, dirs, files in os.walk(project_root):
        if 'data' in dirs:
            dirs.remove('data')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')

        for f in files:
            if f.endswith('.py'):
                python_files.append(os.path.join(root, f))

    print(f"发现 {len(python_files)} 个Python文件，开始语法检查...\n")

    errors = []
    for filepath in sorted(python_files):
        rel_path = os.path.relpath(filepath, project_root)
        try:
            py_compile.compile(filepath, doraise=True)
            print(f"✅ {rel_path}")
        except py_compile.PyCompileError as e:
            print(f"❌ {rel_path}")
            print(f"   错误: {e}")
            errors.append((rel_path, str(e)))
        except Exception as e:
            print(f"❌ {rel_path}")
            print(f"   错误: {e}")
            errors.append((rel_path, str(e)))

    print("\n" + "=" * 70)
    if errors:
        print(f"❌ 发现 {len(errors)} 个错误:")
        for path, error in errors:
            print(f"  - {path}: {error}")
        sys.exit(1)
    else:
        print("🎉 所有文件语法正确！")

        print("\n" + "=" * 70)
        print("📋 项目文件清单:")
        print("=" * 70)
        for filepath in sorted(python_files):
            rel_path = os.path.relpath(filepath, project_root)
            size = os.path.getsize(filepath)
            with open(filepath, 'r') as f:
                lines = len(f.readlines())
            print(f"  {rel_path:<40} {lines:>4}行  {size:>6}字节")

        sys.exit(0)

if __name__ == "__main__":
    main()
