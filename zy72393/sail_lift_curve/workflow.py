import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
import json
import os

from .models import (
    EquipmentRecord,
    ThresholdRecord,
    RecordStatus,
    UnitConversionNote,
    ProjectState,
    LiftCurveData,
)
from .importer import import_equipment_data, detect_hidden_outliers, build_lift_curve_data


def _generate_id() -> str:
    return uuid.uuid4().hex[:12]


class WorkflowEngine:
    STEP_DESCRIPTIONS = {
        1: "设备铭牌参数第一次导入",
        2: "维修师傅老岑补看维修群截图",
        3: "单位换算说明更新",
    }

    def __init__(self, project_id: Optional[str] = None, name: str = "风帆升力曲线项目"):
        self.state = ProjectState(
            project_id=project_id or _generate_id(),
            name=name,
        )

    def step1_import_equipment(self, file_path: str) -> Tuple[List[EquipmentRecord], List[ThresholdRecord]]:
        raw_records = import_equipment_data(file_path)
        updated_records, threshold_records = detect_hidden_outliers(raw_records)
        
        self.state.equipment_records = updated_records
        self.state.threshold_records = threshold_records
        self.state.step = 1
        self.state.step_description = self.STEP_DESCRIPTIONS[1]
        self.state.updated_at = datetime.now()
        
        return updated_records, threshold_records

    def step2_laocen_review(
        self,
        threshold_record_id: str,
        screenshot_ref: Optional[str] = None,
        reviewer_notes: str = "",
        confirm: bool = False,
    ) -> Optional[ThresholdRecord]:
        threshold_record = None
        for t in self.state.threshold_records:
            if t.record_id == threshold_record_id:
                threshold_record = t
                break
        
        if not threshold_record:
            return None

        for i, r in enumerate(self.state.equipment_records):
            if r.record_id == threshold_record.equipment_record_id:
                updated_record = EquipmentRecord(**{k: v for k, v in r.__dict__.items()})
                if screenshot_ref:
                    updated_record.maintenance_screenshot_ref = screenshot_ref
                if reviewer_notes:
                    updated_record.notes = (updated_record.notes + "\n" if updated_record.notes else "") + f"老岑备注: {reviewer_notes}"
                
                if confirm:
                    threshold_record.status = RecordStatus.CONFIRMED_BY_LAOCEN
                    threshold_record.confirmed_by = "老岑"
                    threshold_record.confirmed_time = datetime.now()
                    updated_record.status = RecordStatus.CONFIRMED_BY_LAOCEN
                else:
                    threshold_record.status = RecordStatus.PENDING
                
                self.state.equipment_records[i] = updated_record
                break

        self.state.step = 2
        self.state.step_description = self.STEP_DESCRIPTIONS[2]
        self.state.updated_at = datetime.now()
        
        return threshold_record

    def step3_update_conversion_note(
        self,
        threshold_record_id: str,
        original_unit: str,
        converted_unit: str,
        conversion_factor: float,
        why_kept: str,
        missing_materials: str,
        next_action: str,
        contact_person: str = "老岑",
    ) -> Optional[UnitConversionNote]:
        threshold_record = None
        for t in self.state.threshold_records:
            if t.record_id == threshold_record_id:
                threshold_record = t
                break
        
        if not threshold_record:
            return None

        note = UnitConversionNote(
            record_id=_generate_id(),
            threshold_record_id=threshold_record_id,
            original_unit=original_unit,
            converted_unit=converted_unit,
            conversion_factor=conversion_factor,
            original_value=threshold_record.raw_value,
            converted_value=threshold_record.raw_value * conversion_factor,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_action=next_action,
            contact_person=contact_person,
            last_updated=datetime.now(),
        )

        existing = None
        for i, n in enumerate(self.state.unit_conversion_notes):
            if n.threshold_record_id == threshold_record_id:
                existing = i
                break
        
        if existing is not None:
            self.state.unit_conversion_notes[existing] = note
        else:
            self.state.unit_conversion_notes.append(note)

        self.state.step = 3
        self.state.step_description = self.STEP_DESCRIPTIONS[3]
        self.state.updated_at = datetime.now()
        
        return note

    def get_pending_threshold_records(self) -> List[ThresholdRecord]:
        return [
            t for t in self.state.threshold_records
            if t.status in (RecordStatus.HIDDEN_BY_AVG, RecordStatus.PENDING, RecordStatus.OUTLIER)
        ]

    def get_confirmed_records(self) -> List[ThresholdRecord]:
        return [
            t for t in self.state.threshold_records
            if t.status == RecordStatus.CONFIRMED_BY_LAOCEN
        ]

    def get_lift_curve_data(self) -> LiftCurveData:
        return build_lift_curve_data(self.state.equipment_records, self.state.threshold_records)

    def get_record_detail(self, record_id: str) -> Optional[Dict[str, Any]]:
        for r in self.state.equipment_records:
            if r.record_id == record_id:
                threshold = None
                for t in self.state.threshold_records:
                    if t.equipment_record_id == record_id:
                        threshold = t
                        break
                
                conversion = None
                if threshold:
                    for n in self.state.unit_conversion_notes:
                        if n.threshold_record_id == threshold.record_id:
                            conversion = n
                            break
                
                return {
                    "equipment_record": r,
                    "threshold_record": threshold,
                    "conversion_note": conversion,
                }
        return None

    def generate_report_text(self) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("          实验风帆升力曲线报告")
        lines.append("=" * 60)
        lines.append(f"项目ID: {self.state.project_id}")
        lines.append(f"项目名称: {self.state.name}")
        lines.append(f"当前步骤: 第{self.state.step}步 - {self.state.step_description}")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("一、数据概览")
        lines.append("-" * 60)
        lines.append(f"总记录数: {len(self.state.equipment_records)}")
        
        status_counts: Dict[str, int] = {}
        for r in self.state.equipment_records:
            status_counts[r.status] = status_counts.get(r.status, 0) + 1
        for status, count in status_counts.items():
            lines.append(f"  {status}: {count} 条")
        
        lines.append("")
        lines.append("-" * 60)
        lines.append("二、超阈值被平均值盖掉的记录（需老岑复核）")
        lines.append("-" * 60)
        
        pending = self.get_pending_threshold_records()
        if pending:
            for i, t in enumerate(pending, 1):
                equip = None
                for r in self.state.equipment_records:
                    if r.record_id == t.equipment_record_id:
                        equip = r
                        break
                
                lines.append(f"\n【记录 {i}】阈值记录ID: {t.record_id}")
                if equip:
                    lines.append(f"  设备ID: {equip.equipment_id} | 设备名称: {equip.equipment_name}")
                    lines.append(f"  铭牌参数: {json.dumps(equip.nameplate_params, ensure_ascii=False)}")
                    lines.append(f"  测量时间: {equip.measurement_time}")
                lines.append(f"  原始值: {t.raw_value:.4f} | 平均值: {t.averaged_value:.4f}")
                lines.append(f"  阈值范围: [{t.threshold_lower:.4f}, {t.threshold_upper:.4f}]")
                lines.append(f"  偏离程度: {t.deviation_percent:.1f}%")
                lines.append(f"  当前状态: {t.status}")
                if t.confirmed_by:
                    lines.append(f"  确认人: {t.confirmed_by} | 确认时间: {t.confirmed_time}")
                if equip and equip.maintenance_screenshot_ref:
                    lines.append(f"  维修群截图: {equip.maintenance_screenshot_ref}")
        else:
            lines.append("  暂无待处理记录")
        
        lines.append("")
        lines.append("-" * 60)
        lines.append("三、单位换算说明")
        lines.append("-" * 60)
        
        if self.state.unit_conversion_notes:
            for i, note in enumerate(self.state.unit_conversion_notes, 1):
                t = None
                for tr in self.state.threshold_records:
                    if tr.record_id == note.threshold_record_id:
                        t = tr
                        break
                
                lines.append(f"\n【说明 {i}】单位换算ID: {note.record_id}")
                lines.append(f"  关联阈值记录: {note.threshold_record_id}")
                lines.append(f"  换算: {note.original_value:.4f} {note.original_unit} = {note.converted_value:.4f} {note.converted_unit}")
                lines.append(f"  换算系数: {note.conversion_factor}")
                lines.append(f"  ▶ 为什么被留下: {note.why_kept}")
                lines.append(f"  ▶ 还缺什么材料: {note.missing_materials}")
                lines.append(f"  ▶ 下一步找谁: {note.next_action}")
                lines.append(f"  ▶ 联系人: {note.contact_person}")
                lines.append(f"  更新时间: {note.last_updated}")
        else:
            lines.append("  暂无单位换算说明，请完成第3步更新")
        
        lines.append("")
        lines.append("=" * 60)
        lines.append("报告结束")
        lines.append("=" * 60)
        
        return "\n".join(lines)

    def save_project(self, directory: str):
        os.makedirs(directory, exist_ok=True)
        file_path = os.path.join(directory, f"project_{self.state.project_id}.json")
        
        data = {
            "project_id": self.state.project_id,
            "name": self.state.name,
            "step": self.state.step,
            "step_description": self.state.step_description,
            "created_at": self.state.created_at.isoformat(),
            "updated_at": self.state.updated_at.isoformat(),
            "equipment_records": [
                {**r.__dict__, "measurement_time": r.measurement_time.isoformat(), "status": r.status}
                for r in self.state.equipment_records
            ],
            "threshold_records": [
                {
                    **t.__dict__,
                    "discovered_time": t.discovered_time.isoformat() if t.discovered_time else None,
                    "confirmed_time": t.confirmed_time.isoformat() if t.confirmed_time else None,
                    "status": t.status,
                }
                for t in self.state.threshold_records
            ],
            "unit_conversion_notes": [
                {
                    **n.__dict__,
                    "last_updated": n.last_updated.isoformat() if n.last_updated else None,
                }
                for n in self.state.unit_conversion_notes
            ],
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return file_path

    @classmethod
    def load_project(cls, file_path: str) -> "WorkflowEngine":
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        engine = cls(project_id=data["project_id"], name=data["name"])
        engine.state.step = data["step"]
        engine.state.step_description = data["step_description"]
        engine.state.created_at = datetime.fromisoformat(data["created_at"])
        engine.state.updated_at = datetime.fromisoformat(data["updated_at"])
        
        from datetime import datetime as dt
        
        engine.state.equipment_records = []
        for r_data in data["equipment_records"]:
            r_data["measurement_time"] = dt.fromisoformat(r_data["measurement_time"])
            r_data["status"] = RecordStatus(r_data["status"])
            engine.state.equipment_records.append(EquipmentRecord(**r_data))
        
        engine.state.threshold_records = []
        for t_data in data["threshold_records"]:
            if t_data.get("discovered_time"):
                t_data["discovered_time"] = dt.fromisoformat(t_data["discovered_time"])
            if t_data.get("confirmed_time"):
                t_data["confirmed_time"] = dt.fromisoformat(t_data["confirmed_time"])
            t_data["status"] = RecordStatus(t_data["status"])
            engine.state.threshold_records.append(ThresholdRecord(**t_data))
        
        engine.state.unit_conversion_notes = []
        for n_data in data["unit_conversion_notes"]:
            if n_data.get("last_updated"):
                n_data["last_updated"] = dt.fromisoformat(n_data["last_updated"])
            engine.state.unit_conversion_notes.append(UnitConversionNote(**n_data))
        
        return engine
