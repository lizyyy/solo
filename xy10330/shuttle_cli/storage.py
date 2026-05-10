"""数据存储和导入"""

import csv
import json
import os
from datetime import datetime, date, time
from typing import List, Dict, Optional, Set
from .models import (
    Schedule, GPSRecord, EmployeeRoute, CheckInRecord, Claim,
    LateCause, SubsidizeStatus, ExceptionType, CalculationResult, MonthlyReport
)


class Storage:
    """存储管理类"""
    
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.schedules: List[Schedule] = []
        self.gps_records: List[GPSRecord] = []
        self.employee_routes: List[EmployeeRoute] = []
        self.check_in_records: List[CheckInRecord] = []
        self.claims: List[Claim] = []
        self.results: List[CalculationResult] = []
        self.confirmed_months: Set[str] = set()
        
        self._ensure_data_dir()
        self._load_all()
    
    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
    
    def _load_all(self):
        self.schedules = self._load_schedules()
        self.gps_records = self._load_gps_records()
        self.employee_routes = self._load_employee_routes()
        self.check_in_records = self._load_check_in_records()
        self.claims = self._load_claims()
        self.results = self._load_results()
        self.confirmed_months = self._load_confirmed_months()
    
    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or value.strip() == "":
            return None
        value = value.strip()
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%H:%M:%S", "%H:%M"]:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        return None
    
    def _parse_date(self, value: str) -> Optional[date]:
        if not value or value.strip() == "":
            return None
        value = value.strip()
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        return None
    
    def _load_schedules(self) -> List[Schedule]:
        schedules = []
        file_path = os.path.join(self.data_dir, "schedules.csv")
        if not os.path.exists(file_path):
            return schedules
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                scheduled_time = self._parse_datetime(row.get("scheduled_time", ""))
                if not scheduled_time:
                    continue
                schedules.append(Schedule(
                    route_id=row.get("route_id", "").strip(),
                    route_name=row.get("route_name", "").strip(),
                    stop_id=row.get("stop_id", "").strip(),
                    stop_name=row.get("stop_name", "").strip(),
                    scheduled_time=scheduled_time,
                    is_weekend=row.get("is_weekend", "false").lower() == "true"
                ))
        return schedules
    
    def _load_gps_records(self) -> List[GPSRecord]:
        records = []
        file_path = os.path.join(self.data_dir, "gps_records.csv")
        if not os.path.exists(file_path):
            return records
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                actual_time = self._parse_datetime(row.get("actual_time", ""))
                record_date = self._parse_date(row.get("record_date", ""))
                if not record_date:
                    continue
                records.append(GPSRecord(
                    route_id=row.get("route_id", "").strip(),
                    stop_id=row.get("stop_id", "").strip(),
                    vehicle_id=row.get("vehicle_id", "").strip(),
                    record_date=record_date,
                    actual_time=actual_time,
                    is_cancelled=row.get("is_cancelled", "false").lower() == "true",
                    import_batch=row.get("import_batch", "").strip()
                ))
        return records
    
    def _load_employee_routes(self) -> List[EmployeeRoute]:
        routes = []
        file_path = os.path.join(self.data_dir, "employee_routes.csv")
        if not os.path.exists(file_path):
            return routes
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                effective_date = self._parse_date(row.get("effective_date", ""))
                end_date = self._parse_date(row.get("end_date", ""))
                if not effective_date:
                    continue
                routes.append(EmployeeRoute(
                    employee_id=row.get("employee_id", "").strip(),
                    employee_name=row.get("employee_name", "").strip(),
                    department=row.get("department", "").strip(),
                    route_id=row.get("route_id", "").strip(),
                    stop_id=row.get("stop_id", "").strip(),
                    stop_name=row.get("stop_name", "").strip(),
                    effective_date=effective_date,
                    end_date=end_date
                ))
        return routes
    
    def _load_check_in_records(self) -> List[CheckInRecord]:
        records = []
        file_path = os.path.join(self.data_dir, "check_in_records.csv")
        if not os.path.exists(file_path):
            return records
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                check_time = self._parse_datetime(row.get("check_time", ""))
                check_date = self._parse_date(row.get("check_date", ""))
                if not check_date:
                    continue
                records.append(CheckInRecord(
                    employee_id=row.get("employee_id", "").strip(),
                    check_date=check_date,
                    check_time=check_time,
                    is_leave=row.get("is_leave", "false").lower() == "true",
                    leave_type=row.get("leave_type", "").strip()
                ))
        return records
    
    def _load_claims(self) -> List[Claim]:
        claims = []
        file_path = os.path.join(self.data_dir, "claims.json")
        if not os.path.exists(file_path):
            return claims
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                claim = Claim(
                    claim_id=item.get("claim_id", ""),
                    employee_id=item.get("employee_id", ""),
                    employee_name=item.get("employee_name", ""),
                    check_date=self._parse_date(item.get("check_date", "")),
                    original_cause=LateCause(item.get("original_cause", "")),
                    original_status=SubsidizeStatus(item.get("original_status", "")),
                    claim_reason=item.get("claim_reason", ""),
                    status=item.get("status", "pending"),
                    review_comment=item.get("review_comment", ""),
                    reviewed_at=self._parse_datetime(item.get("reviewed_at", "")) if item.get("reviewed_at") else None
                )
                claims.append(claim)
        return claims
    
    def _load_results(self) -> List[CalculationResult]:
        results = []
        file_path = os.path.join(self.data_dir, "results.json")
        if not os.path.exists(file_path):
            return results
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                result = CalculationResult(
                    employee_id=item.get("employee_id", ""),
                    employee_name=item.get("employee_name", ""),
                    department=item.get("department", ""),
                    check_date=self._parse_date(item.get("check_date", "")),
                    scheduled_time=self._parse_datetime(item.get("scheduled_time", "")) if item.get("scheduled_time") else None,
                    actual_arrival_time=self._parse_datetime(item.get("actual_arrival_time", "")) if item.get("actual_arrival_time") else None,
                    check_time=self._parse_datetime(item.get("check_time", "")) if item.get("check_time") else None,
                    work_start_time=self._parse_datetime(item.get("work_start_time", "")) or datetime(1900, 1, 1, 9, 0, 0),
                    is_late=item.get("is_late", False),
                    late_minutes=item.get("late_minutes", 0),
                    cause=LateCause(item.get("cause", "")),
                    subsidize_status=SubsidizeStatus(item.get("subsidize_status", "")),
                    subsidize_amount=item.get("subsidize_amount", 0.0),
                    exception_type=ExceptionType(item.get("exception_type", "")) if item.get("exception_type") else None,
                    route_name=item.get("route_name", ""),
                    stop_name=item.get("stop_name", ""),
                    remark=item.get("remark", ""),
                    claim_id=item.get("claim_id")
                )
                results.append(result)
        return results
    
    def _load_confirmed_months(self) -> Set[str]:
        file_path = os.path.join(self.data_dir, "confirmed.json")
        if not os.path.exists(file_path):
            return set()
        
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return set(data.get("months", []))
    
    def save_gps_records(self, records: List[GPSRecord]) -> int:
        """保存GPS记录，返回新增数量"""
        existing_keys = set()
        for rec in self.gps_records:
            key = (rec.route_id, rec.stop_id, rec.record_date, rec.import_batch)
            existing_keys.add(key)
        
        new_records = []
        for rec in records:
            key = (rec.route_id, rec.stop_id, rec.record_date, rec.import_batch)
            if key not in existing_keys:
                new_records.append(rec)
                existing_keys.add(key)
        
        if new_records:
            self.gps_records.extend(new_records)
            self._save_gps_records()
        
        return len(new_records)
    
    def _save_gps_records(self):
        file_path = os.path.join(self.data_dir, "gps_records.csv")
        with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "route_id", "stop_id", "vehicle_id", "record_date",
                "actual_time", "is_cancelled", "import_batch"
            ])
            writer.writeheader()
            for rec in self.gps_records:
                writer.writerow({
                    "route_id": rec.route_id,
                    "stop_id": rec.stop_id,
                    "vehicle_id": rec.vehicle_id,
                    "record_date": rec.record_date.strftime("%Y-%m-%d"),
                    "actual_time": rec.actual_time.strftime("%Y-%m-%d %H:%M:%S") if rec.actual_time else "",
                    "is_cancelled": "true" if rec.is_cancelled else "false",
                    "import_batch": rec.import_batch
                })
    
    def save_claims(self):
        file_path = os.path.join(self.data_dir, "claims.json")
        data = []
        for claim in self.claims:
            data.append({
                "claim_id": claim.claim_id,
                "employee_id": claim.employee_id,
                "employee_name": claim.employee_name,
                "check_date": claim.check_date.strftime("%Y-%m-%d"),
                "original_cause": claim.original_cause.value,
                "original_status": claim.original_status.value,
                "claim_reason": claim.claim_reason,
                "status": claim.status,
                "review_comment": claim.review_comment,
                "reviewed_at": claim.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if claim.reviewed_at else ""
            })
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def save_results(self, results: List[CalculationResult]):
        """保存计算结果（试算模式不保存，由调用者决定）"""
        self.results = results
        
        file_path = os.path.join(self.data_dir, "results.json")
        data = []
        for r in results:
            item = {
                "employee_id": r.employee_id,
                "employee_name": r.employee_name,
                "department": r.department,
                "check_date": r.check_date.strftime("%Y-%m-%d"),
                "scheduled_time": r.scheduled_time.strftime("%Y-%m-%d %H:%M:%S") if r.scheduled_time else "",
                "actual_arrival_time": r.actual_arrival_time.strftime("%Y-%m-%d %H:%M:%S") if r.actual_arrival_time else "",
                "check_time": r.check_time.strftime("%Y-%m-%d %H:%M:%S") if r.check_time else "",
                "work_start_time": r.work_start_time.strftime("%Y-%m-%d %H:%M:%S"),
                "is_late": r.is_late,
                "late_minutes": r.late_minutes,
                "cause": r.cause.value,
                "subsidize_status": r.subsidize_status.value,
                "subsidize_amount": r.subsidize_amount,
                "exception_type": r.exception_type.value if r.exception_type else "",
                "route_name": r.route_name,
                "stop_name": r.stop_name,
                "remark": r.remark,
                "claim_id": r.claim_id
            }
            data.append(item)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def save_confirmed_month(self, month: str):
        self.confirmed_months.add(month)
        file_path = os.path.join(self.data_dir, "confirmed.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({"months": list(self.confirmed_months)}, f, ensure_ascii=False, indent=2)
    
    def get_gps_imported_dates(self, route_id: str, stop_id: str) -> Set[date]:
        dates = set()
        for rec in self.gps_records:
            if rec.route_id == route_id and rec.stop_id == stop_id:
                dates.add(rec.record_date)
        return dates
