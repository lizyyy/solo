from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import (
    DocumentVersion, IndexTask, ShardValidation,
    RecallSample, RebuildReport
)
from app.schemas import (
    DocumentVersionCreate, RecallSampleCreate,
    RebuildIndexRequest, RollbackRequest
)


class TaskStatus:
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class RollbackStatus:
    NONE = None
    INITIATED = "initiated"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ValidationResult:
    VALID = "valid"
    INVALID = "invalid"
    PARTIAL = "partial"


class IndexRebuildService:
    def __init__(self, db: Session):
        self.db = db

    def validate_request_fields(self, request: RebuildIndexRequest) -> Dict[str, Any]:
        errors = []
        
        if not request.task_id.strip():
            errors.append("task_id 不能为空")
        
        if not request.document_versions:
            errors.append("document_versions 不能为空")
        else:
            for i, doc in enumerate(request.document_versions):
                if not doc.document_id.strip():
                    errors.append(f"文档 #{i+1} 的 document_id 不能为空")
                if doc.version < 1:
                    errors.append(f"文档 #{i+1} 的 version 必须大于 0")
                if not doc.content_hash.strip():
                    errors.append(f"文档 #{i+1} 的 content_hash 不能为空")
        
        if errors:
            return {"valid": False, "errors": errors}
        
        return {"valid": True, "errors": []}

    def check_duplicate_task(self, task_id: str) -> bool:
        existing_task = self.db.query(IndexTask).filter(
            IndexTask.task_id == task_id
        ).first()
        return existing_task is not None

    def check_running_task(self) -> Optional[IndexTask]:
        running_task = self.db.query(IndexTask).filter(
            IndexTask.status.in_([TaskStatus.PENDING, TaskStatus.RUNNING])
        ).first()
        return running_task

    def create_index_task(self, task_id: str, target_count: int) -> IndexTask:
        task = IndexTask(
            task_id=task_id,
            status=TaskStatus.PENDING,
            target_document_count=target_count
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def start_task(self, task: IndexTask) -> None:
        task.status = TaskStatus.RUNNING
        task.started_at = datetime.utcnow()
        self.db.commit()

    def process_document_versions(
        self,
        task: IndexTask,
        document_versions: List[DocumentVersionCreate]
    ) -> Dict[str, Any]:
        results = {
            "processed": 0,
            "success": 0,
            "failed": 0,
            "errors": []
        }

        for doc_create in document_versions:
            try:
                task.processed_document_count += 1
                self.db.commit()

                existing_doc = self.db.query(DocumentVersion).filter(
                    DocumentVersion.document_id == doc_create.document_id,
                    DocumentVersion.version == doc_create.version
                ).first()

                if existing_doc:
                    if existing_doc.content_hash != doc_create.content_hash:
                        results["failed"] += 1
                        results["errors"].append(
                            f"文档 {doc_create.document_id} 版本 {doc_create.version} 已存在但内容不一致"
                        )
                        task.failed_document_count += 1
                        self.db.commit()
                        continue
                    else:
                        doc = existing_doc
                else:
                    doc = DocumentVersion(
                        document_id=doc_create.document_id,
                        version=doc_create.version,
                        content_hash=doc_create.content_hash,
                        title=doc_create.title,
                        content=doc_create.content,
                        is_active=True
                    )
                    self.db.add(doc)
                    self.db.commit()
                    self.db.refresh(doc)

                shard_id = self._calculate_shard_id(doc_create.document_id)
                validation = ShardValidation(
                    shard_id=shard_id,
                    document_version_id=doc.id,
                    index_task_id=task.id,
                    expected_hash=doc_create.content_hash
                )
                self.db.add(validation)
                self.db.commit()

                actual_hash = self._simulate_vector_index_validation(
                    doc_create.document_id,
                    doc_create.version,
                    doc_create.content_hash
                )

                validation.actual_hash = actual_hash
                validation.is_valid = (actual_hash == doc_create.content_hash)
                validation.validated_at = datetime.utcnow()

                if validation.is_valid:
                    results["success"] += 1
                    task.success_document_count += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(
                        f"文档 {doc_create.document_id} 版本 {doc_create.version} 校验失败：期望哈希 {doc_create.content_hash}，实际哈希 {actual_hash}"
                    )
                    task.failed_document_count += 1
                    validation.error_message = "内容哈希不匹配"

                self.db.commit()
                results["processed"] += 1

            except Exception as e:
                results["failed"] += 1
                results["errors"].append(f"处理文档 {doc_create.document_id} 时出错：{str(e)}")
                task.failed_document_count += 1
                self.db.commit()

        return results

    def run_recall_samples(
        self,
        task: IndexTask,
        samples: Optional[List[RecallSampleCreate]]
    ) -> Dict[str, Any]:
        if not samples:
            return {"total": 0, "matched": 0, "accuracy": 0.0}

        results = {
            "total": len(samples),
            "matched": 0,
            "accuracy": 0.0
        }

        for sample_create in samples:
            try:
                actual_doc_id, actual_version, score = self._simulate_recall_search(
                    sample_create.query
                )

                is_match = (
                    actual_doc_id == sample_create.expected_document_id and
                    actual_version == sample_create.expected_version
                )

                if is_match:
                    results["matched"] += 1

                sample = RecallSample(
                    index_task_id=task.id,
                    query=sample_create.query,
                    expected_document_id=sample_create.expected_document_id,
                    expected_version=sample_create.expected_version,
                    actual_document_id=actual_doc_id,
                    actual_version=actual_version,
                    score=score,
                    is_match=is_match
                )
                self.db.add(sample)
                self.db.commit()

            except Exception as e:
                sample = RecallSample(
                    index_task_id=task.id,
                    query=sample_create.query,
                    expected_document_id=sample_create.expected_document_id,
                    expected_version=sample_create.expected_version,
                    error_message=f"召回测试失败：{str(e)}",
                    is_match=False
                )
                self.db.add(sample)
                self.db.commit()

        if results["total"] > 0:
            results["accuracy"] = results["matched"] / results["total"]

        return results

    def complete_task(
        self,
        task: IndexTask,
        validation_results: Dict[str, Any],
        recall_results: Dict[str, Any]
    ) -> Dict[str, Any]:
        all_valid = (
            validation_results["failed"] == 0 and
            (recall_results["total"] == 0 or recall_results["accuracy"] >= 0.95)
        )

        if all_valid:
            task.status = TaskStatus.COMPLETED
            task.completed_at = datetime.utcnow()
            overall_status = "success"
        else:
            task.status = TaskStatus.FAILED
            task.failed_at = datetime.utcnow()
            task.error_message = "验证失败或召回准确率不足"
            overall_status = "failed"

        self.db.commit()

        report = self._generate_report(
            task,
            validation_results,
            recall_results,
            overall_status
        )

        return {
            "task_status": task.status,
            "report": report,
            "all_valid": all_valid
        }

    def rollback_task(self, task: IndexTask, reason: str) -> Dict[str, Any]:
        if task.rollback_status == RollbackStatus.COMPLETED:
            return {
                "success": True,
                "message": "任务已经回滚过了"
            }

        if task.status not in [TaskStatus.FAILED, TaskStatus.COMPLETED, TaskStatus.ROLLED_BACK]:
            raise HTTPException(
                status_code=400,
                detail="只能回滚已完成、失败或已回滚的任务"
            )

        task.rollback_status = RollbackStatus.INITIATED
        task.error_message = f"人工回滚：{reason}"
        self.db.commit()

        try:
            task.rollback_status = RollbackStatus.IN_PROGRESS
            self.db.commit()

            validations = self.db.query(ShardValidation).filter(
                ShardValidation.index_task_id == task.id
            ).all()

            for validation in validations:
                self._simulate_vector_index_rollback(
                    validation.document_version.document_id,
                    validation.document_version.version
                )

            task.status = TaskStatus.ROLLED_BACK
            task.rollback_status = RollbackStatus.COMPLETED
            self.db.commit()

            return {
                "success": True,
                "message": "回滚成功"
            }

        except Exception as e:
            task.rollback_status = RollbackStatus.FAILED
            task.error_message = f"回滚失败：{str(e)}"
            self.db.commit()
            return {
                "success": False,
                "message": f"回滚失败：{str(e)}"
            }

    def get_task_status(self, task_id: str) -> Dict[str, Any]:
        task = self.db.query(IndexTask).filter(
            IndexTask.task_id == task_id
        ).first()

        if not task:
            raise HTTPException(status_code=404, detail="任务不存在")

        validations = self.db.query(ShardValidation).filter(
            ShardValidation.index_task_id == task.id
        ).all()

        recall_samples = self.db.query(RecallSample).filter(
            RecallSample.index_task_id == task.id
        ).all()

        reports = self.db.query(RebuildReport).filter(
            RebuildReport.index_task_id == task.id
        ).all()

        return {
            "task": task,
            "validations": validations,
            "recall_samples": recall_samples,
            "reports": reports
        }

    def rebuild_index(self, request: RebuildIndexRequest) -> Dict[str, Any]:
        validation = self.validate_request_fields(request)
        if not validation["valid"]:
            raise HTTPException(
                status_code=400,
                detail={"message": "请求字段验证失败", "errors": validation["errors"]}
            )

        if self.check_duplicate_task(request.task_id):
            raise HTTPException(
                status_code=409,
                detail="任务ID已存在，请勿重复提交"
            )

        running_task = self.check_running_task()
        if running_task:
            raise HTTPException(
                status_code=409,
                detail=f"存在正在运行的任务：{running_task.task_id}，请等待完成后再提交新任务"
            )

        task = self.create_index_task(
            task_id=request.task_id,
            target_count=len(request.document_versions)
        )

        try:
            self.start_task(task)

            validation_results = self.process_document_versions(
                task,
                request.document_versions
            )

            recall_results = self.run_recall_samples(
                task,
                request.recall_samples
            )

            final_result = self.complete_task(
                task,
                validation_results,
                recall_results
            )

            if not final_result["all_valid"] and request.enable_rollback:
                rollback_result = self.rollback_task(task, "自动回滚：验证失败")
                final_result["auto_rollback"] = rollback_result

            return final_result

        except Exception as e:
            task.status = TaskStatus.FAILED
            task.failed_at = datetime.utcnow()
            task.error_message = f"重建过程中发生异常：{str(e)}"
            self.db.commit()

            if request.enable_rollback:
                self.rollback_task(task, f"异常回滚：{str(e)}")

            raise HTTPException(
                status_code=500,
                detail=f"重建失败：{str(e)}"
            )

    def _calculate_shard_id(self, document_id: str) -> str:
        hash_value = hash(document_id)
        shard_number = abs(hash_value) % 10
        return f"shard_{shard_number:02d}"

    def _simulate_vector_index_validation(
        self,
        document_id: str,
        version: int,
        expected_hash: str
    ) -> str:
        return expected_hash

    def _simulate_recall_search(
        self,
        query: str
    ) -> tuple:
        return ("sample_doc_001", 2, 0.95)

    def _simulate_vector_index_rollback(
        self,
        document_id: str,
        version: int
    ) -> bool:
        return True

    def _generate_report(
        self,
        task: IndexTask,
        validation_results: Dict[str, Any],
        recall_results: Dict[str, Any],
        overall_status: str
    ) -> RebuildReport:
        valid_count = sum(
            1 for v in task.shard_validations if v.is_valid
        )
        invalid_count = len(task.shard_validations) - valid_count

        summary = self._generate_summary(
            validation_results,
            recall_results,
            overall_status
        )

        report = RebuildReport(
            index_task_id=task.id,
            overall_status=overall_status,
            total_documents=task.target_document_count,
            validated_documents=len(task.shard_validations),
            valid_documents=valid_count,
            invalid_documents=invalid_count,
            recall_samples_count=recall_results["total"],
            recall_match_count=recall_results["matched"],
            recall_accuracy=recall_results["accuracy"],
            summary=summary
        )

        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)

        return report

    def _generate_summary(
        self,
        validation_results: Dict[str, Any],
        recall_results: Dict[str, Any],
        overall_status: str
    ) -> str:
        lines = []

        if overall_status == "success":
            lines.append("索引重建成功！")
        else:
            lines.append("索引重建失败！")

        lines.append(f"文档验证：成功 {validation_results['success']} 个，失败 {validation_results['failed']} 个")

        if recall_results["total"] > 0:
            lines.append(
                f"召回测试：共 {recall_results['total']} 个样本，匹配 {recall_results['matched']} 个，准确率 {recall_results['accuracy']*100:.1f}%"
            )

        if validation_results["errors"]:
            lines.append("验证错误：")
            for error in validation_results["errors"]:
                lines.append(f"  - {error}")

        return "\n".join(lines)
