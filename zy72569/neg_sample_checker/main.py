#!/usr/bin/env python3
"""序列推荐负采样检查工具 - 主入口

支持两种模式：
  1. 交互模式 (--mode interactive) : 完整链路，适合实际工作
  2. 批量模式 (--mode batch)       : 一键跑完所有样例场景
"""

import argparse
import sys
import os
import json
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.workflow import WorkflowEngine
from src.reporter import Reporter


def _print_sep(c="=", n=60):
    print(c * n)


def _print_step_header(title, idx=None):
    print()
    _print_sep("-")
    if idx:
        print(f"▶ 步骤 {idx} | {title}")
    else:
        print(f"▶ {title}")
    _print_sep("-")


def print_step_result(step):
    icons = {
        'completed': '✅',
        'completed_with_warnings': '🟡',
        'failed': '❌',
        'running': '⏳',
        'pending': '⏸️',
    }
    icon = icons.get(step.status, '❓')
    print(f"\n{icon} {step.step_name} [{step.status.upper()}]")
    if step.batch_id:
        print(f"   📦 关联批次: {step.batch_id}")
    if step.export_path:
        print(f"   📤 导出文件: {step.export_path}")

    for result in step.results:
        ico = "✅" if result.passed else ("⚠️" if result.severity == "warning" else "❌")
        check_id_suffix = f" #{result.check_id}" if hasattr(result, 'check_id') and result.check_id else ""
        print(f"  {ico} {result.check_name}{check_id_suffix}: {'通过' if result.passed else '不通过'}")
        if result.batch_id:
            print(f"     📦 批次: {result.batch_id}")
        if result.suggestion:
            print(f"     💡 建议: {result.suggestion}")
        extra_notes = []
        for key in ('trace_guide', 'resolution_guide', 'reverse_lookup_guide',
                    'next_export_will_compare', 'decision_guide', 'cross_batch_duplicates_note'):
            if isinstance(result.details, dict) and result.details.get(key):
                extra_notes.append(f"     · {result.details[key]}")
        for note in extra_notes:
            print(note)

    if step.conflicts:
        pending = sum(1 for c in step.conflicts if c.resolution == "pending")
        confirmed = sum(1 for c in step.conflicts if c.resolution == "confirmed")
        rejected = sum(1 for c in step.conflicts if c.resolution == "rejected")
        print(f"  ⚔️  冲突: {len(step.conflicts)} 条 (待处理:{pending} 已确认:{confirmed} 已驳回:{rejected})")
        for c in step.conflicts[:3]:
            trace = f" [trace:{c.record_trace_id[:12]}...]" if c.record_trace_id else ""
            reason = f" | 理由:{c.resolution_reason[:20]}..." if c.resolution_reason and len(c.resolution_reason) > 20 else (
                     f" | 理由:{c.resolution_reason}" if c.resolution_reason else "")
            print(f"     - {c.description}{trace} [{c.resolution}]{reason}")
        if len(step.conflicts) > 3:
            print(f"     ... 还有 {len(step.conflicts) - 3} 条冲突")


def _print_history_table(engine, n=10):
    rows = engine.get_run_history_table()
    if not rows:
        print("   (暂无历史记录)")
        return
    print(f"   显示最近 {min(n, len(rows))} / {len(rows)} 条:")
    header = f"   {'run_id':<14} {'时间':<17} {'阈值':>5} {'P':>6} {'R':>6} {'条数':>6} 备注"
    print(header)
    print("   " + "-" * (len(header) - 3))
    for r in rows[-n:]:
        p = f"{r['precision']:.3f}" if isinstance(r['precision'], float) else str(r['precision'])
        rc = f"{r['recall']:.3f}" if isinstance(r['recall'], float) else str(r['recall'])
        note = r['note'][:24] if r['note'] else "-"
        t = r['timestamp'][5:16].replace('-', '/').replace(' ', '/')
        print(f"   {r['run_id'][:12]:<14} {t:<17} {r['threshold']:>5.2f} {p:>6} {rc:>6} {r['row_count']:>6} {note}")


def _print_batches(engine):
    batches = engine.get_all_batches()
    if not batches:
        print("   (暂无批次)")
        return
    print(f"   共 {len(batches)} 个批次 (白底=历史, 蓝底=最新):")
    print(f"   {'#':>2} {'batch_id':<30} {'类型':<8} {'条数':>6} {'来源':<22} 备注")
    print("   " + "-" * 95)
    for i, b in enumerate(batches, 1):
        mark = "🟦" if (i == len(batches)) else "  "
        src = os.path.basename(b['source_path'])[:20] if b['source_path'] else "-"
        print(f" {mark} {i:>1} {b['batch_id']:<30} {b['batch_type']:<8} {b['record_count']:>6} {src:<22} {b['note'] or '-'}")


def _print_exports(engine):
    exports = engine.get_export_history()
    if not exports:
        print("   (暂无导出记录)")
        return
    print(f"   共 {len(exports)} 次导出:")
    for e in exports:
        print(f"   · {e['export_id'][:12]} | {e['export_time']} | {e['record_count']:>4} 条 | checksum={e['checksum'][:8]}... | {os.path.basename(e['export_path'])}")


def _resolve_conflicts_interactively(engine):
    all_conflicts = []
    for step in engine.steps.values():
        all_conflicts.extend([(step.step_id, c) for c in step.conflicts])
    pending = [(s, c) for s, c in all_conflicts if c.resolution == 'pending']

    if not pending:
        print("✅ 没有待处理的冲突")
        return

    _print_step_header(f"冲突处理 - 共 {len(pending)} 条待处理")
    print("  说明：数据科学家林姐请逐条确认或驳回，必须填写理由。不要替业务同事自动拍板。\n")

    for idx, (_, c) in enumerate(pending, 1):
        print(f"  [{idx}/{len(pending)}] {c.description}")
        if c.record_trace_id:
            print(f"       trace_id: {c.record_trace_id}")
        print(f"       负样本标签: {c.neg_sample_data.get('label')} | 召回候选标签: {c.recall_candidate_data.get('label')}")
        while True:
            choice = input("       操作 [c=确认负样本对, r=驳回负样本, s=跳过, q=全部跳过]: ").strip().lower()
            if choice in ('q',):
                print("       → 跳过剩余冲突。")
                return
            if choice == 's':
                print("       → 本条跳过。")
                break
            if choice in ('c', 'r'):
                while True:
                    reason = input("       📝 请填写确认/驳回理由(必填): ").strip()
                    if reason:
                        break
                    print("       ⚠️  理由不能为空")
                engine.resolve_conflict(
                    c.conflict_id,
                    resolution='confirmed' if choice == 'c' else 'rejected',
                    resolved_by='林姐(交互)',
                    reason=reason
                )
                print(f"       ✅ 已{'确认' if choice == 'c' else '驳回'}，理由已记录。")
                break
            print("       请输入 c / r / s / q")


def interactive_mode(engine, reporter):
    print()
    _print_sep()
    print(" 序列推荐负采样检查 · 交互模式")
    print(" 完整链路: 导入 → 对比 → 冲突处理 → 阈值回放 → 补录/修正 → 保存 → 刷新 → 导出 → 报告")
    _print_sep()

    # ============ 步骤1: 导入 ============
    _print_step_header("负样本列表第一次导入", 1)
    default_neg = "data/wrong_caliber/neg_samples.csv"
    neg_path = input(f"请输入负样本列表CSV路径 [{default_neg}]: ").strip() or default_neg
    if not os.path.exists(neg_path):
        print(f"❌ 文件不存在: {neg_path}")
        return
    batch_note = input("可选: 给本批次加个备注，例如「0614晚批次」: ").strip()

    s1 = engine.run_step1_import(neg_path, batch_note=batch_note)
    print_step_result(s1)
    _print_batches(engine)

    # ============ 步骤2: 对比 ============
    _print_step_header("数据科学家林姐补看召回候选表", 2)
    default_recall = "data/wrong_caliber/recall_candidates.csv"
    recall_path = input(f"请输入召回候选表CSV路径 [{default_recall}]: ").strip() or default_recall

    s2 = engine.run_step2_compare(recall_path)
    print_step_result(s2)

    if s2.conflicts:
        go = input("\n是否进入冲突处理？[Y/n]: ").strip().lower()
        if go in ('', 'y', 'yes'):
            _resolve_conflicts_interactively(engine)
            print("\n刷新步骤2结果:")
            print_step_result(engine.steps['step2_compare'])

    # ============ 步骤3: 阈值回放 ============
    _print_step_header("阈值回放更新", 3)
    th_in = input(f"请输入阈值，回车使用默认 {engine.current_threshold}: ").strip()
    th = float(th_in) if th_in else None
    s3 = engine.run_step3_playback(th)
    print_step_result(s3)
    print("\n📜 阈值/历史记录:")
    _print_history_table(engine, n=8)

    # ============ 补录 ============
    _print_step_header("补录数据 / 修正数据", 4)
    while True:
        choice = input("需要补录数据吗？ [y=补录, n=继续, s=查看当前批次/历史/导出]: ").strip().lower()
        if choice == 's':
            print("\n📦 当前批次:")
            _print_batches(engine)
            print("\n📜 历史记录:")
            _print_history_table(engine)
            print("\n📤 导出记录:")
            _print_exports(engine)
            continue
        if choice in ('n', ''):
            break
        if choice == 'y':
            default_supp = "data/supplement/supplement.csv"
            supp_path = input(f"补录CSV路径 [{default_supp}]: ").strip() or default_supp
            supp_note = input("补录批次备注，例如「遗漏的10条高活用户」: ").strip()
            if not os.path.exists(supp_path):
                print(f"❌ 文件不存在: {supp_path}")
                continue
            ok, added, info = engine.apply_supplement(
                supp_path, note=supp_note,
                rerun_compare_path=recall_path if os.path.exists(recall_path) else None
            )
            if ok:
                print(f"✅ 补录成功 +{added} 条，批次={info.get('batch_id')}，已自动重算步骤3")
                if info.get('steps_rerun'):
                    print(f"   已自动重算: {list(info['steps_rerun'].keys())}")
                print_step_result(engine.steps['step1_import'])
                print_step_result(engine.steps['step3_playback'])
            else:
                print(f"❌ 补录失败: {info.get('error')}")

    # ============ 保存快照 ============
    _print_step_header("保存快照 / 刷新结果", 5)
    snap_note = input("可选: 给本次保存加备注，例如「林姐处理完5条冲突后」: ").strip()
    engine.save_snapshot(note=snap_note)
    print("💾 已保存当前状态快照 (冲突理由/阈值/批次/备注)")

    do_refresh = input("要刷新结果吗？(重算重复/少数类/阈值) [Y/n]: ").strip().lower()
    if do_refresh in ('', 'y', 'yes'):
        print("🔄 刷新中...")
        engine.refresh_results()
        print("✅ 结果已刷新")
        print_step_result(engine.steps['step1_import'])
        print_step_result(engine.steps['step3_playback'])

    # ============ 查看历史 ============
    print("\n📜 最终历史记录 (trace_id 可在报告里反查同一条样例):")
    _print_history_table(engine, n=15)
    print("\n📦 最终批次:")
    _print_batches(engine)

    # ============ 步骤4: 导出 + 一致性核验 ============
    _print_step_header("导出 + 导出一致性核验", 6)
    exp_name = input(f"导出文件名前缀 (留空自动生成): ").strip() or None
    include_trace = input("导出CSV包含 _trace_id / _batch_id 追溯列？推荐包含 [Y/n]: ").strip().lower()
    include_trace_bool = include_trace in ('', 'y', 'yes')

    s4 = engine.run_step4_export(export_name=exp_name, include_trace=include_trace_bool)
    print_step_result(s4)
    print("\n📤 导出历史:")
    _print_exports(engine)

    # ============ 生成报告 ============
    _print_step_header("生成报告", 7)
    report_name = input("报告文件名前缀 (留空自动生成): ").strip() or None
    paths = reporter.generate_report(engine, report_name=report_name)

    _print_sep()
    print("✅ 完整链路完成！输出文件:")
    print(f"   📄 HTML报告: {paths['html']}")
    print(f"       → 打开方式: open {os.path.basename(paths['html'])}")
    print(f"   📋 JSON报告: {paths['json']}")
    if engine.export_records:
        print(f"   📤 导出CSV : {engine.export_records[-1].export_path}")
        print(f"       → 用 trace_id 可和报告/历史/内存交叉验证同一条记录")
    _print_sep()
    print("\n💡 复跑方式:")
    print(f"   # 再跑一次（相同交互过程）")
    print(f"   python3 main.py --mode interactive")
    print(f"   # 一键批量跑三个预设场景")
    print(f"   python3 main.py --mode batch --scenario wrong_caliber")


def run_batch_mode(args):
    engine = WorkflowEngine(args.config)
    reporter = Reporter(os.path.join(os.path.dirname(__file__), 'reports'))

    print(f"\n📊 批量运行: 场景 = {args.scenario}")
    _print_sep("-")

    base = os.path.join(os.path.dirname(__file__), 'data', args.scenario)
    neg = os.path.join(base, 'neg_samples.csv')
    recall = os.path.join(base, 'recall_candidates.csv')
    supp = os.path.join(base, 'supplement.csv')

    if not os.path.exists(neg):
        print(f"❌ 场景数据不存在: {neg}")
        return

    # 步骤1
    s1 = engine.run_step1_import(neg, batch_note=f"batch.{args.scenario}.初始导入")
    print_step_result(s1)
    print("\n📦 批次:")
    _print_batches(engine)

    # 步骤2
    if os.path.exists(recall):
        s2 = engine.run_step2_compare(recall, recall_batch_note=f"batch.{args.scenario}.召回")
        print_step_result(s2)

        # 批量场景里对前 2 条冲突做示例性处理 + 写理由，展示理由字段能落到报告
        pending = [c for step in engine.steps.values() for c in step.conflicts if c.resolution == 'pending']
        if pending:
            print(f"\n🤖 批量自动演示处理前 {min(2, len(pending))} 条冲突（仅做演示，实际请用交互模式）:")
            for i, c in enumerate(pending[:2], 1):
                engine.resolve_conflict(
                    c.conflict_id,
                    resolution='confirmed' if i % 2 == 1 else 'rejected',
                    resolved_by='批量模式演示',
                    reason=(f"[演示] 按{i}号规则：{args.scenario}场景下，"
                            f"user_id={c.neg_sample_data.get('user_id')} 对应的负样本标签{('正确' if i%2==1 else '错误')}，"
                            f"依据是口径v2第{i}条补充说明")
                )
                print(f"   已{'确认' if i%2==1 else '驳回'} {c.conflict_id}，并写入了理由")

    # 步骤3
    s3 = engine.run_step3_playback(args.threshold)
    print_step_result(s3)

    # 补录
    if os.path.exists(supp):
        print("\n📝 检测到补录材料，正在应用...")
        ok, added, info = engine.apply_supplement(
            supp, note=f"batch.{args.scenario}.补录",
            rerun_compare_path=recall if os.path.exists(recall) else None
        )
        if ok:
            print(f"✅ 补录成功 +{added} 条，批次={info.get('batch_id')}")
            print(f"   自动重算: {list(info.get('steps_rerun', {}).keys())}")
        print("\n📦 补录后批次:")
        _print_batches(engine)

    # 保存 + 刷新
    print("\n💾 保存快照并刷新结果...")
    engine.save_snapshot(note=f"batch.{args.scenario}.完成补录后")
    engine.refresh_results()

    # 历史
    print("\n📜 历史记录:")
    _print_history_table(engine, n=15)

    # 步骤4: 导出 + 一致
    print("\n📤 执行导出并做一致性核验 (导出一致自检)...")
    s4 = engine.run_step4_export(export_name=f"export_{args.scenario}", include_trace=True)
    print_step_result(s4)
    print("\n📤 导出历史:")
    _print_exports(engine)

    # 验证 trace 反查
    if engine.neg_dataset and not engine.neg_dataset.df.empty and '_trace_id' in engine.neg_dataset.df.columns:
        sample_tid = engine.neg_dataset.df['_trace_id'].iloc[0]
        trace = engine.trace_record(sample_tid)
        if trace:
            print(f"\n🔍 trace 反查验证 (样例 trace={sample_tid[:12]}...):")
            print(f"   user_id={trace['record'].get('user_id')}, item_id={trace['record'].get('item_id')}")
            print(f"   批次={trace.get('batch_id')}, 来源={trace.get('batch_info', {}).get('source_path') if trace.get('batch_info') else '-'}")
            print("   ✅ 列表→详情→历史→导出→反查 指向同一条记录")

    # 报告
    paths = reporter.generate_report(engine, f"report_{args.scenario}")

    _print_sep()
    print(f"✅ 批量场景 [{args.scenario}] 完成:")
    print(f"   📄 HTML报告: {paths['html']}")
    print(f"   📋 JSON报告: {paths['json']}")
    if engine.export_records:
        print(f"   📤 导出CSV : {engine.export_records[-1].export_path}")
    print("\n💡 复跑:")
    print(f"   python3 main.py --mode batch --scenario {args.scenario}")
    _print_sep()


def main():
    parser = argparse.ArgumentParser(description="序列推荐负采样检查工具 (含导出一致自检 + 全链路追溯)")
    parser.add_argument('--config', type=str,
                       default=os.path.join(os.path.dirname(__file__), 'config/settings.yaml'),
                       help='配置文件路径')
    parser.add_argument('--mode', type=str, choices=['interactive', 'batch'], default='interactive',
                       help='interactive = 完整交互全链路 / batch = 一键跑预设场景')
    parser.add_argument('--scenario', type=str, choices=['normal', 'wrong_caliber', 'supplement'],
                       default='wrong_caliber', help='批量模式要跑的场景 (默认wrong_caliber能看到所有问题)')
    parser.add_argument('--threshold', type=float, default=None, help='批量模式自定义阈值')
    args = parser.parse_args()

    engine = WorkflowEngine(args.config)
    reporter = Reporter(os.path.join(os.path.dirname(__file__), 'reports'))

    if args.mode == 'interactive':
        interactive_mode(engine, reporter)
    else:
        run_batch_mode(args)


if __name__ == '__main__':
    main()
