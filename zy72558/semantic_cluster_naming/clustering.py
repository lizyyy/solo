from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, calinski_harabasz_score

from .models import (
    FeatureSnapshot, ClusteringRun, ClusteringResult,
    TrainingStatus, ReviewStatus, SnapshotStatus
)
from .utils import (
    generate_id, compute_content_hash, parse_vector,
    format_cluster_name, TrainingLogBuffer
)
from .audit import AuditTrail


class ClusteringEngine:
    def __init__(self, db: Session, actor: str = "system"):
        self.db = db
        self.audit = AuditTrail(db, actor=actor)
        self.log_buffer = TrainingLogBuffer()
    
    def run_clustering(
        self,
        snapshot_id: str,
        n_clusters: int = 5,
        algorithm: str = "kmeans",
        supplement_version: Optional[int] = None,
        force: bool = False,
    ) -> Tuple[ClusteringRun, Dict[str, Any]]:
        self.log_buffer.clear()
        self.log_buffer.log(f"开始聚类训练，快照ID: {snapshot_id}")
        
        if supplement_version is None:
            supplement_version = self._get_latest_version(snapshot_id)
        
        snapshots = self.db.query(FeatureSnapshot).filter(
            and_(
                FeatureSnapshot.snapshot_id == snapshot_id,
                FeatureSnapshot.supplement_version == supplement_version,
            )
        ).order_by(FeatureSnapshot.original_row_number).all()
        
        if not snapshots:
            raise ValueError(f"未找到快照数据: {snapshot_id} v{supplement_version}")
        
        self.log_buffer.log(f"加载数据: {len(snapshots)} 条记录")
        
        vectors = []
        valid_snapshots = []
        for snap in snapshots:
            vec = parse_vector(snap.vector_data)
            if vec is not None:
                vectors.append(vec)
                valid_snapshots.append(snap)
            else:
                raw = snap.raw_data
                if isinstance(raw, dict):
                    for v in raw.values():
                        vec = parse_vector(v)
                        if vec is not None:
                            vectors.append(vec)
                            valid_snapshots.append(snap)
                            break
        
        if not vectors:
            raise ValueError("未找到有效的向量数据")
        
        self.log_buffer.log(f"有效向量数: {len(vectors)}")
        
        X = np.array(vectors)
        data_hash = compute_content_hash(X)
        
        duplicate_run = self._find_duplicate_run(snapshot_id, data_hash, algorithm, n_clusters)
        is_duplicate = duplicate_run is not None
        
        run_id = generate_id("run_")
        self.log_buffer.log(f"创建训练任务: {run_id}")
        
        if is_duplicate and not force:
            self.log_buffer.log(f"检测到重复训练！数据与运行 {duplicate_run.run_id} 完全一致")
            self.log_buffer.log("设置为待策略产品复核状态，不自动覆盖")
        
        first_snap = valid_snapshots[0]
        run = ClusteringRun(
            run_id=run_id,
            snapshot_id=snapshot_id,
            snapshot_db_id=first_snap.id,
            algorithm=algorithm,
            params={"n_clusters": n_clusters, "supplement_version": supplement_version},
            status=TrainingStatus.PENDING.value,
            review_status=ReviewStatus.PENDING_REVIEW.value if is_duplicate else ReviewStatus.NORMAL.value,
            is_duplicate_run=is_duplicate,
            duplicate_of_run_id=duplicate_run.run_id if duplicate_run else None,
            data_hash=data_hash,
            created_by=self.audit.actor,
            remarks="重复训练待复核" if is_duplicate else None,
        )
        self.db.add(run)
        self.db.flush()
        
        self.audit.log_training_start(
            run_id=run_id,
            run_db_id=run.id,
            snapshot_id=snapshot_id,
            algorithm=algorithm,
        )
        
        if is_duplicate and duplicate_run:
            self.audit.log_duplicate_training(
                run_id=run_id,
                run_db_id=run.id,
                duplicate_of_run=duplicate_run.run_id,
            )
        
        run.status = TrainingStatus.RUNNING.value
        run.started_at = datetime.utcnow()
        self.db.flush()
        
        try:
            if is_duplicate and duplicate_run and not force:
                self.log_buffer.log("复制原运行结果用于复核对比...")
                results = self._copy_results(duplicate_run, run, valid_snapshots)
                metrics = duplicate_run.metrics or {}
            else:
                self.log_buffer.log(f"执行 {algorithm} 聚类，n_clusters={n_clusters}")
                labels, metrics = self._do_clustering(X, n_clusters, algorithm)
                results = self._create_results(run, valid_snapshots, labels, X)
            
            run.status = TrainingStatus.DUPLICATE_TRAINING.value if (is_duplicate and not force) else TrainingStatus.SUCCESS.value
            run.completed_at = datetime.utcnow()
            run.training_log = self.log_buffer.get_log()
            run.metrics = metrics
            self.db.flush()
            
            self.audit.log_training_complete(
                run_id=run_id,
                run_db_id=run.id,
                metrics=metrics,
            )
            
            self.db.commit()
            
            stats = {
                "run_id": run_id,
                "snapshot_id": snapshot_id,
                "is_duplicate": is_duplicate,
                "duplicate_of_run_id": duplicate_run.run_id if duplicate_run else None,
                "review_status": run.review_status,
                "n_clusters": n_clusters,
                "row_count": len(results),
                "metrics": metrics,
                "requires_review": is_duplicate and not force,
            }
            
            return run, stats
            
        except Exception as e:
            run.status = TrainingStatus.FAILED.value
            run.completed_at = datetime.utcnow()
            run.training_log = self.log_buffer.get_log() + f"\n[ERROR] {str(e)}"
            self.db.commit()
            raise
    
    def _do_clustering(
        self, X: np.ndarray, n_clusters: int, algorithm: str
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        if algorithm == "kmeans":
            model = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = model.fit_predict(X)
            
            self.log_buffer.log(f"KMeans 训练完成，inertia={model.inertia_:.4f}")
            
            metrics = {
                "inertia": float(model.inertia_),
                "n_clusters": int(len(set(labels))),
                "cluster_sizes": {int(k): int(v) for k, v in pd.Series(labels).value_counts().items()},
            }
            
            if len(set(labels)) > 1 and len(labels) > len(set(labels)):
                try:
                    metrics["silhouette_score"] = float(silhouette_score(X, labels))
                    metrics["calinski_harabasz_score"] = float(calinski_harabasz_score(X, labels))
                    self.log_buffer.log(f"轮廓系数: {metrics['silhouette_score']:.4f}")
                except Exception as e:
                    self.log_buffer.log(f"计算评估指标失败: {e}")
            
            return labels, metrics
        else:
            raise ValueError(f"不支持的算法: {algorithm}")
    
    def _create_results(
        self,
        run: ClusteringRun,
        snapshots: List[FeatureSnapshot],
        labels: np.ndarray,
        X: np.ndarray,
    ) -> List[ClusteringResult]:
        cluster_samples = {}
        for i, label in enumerate(labels):
            label_int = int(label)
            if label_int not in cluster_samples:
                cluster_samples[label_int] = []
            if len(cluster_samples[label_int]) < 5:
                snap = snapshots[i]
                raw = snap.raw_data
                if isinstance(raw, dict):
                    text = next((str(v) for v in raw.values() if isinstance(v, str)), "")
                    cluster_samples[label_int].append(text)
        
        cluster_names = {}
        for cid, samples in cluster_samples.items():
            cluster_names[cid] = format_cluster_name(cid, samples)
        
        results = []
        cluster_positions = {}
        
        for i, (snap, label) in enumerate(zip(snapshots, labels)):
            label_int = int(label)
            
            if label_int not in cluster_positions:
                cluster_positions[label_int] = 0
            position = cluster_positions[label_int]
            cluster_positions[label_int] += 1
            
            result_data = {
                "run_id": run.run_id,
                "snapshot_id": snap.snapshot_id,
                "original_row_number": snap.original_row_number,
                "cluster_id": label_int,
                "cluster_name": cluster_names.get(label_int, f"簇_{label_int}"),
                "position_in_cluster": position,
                "raw_vector": X[i].tolist() if i < len(X) else None,
            }
            result_hash = compute_content_hash(result_data)
            
            result = ClusteringResult(
                **result_data,
                result_hash=result_hash,
            )
            self.db.add(result)
            results.append(result)
        
        self.db.flush()
        self.log_buffer.log(f"创建 {len(results)} 条聚类结果")
        return results
    
    def _copy_results(
        self,
        source_run: ClusteringRun,
        target_run: ClusteringRun,
        snapshots: List[FeatureSnapshot],
    ) -> List[ClusteringResult]:
        source_results = self.db.query(ClusteringResult).filter(
            ClusteringResult.run_id == source_run.run_id
        ).all()
        
        results = []
        snap_map = {(s.snapshot_id, s.original_row_number): s for s in snapshots}
        
        for src in source_results:
            key = (src.snapshot_id, src.original_row_number)
            snap = snap_map.get(key)
            if snap is None:
                continue
            
            result_data = {
                "run_id": target_run.run_id,
                "snapshot_id": src.snapshot_id,
                "original_row_number": src.original_row_number,
                "cluster_id": src.cluster_id,
                "cluster_name": src.cluster_name,
                "position_in_cluster": src.position_in_cluster,
                "raw_vector": src.raw_vector,
            }
            result_hash = compute_content_hash(result_data)
            
            result = ClusteringResult(
                **result_data,
                result_hash=result_hash,
            )
            self.db.add(result)
            results.append(result)
        
        self.db.flush()
        return results
    
    def _find_duplicate_run(
        self,
        snapshot_id: str,
        data_hash: str,
        algorithm: str,
        n_clusters: int,
    ) -> Optional[ClusteringRun]:
        run = self.db.query(ClusteringRun).filter(
            and_(
                ClusteringRun.snapshot_id == snapshot_id,
                ClusteringRun.data_hash == data_hash,
                ClusteringRun.algorithm == algorithm,
                ClusteringRun.status.in_([
                    TrainingStatus.SUCCESS.value,
                    TrainingStatus.DUPLICATE_TRAINING.value,
                ]),
            )
        ).order_by(ClusteringRun.created_by.desc()).first()
        
        if run and run.params.get("n_clusters") == n_clusters:
            return run
        return None
    
    def _get_latest_version(self, snapshot_id: str) -> int:
        result = self.db.query(FeatureSnapshot.supplement_version).filter(
            FeatureSnapshot.snapshot_id == snapshot_id
        ).order_by(FeatureSnapshot.supplement_version.desc()).first()
        return result[0] if result else 1
    
    def get_run_summary(self, run_id: str) -> Dict[str, Any]:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        if not run:
            return {"exists": False}
        
        results = self.db.query(ClusteringResult).filter(ClusteringResult.run_id == run_id).all()
        clusters = {}
        for r in results:
            cid = r.cluster_id
            if cid not in clusters:
                clusters[cid] = {"name": r.cluster_name, "count": 0, "edited": r.cluster_name_edited}
            clusters[cid]["count"] += 1
        
        return {
            "exists": True,
            "run_id": run.run_id,
            "snapshot_id": run.snapshot_id,
            "status": run.status,
            "review_status": run.review_status,
            "is_duplicate_run": run.is_duplicate_run,
            "duplicate_of_run_id": run.duplicate_of_run_id,
            "algorithm": run.algorithm,
            "params": run.params,
            "metrics": run.metrics,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "result_count": len(results),
            "clusters": clusters,
            "requires_review": run.review_status == ReviewStatus.PENDING_REVIEW.value,
        }
    
    def list_runs(self, snapshot_id: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        query = self.db.query(ClusteringRun)
        if snapshot_id:
            query = query.filter(ClusteringRun.snapshot_id == snapshot_id)
        runs = query.order_by(ClusteringRun.started_at.desc()).limit(limit).all()
        return [self.get_run_summary(r.run_id) for r in runs]
    
    def get_training_log(self, run_id: str) -> Optional[str]:
        run = self.db.query(ClusteringRun).filter(ClusteringRun.run_id == run_id).first()
        return run.training_log if run else None
