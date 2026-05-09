#!/usr/bin/env python3
"""
印刷厂色差追样CLI - 示例数据生成脚本
"""

import subprocess
import sys
import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data"


def run_command(cmd, description):
    """运行命令并打印结果"""
    print(f"\n{'='*60}")
    print(f"执行: {description}")
    print(f"命令: {cmd}")
    print(f"{'='*60}")

    result = subprocess.run(cmd, shell=True, cwd=PROJECT_ROOT, capture_output=True, text=True)

    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print("错误输出:")
        print(result.stderr)

    return result.returncode


def generate_successful_case():
    """生成顺利样例：订单ORD-2025-001"""
    print("\n" + "#"*60)
    print("#  生成顺利样例：ORD-2025-001")
    print("#  场景：产品包装盒打样，经过4次打样，色差逐渐改善，最终通过")
    print("#"*60)

    order_id = "ORD-2025-001"

    samples = [
        {
            "sequence": 1,
            "ref": (52.0, 28.0, -16.0),
            "measured": (54.5, 26.0, -18.5),
            "paper_batch": "PAPER-2025-A001",
            "description": "第一次打样：ΔE2000约2.5，接近警戒值，偏亮偏蓝"
        },
        {
            "sequence": 2,
            "ref": (52.0, 28.0, -16.0),
            "measured": (52.8, 27.2, -16.8),
            "paper_batch": "PAPER-2025-A001",
            "description": "第二次打样：ΔE2000约1.0，在容差范围内"
        },
        {
            "sequence": 3,
            "ref": (52.0, 28.0, -16.0),
            "measured": (52.2, 27.8, -16.3),
            "paper_batch": "PAPER-2025-A001",
            "description": "第三次打样：ΔE2000约0.3，非常接近参考色"
        },
        {
            "sequence": 4,
            "ref": (52.0, 28.0, -16.0),
            "measured": (51.9, 28.1, -15.9),
            "paper_batch": "PAPER-2025-A001",
            "description": "第四次打样：ΔE2000约0.15，完全符合标准"
        },
    ]

    for i, sample in enumerate(samples, 1):
        print(f"\n--- {sample['description']} ---")

        cmd = (
            f"python -m color_tracking.cli.main sample create "
            f"--order-id {order_id} "
            f"--product-name \"高端化妆品包装盒\" "
            f"--paper-type \"铜版纸\" "
            f"--ink-type \"UV油墨\" "
            f"--print-machine \"海德堡XL105\" "
            f"--operator \"李师傅\" "
            f"--paper-batch {sample['paper_batch']} "
            f"--paper-manufacturer \"金东纸业\" "
            f"--paper-weight 250 "
            f"--ref-l {sample['ref'][0]} --ref-a {sample['ref'][1]} --ref-b {sample['ref'][2]} "
            f"--measured-l {sample['measured'][0]} --measured-a {sample['measured'][1]} --measured-b {sample['measured'][2]} "
            f"--notes \"第{i}次打样，{sample['description']}\""
        )

        run_command(cmd, f"创建第{i}次打样记录")

        if i == 1:
            adjust_cmd = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 1 "
                f"--channel M "
                f"--before 85.0 "
                f"--after 92.0 "
                f"--reason \"品红不足，需要增加\" "
                f"--operator \"李师傅\""
            )
            run_command(adjust_cmd, "第1次打样后增加品红墨量调整")

            adjust_cmd2 = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 1 "
                f"--channel Y "
                f"--before 45.0 "
                f"--after 48.0 "
                f"--reason \"黄色略浅，微调\" "
                f"--operator \"李师傅\""
            )
            run_command(adjust_cmd2, "第1次打样后微调黄墨")

    print("\n--- 复核打样记录 ---")
    for seq in [2, 3, 4]:
        approve_cmd = (
            f"python -m color_tracking.cli.main review approve "
            f"--order-id {order_id} "
            f"--sequence {seq} "
            f"--reviewer \"张主管\" "
            f"--notes \"色差符合标准，通过\""
        )
        run_command(approve_cmd, f"复核通过第{seq}次打样")

    compare_cmd = f"python -m color_tracking.cli.main compare order --order-id {order_id}"
    run_command(compare_cmd, "对比订单所有打样")

    report_cmd = (
        f"python -m color_tracking.cli.main report generate "
        f"--order-id {order_id} "
        f"--output-dir ./output/successful "
        f"--format all"
    )
    run_command(report_cmd, "生成追样报告")

    print("\n" + "#"*60)
    print("#  顺利样例生成完成！")
    print("#  订单编号: ORD-2025-001")
    print("#  数据目录:", DATA_DIR / "records" / order_id)
    print("#  报告目录:", PROJECT_ROOT / "output" / "successful")
    print("#"*60)


def generate_review_case():
    """生成拦截/待复核样例：订单ORD-2025-002"""
    print("\n" + "#"*60)
    print("#  生成拦截/待复核样例：ORD-2025-002")
    print("#  场景：产品宣传册打样，存在严重色差、纸张批次变更等问题")
    print("#"*60)

    order_id = "ORD-2025-002"

    samples = [
        {
            "sequence": 1,
            "ref": (45.0, 58.0, 35.0),
            "measured": (42.0, 52.0, 28.0),
            "paper_batch": "PAPER-2025-B001",
            "description": "第一次打样：ΔE2000约5.0，严重超标，偏暗偏绿偏蓝"
        },
        {
            "sequence": 2,
            "ref": (45.0, 58.0, 35.0),
            "measured": (48.0, 65.0, 42.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第二次打样：纸张批次变更，ΔE2000约4.5，偏亮偏红偏黄"
        },
        {
            "sequence": 3,
            "ref": (45.0, 58.0, 35.0),
            "measured": (47.5, 63.0, 39.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第三次打样：ΔE2000约3.5，仍需复核"
        },
        {
            "sequence": 4,
            "ref": (45.0, 58.0, 35.0),
            "measured": (46.0, 56.0, 32.0),
            "paper_batch": "PAPER-2025-B002",
            "description": "第四次打样：ΔE2000约2.0，接近警戒值"
        },
    ]

    for i, sample in enumerate(samples, 1):
        print(f"\n--- {sample['description']} ---")

        cmd = (
            f"python -m color_tracking.cli.main sample create "
            f"--order-id {order_id} "
            f"--product-name \"企业宣传册封面\" "
            f"--paper-type \"哑粉纸\" "
            f"--ink-type \"胶印油墨\" "
            f"--print-machine \"小森LS440\" "
            f"--operator \"王师傅\" "
            f"--paper-batch {sample['paper_batch']} "
            f"--paper-manufacturer \"太阳纸业\" "
            f"--paper-weight 200 "
            f"--ref-l {sample['ref'][0]} --ref-a {sample['ref'][1]} --ref-b {sample['ref'][2]} "
            f"--measured-l {sample['measured'][0]} --measured-a {sample['measured'][1]} --measured-b {sample['measured'][2]} "
            f"--notes \"第{i}次打样，{sample['description']}\""
        )

        run_command(cmd, f"创建第{i}次打样记录")

        if i == 1:
            adjust_cmd = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 1 "
                f"--channel M "
                f"--before 78.0 "
                f"--after 88.0 "
                f"--reason \"品红严重不足，大幅增加\" "
                f"--operator \"王师傅\""
            )
            run_command(adjust_cmd, "第1次打样后大幅增加品红")

            adjust_cmd2 = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 1 "
                f"--channel Y "
                f"--before 62.0 "
                f"--after 72.0 "
                f"--reason \"黄色严重不足，大幅增加\" "
                f"--operator \"王师傅\""
            )
            run_command(adjust_cmd2, "第1次打样后大幅增加黄墨")

            adjust_cmd3 = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 1 "
                f"--channel K "
                f"--before 35.0 "
                f"--after 28.0 "
                f"--reason \"黑色过重，需要减少\" "
                f"--operator \"王师傅\""
            )
            run_command(adjust_cmd3, "第1次打样后减少黑墨")

        if i == 2:
            adjust_cmd = (
                f"python -m color_tracking.cli.main adjust add "
                f"--order-id {order_id} "
                f"--sequence 2 "
                f"--channel M "
                f"--before 88.0 "
                f"--after 82.0 "
                f"--reason \"品红偏多，减少\" "
                f"--operator \"王师傅\""
            )
            run_command(adjust_cmd, "第2次打样后减少品红")

    print("\n--- 复核处理 ---")
    reject_cmd = (
        f"python -m color_tracking.cli.main review reject "
        f"--order-id {order_id} "
        f"--sequence 1 "
        f"--reviewer \"李主管\" "
        f"--notes \"色差严重超标，ΔE2000约5.0，必须重新调整\""
    )
    run_command(reject_cmd, "拒绝第1次打样")

    reject_cmd2 = (
        f"python -m color_tracking.cli.main review reject "
        f"--order-id {order_id} "
        f"--sequence 2 "
        f"--reviewer \"李主管\" "
        f"--notes \"纸张批次变更导致颜色偏亮偏红，需要重新调整配方\""
    )
    run_command(reject_cmd2, "拒绝第2次打样")

    list_cmd = f"python -m color_tracking.cli.main sample list --order-id {order_id}"
    run_command(list_cmd, "查看订单打样列表")

    compare_cmd = f"python -m color_tracking.cli.main compare order --order-id {order_id}"
    run_command(compare_cmd, "对比订单所有打样")

    report_cmd = (
        f"python -m color_tracking.cli.main report generate "
        f"--order-id {order_id} "
        f"--output-dir ./output/review_needed "
        f"--format all"
    )
    run_command(report_cmd, "生成追样报告（含待复核项）")

    print("\n" + "#"*60)
    print("#  拦截/待复核样例生成完成！")
    print("#  订单编号: ORD-2025-002")
    print("#  数据目录:", DATA_DIR / "records" / order_id)
    print("#  报告目录:", PROJECT_ROOT / "output" / "review_needed")
    print("#  特点:")
    print("#    - 第1-2次打样被拒绝")
    print("#    - 存在纸张批次变更 (PAPER-2025-B001 -> PAPER-2025-B002)")
    print("#    - 多次严重色差预警")
    print("#    - 第3-4次打样仍需人工复核")
    print("#"*60)


def show_summary():
    """显示所有订单摘要"""
    print("\n" + "#"*60)
    print("#  所有订单摘要")
    print("#"*60)

    list_cmd = "python -m color_tracking.cli.main orders list"
    run_command(list_cmd, "列出所有订单")

    for order_id in ["ORD-2025-001", "ORD-2025-002"]:
        summary_cmd = f"python -m color_tracking.cli.main orders summary --order-id {order_id}"
        run_command(summary_cmd, f"订单 {order_id} 摘要")


def main():
    print("\n" + "="*60)
    print("  印刷厂色差追样CLI - 示例数据生成工具")
    print("="*60)

    os.chdir(PROJECT_ROOT)

    print("\n检查Python环境和模块...")
    result = subprocess.run([sys.executable, "-c", "import color_tracking"],
                          capture_output=True, text=True, cwd=PROJECT_ROOT)
    if result.returncode != 0:
        print(f"错误: 无法导入color_tracking模块")
        print(f"请确保在项目根目录运行此脚本")
        print(f"当前目录: {PROJECT_ROOT}")
        print(f"错误信息: {result.stderr}")
        return 1

    print("✓ 模块导入成功")

    generate_successful_case()
    generate_review_case()
    show_summary()

    print("\n" + "="*60)
    print("  示例数据生成完成！")
    print("="*60)
    print("\n你可以使用以下命令继续操作:")
    print("  python -m color_tracking.cli.main --help")
    print("  python -m color_tracking.cli.main orders list")
    print("  python -m color_tracking.cli.main sample list --order-id ORD-2025-001")
    print("  python -m color_tracking.cli.main sample list --order-id ORD-2025-002")
    print("\n数据文件位置:")
    print(f"  打样记录: {DATA_DIR}/records/")
    print(f"  对比分析: {DATA_DIR}/comparisons/")
    print(f"  报告文件: {DATA_DIR}/reports/")
    print(f"  导出文件: {PROJECT_ROOT}/output/")
    print("="*60 + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
