"""路径回放服务."""
import json
from datetime import datetime
from typing import List, Dict, Tuple, Optional

from ..models import db, PlaybackPath, SafetyRadius, OriginNote, OperationRecord
from .radius_import import RadiusImportService


class PlaybackService:
    """路径回放服务."""

    @staticmethod
    def _generate_path_points(
        x: float, y: float, z: float,
        radius: float,
        origin_x: float = 0, origin_y: float = 0, origin_z: float = 0,
        z_direction: str = "up",
        reverse_z: bool = False
    ) -> List[Dict]:
        """
        生成路径点（圆弧路径）.
        
        Args:
            x, y, z: 端点坐标
            radius: 作业半径
            origin_x, origin_y, origin_z: 原点坐标（补录后应用）
            z_direction: Z轴方向
            reverse_z: 是否反转Z轴（注意：仅标记，不归正）
        """
        points = []
        steps = 36

        actual_z = z if not reverse_z else -z
        actual_z_direction = z_direction if not reverse_z else ("down" if z_direction == "up" else "up")

        start_x = origin_x
        start_y = origin_y
        start_z = origin_z

        for i in range(steps + 1):
            angle = (i / steps) * 90.0
            import math
            rad = math.radians(angle)
            px = origin_x + radius * math.cos(rad)
            py = origin_y + radius * math.sin(rad)
            pz = origin_z + actual_z * (i / steps)
            points.append({
                "step": i,
                "x": round(px, 3),
                "y": round(py, 3),
                "z": round(pz, 3),
                "angle": angle,
                "z_direction": actual_z_direction
            })

        return points

    @staticmethod
    def _get_path_version(record_no: str) -> int:
        """获取下一个路径版本号."""
        max_version = db.session.query(
            db.func.max(PlaybackPath.version)
        ).filter_by(record_no=record_no).scalar()
        return (max_version or 0) + 1

    @staticmethod
    def generate_playback(
        safety_radius_id: int,
        operator: str,
        apply_origin: bool = True,
        description: str = "路径回放"
    ) -> Tuple[OperationRecord, List[PlaybackPath]]:
        """
        生成路径回放.
        
        Args:
            safety_radius_id: 安全半径记录ID，可为None表示全量重跑
            operator: 操作人
            apply_origin: 是否应用坐标原点说明
            description: 操作描述
        """
        op_record = OperationRecord(
            operation_type="rerun",
            operator=operator,
            description=description,
            affected_count=0
        )
        db.session.add(op_record)
        db.session.flush()

        playback_paths = []

        if safety_radius_id:
            srs = [SafetyRadius.query.get(safety_radius_id)]
        else:
            srs = SafetyRadius.query.all()

        count = 0
        for sr in srs:
            if not sr:
                continue

            origin_x, origin_y, origin_z = 0, 0, 0
            is_origin_applied = False
            origin_note = None

            if apply_origin and sr.origin_note_id:
                origin_note = OriginNote.query.get(sr.origin_note_id)
                if origin_note:
                    origin_x = origin_note.origin_x
                    origin_y = origin_note.origin_y
                    origin_z = origin_note.origin_z
                    is_origin_applied = True

            is_reversed = sr.is_z_reversed
            z_axis_applied = sr.z_axis_direction

            if is_reversed:
                z_axis_applied = "down" if sr.z_axis_direction == "up" else "up"

            path_points = PlaybackService._generate_path_points(
                x=sr.x, y=sr.y, z=sr.z,
                radius=sr.radius,
                origin_x=origin_x, origin_y=origin_y, origin_z=origin_z,
                z_direction=sr.z_axis_direction,
                reverse_z=is_reversed
            )

            version = PlaybackService._get_path_version(sr.record_no)
            path_no = f"PATH-{sr.record_no}-V{version}"

            pp = PlaybackPath(
                path_no=path_no,
                safety_radius_id=sr.id,
                record_no=sr.record_no,
                crane_no=sr.crane_no,
                origin_x=origin_x,
                origin_y=origin_y,
                origin_z=origin_z,
                path_points=json.dumps(path_points, ensure_ascii=False),
                z_axis_applied=z_axis_applied,
                is_origin_applied=is_origin_applied,
                version=version,
                operation_record_id=op_record.id
            )

            db.session.add(pp)
            playback_paths.append(pp)
            count += 1

            if origin_note and is_origin_applied:
                origin_note.is_applied = True

        op_record.affected_count = count
        db.session.commit()

        return op_record, playback_paths

    @staticmethod
    def rerun_with_origin(
        operator: str = "许工",
        description: str = "补录坐标原点说明后路径回放更新"
    ) -> Tuple[OperationRecord, List[PlaybackPath]]:
        """
        补录原点说明后重跑回放.
        
        三步流程第三步：路径回放更新
        """
        return PlaybackService.generate_playback(
            safety_radius_id=None,
            operator=operator,
            apply_origin=True,
            description=description
        )

    @staticmethod
    def get_playback_by_record(record_no: str) -> List[PlaybackPath]:
        """查询记录的所有回放版本."""
        return PlaybackPath.query.filter_by(record_no=record_no).order_by(PlaybackPath.version).all()

    @staticmethod
    def compare_results(record_no: str) -> Dict:
        """
        对比同一条记录的不同处理结果.
        
        返回三种处理结果对比：
        1. 正常（顺利记录）
        2. Z轴写反（待复核）
        3. 补录原点后（已更新）
        """
        srs = SafetyRadius.query.filter_by(record_no=record_no).all()
        playbacks = PlaybackService.get_playback_by_record(record_no)

        result = {
            "record_no": record_no,
            "safety_radii": [sr.to_dict() for sr in srs],
            "playback_versions": [],
            "comparison": {}
        }

        for pp in playbacks:
            points = json.loads(pp.path_points)
            result["playback_versions"].append({
                "version": pp.version,
                "path_no": pp.path_no,
                "z_axis_applied": pp.z_axis_applied,
                "is_origin_applied": pp.is_origin_applied,
                "origin": (pp.origin_x, pp.origin_y, pp.origin_z),
                "start_point": points[0] if points else None,
                "end_point": points[-1] if points else None,
                "playback_time": pp.playback_time.isoformat() if pp.playback_time else None
            })

        if len(playbacks) >= 1:
            result["comparison"]["v1_normal"] = {
                "z_axis": playbacks[0].z_axis_applied,
                "origin_applied": playbacks[0].is_origin_applied,
                "origin": (playbacks[0].origin_x, playbacks[0].origin_y, playbacks[0].origin_z)
            }
        if len(playbacks) >= 2:
            result["comparison"]["v2_z_reversed"] = {
                "z_axis": playbacks[1].z_axis_applied,
                "origin_applied": playbacks[1].is_origin_applied,
                "origin": (playbacks[1].origin_x, playbacks[1].origin_y, playbacks[1].origin_z)
            }
        if len(playbacks) >= 3:
            result["comparison"]["v3_origin_updated"] = {
                "z_axis": playbacks[2].z_axis_applied,
                "origin_applied": playbacks[2].is_origin_applied,
                "origin": (playbacks[2].origin_x, playbacks[2].origin_y, playbacks[2].origin_z)
            }

        return result
