#!/usr/bin/env python3
import os
import sys

def check_dependencies():
    required_packages = [
        'flask',
        'numpy',
        'flask_cors'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package.replace('_', ''))
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"缺少依赖包: {', '.join(missing)}")
        print("请运行: pip install -r requirements.txt")
        return False
    return True

def main():
    print("=" * 60)
    print("优化算法实验台")
    print("=" * 60)
    print()
    
    if not check_dependencies():
        sys.exit(1)
    
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    
    from backend.app import app
    
    print("启动服务器...")
    print(f"访问地址: http://localhost:5000")
    print(f"API地址: http://localhost:5000/api")
    print()
    print("按 Ctrl+C 停止服务器")
    print("=" * 60)
    print()
    
    app.run(host='0.0.0.0', port=5000, debug=True)

if __name__ == '__main__':
    main()
