import json
import uuid
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models import InspectionPhoto, ImportBatch, RescueProfile
from boundary_rules import BoundaryRuleEngine, BoundaryCheckResult


class ImportService:
    """
    巡检照片导入服务
    ======================================
    核心约束 RULE_002: 重复导入不翻倍
    - 以 photo_number 为唯一键
    - 已存在则跳过，duplicate_count++
    - 新数据则创建 photo + profile
    - 保留 raw_data 不做清洗
    """

    def __init__(self, db: Session):
        self.db = db

    def _photo_exists(self, photo_number: str) -> bool:
        return self.db.query(InspectionPhoto).filter(
            InspectionPhoto.photo_number == photo_number
        ).first() is not None

    def import_photos(
        self,
        photo_records: List[Dict],
        source_file: str,
        imported_by: str
    ) -> Tuple[ImportBatch, List[BoundaryCheckResult]]:
        batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"

        total_count = len(photo_records)
        new_count = 0
        duplicate_count = 0
        check_results: List[BoundaryCheckResult] = []

        for record in photo_records:
            photo_number = record.get("photo_number")
            if not photo_number:
                continue

            exists = self._photo_exists(photo_number)
            dup_result = BoundaryRuleEngine.check_duplicate_import(photo_number, exists)
            check_results.append(dup_result)

            if exists:
                duplicate_count += 1
                continue

            route_length = record.get("route_length")
            has_recalculated = record.get("has_recalculated_length", True)

            length_result = BoundaryRuleEngine.check_route_length({
                "has_recalculated_length": has_recalculated,
                "route_length": route_length,
                "historical_route_length": None
            })
            check_results.append(length_result)

            photo = InspectionPhoto(
                photo_number=photo_number,
                floor=record.get("floor"),
                location_x=record.get("location_x"),
                location_y=record.get("location_y"),
                location_z=record.get("location_z"),
                route_length=route_length,
                has_recalculated_length=has_recalculated,
                raw_data=json.dumps(record, ensure_ascii=False),
                import_batch_id=batch_id
            )
            self.db.add(photo)
            self.db.flush()

            profile = RescueProfile(
                photo_id=photo.id,
                floor_section=record.get("floor"),
                status="pending",
                length_mismatch=not length_result.passed,
                needs_review=not length_result.passed,
                workflow_step="photo_import"
            )
            self.db.add(profile)

            new_count += 1

        batch = ImportBatch(
            batch_id=batch_id,
            source_file=source_file,
            total_count=total_count,
            new_count=new_count,
            duplicate_count=duplicate_count,
            imported_by=imported_by
        )
        self.db.add(batch)
        self.db.commit()

        return batch, check_results

    def get_import_summary(self, batch_id: str) -> Optional[Dict]:
        batch = self.db.query(ImportBatch).filter(
            ImportBatch.batch_id == batch_id
        ).first()

        if not batch:
            return None

        profiles = self.db.query(RescueProfile).join(
            InspectionPhoto, InspectionPhoto.id == RescueProfile.photo_id
        ).filter(
            InspectionPhoto.import_batch_id == batch_id
        ).all()

        needs_review_count = sum(1 for p in profiles if p.needs_review)
        length_mismatch_count = sum(1 for p in profiles if p.length_mismatch)

        return {
            "batch_id": batch.batch_id,
            "source_file": batch.source_file,
            "total": batch.total_count,
            "new": batch.new_count,
            "duplicate": batch.duplicate_count,
            "rescue_profile_count": len(profiles),
            "needs_review": needs_review_count,
            "length_mismatch": length_mismatch_count,
            "imported_by": batch.imported_by,
            "created_at": batch.created_at
        }
