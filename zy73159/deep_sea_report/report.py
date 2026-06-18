"""报告输出模块 - 终端摘要与截图说明分离."""

import os
import csv
from typing import List, Dict
from .models import SamplingRecord, RecordStatus


def print_terminal_summary(records: List[SamplingRecord],
                           input_dir: str,
                           output_dir: str) -> None:
    """打印终端摘要（简洁，只给关键数字）."""
    total = len(records)
    confirmed = sum(1 for r in records if r.status == RecordStatus.CONFIRMED)
    pending = sum(1 for r in records if r.status == RecordStatus.PENDING)
    returned = sum(1 for r in records if r.status == RecordStatus.RETURNED)

    reversed_count = sum(1 for r in records if r.lat_lon_reversed)
    issue_count = sum(1 for r in records if r.coordinate_issues)

    print("=" * 60)
    print("  深海采样报告汇总 - 终端摘要")
    print("=" * 60)
    print(f"  输入目录: {input_dir}")
    print(f"  输出目录: {output_dir}")
    print("-" * 60)
    print(f"  总记录数:  {total}")
    print(f"  已确认:    {confirmed}")
    print(f"  待补件:    {pending}")
    print(f"  退回:      {returned}")
    print("-" * 60)
    print(f"  经纬度反写: {reversed_count} 条")
    print(f"  含问题记录: {issue_count} 条")
    print("=" * 60)
    print()
    print("  详细内容请查看输出目录中的文件:")
    print("    - summary_report.csv     汇总报表")
    print("    - screenshot_notes.txt   截图说明")
    print("    - raw_records_with_issues.json  带原始数据的完整记录")
    print("    - report_state.json      状态存档（重跑时保留备注）")
    print()


def write_screenshot_notes(output_dir: str,
                           records: List[SamplingRecord]) -> None:
    """写入截图说明文件（单独文件，不与终端摘要混）.

    截图说明内容: 每条记录的问题详情、来源行号、状态判定依据等。
    港口工程师老何复核时对着截图看这份说明就行。
    """
    os.makedirs(output_dir, exist_ok=True)
    notes_path = os.path.join(output_dir, "screenshot_notes.txt")

    with open(notes_path, 'w', encoding='utf-8') as f:
        f.write("=" * 70 + "\n")
        f.write("  深海采样报告 - 截图说明（复核专用）\n")
        f.write("=" * 70 + "\n\n")

        by_status: Dict[str, List[SamplingRecord]] = {}
        for r in records:
            status_val = r.status.value if hasattr(r.status, 'value') else r.status
            by_status.setdefault(status_val, []).append(r)

        for status_name in ["已确认", "待补件", "退回"]:
            status_records = by_status.get(status_name, [])
            f.write(f"【{status_name}】 共 {len(status_records)} 条\n")
            f.write("-" * 70 + "\n")

            for i, record in enumerate(status_records, 1):
                f.write(f"\n  第 {i} 条 - {record.record_id}\n")
                f.write(f"    来源文件: {record.source_file} 第 {record.source_line} 行\n")
                f.write(f"    原始内容: {record.raw_content}\n")

                if record.station_name:
                    f.write(f"    站点: {record.station_name}\n")
                if record.sample_time:
                    f.write(f"    时间: {record.sample_time}\n")
                if record.raw_latitude:
                    f.write(f"    原始纬度: {record.raw_latitude}\n")
                if record.raw_longitude:
                    f.write(f"    原始经度: {record.raw_longitude}\n")
                if record.latitude is not None:
                    f.write(f"    解析纬度: {record.latitude}\n")
                if record.longitude is not None:
                    f.write(f"    解析经度: {record.longitude}\n")

                if record.lat_lon_reversed:
                    f.write(f"    ⚠ 经纬度疑似反写\n")

                if record.coordinate_issues:
                    f.write(f"    问题列表:\n")
                    for issue in record.coordinate_issues:
                        f.write(f"      - [{issue.issue_type}] {issue.description}\n")
                        f.write(f"        原始值: {issue.raw_value}\n")

                if record.notes:
                    f.write(f"    备注: {record.notes}\n")

                if record.screenshot_note:
                    f.write(f"    截图说明: {record.screenshot_note}\n")

                f.write("\n")

            f.write("\n")

        f.write("=" * 70 + "\n")
        f.write("  说明: 本文件用于截图复核，保留原始数据痕迹，不做自动修正。\n")
        f.write("=" * 70 + "\n")


def write_summary_csv(output_dir: str,
                      records: List[SamplingRecord]) -> None:
    """写入汇总CSV报表."""
    os.makedirs(output_dir, exist_ok=True)
    csv_path = os.path.join(output_dir, "summary_report.csv")

    fieldnames = [
        "记录编号", "状态", "来源文件", "来源行号",
        "站点名称", "采样时间",
        "原始纬度", "原始经度",
        "解析纬度", "解析经度",
        "经纬度反写", "深度", "温度", "盐度",
        "问题数量", "备注",
    ]

    with open(csv_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for record in records:
            writer.writerow({
                "记录编号": record.record_id,
                "状态": record.status.value if hasattr(record.status, 'value') else record.status,
                "来源文件": record.source_file,
                "来源行号": record.source_line,
                "站点名称": record.station_name or "",
                "采样时间": record.sample_time or "",
                "原始纬度": record.raw_latitude or "",
                "原始经度": record.raw_longitude or "",
                "解析纬度": record.latitude if record.latitude is not None else "",
                "解析经度": record.longitude if record.longitude is not None else "",
                "经纬度反写": "是" if record.lat_lon_reversed else "否",
                "深度": record.depth if record.depth is not None else "",
                "温度": record.temperature if record.temperature is not None else "",
                "盐度": record.salinity if record.salinity is not None else "",
                "问题数量": len(record.coordinate_issues),
                "备注": record.notes or "",
            })
