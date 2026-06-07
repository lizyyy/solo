#!/usr/bin/env python3
import json
import argparse
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional
from models import ComplaintRecord, ProcessingRun
from scoring import (
    calculate_score,
    apply_ramp_supplement,
    apply_photo_supplement,
    review_confirm,
    finalize_record
)

DATA_DIR = "data"
RUNS_DIR = os.path.join(DATA_DIR, "runs")
RECORDS_FILE = os.path.join(DATA_DIR, "records.json")


def ensure_dirs():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(RUNS_DIR, exist_ok=True)


def load_records() -> Dict[str, ComplaintRecord]:
    ensure_dirs()
    if not os.path.exists(RECORDS_FILE):
        return {}
    with open(RECORDS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {cid: ComplaintRecord.from_dict(rec) for cid, rec in data.items()}


def save_records(records: Dict[str, ComplaintRecord]):
    ensure_dirs()
    data = {cid: rec.to_dict() for cid, rec in records.items()}
    with open(RECORDS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_run(run: ProcessingRun):
    ensure_dirs()
    run_file = os.path.join(RUNS_DIR, f"run_{run.run_id}.json")
    with open(run_file, "w", encoding="utf-8") as f:
        json.dump(run.to_dict(), f, ensure_ascii=False, indent=2)


def load_runs() -> List[ProcessingRun]:
    ensure_dirs()
    runs = []
    for fname in os.listdir(RUNS_DIR):
        if fname.startswith("run_") and fname.endswith(".json"):
            with open(os.path.join(RUNS_DIR, fname), "r", encoding="utf-8") as f:
                data = json.load(f)
                runs.append(ProcessingRun(**data))
    return sorted(runs, key=lambda r: r.run_time)


def import_records(file_path: str, command_str: str) -> str:
    records = load_records()
    changes = []

    with open(file_path, "r", encoding="utf-8") as f:
        input_data = json.load(f)

    for item in input_data:
        cid = item["complaint_id"]
        scenario = item.pop("_demo_scenario", "")
        if cid in records:
            print(f"[跳过] 记录 {cid} 已存在")
            continue

        record = ComplaintRecord(
            complaint_id=cid,
            location=item["location"],
            photo_urls=item.get("photo_urls", []),
            photo_remarks=item.get("photo_remarks", "")
        )
        record.add_log("system", "import", f"从 {file_path} 导入，场景：{scenario}")

        score, suggestions, _, _ = calculate_score(record)
        record.initial_score = score
        record.current_score = score
        record.suggestions = suggestions
        record.status = "imported"
        record.add_log("system", "initial_score", f"初始评分：{score}")

        records[cid] = record
        changes.append({
            "complaint_id": cid,
            "action": "import",
            "initial_score": score,
            "scenario": scenario
        })
        print(f"[导入] {cid} - {record.location} - 初始评分：{score}")

    save_records(records)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run = ProcessingRun(
        run_id=run_id,
        run_time=datetime.now().isoformat(),
        records_processed=[c["complaint_id"] for c in changes],
        changes_made=changes,
        run_command=command_str
    )
    save_run(run)

    return run_id


def supplement_ramp(complaint_id: str, ramp_exist: bool, ramp_remarks: str, command_str: str) -> str:
    records = load_records()
    if complaint_id not in records:
        print(f"[错误] 记录 {complaint_id} 不存在")
        sys.exit(1)

    record = records[complaint_id]
    old_score = record.current_score
    record = apply_ramp_supplement(record, ramp_exist, ramp_remarks)
    new_score = record.current_score

    print(f"[坡道补录] {complaint_id}")
    print(f"  原评分：{old_score} → 新评分：{new_score}")
    if record.review_needed:
        print(f"  ⚠️  评分变化不明显，需人工复核")
    for i, sug in enumerate(record.suggestions, 1):
        print(f"  建议{i}: {sug}")

    records[complaint_id] = record
    save_records(records)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run = ProcessingRun(
        run_id=run_id,
        run_time=datetime.now().isoformat(),
        records_processed=[complaint_id],
        changes_made=[{
            "complaint_id": complaint_id,
            "action": "ramp_supplement",
            "ramp_exist": ramp_exist,
            "ramp_remarks": ramp_remarks,
            "old_score": old_score,
            "new_score": new_score,
            "review_needed": record.review_needed
        }],
        run_command=command_str
    )
    save_run(run)

    return run_id


def supplement_photo(complaint_id: str, photo_remarks: str, photo_urls: Optional[str], command_str: str) -> str:
    records = load_records()
    if complaint_id not in records:
        print(f"[错误] 记录 {complaint_id} 不存在")
        sys.exit(1)

    record = records[complaint_id]
    old_suggestions = record.suggestions.copy()
    urls = photo_urls.split(",") if photo_urls else None
    record = apply_photo_supplement(record, photo_remarks, urls)

    print(f"[照片补录] {complaint_id}")
    print(f"  操作人：老马")
    print(f"  备注：{photo_remarks}")
    print(f"  当前评分：{record.current_score}")
    if record.old_caliber_applied:
        print(f"  📌 检测到旧口径关键词，已按历史标准处理")
    new_sugs = [s for s in record.suggestions if s not in old_suggestions]
    if new_sugs:
        print(f"  新增整改建议：")
        for sug in new_sugs:
            print(f"    - {sug}")

    records[complaint_id] = record
    save_records(records)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run = ProcessingRun(
        run_id=run_id,
        run_time=datetime.now().isoformat(),
        records_processed=[complaint_id],
        changes_made=[{
            "complaint_id": complaint_id,
            "action": "photo_supplement",
            "photo_remarks": photo_remarks,
            "new_score": record.current_score,
            "old_caliber_applied": record.old_caliber_applied,
            "new_suggestions": new_sugs
        }],
        run_command=command_str
    )
    save_run(run)

    return run_id


def review_record(complaint_id: str, reviewer: str, command_str: str) -> str:
    records = load_records()
    if complaint_id not in records:
        print(f"[错误] 记录 {complaint_id} 不存在")
        sys.exit(1)

    record = records[complaint_id]
    if not record.review_needed:
        print(f"[提示] 记录 {complaint_id} 无需复核")

    record = review_confirm(record, reviewer)
    print(f"[复核通过] {complaint_id} - 复核人：{reviewer}")

    records[complaint_id] = record
    save_records(records)

    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    run = ProcessingRun(
        run_id=run_id,
        run_time=datetime.now().isoformat(),
        records_processed=[complaint_id],
        changes_made=[{
            "complaint_id": complaint_id,
            "action": "review_confirm",
            "reviewer": reviewer
        }],
        run_command=command_str
    )
    save_run(run)

    return run_id


def show_record(complaint_id: str):
    records = load_records()
    if complaint_id not in records:
        print(f"[错误] 记录 {complaint_id} 不存在")
        sys.exit(1)

    rec = records[complaint_id]
    print(f"\n{'='*60}")
    print(f"投诉编号：{rec.complaint_id}")
    print(f"地点：{rec.location}")
    print(f"状态：{rec.status}")
    print(f"初始评分：{rec.initial_score}")
    print(f"当前评分：{rec.current_score}")
    print(f"照片备注：{rec.photo_remarks or '(空)'}")
    print(f"坡道：{'存在' if rec.ramp_exist else '不存在' if rec.ramp_exist is False else '未确认'}")
    print(f"坡道备注：{rec.ramp_remarks or '(空)'}")
    print(f"需复核：{'是' if rec.review_needed else '否'}")
    print(f"旧口径：{'是' if rec.old_caliber_applied else '否'}")
    print(f"版本：{rec.version}")
    print(f"\n整改建议：")
    for i, s in enumerate(rec.suggestions, 1):
        print(f"  {i}. {s}")
    print(f"\n操作日志：")
    for log in rec.operation_log:
        print(f"  [{log['timestamp']}] {log['operator']} - {log['action']}")
        if log['details']:
            print(f"      {log['details']}")
    print(f"{'='*60}\n")


def list_records():
    records = load_records()
    if not records:
        print("暂无记录")
        return

    print(f"{'编号':<12} {'地点':<30} {'状态':<18} {'评分':<6} {'复核':<6} {'旧口径':<6}")
    print("-" * 80)
    for rec in sorted(records.values(), key=lambda r: r.complaint_id):
        status_map = {
            "new": "新建",
            "imported": "已导入",
            "ramp_supplemented": "坡道已补录",
            "photo_supplemented": "照片已补录",
            "reviewed": "已复核",
            "finalized": "已结案"
        }
        status_cn = status_map.get(rec.status, rec.status)
        print(f"{rec.complaint_id:<12} {rec.location[:28]:<30} {status_cn:<18} {rec.current_score:<6} "
              f"{'是' if rec.review_needed else '否':<6} {'是' if rec.old_caliber_applied else '否':<6}")


def show_review():
    records = load_records()
    need_review = [r for r in records.values() if r.review_needed]
    if not need_review:
        print("当前没有需要复核的记录")
        return

    print(f"需要复核的记录 ({len(need_review)} 条)：")
    for rec in need_review:
        print(f"  - {rec.complaint_id}: {rec.location} (评分: {rec.current_score})")


def show_runs():
    runs = load_runs()
    if not runs:
        print("暂无运行记录")
        return

    print(f"{'运行ID':<20} {'时间':<25} {'处理记录数':<10}")
    print("-" * 60)
    for run in runs:
        print(f"{run.run_id:<20} {run.run_time[:19]:<25} {len(run.records_processed):<10}")


def replay_run(run_id: str):
    runs = load_runs()
    target = None
    for r in runs:
        if r.run_id == run_id:
            target = r
            break

    if not target:
        print(f"[错误] 找不到运行记录 {run_id}")
        sys.exit(1)

    print(f"\n=== 复盘运行 {run_id} ===")
    print(f"时间：{target.run_time}")
    print(f"原命令：{target.run_command}")
    print(f"处理记录：{', '.join(target.records_processed)}")
    print(f"\n变更明细：")
    for change in target.changes_made:
        print(f"  - {change.get('complaint_id', '')}: {change.get('action', '')}")
        for k, v in change.items():
            if k not in ('complaint_id', 'action'):
                print(f"      {k}: {v}")
    print()


def run_demo():
    print("\n" + "="*60)
    print("  邮政快递柜布点 - 演示流程")
    print("="*60)

    commands = []

    print("\n【第一步】导入居民投诉记录")
    print("-" * 40)
    cmd1 = "python3 post_cabinet.py import demo_data.json"
    commands.append(cmd1)
    print(f"$ {cmd1}")
    os.system(cmd1)

    print("\n【查看导入后的记录列表】")
    print("-" * 40)
    cmd_list = "python3 post_cabinet.py list"
    os.system(cmd_list)

    print("\n【第二步】坡道补录 - TS2024002")
    print("-" * 40)
    print("(补录坡道存在，但评分变化不大，触发复核)")
    cmd2 = "python3 post_cabinet.py ramp TS2024002 --exist --remarks '坡道存在，但表面损坏严重、无扶手、坡度过陡'"
    commands.append(cmd2)
    print(f"$ {cmd2}")
    os.system(cmd2)

    print("\n【查看待复核列表】")
    print("-" * 40)
    cmd_review_list = "python3 post_cabinet.py review --list"
    os.system(cmd_review_list)

    print("\n【第三步】交通协管老马补看路口照片 - TS2024003")
    print("-" * 40)
    print("(补录照片备注，包含旧口径关键词)")
    cmd3 = ('python3 post_cabinet.py photo TS2024003 '
            '--remarks "此路口为2019年历史遗留点位，按旧口径处理，现场有台阶但属于老城区改造范围" '
            '--urls "photo_003_3.jpg,photo_003_4.jpg"')
    commands.append(cmd3)
    print(f"$ {cmd3}")
    os.system(cmd3)

    print("\n【老马复核 TS2024002】")
    print("-" * 40)
    cmd4 = "python3 post_cabinet.py review TS2024002 --reviewer 老马"
    commands.append(cmd4)
    print(f"$ {cmd4}")
    os.system(cmd4)

    print("\n【最终记录一览】")
    print("-" * 40)
    os.system(cmd_list)

    print("\n【查看 TS2024002 详情 - 坡道补录后评分无变化案例】")
    print("-" * 40)
    os.system("python3 post_cabinet.py show TS2024002")

    print("\n【查看 TS2024003 详情 - 旧口径案例】")
    print("-" * 40)
    os.system("python3 post_cabinet.py show TS2024003")

    print("\n【查看运行历史】")
    print("-" * 40)
    os.system("python3 post_cabinet.py runs")

    print("\n" + "="*60)
    print("  演示完成！可重新运行的命令：")
    print("="*60)
    for i, cmd in enumerate(commands, 1):
        print(f"  {i}. {cmd}")
    print("\n  复盘最近一次运行：")
    print(f"     python3 post_cabinet.py replay <run_id>")
    print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="邮政快递柜布点 - 路口照片与整改管理系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    import_parser = subparsers.add_parser("import", help="导入投诉记录")
    import_parser.add_argument("file", help="JSON数据文件路径")

    ramp_parser = subparsers.add_parser("ramp", help="补录坡道信息")
    ramp_parser.add_argument("complaint_id", help="投诉编号")
    ramp_parser.add_argument("--exist", action="store_true", help="坡道存在")
    ramp_parser.add_argument("--no-exist", action="store_true", help="坡道不存在")
    ramp_parser.add_argument("--remarks", default="", help="坡道备注")

    photo_parser = subparsers.add_parser("photo", help="补录照片备注")
    photo_parser.add_argument("complaint_id", help="投诉编号")
    photo_parser.add_argument("--remarks", required=True, help="照片备注内容")
    photo_parser.add_argument("--urls", default=None, help="照片URL，逗号分隔")

    review_parser = subparsers.add_parser("review", help="人工复核")
    review_parser.add_argument("complaint_id", nargs="?", help="投诉编号")
    review_parser.add_argument("--list", action="store_true", help="列出待复核记录")
    review_parser.add_argument("--reviewer", default="老马", help="复核人")

    subparsers.add_parser("list", help="列出所有记录")

    show_parser = subparsers.add_parser("show", help="查看记录详情")
    show_parser.add_argument("complaint_id", help="投诉编号")

    subparsers.add_parser("runs", help="查看运行历史")

    replay_parser = subparsers.add_parser("replay", help="复盘运行记录")
    replay_parser.add_argument("run_id", help="运行ID")

    subparsers.add_parser("demo", help="运行完整演示流程")

    args = parser.parse_args()
    command_str = " ".join(sys.argv)

    if args.command == "import":
        import_records(args.file, command_str)
    elif args.command == "ramp":
        ramp_exist = args.exist if args.exist else not args.no_exist
        supplement_ramp(args.complaint_id, ramp_exist, args.remarks, command_str)
    elif args.command == "photo":
        supplement_photo(args.complaint_id, args.remarks, args.urls, command_str)
    elif args.command == "review":
        if args.list:
            show_review()
        elif args.complaint_id:
            review_record(args.complaint_id, args.reviewer, command_str)
        else:
            review_parser.print_help()
    elif args.command == "list":
        list_records()
    elif args.command == "show":
        show_record(args.complaint_id)
    elif args.command == "runs":
        show_runs()
    elif args.command == "replay":
        replay_run(args.run_id)
    elif args.command == "demo":
        run_demo()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
