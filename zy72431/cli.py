#!/usr/bin/env python3
import sys
import json
from processor import RecordProcessor
from demo_data import load_demo_data, print_demo_summary


def main():
    processor = RecordProcessor()
    
    if len(sys.argv) < 2:
        print_help()
        return
    
    cmd = sys.argv[1]
    
    if cmd == "demo":
        run_demo(processor)
    elif cmd == "import":
        if len(sys.argv) < 3:
            print("  用法: python cli.py import <调音师留言文本>")
            return
        raw_text = sys.argv[2]
        record = processor.import_tuner_message(raw_text)
        print(f"  ✓ 导入成功: {record.band_name} {record.date} - {record.status.value}")
    elif cmd == "supplement":
        if len(sys.argv) < 4:
            print("  用法: python cli.py supplement <record_id> <群接龙文本>")
            return
        record_id = sys.argv[2]
        raw_text = sys.argv[3]
        record = processor.supplement_group_signup(record_id, raw_text)
        if record:
            print(f"  ✓ 补录成功: {record.band_name} 曲目数: {len(record.song_list)}")
        else:
            print("  ✗ 未找到记录")
    elif cmd == "correct":
        if len(sys.argv) < 4:
            print("  用法: python cli.py correct <record_id> <json格式修正内容>")
            return
        record_id = sys.argv[2]
        try:
            corrections = json.loads(sys.argv[3])
        except:
            print("  ✗ JSON格式错误")
            return
        record = processor.manual_correct(record_id, corrections)
        if record:
            print(f"  ✓ 修正成功: {record.band_name} 状态: {record.status.value}")
        else:
            print("  ✗ 未找到记录")
    elif cmd == "rerun":
        if len(sys.argv) < 3:
            print("  用法: python cli.py rerun <record_id>")
            return
        record_id = sys.argv[2]
        record = processor.rerun_record(record_id)
        if record:
            print(f"  ✓ 重跑完成: 第{record.run_count}次")
        else:
            print("  ✗ 未找到记录")
    elif cmd == "list":
        records = processor.get_records_summary()
        for r in records:
            flag = " ⚠️待复核" if r['needs_review'] else ""
            print(f"  {r['id'][:8]}  {r['date']}  {r['band_name']:12}  {r['status_text']}{flag}")
    elif cmd == "songs":
        band = sys.argv[2] if len(sys.argv) > 2 else None
        checklists = processor.get_song_checklist(band)
        current = ""
        for c in checklists:
            if c['band_name'] != current:
                current = c['band_name']
                print(f"\n【{current}】")
            icon = "✓" if c['actually_performed'] else "✗"
            print(f"  {icon} {c['song_name']} - {c['note']}")
    elif cmd == "logs":
        record_id = sys.argv[2] if len(sys.argv) > 2 else None
        logs = processor.get_logs(record_id)
        for log in logs:
            print(f"  [{log['timestamp'][11:19]}] {log['operator']}: {log['action']}")
            print(f"    {log['detail']}")
    else:
        print_help()


def run_demo(processor):
    load_demo_data(processor)
    print_demo_summary(processor)


def print_help():
    print("=" * 50)
    print("  音响租赁调音记录 - 命令行工具")
    print("=" * 50)
    print()
    print("  用法:")
    print("    python cli.py demo              # 运行完整演示流程")
    print("    python cli.py import <文本>     # 导入调音师留言")
    print("    python cli.py supplement <id> <文本>  # 补录群接龙")
    print("    python cli.py correct <id> <json>     # 人工修正")
    print("    python cli.py rerun <id>        # 重跑记录")
    print("    python cli.py list              # 列出所有记录")
    print("    python cli.py songs [乐队名]    # 查看曲目核对表")
    print("    python cli.py logs [记录id]     # 查看操作日志")
    print()


if __name__ == "__main__":
    main()
