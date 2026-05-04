#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
数据模型定义 - 贴片回流生产管理
"""

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from typing import Optional, List, Dict, Any, Union
from enum import Enum
import hashlib


class PartType(Enum):
    RESISTOR = "电阻"
    CAPACITOR = "电容"
    INDUCTOR = "电感"
    IC = "集成电路"
    DIODE = "二极管"
    TRANSISTOR = "三极管"
    CONNECTOR = "连接器"
    LED = "LED"
    FUSE = "保险丝"
    OTHER = "其他"


class PackageType(Enum):
    SM0402 = "0402"
    SM0603 = "0603"
    SM0805 = "0805"
    SM1206 = "1206"
    SM1210 = "1210"
    SM1812 = "1812"
    SM2010 = "2010"
    SM2512 = "2512"
    SOP8 = "SOP-8"
    SOP14 = "SOP-14"
    SOP16 = "SOP-16"
    SOP24 = "SOP-24"
    SOIC8 = "SOIC-8"
    SOIC14 = "SOIC-14"
    TSSOP8 = "TSSOP-8"
    TSSOP16 = "TSSOP-16"
    TSSOP20 = "TSSOP-20"
    TSSOP28 = "TSSOP-28"
    QFP32 = "QFP-32"
    QFP48 = "QFP-48"
    QFP64 = "QFP-64"
    QFP100 = "QFP-100"
    QFN16 = "QFN-16"
    QFN24 = "QFN-24"
    QFN32 = "QFN-32"
    QFN48 = "QFN-48"
    BGA = "BGA"
    TH = "插件"
    OTHER = "其他"


class SolderPasteType(Enum):
    LEAD_TIN = "有铅锡膏"
    LEAD_FREE = "无铅锡膏"
    LOW_TEMP = "低温锡膏"


class IssueType(Enum):
    PACKAGE_MISMATCH = "元件封装不匹配"
    SOLDER_PASTE_EXPIRED = "锡膏过期"
    SOLDER_PASTE_THAW_TIMEOUT = "锡膏回温超时"
    OVEN_PEAK_TEMP_LOW = "炉温峰值偏低"
    OVEN_PEAK_TEMP_HIGH = "炉温峰值偏高"
    OVEN_SOAK_TIME_SHORT = "浸泡区时间不足"
    OVEN_SOAK_TIME_LONG = "浸泡区时间过长"
    OVEN_PROFILE_MISMATCH = "炉温曲线不匹配"
    DUPLICATE_REWORK = "同一板号重复返修"
    PART_NOT_FOUND = "元件不存在"
    REFERENCE_MISMATCH = "位号不匹配"
    QUANTITY_MISMATCH = "数量不匹配"
    DUPLICATE_IMPORT = "重复导入"


class IssueSeverity(Enum):
    CRITICAL = "严重"
    WARNING = "警告"
    INFO = "信息"


class ReworkStatus(Enum):
    NONE = "无返修"
    PENDING = "待返修"
    IN_PROGRESS = "返修中"
    COMPLETED = "已完成"
    FAILED = "返修失败"


@dataclass
class BOMPart:
    reference: str
    part_number: str
    description: str
    quantity: int
    package: str
    manufacturer: str = ""
    supplier: str = ""
    supplier_part_number: str = ""
    value: str = ""
    tolerance: str = ""
    voltage: str = ""
    power: str = ""
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reference": self.reference,
            "part_number": self.part_number,
            "description": self.description,
            "quantity": self.quantity,
            "package": self.package,
            "manufacturer": self.manufacturer,
            "supplier": self.supplier,
            "supplier_part_number": self.supplier_part_number,
            "value": self.value,
            "tolerance": self.tolerance,
            "voltage": self.voltage,
            "power": self.power,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BOMPart':
        return cls(
            reference=data.get("reference", ""),
            part_number=data.get("part_number", ""),
            description=data.get("description", ""),
            quantity=int(data.get("quantity", 1)),
            package=data.get("package", ""),
            manufacturer=data.get("manufacturer", ""),
            supplier=data.get("supplier", ""),
            supplier_part_number=data.get("supplier_part_number", ""),
            value=data.get("value", ""),
            tolerance=data.get("tolerance", ""),
            voltage=data.get("voltage", ""),
            power=data.get("power", ""),
            notes=data.get("notes", "")
        )


@dataclass
class BOM:
    bom_id: str
    board_number: str
    board_revision: str
    description: str
    parts: List[BOMPart] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_part_by_reference(self, reference: str) -> Optional[BOMPart]:
        for part in self.parts:
            if part.reference == reference:
                return part
        return None
    
    def get_all_references(self) -> set:
        return {part.reference for part in self.parts}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "bom_id": self.bom_id,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "description": self.description,
            "parts": [p.to_dict() for p in self.parts],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BOM':
        return cls(
            bom_id=data.get("bom_id", ""),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            description=data.get("description", ""),
            parts=[BOMPart.from_dict(p) for p in data.get("parts", [])],
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class PickPlaceItem:
    reference: str
    x: float
    y: float
    rotation: float
    layer: str = "Top"
    package: str = ""
    part_number: str = ""
    value: str = ""
    feeder: str = ""
    nozzel: str = ""
    speed: float = 0.0
    skip: bool = False
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reference": self.reference,
            "x": self.x,
            "y": self.y,
            "rotation": self.rotation,
            "layer": self.layer,
            "package": self.package,
            "part_number": self.part_number,
            "value": self.value,
            "feeder": self.feeder,
            "nozzel": self.nozzel,
            "speed": self.speed,
            "skip": self.skip,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PickPlaceItem':
        return cls(
            reference=data.get("reference", ""),
            x=float(data.get("x", 0.0)),
            y=float(data.get("y", 0.0)),
            rotation=float(data.get("rotation", 0.0)),
            layer=data.get("layer", "Top"),
            package=data.get("package", ""),
            part_number=data.get("part_number", ""),
            value=data.get("value", ""),
            feeder=data.get("feeder", ""),
            nozzel=data.get("nozzel", ""),
            speed=float(data.get("speed", 0.0)),
            skip=data.get("skip", False),
            notes=data.get("notes", "")
        )


@dataclass
class PickPlaceData:
    pick_place_id: str
    board_number: str
    board_revision: str
    machine: str = ""
    program: str = ""
    items: List[PickPlaceItem] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_item_by_reference(self, reference: str) -> Optional[PickPlaceItem]:
        for item in self.items:
            if item.reference == reference:
                return item
        return None
    
    def get_all_references(self) -> set:
        return {item.reference for item in self.items}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "pick_place_id": self.pick_place_id,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "machine": self.machine,
            "program": self.program,
            "items": [i.to_dict() for i in self.items],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'PickPlaceData':
        return cls(
            pick_place_id=data.get("pick_place_id", ""),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            machine=data.get("machine", ""),
            program=data.get("program", ""),
            items=[PickPlaceItem.from_dict(i) for i in data.get("items", [])],
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class OvenProfilePoint:
    time: float
    temperature: float
    zone: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "time": self.time,
            "temperature": self.temperature,
            "zone": self.zone
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OvenProfilePoint':
        return cls(
            time=float(data.get("time", 0.0)),
            temperature=float(data.get("temperature", 0.0)),
            zone=int(data["zone"]) if data.get("zone") is not None else None
        )


@dataclass
class OvenProfile:
    profile_id: str
    name: str
    description: str
    solder_paste_type: str = ""
    board_thickness: float = 0.0
    component_count: int = 0
    target_peak_min: float = 0.0
    target_peak_max: float = 0.0
    target_soak_start: float = 0.0
    target_soak_end: float = 0.0
    target_soak_min_time: float = 0.0
    target_soak_max_time: float = 0.0
    target_ramp_up_rate: float = 0.0
    target_ramp_down_rate: float = 0.0
    points: List[OvenProfilePoint] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_peak_temperature(self) -> float:
        if not self.points:
            return 0.0
        return max(p.temperature for p in self.points)
    
    def get_soak_time(self, soak_start: float = 150.0, soak_end: float = 180.0) -> float:
        if not self.points:
            return 0.0
        
        in_soak = False
        soak_start_time = 0.0
        total_soak_time = 0.0
        
        sorted_points = sorted(self.points, key=lambda p: p.time)
        
        for i, point in enumerate(sorted_points):
            temp = point.temperature
            
            if soak_start <= temp <= soak_end:
                if not in_soak:
                    in_soak = True
                    soak_start_time = point.time
            elif in_soak:
                in_soak = False
                total_soak_time += (point.time - soak_start_time)
        
        if in_soak and sorted_points:
            total_soak_time += (sorted_points[-1].time - soak_start_time)
        
        return total_soak_time
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "name": self.name,
            "description": self.description,
            "solder_paste_type": self.solder_paste_type,
            "board_thickness": self.board_thickness,
            "component_count": self.component_count,
            "target_peak_min": self.target_peak_min,
            "target_peak_max": self.target_peak_max,
            "target_soak_start": self.target_soak_start,
            "target_soak_end": self.target_soak_end,
            "target_soak_min_time": self.target_soak_min_time,
            "target_soak_max_time": self.target_soak_max_time,
            "target_ramp_up_rate": self.target_ramp_up_rate,
            "target_ramp_down_rate": self.target_ramp_down_rate,
            "points": [p.to_dict() for p in self.points],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'OvenProfile':
        return cls(
            profile_id=data.get("profile_id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            solder_paste_type=data.get("solder_paste_type", ""),
            board_thickness=float(data.get("board_thickness", 0.0)),
            component_count=int(data.get("component_count", 0)),
            target_peak_min=float(data.get("target_peak_min", 0.0)),
            target_peak_max=float(data.get("target_peak_max", 0.0)),
            target_soak_start=float(data.get("target_soak_start", 0.0)),
            target_soak_end=float(data.get("target_soak_end", 0.0)),
            target_soak_min_time=float(data.get("target_soak_min_time", 0.0)),
            target_soak_max_time=float(data.get("target_soak_max_time", 0.0)),
            target_ramp_up_rate=float(data.get("target_ramp_up_rate", 0.0)),
            target_ramp_down_rate=float(data.get("target_ramp_down_rate", 0.0)),
            points=[OvenProfilePoint.from_dict(p) for p in data.get("points", [])],
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class SolderPasteBatch:
    batch_id: str
    lot_number: str
    solder_paste_type: str
    manufacturer: str
    alloy_type: str
    particle_size: str = ""
    flux_type: str = ""
    shelf_life_months: int = 12
    manufacture_date: date = field(default_factory=date.today)
    expiry_date: date = field(default_factory=date.today)
    thaw_start_time: Optional[datetime] = None
    thaw_complete_time: Optional[datetime] = None
    max_thaw_hours: float = 8.0
    max_room_temp_hours: float = 24.0
    open_time: Optional[datetime] = None
    usage_count: int = 0
    status: str = "未开封"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def is_expired(self, check_date: Optional[date] = None) -> bool:
        if check_date is None:
            check_date = date.today()
        return check_date > self.expiry_date
    
    def get_thaw_remaining_hours(self, check_time: Optional[datetime] = None) -> float:
        if check_time is None:
            check_time = datetime.now()
        
        if not self.thaw_complete_time:
            return 0.0
        
        elapsed = (check_time - self.thaw_complete_time).total_seconds() / 3600
        remaining = self.max_room_temp_hours - elapsed
        return max(0.0, remaining)
    
    def is_thaw_expired(self, check_time: Optional[datetime] = None) -> bool:
        return self.get_thaw_remaining_hours(check_time) <= 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "lot_number": self.lot_number,
            "solder_paste_type": self.solder_paste_type,
            "manufacturer": self.manufacturer,
            "alloy_type": self.alloy_type,
            "particle_size": self.particle_size,
            "flux_type": self.flux_type,
            "shelf_life_months": self.shelf_life_months,
            "manufacture_date": self.manufacture_date.isoformat(),
            "expiry_date": self.expiry_date.isoformat(),
            "thaw_start_time": self.thaw_start_time.isoformat() if self.thaw_start_time else None,
            "thaw_complete_time": self.thaw_complete_time.isoformat() if self.thaw_complete_time else None,
            "max_thaw_hours": self.max_thaw_hours,
            "max_room_temp_hours": self.max_room_temp_hours,
            "open_time": self.open_time.isoformat() if self.open_time else None,
            "usage_count": self.usage_count,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SolderPasteBatch':
        return cls(
            batch_id=data.get("batch_id", ""),
            lot_number=data.get("lot_number", ""),
            solder_paste_type=data.get("solder_paste_type", ""),
            manufacturer=data.get("manufacturer", ""),
            alloy_type=data.get("alloy_type", ""),
            particle_size=data.get("particle_size", ""),
            flux_type=data.get("flux_type", ""),
            shelf_life_months=int(data.get("shelf_life_months", 12)),
            manufacture_date=date.fromisoformat(data["manufacture_date"]) if data.get("manufacture_date") else date.today(),
            expiry_date=date.fromisoformat(data["expiry_date"]) if data.get("expiry_date") else date.today(),
            thaw_start_time=datetime.fromisoformat(data["thaw_start_time"]) if data.get("thaw_start_time") else None,
            thaw_complete_time=datetime.fromisoformat(data["thaw_complete_time"]) if data.get("thaw_complete_time") else None,
            max_thaw_hours=float(data.get("max_thaw_hours", 8.0)),
            max_room_temp_hours=float(data.get("max_room_temp_hours", 24.0)),
            open_time=datetime.fromisoformat(data["open_time"]) if data.get("open_time") else None,
            usage_count=int(data.get("usage_count", 0)),
            status=data.get("status", "未开封"),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class StencilBatch:
    batch_id: str
    stencil_id: str
    manufacturer: str
    manufacture_date: date = field(default_factory=date.today)
    thickness: float = 0.0
    material: str = ""
    aperture_count: int = 0
    board_number: str = ""
    board_revision: str = ""
    use_count: int = 0
    last_cleaned: Optional[date] = None
    max_uses: int = 10000
    status: str = "正常"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def is_near_end_of_life(self) -> bool:
        return self.use_count >= self.max_uses * 0.8
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "stencil_id": self.stencil_id,
            "manufacturer": self.manufacturer,
            "manufacture_date": self.manufacture_date.isoformat(),
            "thickness": self.thickness,
            "material": self.material,
            "aperture_count": self.aperture_count,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "use_count": self.use_count,
            "last_cleaned": self.last_cleaned.isoformat() if self.last_cleaned else None,
            "max_uses": self.max_uses,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'StencilBatch':
        return cls(
            batch_id=data.get("batch_id", ""),
            stencil_id=data.get("stencil_id", ""),
            manufacturer=data.get("manufacturer", ""),
            manufacture_date=date.fromisoformat(data["manufacture_date"]) if data.get("manufacture_date") else date.today(),
            thickness=float(data.get("thickness", 0.0)),
            material=data.get("material", ""),
            aperture_count=int(data.get("aperture_count", 0)),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            use_count=int(data.get("use_count", 0)),
            last_cleaned=date.fromisoformat(data["last_cleaned"]) if data.get("last_cleaned") else None,
            max_uses=int(data.get("max_uses", 10000)),
            status=data.get("status", "正常"),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class AOI_Defect:
    reference: str
    defect_type: str
    x: float = 0.0
    y: float = 0.0
    image_file: str = ""
    description: str = ""
    confirmed: bool = False
    false_alarm: bool = False
    rework_needed: bool = False
    rework_status: str = ReworkStatus.NONE.value
    rework_notes: str = ""
    rework_operator: str = ""
    rework_time: Optional[datetime] = None
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "reference": self.reference,
            "defect_type": self.defect_type,
            "x": self.x,
            "y": self.y,
            "image_file": self.image_file,
            "description": self.description,
            "confirmed": self.confirmed,
            "false_alarm": self.false_alarm,
            "rework_needed": self.rework_needed,
            "rework_status": self.rework_status,
            "rework_notes": self.rework_notes,
            "rework_operator": self.rework_operator,
            "rework_time": self.rework_time.isoformat() if self.rework_time else None,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AOI_Defect':
        return cls(
            reference=data.get("reference", ""),
            defect_type=data.get("defect_type", ""),
            x=float(data.get("x", 0.0)),
            y=float(data.get("y", 0.0)),
            image_file=data.get("image_file", ""),
            description=data.get("description", ""),
            confirmed=data.get("confirmed", False),
            false_alarm=data.get("false_alarm", False),
            rework_needed=data.get("rework_needed", False),
            rework_status=data.get("rework_status", ReworkStatus.NONE.value),
            rework_notes=data.get("rework_notes", ""),
            rework_operator=data.get("rework_operator", ""),
            rework_time=datetime.fromisoformat(data["rework_time"]) if data.get("rework_time") else None,
            notes=data.get("notes", "")
        )


@dataclass
class AOI_Report:
    aoi_id: str
    board_number: str
    board_revision: str
    serial_number: str = ""
    inspection_time: datetime = field(default_factory=datetime.now)
    machine: str = ""
    program: str = ""
    operator: str = ""
    total_components: int = 0
    inspected_count: int = 0
    pass_count: int = 0
    fail_count: int = 0
    defects: List[AOI_Defect] = field(default_factory=list)
    overall_result: str = "PASS"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def get_rework_needed_defects(self) -> List[AOI_Defect]:
        return [d for d in self.defects if d.rework_needed and not d.false_alarm]
    
    def get_false_alarms(self) -> List[AOI_Defect]:
        return [d for d in self.defects if d.false_alarm]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "aoi_id": self.aoi_id,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "serial_number": self.serial_number,
            "inspection_time": self.inspection_time.isoformat(),
            "machine": self.machine,
            "program": self.program,
            "operator": self.operator,
            "total_components": self.total_components,
            "inspected_count": self.inspected_count,
            "pass_count": self.pass_count,
            "fail_count": self.fail_count,
            "defects": [d.to_dict() for d in self.defects],
            "overall_result": self.overall_result,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AOI_Report':
        return cls(
            aoi_id=data.get("aoi_id", ""),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            serial_number=data.get("serial_number", ""),
            inspection_time=datetime.fromisoformat(data["inspection_time"]) if data.get("inspection_time") else datetime.now(),
            machine=data.get("machine", ""),
            program=data.get("program", ""),
            operator=data.get("operator", ""),
            total_components=int(data.get("total_components", 0)),
            inspected_count=int(data.get("inspected_count", 0)),
            pass_count=int(data.get("pass_count", 0)),
            fail_count=int(data.get("fail_count", 0)),
            defects=[AOI_Defect.from_dict(d) for d in data.get("defects", [])],
            overall_result=data.get("overall_result", "PASS"),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class ReworkRecord:
    rework_id: str
    board_number: str
    board_revision: str
    serial_number: str = ""
    aoi_id: Optional[str] = None
    rework_operator: str = ""
    rework_time: datetime = field(default_factory=datetime.now)
    rework_type: str = ""
    references: List[str] = field(default_factory=list)
    description: str = ""
    before_image: str = ""
    after_image: str = ""
    rework_result: str = "PASS"
    inspection_time: Optional[datetime] = None
    inspector: str = ""
    inspection_notes: str = ""
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rework_id": self.rework_id,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "serial_number": self.serial_number,
            "aoi_id": self.aoi_id,
            "rework_operator": self.rework_operator,
            "rework_time": self.rework_time.isoformat(),
            "rework_type": self.rework_type,
            "references": self.references.copy(),
            "description": self.description,
            "before_image": self.before_image,
            "after_image": self.after_image,
            "rework_result": self.rework_result,
            "inspection_time": self.inspection_time.isoformat() if self.inspection_time else None,
            "inspector": self.inspector,
            "inspection_notes": self.inspection_notes,
            "notes": self.notes,
            "created_at": self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ReworkRecord':
        return cls(
            rework_id=data.get("rework_id", ""),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            serial_number=data.get("serial_number", ""),
            aoi_id=data.get("aoi_id"),
            rework_operator=data.get("rework_operator", ""),
            rework_time=datetime.fromisoformat(data["rework_time"]) if data.get("rework_time") else datetime.now(),
            rework_type=data.get("rework_type", ""),
            references=data.get("references", []).copy(),
            description=data.get("description", ""),
            before_image=data.get("before_image", ""),
            after_image=data.get("after_image", ""),
            rework_result=data.get("rework_result", "PASS"),
            inspection_time=datetime.fromisoformat(data["inspection_time"]) if data.get("inspection_time") else None,
            inspector=data.get("inspector", ""),
            inspection_notes=data.get("inspection_notes", ""),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        )


@dataclass
class ProductionBatch:
    batch_id: str
    board_number: str
    board_revision: str
    description: str
    quantity: int = 0
    order_number: str = ""
    customer: str = ""
    bom_id: Optional[str] = None
    pick_place_id: Optional[str] = None
    oven_profile_id: Optional[str] = None
    actual_oven_profile_id: Optional[str] = None
    solder_paste_batch_id: Optional[str] = None
    stencil_batch_id: Optional[str] = None
    production_date: date = field(default_factory=date.today)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    operator: str = ""
    status: str = "计划中"
    notes: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "board_number": self.board_number,
            "board_revision": self.board_revision,
            "description": self.description,
            "quantity": self.quantity,
            "order_number": self.order_number,
            "customer": self.customer,
            "bom_id": self.bom_id,
            "pick_place_id": self.pick_place_id,
            "oven_profile_id": self.oven_profile_id,
            "actual_oven_profile_id": self.actual_oven_profile_id,
            "solder_paste_batch_id": self.solder_paste_batch_id,
            "stencil_batch_id": self.stencil_batch_id,
            "production_date": self.production_date.isoformat(),
            "start_time": self.start_time.isoformat() if self.start_time else None,
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "operator": self.operator,
            "status": self.status,
            "notes": self.notes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProductionBatch':
        return cls(
            batch_id=data.get("batch_id", ""),
            board_number=data.get("board_number", ""),
            board_revision=data.get("board_revision", ""),
            description=data.get("description", ""),
            quantity=int(data.get("quantity", 0)),
            order_number=data.get("order_number", ""),
            customer=data.get("customer", ""),
            bom_id=data.get("bom_id"),
            pick_place_id=data.get("pick_place_id"),
            oven_profile_id=data.get("oven_profile_id"),
            actual_oven_profile_id=data.get("actual_oven_profile_id"),
            solder_paste_batch_id=data.get("solder_paste_batch_id"),
            stencil_batch_id=data.get("stencil_batch_id"),
            production_date=date.fromisoformat(data["production_date"]) if data.get("production_date") else date.today(),
            start_time=datetime.fromisoformat(data["start_time"]) if data.get("start_time") else None,
            end_time=datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            operator=data.get("operator", ""),
            status=data.get("status", "计划中"),
            notes=data.get("notes", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now()
        )


@dataclass
class Issue:
    issue_id: str
    issue_type: IssueType
    severity: IssueSeverity
    batch_id: Optional[str] = None
    board_number: Optional[str] = None
    reference: Optional[str] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    confirmed: bool = False
    confirm_remark: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "issue_id": self.issue_id,
            "issue_type": self.issue_type.value,
            "severity": self.severity.value,
            "batch_id": self.batch_id,
            "board_number": self.board_number,
            "reference": self.reference,
            "message": self.message,
            "details": self.details.copy(),
            "confirmed": self.confirmed,
            "confirm_remark": self.confirm_remark,
            "confirmed_at": self.confirmed_at.isoformat() if self.confirmed_at else None,
            "confirmed_by": self.confirmed_by,
            "created_at": self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Issue':
        return cls(
            issue_id=data.get("issue_id", ""),
            issue_type=IssueType(data.get("issue_type", "")),
            severity=IssueSeverity(data.get("severity", "")),
            batch_id=data.get("batch_id"),
            board_number=data.get("board_number"),
            reference=data.get("reference"),
            message=data.get("message", ""),
            details=data.get("details", {}).copy(),
            confirmed=data.get("confirmed", False),
            confirm_remark=data.get("confirm_remark"),
            confirmed_at=datetime.fromisoformat(data["confirmed_at"]) if data.get("confirmed_at") else None,
            confirmed_by=data.get("confirmed_by"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now()
        )


def generate_id(prefix: str = "ID") -> str:
    now = datetime.now()
    return f"{prefix}_{now.strftime('%Y%m%d%H%M%S')}_{id(now) % 10000:04d}"


def calculate_hash(data: Union[str, bytes]) -> str:
    if isinstance(data, str):
        data = data.encode('utf-8')
    return hashlib.sha256(data).hexdigest()
