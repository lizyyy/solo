import os
from typing import List, Dict, Any, Optional, Tuple
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from .models import (
    FeatureSnapshot, SnapshotStatus, ClusteringRun
)
from .utils import (
    generate_id, compute_content_hash, compute_dataframe_hash
)
from .audit import AuditTrail


class SnapshotImporter:
    def __init__(self, db: Session, actor: str = "system"):
        self.db = db
        self.audit = AuditTrail(db, actor=actor)
    
    def import_from_dataframe(
        self,
        df: pd.DataFrame,
        snapshot_id: Optional[str] = None,
        source_file: Optional[str] = None,
        supplement_version: int = 1,
        vector_column: Optional[str] = None,
        text_column: Optional[str] = None,
    ) -> Tuple[List[FeatureSnapshot], Dict[str, Any]]:
        if snapshot_id is None:
            snapshot_id = generate_id("snap_")
        
        df_hash = compute_dataframe_hash(df)
        
        row_hashes = []
        temp_rows = []
        for idx, row in df.iterrows():
            raw_data = row.to_dict()
            row_hash = compute_content_hash(raw_data)
            row_hashes.append(row_hash)
            temp_rows.append((idx + 1, raw_data, row_hash))
        
        combined_hash = compute_content_hash(sorted(row_hashes))
        duplicate_snapshot = self._find_duplicate_snapshot(snapshot_id, combined_hash, supplement_version)
        
        existing_rows = {}
        if not duplicate_snapshot:
            existing = self.db.query(FeatureSnapshot).filter(
                and_(
                    FeatureSnapshot.snapshot_id == snapshot_id,
                    FeatureSnapshot.supplement_version == supplement_version,
                )
            ).all()
            for s in existing:
                existing_rows[s.original_row_number] = s
        
        snapshots = []
        stats = {
            "snapshot_id": snapshot_id,
            "total_rows": len(df),
            "imported_rows": 0,
            "skipped_rows": 0,
            "duplicate_detected": False,
            "duplicate_of_snapshot_id": None,
            "source_file": source_file,
            "supplement_version": supplement_version,
        }
        
        if duplicate_snapshot:
            stats["duplicate_detected"] = True
            stats["duplicate_of_snapshot_id"] = duplicate_snapshot.snapshot_id
        
        first_snapshot_db_id = None
        
        for original_row_number, raw_data, content_hash in temp_rows:
            if original_row_number in existing_rows and not duplicate_snapshot:
                stats["skipped_rows"] += 1
                snapshots.append(existing_rows[original_row_number])
                continue
            
            vector_data = None
            if vector_column and vector_column in raw_data:
                vector_data = raw_data[vector_column]
                if isinstance(vector_data, str):
                    try:
                        import json
                        vector_data = json.loads(vector_data)
                    except (json.JSONDecodeError, ValueError):
                        pass
            
            snapshot = FeatureSnapshot(
                snapshot_id=snapshot_id,
                original_row_number=original_row_number,
                raw_data=raw_data,
                vector_data=vector_data,
                content_hash=content_hash,
                status=SnapshotStatus.DUPLICATE_DETECTED.value if duplicate_snapshot else SnapshotStatus.IMPORTED.value,
                imported_by=self.audit.actor,
                source_file=source_file,
                is_duplicate=duplicate_snapshot is not None,
                duplicate_of_snapshot_id=duplicate_snapshot.snapshot_id if duplicate_snapshot else None,
                supplement_version=supplement_version,
                remarks=f"数据文件hash: {combined_hash[:16]}..." if not duplicate_snapshot else f"重复导入，原快照: {duplicate_snapshot.snapshot_id}",
            )
            self.db.add(snapshot)
            self.db.flush()
            
            if first_snapshot_db_id is None:
                first_snapshot_db_id = snapshot.id
            
            snapshots.append(snapshot)
            stats["imported_rows"] += 1
        
        if first_snapshot_db_id:
            self.audit.log_snapshot_import(
                snapshot_id=snapshot_id,
                snapshot_db_id=first_snapshot_db_id,
                row_count=stats["imported_rows"],
                source_file=source_file or "dataframe",
            )
            
            if duplicate_snapshot:
                self.audit.log_duplicate_detected(
                    snapshot_id=snapshot_id,
                    snapshot_db_id=first_snapshot_db_id,
                    duplicate_of=duplicate_snapshot.snapshot_id,
                )
        
        self.db.commit()
        return snapshots, stats
    
    def import_from_csv(
        self,
        file_path: str,
        snapshot_id: Optional[str] = None,
        supplement_version: int = 1,
        vector_column: Optional[str] = None,
        text_column: Optional[str] = None,
        **csv_kwargs,
    ) -> Tuple[List[FeatureSnapshot], Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        df = pd.read_csv(file_path, **csv_kwargs)
        return self.import_from_dataframe(
            df=df,
            snapshot_id=snapshot_id,
            source_file=os.path.basename(file_path),
            supplement_version=supplement_version,
            vector_column=vector_column,
            text_column=text_column,
        )
    
    def import_supplement(
        self,
        original_snapshot_id: str,
        df: pd.DataFrame,
        source_file: Optional[str] = None,
        vector_column: Optional[str] = None,
    ) -> Tuple[List[FeatureSnapshot], Dict[str, Any]]:
        existing = self.db.query(FeatureSnapshot).filter(
            FeatureSnapshot.snapshot_id == original_snapshot_id
        ).first()
        
        if not existing:
            raise ValueError(f"快照不存在: {original_snapshot_id}")
        
        max_version = self.db.query(FeatureSnapshot.supplement_version).filter(
            FeatureSnapshot.snapshot_id == original_snapshot_id
        ).order_by(FeatureSnapshot.supplement_version.desc()).first()
        
        new_version = (max_version[0] + 1) if max_version else 2
        
        return self.import_from_dataframe(
            df=df,
            snapshot_id=original_snapshot_id,
            source_file=source_file,
            supplement_version=new_version,
            vector_column=vector_column,
        )
    
    def _find_duplicate_snapshot(
        self,
        snapshot_id: str,
        content_hash: str,
        supplement_version: int,
    ) -> Optional[FeatureSnapshot]:
        existing_same = self.db.query(FeatureSnapshot).filter(
            and_(
                FeatureSnapshot.snapshot_id == snapshot_id,
                FeatureSnapshot.supplement_version == supplement_version,
            )
        ).first()
        
        if existing_same:
            all_same_version = self.db.query(FeatureSnapshot).filter(
                and_(
                    FeatureSnapshot.snapshot_id == snapshot_id,
                    FeatureSnapshot.supplement_version == supplement_version,
                )
            ).all()
            if all_same_version:
                hashes = sorted([s.content_hash for s in all_same_version])
                if len(hashes) > 0:
                    combined_hash = compute_content_hash(hashes)
                    if combined_hash == content_hash:
                        return existing_same
        
        all_snapshots = self.db.query(FeatureSnapshot.snapshot_id).distinct().all()
        for (sid,) in all_snapshots:
            if sid == snapshot_id:
                continue
            rows = self.db.query(FeatureSnapshot).filter(
                and_(
                    FeatureSnapshot.snapshot_id == sid,
                    FeatureSnapshot.supplement_version == supplement_version,
                )
            ).all()
            if rows:
                hashes = sorted([s.content_hash for s in rows])
                combined = compute_content_hash(hashes)
                if combined == content_hash:
                    return rows[0]
        
        return None
    
    def get_snapshot_summary(self, snapshot_id: str) -> Dict[str, Any]:
        snapshots = self.db.query(FeatureSnapshot).filter(
            FeatureSnapshot.snapshot_id == snapshot_id
        ).all()
        
        if not snapshots:
            return {"exists": False}
        
        versions = {}
        for s in snapshots:
            v = s.supplement_version
            if v not in versions:
                versions[v] = {"count": 0, "statuses": set(), "has_duplicate": False}
            versions[v]["count"] += 1
            versions[v]["statuses"].add(s.status)
            if s.is_duplicate:
                versions[v]["has_duplicate"] = True
        
        return {
            "exists": True,
            "snapshot_id": snapshot_id,
            "total_rows": len(snapshots),
            "versions": {
                v: {
                    "row_count": info["count"],
                    "statuses": list(info["statuses"]),
                    "has_duplicate": info["has_duplicate"],
                }
                for v, info in versions.items()
            },
            "source_files": list({s.source_file for s in snapshots if s.source_file}),
            "imported_at": min(s.imported_at for s in snapshots),
        }
    
    def list_snapshots(self, limit: int = 100) -> List[Dict[str, Any]]:
        snapshot_ids = self.db.query(FeatureSnapshot.snapshot_id).distinct().limit(limit).all()
        return [self.get_snapshot_summary(sid[0]) for sid in snapshot_ids]
