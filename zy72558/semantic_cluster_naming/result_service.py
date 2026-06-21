from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import os
import json
import hashlib
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_

from .models import (
    ClusteringRun, ClusteringResult, FeatureSnapshot,
    FeatureVersion, ExportRecord, ReviewStatus, TrainingStatus
)
from .utils import generate_id, compute_content_hash
from .audit import AuditTrail


class ResultService:
    def __init__(self, db: Session, actor: str = "system"):
        self.db = db
        self.audit = AuditTrail(db, actor=actor)
    
    def get_results(self, run_id: str, include_vectors: bool = False) -> List[Dict[str, Any]]:
        results = self.db.query(ClusteringResult).filter(
            ClusteringResult.run_id == run_id
        ).order_by(
            ClusteringResult.original_row_number
        ).all()
        
        return [self._result_to_dict(r, include_vectors) for r in results]
    
    def get_results_for_display(self, run_id: str) -> Dict[str, Any]:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if not run:
            raise ValueError(f"运行不存在: {run_id}")
        
        results = self.get_results(run_id)
        
        clusters = {}
        for r in results:
            cid = r["cluster_id"]
            if cid not in clusters:
                clusters[cid] = {
                    "cluster_id": cid,
                    "cluster_name": r["cluster_name"],
                    "cluster_name_edited": r["cluster_name_edited"],
                    "count": 0,
                    "samples": [],
                }
            clusters[cid]["count"] += 1
            if len(clusters[cid]["samples"]) < 5:
                clusters[cid]["samples"].append({
                    "original_row_number": r["original_row_number"],
                    "snapshot_id": r["snapshot_id"],
                })
        
        cluster_info = {}
        for cid, info in clusters.items():
            cluster_info[str(cid)] = {
                "name": info["cluster_name"],
                "edited": info["cluster_name_edited"],
                "count": info["count"],
            }

        return {
            "_source": "result_service.single_source_for_all",
            "run_id": run_id,
            "snapshot_id": run.snapshot_id,
            "status": run.status,
            "review_status": run.review_status,
            "is_duplicate_run": run.is_duplicate_run,
            "metrics": run.metrics,
            "total_rows": len(results),
            "cluster_info": cluster_info,
            "clusters": list(clusters.values()),
            "results": results,
        }
    
    def get_results_for_api(self, run_id: str, page: int = 1, page_size: int = 100) -> Dict[str, Any]:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if not run:
            raise ValueError(f"运行不存在: {run_id}")
        
        query = self.db.query(ClusteringResult).filter(ClusteringResult.run_id == run_id)
        total = query.count()
        
        results = query.order_by(ClusteringResult.original_row_number).offset(
            (page - 1) * page_size
        ).limit(page_size).all()
        
        return {
            "run_id": run_id,
            "snapshot_id": run.snapshot_id,
            "status": run.status,
            "review_status": run.review_status,
            "is_duplicate_run": run.is_duplicate_run,
            "metrics": run.metrics,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
            },
            "results": [self._result_to_dict(r, False) for r in results],
        }
    
    def export_results(
        self,
        run_id: str,
        output_path: str,
        format: str = "csv",
        verify_consistency: bool = True,
    ) -> Dict[str, Any]:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if not run:
            raise ValueError(f"运行不存在: {run_id}")
        
        results = self.get_results(run_id, include_vectors=False)
        
        if not results:
            raise ValueError("没有可导出的结果")
        
        df = pd.DataFrame(results)
        
        if format == "csv":
            df.to_csv(output_path, index=False, encoding="utf-8-sig")
        elif format == "xlsx":
            df.to_excel(output_path, index=False)
        elif format == "json":
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
        else:
            raise ValueError(f"不支持的导出格式: {format}")
        
        with open(output_path, "rb") as f:
            content_hash = hashlib.sha256(f.read()).hexdigest()
        
        consistency_ok = True
        if verify_consistency:
            consistency_ok = self._verify_export_consistency(run_id, results, format)
        
        export_id = generate_id("exp_")
        record = ExportRecord(
            export_id=export_id,
            run_id=run_id,
            snapshot_id=run.snapshot_id,
            export_format=format,
            exported_by=self.audit.actor,
            row_count=len(results),
            content_hash=content_hash,
            file_path=output_path,
            consistency_verified=consistency_ok,
        )
        self.db.add(record)
        self.db.commit()
        
        self.audit.log_export(
            export_id=export_id,
            run_id=run_id,
            row_count=len(results),
            format=format,
        )
        
        return {
            "export_id": export_id,
            "run_id": run_id,
            "output_path": output_path,
            "format": format,
            "row_count": len(results),
            "consistency_verified": consistency_ok,
            "content_hash": content_hash,
        }
    
    def edit_cluster_name(
        self,
        run_id: str,
        cluster_id: int,
        new_name: str,
        edited_by: Optional[str] = None,
    ) -> bool:
        results = self.db.query(ClusteringResult).filter(
            and_(
                ClusteringResult.run_id == run_id,
                ClusteringResult.cluster_id == cluster_id,
            )
        ).all()
        
        if not results:
            return False
        
        old_name = results[0].cluster_name
        
        for r in results:
            r.cluster_name = new_name
            r.cluster_name_edited = True
            r.cluster_name_edited_by = edited_by or self.audit.actor
            r.cluster_name_edited_at = datetime.utcnow()
        
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if run:
            self.audit.log_cluster_name_edit(
                run_id=run_id,
                run_db_id=run.id,
                cluster_id=cluster_id,
                old_name=old_name or "",
                new_name=new_name,
                edited_by=edited_by or self.audit.actor,
            )
        
        self.db.commit()
        return True
    
    def manual_override_cluster(
        self,
        run_id: str,
        snapshot_id: str,
        original_row_number: int,
        new_cluster_id: int,
        reason: str,
        overridden_by: Optional[str] = None,
    ) -> bool:
        result = self.db.query(ClusteringResult).filter(
            and_(
                ClusteringResult.run_id == run_id,
                ClusteringResult.snapshot_id == snapshot_id,
                ClusteringResult.original_row_number == original_row_number,
            )
        ).first()
        
        if not result:
            return False
        
        old_cluster = result.cluster_id
        
        result.cluster_id = new_cluster_id
        result.is_manual_override = True
        result.override_reason = reason
        result.overridden_by = overridden_by or self.audit.actor
        result.overridden_at = datetime.utcnow()
        
        result_data = {
            "run_id": result.run_id,
            "snapshot_id": result.snapshot_id,
            "original_row_number": result.original_row_number,
            "cluster_id": new_cluster_id,
            "cluster_name": result.cluster_name,
        }
        result.result_hash = compute_content_hash(result_data)
        
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if run:
            self.audit.log_manual_override(
                run_id=run_id,
                run_db_id=run.id,
                snapshot_id=snapshot_id,
                row_number=original_row_number,
                old_cluster=old_cluster,
                new_cluster=new_cluster_id,
                reason=reason,
                overridden_by=overridden_by or self.audit.actor,
            )
        
        self.db.commit()
        return True
    
    def review_duplicate_run(
        self,
        run_id: str,
        decision: str,
        reviewed_by: str,
        comments: Optional[str] = None,
    ) -> bool:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if not run:
            return False
        
        if decision == "approve":
            run.review_status = ReviewStatus.APPROVED.value
            run.status = TrainingStatus.SUCCESS.value
        elif decision == "reject":
            run.review_status = ReviewStatus.REJECTED.value
        else:
            raise ValueError(f"无效的复核决定: {decision}，请使用 'approve' 或 'reject'")
        
        old_actor = self.audit.actor
        self.audit.actor = reviewed_by
        try:
            self.audit.log_review_decision(
                run_id=run_id,
                run_db_id=run.id,
                decision=decision,
                reviewed_by=reviewed_by,
                comments=comments,
            )
        finally:
            self.audit.actor = old_actor
        
        self.db.commit()
        return True
    
    def create_feature_version(
        self,
        snapshot_id: str,
        run_id: str,
        change_log: Optional[str] = None,
    ) -> Dict[str, Any]:
        run = self.db.query(ClusteringRun).filter(
            and_(
                ClusteringRun.run_id == run_id,
                ClusteringRun.snapshot_id == snapshot_id,
            )
        ).first()
        
        if not run:
            raise ValueError(f"运行不存在或不匹配: {run_id}")
        
        if run.review_status == ReviewStatus.PENDING_REVIEW.value:
            raise ValueError("该运行处于待复核状态，请先完成复核")
        
        max_version = self.db.query(FeatureVersion.version_number).filter(
            FeatureVersion.snapshot_id == snapshot_id
        ).order_by(FeatureVersion.version_number.desc()).first()
        
        new_version = (max_version[0] + 1) if max_version else 1
        
        self.db.query(FeatureVersion).filter(
            FeatureVersion.snapshot_id == snapshot_id
        ).update({FeatureVersion.is_active: False})
        
        version_id = generate_id("ver_")
        version = FeatureVersion(
            version_id=version_id,
            snapshot_id=snapshot_id,
            run_id=run_id,
            version_number=new_version,
            is_active=True,
            created_by=self.audit.actor,
            change_log=change_log,
            metrics_summary=run.metrics,
        )
        self.db.add(version)
        self.db.commit()
        
        self.audit.log_version_create(
            version_id=version_id,
            snapshot_id=snapshot_id,
            run_id=run_id,
            version_number=new_version,
        )
        
        return {
            "version_id": version_id,
            "snapshot_id": snapshot_id,
            "run_id": run_id,
            "version_number": new_version,
            "is_active": True,
        }
    
    def get_pending_reviews(self) -> List[Dict[str, Any]]:
        runs = self.db.query(ClusteringRun).filter(
            ClusteringRun.review_status == ReviewStatus.PENDING_REVIEW.value
        ).order_by(ClusteringRun.started_at.desc()).all()
        
        return [
            {
                "run_id": r.run_id,
                "snapshot_id": r.snapshot_id,
                "is_duplicate_run": r.is_duplicate_run,
                "duplicate_of_run_id": r.duplicate_of_run_id,
                "started_at": r.started_at,
                "created_by": r.created_by,
                "remarks": r.remarks,
            }
            for r in runs
        ]
    
    def get_audit_trail(
        self,
        run_id: Optional[str] = None,
        snapshot_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        from .models import AuditLog
        
        query = self.db.query(AuditLog)
        if run_id:
            query = query.filter(AuditLog.run_id == run_id)
        if snapshot_id:
            query = query.filter(AuditLog.snapshot_id == snapshot_id)
        
        logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
        
        return [
            {
                "timestamp": l.timestamp,
                "action": l.action,
                "actor": l.actor,
                "field_changed": l.field_changed,
                "old_value": l.old_value,
                "new_value": l.new_value,
                "details": l.details,
            }
            for l in logs
        ]
    
    def _result_to_dict(self, result: ClusteringResult, include_vectors: bool) -> Dict[str, Any]:
        d = {
            "snapshot_id": result.snapshot_id,
            "original_row_number": result.original_row_number,
            "cluster_id": result.cluster_id,
            "cluster_name": result.cluster_name,
            "cluster_name_edited": result.cluster_name_edited,
            "cluster_name_edited_by": result.cluster_name_edited_by,
            "cluster_name_edited_at": result.cluster_name_edited_at,
            "confidence": result.confidence,
            "position_in_cluster": result.position_in_cluster,
            "is_manual_override": result.is_manual_override,
            "override_reason": result.override_reason,
            "overridden_by": result.overridden_by,
            "overridden_at": result.overridden_at,
            "result_hash": result.result_hash,
        }
        if include_vectors:
            d["raw_vector"] = result.raw_vector
        return d
    
    def _verify_export_consistency(
        self, run_id: str, results: List[Dict[str, Any]], format: str
    ) -> bool:
        display_data = self.get_results(run_id)
        api_data = self.get_results_for_api(run_id, page_size=len(results))["results"]
        
        if len(results) != len(display_data) or len(results) != len(api_data):
            return False
        
        for i in range(len(results)):
            r1 = results[i]
            r2 = display_data[i]
            r3 = api_data[i]
            
            if (r1["snapshot_id"] != r2["snapshot_id"] or
                r1["original_row_number"] != r2["original_row_number"] or
                r1["cluster_id"] != r2["cluster_id"] or
                r1["cluster_name"] != r2["cluster_name"]):
                return False
            
            if (r1["snapshot_id"] != r3["snapshot_id"] or
                r1["original_row_number"] != r3["original_row_number"] or
                r1["cluster_id"] != r3["cluster_id"] or
                r1["cluster_name"] != r3["cluster_name"]):
                return False
        
        return True
