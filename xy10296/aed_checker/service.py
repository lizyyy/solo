from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import uuid
from .storage import Storage
from .models import (
    AEDDevice, Volunteer, Supplies, InspectionPlan,
    CheckinRecord, InspectionReport, ExceptionRecord,
    DeviceStatus, InspectionStatus, SuppliesType, ApprovalStatus
)


class AEDService:
    def __init__(self, storage: Storage):
        self.storage = storage

    def generate_id(self, prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:8]}"

    def parse_date(self, date_str: str) -> datetime:
        for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"]:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.fromisoformat(date_str.replace("Z", "+00:00"))

    def register_device(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[AEDDevice]]:
        required = ["device_id", "location", "floor", "room", "model", "serial_number", "installation_date"]
        for field in required:
            if field not in data or not data[field]:
                return False, f"缺少必填字段: {field}", None

        device = AEDDevice(
            device_id=data["device_id"],
            location=data["location"],
            floor=data["floor"],
            room=data["room"],
            model=data["model"],
            serial_number=data["serial_number"],
            installation_date=data["installation_date"],
            status=data.get("status", DeviceStatus.ACTIVE.value),
            assigned_volunteer_id=data.get("assigned_volunteer_id"),
            last_inspection_date=data.get("last_inspection_date"),
            next_inspection_date=data.get("next_inspection_date")
        )
        self.storage.save_device(device)
        return True, "设备档案创建成功", device

    def register_volunteer(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[Volunteer]]:
        required = ["volunteer_id", "name", "phone", "area"]
        for field in required:
            if field not in data or not data[field]:
                return False, f"缺少必填字段: {field}", None

        volunteer = Volunteer(
            volunteer_id=data["volunteer_id"],
            name=data["name"],
            phone=data["phone"],
            email=data.get("email"),
            area=data["area"],
            is_active=data.get("is_active", True)
        )
        self.storage.save_volunteer(volunteer)
        return True, "志愿者注册成功", volunteer

    def register_supplies(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[Supplies]]:
        required = ["supplies_id", "device_id", "supplies_type", "batch_number", "expiration_date", "installation_date"]
        for field in required:
            if field not in data or not data[field]:
                return False, f"缺少必填字段: {field}", None

        if data["supplies_type"] not in [SuppliesType.ELECTRODE_PADS.value, SuppliesType.BATTERY.value]:
            return False, f"耗材类型无效: {data['supplies_type']}", None

        device = self.storage.get_device(data["device_id"])
        if not device:
            return False, f"设备不存在: {data['device_id']}", None

        supplies = Supplies(
            supplies_id=data["supplies_id"],
            device_id=data["device_id"],
            supplies_type=data["supplies_type"],
            batch_number=data["batch_number"],
            expiration_date=data["expiration_date"],
            installation_date=data["installation_date"],
            replacement_date=data.get("replacement_date")
        )
        self.storage.save_supplies(supplies)
        return True, "耗材信息录入成功", supplies

    def create_inspection_plan(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[InspectionPlan]]:
        required = ["plan_id", "device_id", "volunteer_id", "plan_date"]
        for field in required:
            if field not in data or not data[field]:
                return False, f"缺少必填字段: {field}", None

        device = self.storage.get_device(data["device_id"])
        if not device:
            return False, f"设备不存在: {data['device_id']}", None

        volunteer = self.storage.get_volunteer(data["volunteer_id"])
        if not volunteer:
            return False, f"志愿者不存在: {data['volunteer_id']}", None

        if not volunteer.is_active:
            return False, f"志愿者已停用: {volunteer.name}", None

        plan = InspectionPlan(
            plan_id=data["plan_id"],
            device_id=data["device_id"],
            volunteer_id=data["volunteer_id"],
            plan_date=data["plan_date"],
            frequency_days=data.get("frequency_days", 7),
            status=data.get("status", InspectionStatus.PENDING.value),
            notes=data.get("notes")
        )
        self.storage.save_plan(plan)
        return True, "点检计划创建成功", plan

    def volunteer_checkin(self, plan_id: str, checkin_method: str = "app") -> Tuple[bool, str, Optional[CheckinRecord]]:
        plan = self.storage.get_plan(plan_id)
        if not plan:
            return False, f"点检计划不存在: {plan_id}", None

        if plan.status == InspectionStatus.COMPLETED.value:
            return False, "该计划已完成点检", None

        if plan.status == InspectionStatus.MISSED.value:
            return False, "该计划已标记为漏检", None

        volunteer = self.storage.get_volunteer(plan.volunteer_id)
        if not volunteer:
            return False, "志愿者信息异常", None

        checkin_time = datetime.now().isoformat()
        checkin = CheckinRecord(
            checkin_id=self.generate_id("CHK"),
            plan_id=plan_id,
            volunteer_id=plan.volunteer_id,
            device_id=plan.device_id,
            checkin_time=checkin_time,
            checkin_method=checkin_method
        )
        self.storage.save_checkin(checkin)

        plan.checkin_time = checkin_time
        self.storage.save_plan(plan)

        return True, "签到成功", checkin

    def submit_inspection_report(self, data: Dict[str, Any]) -> Tuple[bool, str, Optional[InspectionReport]]:
        required = ["plan_id", "electrode_pads_ok", "battery_ok", "location_visible", "device_clean", "overall_status"]
        for field in required:
            if field not in data:
                return False, f"缺少必填字段: {field}", None

        plan = self.storage.get_plan(data["plan_id"])
        if not plan:
            return False, f"点检计划不存在: {data['plan_id']}", None

        if plan.status == InspectionStatus.COMPLETED.value:
            return False, "该计划已提交报告", None

        if not plan.checkin_time:
            return False, "志愿者尚未签到，不能提交报告", None

        report_id = self.generate_id("RPT")
        report = InspectionReport(
            report_id=report_id,
            plan_id=data["plan_id"],
            volunteer_id=plan.volunteer_id,
            device_id=plan.device_id,
            inspection_date=datetime.now().isoformat(),
            electrode_pads_ok=bool(data["electrode_pads_ok"]),
            battery_ok=bool(data["battery_ok"]),
            location_visible=bool(data["location_visible"]),
            device_clean=bool(data["device_clean"]),
            overall_status=data["overall_status"],
            notes=data.get("notes"),
            approval_status=data.get("approval_status", ApprovalStatus.PENDING.value)
        )

        needs_review = False
        exception_messages = []

        if not report.electrode_pads_ok:
            needs_review = True
            exception_messages.append("电极片检查不通过")
        if not report.battery_ok:
            needs_review = True
            exception_messages.append("电池检查不通过")
        if not report.location_visible:
            needs_review = True
            exception_messages.append("位置标识不清晰")

        if needs_review:
            report.approval_status = ApprovalStatus.PENDING.value
            exception = ExceptionRecord(
                exception_id=self.generate_id("EXC"),
                device_id=plan.device_id,
                exception_type="inspection_issue",
                exception_date=datetime.now().isoformat(),
                description="; ".join(exception_messages),
                severity="high" if len(exception_messages) > 1 else "medium"
            )
            self.storage.save_exception(exception)
            status_msg = "报告已提交，存在问题需待复核"
        else:
            report.approval_status = ApprovalStatus.APPROVED.value
            status_msg = "报告提交成功"

        self.storage.save_report(report)

        plan.status = InspectionStatus.COMPLETED.value
        plan.inspection_time = datetime.now().isoformat()
        self.storage.save_plan(plan)

        device = self.storage.get_device(plan.device_id)
        if device:
            today = datetime.now().strftime("%Y-%m-%d")
            device.last_inspection_date = today
            next_date = datetime.now() + timedelta(days=plan.frequency_days)
            device.next_inspection_date = next_date.strftime("%Y-%m-%d")
            self.storage.save_device(device)

        return True, status_msg, report

    def check_expiring_supplies(self, warning_days: int = 30) -> List[Dict[str, Any]]:
        supplies = self.storage.get_all_supplies()
        today = datetime.now()
        expiring = []

        for s in supplies:
            if s.replacement_date:
                continue
            try:
                exp_date = self.parse_date(s.expiration_date)
                days_left = (exp_date - today).days

                if days_left <= warning_days:
                    device = self.storage.get_device(s.device_id)
                    expiring.append({
                        "supplies_id": s.supplies_id,
                        "device_id": s.device_id,
                        "device_location": device.location if device else "未知",
                        "supplies_type": "电极片" if s.supplies_type == SuppliesType.ELECTRODE_PADS.value else "电池",
                        "batch_number": s.batch_number,
                        "expiration_date": s.expiration_date,
                        "days_left": days_left,
                        "severity": "critical" if days_left <= 0 else "warning"
                    })
            except Exception:
                continue

        return sorted(expiring, key=lambda x: x["days_left"])

    def check_missed_inspections(self) -> List[Dict[str, Any]]:
        plans = self.storage.get_all_plans()
        today = datetime.now().strftime("%Y-%m-%d")
        missed = []

        for plan in plans:
            if plan.status != InspectionStatus.PENDING.value:
                continue

            try:
                plan_date = self.parse_date(plan.plan_date)
                if plan_date.strftime("%Y-%m-%d") < today:
                    volunteer = self.storage.get_volunteer(plan.volunteer_id)
                    device = self.storage.get_device(plan.device_id)

                    plan.status = InspectionStatus.MISSED.value
                    plan.notes = (plan.notes or "") + " [系统标记: 漏检]"
                    self.storage.save_plan(plan)

                    exception = ExceptionRecord(
                        exception_id=self.generate_id("EXC"),
                        device_id=plan.device_id,
                        exception_type="missed_inspection",
                        exception_date=datetime.now().isoformat(),
                        description=f"志愿者 {volunteer.name if volunteer else plan.volunteer_id} 未按时完成点检",
                        severity="high",
                        resolved=False
                    )
                    self.storage.save_exception(exception)

                    missed.append({
                        "plan_id": plan.plan_id,
                        "device_id": plan.device_id,
                        "device_location": device.location if device else "未知",
                        "volunteer_id": plan.volunteer_id,
                        "volunteer_name": volunteer.name if volunteer else "未知",
                        "volunteer_phone": volunteer.phone if volunteer else "未知",
                        "plan_date": plan.plan_date,
                        "status": "漏检"
                    })
            except Exception:
                continue

        return missed

    def get_pending_reviews(self) -> List[Dict[str, Any]]:
        reports = self.storage.get_reports_by_approval(ApprovalStatus.PENDING.value)
        result = []

        for report in reports:
            volunteer = self.storage.get_volunteer(report.volunteer_id)
            device = self.storage.get_device(report.device_id)
            result.append({
                "report_id": report.report_id,
                "plan_id": report.plan_id,
                "device_id": report.device_id,
                "device_location": device.location if device else "未知",
                "volunteer_name": volunteer.name if volunteer else "未知",
                "inspection_date": report.inspection_date,
                "electrode_pads_ok": report.electrode_pads_ok,
                "battery_ok": report.battery_ok,
                "location_visible": report.location_visible,
                "device_clean": report.device_clean,
                "overall_status": report.overall_status,
                "notes": report.notes
            })

        return result

    def review_report(self, report_id: str, approved: bool, reviewer: str, notes: str = "") -> Tuple[bool, str]:
        report = self.storage.get_report(report_id)
        if not report:
            return False, f"报告不存在: {report_id}"

        if report.approval_status != ApprovalStatus.PENDING.value:
            return False, f"报告状态不是待复核: {report.approval_status}"

        report.approval_status = ApprovalStatus.APPROVED.value if approved else ApprovalStatus.REJECTED.value
        report.reviewed_by = reviewer
        report.reviewed_at = datetime.now().isoformat()
        report.notes = (report.notes or "") + f" [复核意见: {'通过' if approved else '驳回'} - {notes}]"
        self.storage.save_report(report)

        return True, f"报告复核{'通过' if approved else '驳回'}成功"

    def get_dashboard_stats(self) -> Dict[str, Any]:
        devices = self.storage.get_all_devices()
        volunteers = self.storage.get_all_volunteers()
        plans = self.storage.get_all_plans()
        reports = self.storage.get_all_reports()
        exceptions = self.storage.get_unresolved_exceptions()

        expiring = self.check_expiring_supplies(30)
        missed = self.check_missed_inspections()
        pending = self.get_pending_reviews()

        completed_plans = [p for p in plans if p.status == InspectionStatus.COMPLETED.value]
        total_plans = [p for p in plans if p.status != InspectionStatus.PENDING.value]
        completion_rate = (len(completed_plans) / len(total_plans) * 100) if total_plans else 0

        return {
            "total_devices": len(devices),
            "active_devices": len([d for d in devices if d.status == DeviceStatus.ACTIVE.value]),
            "total_volunteers": len(volunteers),
            "active_volunteers": len([v for v in volunteers if v.is_active]),
            "total_plans": len(plans),
            "completed_plans": len(completed_plans),
            "missed_plans": len(missed),
            "completion_rate": round(completion_rate, 1),
            "expiring_supplies_count": len(expiring),
            "critical_expiring": len([e for e in expiring if e["severity"] == "critical"]),
            "unresolved_exceptions": len(exceptions),
            "pending_reviews": len(pending)
        }
