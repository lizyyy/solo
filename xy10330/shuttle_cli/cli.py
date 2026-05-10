"""CLI命令入口"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, date
from typing import List

from .models import (
    CalculationResult, MonthlyReport, Claim,
    LateCause, SubsidizeStatus, GPSRecord
)
from .storage import Storage
from .calculator import Calculator


class CLI:
    def __init__(self, data_dir: str = "./data"):
        self.storage = Storage(data_dir)
        self.calculator = Calculator(self.storage)
    
    def format_result_detail(self, result: CalculationResult) -> str:
        lines = []
        lines.append(f"日期: {result.check_date.strftime('%Y-%m-%d')}")
        lines.append(f"员工: {result.employee_name} ({result.employee_id})")
        lines.append(f"部门: {result.department}")
        lines.append(f"线路: {result.route_name} | 站点: {result.stop_name}")
        
        if result.scheduled_time:
            lines.append(f"班车应到站: {result.scheduled_time.strftime('%H:%M:%S')}")
        else:
            lines.append("班车应到站: -")
        
        if result.actual_arrival_time:
            lines.append(f"班车实到站: {result.actual_arrival_time.strftime('%H:%M:%S')}")
        else:
            lines.append("班车实到站: -")
        
        if result.check_time:
            lines.append(f"打卡时间: {result.check_time.strftime('%H:%M:%S')}")
        else:
            lines.append("打卡时间: -")
        
        lines.append(f"上班时间: {result.work_start_time.strftime('%H:%M:%S')}")
        
        if result.is_late:
            lines.append(f"是否迟到: 是 (迟到 {result.late_minutes} 分钟)")
        else:
            lines.append("是否迟到: 否")
        
        lines.append(f"迟到原因: {result.cause.value}")
        lines.append(f"补贴状态: {result.subsidize_status.value}")
        lines.append(f"补贴金额: ¥{result.subsidize_amount:.2f}")
        
        if result.exception_type:
            lines.append(f"异常类型: {result.exception_type.value}")
        
        lines.append(f"说明: {result.remark}")
        
        if result.claim_id:
            lines.append(f"申诉编号: {result.claim_id}")
        
        return "\n".join(lines)
    
    def format_report_header(self, report: MonthlyReport) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append(f"  月度班车迟到补贴报表 - {report.report_month}")
        lines.append("=" * 80)
        lines.append(f"员工总数: {report.total_employees}")
        lines.append(f"迟到总次数: {report.total_late_count}")
        lines.append(f"  - 班车晚点导致: {report.shuttle_late_count} 次")
        lines.append(f"  - 个人原因: {report.personal_late_count} 次")
        lines.append(f"异常记录数: {report.exception_count}")
        lines.append(f"补贴总金额: ¥{report.total_subsidize:.2f}")
        lines.append("")
        return "\n".join(lines)
    
    def format_exceptions(self, exceptions: List[CalculationResult]) -> str:
        if not exceptions:
            return ""
        
        lines = []
        lines.append("-" * 80)
        lines.append("  异常清单")
        lines.append("-" * 80)
        lines.append(f"{'日期':<12} {'员工':<8} {'部门':<8} {'异常类型':<12} {'说明'}")
        lines.append("-" * 80)
        
        for ex in exceptions:
            lines.append(
                f"{ex.check_date.strftime('%Y-%m-%d'):<12} "
                f"{ex.employee_name:<8} "
                f"{ex.department:<8} "
                f"{ex.exception_type.value if ex.exception_type else '':<12} "
                f"{ex.remark}"
            )
        lines.append("")
        return "\n".join(lines)
    
    def format_results_table(self, results: List[CalculationResult]) -> str:
        subsidized = [r for r in results if r.subsidize_amount > 0]
        if not subsidized:
            return "无可补贴记录\n"
        
        lines = []
        lines.append("-" * 80)
        lines.append("  补贴明细")
        lines.append("-" * 80)
        lines.append(f"{'日期':<12} {'员工':<8} {'部门':<8} {'迟到原因':<10} {'补贴(¥)':<8} {'说明'}")
        lines.append("-" * 80)
        
        for r in subsidized:
            lines.append(
                f"{r.check_date.strftime('%Y-%m-%d'):<12} "
                f"{r.employee_name:<8} "
                f"{r.department:<8} "
                f"{r.cause.value:<10} "
                f"¥{r.subsidize_amount:<7.2f} "
                f"{r.remark}"
            )
        lines.append("")
        return "\n".join(lines)
    
    def cmd_preview(self, year: int, month: int, save: bool = False):
        """试算命令"""
        print(f"正在试算 {year}年{month}月 数据...")
        
        if f"{year}-{month:02d}" in self.storage.confirmed_months:
            print(f"警告: {year}-{month:02d} 月报表已确认，试算结果仅作为参考")
        
        report = self.calculator.calculate_month(year, month)
        
        print(self.format_report_header(report))
        print(self.format_exceptions(report.exceptions))
        print(self.format_results_table(report.results))
        
        if save:
            self.storage.save_results(report.results)
            print(f"结果已保存到 {self.storage.data_dir}/results.json")
        else:
            print("提示: 使用 --save 参数可保存试算结果")
    
    def cmd_employee_detail(self, employee_id: str, year: int, month: int):
        """查看个人明细"""
        details = self.calculator.get_employee_detail(employee_id, year, month)
        
        if not details:
            print(f"未找到员工 {employee_id} 在 {year}-{month:02d} 的记录")
            return
        
        employee_name = details[0].employee_name if details else employee_id
        print("=" * 80)
        print(f"  员工明细 - {employee_name} ({employee_id}) - {year}年{month}月")
        print("=" * 80)
        
        total_late = 0
        total_subsidize = 0.0
        
        for d in details:
            print("-" * 80)
            print(self.format_result_detail(d))
            if d.is_late:
                total_late += 1
            total_subsidize += d.subsidize_amount
        
        print("-" * 80)
        print(f"迟到次数: {total_late} 次")
        print(f"补贴金额: ¥{total_subsidize:.2f}")
    
    def cmd_claim_list(self, status: str = None):
        """查看申诉列表"""
        claims = self.storage.claims
        
        if status:
            claims = [c for c in claims if c.status == status]
        
        if not claims:
            print("暂无申诉记录")
            return
        
        print("=" * 80)
        print(f"  申诉列表 (共 {len(claims)} 条)")
        print("=" * 80)
        print(f"{'编号':<10} {'员工':<8} {'日期':<12} {'状态':<8} {'原因'}")
        print("-" * 80)
        
        for c in claims:
            status_text = {
                "pending": "待审核",
                "approved": "通过",
                "rejected": "驳回"
            }.get(c.status, c.status)
            print(
                f"{c.claim_id:<10} "
                f"{c.employee_name:<8} "
                f"{c.check_date.strftime('%Y-%m-%d'):<12} "
                f"{status_text:<8} "
                f"{c.claim_reason}"
            )
    
    def cmd_claim_submit(
        self, 
        employee_id: str, 
        check_date_str: str, 
        reason: str
    ):
        """提交申诉"""
        check_date = self.storage._parse_date(check_date_str)
        if not check_date:
            print(f"日期格式错误: {check_date_str}")
            return
        
        employee = None
        for emp in self.storage.employee_routes:
            if emp.employee_id == employee_id:
                employee = emp
                break
        
        if not employee:
            print(f"未找到员工: {employee_id}")
            return
        
        for claim in self.storage.claims:
            if claim.employee_id == employee_id and claim.check_date == check_date:
                print(f"该日期已有申诉记录: {claim.claim_id}")
                return
        
        year = check_date.year
        month = check_date.month
        details = self.calculator.get_employee_detail(employee_id, year, month)
        
        day_result = None
        for d in details:
            if d.check_date == check_date:
                day_result = d
                break
        
        if not day_result:
            print(f"未找到 {check_date_str} 的计算结果")
            return
        
        claim_id = f"CLAIM_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        claim = Claim(
            claim_id=claim_id,
            employee_id=employee_id,
            employee_name=employee.employee_name,
            check_date=check_date,
            original_cause=day_result.cause,
            original_status=day_result.subsidize_status,
            claim_reason=reason,
            status="pending"
        )
        
        self.storage.claims.append(claim)
        self.storage.save_claims()
        
        print(f"申诉已提交")
        print(f"申诉编号: {claim_id}")
        print(f"员工: {employee.employee_name}")
        print(f"日期: {check_date_str}")
        print(f"原判定: {day_result.cause.value}")
        print(f"申诉原因: {reason}")
    
    def cmd_claim_review(
        self, 
        claim_id: str, 
        approve: bool, 
        comment: str = ""
    ):
        """审核申诉"""
        claim = None
        for c in self.storage.claims:
            if c.claim_id == claim_id:
                claim = c
                break
        
        if not claim:
            print(f"未找到申诉: {claim_id}")
            return
        
        if claim.status != "pending":
            print(f"该申诉已处理: {claim.status}")
            return
        
        claim.status = "approved" if approve else "rejected"
        claim.review_comment = comment
        claim.reviewed_at = datetime.now()
        
        self.storage.save_claims()
        
        action = "通过" if approve else "驳回"
        print(f"申诉 {claim_id} 已{action}")
        print(f"审核意见: {comment}")
    
    def cmd_confirm(self, year: int, month: int):
        """确认月度报表"""
        month_str = f"{year}-{month:02d}"
        
        if month_str in self.storage.confirmed_months:
            print(f"{month_str} 月报表已确认")
            return
        
        pending_claims = [c for c in self.storage.claims if c.status == "pending"]
        if pending_claims:
            print(f"存在 {len(pending_claims)} 条待审核申诉，请先处理:")
            for c in pending_claims:
                print(f"  - {c.claim_id}: {c.employee_name} {c.check_date}")
            print("请先处理这些申诉后再确认报表")
            return
        
        report = self.calculator.calculate_month(year, month)
        self.storage.save_results(report.results)
        self.storage.save_confirmed_month(month_str)
        
        print(self.format_report_header(report))
        print(f"月度报表已确认并保存")
        
        csv_path = os.path.join(self.storage.data_dir, f"report_{month_str}.csv")
        self._export_report_csv(report, csv_path)
        print(f"CSV报表已导出: {csv_path}")
    
    def _export_report_csv(self, report: MonthlyReport, file_path: str):
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "月份", "日期", "员工ID", "员工姓名", "部门",
                "线路", "站点", "班车应到", "班车实到", "打卡时间",
                "是否迟到", "迟到分钟", "迟到原因", "补贴状态",
                "补贴金额", "异常类型", "说明", "申诉编号"
            ])
            writer.writeheader()
            for r in report.results:
                writer.writerow({
                    "月份": report.report_month,
                    "日期": r.check_date.strftime("%Y-%m-%d"),
                    "员工ID": r.employee_id,
                    "员工姓名": r.employee_name,
                    "部门": r.department,
                    "线路": r.route_name,
                    "站点": r.stop_name,
                    "班车应到": r.scheduled_time.strftime("%H:%M:%S") if r.scheduled_time else "",
                    "班车实到": r.actual_arrival_time.strftime("%H:%M:%S") if r.actual_arrival_time else "",
                    "打卡时间": r.check_time.strftime("%H:%M:%S") if r.check_time else "",
                    "是否迟到": "是" if r.is_late else "否",
                    "迟到分钟": r.late_minutes,
                    "迟到原因": r.cause.value,
                    "补贴状态": r.subsidize_status.value,
                    "补贴金额": r.subsidize_amount,
                    "异常类型": r.exception_type.value if r.exception_type else "",
                    "说明": r.remark,
                    "申诉编号": r.claim_id or ""
                })
    
    def cmd_import_gps(self, file_path: str, batch: str):
        """导入GPS记录"""
        if not os.path.exists(file_path):
            print(f"文件不存在: {file_path}")
            return
        
        records = []
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                actual_time = self.storage._parse_datetime(row.get("actual_time", ""))
                record_date = self.storage._parse_date(row.get("record_date", ""))
                if not record_date:
                    continue
                
                existing = False
                for rec in self.storage.gps_records:
                    if (rec.route_id == row.get("route_id", "").strip() and
                        rec.stop_id == row.get("stop_id", "").strip() and
                        rec.record_date == record_date):
                        existing = True
                        break
                
                if existing:
                    continue
                
                records.append(GPSRecord(
                    route_id=row.get("route_id", "").strip(),
                    stop_id=row.get("stop_id", "").strip(),
                    vehicle_id=row.get("vehicle_id", "").strip(),
                    record_date=record_date,
                    actual_time=actual_time,
                    is_cancelled=row.get("is_cancelled", "false").lower() == "true",
                    import_batch=batch
                ))
        
        added = self.storage.save_gps_records(records)
        print(f"成功导入 {added} 条新的GPS记录")
        if added < len(records):
            skipped = len(records) - added
            print(f"跳过 {skipped} 条已存在的记录（防止重复补贴）")


def main():
    parser = argparse.ArgumentParser(
        prog="shuttle",
        description="班车迟到补贴核算 CLI"
    )
    parser.add_argument(
        "--data-dir", 
        default="./data",
        help="数据目录 (默认: ./data)"
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    preview_parser = subparsers.add_parser("preview", help="试算月度补贴")
    preview_parser.add_argument("--year", type=int, required=True, help="年份")
    preview_parser.add_argument("--month", type=int, required=True, help="月份 (1-12)")
    preview_parser.add_argument("--save", action="store_true", help="保存试算结果")
    
    detail_parser = subparsers.add_parser("detail", help="查看个人明细")
    detail_parser.add_argument("--employee", type=str, required=True, help="员工ID")
    detail_parser.add_argument("--year", type=int, required=True, help="年份")
    detail_parser.add_argument("--month", type=int, required=True, help="月份 (1-12)")
    
    claim_list_parser = subparsers.add_parser("claims", help="查看申诉列表")
    claim_list_parser.add_argument("--status", type=str, help="状态筛选 (pending/approved/rejected)")
    
    claim_submit_parser = subparsers.add_parser("claim-submit", help="提交申诉")
    claim_submit_parser.add_argument("--employee", type=str, required=True, help="员工ID")
    claim_submit_parser.add_argument("--date", type=str, required=True, help="申诉日期 (YYYY-MM-DD)")
    claim_submit_parser.add_argument("--reason", type=str, required=True, help="申诉原因")
    
    claim_review_parser = subparsers.add_parser("claim-review", help="审核申诉")
    claim_review_parser.add_argument("--claim-id", type=str, required=True, help="申诉编号")
    claim_review_parser.add_argument("--approve", action="store_true", help="通过")
    claim_review_parser.add_argument("--reject", action="store_true", help="驳回")
    claim_review_parser.add_argument("--comment", type=str, default="", help="审核意见")
    
    confirm_parser = subparsers.add_parser("confirm", help="确认月度报表")
    confirm_parser.add_argument("--year", type=int, required=True, help="年份")
    confirm_parser.add_argument("--month", type=int, required=True, help="月份 (1-12)")
    
    import_parser = subparsers.add_parser("import-gps", help="导入GPS记录")
    import_parser.add_argument("--file", type=str, required=True, help="CSV文件路径")
    import_parser.add_argument("--batch", type=str, required=True, help="导入批次号")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    cli = CLI(args.data_dir)
    
    if args.command == "preview":
        cli.cmd_preview(args.year, args.month, args.save)
    
    elif args.command == "detail":
        cli.cmd_employee_detail(args.employee, args.year, args.month)
    
    elif args.command == "claims":
        cli.cmd_claim_list(args.status)
    
    elif args.command == "claim-submit":
        cli.cmd_claim_submit(args.employee, args.date, args.reason)
    
    elif args.command == "claim-review":
        if args.approve and args.reject:
            print("错误: 不能同时指定 --approve 和 --reject")
            return
        if not args.approve and not args.reject:
            print("错误: 必须指定 --approve 或 --reject")
            return
        cli.cmd_claim_review(args.claim_id, args.approve, args.comment)
    
    elif args.command == "confirm":
        cli.cmd_confirm(args.year, args.month)
    
    elif args.command == "import-gps":
        cli.cmd_import_gps(args.file, args.batch)


if __name__ == "__main__":
    main()
