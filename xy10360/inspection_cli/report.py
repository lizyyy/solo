"""报告导出模块"""

import csv
from datetime import datetime
from io import StringIO
from typing import List

from .models import InspectionResult, ScanRecord, ValidationError


def format_datetime(dt) -> str:
    if not dt:
        return "-"
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    return str(dt)


def generate_text_report(
    results: List[InspectionResult],
    errors: List[ValidationError],
    abnormal_records: List[ScanRecord],
) -> str:
    output = StringIO()
    output.write("=" * 80 + "\n")
    output.write("设备巡检报告\n")
    output.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    output.write("=" * 80 + "\n\n")

    output.write("一、路线完成情况\n")
    output.write("-" * 80 + "\n")

    for result in results:
        output.write(f"\n【路线】{result.route_name} ({result.route_id})\n")
        output.write(f"  负责人: {result.inspector or '未分配'}\n")
        output.write(f"  班次时间: {format_datetime(result.shift_start)} 至 {format_datetime(result.shift_end)}\n")
        output.write(f"  状态: {result.status}\n")
        output.write(f"  进度: {result.completed_points}/{result.total_points}\n")

        if result.missing_points:
            output.write(f"  漏检点位 ({len(result.missing_points)}):\n")
            for mp in result.missing_points:
                output.write(f"    - {mp}\n")

        if result.abnormal_points:
            output.write(f"  异常点位 ({len(result.abnormal_points)}):\n")
            for ap in result.abnormal_points:
                output.write(f"    - {ap}\n")

        if result.need_review:
            output.write(f"  需要班长复核 ({len(result.need_review)}):\n")
            for nr in result.need_review:
                output.write(f"    - {nr}\n")

    output.write("\n" + "=" * 80 + "\n")
    output.write("二、校验错误\n")
    output.write("-" * 80 + "\n")

    if errors:
        for err in errors:
            output.write(f"\n【错误】{err.error_type}\n")
            output.write(f"  路线: {err.route_id}\n")
            output.write(f"  点位: {err.point_name} ({err.point_id})\n")
            output.write(f"  记录: {err.record_id or '-'}\n")
            output.write(f"  时间: {format_datetime(err.scan_time)}\n")
            output.write(f"  说明: {err.message}\n")
    else:
        output.write("\n  无校验错误\n")

    output.write("\n" + "=" * 80 + "\n")
    output.write("三、异常巡检记录\n")
    output.write("-" * 80 + "\n")

    if abnormal_records:
        for record in abnormal_records:
            output.write(f"\n  点位ID: {record.point_id}\n")
            output.write(f"  记录ID: {record.record_id}\n")
            output.write(f"  时间: {format_datetime(record.scan_time)}\n")
            output.write(f"  来源: {record.source.value}\n")
            output.write(f"  巡检人: {record.inspector or '-'}\n")
            output.write(f"  备注: {record.remark or '【无备注 - 需补录】'}\n")
    else:
        output.write("\n  无异常记录\n")

    output.write("\n" + "=" * 80 + "\n")
    output.write("报告结束\n")

    return output.getvalue()


def export_csv_report(
    results: List[InspectionResult],
    errors: List[ValidationError],
    abnormal_records: List[ScanRecord],
    output_path: str,
) -> None:
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)

        writer.writerow(["=" * 60])
        writer.writerow(["设备巡检报告"])
        writer.writerow(["生成时间", datetime.now().strftime("%Y-%m-%d %H:%M:%S")])
        writer.writerow(["=" * 60])
        writer.writerow([])

        writer.writerow(["一、路线完成情况"])
        writer.writerow(
            [
                "路线ID",
                "路线名称",
                "负责人",
                "班次开始",
                "班次结束",
                "总点位",
                "已完成",
                "状态",
                "漏检点位",
                "异常点位",
                "需复核点位",
            ]
        )
        for result in results:
            writer.writerow(
                [
                    result.route_id,
                    result.route_name,
                    result.inspector or "",
                    format_datetime(result.shift_start),
                    format_datetime(result.shift_end),
                    result.total_points,
                    result.completed_points,
                    result.status,
                    "; ".join(result.missing_points),
                    "; ".join(result.abnormal_points),
                    "; ".join(result.need_review),
                ]
            )
        writer.writerow([])

        writer.writerow(["二、校验错误"])
        if errors:
            writer.writerow(
                [
                    "错误类型",
                    "路线ID",
                    "点位ID",
                    "点位名称",
                    "记录ID",
                    "时间",
                    "说明",
                ]
            )
            for err in errors:
                writer.writerow(
                    [
                        err.error_type,
                        err.route_id,
                        err.point_id,
                        err.point_name,
                        err.record_id or "",
                        format_datetime(err.scan_time),
                        err.message,
                    ]
                )
        else:
            writer.writerow(["无校验错误"])
        writer.writerow([])

        writer.writerow(["三、异常巡检记录"])
        if abnormal_records:
            writer.writerow(
                [
                    "点位ID",
                    "记录ID",
                    "时间",
                    "来源",
                    "巡检人",
                    "状态",
                    "备注",
                ]
            )
            for record in abnormal_records:
                writer.writerow(
                    [
                        record.point_id,
                        record.record_id,
                        format_datetime(record.scan_time),
                        record.source.value,
                        record.inspector or "",
                        record.status.value,
                        record.remark or "",
                    ]
                )
        else:
            writer.writerow(["无异常记录"])
