import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from .models import (
    IntersectionPhoto,
    OriginalRow,
    ManualChange,
    ProcessingStatus,
    HistoryRecord,
    HeatmapIssue,
)


class DataManager:
    def __init__(self, storage_path: str = "data/storage"):
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.photos: Dict[str, IntersectionPhoto] = {}
        self.history: List[HistoryRecord] = []
        self._load_data()

    def _generate_photo_id(self, row_data: Dict[str, Any], source_file: str) -> str:
        unique_key = f"{source_file}:{json.dumps(row_data, sort_keys=True, ensure_ascii=False)}"
        return hashlib.md5(unique_key.encode("utf-8")).hexdigest()[:16]

    def _load_data(self):
        photos_file = self.storage_path / "photos.json"
        history_file = self.storage_path / "history.json"
        
        if photos_file.exists():
            with open(photos_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for pid, pdata in data.items():
                    original_row = OriginalRow(
                        row_number=pdata["original_row"]["row_number"],
                        raw_data=pdata["original_row"]["raw_data"],
                        source_file=pdata["original_row"]["source_file"],
                        import_timestamp=datetime.fromisoformat(pdata["original_row"]["import_timestamp"]),
                    )
                    manual_changes = [
                        ManualChange(
                            field_name=mc["field_name"],
                            old_value=mc["old_value"],
                            new_value=mc["new_value"],
                            operator=mc["operator"],
                            change_timestamp=datetime.fromisoformat(mc["change_timestamp"]),
                            reason=mc["reason"],
                        )
                        for mc in pdata.get("manual_changes", [])
                    ]
                    photo = IntersectionPhoto(
                        photo_id=pdata["photo_id"],
                        intersection_name=pdata["intersection_name"],
                        original_row=original_row,
                        current_status=ProcessingStatus(pdata["current_status"]),
                        manual_changes=manual_changes,
                        bus_card_hours=pdata.get("bus_card_hours"),
                        heatmap_data=pdata.get("heatmap_data"),
                        heatmap_issue=HeatmapIssue(pdata.get("heatmap_issue", HeatmapIssue.NONE)),
                        review_note=pdata.get("review_note"),
                        remark=pdata.get("remark"),
                        created_at=datetime.fromisoformat(pdata["created_at"]),
                        updated_at=datetime.fromisoformat(pdata["updated_at"]),
                    )
                    self.photos[pid] = photo

        if history_file.exists():
            with open(history_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for hdata in data:
                    record = HistoryRecord(
                        record_id=hdata["record_id"],
                        photo_id=hdata["photo_id"],
                        change_type=hdata["change_type"],
                        old_snapshot=hdata["old_snapshot"],
                        new_snapshot=hdata["new_snapshot"],
                        operator=hdata["operator"],
                        change_timestamp=datetime.fromisoformat(hdata["change_timestamp"]),
                        description=hdata["description"],
                    )
                    self.history.append(record)

    def _save_data(self):
        photos_file = self.storage_path / "photos.json"
        history_file = self.storage_path / "history.json"
        
        photos_data = {}
        for pid, photo in self.photos.items():
            photos_data[pid] = {
                "photo_id": photo.photo_id,
                "intersection_name": photo.intersection_name,
                "original_row": {
                    "row_number": photo.original_row.row_number,
                    "raw_data": photo.original_row.raw_data,
                    "source_file": photo.original_row.source_file,
                    "import_timestamp": photo.original_row.import_timestamp.isoformat(),
                },
                "current_status": photo.current_status.value,
                "manual_changes": [
                    {
                        "field_name": mc.field_name,
                        "old_value": mc.old_value,
                        "new_value": mc.new_value,
                        "operator": mc.operator,
                        "change_timestamp": mc.change_timestamp.isoformat(),
                        "reason": mc.reason,
                    }
                    for mc in photo.manual_changes
                ],
                "bus_card_hours": photo.bus_card_hours,
                "heatmap_data": photo.heatmap_data,
                "heatmap_issue": photo.heatmap_issue.value,
                "review_note": photo.review_note,
                "remark": photo.remark,
                "created_at": photo.created_at.isoformat(),
                "updated_at": photo.updated_at.isoformat(),
            }
        
        with open(photos_file, "w", encoding="utf-8") as f:
            json.dump(photos_data, f, ensure_ascii=False, indent=2)
        
        history_data = [
            {
                "record_id": h.record_id,
                "photo_id": h.photo_id,
                "change_type": h.change_type,
                "old_snapshot": h.old_snapshot,
                "new_snapshot": h.new_snapshot,
                "operator": h.operator,
                "change_timestamp": h.change_timestamp.isoformat(),
                "description": h.description,
            }
            for h in self.history
        ]
        
        with open(history_file, "w", encoding="utf-8") as f:
            json.dump(history_data, f, ensure_ascii=False, indent=2)

    def _photo_to_snapshot(self, photo: IntersectionPhoto) -> Dict[str, Any]:
        return {
            "photo_id": photo.photo_id,
            "intersection_name": photo.intersection_name,
            "current_status": photo.current_status.value,
            "bus_card_hours": photo.bus_card_hours,
            "heatmap_data": photo.heatmap_data,
            "heatmap_issue": photo.heatmap_issue.value,
            "review_note": photo.review_note,
            "remark": photo.remark,
            "updated_at": photo.updated_at.isoformat(),
        }

    def _add_history_record(
        self,
        photo: IntersectionPhoto,
        change_type: str,
        old_snapshot: Dict[str, Any],
        operator: str,
        description: str,
    ):
        record = HistoryRecord(
            record_id=hashlib.md5(f"{photo.photo_id}{datetime.now().isoformat()}".encode()).hexdigest()[:16],
            photo_id=photo.photo_id,
            change_type=change_type,
            old_snapshot=old_snapshot,
            new_snapshot=self._photo_to_snapshot(photo),
            operator=operator,
            change_timestamp=datetime.now(),
            description=description,
        )
        self.history.append(record)

    def import_photos(
        self,
        rows: List[Dict[str, Any]],
        source_file: str,
        operator: str,
    ) -> Tuple[List[IntersectionPhoto], List[Dict[str, Any]]]:
        imported = []
        skipped = []
        
        for idx, row_data in enumerate(rows, start=1):
            photo_id = self._generate_photo_id(row_data, source_file)
            intersection_name = row_data.get("路口名称", row_data.get("intersection_name", f"未知路口_{idx}"))
            
            if photo_id in self.photos:
                existing = self.photos[photo_id]
                skipped.append({
                    "photo_id": photo_id,
                    "intersection_name": intersection_name,
                    "row_number": idx,
                    "original_import_time": existing.created_at.isoformat(),
                    "current_status": existing.current_status.value,
                })
                continue
            
            original_row = OriginalRow(
                row_number=idx,
                raw_data=row_data,
                source_file=source_file,
                import_timestamp=datetime.now(),
            )
            
            photo = IntersectionPhoto(
                photo_id=photo_id,
                intersection_name=intersection_name,
                original_row=original_row,
                current_status=ProcessingStatus.IMPORTED,
            )
            
            self.photos[photo_id] = photo
            self._add_history_record(
                photo,
                change_type="导入",
                old_snapshot={},
                operator=operator,
                description=f"从 {source_file} 第 {idx} 行导入路口照片数据",
            )
            imported.append(photo)
        
        self._save_data()
        return imported, skipped

    def update_field(
        self,
        photo_id: str,
        field_name: str,
        new_value: Any,
        operator: str,
        reason: str,
    ) -> Optional[IntersectionPhoto]:
        if photo_id not in self.photos:
            return None
        
        photo = self.photos[photo_id]
        old_snapshot = self._photo_to_snapshot(photo)
        old_value = getattr(photo, field_name, None)
        
        if old_value == new_value:
            return photo
        
        change = ManualChange(
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            change_timestamp=datetime.now(),
            reason=reason,
        )
        photo.manual_changes.append(change)
        setattr(photo, field_name, new_value)
        photo.updated_at = datetime.now()
        
        self._add_history_record(
            photo,
            change_type="字段修改",
            old_snapshot=old_snapshot,
            operator=operator,
            description=f"修改 {field_name}: {old_value} → {new_value}",
        )
        
        self._save_data()
        return photo

    def get_photo(self, photo_id: str) -> Optional[IntersectionPhoto]:
        return self.photos.get(photo_id)

    def get_all_photos(self) -> List[IntersectionPhoto]:
        return list(self.photos.values())

    def get_photos_by_status(self, status: ProcessingStatus) -> List[IntersectionPhoto]:
        return [p for p in self.photos.values() if p.current_status == status]

    def get_photo_history(self, photo_id: str) -> List[HistoryRecord]:
        return [h for h in self.history if h.photo_id == photo_id]

    def get_all_history(self) -> List[HistoryRecord]:
        return self.history

    def get_statistics(self) -> Dict[str, Any]:
        status_counts = {}
        for status in ProcessingStatus:
            status_counts[status.value] = len(
                [p for p in self.photos.values() if p.current_status == status]
            )
        
        issue_counts = {}
        for issue in HeatmapIssue:
            issue_counts[issue.value] = len(
                [p for p in self.photos.values() if p.heatmap_issue == issue]
            )
        
        return {
            "total_photos": len(self.photos),
            "status_distribution": status_counts,
            "issue_distribution": issue_counts,
            "total_changes": len(self.history),
        }
