import os
import pandas as pd
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path

from ..models.models import ImportBatch
from ..schemas.materials import (
    AudioTrackCreate,
    AdScriptCreate,
    SoundMaterialCreate,
    ImportResult,
)
from ..schemas.common import ImportBatchResponse
from ..core.config import settings
from ..utils.common import (
    generate_batch_no,
    calculate_file_hash,
    safe_float,
    safe_int,
    safe_str,
    parse_timestamp,
    parse_tags,
)
from .material_service import MaterialService
from .history_service import HistoryService


class ImportService:
    def __init__(self, db: Session):
        self.db = db
        self.material_service = MaterialService(db)
        self.history_service = HistoryService(db)

    def _save_upload_file(self, file_content: bytes, filename: str) -> Tuple[str, str]:
        file_hash = calculate_file_hash(file_content)
        ext = Path(filename).suffix or ".xlsx"
        saved_filename = f"{file_hash}{ext}"
        saved_path = settings.UPLOAD_DIR / saved_filename

        if not saved_path.exists():
            with open(saved_path, "wb") as f:
                f.write(file_content)

        return str(saved_path), file_hash

    def _read_excel_file(self, file_path: str) -> pd.DataFrame:
        try:
            df = pd.read_excel(file_path, engine="openpyxl")
        except Exception:
            df = pd.read_csv(file_path)
        df.columns = [str(col).strip().lower().replace(" ", "_") for col in df.columns]
        return df

    def import_audio_tracks(
        self,
        file_content: bytes,
        filename: str,
        imported_by: str = "system",
    ) -> ImportResult:
        batch_no = generate_batch_no("TRACK")
        file_path, _ = self._save_upload_file(file_content, filename)

        batch = ImportBatch(
            batch_no=batch_no,
            import_type="audio_track",
            filename=filename,
            status="processing",
            imported_by=imported_by,
        )
        self.db.add(batch)
        self.db.flush()

        error_log: List[str] = []
        success_count = 0
        failed_count = 0
        skipped_count = 0

        try:
            df = self._read_excel_file(file_path)
            batch.total_count = len(df)

            for idx, row in df.iterrows():
                try:
                    track_no = safe_str(row.get("track_no") or row.get("音轨编号") or row.get("编号"))
                    title = safe_str(row.get("title") or row.get("标题") or row.get("名称"))
                    duration = safe_float(row.get("duration") or row.get("时长") or row.get("duration_seconds"))
                    file_path_track = safe_str(row.get("file_path") or row.get("文件路径") or row.get("路径"))
                    file_hash = safe_str(row.get("file_hash") or row.get("文件哈希") or row.get("hash"))
                    recorded_at_str = safe_str(row.get("recorded_at") or row.get("录制时间") or row.get("时间"))

                    if not track_no or not title or not file_hash:
                        skipped_count += 1
                        error_log.append(f"第{idx+2}行: 缺少必要字段（track_no/title/file_hash）")
                        continue

                    recorded_at = parse_timestamp(recorded_at_str)

                    existing = (
                        self.db.query(ImportBatch)
                        .filter(ImportBatch.batch_no == batch_no)
                        .first()
                    )

                    track_data = AudioTrackCreate(
                        track_no=track_no,
                        title=title,
                        duration=duration,
                        file_path=file_path_track,
                        file_hash=file_hash,
                        recorded_at=recorded_at,
                    )

                    result = self.material_service.create_audio_track(track_data, imported_by)
                    if result:
                        success_count += 1
                    else:
                        skipped_count += 1

                except Exception as e:
                    failed_count += 1
                    error_log.append(f"第{idx+2}行: {str(e)}")

            batch.success_count = success_count
            batch.failed_count = failed_count
            batch.skipped_count = skipped_count
            batch.status = "completed"
            batch.error_log = "\n".join(error_log) if error_log else None
            batch.finished_at = datetime.utcnow()
            self.db.flush()

            return ImportResult(
                batch_no=batch_no,
                total_count=batch.total_count,
                success_count=success_count,
                failed_count=failed_count,
                skipped_count=skipped_count,
                error_log=error_log,
            )

        except Exception as e:
            batch.status = "failed"
            batch.error_log = str(e)
            batch.finished_at = datetime.utcnow()
            self.db.flush()
            raise

    def import_ad_scripts(
        self,
        file_content: bytes,
        filename: str,
        imported_by: str = "system",
    ) -> ImportResult:
        batch_no = generate_batch_no("SCRIPT")
        file_path, _ = self._save_upload_file(file_content, filename)

        batch = ImportBatch(
            batch_no=batch_no,
            import_type="ad_script",
            filename=filename,
            status="processing",
            imported_by=imported_by,
        )
        self.db.add(batch)
        self.db.flush()

        error_log: List[str] = []
        success_count = 0
        failed_count = 0
        skipped_count = 0

        try:
            df = self._read_excel_file(file_path)
            batch.total_count = len(df)

            for idx, row in df.iterrows():
                try:
                    script_no = safe_str(row.get("script_no") or row.get("口播编号") or row.get("编号"))
                    track_id = safe_int(row.get("track_id") or row.get("音轨ID"))
                    track_no = safe_str(row.get("track_no") or row.get("音轨编号"))
                    content = safe_str(row.get("content") or row.get("内容") or row.get("口播内容"))
                    start_time = safe_float(row.get("start_time") or row.get("开始时间") or row.get("start"))
                    end_time = safe_float(row.get("end_time") or row.get("结束时间") or row.get("end"))
                    batch_no_script = safe_str(row.get("batch_no") or row.get("批次号") or row.get("批次"))
                    version = safe_int(row.get("version") or row.get("版本"), 1)

                    if not script_no or not content or not track_no:
                        skipped_count += 1
                        error_log.append(f"第{idx+2}行: 缺少必要字段（script_no/content/track_no）")
                        continue

                    if not track_id:
                        from ..models.models import AudioTrack
                        track = (
                            self.db.query(AudioTrack)
                            .filter(AudioTrack.track_no == track_no)
                            .first()
                        )
                        if track:
                            track_id = track.id
                        else:
                            skipped_count += 1
                            error_log.append(f"第{idx+2}行: 未找到对应的音轨 track_no={track_no}")
                            continue

                    script_data = AdScriptCreate(
                        script_no=script_no,
                        track_id=track_id,
                        track_no=track_no,
                        content=content,
                        start_time=start_time,
                        end_time=end_time,
                        batch_no=batch_no_script,
                        version=version,
                    )

                    result = self.material_service.create_ad_script(script_data, imported_by)
                    if result:
                        success_count += 1
                    else:
                        skipped_count += 1

                except Exception as e:
                    failed_count += 1
                    error_log.append(f"第{idx+2}行: {str(e)}")

            batch.success_count = success_count
            batch.failed_count = failed_count
            batch.skipped_count = skipped_count
            batch.status = "completed"
            batch.error_log = "\n".join(error_log) if error_log else None
            batch.finished_at = datetime.utcnow()
            self.db.flush()

            return ImportResult(
                batch_no=batch_no,
                total_count=batch.total_count,
                success_count=success_count,
                failed_count=failed_count,
                skipped_count=skipped_count,
                error_log=error_log,
            )

        except Exception as e:
            batch.status = "failed"
            batch.error_log = str(e)
            batch.finished_at = datetime.utcnow()
            self.db.flush()
            raise

    def import_sound_materials(
        self,
        file_content: bytes,
        filename: str,
        imported_by: str = "system",
    ) -> ImportResult:
        batch_no = generate_batch_no("MATERIAL")
        file_path, _ = self._save_upload_file(file_content, filename)

        batch = ImportBatch(
            batch_no=batch_no,
            import_type="sound_material",
            filename=filename,
            status="processing",
            imported_by=imported_by,
        )
        self.db.add(batch)
        self.db.flush()

        error_log: List[str] = []
        success_count = 0
        failed_count = 0
        skipped_count = 0

        try:
            df = self._read_excel_file(file_path)
            batch.total_count = len(df)

            for idx, row in df.iterrows():
                try:
                    material_no = safe_str(row.get("material_no") or row.get("素材编号") or row.get("编号"))
                    name = safe_str(row.get("name") or row.get("名称") or row.get("素材名称"))
                    material_type = safe_str(row.get("type") or row.get("类型") or row.get("素材类型"))
                    duration = safe_float(row.get("duration") or row.get("时长") or row.get("duration_seconds"))
                    file_path_mat = safe_str(row.get("file_path") or row.get("文件路径") or row.get("路径"))
                    file_hash = safe_str(row.get("file_hash") or row.get("文件哈希") or row.get("hash"))
                    tags_str = safe_str(row.get("tags") or row.get("标签"))
                    description = safe_str(row.get("description") or row.get("描述") or row.get("备注"))
                    status = safe_str(row.get("status") or row.get("状态"), "pending")

                    if not material_no or not name or not material_type or not file_hash:
                        skipped_count += 1
                        error_log.append(f"第{idx+2}行: 缺少必要字段（material_no/name/type/file_hash）")
                        continue

                    tags = parse_tags(tags_str)
                    confidence = safe_float(row.get("confidence") or row.get("置信度"))

                    material_data = SoundMaterialCreate(
                        material_no=material_no,
                        name=name,
                        type=material_type,
                        duration=duration,
                        file_path=file_path_mat,
                        file_hash=file_hash,
                        tags=tags,
                        description=description,
                        status=status,
                        confidence=confidence if confidence > 0 else None,
                    )

                    result = self.material_service.create_sound_material(material_data, imported_by)
                    if result:
                        success_count += 1
                    else:
                        skipped_count += 1

                except Exception as e:
                    failed_count += 1
                    error_log.append(f"第{idx+2}行: {str(e)}")

            batch.success_count = success_count
            batch.failed_count = failed_count
            batch.skipped_count = skipped_count
            batch.status = "completed"
            batch.error_log = "\n".join(error_log) if error_log else None
            batch.finished_at = datetime.utcnow()
            self.db.flush()

            return ImportResult(
                batch_no=batch_no,
                total_count=batch.total_count,
                success_count=success_count,
                failed_count=failed_count,
                skipped_count=skipped_count,
                error_log=error_log,
            )

        except Exception as e:
            batch.status = "failed"
            batch.error_log = str(e)
            batch.finished_at = datetime.utcnow()
            self.db.flush()
            raise

    def get_import_batch_list(
        self,
        import_type: Optional[str] = None,
        status: Optional[str] = None,
        pagination: Optional[Any] = None,
    ) -> Tuple[List[ImportBatchResponse], int]:
        query = self.db.query(ImportBatch)

        if import_type:
            query = query.filter(ImportBatch.import_type == import_type)
        if status:
            query = query.filter(ImportBatch.status == status)

        total = query.count()

        if pagination:
            sort_by = pagination.sort_by or "created_at"
            sort_order = pagination.sort_order or "desc"
            if hasattr(ImportBatch, sort_by):
                if sort_order == "desc":
                    query = query.order_by(getattr(ImportBatch, sort_by).desc())
                else:
                    query = query.order_by(getattr(ImportBatch, sort_by).asc())

            query = query.offset((pagination.page - 1) * pagination.page_size).limit(pagination.page_size)

        items = query.all()
        response_items = []
        for item in items:
            response_items.append(
                ImportBatchResponse(
                    id=item.id,
                    batch_no=item.batch_no,
                    import_type=item.import_type,
                    filename=item.filename,
                    total_count=item.total_count,
                    success_count=item.success_count,
                    failed_count=item.failed_count,
                    skipped_count=item.skipped_count,
                    error_log=item.error_log,
                    status=item.status,
                    imported_by=item.imported_by,
                    created_at=item.created_at,
                    finished_at=item.finished_at,
                )
            )

        return response_items, total

    def get_import_batch(self, batch_id: int) -> Optional[ImportBatchResponse]:
        item = self.db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not item:
            return None

        return ImportBatchResponse(
            id=item.id,
            batch_no=item.batch_no,
            import_type=item.import_type,
            filename=item.filename,
            total_count=item.total_count,
            success_count=item.success_count,
            failed_count=item.failed_count,
            skipped_count=item.skipped_count,
            error_log=item.error_log,
            status=item.status,
            imported_by=item.imported_by,
            created_at=item.created_at,
            finished_at=item.finished_at,
        )
