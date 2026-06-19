import argparse
import json
import os
import sys

from demo import demo_poisson_prediction
from processor import RecordProcessor
from models import STATUS_LABEL_CN


def cmd_run_demo(args):
    print("泊松到店人数预测系统 - 完整演示模式")
    return demo_poisson_prediction()


def cmd_smoke_test(args):
    print("泊松到店人数预测系统 - 冒烟测试")
    p = RecordProcessor()

    normal_data = [
        {"date": "2026-06-01", "store_id": "S001", "predicted_foot_traffic": 156.3, "poisson_lambda": 150.0},
        {"date": "2026-06-02", "store_id": "S001", "predicted_foot_traffic": 172.5, "poisson_lambda": 165.0},
        {"date": "2026-06-03", "store_id": "S001", "predicted_foot_traffic": 148.7, "poisson_lambda": 145.0},
        {"date": "2026-06-04", "store_id": "S001", "predicted_foot_traffic": 189.2, "poisson_lambda": 180.0},
    ]
    p.import_parameter_sheet(normal_data, "数据组小明")
    p.simulate_manual_deletion(2, "运营阿岚")
    p.mark_gap_records("系统检测")
    p.add_hand_calculation(
        {"date": "2026-06-03", "store_id": "S001", "manual_value": 165.0,
         "formula_used": "旧口径：上周同期*1.1"},
        "运营阿岚"
    )
    conflicts = p.check_conflicts()
    assert len(conflicts) == 1, "冲突数量不对"
    assert p.detect_id_gaps() == [(1, 3)], "断档检测不对"
    r3 = p._find_record(3)
    assert r3.gap_info is not None, "断档信息缺失"
    assert len(r3.conflict_ids) == 1, "冲突ID缺失"
    assert len(r3.state_history) >= 2, "状态变迁链过短"
    p.pause_record(3, "运营阿岚", "测试暂停")
    assert r3.status.value == "paused", "暂停失败"
    p.resume_record(3, "运营阿岚", "测试续局")
    p.teaching_review_record(
        3, "教研组张老师",
        "原始说法测试", "处理原因测试",
        "下一步找谁测试", 148.7
    )
    assert r3.review_info.original_statement != "", "复核信息为空"
    p.resolve_conflict("CF-001", "confirm", "运营阿岚", "测试理由")
    p.create_parameter_version(
        148.7, "2026-06-05", "运营阿岚", "测试版本", [3], "tradeoff"
    )
    vp = p.get_parameter_version_page()
    assert vp["active_version"].version == "v1.0", "参数版本不对"
    cc = vp["consistency_check"]
    assert not cc["has_issues"], "一致性检查失败"
    s = p.get_summary()
    assert s["total_records"] == 3, "记录数量不对"
    d3 = p.get_record_detail(3)
    assert d3 is not None, "详情为空"
    assert "state_history" in d3 and len(d3["state_history"]) >= 5, "详情状态链不足"
    csv_text = p.export_to_csv()
    assert csv_text and "record_id" in csv_text, "CSV导出失败"
    report = p.get_report()
    assert "summary" in report and "parameter_version_page" in report, "报告结构异常"

    print("✓ 冒烟测试通过:")
    print(f"   - 导入/删除/断档检测:  OK (断档={p.detect_id_gaps()})")
    print(f"   - 手算反例/冲突检测:   OK (冲突={len(conflicts)})")
    print(f"   - 暂停/续局:           OK (状态链={len(r3.state_history)}步)")
    print(f"   - 教研组复核:          OK (复核人={r3.review_info.reviewed_by})")
    print(f"   - 运营决策:            OK (状态={r3.status.value})")
    print(f"   - 参数版本+一致性:     OK (版本={vp['active_version'].version})")
    print(f"   - 列表/详情/摘要:      OK (总数={s['total_records']})")
    print(f"   - CSV导出/报告:        OK")
    return 0


def cmd_interactive(args):
    print("泊松到店人数预测系统 - 交互模式（运行完整演示，结束后导出数据）")
    rc = demo_poisson_prediction()
    if rc != 0:
        return rc
    print("\n运行结束。")
    return 0


def cmd_e2e_test(args):
    from test_record3_pipeline import run_record3_e2e
    return run_record3_e2e()


def build_parser():
    parser = argparse.ArgumentParser(
        prog="poisson_prediction",
        description="泊松到店人数预测 - 参数调试表/手算反例/编号断档/暂停续局/教研组复核 全流程系统"
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_demo = sub.add_parser("demo", help="运行完整演示（编号3全链路10步）")
    p_demo.set_defaults(func=cmd_run_demo)

    p_smoke = sub.add_parser("smoke", help="冒烟测试（验证系统各模块可用）")
    p_smoke.set_defaults(func=cmd_smoke_test)

    p_e2e = sub.add_parser("e2e", help="E2E测试（编号3断档+冲突全链路，7项断言）")
    p_e2e.set_defaults(func=cmd_e2e_test)

    p_inter = sub.add_parser("run", help="交互运行模式")
    p_inter.set_defaults(func=cmd_interactive)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
