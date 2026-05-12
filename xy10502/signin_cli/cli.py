import json
import sys
import click
from pathlib import Path
from tabulate import tabulate

from .storage import DataStore
from .services import AttendanceService, SampleDataGenerator
from .models import MakeupStatus, AttendanceStatus, SourceType, generate_id, now_str


def get_store():
    return DataStore(".")


def get_service():
    return AttendanceService(get_store())


def ensure_initialized():
    store = get_store()
    if not store.is_initialized():
        click.echo(click.style("[错误] 项目未初始化，请先运行: signin init", fg="red"))
        sys.exit(1)


@click.group()
def cli():
    pass


@cli.command()
@click.option("--force", is_flag=True, help="强制重新初始化（会覆盖现有数据）")
def init(force):
    store = get_store()
    if store.is_initialized() and not force:
        click.echo(click.style("[提示] 项目已初始化，使用 --force 覆盖", fg="yellow"))
        return
    if force and store.is_initialized():
        import shutil
        shutil.rmtree(store.data_dir)
    ok = store.initialize()
    if ok:
        click.echo(click.style("[成功] 项目初始化完成", fg="green"))
        click.echo(f"  数据目录: {store.data_dir}")
        click.echo(f"  输入目录: {store.input_dir}")
        click.echo(f"  输出目录: {store.output_dir}")
        generator = SampleDataGenerator(store)
        samples = generator.generate_samples(str(store.input_dir))
        click.echo("")
        click.echo(click.style("[样例数据已生成]", fg="cyan"))
        for k, v in samples.items():
            click.echo(f"  {k}: {v}")
        click.echo("")
        click.echo("下一步演示命令:")
        click.echo("  signin import students .signin/input/students.csv")
        click.echo("  signin import courses .signin/input/courses.csv")
        click.echo("  signin import qr .signin/input/qr_records.csv")
        click.echo("  signin import makeup .signin/input/makeup_applications.csv")
        click.echo("  signin check")
        click.echo("  signin report")
    else:
        click.echo(click.style("[提示] 项目已存在", fg="yellow"))


@cli.command(name="import")
@click.argument("type", type=click.Choice(["students", "courses", "qr", "makeup"]))
@click.argument("file_path")
@click.option("--operator", default="system", help="操作人标识")
def import_data(type, file_path, operator):
    ensure_initialized()
    service = get_service()
    fp = Path(file_path)
    if not fp.exists():
        click.echo(click.style(f"[错误] 文件不存在: {file_path}", fg="red"))
        sys.exit(1)
    click.echo(click.style(f"[导入中] {type} -> {file_path}", fg="blue"))
    if type == "students":
        session = service.import_students(str(fp), operator)
    elif type == "courses":
        session = service.import_courses(str(fp), operator)
    elif type == "qr":
        session = service.import_qr_records(str(fp), operator)
    elif type == "makeup":
        session = service.import_makeup_applications(str(fp), operator)
    click.echo("")
    click.echo(click.style("[导入结果]", fg="cyan"))
    headers = ["字段", "值"]
    rows = [
        ["导入批次ID", session.id],
        ["类型", session.source_type],
        ["文件", session.file_name],
        ["状态", session.status],
        ["成功条数", session.records_processed],
        ["跳过条数(幂等)", session.records_skipped],
        ["失败条数", session.records_failed],
        ["时间", session.timestamp],
    ]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    click.echo("")
    click.echo(f"消息: {session.message}")


@cli.command()
@click.option("--course", "course_id", help="指定课程ID检查")
def check(course_id):
    ensure_initialized()
    service = get_service()
    click.echo(click.style("[校验中...]", fg="blue"))
    results = service.run_validation(course_id)
    click.echo("")
    click.echo(click.style("[校验概况]", fg="cyan"))
    headers = ["指标", "数值"]
    rows = [
        ["检查课程数", results["courses_checked"]],
        ["检查学员数", results["students_checked"]],
        ["检查签到记录", results["records_checked"]],
        ["发现问题数", len(results["issues"])],
        ["发现冲突数", len(results["conflicts"])],
    ]
    click.echo(tabulate(rows, headers=headers, tablefmt="simple"))
    if results["issues"]:
        click.echo("")
        click.echo(click.style("[签到问题详情]", fg="yellow"))
        rows = []
        for i, issue in enumerate(results["issues"]):
            rows.append([
                i + 1,
                issue["course"],
                issue["student"],
                " | ".join(issue["errors"]),
            ])
        click.echo(tabulate(rows, headers=["序号", "课程", "学员", "问题"], tablefmt="simple"))
    if results["conflicts"]:
        click.echo("")
        click.echo(click.style("[数据冲突详情]", fg="red"))
        for c in results["conflicts"]:
            if c["type"] == "duplicate_phone":
                click.echo(f"  手机号冲突: {c['phone']} -> {', '.join(c['students'])}")
    store = get_store()
    sessions = store.get_import_sessions()
    if sessions:
        click.echo("")
        click.echo(click.style("[最近导入历史]", fg="blue"))
        rows = []
        for s in sessions[-5:]:
            rows.append([
                s.id[:8],
                s.source_type,
                s.status,
                s.records_processed,
                s.records_skipped,
                s.records_failed,
                s.timestamp,
            ])
        click.echo(tabulate(rows, headers=["批次ID(短)", "类型", "状态", "成功", "跳过", "失败", "时间"], tablefmt="simple"))


@cli.command()
@click.option("--course", "course_id", help="课程ID")
@click.option("--student", "student_id", help="学员ID")
@click.option("--import-id", "import_id", help="导入批次ID")
@click.option("--history", is_flag=True, help="显示历史操作记录")
@click.option("--json", "output_json", is_flag=True, help="JSON输出")
def detail(course_id, student_id, import_id, history, output_json):
    ensure_initialized()
    store = get_store()
    data = {}
    if import_id:
        session = store.get_import_session(import_id)
        if session:
            data["type"] = "import_session"
            data["session"] = session.to_dict()
        else:
            click.echo(click.style(f"[错误] 未找到导入批次: {import_id}", fg="red"))
            sys.exit(1)
    elif course_id:
        course = store.get_course(course_id)
        if not course:
            click.echo(click.style(f"[错误] 未找到课程: {course_id}", fg="red"))
            sys.exit(1)
        records = store.get_attendance_for_course(course_id)
        makeups = store.get_makeup_for_course(course_id)
        data["type"] = "course"
        data["course"] = course.to_dict()
        data["attendance_records"] = [r.to_dict() for r in records]
        data["makeup_applications"] = [m.to_dict() for m in makeups]
    elif student_id:
        student = store.get_student(student_id)
        if not student:
            click.echo(click.style(f"[错误] 未找到学员: {student_id}", fg="red"))
            sys.exit(1)
        records = store.get_attendance_for_student(student_id)
        data["type"] = "student"
        data["student"] = student.to_dict()
        data["attendance_records"] = [r.to_dict() for r in records]
    else:
        click.echo(click.style("[错误] 请指定 --course 或 --student 或 --import-id", fg="red"))
        sys.exit(1)
    if history:
        entity_type = data["type"]
        entity_id = None
        if "session" in data:
            logs = store.get_audit_logs()
            related_ids = data["session"]["import_ids"]
            logs = [l for l in logs if l.entity_id in related_ids]
        elif "course" in data:
            entity_id = data["course"]["id"]
            logs = store.get_audit_logs(entity_type="course", entity_id=entity_id)
            logs2 = store.get_audit_logs(entity_type="attendance")
            logs2 = [l for l in logs2 if any(r["id"] == l.entity_id for r in data.get("attendance_records", []))]
            logs.extend(logs2)
        elif "student" in data:
            entity_id = data["student"]["id"]
            logs = store.get_audit_logs(entity_type="student", entity_id=entity_id)
            logs2 = store.get_audit_logs(entity_type="attendance")
            logs2 = [l for l in logs2 if any(r["id"] == l.entity_id for r in data.get("attendance_records", []))]
            logs.extend(logs2)
        else:
            logs = []
        data["audit_logs"] = [l.to_dict() for l in logs]
    if output_json:
        click.echo(json.dumps(data, ensure_ascii=False, indent=2))
    else:
        if data["type"] == "course":
            c = data["course"]
            click.echo(click.style("[课程详情]", fg="cyan"))
            rows = [
                ["ID", c["id"]],
                ["名称", c["name"]],
                ["讲师", c["instructor"]],
                ["时间", f"{c['start_date']} {c['start_time']} - {c['end_date']} {c['end_time']}"],
                ["跨天", "是" if c["start_date"] != c["end_date"] else "否"],
                ["总课时", c["total_hours"]],
            ]
            click.echo(tabulate(rows, headers=["字段", "值"], tablefmt="simple"))
            if data["attendance_records"]:
                click.echo("")
                click.echo(click.style("[签到记录]", fg="blue"))
                rows = []
                for r in data["attendance_records"]:
                    student = store.get_student(r["student_id"])
                    rows.append([
                        r["id"][:8],
                        student.name if student else "未知",
                        r["source"],
                        r["status"],
                        r["signin_time"] or "-",
                        r["signout_time"] or "-",
                        " | ".join(r["validation_errors"]) or "-",
                    ])
                click.echo(tabulate(rows, headers=["记录ID", "学员", "来源", "状态", "签到时间", "签退时间", "备注"], tablefmt="simple"))
            if data["makeup_applications"]:
                click.echo("")
                click.echo(click.style("[补录申请]", fg="yellow"))
                rows = []
                for m in data["makeup_applications"]:
                    student = store.get_student(m["student_id"])
                    rows.append([
                        m["id"][:8],
                        student.name if student else "未知",
                        m["status"],
                        m["submitted_by"],
                        m["reason"][:30] if m["reason"] else "-",
                        m["reviewed_by"] or "-",
                        m["review_comment"] or "-",
                    ])
                click.echo(tabulate(rows, headers=["申请ID", "学员", "状态", "提交人", "原因", "审核人", "审核意见"], tablefmt="simple"))
        elif data["type"] == "student":
            s = data["student"]
            click.echo(click.style("[学员详情]", fg="cyan"))
            rows = [
                ["ID", s["id"]],
                ["姓名", s["name"]],
                ["手机", s["phone"]],
                ["部门", s["department"] or "-"],
                ["状态", "活跃" if s["active"] else "停用"],
            ]
            click.echo(tabulate(rows, headers=["字段", "值"], tablefmt="simple"))
            if data["attendance_records"]:
                click.echo("")
                click.echo(click.style("[签到历史]", fg="blue"))
                rows = []
                for r in data["attendance_records"]:
                    course = store.get_course(r["course_id"])
                    rows.append([
                        course.name if course else "未知课程",
                        r["source"],
                        r["status"],
                        r["signin_time"] or "-",
                        " | ".join(r["validation_errors"]) or "-",
                    ])
                click.echo(tabulate(rows, headers=["课程", "来源", "状态", "签到时间", "备注"], tablefmt="simple"))
        elif data["type"] == "import_session":
            s = data["session"]
            click.echo(click.style("[导入批次详情]", fg="cyan"))
            rows = [
                ["ID", s["id"]],
                ["类型", s["source_type"]],
                ["文件", s["file_name"]],
                ["状态", s["status"]],
                ["成功", s["records_processed"]],
                ["跳过", s["records_skipped"]],
                ["失败", s["records_failed"]],
                ["时间", s["timestamp"]],
            ]
            click.echo(tabulate(rows, headers=["字段", "值"], tablefmt="simple"))
        if "audit_logs" in data and data["audit_logs"]:
            click.echo("")
            click.echo(click.style("[历史操作记录]", fg="magenta"))
            rows = []
            for l in data["audit_logs"]:
                rows.append([
                    l["timestamp"],
                    l["action"],
                    l["entity_type"],
                    l["operator"],
                    l["reason"] or "-",
                    l["detail"] or "-",
                ])
            click.echo(tabulate(rows, headers=["时间", "操作", "实体类型", "操作人", "原因", "详情"], tablefmt="simple"))
            diff_shown = False
            for l in data["audit_logs"]:
                if l.get("before") or l.get("after"):
                    if not diff_shown:
                        click.echo("")
                        click.echo(click.style("[修改前后对比]", fg="yellow"))
                        diff_shown = True
                    click.echo(f"\n--- 操作: {l['action']} @ {l['timestamp']} by {l['operator']} ---")
                    if l.get("before"):
                        click.echo(f"修改前: {json.dumps(l['before'], ensure_ascii=False)}")
                    if l.get("after"):
                        click.echo(f"修改后: {json.dumps(l['after'], ensure_ascii=False)}")


@cli.command()
@click.option("--course", "course_id", help="指定课程ID")
@click.option("--json", "output_json", is_flag=True, help="JSON输出")
@click.option("--save", is_flag=True, help="保存到输出目录")
def report(course_id, output_json, save):
    ensure_initialized()
    service = get_service()
    report_data = service.generate_report(course_id)
    if output_json or save:
        output = json.dumps(report_data, ensure_ascii=False, indent=2)
        if save:
            store = get_store()
            out_path = store.output_dir / f"report_{now_str().replace(':', '-')}.json"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(output)
            click.echo(click.style(f"[报告已保存] {out_path}", fg="green"))
        if output_json:
            click.echo(output)
        return
    summary = report_data["summary"]
    click.echo("")
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style("       线下培训签到结课统计报告", fg="cyan", bold=True))
    click.echo(click.style(f"       生成时间: {report_data['generated_at']}", fg="cyan"))
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo("")
    click.echo(click.style("[全局汇总]", fg="blue"))
    rows = [
        ["课程总数", summary["total_courses"]],
        ["学员总数", summary["total_students"]],
        ["签到记录总数", summary["total_attendance_records"]],
        ["补录申请总数", summary["total_makeup_applications"]],
    ]
    click.echo(tabulate(rows, headers=["指标", "数值"], tablefmt="simple"))
    for cr in report_data["courses"]:
        click.echo("")
        click.echo(click.style("-" * 60, fg="yellow"))
        click.echo(click.style(f"课程: {cr['name']}", fg="yellow", bold=True))
        click.echo(click.style(f"ID: {cr['id']}", fg="yellow"))
        click.echo("")
        click.echo(click.style("[课程基本信息]", fg="cyan"))
        rows = [
            ["讲师", cr["instructor"]],
            ["上课时间", cr["period"]],
            ["是否跨天", "是" if cr["is_multi_day"] else "否"],
            ["计划课时", f"{cr['total_hours']} 小时"],
            ["参训人数", cr["enrolled_students"]],
            ["签到记录数", cr["attendance_records_count"]],
        ]
        click.echo(tabulate(rows, headers=["字段", "值"], tablefmt="simple"))
        click.echo("")
        click.echo(click.style("[签到状态分布]", fg="cyan"))
        status_rows = []
        status_map = {
            "present": "出勤",
            "late": "迟到",
            "early_leave": "早退",
            "late_and_early": "迟到+早退",
            "absent": "缺勤",
            "unknown": "未知",
        }
        for k, v in cr["attendance_status"].items():
            status_rows.append([status_map.get(k, k), v])
        if status_rows:
            click.echo(tabulate(status_rows, headers=["状态", "人数"], tablefmt="simple"))
        else:
            click.echo("  (暂无签到数据)")
        mu = cr["makeup_applications"]
        click.echo("")
        click.echo(click.style("[补录申请情况]", fg="cyan"))
        rows = [
            ["总申请数", mu["total"]],
            ["待审核", mu["pending"]],
            ["已通过", mu["approved"]],
            ["已驳回", mu["rejected"]],
        ]
        click.echo(tabulate(rows, headers=["状态", "数量"], tablefmt="simple"))
        s = cr["settlement"]
        click.echo("")
        click.echo(click.style("[课时结算]", fg="green", bold=True))
        total_possible = cr["total_hours"] * cr["enrolled_students"]
        rows = [
            ["总计划课时", f"{total_possible:.2f} 小时"],
            ["可结算课时", click.style(f"{s['payable_hours']:.2f} 小时", fg="green")],
            ["争议/不可结算课时", click.style(f"{s['disputed_hours']:.2f} 小时", fg="red")],
        ]
        click.echo(tabulate(rows, headers=["项目", "数值"], tablefmt="simple"))
        if s["disputed_reasons"]:
            click.echo("")
            click.echo(click.style("[争议/不可结算明细 - 结课质疑解释]", fg="red", bold=True))
            rows = []
            for i, dr in enumerate(s["disputed_reasons"]):
                rows.append([
                    i + 1,
                    dr["student"],
                    dr["reason"],
                    f"{dr['hours']:.2f}",
                ])
            click.echo(tabulate(rows, headers=["序号", "学员", "原因", "争议课时"], tablefmt="simple"))
    click.echo("")
    click.echo(click.style("=" * 60, fg="cyan"))
    click.echo(click.style("[业务闭环检查]", fg="cyan", bold=True))
    store = get_store()
    issues_found = False
    for cr in report_data["courses"]:
        if cr["settlement"]["disputed_hours"] > 0:
            issues_found = True
            break
    pending_makeups = [m for m in store.get_makeup_applications() if m.status == MakeupStatus.PENDING.value]
    if pending_makeups:
        issues_found = True
    phone_conflicts = {}
    for s in store.get_students():
        same = [x for x in store.get_student_by_phone(s.phone) if x.id != s.id]
        if same:
            if s.phone not in phone_conflicts:
                phone_conflicts[s.phone] = [s]
            for x in same:
                if x not in phone_conflicts[s.phone]:
                    phone_conflicts[s.phone].append(x)
    if phone_conflicts:
        issues_found = True
    if issues_found:
        click.echo(click.style("⚠  存在未闭环项，请先处理后再结课：", fg="yellow"))
        for cr in report_data["courses"]:
            if cr["settlement"]["disputed_hours"] > 0:
                click.echo(click.style(f"   - 课程 '{cr['name']}' 有 {cr['settlement']['disputed_hours']:.2f} 小时争议", fg="yellow"))
        if pending_makeups:
            click.echo(click.style(f"   - 存在 {len(pending_makeups)} 条补录申请待审核", fg="yellow"))
        if phone_conflicts:
            click.echo(click.style(f"   - 发现 {len(phone_conflicts)} 个手机号冲突", fg="yellow"))
    else:
        click.echo(click.style("✓  所有数据闭环，可以结课结算", fg="green"))
    click.echo(click.style("=" * 60, fg="cyan"))


@cli.command("review-makeup")
@click.argument("makeup_id")
@click.option("--approve/--reject", default=None, required=True)
@click.option("--reviewer", required=True, help="审核人")
@click.option("--comment", default="", help="审核意见")
def review_makeup(makeup_id, approve, reviewer, comment):
    ensure_initialized()
    service = get_service()
    store = get_store()
    app = next((m for m in store.get_makeup_applications() if m.id == makeup_id), None)
    if not app:
        click.echo(click.style(f"[错误] 补录申请不存在: {makeup_id}", fg="red"))
        sys.exit(1)
    before = app.to_dict()
    ok = service.review_makeup(makeup_id, approve, reviewer, comment)
    if ok:
        click.echo(click.style(f"[成功] 补录申请已{'通过' if approve else '驳回'}", fg="green"))
        click.echo(f"  申请人: {store.get_student(app.student_id).name if store.get_student(app.student_id) else '未知'}")
        click.echo(f"  审核人: {reviewer}")
        click.echo(f"  意见: {comment or '(无)'}")
    else:
        click.echo(click.style("[失败] 审核失败", fg="red"))


if __name__ == "__main__":
    cli()
