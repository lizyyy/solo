#!/usr/bin/env python3
import os
import sys
import json
import subprocess

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(PROJECT_DIR)

def run_cmd(cmd, description):
    print(f"\n{'='*60}")
    print(f"📌 {description}")
    cmd = cmd.replace('python -m', 'python3 -m')
    print(f"$ {cmd}")
    print("-" * 60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr)
    print(f"返回码: {result.returncode}")
    return result

def main():
    print("🚀 模型提示版本实验流量命中摘要排查CLI - 完整演示")
    
    run_cmd("rm -rf .prompt_version_data", "清理旧数据")
    
    print("\n" + "="*60)
    print("📁 1. 正常输入场景")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main publish customer_service v1 examples/normal_v1.txt --publisher alice --description '初始版本，专业客服'",
        "发布版本v1"
    )
    
    run_cmd(
        "python -m prompt_cli.main publish customer_service v2 examples/normal_v2.txt --publisher bob --description '优化版本，增加表情符号'",
        "发布版本v2"
    )
    
    run_cmd(
        "python -m prompt_cli.main list-versions customer_service",
        "查看版本列表"
    )
    
    run_cmd(
        'python -m prompt_cli.main traffic customer_service \'{"v1": 70, "v2": 30}\' --operator admin',
        "分配流量 v1=70%, v2=30%"
    )
    
    for i in range(1, 8):
        run_cmd(
            f"python -m prompt_cli.main hit req_{i:03d} customer_service v1 --content '用户问题{i}'",
            f"记录命中 v1 - 请求 {i}"
        )
    
    for i in range(8, 11):
        run_cmd(
            f"python -m prompt_cli.main hit req_{i:03d} customer_service v2 --content '用户问题{i}'",
            f"记录命中 v2 - 请求 {i}"
        )
    
    print("\n" + "="*60)
    print("📁 2. 边界冲突场景 - 重复发布同一版本")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main publish customer_service v1 examples/normal_v1.txt --publisher charlie",
        "尝试重复发布版本v1（应失败）"
    )
    
    print("\n" + "="*60)
    print("📁 3. 边界冲突场景 - 流量分配总和不等于100%")
    print("="*60)
    
    run_cmd(
        'python -m prompt_cli.main traffic customer_service \'{"v1": 60, "v2": 50}\' --operator admin',
        "尝试分配总和为110%的流量（应失败）"
    )
    
    print("\n" + "="*60)
    print("📁 4. 边界冲突场景 - 分配不存在的版本流量")
    print("="*60)
    
    run_cmd(
        'python -m prompt_cli.main traffic customer_service \'{"v1": 50, "v99": 50}\' --operator admin',
        "尝试分配流量给不存在的版本（应失败）"
    )
    
    print("\n" + "="*60)
    print("📁 5. 回滚幂等场景")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main rollback customer_service v2 v1 --operator admin --reason 'v2效果不好，回滚到v1'",
        "执行回滚 v2 -> v1"
    )
    
    run_cmd(
        "python -m prompt_cli.main rollback customer_service v2 v1 --operator admin --reason 'v2效果不好，回滚到v1'",
        "再次执行相同回滚（幂等，应不重复创建）"
    )
    
    print("\n" + "="*60)
    print("📁 6. 脏数据场景")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main publish customer_service v3 examples/dirty_data.txt --publisher dave --description '数据不全的版本'",
        "发布内容不完整的版本"
    )
    
    run_cmd(
        "python -m prompt_cli.main hit req_100 customer_service v99 --content '测试请求'",
        "尝试记录不存在版本的命中（应失败）"
    )
    
    print("\n" + "="*60)
    print("📁 7. 空结果场景 - 空模板")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main list-versions empty_template",
        "查询不存在模板的版本列表（应返回空）"
    )
    
    run_cmd(
        "python -m prompt_cli.main summary empty_template --format human",
        "生成空模板的摘要"
    )
    
    print("\n" + "="*60)
    print("📊 8. 生成完整报告并验证一致性")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main summary customer_service --format both --output reports/customer_service_summary",
        "生成人类可读和机器可读报告"
    )
    
    print("\n" + "="*60)
    print("🔍 9. 版本内容验证")
    print("="*60)
    
    run_cmd(
        "python -m prompt_cli.main verify customer_service v1 examples/normal_v1.txt",
        "验证版本v1内容正确"
    )
    
    run_cmd(
        "python -m prompt_cli.main verify customer_service v1 examples/normal_v2.txt",
        "验证版本v1内容不匹配（应失败）"
    )
    
    print("\n" + "="*60)
    print("✅ 演示完成！")
    print("="*60)
    print("\n生成的报告文件:")
    print("  - reports/customer_service_summary.txt (人类可读)")
    print("  - reports/customer_service_summary.json (机器可读)")
    print("\n数据存储位置:")
    print("  - .prompt_version_data/")

if __name__ == "__main__":
    main()
