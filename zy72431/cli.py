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
    elif cmd == "demo-report":
        run_demo_with_report(processor)
    elif cmd == "import":
        if len(sys.argv) < 3:
            print("  用法: python cli.py import <调音师留言文本>")
            return
        raw_text = sys.argv[2]
        record = processor.import_tuner_message(raw_text)
        print(f"  ✓ 导入成功: {record.band_name} {record.date} - {record.status.value}")
        if record.needs_review:
            print(f"    ⚠️  请假课时被算进已消耗，请巡演统筹复核")
    elif cmd == "supplement":
        if len(sys.argv) < 4:
            print("  用法: python cli.py supplement <record_id> <群接龙文本>")
            return
        record_id = sys.argv[2]
        raw_text = sys.argv[3]
        record = processor.supplement_group_signup(record_id, raw_text)
        if record:
            print(f"  ✓ 补录成功: {record.band_name} 曲目数: {len(record.song_list)}")
            print(f"    状态: {record.status.value}")
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
    elif cmd == "review":
        if len(sys.argv) < 5:
            print("  用法: python cli.py review <record_id> <approve|reject> <理由>")
            return
        record_id = sys.argv[2]
        decision = sys.argv[3]
        reason = sys.argv[4]
        operator = sys.argv[5] if len(sys.argv) > 5 else "巡演统筹"
        record = processor.review_record(record_id, decision, reason, operator)
        if record:
            result = "通过（计入消耗）" if decision == "approve" else "驳回（不计消耗）"
            print(f"  ✓ 复核完成: {record.band_name} - {result}")
            print(f"    理由: {reason}")
        else:
            print("  ✗ 未找到记录或记录无需复核")
    elif cmd == "rerun":
        if len(sys.argv) < 3:
            print("  用法: python cli.py rerun <record_id>")
            return
        record_id = sys.argv[2]
        record = processor.rerun_record(record_id)
        if record:
            tag = "（仍待复核）" if record.needs_review else ""
            print(f"  ✓ 重跑完成: 第{record.run_count}次 {tag}")
        else:
            print("  ✗ 未找到记录")
    elif cmd == "list":
        records = processor.get_records_summary()
        for r in records:
            flag = " ⚠️待复核" if r['needs_review'] else ""
            print(f"  {r['id'][:8]}  {r['date']}  {r['band_name']:12}  {r['status_text']}{flag}")
    elif cmd == "detail":
        if len(sys.argv) < 3:
            print("  用法: python cli.py detail <record_id>")
            return
        record_id = sys.argv[2]
        detail = processor.get_record_detail(record_id)
        if not detail:
            print("  ✗ 未找到记录")
            return
        print(f"\n【{detail['band_name']}】{detail['date']}")
        print(f"  状态: {detail['status_text']}")
        print(f"  房间: {detail['room']}  时间: {detail['start_time']}-{detail['end_time']}")
        print(f"  课时: {detail['hours']}小时")
        print(f"  调音师: {detail['tuner_name']}")
        print(f"  请假: {'是' if detail['is_leave'] else '否'}")
        print(f"  已消耗: {'是' if detail['is_consumed'] else '否'}")
        print(f"  待复核: {'是 ⚠️' if detail['needs_review'] else '否'}")
        if detail['review_note']:
            print(f"  复核说明: {detail['review_note']}")
        if detail['review_reason']:
            print(f"  复核理由: {detail['review_reason']}")
            print(f"  复核人: {detail['reviewed_by']}")
        if detail['song_list']:
            print(f"  曲目: {', '.join(detail['song_list'])}")
        if detail['members']:
            print(f"  人员: {', '.join(detail['members'])}")
        print(f"  运行次数: 第{detail['run_count']}次")
        print()
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
    elif cmd == "report":
        report = processor.export_report_text()
        print(report)
    elif cmd == "export":
        filename = sys.argv[2] if len(sys.argv) > 2 else "report.txt"
        report = processor.export_report_text()
        with open(filename, 'w', encoding='utf-8') as f:
            f.write(report)
        print(f"  ✓ 报告已导出到 {filename}")
    else:
        print_help()


def run_demo(processor):
    load_demo_data(processor)
    print_demo_summary(processor)


def run_demo_with_report(processor):
    load_demo_data(processor)
    print_demo_summary(processor)
    print("\n" + "=" * 60)
    print("  生成统计报告...")
    print("=" * 60)
    print(processor.export_report_text())


def print_help():
    print("=" * 55)
    print("  音响租赁调音记录 - 命令行工具")
    print("=" * 55)
    print()
    print("  用法:")
    print("    python cli.py demo              # 运行完整演示流程")
    print("    python cli.py demo-report       # 演示 + 生成报告")
    print("    python cli.py import <文本>     # 导入调音师留言")
    print("    python cli.py supplement <id> <文本>  # 补录群接龙")
    print("    python cli.py correct <id> <json>     # 人工修正")
    print("    python cli.py review <id> <approve|reject> <理由> [操作人]")
    print("                                  # 巡演统筹复核")
    print("    python cli.py rerun <id>        # 重跑记录")
    print("    python cli.py list              # 列出所有记录")
    print("    python cli.py detail <id>       # 查看记录详情")
    print("    python cli.py songs [乐队名]    # 查看曲目核对表")
    print("    python cli.py logs [记录id]     # 查看操作日志")
    print("    python cli.py report            # 生成统计报告")
    print("    python cli.py export [文件名]   # 导出报告到文件")
    print()


if __name__ == "__main__":
    main()
