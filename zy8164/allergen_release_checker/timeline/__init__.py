from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class EventType(Enum):
    BATCH_START = "batch_start"
    BATCH_END = "batch_end"
    CLEANING_START = "cleaning_start"
    CLEANING_END = "cleaning_end"
    LABEL_SWITCH = "label_switch"


@dataclass
class ProductInfo:
    """产品信息"""
    product_code: str
    product_name: str
    allergens: List[str] = field(default_factory=list)
    formula_version: str = ""


@dataclass
class Batch:
    """生产批次"""
    batch_id: str
    production_line: str
    product_info: ProductInfo
    start_time: datetime
    end_time: datetime
    equipment: List[str] = field(default_factory=list)
    label_switch_time: Optional[datetime] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def duration_minutes(self) -> float:
        """返回批次持续时间（分钟）"""
        return (self.end_time - self.start_time).total_seconds() / 60

    def crosses_midnight(self) -> bool:
        """检查是否跨午夜"""
        return self.start_time.date() != self.end_time.date()

    def get_midnight_info(self) -> Optional[Dict[str, Any]]:
        """获取跨午夜信息"""
        if not self.crosses_midnight():
            return None
        
        midnight = datetime.combine(
            self.end_time.date(), datetime.min.time()
        )
        hours_before = (midnight - self.start_time).total_seconds() / 3600
        hours_after = (self.end_time - midnight).total_seconds() / 3600
        
        return {
            "crosses_midnight": True,
            "hours_before_midnight": round(hours_before, 2),
            "hours_after_midnight": round(hours_after, 2),
            "midnight_time": midnight,
        }


@dataclass
class CleaningRecord:
    """清洁记录"""
    record_id: str
    equipment: str
    cleaning_time: datetime
    swab_point: Optional[str] = None
    swab_result: Optional[str] = None
    inspector: str = ""
    notes: str = ""
    raw_data: Dict[str, Any] = field(default_factory=dict)

    def is_valid(self, validity_hours: float = 24) -> bool:
        """检查清洁记录是否在有效期内"""
        now = datetime.now()
        age_hours = (now - self.cleaning_time).total_seconds() / 3600
        return age_hours <= validity_hours


@dataclass
class TimelineEvent:
    """时间线事件"""
    event_type: EventType
    time: datetime
    batch: Optional[Batch] = None
    cleaning_record: Optional[CleaningRecord] = None
    description: str = ""


class ProductionTimeline:
    """产线时间线"""

    def __init__(self, production_line: str):
        self.production_line = production_line
        self.batches: List[Batch] = []
        self.cleaning_records: List[CleaningRecord] = []
        self.events: List[TimelineEvent] = []

    def add_batch(self, batch: Batch):
        """添加批次"""
        if batch.production_line != self.production_line:
            raise ValueError(
                f"批次 {batch.batch_id} 不属于产线 {self.production_line}"
            )
        self.batches.append(batch)

    def add_cleaning_record(self, record: CleaningRecord):
        """添加清洁记录"""
        self.cleaning_records.append(record)

    def sort_all(self):
        """按时间排序所有数据"""
        self.batches.sort(key=lambda b: b.start_time)
        self.cleaning_records.sort(key=lambda r: r.cleaning_time)
        self._generate_events()

    def _generate_events(self):
        """生成时间线事件"""
        self.events = []
        
        for batch in self.batches:
            self.events.append(TimelineEvent(
                event_type=EventType.BATCH_START,
                time=batch.start_time,
                batch=batch,
                description=f"批次 {batch.batch_id} 开始: {batch.product_info.product_name}"
            ))
            self.events.append(TimelineEvent(
                event_type=EventType.BATCH_END,
                time=batch.end_time,
                batch=batch,
                description=f"批次 {batch.batch_id} 结束"
            ))
            
            if batch.label_switch_time:
                self.events.append(TimelineEvent(
                    event_type=EventType.LABEL_SWITCH,
                    time=batch.label_switch_time,
                    batch=batch,
                    description=f"批次 {batch.batch_id} 标签切换"
                ))

        for record in self.cleaning_records:
            self.events.append(TimelineEvent(
                event_type=EventType.CLEANING_START,
                time=record.cleaning_time,
                cleaning_record=record,
                description=f"清洁记录 {record.record_id}: {record.equipment}"
            ))

        self.events.sort(key=lambda e: e.time)

    def get_batches_in_range(
        self, start_time: datetime, end_time: datetime
    ) -> List[Batch]:
        """获取指定时间范围内的批次"""
        return [
            b for b in self.batches
            if not (b.end_time < start_time or b.start_time > end_time)
        ]

    def get_cleaning_records_in_range(
        self, start_time: datetime, end_time: datetime
    ) -> List[CleaningRecord]:
        """获取指定时间范围内的清洁记录"""
        return [
            r for r in self.cleaning_records
            if start_time <= r.cleaning_time <= end_time
        ]

    def get_equipment_utilization(self) -> Dict[str, List[Dict[str, Any]]]:
        """获取设备使用情况"""
        utilization: Dict[str, List[Dict[str, Any]]] = {}
        
        for batch in self.batches:
            for equipment in batch.equipment:
                if equipment not in utilization:
                    utilization[equipment] = []
                utilization[equipment].append({
                    "batch_id": batch.batch_id,
                    "start_time": batch.start_time,
                    "end_time": batch.end_time,
                    "duration_minutes": batch.duration_minutes(),
                })
        
        return utilization

    def check_equipment_conflicts(self) -> List[Dict[str, Any]]:
        """检查设备冲突"""
        conflicts = []
        utilization = self.get_equipment_utilization()
        
        for equipment, usages in utilization.items():
            sorted_usages = sorted(usages, key=lambda u: u["start_time"])
            
            for i in range(len(sorted_usages) - 1):
                current = sorted_usages[i]
                next_usage = sorted_usages[i + 1]
                
                if next_usage["start_time"] < current["end_time"]:
                    overlap = (
                        current["end_time"] - next_usage["start_time"]
                    ).total_seconds() / 60
                    
                    conflicts.append({
                        "equipment": equipment,
                        "batch_a": current["batch_id"],
                        "batch_b": next_usage["batch_id"],
                        "start_a": current["start_time"],
                        "end_a": current["end_time"],
                        "start_b": next_usage["start_time"],
                        "end_b": next_usage["end_time"],
                        "overlap_minutes": round(overlap, 2),
                    })
        
        return conflicts

    def get_midnight_transitions(self) -> List[Dict[str, Any]]:
        """获取所有跨午夜的批次"""
        transitions = []
        for batch in self.batches:
            info = batch.get_midnight_info()
            if info:
                transitions.append({
                    "batch_id": batch.batch_id,
                    "product_name": batch.product_info.product_name,
                    "start_time": batch.start_time,
                    "end_time": batch.end_time,
                    **info
                })
        return transitions

    def get_transitions(self) -> List[Dict[str, Any]]:
        """获取所有换产点"""
        if len(self.batches) < 2:
            return []
        
        sorted_batches = sorted(self.batches, key=lambda b: b.start_time)
        transitions = []
        
        for i in range(len(sorted_batches) - 1):
            prev_batch = sorted_batches[i]
            next_batch = sorted_batches[i + 1]
            
            gap_minutes = (
                next_batch.start_time - prev_batch.end_time
            ).total_seconds() / 60
            
            transitions.append({
                "prev_batch": prev_batch,
                "next_batch": next_batch,
                "transition_time": prev_batch.end_time,
                "gap_minutes": round(gap_minutes, 2),
                "has_gap": gap_minutes > 0,
                "has_overlap": gap_minutes < 0,
            })
        
        return transitions


def parse_batch_from_dict(data: Dict[str, Any]) -> Batch:
    """从字典解析批次"""
    allergens = []
    if data.get("allergens") is not None:
        if isinstance(data["allergens"], str):
            allergens = [
                a.strip() for a in data["allergens"].split(",") 
                if a.strip() and a.strip() not in ["无", "none", "None", "NONE"]
            ]
        else:
            allergens = [
                a.strip() if isinstance(a, str) else str(a)
                for a in data["allergens"]
                if a and (not isinstance(a, str) or a.strip() not in ["无", "none", "None", "NONE"])
            ]
    
    product_info = ProductInfo(
        product_code=data.get("product_code", ""),
        product_name=data.get("product_name", ""),
        allergens=allergens,
        formula_version=data.get("formula_version", ""),
    )
    
    start_time = datetime.fromisoformat(data["start_time"])
    end_time = datetime.fromisoformat(data["end_time"])
    
    label_switch_time = None
    if data.get("label_switch_time"):
        label_switch_time = datetime.fromisoformat(data["label_switch_time"])
    
    equipment = []
    if data.get("equipment"):
        if isinstance(data["equipment"], str):
            equipment = [e.strip() for e in data["equipment"].split(",") if e.strip()]
        else:
            equipment = list(data["equipment"])
    
    return Batch(
        batch_id=data["batch_id"],
        production_line=data.get("production_line", "default"),
        product_info=product_info,
        start_time=start_time,
        end_time=end_time,
        equipment=equipment,
        label_switch_time=label_switch_time,
        raw_data=data,
    )


def parse_cleaning_record_from_dict(data: Dict[str, Any]) -> CleaningRecord:
    """从字典解析清洁记录"""
    cleaning_time = datetime.fromisoformat(data["cleaning_time"])
    
    return CleaningRecord(
        record_id=data.get("record_id", ""),
        equipment=data.get("equipment", ""),
        cleaning_time=cleaning_time,
        swab_point=data.get("swab_point"),
        swab_result=data.get("swab_result"),
        inspector=data.get("inspector", ""),
        notes=data.get("notes", ""),
        raw_data=data,
    )


def build_timelines(
    batches_data: List[Dict[str, Any]],
    cleaning_data: List[Dict[str, Any]],
    formulas_data: List[Dict[str, Any]],
) -> Dict[str, ProductionTimeline]:
    """构建各产线的时间线"""
    formula_map = {
        f.get("product_code"): f for f in formulas_data
    }
    
    timelines: Dict[str, ProductionTimeline] = {}
    
    for batch_data in batches_data:
        product_code = batch_data.get("product_code")
        if product_code and product_code in formula_map:
            formula = formula_map[product_code]
            batch_data["allergens"] = formula.get("allergens", [])
            batch_data["product_name"] = formula.get(
                "product_name", batch_data.get("product_name", "")
            )
        
        batch = parse_batch_from_dict(batch_data)
        line = batch.production_line
        
        if line not in timelines:
            timelines[line] = ProductionTimeline(line)
        timelines[line].add_batch(batch)
    
    for record_data in cleaning_data:
        record = parse_cleaning_record_from_dict(record_data)
        found = False
        for line, timeline in timelines.items():
            for batch in timeline.batches:
                if record.equipment in batch.equipment:
                    timeline.add_cleaning_record(record)
                    found = True
                    break
            if found:
                break
        
        if not found:
            if "default" not in timelines:
                timelines["default"] = ProductionTimeline("default")
            timelines["default"].add_cleaning_record(record)
    
    for timeline in timelines.values():
        timeline.sort_all()
    
    return timelines
