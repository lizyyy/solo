import argparse
import json
import sys
from typing import List, Optional
from fourier_noise.workflow import WorkflowEngine, WorkflowStep
from fourier_noise.demo_data import (
    get_demo_records,
    get_demo_teacher_annotations,
    get_demo_sampling_list,
    get_demo_manual_correction,
    get_demo_rerun_config,
)
from fourier_noise.models import RecordType, ReviewStatus


def _print_header(title: str):
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)


def _print_step_result(result: dict):
    step = result.get("step", "?")
    status = result.get("status", "?")
    print(f"\n▸ 步骤: {step}  状态: {status}")

    if "note" in result:
        print(f"  📌 {result['note']}")

    skip_keys = {"step", "status", "note"}
    for k, v in result.items():
        if k not in skip_keys:
            if isinstance(v, list) and len(v) > 5:
                print(f"  {k}: [{len(v)} items]")
            elif isinstance(v, dict):
                print(f"  {k}:")
                for sk, sv in v.items():
                    print(f"    {sk}: {sv}")
            else:
                print(f"  {k}: {v}")


def _print_report(report_dict: dict):
    _print_header("边界样本报告")
    print(f"  总记录数:       {report_dict['total_records']}")
    print(f"  正常记录:       {report_dict['normal_count']}")
    print(f"  负数→缺失:      {report_dict['negative_as_missing_count']}")
    print(f"  抽样名单补录:    {report_dict['supplemented_count']}")
    print(f"  待复核:         {report_dict['pending_review_count']}")
    print(f"  已确认:         {report_dict['confirmed_count']}")
    print(f"  已拒绝:         {report_dict['rejected_count']}")

    print("\n  ── 各记录详情 ──")
    for r in report_dict["records"]:
        rt = r["record_type"]
        rs = r["review_status"]
        marker = {"normal": "✅", "negative_as_missing": "⚠️ ", "supplemented_from_sampling": "📋"}.get(rt, "?")
        review_marker = {"pending": "⏳", "confirmed": "✔️ ", "rejected": "✖️ "}.get(rs, "?")

        line = f"  {marker} {review_marker} {r['id']}  值={r['value']}"
        if r.get("old_table_value") is not None:
            line += f"  旧表={r['old_table_value']}"
        else:
            line += "  旧表=缺失"
        if r.get("corrected_value") is not None:
            line += f"  修正={r['corrected_value']}"
        if r.get("teacher_annotation"):
            line += f"  批注='{r['teacher_annotation'][:20]}…'"
        if r.get("sampling_list_source"):
            line += f"  来源={r['sampling_list_source']}"
        print(line)

    print("\n  ── 三种处理结果对比 ──")
    normals = [r for r in report_dict["records"] if r["record_type"] == "normal"]
    negs = [r for r in report_dict["records"] if r["record_type"] == "negative_as_missing"]
    supps = [r for r in report_dict["records"] if r["record_type"] == "supplemented_from_sampling"]

    print(f"\n  ✅ 正常记录 ({len(normals)}条): 值与旧表一致，直接进入傅里叶拆解")
    for r in normals[:2]:
        print(f"     例: {r['id']} 值={r['value']}")

    print(f"\n  ⚠️  负数→缺失 ({len(negs)}条): 旧表丢弃负值，当前已标记待复核")
    for r in negs:
        review = r["review_status"]
        extra = ""
        if r.get("corrected_value") is not None:
            extra = f"→ 人工修正为 {r['corrected_value']}, 复核状态={review}"
        print(f"     例: {r['id']} 真值={r['value']} 旧表=缺失{extra}")

    print(f"\n  📋 抽样名单补录 ({len(supps)}条): 从抽样名单补回旧口径值")
    for r in supps:
        print(f"     例: {r['id']} 当前值={r['value']} 旧口径={r.get('corrected_value', 'N/A')} 来源={r.get('sampling_list_source', 'N/A')}")


def cmd_demo(args):
    _print_header("傅里叶周期噪声拆解 —— 完整演示流程")

    engine = WorkflowEngine()

    # Step 1: Import teacher annotations
    _print_header("第①步：导入老师批注")
    records = get_demo_records()
    annotations = get_demo_teacher_annotations()
    result = engine.import_teacher_annotations(records, annotations)
    _print_step_result(result)

    # Step 2: Supplement with sampling list
    _print_header("第②步：补看抽样名单")
    sampling_list = get_demo_sampling_list()
    result = engine.supplement_from_sampling(sampling_list)
    _print_step_result(result)

    # Step 3: Update boundary report
    _print_header("第③步：边界样本报告更新")
    report = engine.update_boundary_report()
    _print_report(report.to_dict())

    # Manual correction
    if args.with_correction:
        _print_header("人工修正")
        correction = get_demo_manual_correction()
        result = engine.manual_correct(
            correction["record_id"],
            correction["corrected_value"],
        )
        _print_step_result(result)
        print(f"\n  修正备注: {correction['note']}")
        print(f"  修正人: {correction['corrected_by']}  时间: {correction['timestamp']}")

    # Rerun
    if args.with_rerun:
        _print_header("重跑")
        rerun_config = get_demo_rerun_config()
        result = engine.rerun()
        _print_step_result(result)
        print(f"\n  重跑触发: {rerun_config['trigger']}")
        print(f"  已应用修正: {rerun_config['applied_corrections']}")
        print(f"  已补录抽样: {rerun_config['applied_sampling']}")

        report = engine.update_boundary_report()
        _print_report(report.to_dict())

    _print_header("流程结束")
    status = engine.get_status()
    print(f"  已完成步骤: {status['completed_steps']}")
    print(f"  待复核记录: {status['pending_review']}条")
    print()


def cmd_import(args):
    engine = _load_engine(args)
    records = get_demo_records()
    annotations = get_demo_teacher_annotations()
    result = engine.import_teacher_annotations(records, annotations)
    _print_step_result(result)
    _save_engine(args, engine)


def cmd_supplement(args):
    engine = _load_engine(args)
    sampling_list = get_demo_sampling_list()
    result = engine.supplement_from_sampling(sampling_list)
    _print_step_result(result)
    _save_engine(args, engine)


def cmd_report(args):
    engine = _load_engine(args)
    report = engine.update_boundary_report()
    if args.json:
        print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
    else:
        _print_report(report.to_dict())


def cmd_correct(args):
    engine = _load_engine(args)
    result = engine.manual_correct(args.record_id, args.value)
    _print_step_result(result)
    _save_engine(args, engine)


def cmd_rerun(args):
    engine = _load_engine(args)
    result = engine.rerun()
    _print_step_result(result)
    _save_engine(args, engine)


def cmd_status(args):
    engine = _load_engine(args)
    status = engine.get_status()
    print(json.dumps(status, ensure_ascii=False, indent=2))


_ENGINE_STATE_FILE = "/tmp/fourier_noise_engine_state.json"


def _load_engine(args) -> WorkflowEngine:
    engine = WorkflowEngine()
    try:
        with open(_ENGINE_STATE_FILE, "r") as f:
            state = json.load(f)
        records_data = state.get("records", [])
        from fourier_noise.models import Record
        for rd in records_data:
            r = Record(
                id=rd["id"],
                timestamp=rd["timestamp"],
                value=rd["value"],
                old_table_value=rd.get("old_table_value"),
                record_type=RecordType(rd["record_type"]),
                review_status=ReviewStatus(rd["review_status"]),
                teacher_annotation=rd.get("teacher_annotation"),
                sampling_list_source=rd.get("sampling_list_source"),
                corrected_value=rd.get("corrected_value"),
            )
            engine.records.append(r)
        engine.completed_steps = state.get("completed_steps", [])
        engine.current_step = state.get("current_step")
    except (FileNotFoundError, json.JSONDecodeError):
        pass
    return engine


def _save_engine(args, engine: WorkflowEngine):
    state = {
        "records": [r.to_dict() for r in engine.records],
        "completed_steps": engine.completed_steps,
        "current_step": engine.current_step,
    }
    with open(_ENGINE_STATE_FILE, "w") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="傅里叶周期噪声拆解 — 命令行工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行完整演示流程
  python -m fourier_noise.cli demo --with-correction --with-rerun

  # 单步操作
  python -m fourier_noise.cli import       # 第①步: 导入老师批注
  python -m fourier_noise.cli supplement   # 第②步: 补看抽样名单
  python -m fourier_noise.cli report       # 第③步: 边界样本报告
  python -m fourier_noise.cli correct REC-003 -3.22  # 人工修正
  python -m fourier_noise.cli rerun        # 重跑
        """,
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    demo_parser = subparsers.add_parser("demo", help="运行完整演示流程")
    demo_parser.add_argument("--with-correction", action="store_true", help="包含人工修正步骤")
    demo_parser.add_argument("--with-rerun", action="store_true", help="包含重跑步骤")
    demo_parser.set_defaults(func=cmd_demo)

    import_parser = subparsers.add_parser("import", help="第①步: 导入老师批注")
    import_parser.set_defaults(func=cmd_import)

    supplement_parser = subparsers.add_parser("supplement", help="第②步: 补看抽样名单")
    supplement_parser.set_defaults(func=cmd_supplement)

    report_parser = subparsers.add_parser("report", help="第③步: 边界样本报告")
    report_parser.add_argument("--json", action="store_true", help="JSON格式输出")
    report_parser.set_defaults(func=cmd_report)

    correct_parser = subparsers.add_parser("correct", help="人工修正某条记录")
    correct_parser.add_argument("record_id", help="记录ID")
    correct_parser.add_argument("value", type=float, help="修正值")
    correct_parser.set_defaults(func=cmd_correct)

    rerun_parser = subparsers.add_parser("rerun", help="重跑傅里叶拆解")
    rerun_parser.set_defaults(func=cmd_rerun)

    status_parser = subparsers.add_parser("status", help="查看当前流程状态")
    status_parser.set_defaults(func=cmd_status)

    args = parser.parse_args()
    if not hasattr(args, "func"):
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    main()
