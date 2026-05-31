#!/usr/bin/env python3
import subprocess
import sys
import os

def run_command(cmd, cwd=None):
    print(f"\n{'='*60}")
    print(f"执行命令: {cmd}")
    print(f"{'='*60}")
    try:
        result = subprocess.run(
            cmd,
            shell=True,
            cwd=cwd,
            capture_output=True,
            text=True
        )
        print("标准输出:")
        print(result.stdout)
        if result.stderr:
            print("标准错误:")
            print(result.stderr)
        print(f"返回码: {result.returncode}")
        return result
    except Exception as e:
        print(f"执行异常: {e}")
        return None

def main():
    work_dir = "/Users/lzy/pro/solo/workspaces/zy71867"
    
    print("="*60)
    print("开始执行所有任务")
    print("="*60)
    
    # 任务1: 安装依赖
    print("\n" + "="*60)
    print("任务1: 安装依赖")
    print("="*60)
    result1 = run_command("pip install -r requirements.txt", cwd=work_dir)
    
    # 任务2: 生成测试数据
    print("\n" + "="*60)
    print("任务2: 生成测试数据")
    print("="*60)
    result2 = run_command("python3 seed_test_data.py", cwd=work_dir)
    
    # 任务3: 验证数据
    print("\n" + "="*60)
    print("任务3: 验证数据是否正确写入")
    print("="*60)
    verify_cmd = '''python3 -c "from database import get_db; c=get_db().cursor(); c.execute('SELECT COUNT(*) FROM lectures'); print('讲义总数:', c.fetchone()[0]); c.execute('SELECT COUNT(*) FROM tangent_checks'); print('检查记录数:', c.fetchone()[0]); c.execute('SELECT COUNT(*) FROM audit_logs'); print('审计记录数:', c.fetchone()[0])"'''
    result3 = run_command(verify_cmd, cwd=work_dir)
    
    print("\n" + "="*60)
    print("所有任务执行完成")
    print("="*60)

if __name__ == "__main__":
    main()
