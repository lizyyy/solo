"""规则引擎模块

实现封签连续性、药品近效、设备借还冲突、照片时间异常等检查规则。
"""

import hashlib
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from enum import Enum
from typing import List, Optional, Dict, Any, Set

from .models import (
    LedgerManager,
    ScanRecord,
    MedicationExpiry,
    MaintenanceBorrow,
)
from .metadata_parser import PhotoMetadata


class Severity(Enum):
    """检查结果严重程度"""
    
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"


class CheckCategory(Enum):
    """检查类别"""
    
    SEAL_CONTINUITY = "封签连续性"
    MEDICATION_EXPIRY = "药品效期"
    DEVICE_CONFLICT = "设备借还冲突"
    PHOTO_ANOMALY = "照片时间异常"


@dataclass
class CheckResult:
    """检查结果类"""
    
    rid: str
    category: CheckCategory
    severity: Severity
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    affected_items: List[str] = field(default_factory=list)
    suggestion: Optional[str] = None
    check_time: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "id": self.rid,
            "category": self.category.value,
            "severity": self.severity.value,
            "description": self.description,
            "details": self.details,
            "affected_items": self.affected_items,
            "suggestion": self.suggestion,
            "check_time": self.check_time.isoformat(),
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "CheckResult":
        """从字典创建实例"""
        check_time = datetime.now()
        if data.get("check_time"):
            try:
                check_time = datetime.fromisoformat(data["check_time"])
            except (ValueError, TypeError):
                pass
        
        return cls(
            rid=data.get("id", data.get("rid", "")),
            category=CheckCategory(data.get("category", "封签连续性")),
            severity=Severity(data.get("severity", "medium")),
            description=data.get("description", ""),
            details=data.get("details", {}),
            affected_items=data.get("affected_items", []),
            suggestion=data.get("suggestion"),
            check_time=check_time,
        )


class RuleEngine:
    """规则引擎类"""
    
    def __init__(
        self,
        near_expiry_days: int = 30,
        photo_time_tolerance_minutes: int = 30,
    ):
        """初始化规则引擎
        
        Args:
            near_expiry_days: 近效期阈值天数
            photo_time_tolerance_minutes: 照片时间容差分钟数
        """
        self.near_expiry_days = near_expiry_days
        self.photo_time_tolerance_minutes = photo_time_tolerance_minutes
        self._result_counter = 0
    
    def _generate_result_id(self, prefix: str) -> str:
        """生成结果ID"""
        self._result_counter += 1
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"{prefix}_{timestamp}_{self._result_counter:04d}"
    
    def _extract_seal_number(self, seal_str: str) -> Optional[str]:
        """从封签字符串提取编号
        
        支持纯数字或字母前缀+数字的格式，如：FQ001234, 12345
        """
        if not seal_str:
            return None
        
        seal_str = str(seal_str).strip()
        
        match = re.search(r"([A-Za-z]*\d+)", seal_str)
        if match:
            return match.group(1)
        
        return seal_str
    
    def _get_seal_numeric_part(self, seal_number: str) -> Optional[int]:
        """获取封签编号的数字部分"""
        if not seal_number:
            return None
        
        match = re.search(r"(\d+)$", seal_number)
        if match:
            return int(match.group(1))
        
        return None
    
    def check_seal_continuity(
        self,
        scan_records: List[ScanRecord],
        shift: Optional[str] = None,
    ) -> List[CheckResult]:
        """检查封签连续性
        
        检查同一抢救车的封签编号是否连续递增，检测断签情况。
        
        Args:
            scan_records: 扫码记录列表
            shift: 班次过滤（可选）
        
        Returns:
            检查结果列表
        """
        results: List[CheckResult] = []
        
        if shift:
            scan_records = [r for r in scan_records if r.shift == shift]
        
        car_records: Dict[str, List[ScanRecord]] = {}
        for record in scan_records:
            if record.rescue_car_id not in car_records:
                car_records[record.rescue_car_id] = []
            car_records[record.rescue_car_id].append(record)
        
        for car_id, records in car_records.items():
            if len(records) < 2:
                continue
            
            sorted_records = sorted(
                records,
                key=lambda x: x.scan_time or datetime.min
            )
            
            seal_chain: List[Dict[str, Any]] = []
            for record in sorted_records:
                seal_num = self._extract_seal_number(record.seal_number)
                numeric_part = self._get_seal_numeric_part(seal_num) if seal_num else None
                
                seal_chain.append({
                    "record": record,
                    "seal_number": seal_num,
                    "numeric_part": numeric_part,
                    "scan_time": record.scan_time,
                })
            
            for i in range(1, len(seal_chain)):
                prev = seal_chain[i - 1]
                curr = seal_chain[i]
                
                if prev["numeric_part"] is None or curr["numeric_part"] is None:
                    continue
                
                expected_next = prev["numeric_part"] + 1
                
                if curr["numeric_part"] < prev["numeric_part"]:
                    results.append(CheckResult(
                        rid=self._generate_result_id("SEAL"),
                        category=CheckCategory.SEAL_CONTINUITY,
                        severity=Severity.CRITICAL,
                        description=f"抢救车{car_id}封签编号倒退",
                        details={
                            "rescue_car_id": car_id,
                            "previous_seal": prev["seal_number"],
                            "previous_time": prev["scan_time"].isoformat() if prev["scan_time"] else None,
                            "current_seal": curr["seal_number"],
                            "current_time": curr["scan_time"].isoformat() if curr["scan_time"] else None,
                        },
                        affected_items=[prev["seal_number"], curr["seal_number"]],
                        suggestion="请核实封签是否被更换或扫码记录是否有误",
                    ))
                
                elif curr["numeric_part"] > expected_next:
                    missing_count = curr["numeric_part"] - prev["numeric_part"] - 1
                    results.append(CheckResult(
                        rid=self._generate_result_id("SEAL"),
                        category=CheckCategory.SEAL_CONTINUITY,
                        severity=Severity.HIGH,
                        description=f"抢救车{car_id}封签断签，缺失{missing_count}个封签",
                        details={
                            "rescue_car_id": car_id,
                            "previous_seal": prev["seal_number"],
                            "previous_time": prev["scan_time"].isoformat() if prev["scan_time"] else None,
                            "current_seal": curr["seal_number"],
                            "current_time": curr["scan_time"].isoformat() if curr["scan_time"] else None,
                            "missing_count": missing_count,
                            "expected_next_seal": expected_next,
                        },
                        affected_items=[prev["seal_number"], curr["seal_number"]],
                        suggestion=f"请追查封签{prev['numeric_part'] + 1}到{curr['numeric_part'] - 1}的去向",
                    ))
        
        return results
    
    def check_medication_expiry(
        self,
        medications: List[MedicationExpiry],
        reference_date: Optional[date] = None,
    ) -> List[CheckResult]:
        """检查药品效期
        
        检查药品是否过期或近效期。
        
        Args:
            medications: 药品列表
            reference_date: 参考日期（可选，默认为今天）
        
        Returns:
            检查结果列表
        """
        results: List[CheckResult] = []
        ref_date = reference_date or date.today()
        
        for med in medications:
            if not med.expiry_date:
                continue
            
            days_until = med.days_until_expiry(ref_date)
            
            if days_until < 0:
                results.append(CheckResult(
                    rid=self._generate_result_id("MED"),
                    category=CheckCategory.MEDICATION_EXPIRY,
                    severity=Severity.CRITICAL,
                    description=f"药品{med.name}已过期",
                    details={
                        "medication_id": med.medication_id,
                        "name": med.name,
                        "specification": med.specification,
                        "batch_number": med.batch_number,
                        "expiry_date": med.expiry_date.isoformat(),
                        "days_overdue": abs(days_until),
                        "quantity": med.quantity,
                        "rescue_car_id": med.rescue_car_id,
                    },
                    affected_items=[med.name, med.batch_number],
                    suggestion=f"请立即更换过期药品，该药品已过期{abs(days_until)}天",
                ))
            
            elif days_until <= self.near_expiry_days:
                results.append(CheckResult(
                    rid=self._generate_result_id("MED"),
                    category=CheckCategory.MEDICATION_EXPIRY,
                    severity=Severity.HIGH if days_until <= 7 else Severity.MEDIUM,
                    description=f"药品{med.name}近效期（{days_until}天后过期）",
                    details={
                        "medication_id": med.medication_id,
                        "name": med.name,
                        "specification": med.specification,
                        "batch_number": med.batch_number,
                        "expiry_date": med.expiry_date.isoformat(),
                        "days_until_expiry": days_until,
                        "quantity": med.quantity,
                        "rescue_car_id": med.rescue_car_id,
                    },
                    affected_items=[med.name, med.batch_number],
                    suggestion=f"请在{days_until}天内更换该药品，建议提前备货",
                ))
        
        return results
    
    def check_device_conflict(
        self,
        maintenances: List[MaintenanceBorrow],
        reference_time: Optional[datetime] = None,
    ) -> List[CheckResult]:
        """检查设备借还冲突
        
        检查设备是否借出后巡检仍显示合格，或超期未还。
        
        Args:
            maintenances: 维修借用记录列表
            reference_time: 参考时间（可选，默认为当前时间）
        
        Returns:
            检查结果列表
        """
        results: List[CheckResult] = []
        ref_time = reference_time or datetime.now()
        
        borrowed_devices: Dict[str, List[MaintenanceBorrow]] = {}
        for record in maintenances:
            if record.is_borrowed():
                if record.device_id not in borrowed_devices:
                    borrowed_devices[record.device_id] = []
                borrowed_devices[record.device_id].append(record)
        
        for device_id, borrows in borrowed_devices.items():
            for borrow in borrows:
                if borrow.is_overdue(ref_time):
                    overdue_days = 0
                    if borrow.expected_return_time:
                        overdue_delta = ref_time - borrow.expected_return_time
                        overdue_days = overdue_delta.days
                    
                    results.append(CheckResult(
                        rid=self._generate_result_id("DEV"),
                        category=CheckCategory.DEVICE_CONFLICT,
                        severity=Severity.HIGH,
                        description=f"设备{borrow.device_name}超期未还",
                        details={
                            "record_id": borrow.record_id,
                            "device_id": borrow.device_id,
                            "device_name": borrow.device_name,
                            "operation_type": borrow.operation_type,
                            "request_time": borrow.request_time.isoformat() if borrow.request_time else None,
                            "expected_return_time": borrow.expected_return_time.isoformat() if borrow.expected_return_time else None,
                            "overdue_days": overdue_days,
                            "operator": borrow.operator,
                            "rescue_car_id": borrow.rescue_car_id,
                        },
                        affected_items=[borrow.device_name, borrow.device_id],
                        suggestion=f"请立即追踪该设备去向，已超期{overdue_days}天",
                    ))
                else:
                    results.append(CheckResult(
                        rid=self._generate_result_id("DEV"),
                        category=CheckCategory.DEVICE_CONFLICT,
                        severity=Severity.MEDIUM,
                        description=f"设备{borrow.device_name}当前处于借出状态，巡检时需注意",
                        details={
                            "record_id": borrow.record_id,
                            "device_id": borrow.device_id,
                            "device_name": borrow.device_name,
                            "operation_type": borrow.operation_type,
                            "request_time": borrow.request_time.isoformat() if borrow.request_time else None,
                            "expected_return_time": borrow.expected_return_time.isoformat() if borrow.expected_return_time else None,
                            "operator": borrow.operator,
                            "rescue_car_id": borrow.rescue_car_id,
                        },
                        affected_items=[borrow.device_name, borrow.device_id],
                        suggestion="巡检时请勿标记该设备为合格状态，需确认设备实际位置",
                    ))
        
        return results
    
    def check_photo_anomaly(
        self,
        photos: List[PhotoMetadata],
        reference_time: Optional[datetime] = None,
    ) -> List[CheckResult]:
        """检查照片时间异常
        
        检查照片拍摄时间是否异常，如：
        - 未来时间的照片
        - 过久之前的照片
        - 同一时间点有多张照片（可能被复制）
        
        Args:
            photos: 照片元数据列表
            reference_time: 参考时间（可选，默认为当前时间）
        
        Returns:
            检查结果列表
        """
        results: List[CheckResult] = []
        ref_time = reference_time or datetime.now()
        
        time_groups: Dict[str, List[PhotoMetadata]] = {}
        hash_groups: Dict[str, List[PhotoMetadata]] = {}
        
        for photo in photos:
            if photo.capture_time:
                time_key = photo.capture_time.strftime("%Y%m%d%H%M%S")
                if time_key not in time_groups:
                    time_groups[time_key] = []
                time_groups[time_key].append(photo)
            
            if photo.file_hash:
                if photo.file_hash not in hash_groups:
                    hash_groups[photo.file_hash] = []
                hash_groups[photo.file_hash].append(photo)
            
            if photo.capture_time:
                if photo.capture_time > ref_time + timedelta(minutes=5):
                    future_delta = photo.capture_time - ref_time
                    results.append(CheckResult(
                        rid=self._generate_result_id("PHOTO"),
                        category=CheckCategory.PHOTO_ANOMALY,
                        severity=Severity.HIGH,
                        description=f"照片{photo.filename}拍摄时间为未来时间",
                        details={
                            "filename": photo.filename,
                            "file_path": photo.file_path,
                            "capture_time": photo.capture_time.isoformat(),
                            "reference_time": ref_time.isoformat(),
                            "future_seconds": future_delta.total_seconds(),
                            "file_hash": photo.file_hash,
                        },
                        affected_items=[photo.filename],
                        suggestion="该照片可能被篡改或设备时间异常，请核实",
                    ))
                
                elif photo.capture_time < ref_time - timedelta(days=7):
                    past_delta = ref_time - photo.capture_time
                    results.append(CheckResult(
                        rid=self._generate_result_id("PHOTO"),
                        category=CheckCategory.PHOTO_ANOMALY,
                        severity=Severity.MEDIUM,
                        description=f"照片{photo.filename}拍摄时间较早（{past_delta.days}天前）",
                        details={
                            "filename": photo.filename,
                            "file_path": photo.file_path,
                            "capture_time": photo.capture_time.isoformat(),
                            "reference_time": ref_time.isoformat(),
                            "days_ago": past_delta.days,
                            "file_hash": photo.file_hash,
                        },
                        affected_items=[photo.filename],
                        suggestion="请确认该照片是否为本次巡检拍摄",
                    ))
        
        for file_hash, photo_list in hash_groups.items():
            if len(photo_list) > 1:
                filenames = [p.filename for p in photo_list]
                results.append(CheckResult(
                    rid=self._generate_result_id("PHOTO"),
                    category=CheckCategory.PHOTO_ANOMALY,
                    severity=Severity.HIGH,
                    description=f"发现{len(photo_list)}张相同哈希的照片，可能存在重复或复制",
                    details={
                        "file_hash": file_hash,
                        "photo_count": len(photo_list),
                        "filenames": filenames,
                        "file_paths": [p.file_path for p in photo_list],
                    },
                    affected_items=filenames,
                    suggestion="请核实这些照片是否为重复文件或被复制使用",
                ))
        
        tolerance = timedelta(minutes=self.photo_time_tolerance_minutes)
        sorted_photos = sorted(photos, key=lambda x: x.capture_time or datetime.min)
        
        for i in range(len(sorted_photos)):
            for j in range(i + 1, len(sorted_photos)):
                p1 = sorted_photos[i]
                p2 = sorted_photos[j]
                
                if p1.capture_time and p2.capture_time:
                    time_diff = abs(p2.capture_time - p1.capture_time)
                    if time_diff < timedelta(seconds=1):
                        results.append(CheckResult(
                            rid=self._generate_result_id("PHOTO"),
                            category=CheckCategory.PHOTO_ANOMALY,
                            severity=Severity.MEDIUM,
                            description=f"照片{p1.filename}和{p2.filename}拍摄时间几乎相同",
                            details={
                                "photo1": p1.filename,
                                "photo2": p2.filename,
                                "capture_time1": p1.capture_time.isoformat(),
                                "capture_time2": p2.capture_time.isoformat(),
                                "time_diff_seconds": time_diff.total_seconds(),
                            },
                            affected_items=[p1.filename, p2.filename],
                            suggestion="请确认这两张照片是否为同一时间拍摄的不同角度",
                        ))
        
        return results
    
    def check_all(
        self,
        ledger: LedgerManager,
        photos: List[PhotoMetadata],
        shift: Optional[str] = None,
    ) -> Dict[str, List[CheckResult]]:
        """执行所有检查
        
        Args:
            ledger: 台账管理器
            photos: 照片元数据列表
            shift: 班次过滤（可选）
        
        Returns:
            检查结果字典，键为检查类别
        """
        results: Dict[str, List[CheckResult]] = {}
        
        results["封签连续性检查"] = self.check_seal_continuity(
            ledger.scan_records, shift
        )
        
        results["药品效期检查"] = self.check_medication_expiry(
            ledger.medications
        )
        
        results["设备借还冲突检查"] = self.check_device_conflict(
            ledger.maintenances
        )
        
        results["照片时间异常检查"] = self.check_photo_anomaly(
            photos
        )
        
        return results
