"""核心计算逻辑"""

from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from .models import (
    Schedule, GPSRecord, EmployeeRoute, CheckInRecord,
    LateCause, SubsidizeStatus, ExceptionType, CalculationResult, MonthlyReport, Claim
)
from .storage import Storage


class Calculator:
    """补贴计算器"""
    
    def __init__(self, storage: Storage):
        self.storage = storage
        self.work_start_hour = 9
        self.work_start_minute = 0
        self.subsidize_per_minute = 1.0
        self.min_late_minutes = 1
        self.employee_to_office_minutes = 15
    
    def get_work_start_time(self, check_date: date) -> datetime:
        return datetime(
            check_date.year, check_date.month, check_date.day,
            self.work_start_hour, self.work_start_minute, 0
        )
    
    def find_schedule(self, route_id: str, stop_id: str, scheduled_date: date) -> Optional[Schedule]:
        """找到指定线路和站点的时刻表"""
        for s in self.storage.schedules:
            if s.route_id == route_id and s.stop_id == stop_id:
                scheduled_dt = datetime(
                    scheduled_date.year, scheduled_date.month, scheduled_date.day,
                    s.scheduled_time.hour, s.scheduled_time.minute, s.scheduled_time.second
                )
                return Schedule(
                    route_id=s.route_id, route_name=s.route_name,
                    stop_id=s.stop_id, stop_name=s.stop_name,
                    scheduled_time=scheduled_dt, is_weekend=s.is_weekend
                )
        return None
    
    def find_gps_record(self, route_id: str, stop_id: str, record_date: date) -> Optional[GPSRecord]:
        """找到指定日期、线路和站点的GPS记录"""
        for rec in self.storage.gps_records:
            if (rec.route_id == route_id and 
                rec.stop_id == stop_id and 
                rec.record_date == record_date):
                return rec
        return None
    
    def find_check_in(self, employee_id: str, check_date: date) -> Optional[CheckInRecord]:
        """找到员工指定日期的打卡记录"""
        for rec in self.storage.check_in_records:
            if rec.employee_id == employee_id and rec.check_date == check_date:
                return rec
        return None
    
    def find_claim(self, employee_id: str, check_date: date) -> Optional[Claim]:
        """找到员工指定日期的申诉记录"""
        for claim in self.storage.claims:
            if claim.employee_id == employee_id and claim.check_date == check_date:
                return claim
        return None
    
    def is_weekend(self, d: date) -> bool:
        return d.weekday() >= 5
    
    def calculate_employee_day(
        self, 
        employee: EmployeeRoute, 
        check_date: date
    ) -> Optional[CalculationResult]:
        """计算单个员工单日结果"""
        if self.is_weekend(check_date):
            return None
        
        if employee.end_date and check_date > employee.end_date:
            return None
        
        if check_date < employee.effective_date:
            return None
        
        schedule = self.find_schedule(employee.route_id, employee.stop_id, check_date)
        if not schedule:
            return None
        
        work_start = self.get_work_start_time(check_date)
        gps_rec = self.find_gps_record(employee.route_id, employee.stop_id, check_date)
        check_in = self.find_check_in(employee.employee_id, check_date)
        
        result = CalculationResult(
            employee_id=employee.employee_id,
            employee_name=employee.employee_name,
            department=employee.department,
            check_date=check_date,
            scheduled_time=schedule.scheduled_time,
            actual_arrival_time=None,
            check_time=None,
            work_start_time=work_start,
            is_late=False,
            late_minutes=0,
            cause=LateCause.UNKNOWN,
            subsidize_status=SubsidizeStatus.NOT_ELIGIBLE,
            subsidize_amount=0.0,
            exception_type=None,
            route_name=employee.route_id,
            stop_name=employee.stop_name
        )
        
        if check_in and check_in.is_leave:
            result.remark = f"请假: {check_in.leave_type}"
            return result
        
        if not check_in:
            result.exception_type = ExceptionType.NO_CHECK_IN
            result.remark = "未找到打卡记录"
            return result
        
        if not check_in.check_time:
            result.exception_type = ExceptionType.NO_CHECK_IN
            result.remark = "打卡时间缺失"
            return result
        
        result.check_time = check_in.check_time
        
        if not gps_rec:
            result.exception_type = ExceptionType.NO_GPS_RECORD
            result.remark = "未找到GPS到站记录"
            return result
        
        if gps_rec.is_cancelled:
            result.exception_type = ExceptionType.ROUTE_CANCELLED
            result.remark = "当日线路临时取消"
            return result
        
        result.actual_arrival_time = gps_rec.actual_time
        result.route_name = schedule.route_name
        result.stop_name = schedule.stop_name
        
        if not gps_rec.actual_time:
            result.exception_type = ExceptionType.NO_GPS_RECORD
            result.remark = "GPS到站时间缺失"
            return result
        
        check_dt = check_in.check_time
        check_time_only = timedelta(hours=check_dt.hour, minutes=check_dt.minute, seconds=check_dt.second)
        work_time_only = timedelta(hours=work_start.hour, minutes=work_start.minute)
        
        if check_time_only > work_time_only:
            diff_seconds = (check_time_only - work_time_only).total_seconds()
            late_minutes = int(diff_seconds / 60)
            result.is_late = True
            result.late_minutes = late_minutes
        else:
            result.remark = "准点打卡"
            return result
        
        scheduled_dt = schedule.scheduled_time
        scheduled_only = timedelta(
            hours=scheduled_dt.hour, 
            minutes=scheduled_dt.minute, 
            seconds=scheduled_dt.second
        )
        actual_only = timedelta(
            hours=gps_rec.actual_time.hour,
            minutes=gps_rec.actual_time.minute,
            seconds=gps_rec.actual_time.second
        )
        
        if actual_only > scheduled_only:
            shuttle_late_seconds = (actual_only - scheduled_only).total_seconds()
            shuttle_late_minutes = int(shuttle_late_seconds / 60)
            
            expected_arrival_minutes = scheduled_only.total_seconds() / 60
            shuttle_arrival_office_minutes = actual_only.total_seconds() / 60
            
            check_minutes = check_time_only.total_seconds() / 60
            work_start_minutes = work_time_only.total_seconds() / 60
            
            if shuttle_late_minutes >= self.min_late_minutes:
                result.cause = LateCause.SHUTTLE_LATE
                result.subsidize_status = SubsidizeStatus.ELIGIBLE
                
                eligible_minutes = min(late_minutes, shuttle_late_minutes)
                result.subsidize_amount = eligible_minutes * self.subsidize_per_minute
                result.remark = f"班车晚点 {shuttle_late_minutes} 分钟，补贴 {eligible_minutes} 分钟"
            else:
                result.cause = LateCause.PERSONAL
                result.remark = f"班车准点（晚点 {shuttle_late_minutes} 分钟，未达补贴阈值），个人原因迟到"
        else:
            result.cause = LateCause.PERSONAL
            result.remark = "班车准点到达，个人原因迟到"
        
        claim = self.find_claim(employee.employee_id, check_date)
        if claim:
            result.claim_id = claim.claim_id
            if claim.status == "pending":
                result.cause = LateCause.CLAIM_REVIEW
                result.subsidize_status = SubsidizeStatus.PENDING_CLAIM
                result.remark = f"申诉中: {claim.claim_reason}"
            elif claim.status == "approved":
                result.cause = LateCause.CLAIM_APPROVED
                result.subsidize_status = SubsidizeStatus.CLAIM_APPROVED
                result.subsidize_amount = max(result.subsidize_amount, result.late_minutes * self.subsidize_per_minute)
                result.remark = f"申诉通过: {claim.review_comment}"
            elif claim.status == "rejected":
                result.cause = LateCause.CLAIM_REJECTED
                result.subsidize_status = SubsidizeStatus.CLAIM_REJECTED
                result.remark = f"申诉驳回: {claim.review_comment}"
        
        return result
    
    def calculate_month(
        self, 
        year: int, 
        month: int
    ) -> MonthlyReport:
        """计算月度报表"""
        results: List[CalculationResult] = []
        exceptions: List[CalculationResult] = []
        
        employees = self.storage.employee_routes
        active_employees: Dict[str, EmployeeRoute] = {}
        for emp in employees:
            active_employees[emp.employee_id] = emp
        
        employee_set = set()
        shuttle_late_count = 0
        personal_late_count = 0
        exception_count = 0
        total_subsidize = 0.0
        total_late_count = 0
        
        if month == 12:
            next_month = 1
            next_year = year + 1
        else:
            next_month = month + 1
            next_year = year
        
        start_date = date(year, month, 1)
        end_date = date(next_year, next_month, 1) - timedelta(days=1)
        
        current = start_date
        while current <= end_date:
            for emp in employees:
                emp_key = emp.employee_id
                employee_set.add(emp_key)
                result = self.calculate_employee_day(emp, current)
                if result:
                    if result.exception_type:
                        exceptions.append(result)
                        exception_count += 1
                    
                    if result.is_late:
                        total_late_count += 1
                        if result.cause in [LateCause.SHUTTLE_LATE, LateCause.CLAIM_APPROVED]:
                            shuttle_late_count += 1
                        elif result.cause == LateCause.PERSONAL:
                            personal_late_count += 1
                    
                    total_subsidize += result.subsidize_amount
                    results.append(result)
            
            current += timedelta(days=1)
        
        return MonthlyReport(
            report_month=f"{year}-{month:02d}",
            total_employees=len(employee_set),
            total_late_count=total_late_count,
            shuttle_late_count=shuttle_late_count,
            personal_late_count=personal_late_count,
            exception_count=exception_count,
            total_subsidize=total_subsidize,
            results=results,
            exceptions=exceptions
        )
    
    def get_employee_detail(
        self, 
        employee_id: str, 
        year: int, 
        month: int
    ) -> List[CalculationResult]:
        """获取员工月度明细"""
        report = self.calculate_month(year, month)
        return [r for r in report.results if r.employee_id == employee_id]
