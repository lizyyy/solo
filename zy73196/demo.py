from datetime import datetime
from models import (
    StudentWork,
    BoundaryParams,
    ReviewStatus,
)
from review_service import ReviewService
from calculation_engine import CalculationEngine


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
        answer=24.005,
        unit="cm²",
        is_draft=False,
        raw_content="",
    )

    all_works = [work_normal, work_draft, work_empty_set, work_missing_unit, work_boundary]

    print("【第一步】提交学生作业")
    print("-" * 60)
    for w in all_works:
        record = service.submit_work(w)
        print(f"  提交: {w.id} - {w.student_name} - {w.problem_id}")
        calc_result = engine.calculate(w, record.current_params)
        record.last_calc_result = calc_result
        record.anomaly_flags = [a["type"] for a in calc_result.get("anomalies", [])]
    print()

    print("【第二步】异常一览")
    print("-" * 60)
    anomalies = service.list_anomalies()
    for a in anomalies:
        print(f"  [{a['input_type']}] {a['student']}({a['work_id']}): 状态={a['status']}")
        if a["flags"]:
            print(f"    标记: {a['flags']}")
        record = service.get_record(a["work_id"])
        if record and record.last_calc_result:
            for anom in record.last_calc_result.get("anomalies", []):
                print(f"    - {anom['message']}")
                if anom.get("relation"):
                    print(f"      关系说明: {anom['relation']}")
                if anom.get("handling"):
                    print(f"      处理: {anom['handling']}")
                if anom.get("raw_draft"):
                    print(f"      草稿内容: {anom['raw_draft'][:50]}...")
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
    service.reject("w005", reviewer, "答案偏差略超容差，暂不通过")
    print(f"  w005 钱七: 初始判定不通过")
    print()

    print("【第四步】老叶撤回一次判断并改判")
    print("-" * 60)
    service.withdraw("w005", reviewer, "复核后发现容差设置过严，撤回原判断")
    print(f"  w005: 已撤回原不通过判定")
    print(f"  撤回记录: {service.get_record('w005').withdrawal_record}")
    print()

    print("【第五步】参数调一档后复算")
    print("-" * 60)
    record_w005 = service.get_record("w005")
    old_params = record_w005.current_params
    print(f"  原参数: 容差={old_params.tolerance}, 范围=[{old_params.min_value}, {old_params.max_value}]")

    new_params = BoundaryParams(
        tolerance=0.01,
        min_value=0.0,
        max_value=100.0,
        unit_required=True,
        strict_mode=False,
    )
    new_params.tolerance = 0.02
    print(f"  新参数: 容差={new_params.tolerance}, 范围=[{new_params.min_value}, {new_params.max_value}]")
    print()

    recalc_result = engine.recalculate_with_new_params(record_w005, new_params)
    print(recalc_result["report"])

    service.revise(
        "w005",
        reviewer=reviewer,
        new_status=ReviewStatus.APPROVED,
        reason="容差调至0.02后，答案24.005在允许范围内，予以通过",
        source="param_recalc",
        notes="参数调整记录: tolerance 0.01 → 0.02",
    )
    print(f"  改判结果: {record_w005.current_status.value}")
    print()

    print("【第六步】查看 w005 的完整历史记录")
    print("-" * 60)
    history = service.get_history("w005")
    for h in history:
        old = h.old_status.value if h.old_status else "无"
        print(f"  [{h.timestamp.strftime('%H:%M:%S')}] {h.reviewer}: {old} → {h.new_status.value}")
        print(f"    来源: {h.source} | 原因: {h.reason}")
        if h.notes:
            print(f"    备注: {h.notes}")
    print()

    print("【第七步】查看老叶当天的所有改判")
    print("-" * 60)
    today_changes = service.get_reviewer_daily_changes(reviewer, datetime.now())
    print(f"  老叶 {datetime.now().strftime('%Y-%m-%d')} 共操作 {len(today_changes)} 次:")
    for c in today_changes:
        old = c.old_status.value if c.old_status else "无"
        print(f"    - {c.work_id}: {old} → {c.new_status.value} ({c.source})")
    print()

    print("【第八步】空集合与正常输入的关系追踪")
    print("-" * 60)
    record_w003 = service.get_record("w003")
    calc_w003 = record_w003.last_calc_result
    print(f"  王五(w003) 提交内容: {record_w003.work.raw_content}")
    print(f"  输入类型: {calc_w003['input_type']}")
    for a in calc_w003.get("anomalies", []):
        print(f"  关系说明: {a.get('relation', 'N/A')}")
        print(f"  详细说明: {a.get('detail', 'N/A')}")
    print()

    print("【第九步】学生草稿留存")
    print("-" * 60)
    record_w002 = service.get_record("w002")
    calc_w002 = record_w002.last_calc_result
    print(f"  李四(w002) 草稿内容:")
    for a in calc_w002.get("anomalies", []):
        if a["type"] == "student_draft":
            print(f"    {a.get('raw_draft', 'N/A')}")
            print(f"  草稿与正式: {a.get('relation', 'N/A')}")
    print()

    print("=" * 60)
    print("  演示完成")
    print("=" * 60)


if __name__ == "__main__":
    run_demo()
