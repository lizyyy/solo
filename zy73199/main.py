#!/usr/bin/env python3
"""
优化调参参数回放 - 数学题草稿调参回放工具
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.replay_engine import ReplayEngine
from core.draft_manager import DraftManager
from core.persistence import PersistenceManager
from core.models import ReplayStatus
from data.sample_data import generate_sample_data


def print_separator(title: str = ""):
    width = 70
    if title:
        line = "=" * ((width - len(title) - 2) // 2)
        print(f"\n{line} {title} {line}")
    else:
        print("=" * width)


def cmd_init(engine, draft_manager, persistence):
    print("初始化示例数据...")
    record_ids = generate_sample_data(draft_manager)
    print(f"已生成 {len(record_ids)} 条草稿记录")

    print("\n执行回放计算...")
    draft_manager.replay_all_drafts()

    records = draft_manager.list_all_records()
    persistence.save_records_json(records)
    print("数据已保存到 data/replay_records.json")

    csv_path = persistence.export_summary_csv(records)
    print(f"汇总CSV已导出到 {csv_path}")

    print("\n初始化完成！运行 python main.py list 查看所有记录")


def cmd_list(engine, draft_manager, persistence, args):
    status_filter = None
    include_boundary = True
    problem_id = None

    for arg in args:
        if arg.startswith("--status="):
            status_str = arg.split("=", 1)[1]
            try:
                status_filter = ReplayStatus(status_str)
            except ValueError:
                print(f"无效状态: {status_str}")
                print(f"有效状态: {', '.join(s.value for s in ReplayStatus)}")
                return
        elif arg == "--no-boundary":
            include_boundary = False
        elif arg.startswith("--problem="):
            problem_id = arg.split("=", 1)[1]

    records = draft_manager.list_all_records(
        status_filter=status_filter,
        problem_id=problem_id,
        include_boundary=include_boundary,
    )

    if not records:
        print("暂无记录")
        return

    print_separator(f"记录列表 (共 {len(records)} 条)")
    print(f"{'记录ID':<30} {'题目':<20} {'版本':<4} {'状态':<10} {'结果':<12} {'边界':<4}")
    print("-" * 85)

    for r in records:
        result_str = f"{r.final_result} {r.final_unit}" if r.final_result is not None else "-"
        boundary_mark = "是" if r.is_boundary else ""
        print(f"{r.record_id:<30} {r.problem_title:<20} v{r.version:<3} {r.status.value:<10} {result_str:<12} {boundary_mark:<4}")


def cmd_detail(engine, draft_manager, persistence, args):
    if not args:
        print("用法: python main.py detail <记录ID>")
        return

    record_id = args[0]
    record = draft_manager.get_record(record_id)

    if not record:
        print(f"记录不存在: {record_id}")
        return

    print_separator(f"记录详情 - {record.problem_title}")
    print(f"记录ID:     {record.record_id}")
    print(f"题目ID:     {record.problem_id}")
    print(f"题目名称:   {record.problem_title}")
    print(f"版   本:    v{record.version}")
    print(f"状   态:    {record.status.value}")
    print(f"创建人:     {record.created_by}")
    print(f"创建时间:   {record.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"更新时间:   {record.updated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"边界样本:   {'是 (' + record.boundary_type + ')' if record.is_boundary else '否'}")

    if record.fail_reason:
        print(f"失败原因:   {record.fail_reason}")
        print(f"失败详情:   {record.fail_detail}")

    if record.final_result is not None:
        print(f"最终结果:   {record.final_result} {record.final_unit}")

    print("\n【参数列表】")
    for p in record.parameters:
        print(f"  {p.name}: {p.value} {p.unit} (来源: {p.source})")

    print("\n【计算步骤】")
    for i, step in enumerate(record.steps, 1):
        print(f"\n  步骤{i}: {step.step_name}")
        print(f"    公式: {step.formula}")
        input_str = ", ".join(f"{k}={v}{u}" for k, v in step.input_values.items()
                              for kk, u in step.input_units.items() if k == kk)
        print(f"    输入: {input_str}")
        if step.result_value is not None:
            print(f"    结果: {step.result_value} {step.result_unit}")
        if step.error_msg:
            print(f"    错误: {step.error_msg}")

    if record.remark:
        print("\n【备注记录】")
        for line in record.remark.split("\n"):
            print(f"  {line}")

    csv_path = persistence.export_detail_csv(record)
    print(f"\n明细CSV已导出: {csv_path}")


def cmd_compare(engine, draft_manager, persistence, args):
    if len(args) < 2:
        print("用法: python main.py compare <记录ID_A> <记录ID_B>")
        print("  或: python main.py compare --problem=<题目ID> --version=<v1>,<v2>")
        return

    record_a_id = None
    record_b_id = None
    problem_id = None
    versions = None

    for arg in args:
        if arg.startswith("--problem="):
            problem_id = arg.split("=", 1)[1]
        elif arg.startswith("--version="):
            versions = arg.split("=", 1)[1].split(",")
        elif not record_a_id:
            record_a_id = arg
        else:
            record_b_id = arg

    if problem_id and versions:
        comparison = draft_manager.compare_two_versions(problem_id, int(versions[0]), int(versions[1]))
        filename = f"{problem_id}_v{versions[0]}_vs_v{versions[1]}_comparison.csv"
    elif record_a_id and record_b_id:
        comparison = draft_manager.compare_two_records(record_a_id, record_b_id)
        filename = f"{record_a_id}_vs_{record_b_id}_comparison.csv"
    else:
        print("参数错误")
        return

    if not comparison:
        print("无法进行对比，记录不存在")
        return

    print_separator("参数对照")
    print(f"{'参数名':<12} {'A组':<12} {'B组':<12} {'差异':<6}")
    print("-" * 45)
    for pd in comparison["params_diff"]:
        diff_mark = "✓" if pd["has_diff"] else ""
        val_a = f"{pd['value_a']} {pd['unit_a']}" if pd["value_a"] is not None else "-"
        val_b = f"{pd['value_b']} {pd['unit_b']}" if pd["value_b"] is not None else "-"
        print(f"{pd['name']:<12} {val_a:<12} {val_b:<12} {diff_mark:<6}")

    print_separator("步骤对照")
    for sd in comparison["steps_diff"]:
        diff_mark = "✓" if sd["has_diff"] else ""
        res_a = f"{sd['result_a']} {sd['unit_a']}" if sd["result_a"] is not None else "-"
        res_b = f"{sd['result_b']} {sd['unit_b']}" if sd["result_b"] is not None else "-"
        print(f"  步骤{sd['step_index']}: {sd['step_name']}")
        print(f"    A: {res_a}  B: {res_b}  {diff_mark}")
        if sd["error_a"] or sd["error_b"]:
            if sd["error_a"]:
                print(f"    A错误: {sd['error_a']}")
            if sd["error_b"]:
                print(f"    B错误: {sd['error_b']}")

    if comparison["result_diff"]:
        rd = comparison["result_diff"]
        print_separator("最终结果对比")
        print(f"  A组: {rd['value_a']} {rd['unit']}")
        print(f"  B组: {rd['value_b']} {rd['unit']}")
        print(f"  绝对差: {rd['abs_diff']} {rd['unit']}")
        print(f"  相对差: {rd['pct_diff']}%")

    csv_path = persistence.export_comparison_csv(comparison, filename)
    print(f"\n对比CSV已导出: {csv_path}")


def cmd_replay(engine, draft_manager, persistence, args):
    if not args:
        print("用法: python main.py replay <记录ID>")
        print("  或: python main.py replay --all")
        print("  或: python main.py replay --problem=<题目ID>")
        return

    if args[0] == "--all":
        records = draft_manager.replay_all_drafts()
        print(f"已回放 {len(records)} 条记录")
    elif args[0].startswith("--problem="):
        problem_id = args[0].split("=", 1)[1]
        records = draft_manager.replay_all_drafts(problem_id)
        print(f"题目 {problem_id} 已回放 {len(records)} 条记录")
    else:
        record_id = args[0]
        try:
            record = draft_manager.replay_draft(record_id)
            print(f"回放完成: {record.record_id} - {record.status.value}")
            if record.final_result is not None:
                print(f"结果: {record.final_result} {record.final_unit}")
            if record.fail_reason:
                print(f"失败原因: {record.fail_reason}")
                print(f"详情: {record.fail_detail}")
        except ValueError as e:
            print(str(e))
            return

    records = draft_manager.list_all_records()
    persistence.save_records_json(records)
    print("数据已保存")


def cmd_remark(engine, draft_manager, persistence, args):
    if len(args) < 2:
        print("用法: python main.py remark <记录ID> \"备注内容\"")
        return

    record_id = args[0]
    remark_text = args[1]

    if draft_manager.add_remark(record_id, remark_text):
        record = draft_manager.get_record(record_id)
        persistence.save_records_json(draft_manager.list_all_records())
        print(f"备注已添加到 {record_id}")
        print(f"当前备注:\n{record.remark}")
    else:
        print(f"记录不存在: {record_id}")


def cmd_export(engine, draft_manager, persistence, args):
    export_type = "summary"
    record_id = None

    for arg in args:
        if arg == "summary":
            export_type = "summary"
        elif arg == "detail":
            export_type = "detail"
        elif arg.startswith("--id="):
            record_id = arg.split("=", 1)[1]

    records = draft_manager.list_all_records()

    if export_type == "summary":
        csv_path = persistence.export_summary_csv(records)
        print(f"汇总CSV已导出: {csv_path}")
    elif export_type == "detail":
        if not record_id:
            print("请指定记录ID: python main.py export detail --id=<记录ID>")
            return
        record = draft_manager.get_record(record_id)
        if not record:
            print(f"记录不存在: {record_id}")
            return
        csv_path = persistence.export_detail_csv(record)
        print(f"明细CSV已导出: {csv_path}")


def cmd_stats(engine, draft_manager, persistence, args):
    stats = draft_manager.get_fail_statistics()
    records = draft_manager.list_all_records()

    print_separator("统计概览")
    print(f"总记录数: {len(records)}")
    print(f"\n状态分布:")
    for status, count in sorted(stats.items()):
        bar = "█" * count
        print(f"  {status:<10} {count:>3}  {bar}")

    boundary_count = len(draft_manager.get_boundary_records())
    unit_missing_count = len(draft_manager.get_unit_missing_records())
    print(f"\n边界样本数: {boundary_count}")
    print(f"单位缺失数: {unit_missing_count}")

    problem_set = set(r.problem_id for r in records)
    print(f"涉及题目数: {len(problem_set)}")

    for pid in sorted(problem_set):
        versions = draft_manager.get_problem_versions(pid)
        title = versions[0].problem_title
        print(f"  {pid} ({title}): {len(versions)} 个版本")


def cmd_filter(engine, draft_manager, persistence, args):
    if not args:
        print("用法: python main.py filter <筛选条件>")
        print("  --status=<状态>      按状态筛选")
        print("  --unit-missing       筛选单位缺失的记录")
        print("  --boundary           筛选边界样本")
        print("  --failed             筛选所有失败记录")
        return

    records = []
    filter_name = ""

    if "--unit-missing" in args:
        records = draft_manager.get_unit_missing_records()
        filter_name = "单位缺失"
    elif "--boundary" in args:
        records = draft_manager.get_boundary_records()
        filter_name = "边界样本"
    elif "--failed" in args:
        all_records = draft_manager.list_all_records()
        records = [r for r in all_records if r.status in
                   [ReplayStatus.FAILED_FORMULA, ReplayStatus.FAILED_UNIT, ReplayStatus.FAILED_THRESHOLD]]
        filter_name = "失败记录"

    if not records:
        print(f"没有符合条件的记录（{filter_name}）")
        return

    print(f"【{filter_name}】共 {len(records)} 条")
    print(f"{'记录ID':<30} {'题目':<20} {'失败原因':<10} {'详情'}")
    print("-" * 80)

    for r in records:
        reason = r.fail_reason if r.fail_reason else r.status.value
        detail = r.fail_detail if r.fail_detail else ""
        print(f"{r.record_id:<30} {r.problem_title:<20} {reason:<10} {detail}")


def cmd_verify(engine, draft_manager, persistence, args):
    records = draft_manager.list_all_records()

    json_count = len(records)
    print(f"内存中记录数: {json_count}")

    csv_file = os.path.join("output", "replay_summary.csv")
    if os.path.exists(csv_file):
        result = persistence.verify_csv_consistency(records, csv_file)
        print(f"CSV记录数: {result['csv_records']}")
        print(f"一致性: {'通过 ✓' if result['consistent'] else '不通过 ✗'}")
        if result["issues"]:
            print("问题列表:")
            for issue in result["issues"]:
                print(f"  - {issue}")
    else:
        print("CSV文件不存在，请先运行 export summary")

    json_file = os.path.join("data", "replay_records.json")
    if os.path.exists(json_file):
        loaded = persistence.load_records_json()
        print(f"\nJSON文件记录数: {len(loaded)}")
        print(f"与内存一致: {'是 ✓' if len(loaded) == len(records) else '否 ✗'}")


def cmd_help(engine, draft_manager, persistence, args):
    print("""
优化调参参数回放 - 命令行工具

快速开始:
  python main.py init           # 初始化示例数据并回放
  python main.py list           # 列出所有记录

常用命令:
  list [选项]                   列出记录
    --status=<状态>             按状态筛选 (待计算/计算成功/公式错误/单位缺失/超阈值/边界样本/草稿)
    --problem=<题目ID>          按题目筛选
    --no-boundary               不显示边界样本

  detail <记录ID>               查看记录详情（含计算步骤和明细CSV）
  replay <记录ID>|--all|--problem=<ID>  执行回放计算
  compare <ID_A> <ID_B>         对比两条记录
    --problem=<ID> --version=1,2  对比同一题的两个版本

  remark <记录ID> "<内容>"      添加备注
  export summary|detail         导出CSV
    --id=<记录ID>               指定记录ID（detail模式需要）

  filter                        筛选记录
    --unit-missing              单位缺失的记录
    --boundary                  边界样本
    --failed                    所有失败记录

  stats                         统计概览
  verify                        验证数据一致性
  help                          显示帮助

使用建议:
  1. 先跑 init 初始化数据
  2. 用 list 看所有记录概览
  3. 用 detail 看某条记录的完整计算过程
  4. 用 compare 对比两组参数的差异
  5. 用 filter 筛出单位缺失或边界样本
""")


def main():
    engine = ReplayEngine()
    draft_manager = DraftManager(engine)
    persistence = PersistenceManager()

    json_file = os.path.join("data", "replay_records.json")
    if os.path.exists(json_file):
        persistence.load_records_into_manager(draft_manager)

    if len(sys.argv) < 2:
        cmd_help(engine, draft_manager, persistence, [])
        return

    cmd = sys.argv[1]
    args = sys.argv[2:]

    commands = {
        "init": lambda e, d, p, a: cmd_init(e, d, p),
        "list": cmd_list,
        "detail": cmd_detail,
        "compare": cmd_compare,
        "replay": cmd_replay,
        "remark": cmd_remark,
        "export": cmd_export,
        "stats": cmd_stats,
        "filter": cmd_filter,
        "verify": cmd_verify,
        "help": cmd_help,
    }

    if cmd in commands:
        commands[cmd](engine, draft_manager, persistence, args)
    else:
        print(f"未知命令: {cmd}")
        print("运行 python main.py help 查看帮助")


if __name__ == "__main__":
    main()
