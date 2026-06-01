#!/usr/bin/env python3
import os
from pathlib import Path

from rhythm_book import RhythmErrorBook
from exporter import ReportExporter


def run_demo():
    print("=" * 60)
    print("      音乐课节奏错题本 - 演示模式")
    print("=" * 60)
    print()

    db_path = Path(__file__).parent / "rhythm_error_book.db"
    if db_path.exists():
        print("检测到已有数据库，正在清理...")
        db_path.unlink()
        print("已清理旧数据")
        print()

    book = RhythmErrorBook()
    exporter = ReportExporter(book)

    print("【步骤1】批量导入音频文件...")
    sample_dir = Path(__file__).parent / "sample_audio"
    if sample_dir.exists():
        result = book.import_audio_directory(str(sample_dir), "6月第一批次")
        print(f"  导入完成: {result.success_count} 条成功, {result.failed_count} 条异常")
        if result.failed_files:
            print("  异常文件明细:")
            for f in result.failed_files:
                print(f"    - {f['file_name']}: {f['reason']}")
    else:
        print("  未找到sample_audio目录，跳过音频导入")
    print()

    print("【步骤2】导入曲目Excel...")
    csv_path = Path(__file__).parent / "sample_tracks.csv"
    if csv_path.exists():
        excel_result = book.import_from_excel_csv(str(csv_path), "2024年旧曲目库")
        print(f"  导入完成: {excel_result.success_count} 条成功")
    else:
        print("  未找到sample_tracks.csv，跳过Excel导入")
    print()

    records = book.get_all_records()
    if len(records) >= 2:
        print("【步骤3】阿蓝补录备注并更新状态...")
        target_record = records[1]
        print(f"  选择记录: #{target_record.id} - {target_record.track_name}")

        update_result = book.add_notes(
            target_record.id,
            "阿蓝: 与授权方确认，此文件为测试版本，正式版预计明日提供",
            "阿蓝"
        )
        if update_result.success:
            print("  已追加备注")

        resolve_result = book.resolve_issue(
            target_record.id,
            "等待正式版文件替换后重新导入",
            "阿蓝"
        )
        if resolve_result.success:
            print("  已标记处理")
            print(f"  变更详情:\n{book.format_changes_summary(resolve_result.changes)}")
    print()

    print("【步骤4】导出清单报告...")
    output_txt = Path(__file__).parent / "节奏错题本清单.txt"
    output_csv = Path(__file__).parent / "节奏错题本清单.csv"

    exporter.export_to_txt(str(output_txt))
    exporter.export_to_csv(str(output_csv))
    print(f"  已导出: {output_txt.name}")
    print(f"  已导出: {output_csv.name}")
    print()

    print("=" * 60)
    print("演示完成！下面是完整的错题本清单:")
    print("=" * 60)
    print()
    exporter.print_console_report()

    print()
    print("=" * 60)
    print("接下来可以执行:")
    print("  python cli.py list       查看清单")
    print("  python cli.py pending    查看待处理")
    print("  python cli.py export     导出报告")
    print("=" * 60)


if __name__ == "__main__":
    run_demo()
