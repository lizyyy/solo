#!/usr/bin/env python3
import sys
from typing import List
from models import EvaluationRecord, RecordStatus, DataSource
from processor import RecordProcessor
from data_import import (
    create_demo_data, create_night_supplement_points,
    create_ramp_supplement
)


def print_separator(title: str = ""):
    line = "=" * 70
    if title:
        print(f"\n{line}")
        print(f"  {title}")
        print(line)
    else:
        print(f"\n{line}")


def print_record(record: EvaluationRecord, show_details: bool = True):
    status_colors = {
        RecordStatus.SMOOTH: "\033[92m",
        RecordStatus.RAMP_NO_CHANGE: "\033[93m",
        RecordStatus.NIGHT_SUPPLEMENT: "\033[94m",
        RecordStatus.PENDING_REVIEW: "\033[91m",
        RecordStatus.NORMAL: "\033[92m",
    }
    color = status_colors.get(record.status, "\033[0m")
    reset = "\033[0m"

    print(f"\n【记录编号】{record.id}")
    print(f"【道路名称】{record.road_name}（{record.district}）")
    print(f"【当前状态】{color}{record.status.value}{reset}")
    print(f"【当前评分】{record.score:.1f}分", end="")
    if record.previous_score is not None:
        diff = record.score - record.previous_score
        diff_str = f"+{diff:.1f}" if diff >= 0 else f"{diff:.1f}"
        print(f" （上版：{record.previous_score:.1f}分，变化：{diff_str}）")
    else:
        print()
    print(f"【版本号】v{record.version}", end="")
    tags = []
    if record.is_rerun:
        tags.append("已重跑")
    if record.has_manual_correction:
        tags.append("含人工修正")
    if record.review_night_supplemented:
        tags.append("已补夜间采样")
    if tags:
        print(f"  标签：{'、'.join(tags)}")
    else:
        print()

    if show_details:
        print(f"\n  采样点详情：")
        for p in record.sampling_points:
            src_tag = f"[{p.data_source.value}]"
            remark_tag = " ⚠️有备注" if p.has_remarks else ""
            print(f"    - {p.name} {src_tag} 透水率：{p.permeability_rate:.2f}{remark_tag}")
            if p.remarks:
                print(f"      备注：{p.remarks}")

        if record.ramp:
            ramp_status = "✅有坡道" if record.ramp.has_ramp else "❌无坡道"
            print(f"\n  无障碍坡道：{ramp_status}（{record.ramp.location}）")
            if record.ramp.ramp_slope:
                print(f"    坡度：{record.ramp.ramp_slope}%")
            if record.ramp.ramp_remarks:
                print(f"    备注：{record.ramp.ramp_remarks}")

        if record.rectification_suggestions:
            print(f"\n  整改建议：")
            for i, s in enumerate(record.rectification_suggestions, 1):
                print(f"    {i}. {s}")

        if record.previous_suggestions and record.previous_suggestions != record.rectification_suggestions:
            print(f"\n  上版整改建议（已更新）：")
            for i, s in enumerate(record.previous_suggestions, 1):
                print(f"    {i}. {s}")

    print()


def print_logs(processor: RecordProcessor, record_id: str = None):
    print_separator("处理日志")
    logs = [l for l in processor.process_logs if l.record_id == record_id] if record_id else processor.process_logs
    for log in logs:
        time_str = log.timestamp.strftime("%H:%M:%S")
        print(f"  [{time_str}] {log.operator} - {log.action}")
        if log.details:
            print(f"          {log.details}")


def run_demo():
    print_separator("海绵城市透水铺装 - 城更项目演示流程")
    print("  城更项目经理阿宁给新人讲流程专用\n")
    print("  今天咱们走一遍完整流程，看三种不同处理结果")
    print("  重点：夜间采样点备注不能洗掉，坡道补录评分没变的别急着归正常")

    processor = RecordProcessor()
    records = create_demo_data()

    print_separator("第一步：首次导入（无障碍坡道记录第一次导入）")
    print("  阿宁：先把白天正式表导进来，看看三条路的初步情况\n")

    processed_records = []
    for rec in records:
        processed = processor.initial_import(rec)
        processed_records.append(processed)
        print_record(processed)

    print("  阿宁：看到了吧？三条路三种开局：")
    print("    ✅ REC-2025-001 幸福路 - 顺利，啥毛病没有")
    print("    ⚠️ REC-2025-002 建设路 - 坡道没记录，回头得补")
    print("    ⏳ REC-2025-003 人民路 - 等夜间采样点回来再说")

    print_separator("第二步：坡道补录")
    print("  阿宁：建设路的坡道我去现场看过了，补录进去\n")

    case2 = processed_records[1]
    ramp_supplement = create_ramp_supplement()
    case2 = processor.supplement_ramp(case2, ramp_supplement)
    processed_records[1] = case2

    print_record(case2)

    print("  阿宁：哎？你看这个情况——")
    print("    坡道补录了，但评分没变（因为原来的扣分点是别的）")
    print("    系统标成「坡道补录评分未变」，这时候别着急归正常")
    print("    得留给交通协管复核确认一下是不是真的没问题")

    print_separator("第三步：补看夜间采样点（阿宁补看夜间采样点）")
    print("  阿宁：人民路的夜间采样点回来了，这里面备注很重要，不能洗\n")

    case3 = processed_records[2]
    night_points = create_night_supplement_points()
    case3 = processor.supplement_night_sampling(case3, night_points)
    processed_records[2] = case3

    print_record(case3)

    print("  阿宁：看到没？整改建议自动更新了——")
    print("    原来只有透水率偏低的建议")
    print("    现在把夜间采样的备注也带进来了：油污堵塞、洒水车影响")
    print("    这些都是一线的实情，洗成一行干净数据就废了")

    print_separator("第四步：人工修正 + 重跑（演示数据里的一次人工修正和一次重跑）")
    print("  阿宁：我再给你们演示下人工修正和重跑怎么用\n")

    print("  → 给人民路做个人工修正，现场情况特殊，评分调一下")
    case3 = processor.manual_correct(
        case3,
        new_score=48.0,
        new_suggestions=[
            "透水率偏低点位（商业街北口测点、商业街南口测点）需检查铺装层堵塞情况",
            "【夜间采样备注】商业街中段夜间测点：晚高峰后发现油污渗漏，透水层疑似堵塞，需环卫冲洗后复测",
            "【夜间采样备注】地铁口夜间测点：夜间洒水车冲洗后数据，白天可能因浮尘影响略低",
            "综合现场情况，建议先安排环卫冲洗，3日后复测"
        ]
    )
    processed_records[2] = case3
    print_record(case3, show_details=False)
    print(f"    人工修正后评分：{case3.score:.1f}分")

    print("\n  → 幸福路数据复核一遍，重跑一次确认")
    case1 = processed_records[0]
    case1 = processor.rerun_evaluation(case1)
    processed_records[0] = case1
    print_record(case1, show_details=False)
    print(f"    重跑后评分：{case1.score:.1f}分（与上次一致，没问题）")

    print_separator("第五步：交通协管复核")
    print("  阿宁：建设路那笔坡道补录评分未变的，现在交通协管看完了\n")

    case2 = processor.confirm_ramp_review(case2)
    processed_records[1] = case2
    print_record(case2)

    print("  阿宁：复核通过，状态改成「正常」了")
    print("    记住这个流程：系统标记 → 人工复核 → 最终确认")
    print("    别让系统自动跳正常，容易漏问题")

    print_separator("第六步：整改建议更新（最终版）")
    print("  阿宁：最后再看一眼三条路的整改建议，三种处理结果完全不一样\n")

    for rec in processed_records:
        print(f"\n  📋 {rec.road_name}（{rec.status.value}）")
        for i, s in enumerate(rec.rectification_suggestions, 1):
            print(f"    {i}. {s}")

    print_separator("流程总结")
    print("  阿宁：总结一下今天讲的三个重点：")
    print()
    print("  1️⃣  顺利记录（幸福路）：")
    print("     一次导入没问题，重跑确认就完事")
    print()
    print("  2️⃣  坡道补录评分没变化（建设路）：")
    print("     系统标黄，别急着归正常，留交通协管复核")
    print("     这是关键控制点，别省！")
    print()
    print("  3️⃣  夜间采样补录旧口径（人民路）：")
    print("     备注原封不动带进来，整改建议跟着变")
    print("     别把那些「油污堵塞」「洒水车影响」洗没了")
    print()
    print("  就这三条，新人记牢了！")
    print_separator()

    return processed_records, processor


def list_records_cmd():
    processor = RecordProcessor()
    records = create_demo_data()
    for rec in records:
        processor.initial_import(rec)
    
    print_separator("当前评估记录列表")
    for rec in records:
        print(f"  {rec.id}  {rec.road_name}  评分：{rec.score:.1f}  状态：{rec.status.value}")


def show_record_cmd(record_id: str):
    processor = RecordProcessor()
    records = create_demo_data()
    processed = [processor.initial_import(r) for r in records]
    
    target = next((r for r in processed if r.id == record_id), None)
    if target:
        print_record(target)
        print_logs(processor, record_id)
    else:
        print(f"未找到记录：{record_id}")


def main():
    if len(sys.argv) < 2:
        run_demo()
        return

    cmd = sys.argv[1]
    if cmd == "demo":
        run_demo()
    elif cmd == "list":
        list_records_cmd()
    elif cmd == "show" and len(sys.argv) >= 3:
        show_record_cmd(sys.argv[2])
    elif cmd == "web":
        print("启动小看板Web界面...")
        from web_app import app
        app.run(debug=False, port=5001, host='0.0.0.0')
    elif cmd == "help":
        print("海绵城市透水铺装 - 城更项目管理工具")
        print()
        print("用法：")
        print("  python cli.py           运行完整演示流程")
        print("  python cli.py demo      运行完整演示流程")
        print("  python cli.py list      列出所有记录")
        print("  python cli.py show <id> 查看单条记录详情")
        print("  python cli.py web       启动小看板Web界面")
    else:
        print(f"未知命令：{cmd}")
        print("使用 python cli.py help 查看帮助")


if __name__ == "__main__":
    main()
