"""状态存储模块 - 存储巡检、用药、摇蜜记录"""

import json
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Iterator


@dataclass
class InspectionRecord:
    """巡检记录"""
    record_id: str
    date: str
    hive_number: str
    colony_strength: Optional[str] = None
    queen_status: Optional[str] = None
    pests_diseases: Optional[str] = None
    feeding: Optional[str] = None
    notes: Optional[str] = None
    import_source: Optional[str] = None
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "date": self.date,
            "hive_number": self.hive_number,
            "colony_strength": self.colony_strength,
            "queen_status": self.queen_status,
            "pests_diseases": self.pests_diseases,
            "feeding": self.feeding,
            "notes": self.notes,
            "import_source": self.import_source,
            "imported_at": self.imported_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "InspectionRecord":
        return cls(
            record_id=data["record_id"],
            date=data["date"],
            hive_number=data["hive_number"],
            colony_strength=data.get("colony_strength"),
            queen_status=data.get("queen_status"),
            pests_diseases=data.get("pests_diseases"),
            feeding=data.get("feeding"),
            notes=data.get("notes"),
            import_source=data.get("import_source"),
            imported_at=data.get("imported_at", datetime.now().isoformat()),
        )


@dataclass
class TreatmentRecord:
    """用药/饲喂记录"""
    record_id: str
    date: str
    hive_number: str
    treatment_type: str
    product_name: str
    dosage: Optional[str] = None
    notes: Optional[str] = None
    import_source: Optional[str] = None
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "date": self.date,
            "hive_number": self.hive_number,
            "treatment_type": self.treatment_type,
            "product_name": self.product_name,
            "dosage": self.dosage,
            "notes": self.notes,
            "import_source": self.import_source,
            "imported_at": self.imported_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TreatmentRecord":
        return cls(
            record_id=data["record_id"],
            date=data["date"],
            hive_number=data["hive_number"],
            treatment_type=data["treatment_type"],
            product_name=data["product_name"],
            dosage=data.get("dosage"),
            notes=data.get("notes"),
            import_source=data.get("import_source"),
            imported_at=data.get("imported_at", datetime.now().isoformat()),
        )


@dataclass
class HarvestRecord:
    """摇蜜记录"""
    record_id: str
    date: str
    hive_number: str
    batch_number: str
    quantity_kg: Optional[float] = None
    moisture_content: Optional[float] = None
    notes: Optional[str] = None
    import_source: Optional[str] = None
    imported_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "date": self.date,
            "hive_number": self.hive_number,
            "batch_number": self.batch_number,
            "quantity_kg": self.quantity_kg,
            "moisture_content": self.moisture_content,
            "notes": self.notes,
            "import_source": self.import_source,
            "imported_at": self.imported_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "HarvestRecord":
        return cls(
            record_id=data["record_id"],
            date=data["date"],
            hive_number=data["hive_number"],
            batch_number=data["batch_number"],
            quantity_kg=data.get("quantity_kg"),
            moisture_content=data.get("moisture_content"),
            notes=data.get("notes"),
            import_source=data.get("import_source"),
            imported_at=data.get("imported_at", datetime.now().isoformat()),
        )


@dataclass
class QuarantineRecord:
    """隔离记录 - 存储校验失败的记录"""
    quarantine_id: str
    original_data: Dict[str, Any]
    error_reason: str
    record_type: str
    import_source: Optional[str] = None
    quarantined_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "quarantine_id": self.quarantine_id,
            "original_data": self.original_data,
            "error_reason": self.error_reason,
            "record_type": self.record_type,
            "import_source": self.import_source,
            "quarantined_at": self.quarantined_at,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QuarantineRecord":
        return cls(
            quarantine_id=data["quarantine_id"],
            original_data=data["original_data"],
            error_reason=data["error_reason"],
            record_type=data["record_type"],
            import_source=data.get("import_source"),
            quarantined_at=data.get("quarantined_at", datetime.now().isoformat()),
        )


class DataStore:
    """数据存储管理器"""
    
    INSPECTIONS_FILE = "inspections.json"
    TREATMENTS_FILE = "treatments.json"
    HARVESTS_FILE = "harvests.json"
    QUARANTINE_FILE = "quarantine.json"
    META_FILE = "meta.json"

    def __init__(self, store_dir: Path):
        self.store_dir = store_dir
        self._inspections: List[InspectionRecord] = []
        self._treatments: List[TreatmentRecord] = []
        self._harvests: List[HarvestRecord] = []
        self._quarantine: List[QuarantineRecord] = []
        
        self._inspection_cache: Dict[str, InspectionRecord] = {}
        self._treatment_cache: Dict[str, TreatmentRecord] = {}
        self._harvest_cache: Dict[str, HarvestRecord] = {}
        
        self._initialized = False

    def initialize(self) -> None:
        """初始化存储目录"""
        self.store_dir.mkdir(parents=True, exist_ok=True)
        self._load_all()
        self._initialized = True

    def _load_all(self) -> None:
        """加载所有数据"""
        self._load_inspections()
        self._load_treatments()
        self._load_harvests()
        self._load_quarantine()

    def _load_inspections(self) -> None:
        path = self.store_dir / self.INSPECTIONS_FILE
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._inspections = [InspectionRecord.from_dict(r) for r in data]
            self._inspection_cache = {r.record_id: r for r in self._inspections}

    def _load_treatments(self) -> None:
        path = self.store_dir / self.TREATMENTS_FILE
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._treatments = [TreatmentRecord.from_dict(r) for r in data]
            self._treatment_cache = {r.record_id: r for r in self._treatments}

    def _load_harvests(self) -> None:
        path = self.store_dir / self.HARVESTS_FILE
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._harvests = [HarvestRecord.from_dict(r) for r in data]
            self._harvest_cache = {r.record_id: r for r in self._harvests}

    def _load_quarantine(self) -> None:
        path = self.store_dir / self.QUARANTINE_FILE
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self._quarantine = [QuarantineRecord.from_dict(r) for r in data]

    def _save_inspections(self) -> None:
        path = self.store_dir / self.INSPECTIONS_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self._inspections], f, ensure_ascii=False, indent=2)

    def _save_treatments(self) -> None:
        path = self.store_dir / self.TREATMENTS_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self._treatments], f, ensure_ascii=False, indent=2)

    def _save_harvests(self) -> None:
        path = self.store_dir / self.HARVESTS_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self._harvests], f, ensure_ascii=False, indent=2)

    def _save_quarantine(self) -> None:
        path = self.store_dir / self.QUARANTINE_FILE
        with open(path, "w", encoding="utf-8") as f:
            json.dump([r.to_dict() for r in self._quarantine], f, ensure_ascii=False, indent=2)

    def add_inspection(self, record: InspectionRecord) -> None:
        if record.record_id in self._inspection_cache:
            raise ValueError(f"巡检记录已存在: {record.record_id}")
        self._inspections.append(record)
        self._inspection_cache[record.record_id] = record
        self._save_inspections()

    def add_treatment(self, record: TreatmentRecord) -> None:
        if record.record_id in self._treatment_cache:
            raise ValueError(f"用药记录已存在: {record.record_id}")
        self._treatments.append(record)
        self._treatment_cache[record.record_id] = record
        self._save_treatments()

    def add_harvest(self, record: HarvestRecord) -> None:
        if record.record_id in self._harvest_cache:
            raise ValueError(f"摇蜜记录已存在: {record.record_id}")
        self._harvests.append(record)
        self._harvest_cache[record.record_id] = record
        self._save_harvests()

    def add_quarantine(self, record: QuarantineRecord) -> None:
        self._quarantine.append(record)
        self._save_quarantine()

    def inspection_exists(self, record_id: str) -> bool:
        return record_id in self._inspection_cache

    def treatment_exists(self, record_id: str) -> bool:
        return record_id in self._treatment_cache

    def harvest_exists(self, record_id: str) -> bool:
        return record_id in self._harvest_cache

    def get_all_inspections(self) -> List[InspectionRecord]:
        return list(self._inspections)

    def get_all_treatments(self) -> List[TreatmentRecord]:
        return list(self._treatments)

    def get_all_harvests(self) -> List[HarvestRecord]:
        return list(self._harvests)

    def get_all_quarantine(self) -> List[QuarantineRecord]:
        return list(self._quarantine)

    def get_inspections_by_hive(self, hive_number: str) -> List[InspectionRecord]:
        return [r for r in self._inspections if r.hive_number == hive_number]

    def get_treatments_by_hive(self, hive_number: str) -> List[TreatmentRecord]:
        return [r for r in self._treatments if r.hive_number == hive_number]

    def get_harvests_by_hive(self, hive_number: str) -> List[HarvestRecord]:
        return [r for r in self._harvests if r.hive_number == hive_number]

    def get_harvests_by_batch(self, batch_number: str) -> List[HarvestRecord]:
        return [r for r in self._harvests if r.batch_number == batch_number]

    def get_treatments_by_product(self, product_name: str) -> List[TreatmentRecord]:
        return [r for r in self._treatments if r.product_name == product_name]

    def count_inspections(self) -> int:
        return len(self._inspections)

    def count_treatments(self) -> int:
        return len(self._treatments)

    def count_harvests(self) -> int:
        return len(self._harvests)

    def count_quarantine(self) -> int:
        return len(self._quarantine)

    def clear_quarantine(self) -> int:
        """清空隔离记录，返回清空的数量"""
        count = len(self._quarantine)
        self._quarantine = []
        self._save_quarantine()
        return count
