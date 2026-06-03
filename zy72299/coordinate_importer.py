from datetime import datetime
from typing import List, Dict, Optional
import uuid
from models import (
    CoordinateOrigin,
    Coordinate3D,
    ObstacleRecord,
    ObstacleType,
    RecordStatus,
    HistoryEntry,
)


class CoordinateOriginImporter:
    def __init__(self):
        self.history: List[HistoryEntry] = []

    def import_origin_spec(
        self,
        building_id: str,
        origin_point: Dict[str, float],
        description: str,
        obstacles_data: List[Dict],
        actor: str = "system",
    ) -> Dict:
        origin = CoordinateOrigin(
            origin_id=f"origin_{uuid.uuid4().hex[:8]}",
            building_id=building_id,
            origin_point=Coordinate3D(**origin_point),
            description=description,
            imported_at=datetime.now(),
        )

        self._add_history(
            action="IMPORT_COORDINATE_ORIGIN",
            actor=actor,
            details={
                "origin_id": origin.origin_id,
                "building_id": building_id,
                "origin_point": origin_point,
                "description": description,
                "obstacle_count": len(obstacles_data),
            },
        )

        records = []
        for obs_data in obstacles_data:
            record = ObstacleRecord(
                record_id=f"rec_{uuid.uuid4().hex[:8]}",
                building_id=building_id,
                obstacle_name=obs_data["name"],
                obstacle_type=ObstacleType(obs_data["type"]),
                position=Coordinate3D(**obs_data["position"]),
                origin_id=origin.origin_id,
                status=RecordStatus.NORMAL,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                caliber_source="coordinate_origin_spec",
            )
            records.append(record)

            self._add_history(
                action="CREATE_OBSTACLE_RECORD",
                actor=actor,
                details={
                    "record_id": record.record_id,
                    "obstacle_name": record.obstacle_name,
                    "position": obs_data["position"],
                    "source": "coordinate_origin_spec",
                },
                record_id=record.record_id,
            )

        return {
            "origin": origin,
            "records": records,
            "history": self.history.copy(),
        }

    def _add_history(
        self,
        action: str,
        actor: str,
        details: Dict,
        record_id: Optional[str] = None,
    ):
        entry = HistoryEntry(
            entry_id=f"hist_{uuid.uuid4().hex[:8]}",
            timestamp=datetime.now(),
            action=action,
            actor=actor,
            details=details,
            record_id=record_id,
        )
        self.history.append(entry)
