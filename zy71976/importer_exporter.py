import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Callable

from models import DataStore, QARecord, ImportBatch, OperationLog, JudgmentStatus


class KnowledgeBaseImporter:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
    
    def _generate_record_hash(self, question: str, answer: str) -> str:
        content = f"{question}|{answer}"
        return hashlib.md5(content.encode("utf-8")).hexdigest()
    
    def _find_existing_record(self, question: str, answer: str) -> Optional[QARecord]:
        all_records = self.data_store.load_all_qa_records()
        target_hash = self._generate_record_hash(question, answer)
        
        for record in all_records:
            if record.is_latest:
                record_hash = self._generate_record_hash(record.question, record.answer)
                if record_hash == target_hash:
                    return record
        return None
    
    def import_from_csv(
        self,
        file_path: str,
        operator: str,
        auto_ai_judgment: bool = True,
        ai_judge_func: Optional[Callable] = None,
    ) -> ImportBatch:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        batch = ImportBatch(source_file=str(file_path), operator=operator)
        imported_records: List[QARecord] = []
        
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                question = row.get("问题", "").strip()
                answer = row.get("答案", "").strip()
                
                if not question or not answer:
                    continue
                
                existing_record = self._find_existing_record(question, answer)
                
                if existing_record:
                    existing_record.version += 1
                    existing_record.import_batch_id = batch.batch_id
                    existing_record.import_time = datetime.now()
                    existing_record.source = row.get("来源", existing_record.source)
                    existing_record.source_link = row.get("来源链接", existing_record.source_link)
                    existing_record.notes = row.get("备注", existing_record.notes)
                    
                    if row.get("标签"):
                        existing_record.tags = [t.strip() for t in row["标签"].split(",") if t.strip()]
                    
                    record = existing_record
                else:
                    record = QARecord(
                        question=question,
                        answer=answer,
                        source=row.get("来源", ""),
                        source_link=row.get("来源链接", ""),
                    )
                    record.import_batch_id = batch.batch_id
                    record.import_time = datetime.now()
                    record.notes = row.get("备注", "")
                    
                    if row.get("标签"):
                        record.tags = [t.strip() for t in row["标签"].split(",") if t.strip()]
                    
                    if auto_ai_judgment:
                        if ai_judge_func:
                            ai_judge_func(record)
                        else:
                            self._default_ai_judgment(record)
                
                self.data_store.save_qa_record(record)
                imported_records.append(record)
                batch.qa_ids.append(record.qa_id)
        
        batch.record_count = len(imported_records)
        self.data_store.save_import_batch(batch)
        
        log = OperationLog(
            operation_type="导入知识库",
            operator=operator,
            details=f"批次: {batch.batch_id}, 文件: {file_path.name}, 记录数: {batch.record_count}",
        )
        self.data_store.save_operation_log(log)
        
        return batch
    
    def _default_ai_judgment(self, record: QARecord):
        import random
        random.seed(hash(record.question) % 10000)
        
        answer_length = len(record.answer)
        has_source = bool(record.source or record.source_link)
        
        confidence = 0.5
        reasons = []
        
        if answer_length < 10:
            reasons.append("答案过短")
            status = JudgmentStatus.AI_FAIL
            confidence = 0.8
        elif answer_length > 500:
            reasons.append("答案篇幅适中")
            confidence += 0.2
        else:
            reasons.append("答案长度符合预期")
            confidence += 0.3
        
        if has_source:
            reasons.append("有明确来源")
            confidence += 0.2
        else:
            reasons.append("缺少来源信息")
            confidence -= 0.1
        
        if confidence >= 0.6:
            status = JudgmentStatus.AI_PASS
        else:
            status = JudgmentStatus.AI_FAIL
        
        confidence = max(0.0, min(1.0, confidence))
        reason_text = "; ".join(reasons) + f" (置信度: {confidence:.2f})"
        
        record.set_ai_judgment(status, reason_text, confidence)


class KnowledgeBaseExporter:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
    
    def _get_filtered_records(
        self,
        status_filter: Optional[List[JudgmentStatus]] = None,
        issue_filter: Optional[List[str]] = None,
        batch_filter: Optional[str] = None,
        tag_filter: Optional[List[str]] = None,
        only_latest: bool = True,
    ) -> List[QARecord]:
        records = self.data_store.load_all_qa_records()
        
        if only_latest:
            records = [r for r in records if r.is_latest]
        
        if status_filter:
            status_values = [s.value for s in status_filter]
            records = [r for r in records if r.get_final_status().value in status_values]
        
        if issue_filter:
            records = [
                r for r in records
                if any(issue in r.issue_details for issue in issue_filter)
            ]
        
        if batch_filter:
            records = [r for r in records if r.import_batch_id == batch_filter]
        
        if tag_filter:
            records = [
                r for r in records
                if any(tag in r.tags for tag in tag_filter)
            ]
        
        return records
    
    def export_to_csv(
        self,
        output_path: str,
        status_filter: Optional[List[JudgmentStatus]] = None,
        issue_filter: Optional[List[str]] = None,
        batch_filter: Optional[str] = None,
        tag_filter: Optional[List[str]] = None,
        operator: str = "system",
    ) -> int:
        records = self._get_filtered_records(
            status_filter=status_filter,
            issue_filter=issue_filter,
            batch_filter=batch_filter,
            tag_filter=tag_filter,
        )
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "问题",
                "答案",
                "来源",
                "来源链接",
                "最终状态",
                "AI判断",
                "AI判断理由",
                "AI置信度",
                "人工判断",
                "人工判断理由",
                "操作人",
                "操作时间",
                "问题类型",
                "问题详情",
                "标签",
                "备注",
                "导入批次",
                "导入时间",
                "版本",
            ])
            
            for record in records:
                final_status = record.get_final_status().value
                issues_str = ";".join([i.value for i in record.issues]) if record.issues else ""
                issue_details_str = json.dumps(record.issue_details, ensure_ascii=False) if record.issue_details else ""
                tags_str = ",".join(record.tags) if record.tags else ""
                
                writer.writerow([
                    record.question,
                    record.answer,
                    record.source,
                    record.source_link,
                    final_status,
                    record.ai_judgment.value if record.ai_judgment else "",
                    record.ai_reason,
                    f"{record.ai_confidence:.2f}" if record.ai_confidence else "",
                    record.manual_judgment.value if record.manual_judgment else "",
                    record.manual_reason,
                    record.manual_operator,
                    record.manual_time.strftime("%Y-%m-%d %H:%M:%S") if record.manual_time else "",
                    issues_str,
                    issue_details_str,
                    tags_str,
                    record.notes,
                    record.import_batch_id,
                    record.import_time.strftime("%Y-%m-%d %H:%M:%S") if record.import_time else "",
                    record.version,
                ])
        
        log = OperationLog(
            operation_type="导出数据",
            operator=operator,
            details=f"导出文件: {output_path}, 记录数: {len(records)}",
        )
        self.data_store.save_operation_log(log)
        
        return len(records)
    
    def export_questionable_to_csv(
        self,
        output_path: str,
        operator: str = "system",
    ) -> int:
        return self.export_to_csv(
            output_path=output_path,
            status_filter=[JudgmentStatus.QUESTIONABLE],
            operator=operator,
        )
    
    def export_pending_to_csv(
        self,
        output_path: str,
        operator: str = "system",
    ) -> int:
        return self.export_to_csv(
            output_path=output_path,
            status_filter=[JudgmentStatus.PENDING],
            operator=operator,
        )
    
    def get_export_summary(
        self,
        status_filter: Optional[List[JudgmentStatus]] = None,
        issue_filter: Optional[List[str]] = None,
        batch_filter: Optional[str] = None,
    ) -> Dict[str, any]:
        records = self._get_filtered_records(
            status_filter=status_filter,
            issue_filter=issue_filter,
            batch_filter=batch_filter,
        )
        
        status_counts: Dict[str, int] = {}
        issue_counts: Dict[str, int] = {}
        
        for record in records:
            status = record.get_final_status().value
            status_counts[status] = status_counts.get(status, 0) + 1
            
            for issue in record.issues:
                issue_str = issue.value
                issue_counts[issue_str] = issue_counts.get(issue_str, 0) + 1
        
        return {
            "total_count": len(records),
            "status_breakdown": status_counts,
            "issue_breakdown": issue_counts,
        }
