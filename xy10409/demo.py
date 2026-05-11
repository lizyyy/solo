#!/usr/bin/env python3
import subprocess
import os
import shutil


def run_cmd(cmd, description):
    print(f"\n{'='*60}")
    print(f"[演示] {description}")
    print(f"[命令] {cmd}")
    print('='*60)
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    print(result.stdout)
    if result.stderr:
        print(f"[错误] {result.stderr}")
    return result


def main():
    data_dir = "./data_demo"

    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)

    base_cmd = f"python3 -m meeting_room_charge.cli --data-dir {data_dir}"

    run_cmd(f"{base_cmd} import-members samples/members.csv", "导入会员规则")

    run_cmd(f"{base_cmd} import-bookings samples/bookings.csv", "导入预约记录")

    run_cmd(f"{base_cmd} import-checkins samples/checkins.csv", "导入签到记录")

    run_cmd(f"{base_cmd} exceptions", "查看异常清单")

    run_cmd(f"{base_cmd} process", "处理扣费逻辑")

    run_cmd(f"{base_cmd} bill M001", "查看会员 M001 账单")

    run_cmd(f"{base_cmd} bill M002", "查看会员 M002 账单")

    run_cmd(f"{base_cmd} bill M003", "查看会员 M003 账单")

    run_cmd(f"{base_cmd} bill M004", "查看会员 M004 账单")

    result = subprocess.run(
        f"{base_cmd} export-weekly --start 2026-05-04 --end 2026-05-10",
        shell=True, capture_output=True, text=True
    )
    print(result.stdout)

    print("\n[演示] 模拟查找扣费ID...")
    charge_id_late = None
    charge_id_overtime = None
    for line in result.stdout.split('\n'):
        if '│' in line:
            parts = [p.strip() for p in line.split('│') if p.strip()]
            if len(parts) >= 6:
                if '迟到' in line and not charge_id_late:
                    charge_id_late = parts[0]
                    print(f"[演示] 找到迟到扣费ID: {charge_id_late}")
                if '超时' in line and not charge_id_overtime:
                    charge_id_overtime = parts[0]
                    print(f"[演示] 找到超时扣费ID: {charge_id_overtime}")

    if charge_id_late:
        run_cmd(
            f"{base_cmd} appeal {charge_id_late} \"系统延迟签到\"",
            f"登记申诉 {charge_id_late}"
        )

        run_cmd(
            f"{base_cmd} process-appeal {charge_id_late} --approve",
            f"通过申诉 {charge_id_late}"
        )

        run_cmd(f"{base_cmd} bill M002", "查看申诉后的会员 M002 账单")

    if charge_id_overtime:
        print("\n[演示] 演示另一个申诉驳回...")
        run_cmd(
            f"{base_cmd} appeal {charge_id_overtime} \"实际提前离开\"",
            f"登记申诉 {charge_id_overtime}"
        )

        run_cmd(
            f"{base_cmd} process-appeal {charge_id_overtime} --reject",
            f"驳回申诉 {charge_id_overtime}"
        )

        run_cmd(f"{base_cmd} bill M003", "查看申诉后的会员 M003 账单")

    run_cmd(f"{base_cmd} recalculate", "重新计算所有费用")

    run_cmd(
        f"{base_cmd} export-weekly --start 2026-05-04 --end 2026-05-10 --output {data_dir}/weekly_report.csv",
        "导出周报到 CSV"
    )

    if os.path.exists(f"{data_dir}/weekly_report.csv"):
        print("\n[演示] 周报文件内容:")
        with open(f"{data_dir}/weekly_report.csv", "r", encoding="utf-8") as f:
            print(f.read())

    print("\n" + "="*60)
    print("[演示完成] 所有功能已演示完毕!")
    print("="*60)


if __name__ == "__main__":
    main()
