from datetime import datetime
from typing import List, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from app.models import (
    Pipeline, Shard, PipelineHistory, WriteSummary,
    PipelineStatus, ShardStatus,
    PipelineCreateRequest, ResumeRequest, ManualCorrectionRequest
)

class PipelineService:
    def __init__(self, db: Session):
        self.db = db
    
    def _record_history(self, pipeline_id: int, action: str, 
                        status_before: Optional[str] = None, 
                        status_after: Optional[str] = None,
                        raw_input: Dict = None,
                        conclusion: str = None,
                        shard_id: Optional[int] = None,
                        operator: str = "system"):
        history = PipelineHistory(
            pipeline_id=pipeline_id,
            shard_id=shard_id,
            action=action,
            status_before=status_before,
            status_after=status_after,
            raw_input=raw_input or {},
            conclusion=conclusion,
            operator=operator
        )
        self.db.add(history)
        self.db.commit()
    
    def _validate_watermark(self, pipeline: Pipeline, shard_index: int) -> Tuple[bool, str]:
        if shard_index > pipeline.current_watermark + 1:
            return False, f"分片 {shard_index} 超过当前水位点 {pipeline.current_watermark}，不允许跳跃执行"
        return True, ""
    
    def _check_shard_duplication(self, pipeline_id: int, shard_index: int) -> Tuple[bool, str]:
        shard = self.db.query(Shard).filter(
            and_(
                Shard.pipeline_id == pipeline_id,
                Shard.shard_index == shard_index,
                Shard.status == ShardStatus.SUCCESS
            )
        ).first()
        if shard:
            return True, f"分片 {shard_index} 已成功执行，不允许重复执行"
        return False, ""
    
    def _update_watermark(self, pipeline: Pipeline):
        shards = self.db.query(Shard).filter(
            Shard.pipeline_id == pipeline.id
        ).order_by(Shard.shard_index).all()
        
        new_watermark = 0
        for shard in shards:
            if shard.status == ShardStatus.SUCCESS:
                new_watermark = shard.shard_index
            else:
                break
        
        if new_watermark != pipeline.current_watermark:
            pipeline.current_watermark = new_watermark
            self.db.commit()
    
    def _check_pipeline_completion(self, pipeline: Pipeline):
        success_count = self.db.query(Shard).filter(
            and_(
                Shard.pipeline_id == pipeline.id,
                Shard.status == ShardStatus.SUCCESS
            )
        ).count()
        
        if success_count == pipeline.total_shards:
            pipeline.status = PipelineStatus.SUCCESS
            self.db.commit()
    
    def create_pipeline(self, request: PipelineCreateRequest) -> Pipeline:
        existing = self.db.query(Pipeline).filter(
            Pipeline.pipeline_name == request.pipeline_name
        ).first()
        if existing:
            raise ValueError(f"管道 {request.pipeline_name} 已存在")
        
        if len(request.shard_ranges) != request.total_shards:
            raise ValueError(f"分片范围数量 {len(request.shard_ranges)} 与总分片数 {request.total_shards} 不匹配")
        
        pipeline = Pipeline(
            pipeline_name=request.pipeline_name,
            total_shards=request.total_shards,
            config=request.config
        )
        self.db.add(pipeline)
        self.db.flush()
        
        for i, shard_range in enumerate(request.shard_ranges):
            shard = Shard(
                pipeline_id=pipeline.id,
                shard_index=i,
                shard_range_start=shard_range.get("start", ""),
                shard_range_end=shard_range.get("end", "")
            )
            self.db.add(shard)
        
        self.db.commit()
        self.db.refresh(pipeline)
        
        self._record_history(
            pipeline_id=pipeline.id,
            action="create",
            status_after=pipeline.status,
            raw_input=request.model_dump(),
            conclusion=f"创建管道成功，共 {request.total_shards} 个分片"
        )
        
        return pipeline
    
    def get_pipeline(self, pipeline_id: int) -> Optional[Pipeline]:
        return self.db.query(Pipeline).filter(Pipeline.id == pipeline_id).first()
    
    def get_all_pipelines(self) -> List[Pipeline]:
        return self.db.query(Pipeline).all()
    
    def get_shards(self, pipeline_id: int) -> List[Shard]:
        return self.db.query(Shard).filter(
            Shard.pipeline_id == pipeline_id
        ).order_by(Shard.shard_index).all()
    
    def resume_pipeline(self, request: ResumeRequest) -> Tuple[List[Shard], List[str]]:
        pipeline = self.get_pipeline(request.pipeline_id)
        if not pipeline:
            raise ValueError(f"管道 {request.pipeline_id} 不存在")
        
        if not request.force and pipeline.status == PipelineStatus.SUCCESS:
            raise ValueError(f"管道已成功完成，无需续跑")
        
        warnings = []
        
        if request.skip_shards:
            candidate_shards = self.db.query(Shard).filter(
                and_(
                    Shard.pipeline_id == pipeline.id,
                    Shard.shard_index.in_(request.skip_shards)
                )
            ).order_by(Shard.shard_index).all()
        else:
            candidate_shards = self.db.query(Shard).filter(
                and_(
                    Shard.pipeline_id == pipeline.id,
                    or_(
                        Shard.status == ShardStatus.PENDING,
                        Shard.status == ShardStatus.FAILED
                    )
                )
            ).order_by(Shard.shard_index).all()
        
        executable_shards = []
        for shard in candidate_shards:
            if not request.force:
                is_duplicate, msg = self._check_shard_duplication(pipeline.id, shard.shard_index)
                if is_duplicate:
                    warnings.append(msg)
                    continue
                
                is_valid, msg = self._validate_watermark(pipeline, shard.shard_index)
                if not is_valid:
                    warnings.append(msg)
                    continue
            
            executable_shards.append(shard)
        
        if executable_shards:
            pipeline.status = PipelineStatus.RUNNING
            self.db.commit()
            
            for shard in executable_shards:
                shard.status = ShardStatus.RUNNING
                shard.started_at = datetime.utcnow()
                shard.retry_count += 1
                self.db.commit()
        
        self._record_history(
            pipeline_id=pipeline.id,
            action="resume",
            status_before=PipelineStatus.FAILED if len(warnings) > 0 else pipeline.status,
            status_after=pipeline.status,
            raw_input=request.model_dump(),
            conclusion=f"续跑成功，可执行分片数: {len(executable_shards)}, 警告数: {len(warnings)}"
        )
        
        return executable_shards, warnings
    
    def complete_shard(self, pipeline_id: int, shard_index: int, 
                       status: ShardStatus, write_summary: Dict = None,
                       failure_reason: str = None, raw_input: Dict = None) -> Shard:
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"管道 {pipeline_id} 不存在")
        
        shard = self.db.query(Shard).filter(
            and_(
                Shard.pipeline_id == pipeline_id,
                Shard.shard_index == shard_index
            )
        ).first()
        
        if not shard:
            raise ValueError(f"分片 {shard_index} 不存在")
        
        status_before = shard.status
        shard.status = status
        shard.completed_at = datetime.utcnow()
        shard.write_summary = write_summary or {}
        shard.failure_reason = failure_reason
        shard.raw_input = raw_input or {}
        
        if status == ShardStatus.SUCCESS:
            summary = WriteSummary(
                pipeline_id=pipeline_id,
                shard_id=shard.id,
                records_written=write_summary.get("records_written", 0) if write_summary else 0,
                records_skipped=write_summary.get("records_skipped", 0) if write_summary else 0,
                records_failed=write_summary.get("records_failed", 0) if write_summary else 0,
                details=write_summary or {}
            )
            self.db.add(summary)
        
        self.db.commit()
        
        if status == ShardStatus.SUCCESS:
            self._update_watermark(pipeline)
            self._check_pipeline_completion(pipeline)
        elif status == ShardStatus.FAILED:
            pipeline.status = PipelineStatus.FAILED
            pipeline.last_failure_reason = failure_reason
            self.db.commit()
        
        self._record_history(
            pipeline_id=pipeline_id,
            shard_id=shard.id,
            action="complete_shard",
            status_before=status_before,
            status_after=status,
            raw_input=raw_input or {},
            conclusion=f"分片 {shard_index} 完成，状态: {status}"
        )
        
        return shard
    
    def manual_correction(self, pipeline_id: int, request: ManualCorrectionRequest, 
                          operator: str = "manual") -> Shard:
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"管道 {pipeline_id} 不存在")
        
        shard = self.db.query(Shard).filter(
            and_(
                Shard.pipeline_id == pipeline_id,
                Shard.shard_index == request.shard_index
            )
        ).first()
        
        if not shard:
            raise ValueError(f"分片 {request.shard_index} 不存在")
        
        status_before = shard.status
        shard.status = request.new_status
        if request.write_summary:
            shard.write_summary = request.write_summary
        
        self.db.commit()
        
        if request.new_status == ShardStatus.SUCCESS:
            self._update_watermark(pipeline)
            self._check_pipeline_completion(pipeline)
        
        self._record_history(
            pipeline_id=pipeline_id,
            shard_id=shard.id,
            action="manual_correction",
            status_before=status_before,
            status_after=request.new_status,
            raw_input=request.model_dump(),
            conclusion=f"人工修正: {request.reason}",
            operator=operator
        )
        
        return shard
    
    def update_pipeline_status(self, pipeline_id: int, status: PipelineStatus, 
                               reason: str = None) -> Pipeline:
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"管道 {pipeline_id} 不存在")
        
        status_before = pipeline.status
        pipeline.status = status
        if reason:
            pipeline.last_failure_reason = reason
        self.db.commit()
        
        self._record_history(
            pipeline_id=pipeline_id,
            action="update_status",
            status_before=status_before,
            status_after=status,
            conclusion=f"状态更新: {reason}"
        )
        
        return pipeline
    
    def export_summary(self, pipeline_id: int) -> Dict:
        pipeline = self.get_pipeline(pipeline_id)
        if not pipeline:
            raise ValueError(f"管道 {pipeline_id} 不存在")
        
        shards = self.get_shards(pipeline_id)
        summaries = self.db.query(WriteSummary).filter(
            WriteSummary.pipeline_id == pipeline_id
        ).all()
        
        total_written = sum(s.records_written for s in summaries)
        total_skipped = sum(s.records_skipped for s in summaries)
        total_failed = sum(s.records_failed for s in summaries)
        
        status_count = {}
        for shard in shards:
            status_count[shard.status] = status_count.get(shard.status, 0) + 1
        
        return {
            "pipeline": {
                "id": pipeline.id,
                "name": pipeline.pipeline_name,
                "status": pipeline.status,
                "total_shards": pipeline.total_shards,
                "current_watermark": pipeline.current_watermark,
                "created_at": pipeline.created_at.isoformat(),
                "updated_at": pipeline.updated_at.isoformat()
            },
            "shard_statistics": status_count,
            "write_summary": {
                "total_records_written": total_written,
                "total_records_skipped": total_skipped,
                "total_records_failed": total_failed
            },
            "shards": [
                {
                    "shard_index": s.shard_index,
                    "range_start": s.shard_range_start,
                    "range_end": s.shard_range_end,
                    "status": s.status,
                    "failure_reason": s.failure_reason,
                    "write_summary": s.write_summary
                }
                for s in shards
            ]
        }
    
    def get_history(self, pipeline_id: int, limit: int = 100) -> List[PipelineHistory]:
        return self.db.query(PipelineHistory).filter(
            PipelineHistory.pipeline_id == pipeline_id
        ).order_by(PipelineHistory.created_at.desc()).limit(limit).all()
