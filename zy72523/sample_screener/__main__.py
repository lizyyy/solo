import argparse
import sys
import json
import csv
from pathlib import Path
from datetime import datetime

from .storage import Storage
from .processor import (
    create_session,
    import_model_outputs_from_json,
    import_manual_corrections_from_csv,
    add_review_note,
    update_sample_status,
    rerun_sample,
    get_samples_with_version_conflict,
    get_samples_pending_review
)
from .review_page import generate_review_page, generate_run_log
from .models import SampleStatus, NextAction
from . import demo_data


def cmd_init(args):
    storage = Storage()
    session = create_session(args.session_id)
    storage.save_session(session)
    print(f"✅ 已创建筛查会话：{session.session_id}")
    print(f"   数据路径：{storage.data_dir.absolute()}/sessions/{session.session_id}.json")


def cmd_import_model(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            data = json.load(f)
    else:
        data = demo_data.MODEL_OUTPUTS_V1
        print("ℹ️  使用内置演示数据（v1.0 模型输出）")
    imported = import_model_outputs_from_json(session, data)
    session.add_run_command(f"python -m sample_screener import-model {args.session_id}" + (f" --file {args.file}" if args.file else ""))
    storage.save_session(session)
    print(f"✅ 已导入 {len(imported)} 条模型输出")
    for sid in imported:
        sample = session.samples[sid]
        tag = " 🟡版本冲突" if sample.version_conflict else ""
        print(f"   - {sid}{tag}")


def cmd_import_corrections(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    if args.file:
        rows = []
        with open(args.file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    else:
        rows = demo_data.MANUAL_CORRECTIONS_CSV
        print("ℹ️  使用内置演示数据（人工改判表）")
    imported = import_manual_corrections_from_csv(session, rows)
    session.add_run_command(f"python -m sample_screener import-corrections {args.session_id}" + (f" --file {args.file}" if args.file else ""))
    storage.save_session(session)
    print(f"✅ 已补录 {len(imported)} 条人工改判")
    for sid in imported:
        print(f"   - {sid}")


def cmd_rerun(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    if args.sample_id not in session.samples:
        print(f"❌ 样本不存在：{args.sample_id}")
        sys.exit(1)
    ok = rerun_sample(
        session,
        sample_id=args.sample_id,
        new_model_version=args.model_version,
        new_conclusion=args.conclusion,
        confidence=args.confidence,
        raw_fragment=args.raw_fragment or ""
    )
    if ok:
        session.add_run_command(
            f"python -m sample_screener rerun {args.session_id} {args.sample_id} "
            f"--model-version {args.model_version} --conclusion \"{args.conclusion}\""
        )
        storage.save_session(session)
        print(f"✅ 已对 {args.sample_id} 重跑模型（{args.model_version}）")
    else:
        print("❌ 重跑失败")


def cmd_note(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    ok = add_review_note(session, args.sample_id, args.reviewer, args.note, args.tag)
    if ok:
        storage.save_session(session)
        print(f"✅ 已添加复核笔记到 {args.sample_id}")
    else:
        print("❌ 添加失败")


def cmd_list(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    samples = list(session.samples.values())
    if args.status:
        status_map = {
            "pending": SampleStatus.PENDING_REVIEW,
            "normal": SampleStatus.NORMAL,
            "low": SampleStatus.LOW_QUALITY,
            "info": SampleStatus.NEED_MORE_INFO,
            "resolved": SampleStatus.RESOLVED
        }
        target = status_map.get(args.status)
        if target:
            samples = [s for s in samples if s.status == target]
    if args.conflict:
        samples = [s for s in samples if s.version_conflict]
    print(f"📋 会话 {args.session_id} - 共 {len(samples)} 条样本")
    print("")
    for s in samples:
        conflict_tag = "🟡 " if s.version_conflict else ""
        print(f"{conflict_tag}{s.sample_id} | {s.status.value} | {s.next_action.value if s.next_action else '无下一步'}")
        if s.keep_reason:
            print(f"     留下原因：{s.keep_reason}")


def cmd_review(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    content = generate_review_page(session)
    if args.output:
        out_path = storage.save_export(args.session_id, args.output, content)
        print(f"✅ 复盘页已保存：{out_path}")
    else:
        print(content)


def cmd_demo(args):
    print("🎬 运行完整演示流程...")
    print("")
    storage = Storage()
    session_id = args.session_id or "demo_001"
    session = create_session(session_id)
    print("=" * 60)
    print("【第一步】导入 v1.0 模型输出片段")
    print("=" * 60)
    imported = import_model_outputs_from_json(session, demo_data.MODEL_OUTPUTS_V1)
    session.add_run_command("python -m sample_screener import-model demo_001")
    print(f"✅ 导入了 {len(imported)} 条模型输出（v1.0）")
    for sid in imported:
        print(f"   - {sid}")
    print("")
    storage.save_session(session)
    print("=" * 60)
    print("【第二步】算法运营老唐补看群里的人工改判表")
    print("=" * 60)
    corrected = import_manual_corrections_from_csv(session, demo_data.MANUAL_CORRECTIONS_CSV)
    session.add_run_command("python -m sample_screener import-corrections demo_001")
    print(f"✅ 补录了 {len(corrected)} 条人工改判")
    for sid in corrected:
        print(f"   - {sid}: 老唐重新看过了")
    print("")
    storage.save_session(session)
    add_review_note(session, "SAMPLE-002", "老唐", "看了原始对话，用户没说具体型号，标注空着是对的，不能算低质", "复核通过")
    add_review_note(session, "SAMPLE-003", "老唐", "确认标注错了，维持低质结论", "维持原判")
    storage.save_session(session)
    print("=" * 60)
    print("【第三步】导入 v1.1 模型输出 - 注意 SAMPLE-001 编号没变")
    print("=" * 60)
    imported_v2 = import_model_outputs_from_json(session, demo_data.MODEL_OUTPUTS_V2)
    session.add_run_command("python -m sample_screener import-model demo_001")
    print(f"✅ 导入了 {len(imported_v2)} 条模型输出（v1.1）")
    for sid in imported_v2:
        sample = session.samples[sid]
        if sample.version_conflict:
            print(f"   ⚠️  {sid}: 模型版本换了（v1.0→v1.1）但样本编号没变，留待运营复核人确认")
        else:
            print(f"   - {sid}")
    print("")
    storage.save_session(session)
    print("=" * 60)
    print("【第四步】对 SAMPLE-001 重跑一次模型（v1.2-fix）")
    print("=" * 60)
    rerun_data = demo_data.RERUN_OUTPUTS[0]
    rerun_sample(
        session,
        sample_id="SAMPLE-001",
        new_model_version=rerun_data["model_version"],
        new_conclusion=rerun_data["conclusion"],
        confidence=rerun_data["confidence"],
        raw_fragment=rerun_data["raw_fragment"]
    )
    session.add_run_command("python -m sample_screener rerun demo_001 SAMPLE-001 --model-version v1.2-fix --conclusion \"待人工确认 - 边界情况\"")
    print(f"✅ SAMPLE-001 已重跑（v1.2-fix）")
    print("")
    storage.save_session(session)
    print("=" * 60)
    print("【第五步】生成产品复盘页")
    print("=" * 60)
    content = generate_review_page(session)
    log_content = generate_run_log(session)
    review_path = storage.save_export(session_id, "复盘页.md", content)
    log_path = storage.save_export(session_id, "执行记录.md", log_content)
    print(f"✅ 产品复盘页：{review_path}")
    print(f"✅ 执行记录：{log_path}")
    print("")
    print("🎉 演示完成！")
    print("")
    print("📌 查看复盘页：")
    print(f"   cat {review_path}")
    print("")
    print("📌 重新加载会话：")
    print(f"   python -m sample_screener load {session_id}")


def cmd_load(args):
    storage = Storage()
    session = storage.load_session(args.session_id)
    if not session:
        print(f"❌ 会话不存在：{args.session_id}")
        sys.exit(1)
    print(f"📦 会话：{session.session_id}")
    print(f"   创建时间：{session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   样本数：{len(session.samples)}")
    version_conflicts = sum(1 for s in session.samples.values() if s.version_conflict)
    print(f"   版本冲突：{version_conflicts}")
    pending = sum(1 for s in session.samples.values() if s.status == SampleStatus.PENDING_REVIEW)
    print(f"   待复核：{pending}")
    if session.run_commands:
        print("")
        print("   执行过的命令：")
        for cmd in session.run_commands:
            print(f"   $ {cmd}")


def cmd_sessions(args):
    storage = Storage()
    sessions = storage.list_sessions()
    if not sessions:
        print("暂无会话")
        return
    print(f"共 {len(sessions)} 个会话：")
    for sid in sessions:
        session = storage.load_session(sid)
        if session:
            print(f"  {sid} | {len(session.samples)}条样本 | {session.created_at.strftime('%Y-%m-%d %H:%M')}")


def main():
    parser = argparse.ArgumentParser(
        prog="sample-screener",
        description="低质标注样本筛查 - 不是冷冰冰的系统日志，是能闭环的工作记录"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_init = subparsers.add_parser("init", help="创建新的筛查会话")
    p_init.add_argument("session_id", nargs="?", help="会话ID（可选）")
    p_init.set_defaults(func=cmd_init)

    p_import_model = subparsers.add_parser("import-model", help="导入模型输出片段")
    p_import_model.add_argument("session_id", help="会话ID")
    p_import_model.add_argument("--file", help="模型输出 JSON 文件路径")
    p_import_model.set_defaults(func=cmd_import_model)

    p_import_corr = subparsers.add_parser("import-corrections", help="补录人工改判表")
    p_import_corr.add_argument("session_id", help="会话ID")
    p_import_corr.add_argument("--file", help="人工改判 CSV 文件路径")
    p_import_corr.set_defaults(func=cmd_import_corrections)

    p_rerun = subparsers.add_parser("rerun", help="对单条样本重跑模型")
    p_rerun.add_argument("session_id", help="会话ID")
    p_rerun.add_argument("sample_id", help="样本编号")
    p_rerun.add_argument("--model-version", required=True, help="新模型版本")
    p_rerun.add_argument("--conclusion", required=True, help="新结论")
    p_rerun.add_argument("--confidence", type=float, default=0.0, help="置信度")
    p_rerun.add_argument("--raw-fragment", help="原始输出片段")
    p_rerun.set_defaults(func=cmd_rerun)

    p_note = subparsers.add_parser("note", help="添加复核笔记")
    p_note.add_argument("session_id", help="会话ID")
    p_note.add_argument("sample_id", help="样本编号")
    p_note.add_argument("--reviewer", required=True, help="复核人")
    p_note.add_argument("--note", required=True, help="笔记内容")
    p_note.add_argument("--tag", help="标签")
    p_note.set_defaults(func=cmd_note)

    p_list = subparsers.add_parser("list", help="列出样本")
    p_list.add_argument("session_id", help="会话ID")
    p_list.add_argument("--status", help="按状态过滤: pending/normal/low/info/resolved")
    p_list.add_argument("--conflict", action="store_true", help="只看版本冲突的")
    p_list.set_defaults(func=cmd_list)

    p_review = subparsers.add_parser("review", help="生成产品复盘页")
    p_review.add_argument("session_id", help="会话ID")
    p_review.add_argument("--output", help="输出文件名（默认为打印到终端）")
    p_review.set_defaults(func=cmd_review)

    p_demo = subparsers.add_parser("demo", help="运行完整演示流程")
    p_demo.add_argument("session_id", nargs="?", help="演示会话ID")
    p_demo.set_defaults(func=cmd_demo)

    p_load = subparsers.add_parser("load", help="加载并查看会话")
    p_load.add_argument("session_id", help="会话ID")
    p_load.set_defaults(func=cmd_load)

    p_sessions = subparsers.add_parser("sessions", help="列出所有会话")
    p_sessions.set_defaults(func=cmd_sessions)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
