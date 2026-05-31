from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models.models import (
    SoundMaterial,
    MatchRelation,
    AdScript,
    AudioTrack,
    ExportRecord,
    ExportItem,
)
from ..schemas.materials import TraceLink, TraceChainResponse
from ..utils.common import parse_tags


class TraceService:
    def __init__(self, db: Session):
        self.db = db

    def get_trace_chain(self, material_id: int) -> Optional[TraceChainResponse]:
        material = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.id == material_id)
            .first()
        )
        if not material:
            return None

        links: List[TraceLink] = []
        links.append(
            TraceLink(
                level=1,
                type="material",
                id=material.id,
                no=material.material_no,
                name=material.name,
                timestamp=material.created_at,
                operator="system",
            )
        )

        match_relations = (
            self.db.query(MatchRelation)
            .filter(MatchRelation.material_id == material_id)
            .order_by(MatchRelation.created_at.desc())
            .all()
        )

        for match in match_relations:
            links.append(
                TraceLink(
                    level=2,
                    type="match",
                    id=match.id,
                    no=f"MATCH-{match.id}",
                    name=f"{match.match_type}匹配",
                    timestamp=match.created_at,
                    operator=match.created_by,
                )
            )

            ad_script = (
                self.db.query(AdScript)
                .filter(AdScript.id == match.ad_script_id)
                .first()
            )
            if ad_script:
                links.append(
                    TraceLink(
                        level=3,
                        type="ad_script",
                        id=ad_script.id,
                        no=ad_script.script_no,
                        name=f"口播-{ad_script.batch_no}",
                        timestamp=ad_script.created_at,
                        operator="system",
                    )
                )

                audio_track = (
                    self.db.query(AudioTrack)
                    .filter(AudioTrack.id == match.audio_track_id)
                    .first()
                )
                if audio_track:
                    links.append(
                        TraceLink(
                            level=4,
                            type="audio_track",
                            id=audio_track.id,
                            no=audio_track.track_no,
                            name=audio_track.title,
                            timestamp=audio_track.recorded_at or audio_track.created_at,
                            operator="system",
                        )
                    )

        export_records_data = []
        export_items = (
            self.db.query(ExportItem)
            .filter(ExportItem.material_id == material_id)
            .all()
        )
        for export_item in export_items:
            export_record = (
                self.db.query(ExportRecord)
                .filter(ExportRecord.id == export_item.export_id)
                .first()
            )
            if export_record:
                export_records_data.append(
                    {
                        "id": export_record.id,
                        "export_no": export_record.export_no,
                        "filename": export_record.filename,
                        "total_count": export_record.total_count,
                        "exported_by": export_record.exported_by,
                        "created_at": export_record.created_at.isoformat() if export_record.created_at else None,
                    }
                )

        return TraceChainResponse(
            material_id=material_id,
            links=links,
            export_records=export_records_data,
        )

    def trace_by_trace_id(self, trace_id: str) -> List[Dict[str, Any]]:
        results = []

        audio_track = (
            self.db.query(AudioTrack)
            .filter(AudioTrack.trace_id == trace_id)
            .first()
        )
        if audio_track:
            results.append(
                {
                    "type": "audio_track",
                    "id": audio_track.id,
                    "no": audio_track.track_no,
                    "name": audio_track.title,
                    "trace_id": audio_track.trace_id,
                    "created_at": audio_track.created_at,
                }
            )

        ad_script = (
            self.db.query(AdScript)
            .filter(AdScript.trace_id == trace_id)
            .first()
        )
        if ad_script:
            results.append(
                {
                    "type": "ad_script",
                    "id": ad_script.id,
                    "no": ad_script.script_no,
                    "name": f"口播-{ad_script.batch_no}",
                    "trace_id": ad_script.trace_id,
                    "created_at": ad_script.created_at,
                }
            )

        sound_material = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.trace_id == trace_id)
            .first()
        )
        if sound_material:
            results.append(
                {
                    "type": "sound_material",
                    "id": sound_material.id,
                    "no": sound_material.material_no,
                    "name": sound_material.name,
                    "trace_id": sound_material.trace_id,
                    "created_at": sound_material.created_at,
                }
            )

        match_relation = (
            self.db.query(MatchRelation)
            .filter(MatchRelation.trace_id == trace_id)
            .first()
        )
        if match_relation:
            results.append(
                {
                    "type": "match_relation",
                    "id": match_relation.id,
                    "no": f"MATCH-{match_relation.id}",
                    "name": f"{match_relation.match_type}匹配",
                    "trace_id": match_relation.trace_id,
                    "created_at": match_relation.created_at,
                }
            )

        export_record = (
            self.db.query(ExportRecord)
            .filter(ExportRecord.trace_id == trace_id)
            .first()
        )
        if export_record:
            results.append(
                {
                    "type": "export_record",
                    "id": export_record.id,
                    "no": export_record.export_no,
                    "name": export_record.filename,
                    "trace_id": export_record.trace_id,
                    "created_at": export_record.created_at,
                }
            )

        return results
