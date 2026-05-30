from typing import Dict, List, Optional, Tuple
from datetime import datetime
import uuid
import json
import os
import csv

from models import (
    Room, Material, CalculationResult, ValidationIssue, HistoryEntry,
    STANDARD_FREQUENCIES, FREQUENCY_LABELS
)
from storage import StorageManager
from calculator import SabineCalculator, ValidationEngine


class AcousticsService:
    def __init__(self, data_dir: str = "data"):
        self.storage = StorageManager(data_dir)
        self.calculator = SabineCalculator()
        self.validator = ValidationEngine()

    def create_room(self, name: str, length: float, width: float, height: float,
                    operator: str = "system", notes: str = "") -> Tuple[Room, List[ValidationIssue]]:
        volume = length * width * height
        surface_area = 2 * (length * width + length * height + width * height)

        room = Room(
            id=str(uuid.uuid4()),
            name=name,
            length=length,
            width=width,
            height=height,
            volume=volume,
            surface_area=surface_area,
            materials=[],
            status="pending_materials",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            notes=notes
        )

        issues = self.validator.validate_room(room)
        self.storage.save_room(room)

        self._add_history(
            room_id=room.id,
            operation_type="create",
            field_name=None,
            old_value=None,
            new_value=f"Room created: {name}, {length}x{width}x{height}m",
            operator=operator,
            reason="Initial room creation with dimensions"
        )

        return room, issues

    def add_material(self, room_id: str, material_name: str, area: float, unit: str,
                     absorption_coefficients: Dict[int, float],
                     operator: str = "system") -> Tuple[Optional[Room], List[ValidationIssue]]:
        room = self.storage.get_room(room_id)
        if not room:
            return None, [ValidationIssue(
                type="room_not_found",
                severity="error",
                message=f"房间ID '{room_id}'不存在",
                related_object=room_id,
                details={}
            )]

        existing_issues = self.validator.validate_room(room)

        old_materials_count = len(room.materials)
        old_status = room.status

        material = Material(
            id=str(uuid.uuid4()),
            name=material_name,
            area=area,
            unit=unit,
            absorption_coefficients=absorption_coefficients,
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        room.materials.append(material)
        room.updated_at = datetime.now()

        new_issues = self.validator.validate_room(room)
        has_errors = any(i.severity == "error" for i in new_issues)
        room.status = "has_errors" if has_errors else "ready" if room.materials else "pending_materials"

        self.storage.save_room(room)

        self._add_history(
            room_id=room.id,
            operation_type="add_material",
            field_name="materials",
            old_value=f"{old_materials_count} materials, status: {old_status}",
            new_value=f"{len(room.materials)} materials, status: {room.status}",
            operator=operator,
            reason=f"Added material: {material_name}"
        )

        if room.status == "ready":
            self.calculate_reverberation(room_id, operator)

        return room, new_issues

    def update_material(self, room_id: str, material_id: str,
                        material_name: Optional[str] = None,
                        area: Optional[float] = None,
                        unit: Optional[str] = None,
                        absorption_coefficients: Optional[Dict[int, float]] = None,
                        operator: str = "system") -> Tuple[Optional[Room], List[ValidationIssue]]:
        room = self.storage.get_room(room_id)
        if not room:
            return None, [ValidationIssue(
                type="room_not_found",
                severity="error",
                message=f"房间ID '{room_id}'不存在",
                related_object=room_id,
                details={}
            )]

        material = next((m for m in room.materials if m.id == material_id), None)
        if not material:
            return None, [ValidationIssue(
                type="material_not_found",
                severity="error",
                message=f"材料ID '{material_id}'不存在于房间 '{room.name}'",
                related_object=material_id,
                details={"room_id": room_id, "room_name": room.name}
            )]

        old_value = f"name={material.name}, area={material.area}{material.unit}, alpha={material.absorption_coefficients}"

        if material_name is not None:
            material.name = material_name
        if area is not None:
            material.area = area
        if unit is not None:
            material.unit = unit
        if absorption_coefficients is not None:
            material.absorption_coefficients.update(absorption_coefficients)

        material.updated_at = datetime.now()
        room.updated_at = datetime.now()

        new_value = f"name={material.name}, area={material.area}{material.unit}, alpha={material.absorption_coefficients}"

        new_issues = self.validator.validate_room(room)
        has_errors = any(i.severity == "error" for i in new_issues)
        old_status = room.status
        room.status = "has_errors" if has_errors else "ready" if room.materials else "pending_materials"

        self.storage.save_room(room)

        self._add_history(
            room_id=room.id,
            operation_type="update_material",
            field_name=f"material.{material_id}",
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            reason=f"Updated material: {material.name}"
        )

        if room.status == "ready" and old_status != room.status:
            self.calculate_reverberation(room_id, operator)
        elif room.status == "ready":
            self.calculate_reverberation(room_id, operator)

        return room, new_issues

    def remove_material(self, room_id: str, material_id: str,
                        operator: str = "system") -> Tuple[Optional[Room], List[ValidationIssue]]:
        room = self.storage.get_room(room_id)
        if not room:
            return None, [ValidationIssue(
                type="room_not_found",
                severity="error",
                message=f"房间ID '{room_id}'不存在",
                related_object=room_id,
                details={}
            )]

        material = next((m for m in room.materials if m.id == material_id), None)
        if not material:
            return None, [ValidationIssue(
                type="material_not_found",
                severity="error",
                message=f"材料ID '{material_id}'不存在于房间 '{room.name}'",
                related_object=material_id,
                details={"room_id": room_id, "room_name": room.name}
            )]

        old_materials_count = len(room.materials)
        room.materials = [m for m in room.materials if m.id != material_id]
        room.updated_at = datetime.now()

        new_issues = self.validator.validate_room(room)
        has_errors = any(i.severity == "error" for i in new_issues)
        room.status = "has_errors" if has_errors else "ready" if room.materials else "pending_materials"

        self.storage.save_room(room)

        self._add_history(
            room_id=room.id,
            operation_type="remove_material",
            field_name="materials",
            old_value=f"{old_materials_count} materials, removed: {material.name}",
            new_value=f"{len(room.materials)} materials",
            operator=operator,
            reason=f"Removed material: {material.name}"
        )

        if room.materials:
            self.calculate_reverberation(room_id, operator)
        else:
            self.storage.delete_result(room_id)

        return room, new_issues

    def calculate_reverberation(self, room_id: str,
                                operator: str = "system") -> Tuple[Optional[CalculationResult], List[ValidationIssue]]:
        room = self.storage.get_room(room_id)
        if not room:
            return None, [ValidationIssue(
                type="room_not_found",
                severity="error",
                message=f"房间ID '{room_id}'不存在",
                related_object=room_id,
                details={}
            )]

        if not room.materials:
            return None, [ValidationIssue(
                type="no_materials",
                severity="error",
                message=f"房间 '{room.name}' 没有添加任何吸声材料，无法计算混响时间",
                related_object=room.name,
                details={}
            )]

        issues = self.validator.validate_room(room)
        has_errors = any(i.severity == "error" for i in issues)

        result = self.calculator.calculate_room(room, issues)
        self.storage.save_result(result)

        self._add_history(
            room_id=room.id,
            operation_type="calculate",
            field_name="reverberation",
            old_value="Recalculation triggered",
            new_value=f"T60 avg: {result.average_t60:.3f}s",
            operator=operator,
            reason="Reverberation time calculation"
        )

        return result, issues

    def batch_process(self, room_ids: Optional[List[str]] = None,
                      operator: str = "system") -> Dict:
        if room_ids is None:
            rooms = self.storage.get_all_rooms()
        else:
            rooms = [r for r in [self.storage.get_room(rid) for rid in room_ids] if r]

        normal_records = []
        problem_records = []

        for room in rooms:
            issues = self.validator.validate_room(room)
            has_errors = any(i.severity == "error" for i in issues)
            has_warnings = any(i.severity == "warning" for i in issues)

            if not room.materials:
                problem_records.append({
                    "room_id": room.id,
                    "room_name": room.name,
                    "status": "no_materials",
                    "issues": [i.to_dict() for i in issues if i.severity == "error"],
                    "warnings": [i.to_dict() for i in issues if i.severity == "warning"]
                })
                continue

            result, calc_issues = self.calculate_reverberation(room.id, operator)
            all_issues = issues + calc_issues
            errors = [i for i in all_issues if i.severity == "error"]
            warnings = [i for i in all_issues if i.severity == "warning"]

            record = {
                "room_id": room.id,
                "room_name": room.name,
                "result": result.to_dict() if result else None,
                "warnings": [w.to_dict() for w in warnings]
            }

            if errors:
                record["errors"] = [e.to_dict() for e in errors]
                problem_records.append(record)
            else:
                normal_records.append(record)

        return {
            "total_processed": len(rooms),
            "normal_records": normal_records,
            "problem_records": problem_records,
            "normal_count": len(normal_records),
            "problem_count": len(problem_records)
        }

    def get_frequency_analysis(self, room_id: str) -> Optional[Dict]:
        room = self.storage.get_room(room_id)
        result = self.storage.get_result(room_id)

        if not room or not result:
            return None

        freq_data = []
        for freq in STANDARD_FREQUENCIES:
            t60 = result.t60_by_frequency.get(freq, 0)
            absorption = result.total_absorption_by_frequency.get(freq, 0)
            deviation = t60 - result.average_t60 if result.average_t60 else 0

            material_breakdown = []
            for material in room.materials:
                contrib = result.material_contributions.get(material.id, {}).get(freq, 0)
                pct = (contrib / absorption * 100) if absorption > 0 else 0
                material_breakdown.append({
                    "material_name": material.name,
                    "contribution_sabins": round(contrib, 3),
                    "contribution_percent": round(pct, 1)
                })

            material_breakdown.sort(key=lambda x: x["contribution_percent"], reverse=True)

            freq_data.append({
                "frequency": freq,
                "frequency_label": FREQUENCY_LABELS[freq],
                "t60_seconds": round(t60, 3) if t60 != float('inf') else "∞",
                "total_absorption_sabins": round(absorption, 3),
                "deviation_from_average": round(deviation, 3),
                "material_breakdown": material_breakdown
            })

        sabine_issues = [i for i in result.issues if i.type == "sabine_applicability"]

        return {
            "room_id": room.id,
            "room_name": room.name,
            "room_dimensions": f"{room.length}x{room.width}x{room.height}m",
            "room_volume": round(room.volume, 2),
            "surface_area": round(room.surface_area, 2),
            "average_t60": round(result.average_t60, 3),
            "sabine_applicable": result.sabine_formula_applied,
            "sabine_notes": [i.message for i in sabine_issues],
            "frequency_data": freq_data,
            "calculation_timestamp": result.calculation_timestamp.isoformat(),
            "total_issues": len(result.issues),
            "error_count": sum(1 for i in result.issues if i.severity == "error"),
            "warning_count": sum(1 for i in result.issues if i.severity == "warning")
        }

    def get_room_history(self, room_id: str) -> List[Dict]:
        entries = self.storage.get_room_history(room_id)
        return [
            {
                "timestamp": e.timestamp.isoformat(),
                "operation": e.operation_type,
                "field": e.field_name,
                "old_value": e.old_value,
                "new_value": e.new_value,
                "operator": e.operator,
                "reason": e.reason
            }
            for e in entries
        ]

    def manual_edit(self, room_id: str, field_name: str, old_value: str, new_value: str,
                    operator: str, reason: str) -> bool:
        room = self.storage.get_room(room_id)
        if not room:
            return False

        self._add_history(
            room_id=room_id,
            operation_type="manual_edit",
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            reason=reason
        )

        return True

    def export_to_csv(self, filepath: str, room_ids: Optional[List[str]] = None) -> Dict:
        if room_ids is None:
            results = self.storage.get_all_results()
        else:
            results = [r for r in [self.storage.get_result(rid) for rid in room_ids] if r]

        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)

            header = ["房间ID", "房间名称", "平均T60(s)", "Sabine公式适用"]
            for freq in STANDARD_FREQUENCIES:
                header.append(f"T60_{FREQUENCY_LABELS[freq]}(s)")
            for freq in STANDARD_FREQUENCIES:
                header.append(f"吸声量_{FREQUENCY_LABELS[freq]}(sabins)")
            header.extend(["错误数", "警告数", "计算时间"])

            writer.writerow(header)

            for result in results:
                row = [
                    result.room_id,
                    result.room_name,
                    f"{result.average_t60:.3f}",
                    "是" if result.sabine_formula_applied else "否"
                ]
                for freq in STANDARD_FREQUENCIES:
                    t60 = result.t60_by_frequency.get(freq, 0)
                    row.append(f"{t60:.3f}" if t60 != float('inf') else "N/A")
                for freq in STANDARD_FREQUENCIES:
                    row.append(f"{result.total_absorption_by_frequency.get(freq, 0):.3f}")
                error_count = sum(1 for i in result.issues if i.severity == "error")
                warning_count = sum(1 for i in result.issues if i.severity == "warning")
                row.extend([error_count, warning_count, result.calculation_timestamp.isoformat()])
                writer.writerow(row)

        return {
            "exported_count": len(results),
            "filepath": filepath
        }

    def export_to_json(self, filepath: str, room_ids: Optional[List[str]] = None) -> Dict:
        data = self.storage.export_all_data()
        if room_ids is not None:
            data["rooms"] = {rid: r for rid, r in data["rooms"].items() if rid in room_ids}
            data["results"] = {rid: r for rid, r in data["results"].items() if rid in room_ids}
            data["history"] = {rid: h for rid, h in data["history"].items() if rid in room_ids}

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return {
            "filepath": filepath,
            "rooms_count": len(data["rooms"]),
            "results_count": len(data["results"]),
            "history_entries": sum(len(v) for v in data["history"].values())
        }

    def verify_integrity(self) -> Dict:
        return self.storage.verify_data_integrity()

    def get_all_rooms_summary(self) -> List[Dict]:
        rooms = self.storage.get_all_rooms()
        results = {r.room_id: r for r in self.storage.get_all_results()}

        summary = []
        for room in rooms:
            result = results.get(room.id)
            summary.append({
                "room_id": room.id,
                "name": room.name,
                "dimensions": f"{room.length}x{room.width}x{room.height}m",
                "volume": round(room.volume, 2),
                "material_count": len(room.materials),
                "status": room.status,
                "average_t60": round(result.average_t60, 3) if result else None,
                "has_errors": len([i for i in result.issues if i.severity == "error"]) > 0 if result else False,
                "last_updated": room.updated_at.isoformat()
            })
        return summary

    def _add_history(self, room_id: str, operation_type: str, field_name: Optional[str],
                     old_value: Optional[str], new_value: Optional[str],
                     operator: str, reason: str):
        entry = HistoryEntry(
            id=str(uuid.uuid4()),
            room_id=room_id,
            operation_type=operation_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            timestamp=datetime.now(),
            reason=reason
        )
        self.storage.add_history_entry(entry)
