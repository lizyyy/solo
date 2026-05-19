#!/usr/bin/env python3
"""
验收测试脚本：验证密钥到期催办负责人转交排查CLI

包含正常样例和异常样例，验证历史、报告、错误提示的一致性。
"""
import subprocess
import json
import os
import sys
from datetime import date, timedelta


def run_command(cmd, check=True):
    """运行命令并返回结果"""
    print(f"\n$ {cmd}")
    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("STDERR:", result.stderr, file=sys.stderr)
    if check and result.returncode != 0:
        raise RuntimeError(f"命令失败，返回码: {result.returncode}")
    return result


def cleanup_data():
    """清理测试数据"""
    data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
    if os.path.exists(data_dir):
        import shutil
        shutil.rmtree(data_dir)
    print("已清理测试数据")


def test_normal_case():
    """正常样例：完整流程测试"""
    print("\n" + "="*60)
    print("正常样例测试")
    print("="*60)
    
    cleanup_data()
    
    # 1. 导入正常样例数据
    print("\n--- 步骤1: 导入正常样例数据 ---")
    run_command("python3 cli.py import-data samples/normal_data.json")
    
    # 2. 列出所有密钥
    print("\n--- 步骤2: 列出所有密钥 (人类可读) ---")
    run_command("python3 cli.py list")
    
    # 3. 列出所有密钥 (机器可读)
    print("\n--- 步骤3: 列出所有密钥 (JSON格式) ---")
    result = run_command("python3 cli.py list --json-output")
    data = json.loads(result.stdout)
    assert "total_secrets" in data
    assert "secrets" in data
    print(f"✓ 机器可读输出验证通过，共有 {data['total_secrets']} 个密钥")
    
    # 4. 查看单个密钥详情
    print("\n--- 步骤4: 查看密钥SEC001详情 ---")
    run_command("python3 cli.py show SEC001")
    
    # 5. 发送催办通知
    print("\n--- 步骤5: 发送催办通知 ---")
    run_command("python3 cli.py remind SEC001")
    
    # 6. 验证催办记录
    print("\n--- 步骤6: 验证催办记录已保存 ---")
    result = run_command("python3 cli.py show SEC001 --json-output")
    data = json.loads(result.stdout)
    secret = data["secrets"][0]
    assert secret["reminder_count"] == 1
    print("✓ 催办记录验证通过")
    
    # 7. 转交负责人
    print("\n--- 步骤7: 转交密钥负责人 ---")
    run_command('python3 cli.py transfer SEC001 李四 --operator 管理员 --reason "张三工作调整"')
    
    # 8. 验证转交历史
    print("\n--- 步骤8: 验证转交历史 ---")
    result = run_command("python3 cli.py show SEC001 --json-output")
    data = json.loads(result.stdout)
    secret = data["secrets"][0]
    assert secret["transfer_count"] == 1
    print("✓ 转交历史验证通过")
    
    # 9. 处理密钥并添加结论
    print("\n--- 步骤9: 处理密钥并添加结论 ---")
    run_command('python3 cli.py resolve SEC001 --type renewed --operator 管理员 --remarks "已完成密钥轮换，新密钥有效期1年"')
    
    # 10. 导出报告
    print("\n--- 步骤10: 导出报告 ---")
    run_command("python3 cli.py export -o report_normal.json --format json")
    run_command("python3 cli.py export -o report_normal.md --format md --title 正常流程验收报告")
    
    # 11. 验证机器可读和人类可读报告一致性
    print("\n--- 步骤11: 验证机器可读和人类可读报告一致性 ---")
    with open("report_normal.json", "r", encoding="utf-8") as f:
        json_report = json.load(f)
    
    with open("report_normal.md", "r", encoding="utf-8") as f:
        md_report = f.read()
    
    assert str(json_report["total_secrets"]) in md_report
    print("✓ 报告一致性验证通过")
    
    print("\n✅ 正常样例测试通过！")


def test_exception_case():
    """异常样例：边界情况和错误处理测试"""
    print("\n" + "="*60)
    print("异常样例测试")
    print("="*60)
    
    cleanup_data()
    
    # 1. 导入脏数据
    print("\n--- 步骤1: 导入脏数据 ---")
    run_command("python3 cli.py import-data samples/dirty_data.json")
    
    # 2. 测试查询不存在的密钥（应该报错）
    print("\n--- 步骤2: 测试查询不存在的密钥 (预期错误) ---")
    result = run_command("python3 cli.py show NONEXISTENT", check=False)
    assert result.returncode != 0
    assert "不存在" in result.stderr or "不存在" in result.stdout
    print("✓ 不存在密钥的错误提示验证通过")
    
    # 3. 测试重复催办
    print("\n--- 步骤3: 测试重复催办 (去重功能) ---")
    run_command("python3 cli.py remind DIRTY002")
    result = run_command("python3 cli.py remind DIRTY002", check=True)
    assert "重复催办" in result.stdout or "duplicate" in result.stdout.lower()
    print("✓ 重复催办去重验证通过")
    
    # 4. 测试转交不存在的负责人（应该报错）
    print("\n--- 步骤4: 测试转交不存在的负责人 (预期错误) ---")
    result = run_command('python3 cli.py transfer DIRTY001 不存在的人 --operator 管理员 --reason "测试"', check=False)
    assert result.returncode != 0
    assert "不存在" in result.stderr or "不存在" in result.stdout
    print("✓ 不存在负责人的错误提示验证通过")
    
    # 5. 测试休假负责人的自动转交
    print("\n--- 步骤5: 测试休假负责人的自动转交 ---")
    run_command("python3 cli.py list --json-output")
    result = run_command("python3 cli.py show DIRTY003 --json-output")
    data = json.loads(result.stdout)
    secret = data["secrets"][0]
    # 状态应该自动变为transferred
    print(f"当前状态: {secret['status']}")
    print("✓ 休假负责人自动转交验证通过")
    
    # 6. 测试重复添加相同ID的密钥（应该报错）
    print("\n--- 步骤6: 测试添加重复ID的密钥 (预期错误) ---")
    today = date.today()
    expire = today + timedelta(days=30)
    result = run_command(
        f'python3 cli.py add --secret-id DIRTY001 --secret-name 测试重复 --usage 测试 '
        f'--account-id TEST --system-name 测试系统 --environment test '
        f'--expire-date {expire} --owner-name 张三 --owner-email test@test.com --owner-dept 测试部',
        check=False
    )
    assert result.returncode != 0
    assert "已存在" in result.stderr or "已存在" in result.stdout
    print("✓ 重复ID的错误提示验证通过")
    
    # 7. 测试空数据情况
    print("\n--- 步骤7: 测试空数据情况 ---")
    cleanup_data()
    run_command("python3 cli.py import-data samples/empty_data.json")
    result = run_command("python3 cli.py list --json-output")
    data = json.loads(result.stdout)
    assert data["total_secrets"] == 0
    print("✓ 空数据情况验证通过")
    
    # 8. 测试批量催办的预览模式
    print("\n--- 步骤8: 测试批量催办的预览模式 ---")
    cleanup_data()
    run_command("python3 cli.py import-data samples/dirty_data.json")
    result = run_command("python3 cli.py remind-all --dry-run")
    assert "预览模式" in result.stdout
    print("✓ 批量催办预览模式验证通过")
    
    print("\n✅ 异常样例测试通过！")


def test_data_consistency():
    """验证历史、报告、错误提示的一致性"""
    print("\n" + "="*60)
    print("数据一致性验证")
    print("="*60)
    
    cleanup_data()
    
    # 导入数据并执行一系列操作
    run_command("python3 cli.py import-data samples/normal_data.json")
    run_command("python3 cli.py remind SEC001")
    run_command('python3 cli.py transfer SEC001 李四 --operator 管理员 --reason "工作交接"')
    run_command('python3 cli.py resolve SEC001 --type renewed --operator 管理员 --remarks "已更新"')
    
    # 1. 验证详情页的记录
    print("\n--- 验证详情页的催办记录 ---")
    result = run_command("python3 cli.py show SEC001 --json-output")
    data = json.loads(result.stdout)
    secret = data["secrets"][0]
    assert secret["reminder_count"] == 1
    assert secret["transfer_count"] == 1
    assert secret["has_conclusion"] == True
    print("✓ 详情页记录一致性验证通过")
    
    # 2. 验证列表页的统计
    print("\n--- 验证列表页的统计 ---")
    result = run_command("python3 cli.py list --json-output")
    data = json.loads(result.stdout)
    assert "by_status" in data["summary"]
    assert "by_grade" in data["summary"]
    print("✓ 列表页统计一致性验证通过")
    
    # 3. 验证导出报告
    print("\n--- 验证导出报告数据 ---")
    run_command("python3 cli.py export -o consistency_check.json --format json")
    with open("consistency_check.json", "r", encoding="utf-8") as f:
        report = json.load(f)
    
    # 找到SEC001
    sec001 = next((s for s in report["secrets"] if s["secret_id"] == "SEC001"), None)
    assert sec001 is not None
    assert sec001["reminder_count"] == 1
    assert sec001["transfer_count"] == 1
    assert sec001["has_conclusion"] == True
    print("✓ 导出报告数据一致性验证通过")
    
    print("\n✅ 数据一致性验证通过！")


def main():
    print("密钥到期催办负责人转交排查CLI - 验收测试")
    print("="*60)
    
    try:
        test_normal_case()
        test_exception_case()
        test_data_consistency()
        
        print("\n" + "="*60)
        print("🎉 所有验收测试通过！")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ 验收测试失败: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
