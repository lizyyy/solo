#!/usr/bin/env python3
"""
语法检查和权限设置脚本
"""

import os
import sys
import ast
import stat

def check_python_file(filepath):
    """检查Python文件语法"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            source = f.read()
        ast.parse(source)
        return True, None
    except SyntaxError as e:
        return False, f"第{e.lineno}行: {e.msg}"
    except Exception as e:
        return False, str(e)

def main():
    print("="*60)
    print("代码语法检查")
    print("="*60)
    
    project_dir = os.path.dirname(__file__)
    
    python_files = []
    for root, dirs, files in os.walk(project_dir):
        if 'uploads' in dirs:
            dirs.remove('uploads')
        if 'exports' in dirs:
            dirs.remove('exports')
        if '__pycache__' in dirs:
            dirs.remove('__pycache__')
        for f in files:
            if f.endswith('.py'):
                python_files.append(os.path.join(root, f))
    
    print(f"\n共找到 {len(python_files)} 个Python文件\n")
    
    all_passed = True
    for filepath in sorted(python_files):
        rel_path = os.path.relpath(filepath, project_dir)
        passed, error = check_python_file(filepath)
        if passed:
            print(f"✅ {rel_path}")
        else:
            print(f"❌ {rel_path} - {error}")
            all_passed = False
    
    print("\n" + "="*60)
    
    if all_passed:
        print("🎉 所有Python文件语法正确！")
    else:
        print("⚠️  部分文件存在语法错误，请修复后重试")
        return 1
    
    print("\n" + "="*60)
    print("设置文件权限")
    print("="*60)
    
    start_sh = os.path.join(project_dir, 'start.sh')
    if os.path.exists(start_sh):
        try:
            st = os.stat(start_sh)
            os.chmod(start_sh, st.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
            print(f"✅ 已设置 start.sh 可执行权限")
        except Exception as e:
            print(f"⚠️  设置权限失败: {e}")
            print("   手动执行: chmod +x start.sh")
    
    print("\n" + "="*60)
    print("项目文件结构")
    print("="*60)
    
    for root, dirs, files in os.walk(project_dir):
        if any(d in root for d in ['uploads', 'exports', '__pycache__', '.git']):
            continue
        
        level = root.replace(project_dir, '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        
        subindent = ' ' * 2 * (level + 1)
        for file in sorted(files):
            if file.endswith('.db'):
                continue
            filepath = os.path.join(root, file)
            size = os.path.getsize(filepath)
            print(f'{subindent}{file} ({size} bytes)')
    
    print("\n" + "="*60)
    print("快速开始")
    print("="*60)
    print("\n方法一：使用启动脚本")
    print("  cd /Users/lzy/pro/solo/workspaces/zy71867")
    print("  ./start.sh")
    print("\n方法二：手动执行")
    print("  cd /Users/lzy/pro/solo/workspaces/zy71867")
    print("  pip install -r requirements.txt")
    print("  python3 seed_test_data.py")
    print("  python3 verify_evidence.py")
    print("  python3 app.py")
    print("\n然后打开浏览器访问: http://localhost:5000")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
