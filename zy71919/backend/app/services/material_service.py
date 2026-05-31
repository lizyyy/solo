import json
from typing import Optional, List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime

from ..models.models import SoundMaterial, AudioTrack, AdScript, MatchRelation
from ..schemas.materials import (
    SoundMaterialCreate,
    SoundMaterialUpdate,
    SoundMaterialResponse,
    AudioTrackCreate,
    AudioTrackUpdate,
    AudioTrackResponse,
    AdScriptCreate,
    AdScriptUpdate,
    AdScriptResponse,
    MatchRelationCreate,
    MatchRelationUpdate,
    MatchRelationResponse,
    AutoMatchRequest,
    AutoMatchResponse,
    BatchOperationRequest,
    BatchOperationResponse,
)
from ..schemas.common import MaterialFilterParams, PaginationParams
from ..utils.common import (
    generate_trace_id,
    generate_material_no,
    generate_track_no,
    generate_script_no,
    parse_tags,
    format_tags,
)
from .history_service import HistoryService


class MaterialService:
    def __init__(self, db: Session):
        self.db = db
        self.history_service = HistoryService(db)

    def _material_to_response(self, material: SoundMaterial) -> SoundMaterialResponse:
        return SoundMaterialResponse(
            id=material.id,
            material_no=material.material_no,
            name=material.name,
            type=material.type,
            duration=material.duration,
            file_path=material.file_path,
            file_hash=material.file_hash,
            tags=parse_tags(material.tags),
            description=material.description,
            status=material.status,
            confidence=material.confidence,
            trace_id=material.trace_id,
            created_at=material.created_at,
            updated_at=material.updated_at,
        )

    def _track_to_response(self, track: AudioTrack) -> AudioTrackResponse:
        return AudioTrackResponse(
            id=track.id,
            track_no=track.track_no,
            title=track.title,
            duration=track.duration,
            file_path=track.file_path,
            file_hash=track.file_hash,
            recorded_at=track.recorded_at,
            trace_id=track.trace_id,
            created_at=track.created_at,
            updated_at=track.updated_at,
        )

    def _script_to_response(self, script: AdScript) -> AdScriptResponse:
        return AdScriptResponse(
            id=script.id,
            script_no=script.script_no,
            track_id=script.track_id,
            track_no=script.track_no,
            content=script.content,
            start_time=script.start_time,
            end_time=script.end_time,
            batch_no=script.batch_no,
            version=script.version,
            trace_id=script.trace_id,
            created_at=script.created_at,
            updated_at=script.updated_at,
        )

    def _match_to_response(self, match: MatchRelation) -> MatchRelationResponse:
        return MatchRelationResponse(
            id=match.id,
            material_id=match.material_id,
            ad_script_id=match.ad_script_id,
            audio_track_id=match.audio_track_id,
            match_type=match.match_type,
            confidence=match.confidence,
            status=match.status,
            remark=match.remark,
            created_by=match.created_by,
            trace_id=match.trace_id,
            created_at=match.created_at,
            updated_at=match.updated_at,
            sound_material=self._material_to_response(match.sound_material) if match.sound_material else None,
            ad_script=self._script_to_response(match.ad_script) if match.ad_script else None,
            audio_track=self._track_to_response(match.audio_track) if match.audio_track else None,
        )

    def create_audio_track(self, data: AudioTrackCreate, operator: str = "system") -> AudioTrackResponse:
        existing = self.db.query(AudioTrack).filter(AudioTrack.file_hash == data.file_hash).first()
        if existing:
            return self._track_to_response(existing)

        track = AudioTrack(
            track_no=data.track_no or generate_track_no(),
            title=data.title,
            duration=data.duration,
            file_path=data.file_path,
            file_hash=data.file_hash,
            recorded_at=data.recorded_at,
            trace_id=generate_trace_id(),
        )
        self.db.add(track)
        self.db.flush()

        self.history_service.create_operation_history(
            operation_type="import",
            target_type="audio_track",
            target_id=track.id,
            operator=operator,
            after_data={
                "track_no": track.track_no,
                "title": track.title,
                "duration": track.duration,
            },
            trace_id=track.trace_id,
        )

        return self._track_to_response(track)

    def get_audio_track_list(
        self,
        track_no: Optional[str] = None,
        search_keyword: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[AudioTrackResponse], int]:
        query = self.db.query(AudioTrack)

        if track_no:
            query = query.filter(AudioTrack.track_no == track_no)
        if search_keyword:
            query = query.filter(
                or_(
                    AudioTrack.title.contains(search_keyword),
                    AudioTrack.track_no.contains(search_keyword),
                )
            )

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(AudioTrack, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(AudioTrack, sort_by).desc())
                else:
                    query = query.order_by(getattr(AudioTrack, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()
        return [self._track_to_response(item) for item in items], total

    def get_audio_track(self, track_id: int) -> Optional[AudioTrackResponse]:
        track = self.db.query(AudioTrack).filter(AudioTrack.id == track_id).first()
        return self._track_to_response(track) if track else None

    def update_audio_track(
        self, track_id: int, data: AudioTrackUpdate, operator: str = "system"
    ) -> Optional[AudioTrackResponse]:
        track = self.db.query(AudioTrack).filter(AudioTrack.id == track_id).first()
        if not track:
            return None

        before_data = {
            "title": track.title,
            "duration": track.duration,
            "file_path": track.file_path,
            "recorded_at": track.recorded_at.isoformat() if track.recorded_at else None,
        }

        if data.title is not None:
            track.title = data.title
        if data.duration is not None:
            track.duration = data.duration
        if data.file_path is not None:
            track.file_path = data.file_path
        if data.recorded_at is not None:
            track.recorded_at = data.recorded_at

        self.db.flush()

        after_data = {
            "title": track.title,
            "duration": track.duration,
            "file_path": track.file_path,
            "recorded_at": track.recorded_at.isoformat() if track.recorded_at else None,
        }

        self.history_service.create_operation_history(
            operation_type="update",
            target_type="audio_track",
            target_id=track.id,
            operator=operator,
            before_data=before_data,
            after_data=after_data,
            trace_id=track.trace_id,
        )

        return self._track_to_response(track)

    def create_ad_script(self, data: AdScriptCreate, operator: str = "system") -> AdScriptResponse:
        existing = self.db.query(AdScript).filter(AdScript.script_no == data.script_no).first()
        if existing:
            existing.version += 1
            existing.content = data.content
            existing.start_time = data.start_time
            existing.end_time = data.end_time
            self.db.flush()
            return self._script_to_response(existing)

        script = AdScript(
            script_no=data.script_no or generate_script_no(),
            track_id=data.track_id,
            track_no=data.track_no,
            content=data.content,
            start_time=data.start_time,
            end_time=data.end_time,
            batch_no=data.batch_no,
            version=data.version,
            trace_id=generate_trace_id(),
        )
        self.db.add(script)
        self.db.flush()

        self.history_service.create_operation_history(
            operation_type="import",
            target_type="ad_script",
            target_id=script.id,
            operator=operator,
            after_data={
                "script_no": script.script_no,
                "batch_no": script.batch_no,
                "track_no": script.track_no,
            },
            trace_id=script.trace_id,
        )

        return self._script_to_response(script)

    def get_ad_script_list(
        self,
        batch_no: Optional[str] = None,
        track_no: Optional[str] = None,
        search_keyword: Optional[str] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[AdScriptResponse], int]:
        query = self.db.query(AdScript)

        if batch_no:
            query = query.filter(AdScript.batch_no == batch_no)
        if track_no:
            query = query.filter(AdScript.track_no == track_no)
        if search_keyword:
            query = query.filter(
                or_(
                    AdScript.content.contains(search_keyword),
                    AdScript.script_no.contains(search_keyword),
                    AdScript.batch_no.contains(search_keyword),
                )
            )

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(AdScript, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(AdScript, sort_by).desc())
                else:
                    query = query.order_by(getattr(AdScript, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()
        return [self._script_to_response(item) for item in items], total

    def get_ad_script(self, script_id: int) -> Optional[AdScriptResponse]:
        script = self.db.query(AdScript).filter(AdScript.id == script_id).first()
        return self._script_to_response(script) if script else None

    def create_sound_material(
        self, data: SoundMaterialCreate, operator: str = "system"
    ) -> SoundMaterialResponse:
        existing = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.file_hash == data.file_hash)
            .first()
        )
        if existing:
            return self._material_to_response(existing)

        material = SoundMaterial(
            material_no=data.material_no or generate_material_no(),
            name=data.name,
            type=data.type,
            duration=data.duration,
            file_path=data.file_path,
            file_hash=data.file_hash,
            tags=format_tags(data.tags) if data.tags else None,
            description=data.description,
            status=data.status,
            confidence=data.confidence,
            trace_id=generate_trace_id(),
        )
        self.db.add(material)
        self.db.flush()

        self.history_service.create_operation_history(
            operation_type="import",
            target_type="sound_material",
            target_id=material.id,
            operator=operator,
            after_data={
                "material_no": material.material_no,
                "name": material.name,
                "type": material.type,
                "status": material.status,
            },
            trace_id=material.trace_id,
        )

        return self._material_to_response(material)

    def get_sound_material_list(
        self,
        filters: Optional[MaterialFilterParams] = None,
    ) -> Tuple[List[SoundMaterialResponse], int]:
        query = self.db.query(SoundMaterial)

        if filters:
            if filters.track_no:
                subquery = (
                    self.db.query(MatchRelation.material_id)
                    .join(AdScript, MatchRelation.ad_script_id == AdScript.id)
                    .filter(AdScript.track_no == filters.track_no)
                )
                query = query.filter(SoundMaterial.id.in_(subquery))

            if filters.batch_no:
                subquery = (
                    self.db.query(MatchRelation.material_id)
                    .join(AdScript, MatchRelation.ad_script_id == AdScript.id)
                    .filter(AdScript.batch_no == filters.batch_no)
                )
                query = query.filter(SoundMaterial.id.in_(subquery))

            if filters.material_type:
                query = query.filter(SoundMaterial.type == filters.material_type)
            if filters.status:
                query = query.filter(SoundMaterial.status == filters.status)
            if filters.start_date:
                start_dt = datetime.fromisoformat(filters.start_date) if filters.start_date else None
                if start_dt:
                    query = query.filter(SoundMaterial.created_at >= start_dt)
            if filters.end_date:
                end_dt = datetime.fromisoformat(filters.end_date) if filters.end_date else None
                if end_dt:
                    query = query.filter(SoundMaterial.created_at <= end_dt)
            if filters.search_keyword:
                query = query.filter(
                    or_(
                        SoundMaterial.name.contains(filters.search_keyword),
                        SoundMaterial.material_no.contains(filters.search_keyword),
                        SoundMaterial.description.contains(filters.search_keyword),
                        SoundMaterial.tags.contains(filters.search_keyword),
                    )
                )

        total = query.count()

        if filters:
            sort_by = filters.sort_by or "created_at"
            sort_order = filters.sort_order or "desc"
            if hasattr(SoundMaterial, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(SoundMaterial, sort_by).desc())
                else:
                    query = query.order_by(getattr(SoundMaterial, sort_by).asc())

            query = query.offset((filters.page - 1) * filters.page_size).limit(filters.page_size)

        items = query.all()
        return [self._material_to_response(item) for item in items], total

    def get_sound_material(self, material_id: int) -> Optional[SoundMaterialResponse]:
        material = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.id == material_id)
            .first()
        )
        return self._material_to_response(material) if material else None

    def update_sound_material(
        self, material_id: int, data: SoundMaterialUpdate, operator: str = "system"
    ) -> Optional[SoundMaterialResponse]:
        material = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.id == material_id)
            .first()
        )
        if not material:
            return None

        before_data = {
            "name": material.name,
            "type": material.type,
            "duration": material.duration,
            "file_path": material.file_path,
            "tags": parse_tags(material.tags),
            "description": material.description,
            "status": material.status,
        }

        if data.name is not None:
            material.name = data.name
        if data.type is not None:
            material.type = data.type
        if data.duration is not None:
            material.duration = data.duration
        if data.file_path is not None:
            material.file_path = data.file_path
        if data.tags is not None:
            material.tags = format_tags(data.tags)
        if data.description is not None:
            material.description = data.description
        if data.status is not None:
            material.status = data.status

        self.db.flush()

        after_data = {
            "name": material.name,
            "type": material.type,
            "duration": material.duration,
            "file_path": material.file_path,
            "tags": parse_tags(material.tags),
            "description": material.description,
            "status": material.status,
        }

        self.history_service.create_operation_history(
            operation_type="update",
            target_type="sound_material",
            target_id=material.id,
            operator=operator,
            before_data=before_data,
            after_data=after_data,
            trace_id=material.trace_id,
        )

        return self._material_to_response(material)

    def get_match_list(
        self,
        status: Optional[str] = None,
        match_type: Optional[str] = None,
        material_id: Optional[int] = None,
        pagination: Optional[PaginationParams] = None,
    ) -> Tuple[List[MatchRelationResponse], int]:
        query = self.db.query(MatchRelation)

        if status:
            query = query.filter(MatchRelation.status == status)
        if match_type:
            query = query.filter(MatchRelation.match_type == match_type)
        if material_id:
            query = query.filter(MatchRelation.material_id == material_id)

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(MatchRelation, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(MatchRelation, sort_by).desc())
                else:
                    query = query.order_by(getattr(MatchRelation, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()
        return [self._match_to_response(item) for item in items], total

    def create_match_relation(
        self, data: MatchRelationCreate, operator: str = "system"
    ) -> MatchRelationResponse:
        existing = (
            self.db.query(MatchRelation)
            .filter(
                and_(
                    MatchRelation.material_id == data.material_id,
                    MatchRelation.ad_script_id == data.ad_script_id,
                )
            )
            .first()
        )

        if existing:
            return self._match_to_response(existing)

        match = MatchRelation(
            material_id=data.material_id,
            ad_script_id=data.ad_script_id,
            audio_track_id=data.audio_track_id,
            match_type=data.match_type,
            confidence=data.confidence,
            status=data.status,
            remark=data.remark,
            created_by=operator,
            trace_id=generate_trace_id(),
        )
        self.db.add(match)
        self.db.flush()

        material = (
            self.db.query(SoundMaterial)
            .filter(SoundMaterial.id == data.material_id)
            .first()
        )
        if material and data.status == "confirmed":
            material.status = "confirmed"
            self.db.flush()

        self.history_service.create_operation_history(
            operation_type="match",
            target_type="match_relation",
            target_id=match.id,
            operator=operator,
            after_data={
                "material_id": match.material_id,
                "ad_script_id": match.ad_script_id,
                "match_type": match.match_type,
                "status": match.status,
            },
            trace_id=match.trace_id,
        )

        return self._match_to_response(match)

    def update_match_relation(
        self, match_id: int, data: MatchRelationUpdate, operator: str = "system"
    ) -> Optional[MatchRelationResponse]:
        match = (
            self.db.query(MatchRelation)
            .filter(MatchRelation.id == match_id)
            .first()
        )
        if not match:
            return None

        before_data = {
            "ad_script_id": match.ad_script_id,
            "audio_track_id": match.audio_track_id,
            "match_type": match.match_type,
            "status": match.status,
            "remark": match.remark,
        }

        if data.ad_script_id is not None:
            match.ad_script_id = data.ad_script_id
        if data.audio_track_id is not None:
            match.audio_track_id = data.audio_track_id
        if data.match_type is not None:
            match.match_type = data.match_type
        if data.status is not None:
            match.status = data.status
        if data.remark is not None:
            match.remark = data.remark

        self.db.flush()

        if data.status == "confirmed":
            material = (
                self.db.query(SoundMaterial)
                .filter(SoundMaterial.id == match.material_id)
                .first()
            )
            if material:
                material.status = "confirmed"
                self.db.flush()
        elif data.status == "rejected":
            material = (
                self.db.query(SoundMaterial)
                .filter(SoundMaterial.id == match.material_id)
                .first()
            )
            if material:
                material.status = "matched"
                self.db.flush()

        after_data = {
            "ad_script_id": match.ad_script_id,
            "audio_track_id": match.audio_track_id,
            "match_type": match.match_type,
            "status": match.status,
            "remark": match.remark,
        }

        self.history_service.create_operation_history(
            operation_type="update",
            target_type="match_relation",
            target_id=match.id,
            operator=operator,
            before_data=before_data,
            after_data=after_data,
            trace_id=match.trace_id,
        )

        return self._match_to_response(match)

    def auto_match(self, request: AutoMatchRequest) -> AutoMatchResponse:
        materials = (
            self.db.query(SoundMaterial)
            .filter(or_(SoundMaterial.status == "pending", SoundMaterial.status == "matched"))
            .all()
        )

        ad_scripts = self.db.query(AdScript).all()

        total_processed = 0
        new_matches = 0
        updated_matches = 0
        skipped = 0

        for material in materials:
            total_processed += 1
            best_match = None
            best_confidence = 0

            for script in ad_scripts:
                confidence = self._calculate_match_confidence(material, script)
                if confidence >= request.match_threshold and confidence > best_confidence:
                    best_confidence = confidence
                    best_match = script

            if best_match:
                existing = (
                    self.db.query(MatchRelation)
                    .filter(
                        and_(
                            MatchRelation.material_id == material.id,
                            MatchRelation.ad_script_id == best_match.id,
                        )
                    )
                    .first()
                )

                if existing:
                    if existing.confidence != best_confidence:
                        existing.confidence = best_confidence
                        updated_matches += 1
                else:
                    new_match = MatchRelation(
                        material_id=material.id,
                        ad_script_id=best_match.id,
                        audio_track_id=best_match.track_id,
                        match_type="auto",
                        confidence=best_confidence,
                        status="pending",
                        created_by=request.created_by,
                        trace_id=generate_trace_id(),
                    )
                    self.db.add(new_match)
                    material.status = "matched"
                    material.confidence = best_confidence
                    new_matches += 1
            else:
                skipped += 1

        self.db.flush()

        return AutoMatchResponse(
            total_processed=total_processed,
            new_matches=new_matches,
            updated_matches=updated_matches,
            skipped=skipped,
        )

    def _calculate_match_confidence(self, material: SoundMaterial, script: AdScript) -> float:
        confidence = 0.0
        material_tags = parse_tags(material.tags)

        for tag in material_tags:
            if tag and tag.lower() in script.content.lower():
                confidence += 0.3

        if material.name:
            name_words = material.name.lower().split()
            for word in name_words:
                if word and word in script.content.lower():
                    confidence += 0.2

        if material.duration > 0 and script.end_time - script.start_time > 0:
            duration_ratio = min(
                material.duration / (script.end_time - script.start_time),
                (script.end_time - script.start_time) / material.duration,
            )
            confidence += duration_ratio * 0.3

        return min(confidence, 1.0)

    def batch_confirm_matches(
        self, request: BatchOperationRequest
    ) -> BatchOperationResponse:
        success = 0
        failed = 0
        failed_ids = []

        for match_id in request.ids:
            try:
                match = (
                    self.db.query(MatchRelation)
                    .filter(MatchRelation.id == match_id)
                    .first()
                )
                if match:
                    before_data = {"status": match.status}
                    match.status = "confirmed"
                    self.db.flush()

                    material = (
                        self.db.query(SoundMaterial)
                        .filter(SoundMaterial.id == match.material_id)
                        .first()
                    )
                    if material:
                        material.status = "confirmed"
                        self.db.flush()

                    after_data = {"status": "confirmed"}

                    self.history_service.create_operation_history(
                        operation_type="confirm",
                        target_type="match_relation",
                        target_id=match.id,
                        operator=request.operator,
                        before_data=before_data,
                        after_data=after_data,
                        remark=request.remark,
                        trace_id=match.trace_id,
                    )

                    success += 1
                else:
                    failed += 1
                    failed_ids.append(match_id)
            except Exception:
                self.db.rollback()
                failed += 1
                failed_ids.append(match_id)

        return BatchOperationResponse(
            total=len(request.ids),
            success=success,
            failed=failed,
            failed_ids=failed_ids,
        )

    def batch_reject_matches(
        self, request: BatchOperationRequest
    ) -> BatchOperationResponse:
        success = 0
        failed = 0
        failed_ids = []

        for match_id in request.ids:
            try:
                match = (
                    self.db.query(MatchRelation)
                    .filter(MatchRelation.id == match_id)
                    .first()
                )
                if match:
                    before_data = {"status": match.status}
                    match.status = "rejected"
                    self.db.flush()

                    after_data = {"status": "rejected"}

                    self.history_service.create_operation_history(
                        operation_type="reject",
                        target_type="match_relation",
                        target_id=match.id,
                        operator=request.operator,
                        before_data=before_data,
                        after_data=after_data,
                        remark=request.remark,
                        trace_id=match.trace_id,
                    )

                    success += 1
                else:
                    failed += 1
                    failed_ids.append(match_id)
            except Exception:
                self.db.rollback()
                failed += 1
                failed_ids.append(match_id)

        return BatchOperationResponse(
            total=len(request.ids),
            success=success,
            failed=failed,
            failed_ids=failed_ids,
        )
