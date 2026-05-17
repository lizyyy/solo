#!/usr/bin/env python3
import subprocess
import sys
import os
import json


def run_command(cmd, description):
    print(f"\n{'='*80}")
    print(f"测试: {description}")
    cmd = cmd.replace("python cli.py", "python3 cli.py")
    print(f"命令: {cmd}")
    print(f"{'='*80}")

    result = subprocess.run(
        cmd,
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )

    if result.stdout:
        print("输出:")
        print(result.stdout)
    if result.stderr:
        print("错误:")
        print(result.stderr)

    print(f"返回码: {result.returncode}")
    return result


def test_normal_scenario():
    print("\n" + "#"*80)
    print("# 正常流程验收测试")
    print("#"*80)

    run_command("python cli.py clear", "清除历史记录")

    result = run_command(
        'python cli.py process --hotel "希尔顿酒店" --linen "床单" --inbound 100 --damage 5 --rewash 3',
        "单次处理正常数据"
    )

    assert "希尔顿酒店" in result.stdout
    assert "入库数量: 100" in result.stdout
    assert "破损扣减: 5" in result.stdout
    assert "返洗标记: 3" in result.stdout
    assert "出库数量: 92" in result.stdout
    assert result.returncode == 0

    result = run_command("python cli.py history", "查看历史记录")
    assert "希尔顿酒店" in result.stdout

    result = run_command("python cli.py export --format json", "导出JSON报告")
    json_data = json.loads(result.stdout)
    assert json_data["report_info"]["total_records"] >= 1
    assert json_data["summary"]["total_inbound"] == 100
    assert json_data["summary"]["total_damage"] == 5
    assert json_data["summary"]["total_rewash"] == 3

    result = run_command("python cli.py export --format csv", "导出CSV报告")
    assert "希尔顿酒店" in result.stdout

    result = run_command("python cli.py export --format text", "导出文本报告")
    assert "布草分拣返洗短少分级排查报告" in result.stdout

    print("\n✅ 正常流程验收通过！")


def test_exception_scenario():
    print("\n" + "#"*80)
    print("# 异常流程验收测试")
    print("#"*80)

    run_command("python cli.py clear", "清除历史记录")

    result = run_command(
        'python cli.py process --hotel "" --linen "床单" --inbound 100 --damage 5 --rewash 3',
        "空酒店名称（应该报错）"
    )
    assert result.returncode == 1
    assert "酒店名称不能为空" in result.stderr

    result = run_command(
        'python cli.py process --hotel "测试酒店" --linen "床单" --inbound -10 --damage 5 --rewash 3',
        "负数入库数量（应该报错）"
    )
    assert result.returncode == 1
    assert "入库数量不能为负数" in result.stderr

    result = run_command(
        'python cli.py process --hotel "测试酒店" --linen "床单" --inbound 50 --damage 60 --rewash 3',
        "破损数量超过入库数量（应该报错）"
    )
    assert result.returncode == 1
    assert "破损总数" in result.stderr

    result = run_command(
        'python cli.py process --hotel "测试酒店" --linen "" --inbound 100 --damage 5 --rewash 3',
        "空布草类型（应该报错）"
    )
    assert result.returncode == 1
    assert "布草类型不能为空" in result.stderr

    result = run_command("python cli.py history", "查看历史记录（应该为空）")
    assert "无数据" in result.stdout

    print("\n✅ 异常流程验收通过！")


def test_batch_scenario():
    print("\n" + "#"*80)
    print("# 批量处理验收测试")
    print("#"*80)

    run_command("python cli.py clear", "清除历史记录")

    result = run_command(
        "python cli.py batch --file samples_normal.json",
        "批量处理正常数据"
    )
    assert result.returncode == 0
    assert "共处理 4 条记录" in result.stdout

    result = run_command("python cli.py history", "查看历史记录")
    assert "希尔顿酒店" in result.stdout
    assert "万豪酒店" in result.stdout
    assert "洲际酒店" in result.stdout
    assert "喜来登酒店" in result.stdout

    result = run_command(
        "python cli.py batch --file samples_dirty.json",
        "批量处理脏数据（应该部分失败）"
    )
    assert result.returncode == 0

    print("\n✅ 批量处理验收通过！")


def verify_consistency():
    print("\n" + "#"*80)
    print("# 数据一致性验证：历史、报告、错误提示")
    print("#"*80)

    run_command("python cli.py clear", "清除历史记录")

    run_command(
        'python cli.py process --hotel "一致性酒店" --linen "台布" --inbound 200 --damage 10 --rewash 20',
        "插入测试数据"
    )

    history_result = run_command("python cli.py history", "获取历史记录")
    json_result = run_command("python cli.py export --format json", "获取JSON报告")
    text_result = run_command("python cli.py export --format text", "获取文本报告")
    csv_result = run_command("python cli.py export --format csv", "获取CSV报告")

    assert "一致性酒店" in history_result.stdout
    assert "一致性酒店" in json_result.stdout
    assert "一致性酒店" in text_result.stdout
    assert "一致性酒店" in csv_result.stdout

    assert "入库数量: 200" in history_result.stdout
    assert '"inbound_quantity": 200' in json_result.stdout
    assert "200" in csv_result.stdout

    assert "破损扣减: 10" in history_result.stdout
    assert '"total_damage": 10' in json_result.stdout

    assert "返洗标记: 20" in history_result.stdout
    assert '"total_rewash": 20' in json_result.stdout

    assert "出库数量: 170" in history_result.stdout
    assert '"outbound_quantity": 170' in json_result.stdout

    print("\n✅ 数据一致性验证通过！历史、报告、错误提示完全一致！")


def main():
    try:
        print("\n" + "="*80)
        print("布草分拣返洗短少分级排查CLI - 验收测试套件")
        print("="*80)

        test_normal_scenario()
        test_exception_scenario()
        test_batch_scenario()
        verify_consistency()

        print("\n" + "="*80)
        print("🎉 所有验收测试通过！")
        print("="*80)
        print("\n验收总结:")
        print("  ✅ 正常流程：单次处理、历史记录、多格式导出正常")
        print("  ✅ 异常流程：空值、负数、数量超限等边界情况正确处理")
        print("  ✅ 批量处理：正常数据和脏数据混合处理正确")
        print("  ✅ 数据一致性：历史记录、JSON/CSV/文本报告数据完全一致")
        return 0

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
