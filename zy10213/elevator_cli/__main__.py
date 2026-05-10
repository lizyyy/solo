"""物业电梯维保派单 CLI 入口"""
import argparse
import sys
import json
from datetime import datetime, date
from typing import Optional

from .models import (
    ORDER_TYPE_PERIODIC, ORDER_TYPE_FAULT,
    now_date, str_to_date
)
from .storage import DataStore
from .service import MaintenanceService, ServiceException, calc_import_hash
from .reports import ReportService


DATA_DIR = "./data"


def parse_date(s: str) -> date:
    if not s:
        return None
    try:
        return str_to_date(s)
    except Exception as e:
        raise SystemExit(f"日期格式错误: {s}，请使用 YYYY-MM-DD 格式，例如 2026-05-11")


def _print_error(msg: str, reason: str = ""):
    print(f"【错误】{msg}", file=sys.stderr)
    if reason:
        print(f"       原因说明：{reason}", file=sys.stderr)
    sys.exit(1)


def _print_success(msg: str, data: dict = None):
    print(f"【成功】{msg}")
    if data:
        print(json.dumps(data, ensure_ascii=False, indent=2))


class CLI:
    def __init__(self):
        self.store = DataStore(DATA_DIR)
        self.service = MaintenanceService(self.store)
        self.reports = ReportService(self.service)

    def cmd_building(self, args):
        if args.action == "add":
            try:
                b = self.service.create_building(args.name, args.floors)
                _print_success(f"楼栋 [{args.name}] 创建成功", {
                    "id": b.id,
                    "name": b.name,
                    "floors": b.floors
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)
        elif args.action == "list":
            buildings = self.store.buildings.get_all()
            if not buildings:
                print("暂无楼栋数据")
                return
            print(f"共 {len(buildings)} 栋楼：")
            for b in buildings:
                print(f"  - {b.name}（{b.floors}层）")

    def cmd_elevator(self, args):
        if args.action == "add":
            try:
                e = self.service.create_elevator(args.building, args.code, args.cycle)
                b_name = self.service.get_building_name(e.building_id)
                _print_success(f"电梯 [{args.code}] 添加成功", {
                    "id": e.id,
                    "building": b_name,
                    "code": e.code,
                    "cycle_days": e.maintenance_cycle_days
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)
        elif args.action == "list":
            elevators = self.store.elevators.get_all()
            if not elevators:
                print("暂无电梯数据")
                return
            print(f"共 {len(elevators)} 部电梯：")
            for e in elevators:
                b_name = self.service.get_building_name(e.building_id)
                last = f"上次维保：{e.last_maintenance_date}" if e.last_maintenance_date else "未维保"
                print(f"  - [{b_name}] {e.code}（周期：{e.maintenance_cycle_days}天，{last}）")

    def cmd_tech(self, args):
        if args.action == "add":
            try:
                t = self.service.create_technician(args.name, args.phone)
                _print_success(f"师傅 [{args.name}] 添加成功", {
                    "id": t.id,
                    "name": t.name,
                    "phone": t.phone
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)
        elif args.action == "list":
            techs = self.store.technicians.find(lambda t: t.is_active)
            if not techs:
                print("暂无师傅数据")
                return
            print(f"共 {len(techs)} 位在职师傅：")
            for t in techs:
                phone = f"，电话：{t.phone}" if t.phone else ""
                print(f"  - {t.name}{phone}")
        elif args.action == "vacation":
            start = parse_date(args.start)
            end = parse_date(args.end)
            try:
                v = self.service.add_vacation(args.name, start, end, args.reason)
                _print_success(f"休假记录添加成功", {
                    "师傅": args.name,
                    "休假期间": f"{args.start} ~ {args.end}",
                    "原因": args.reason or "未说明"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

    def cmd_order(self, args):
        if args.action == "periodic":
            planned = parse_date(args.planned) if args.planned else None
            import_hash = ""
            if args.dup_key:
                import_hash = calc_import_hash(
                    elevator_code=args.code,
                    building_name=args.building,
                    planned_date=args.planned or "",
                    order_type=ORDER_TYPE_PERIODIC
                )
            try:
                o = self.service.create_periodic_order(args.code, args.building, planned, import_hash)
                b_name, e_code = self.service.get_elevator_info(o.elevator_id)
                _print_success(f"周期维保单创建成功", {
                    "单号": o.order_no,
                    "楼栋": b_name,
                    "电梯": e_code,
                    "类型": "周期维保",
                    "计划日期": str(o.planned_date),
                    "截止日期": str(o.due_date),
                    "状态": "待派单"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

        elif args.action == "fault":
            planned = parse_date(args.planned) if args.planned else None
            import_hash = ""
            if args.dup_key:
                import_hash = calc_import_hash(
                    elevator_code=args.code,
                    building_name=args.building,
                    fault_desc=args.desc,
                    planned_date=args.planned or "",
                    order_type=ORDER_TYPE_FAULT
                )
            try:
                o = self.service.create_fault_order(args.code, args.building, args.desc, planned, import_hash)
                b_name, e_code = self.service.get_elevator_info(o.elevator_id)
                _print_success(f"故障报修单创建成功", {
                    "单号": o.order_no,
                    "楼栋": b_name,
                    "电梯": e_code,
                    "类型": "故障报修",
                    "故障描述": args.desc,
                    "计划日期": str(o.planned_date),
                    "截止日期": str(o.due_date),
                    "状态": "待派单"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

        elif args.action == "assign":
            try:
                o = self.service.assign_order(args.order_no, args.tech)
                b_name, e_code = self.service.get_elevator_info(o.elevator_id)
                _print_success(f"派单成功", {
                    "单号": o.order_no,
                    "楼栋": b_name,
                    "电梯": e_code,
                    "师傅": args.tech,
                    "状态": "已派单"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

        elif args.action == "complete":
            comp_date = parse_date(args.date) if args.date else None
            try:
                o = self.service.complete_order(
                    args.order_no,
                    proof_url=args.proof,
                    proof_notes=args.notes,
                    completed_date=comp_date
                )
                _print_success(f"维保单 [{args.order_no}] 标记完成", {
                    "完成日期": str(o.completed_date),
                    "凭证链接": o.proof_url or "无",
                    "凭证说明": o.proof_notes or "无"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

        elif args.action == "escalate":
            try:
                o = self.service.escalate_order(args.order_no, args.notes)
                _print_success(f"维保单 [{args.order_no}] 已升级", {
                    "当前状态": "已升级",
                    "备注": args.notes or "无"
                })
            except ServiceException as e:
                _print_error(str(e), e.reason)

        elif args.action == "list":
            orders = self.store.orders.get_all()
            if not orders:
                print("暂无维保单数据")
                return
            print(f"共 {len(orders)} 张维保单：")
            for o in orders:
                b_name, e_code = self.service.get_elevator_info(o.elevator_id)
                type_str = "周期" if o.type == ORDER_TYPE_PERIODIC else "故障"
                tech = self.service.get_tech_name(o.technician_id) or "未派单"
                status_map = {"pending": "待派", "assigned": "已派", "completed": "已完成", "overdue": "已逾期", "escalated": "已升级"}
                status_str = status_map.get(o.status, o.status)
                print(f"  - {o.order_no} [{type_str}] {b_name}-{e_code} | {tech} | {status_str} | 计划:{o.planned_date}")

    def cmd_report(self, args):
        if args.type == "today":
            data = self.reports.get_today_pending_orders()
            today = now_date()
            print(f"=== 今日（{today}）待处理工单 ===")
            if not data:
                print("今日暂无待处理工单")
                return
            print(f"共 {len(data)} 张工单：")
            for i, item in enumerate(data, 1):
                print(f"  {i}. {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']}")
                print(f"     师傅：{item['tech']}，状态：{item['status']}，截止：{item['due_date']}")

        elif args.type == "overdue":
            data = self.reports.get_overdue_orders()
            print(f"=== 已逾期工单 ===")
            if not data:
                print("暂无逾期工单")
                return
            print(f"共 {len(data)} 张逾期工单：")
            for i, item in enumerate(data, 1):
                print(f"  {i}. {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']}")
                print(f"     师傅：{item['tech']}，逾期 {item['overdue_days']} 天，到期日：{item['due_date']}")

        elif args.type == "escalate":
            data = self.reports.get_escalation_needed()
            print(f"=== 需要升级处理的工单 ===")
            if not data:
                print("暂无需要升级的工单")
                return
            print(f"共 {len(data)} 张工单需要升级：")
            for i, item in enumerate(data, 1):
                print(f"  {i}. {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']}")
                print(f"     状态：{item['status']}，师傅：{item['tech']}，逾期 {item['overdue_days']} 天")
                if item['notes']:
                    print(f"     备注：{item['notes']}")

        elif args.type == "monthly":
            year = args.year if args.year else None
            month = args.month if args.month else None
            data = self.reports.get_monthly_completion_rate(year, month)
            print(f"=== {data['year']}年{data['month']}月 完成率统计 ===")
            print(f"总单数：{data['total_orders']}，已完成：{data['completed']}，完成率：{data['completion_rate']}%")
            print(f"  - 周期维保：{data['periodic']['completed']}/{data['periodic']['total']}（{data['periodic']['rate']}%）")
            print(f"  - 故障报修：{data['fault']['completed']}/{data['fault']['total']}（{data['fault']['rate']}%）")
            if data['details']:
                print("\n明细：")
                for d in data['details']:
                    comp = f" -> 完成：{d['completed_date']}" if d['completed_date'] else ""
                    print(f"  - {d['order_no']} [{d['type']}] {d['status']}（计划：{d['planned_date']}{comp}）")

        elif args.type == "all":
            today = now_date()
            print("=" * 60)
            print(f"综合日报 - {today}")
            print("=" * 60)

            pending = self.reports.get_today_pending_orders()
            overdue = self.reports.get_overdue_orders()
            escalate = self.reports.get_escalation_needed()
            monthly = self.reports.get_monthly_completion_rate()

            print(f"\n1. 今日待处理：{len(pending)} 张")
            for item in pending:
                print(f"   {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']} | {item['tech']} | {item['status']}")

            print(f"\n2. 已逾期：{len(overdue)} 张")
            for item in overdue:
                print(f"   {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']} | 逾期{item['overdue_days']}天 | 师傅:{item['tech']}")

            print(f"\n3. 需要升级：{len(escalate)} 张")
            for item in escalate:
                print(f"   {item['order_no']} [{item['type']}] {item['building']}-{item['elevator']} | {item['status']} | 逾期{item['overdue_days']}天")

            print(f"\n4. 本月完成率：{monthly['completion_rate']}%")
            print(f"   总单数：{monthly['total_orders']}，已完成：{monthly['completed']}")
            print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="物业电梯维保派单 CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例：
  # 基础信息
  python3 -m elevator_cli building add "1号楼" --floors 18
  python3 -m elevator_cli elevator add "1号楼" "1#-1" --cycle 30
  python3 -m elevator_cli tech add "张师傅" --phone "13800138000"
  python3 -m elevator_cli tech vacation "张师傅" 2026-05-20 2026-05-22 --reason "年假"

  # 维保单（去重请加 --dup-key）
  python3 -m elevator_cli order periodic "1#-1" --building "1号楼"
  python3 -m elevator_cli order periodic "1#-1" --building "1号楼" --dup-key
  python3 -m elevator_cli order fault "1#-1" --building "1号楼" --desc "电梯运行有异响"
  python3 -m elevator_cli order assign P20260511001 "张师傅"
  python3 -m elevator_cli order complete P20260511001 --proof "https://xxx" --notes "已检查导轨润滑"
  python3 -m elevator_cli order escalate F20260511001 --notes "需要厂家配合"

  # 查看统计
  python3 -m elevator_cli report today
  python3 -m elevator_cli report overdue
  python3 -m elevator_cli report escalate
  python3 -m elevator_cli report monthly --year 2026 --month 5
  python3 -m elevator_cli report all
        """
    )
    subparsers = parser.add_subparsers(dest="cmd", help="命令类别")

    # building
    p_b = subparsers.add_parser("building", help="楼栋管理")
    p_b_sub = p_b.add_subparsers(dest="action", required=True)
    p_b_add = p_b_sub.add_parser("add", help="添加楼栋")
    p_b_add.add_argument("name", help="楼栋名称，如：1号楼、A栋")
    p_b_add.add_argument("--floors", type=int, default=0, help="楼层数")
    p_b_sub.add_parser("list", help="列出所有楼栋")

    # elevator
    p_e = subparsers.add_parser("elevator", help="电梯管理")
    p_e_sub = p_e.add_subparsers(dest="action", required=True)
    p_e_add = p_e_sub.add_parser("add", help="添加电梯")
    p_e_add.add_argument("building", help="所属楼栋名称")
    p_e_add.add_argument("code", help="电梯编号，如：1#-1、左梯")
    p_e_add.add_argument("--cycle", type=int, default=30, help="维保周期（天），默认30天")
    p_e_sub.add_parser("list", help="列出所有电梯")

    # tech
    p_t = subparsers.add_parser("tech", help="师傅管理")
    p_t_sub = p_t.add_subparsers(dest="action", required=True)
    p_t_add = p_t_sub.add_parser("add", help="添加师傅")
    p_t_add.add_argument("name", help="师傅姓名")
    p_t_add.add_argument("--phone", default="", help="联系电话")
    p_t_sub.add_parser("list", help="列出所有在职师傅")
    p_t_vac = p_t_sub.add_parser("vacation", help="添加休假记录")
    p_t_vac.add_argument("name", help="师傅姓名")
    p_t_vac.add_argument("start", help="开始日期 YYYY-MM-DD")
    p_t_vac.add_argument("end", help="结束日期 YYYY-MM-DD")
    p_t_vac.add_argument("--reason", default="", help="休假原因")

    # order
    p_o = subparsers.add_parser("order", help="维保单管理")
    p_o_sub = p_o.add_subparsers(dest="action", required=True)
    p_o_per = p_o_sub.add_parser("periodic", help="创建周期维保单")
    p_o_per.add_argument("code", help="电梯编号")
    p_o_per.add_argument("--building", default="", help="楼栋名称（多栋楼有同编号电梯时必填）")
    p_o_per.add_argument("--planned", default="", help="计划维保日期 YYYY-MM-DD，不填则按周期计算")
    p_o_per.add_argument("--dup-key", action="store_true", help="开启去重检测（防止重复导入）")

    p_o_fault = p_o_sub.add_parser("fault", help="创建故障报修单")
    p_o_fault.add_argument("code", help="电梯编号")
    p_o_fault.add_argument("--building", default="", help="楼栋名称")
    p_o_fault.add_argument("--desc", default="", help="故障描述，如：电梯异响、按键失灵")
    p_o_fault.add_argument("--planned", default="", help="计划处理日期 YYYY-MM-DD")
    p_o_fault.add_argument("--dup-key", action="store_true", help="开启去重检测")

    p_o_assign = p_o_sub.add_parser("assign", help="派单给师傅")
    p_o_assign.add_argument("order_no", help="维保单号")
    p_o_assign.add_argument("tech", help="师傅姓名")

    p_o_comp = p_o_sub.add_parser("complete", help="完成维保单")
    p_o_comp.add_argument("order_no", help="维保单号")
    p_o_comp.add_argument("--proof", default="", help="完成凭证链接（照片/视频地址）")
    p_o_comp.add_argument("--notes", default="", help="完成说明")
    p_o_comp.add_argument("--date", default="", help="实际完成日期 YYYY-MM-DD，默认今天")

    p_o_esc = p_o_sub.add_parser("escalate", help="升级工单")
    p_o_esc.add_argument("order_no", help="维保单号")
    p_o_esc.add_argument("--notes", default="", help="升级原因/说明")

    p_o_sub.add_parser("list", help="列出所有维保单")

    # report
    p_r = subparsers.add_parser("report", help="统计报表")
    p_r_sub = p_r.add_subparsers(dest="type", required=True)
    p_r_sub.add_parser("today", help="今日待处理")
    p_r_sub.add_parser("overdue", help="已逾期工单")
    p_r_sub.add_parser("escalate", help="需要升级的工单")
    p_r_month = p_r_sub.add_parser("monthly", help="月度完成率")
    p_r_month.add_argument("--year", type=int, default=None, help="年份，默认今年")
    p_r_month.add_argument("--month", type=int, default=None, help="月份，默认本月")
    p_r_sub.add_parser("all", help="综合日报（所有统计汇总）")

    args = parser.parse_args()

    if not args.cmd:
        parser.print_help()
        return

    cli = CLI()
    if args.cmd == "building":
        cli.cmd_building(args)
    elif args.cmd == "elevator":
        cli.cmd_elevator(args)
    elif args.cmd == "tech":
        cli.cmd_tech(args)
    elif args.cmd == "order":
        cli.cmd_order(args)
    elif args.cmd == "report":
        cli.cmd_report(args)


if __name__ == "__main__":
    main()
