from typing import List, Dict, Tuple, Optional
from datetime import datetime
from models import (
    PointCloudLog, SafetyRadiusEntry, CoordRow, OcclusionPoint,
    ReviewRecord, PointStatus, RecordStatus
)


class WarehouseBlindSpotReview:
    def __init__(self):
        self.review_records: Dict[str, ReviewRecord] = {}
        self.step_history: List[str] = []

    def import_point_cloud_logs(self, photo_id: str, logs: List[PointCloudLog]) -> Tuple[str, List[str]]:
        if photo_id not in self.review_records:
            self.review_records[photo_id] = ReviewRecord(
                photo_id=photo_id,
                record_status=RecordStatus.SUCCESS
            )
        
        record = self.review_records[photo_id]
        record.point_cloud_logs = logs
        
        issues = self._check_coord_mismatch(record)
        if issues and record.coord_rows:
            record.record_status = RecordStatus.NEED_REVIEW
        
        self.step_history.append(f"导入点云抽稀日志: {photo_id}, 发现 {len(issues)} 个问题")
        return photo_id, issues

    def _check_coord_mismatch(self, record: ReviewRecord) -> List[str]:
        issues = []
        photo_point_indices = {log.point_index for log in record.point_cloud_logs}
        coord_point_indices = {row.point_index for row in record.coord_rows}
        
        missing_in_coords = photo_point_indices - coord_point_indices
        for idx in missing_in_coords:
            issues.append(f"照片点位 #{idx} 在坐标表中缺行")
        
        return issues

    def import_coord_table(self, photo_id: str, coords: List[CoordRow]) -> None:
        if photo_id not in self.review_records:
            self.review_records[photo_id] = ReviewRecord(
                photo_id=photo_id,
                record_status=RecordStatus.SUCCESS
            )
        
        record = self.review_records[photo_id]
        record.coord_rows = coords
        
        issues = self._check_coord_mismatch(record)
        if issues:
            record.record_status = RecordStatus.NEED_REVIEW

    def import_safety_radius_table(self, photo_id: str, entries: List[SafetyRadiusEntry]) -> int:
        if photo_id not in self.review_records:
            self.review_records[photo_id] = ReviewRecord(
                photo_id=photo_id,
                record_status=RecordStatus.SUCCESS
            )
        
        record = self.review_records[photo_id]
        record.safety_radius_entries = entries
        
        supplemented_count = self._supplement_from_safety_radius(record)
        if supplemented_count > 0:
            record.record_status = RecordStatus.SUPPLEMENTED
        
        self.step_history.append(f"导入安全半径表: {photo_id}, 补录 {supplemented_count} 条旧口径数据")
        return supplemented_count

    def _supplement_from_safety_radius(self, record: ReviewRecord) -> int:
        photo_point_indices = {log.point_index for log in record.point_cloud_logs}
        coord_point_indices = {row.point_index for row in record.coord_rows}
        safety_indices = {entry.point_index for entry in record.safety_radius_entries}
        
        missing_indices = (photo_point_indices - coord_point_indices) & safety_indices
        return len(missing_indices)

    def generate_occlusion_list(self, photo_id: str, skip_review: bool = False) -> List[OcclusionPoint]:
        record = self.review_records.get(photo_id)
        if not record:
            return []
        
        occlusion_points: List[OcclusionPoint] = []
        coord_map = {row.point_index: row for row in record.coord_rows}
        safety_map = {entry.point_index: entry for entry in record.safety_radius_entries}
        
        for log in record.point_cloud_logs:
            idx = log.point_index
            coord = coord_map.get(idx)
            safety = safety_map.get(idx)
            
            if coord:
                status = PointStatus.NORMAL
                is_occluded = self._check_occlusion(coord, safety)
            elif safety and not skip_review:
                status = PointStatus.FROM_SAFETY_RADIUS
                is_occluded = True
            else:
                status = PointStatus.PENDING_REVIEW
                is_occluded = False
            
            point_id = f"{photo_id}_p{idx}"
            occlusion_point = OcclusionPoint(
                point_id=point_id,
                photo_id=photo_id,
                point_index=idx,
                status=status,
                is_occluded=is_occluded,
                safety_radius=safety.radius_meters if safety else None,
                obstacle_type=safety.obstacle_type if safety else "",
                last_updated=datetime.now()
            )
            
            if status == PointStatus.PENDING_REVIEW:
                occlusion_point.occlusion_reason = "照片有点位但坐标表缺行"
            elif status == PointStatus.FROM_SAFETY_RADIUS:
                occlusion_point.occlusion_reason = "从安全半径表补录的旧口径数据"
                occlusion_point.reviewer_notes = "安全半径表一晚到，返工补录"
            
            occlusion_points.append(occlusion_point)
        
        record.occlusion_points = occlusion_points
        self._update_record_status(record)
        return occlusion_points

    def _update_record_status(self, record: ReviewRecord):
        if not record.occlusion_points:
            return
        
        has_supplemented = any(
            p.status == PointStatus.FROM_SAFETY_RADIUS for p in record.occlusion_points
        )
        has_pending = any(
            p.status == PointStatus.PENDING_REVIEW for p in record.occlusion_points
        )
        
        if has_supplemented:
            record.record_status = RecordStatus.SUPPLEMENTED
        elif has_pending:
            record.record_status = RecordStatus.NEED_REVIEW
        else:
            record.record_status = RecordStatus.SUCCESS

    def _check_occlusion(self, coord: CoordRow, safety: Optional[SafetyRadiusEntry]) -> bool:
        if not safety:
            return False
        return coord.z < 1.5 or safety.radius_meters > 2.0

    def safety_officer_review(self, photo_id: str, point_index: int, 
                              is_approved: bool, reviewer_notes: str = "") -> bool:
        record = self.review_records.get(photo_id)
        if not record:
            return False
        
        for point in record.occlusion_points:
            if point.point_index == point_index and point.status == PointStatus.PENDING_REVIEW:
                if is_approved:
                    point.status = PointStatus.NORMAL
                    point.reviewer_notes = f"安全员复核通过: {reviewer_notes}"
                else:
                    point.reviewer_notes = f"安全员驳回: {reviewer_notes}"
                point.last_updated = datetime.now()
                record.has_manual_correction = True
                return True
        return False

    def rerun_analysis(self, photo_id: str) -> List[OcclusionPoint]:
        record = self.review_records.get(photo_id)
        if not record:
            return []
        
        record.has_rerun = True
        self.step_history.append(f"重跑分析: {photo_id}")
        return self.generate_occlusion_list(photo_id, skip_review=False)

    def get_record_summary(self, photo_id: str) -> Dict:
        record = self.review_records.get(photo_id)
        if not record:
            return {}
        
        normal_count = sum(1 for p in record.occlusion_points if p.status == PointStatus.NORMAL)
        pending_count = sum(1 for p in record.occlusion_points if p.status == PointStatus.PENDING_REVIEW)
        supplemented_count = sum(1 for p in record.occlusion_points if p.status == PointStatus.FROM_SAFETY_RADIUS)
        
        return {
            "photo_id": photo_id,
            "status": record.record_status.value,
            "point_cloud_logs": len(record.point_cloud_logs),
            "coord_rows": len(record.coord_rows),
            "safety_radius_entries": len(record.safety_radius_entries),
            "occlusion_points": {
                "total": len(record.occlusion_points),
                "normal": normal_count,
                "pending_review": pending_count,
                "from_safety_radius": supplemented_count
            },
            "has_manual_correction": record.has_manual_correction,
            "has_rerun": record.has_rerun,
            "created_at": record.created_at.strftime("%Y-%m-%d %H:%M:%S")
        }
