"""
核算模块
"""

from datetime import datetime, date, timedelta
from typing import Dict, List, Any, Optional
from collections import defaultdict

from .models import (
    DataStore, MachineDailyReport, RecordStatus
)


class EfficiencyCalculator:
    """效率计算器"""
    
    def __init__(self, store: DataStore):
        self.store = store
    
    def calculate_daily_reports(self, target_date: Optional[date] = None) -> List[MachineDailyReport]:
        """计算日报"""
        if target_date is None:
            target_date = date.today()
        
        reports = []
        machine_ids = self._get_all_machine_ids()
        
        for machine_id in machine_ids:
            report = self._calculate_machine_report(machine_id, target_date)
            if report:
                reports.append(report)
        
        return reports
    
    def calculate_machine_details(self, machine_id: str, target_date: Optional[date] = None) -> Optional[MachineDailyReport]:
        """计算单台机台明细"""
        if target_date is None:
            target_date = date.today()
        
        return self._calculate_machine_report(machine_id, target_date)
    
    def _get_all_machine_ids(self) -> List[str]:
        """获取所有机台ID"""
        machine_ids = set()
        
        for plan in self.store.plans.values():
            machine_ids.add(plan.machine_id)
        
        for co in self.store.changeovers.values():
            machine_ids.add(co.machine_id)
        
        for ad in self.store.abnormal_downtimes.values():
            machine_ids.add(ad.machine_id)
        
        for pr in self.store.productions.values():
            machine_ids.add(pr.machine_id)
        
        return sorted(list(machine_ids))
    
    def _calculate_machine_report(self, machine_id: str, target_date: date) -> Optional[MachineDailyReport]:
        """计算单台机台的日报"""
        report = MachineDailyReport(
            machine_id=machine_id,
            date=datetime.combine(target_date, datetime.min.time())
        )
        
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date + timedelta(days=1), datetime.min.time())
        
        report.total_minutes = 24 * 60
        
        planned_downtime = 0.0
        abnormal_downtime = 0.0
        actual_output = 0
        
        for co in self.store.changeovers.values():
            if co.machine_id == machine_id and co.status == RecordStatus.VALID:
                overlap = self._calculate_overlap(co.start_time, co.end_time, day_start, day_end)
                if overlap > 0:
                    planned_downtime += overlap
                    report.planned_downtime_sources.append(
                        f"换模[{co.record_id}] {co.from_product}→{co.to_product} "
                        f"{co.start_time.strftime('%H:%M')}-{co.end_time.strftime('%H:%M')} "
                        f"({overlap:.1f}分钟)"
                    )
        
        for ad in self.store.abnormal_downtimes.values():
            if ad.machine_id == machine_id and ad.status == RecordStatus.VALID:
                overlap = self._calculate_overlap(ad.start_time, ad.end_time, day_start, day_end)
                if overlap > 0:
                    abnormal_downtime += overlap
                    report.abnormal_downtime_sources.append(
                        f"异常停机[{ad.record_id}] {ad.downtime_type} "
                        f"{ad.start_time.strftime('%H:%M')}-{ad.end_time.strftime('%H:%M')} "
                        f"({overlap:.1f}分钟) 原因: {ad.reason or '未记录'}"
                    )
        
        for pr in self.store.productions.values():
            if (pr.machine_id == machine_id and 
                pr.status == RecordStatus.VALID and
                day_start <= pr.production_time < day_end):
                actual_output += pr.quantity
        
        report.planned_downtime_minutes = planned_downtime
        report.abnormal_downtime_minutes = abnormal_downtime
        report.actual_output = actual_output
        
        total_downtime = planned_downtime + abnormal_downtime
        report.effective_production_minutes = report.total_minutes - total_downtime
        
        if report.effective_production_minutes > 0:
            report.efficiency = (report.effective_production_minutes / report.total_minutes) * 100
        else:
            report.efficiency = 0
        
        report.exceptions = self._collect_exceptions(machine_id, day_start, day_end)
        
        return report
    
    def _calculate_overlap(self, start1: datetime, end1: datetime, 
                          start2: datetime, end2: datetime) -> float:
        """计算两个时间段的重叠分钟数"""
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)
        
        if overlap_start >= overlap_end:
            return 0.0
        
        return (overlap_end - overlap_start).total_seconds() / 60
    
    def _collect_exceptions(self, machine_id: str, day_start: datetime, 
                           day_end: datetime) -> List[str]:
        """收集异常记录"""
        exceptions = []
        
        for co in self.store.changeovers.values():
            if co.machine_id == machine_id and co.status != RecordStatus.VALID:
                if (day_start <= co.start_time < day_end or
                    day_start <= co.end_time < day_end):
                    exceptions.append(
                        f"换模记录[{co.record_id}]状态: {co.status.value} "
                        f"{co.start_time.strftime('%Y-%m-%d %H:%M')}-{co.end_time.strftime('%H:%M')}"
                    )
        
        for ad in self.store.abnormal_downtimes.values():
            if ad.machine_id == machine_id and ad.status != RecordStatus.VALID:
                if (day_start <= ad.start_time < day_end or
                    day_start <= ad.end_time < day_end):
                    exceptions.append(
                        f"异常停机记录[{ad.record_id}]状态: {ad.status.value} "
                        f"{ad.start_time.strftime('%Y-%m-%d %H:%M')}-{ad.end_time.strftime('%H:%M')} "
                        f"类型: {ad.downtime_type}"
                    )
        
        for pr in self.store.productions.values():
            if pr.machine_id == machine_id and pr.status != RecordStatus.VALID:
                if day_start <= pr.production_time < day_end:
                    exceptions.append(
                        f"产量记录[{pr.record_id}]状态: {pr.status.value} "
                        f"{pr.production_time.strftime('%Y-%m-%d %H:%M')} "
                        f"产品: {pr.product_code}, 数量: {pr.quantity}"
                    )
        
        return exceptions
