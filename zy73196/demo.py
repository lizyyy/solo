from datetime import datetime
from models import (
    StudentWork,
    BoundaryParams,
    ReviewStatus,
)
from review_service import ReviewService
from calculation_engine import CalculationEngine, _json_safe_value


def _anomaly_summary(anomalies):
    parts = []
    for a in anomalies:
        line = f"[{a.get('severity', '?')}] {a.get('type')}: {a.get('message')}"
        if a.get("source"):
            line += f" (source={a['source']})"
        parts.append(line)
    return "\n".join(parts) if parts else None


def run_demo():
    service = ReviewService()
    engine = CalculationEngine()

    print("=" * 60)
    print("  优化调参边界复核 - 流程演示")
    print("=" * 60)
    print()

    work_normal = StudentWork(
        id="w001",
        student_name="张三",
        problem_id="prob_area_rectangle",
        answer=24.0,
        unit="cm²",
        is_draft=False,
        raw_content="",
    )

    work_draft = StudentWork(
        id="w002",
        student_name="李四",
        problem_id="prob_velocity",
        answer=15.0,
        unit="m/s",
        is_draft=True,
        raw_content="草稿: 先算s=30m, t=2s, v=s/t=30/2=15... 好像还要再检查一下",
    )

    work_empty_set = StudentWork(
        id="w003",
        student_name="王五",
        problem_id="prob_set_operation",
        answer=[],
        unit=None,
        is_draft=False,
        raw_content="A∩B 好像没有公共元素",
    )

    work_missing_unit = StudentWork(
        id="w004",
        student_name="赵六",
        problem_id="prob_perimeter",
        answer=20.0,
        unit=None,
        is_draft=False,
        raw_content="长6宽4，周长=(6+4)*2=20",
    )

    work_boundary = StudentWork(
        id="w005",
        student_name="钱七",
        problem_id="prob_area_rectangle",
        answer=24.015,
        unit="cm²",
        is_draft=False,
        raw_content="",
    )

    all_works = [work_normal, work_draft, work_empty_set, work_missing_unit, work_boundary]

    print("【第一步】提交学生作业（先计算异常，再入库）")
    print("-" * 60)
    for w in all_works:
        params = BoundaryParams()
        calc_result = engine.calculate(w, params)
        anomalies = calc_result.get("anomalies", [])
        flags = [a["type"] for a in anomalies]
        notes = _anomaly_summary(anomalies)
        record = service.submit_work(
            w, submission_notes=notes, anomaly_flags=flags,
        )
        record.current_params = params
        record.last_calc_result = calc_result
        print(f"  提交: {w.id} - {w.student_name}")
        print(f"    input_type={calc_result['input_type']}")
        print(f"    is_correct={calc_result.get('is_correct')}")
        if flags:
            print(f"    anomaly_flags={flags}")
        if notes:
            for line in notes.splitlines():
                print(f"    -> {line}")
    print()

    print("【第二步】异常一览")
    print("-" * 60)
    anomalies = service.list_anomalies()
    for a in anomalies:
        print(f"  [{a['input_type']}] {a['student']}({a['work_id']}): 状态={a['status']}")
        print(f"    标记: {a['flags']}")
        record = service.get_record(a["work_id"])
        if record and record.last_calc_result:
            for anom in record.last_calc_result.get("anomalies", []):
                print(f"    - {anom['message']}  (source={anom.get('source')})")
                if anom.get("relation"):
                    print(f"      关系说明: {anom['relation']}")
                if anom.get("handling"):
                    print(f"      处理: {anom['handling']}")
                if anom.get("reason"):
                    print(f"      原因: {anom['reason']}")
                if anom.get("raw_draft"):
                    print(f"      草稿: {anom['raw_draft'][:60]}")
    print()

    print("【第三步】数学老师老叶开始复核")
    print("-" * 60)
    reviewer = "老叶"

    service.start_review("w001", reviewer)
    service.approve("w001", reviewer, "答案正确，单位齐全")
    print(f"  w001 张三: 通过")

    service.start_review("w002", reviewer)
    service.approve("w002", reviewer, "草稿演算过程清晰，最终答案正确")
    print(f"  w002 李四(草稿): 通过，保留草稿记录")

    service.start_review("w003", reviewer)
    service.reject("w003", reviewer, "空集合需确认，暂不通过，等待学生说明")
    print(f"  w003 王五(空集合): 暂不通过，需人工确认")

    service.start_review("w004", reviewer)
    service.reject("w004", reviewer, "单位缺失，按异常处理，退回补填")
    print(f"  w004 赵六(单位缺失): 异常处理 - 退回补填")
    service.add_supplementary_note(
        "w004", reviewer, "题目要求单位为米(m)，学生仅填了数字"
    )
    print(f"         已添加后补说明")

    service.start_review("w005", reviewer)
    rec_w005 = service.get_record("w005")
    old_diff = rec_w005.last_calc_result.get("difference", {})
    print(f"  w005 钱七: 初始计算 |差值|={old_diff.get('absolute')}, 容差={old_diff.get('tolerance')}, 容差内={old_diff.get('within_tolerance')}")
    service.reject("w005", reviewer, f"答案偏差{old_diff.get('absolute')}超过容差{old_diff.get('tolerance')}，判定不通过")
    print(f"  w005 钱七: 初始判定不通过")
    print()

    print("【第四步】老叶撤回不通过判断（准备调参复算）")
    print("-" * 60)
    service.withdraw("w005", reviewer, "复核后发现容差设置过严，先撤回，调参后复算")
    rec_w005 = service.get_record("w005")
    print(f"  w005: 已撤回原不通过判定")
    print(f"  撤回记录: {rec_w005.withdrawal_record}")
    print()

    print("【第五步】参数调一档后复算（容差 0.01 → 0.02）")
    print("-" * 60)
    old_params = rec_w005.current_params
    print(f"  原参数: 容差={old_params.tolerance}, 范围=[{old_params.min_value}, {old_params.max_value}]")

    new_params = BoundaryParams(
        tolerance=0.02,
        min_value=0.0,
        max_value=100.0,
        unit_required=True,
        strict_mode=False,
    )
    print(f"  新参数: 容差={new_params.tolerance}, 范围=[{new_params.min_value}, {new_params.max_value}]")
    print()

    recalc_result = engine.recalculate_with_new_params(rec_w005, new_params)
    print(recalc_result["report"])

    changes = recalc_result["changes"]
    outcome_change = changes.get("outcome", {}).get("is_correct")
    if outcome_change:
        print(f"  >>> 复算导致判定翻转: {outcome_change['old']} → {outcome_change['new']}")
        new_status = ReviewStatus.APPROVED if outcome_change["new"] else ReviewStatus.REJECTED
        service.revise(
            "w005",
            reviewer=reviewer,
            new_status=new_status,
            reason=(
                f"容差调至{new_params.tolerance}后，复算结论翻转，予以"
                f"{'通过' if outcome_change['new'] else '不通过'}"
            ),
            source="param_recalc",
            notes=(
                f"参数调整: tolerance {old_params.tolerance} → {new_params.tolerance}; "
                f"复算变化原因: {'; '.join(outcome_change.get('reasons', []))}"
            ),
        )
    print(f"  当前状态: {rec_w005.current_status.value}")
    print()

    print("【第六步】查看 w005 的完整历史记录（含来源、异常原因）")
    print("-" * 60)
    history = service.get_history("w005")
    for h in history:
        old = h.old_status.value if h.old_status else "无"
        print(f"  [{h.timestamp.strftime('%H:%M:%S')}] {h.reviewer}: {old} → {h.new_status.value}")
        print(f"    来源: {h.source} | 原因: {h.reason}")
        if h.notes:
            for line in h.notes.splitlines():
                print(f"    notes: {line}")
    print()

    print("【第七步】查看老叶当天的所有改判")
    print("-" * 60)
    today_changes = service.get_reviewer_daily_changes(reviewer, datetime.now())
    print(f"  老叶 {datetime.now().strftime('%Y-%m-%d')} 共操作 {len(today_changes)} 次:")
    for c in today_changes:
        old = c.old_status.value if c.old_status else "无"
        print(f"    - {c.work_id}: {old} → {c.new_status.value} (source={c.source})")
    print()

    print("【第八步】空集合与正常输入的关系追踪")
    print("-" * 60)
    record_w003 = service.get_record("w003")
    calc_w003 = record_w003.last_calc_result
    print(f"  王五(w003) 提交内容: {record_w003.work.raw_content}")
    print(f"  输入类型: {calc_w003['input_type']}")
    for a in calc_w003.get("anomalies", []):
        print(f"  来源: {a.get('source')}")
        print(f"  关系说明: {a.get('relation', 'N/A')}")
        print(f"  详细说明: {a.get('detail', 'N/A')}")
    print()

    print("【第九步】学生草稿留存 + 单位缺失异常处理记录")
    print("-" * 60)
    record_w002 = service.get_record("w002")
    calc_w002 = record_w002.last_calc_result
    print(f"  李四(w002) 草稿内容:")
    for a in calc_w002.get("anomalies", []):
        if a["type"] == "student_draft":
            print(f"    {a.get('raw_draft', 'N/A')}")
            print(f"  来源: {a.get('source')}")
            print(f"  草稿与正式: {a.get('relation', 'N/A')}")
    print()
    record_w004 = service.get_record("w004")
    history_w004 = service.get_history("w004")
    print(f"  赵六(w004) 单位缺失:")
    print(f"  状态: {record_w004.current_status.value}")
    print(f"  异常标记: {record_w004.anomaly_flags}")
    print(f"  后补说明: {record_w004.supplementary_notes}")
    print(f"  历史中首条 notes（提交时记录的异常原因）:")
    print(f"    {history_w004[0].notes}")
    print()

    print("=" * 60)
    print("  演示完成")
    print("=" * 60)


if __name__ == "__main__":
    run_demo()
