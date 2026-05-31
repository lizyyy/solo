import json
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any


class JudgmentStatus(Enum):
    PENDING = "待确认"
    AI_PASS = "AI通过"
    AI_FAIL = "AI不通过"
    MANUAL_PASS = "人工通过"
    MANUAL_FAIL = "人工不通过"
    MANUAL_REVISED = "人工修正"
    QUESTIONABLE = "存疑"


class IssueType(Enum):
    SENSITIVE_WORD = "敏感词漏脱敏"
    BROKEN_LINK = "答案来源断链"
    REPORT_INCONSISTENT = "灰度结论和报表不一致"
    INCOMPLETE_NOTE = "备注不完整"
    OTHER = "其他问题"


class QARecord:
    def __init__(
        self,
        question: str,
        answer: str,
        source: str = "",
        source_link: str = "",
        qa_id: Optional[str] = None,
    ):
        self.qa_id = qa_id or str(uuid.uuid4())
        self.question = question
        self.answer = answer
        self.source = source
        self.source_link = source_link
        
        self.ai_judgment: Optional[JudgmentStatus] = None
        self.ai_reason: str = ""
        self.ai_confidence: float = 0.0
        
        self.manual_judgment: Optional[JudgmentStatus] = None
        self.manual_reason: str = ""
        self.manual_operator: str = ""
        self.manual_time: Optional[datetime] = None
        
        self.issues: List[IssueType] = []
        self.issue_details: Dict[str, str] = {}
        
        self.import_batch_id: str = ""
        self.import_time: Optional[datetime] = None
        self.version: int = 1
        self.is_latest: bool = True
        
        self.tags: List[str] = []
        self.notes: str = ""
    
    def add_issue(self, issue_type: IssueType, detail: str = ""):
        if issue_type not in self.issues:
            self.issues.append(issue_type)
            self.issue_details[issue_type.value] = detail
    
    def set_ai_judgment(self, status: JudgmentStatus, reason: str, confidence: float = 0.0):
        self.ai_judgment = status
        self.ai_reason = reason
        self.ai_confidence = confidence
        
        if status in [JudgmentStatus.AI_PASS, JudgmentStatus.AI_FAIL]:
            pass
    
    def set_manual_judgment(self, status: JudgmentStatus, reason: str, operator: str):
        self.manual_judgment = status
        self.manual_reason = reason
        self.manual_operator = operator
        self.manual_time = datetime.now()
    
    def get_final_status(self) -> JudgmentStatus:
        if self.issues:
            return JudgmentStatus.QUESTIONABLE
        if self.manual_judgment:
            return self.manual_judgment
        if self.ai_judgment:
            return self.ai_judgment
        return JudgmentStatus.PENDING
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "qa_id": self.qa_id,
            "question": self.question,
            "answer": self.answer,
            "source": self.source,
            "source_link": self.source_link,
            "ai_judgment": self.ai_judgment.value if self.ai_judgment else None,
            "ai_reason": self.ai_reason,
            "ai_confidence": self.ai_confidence,
            "manual_judgment": self.manual_judgment.value if self.manual_judgment else None,
            "manual_reason": self.manual_reason,
            "manual_operator": self.manual_operator,
            "manual_time": self.manual_time.isoformat() if self.manual_time else None,
            "issues": [i.value for i in self.issues],
            "issue_details": self.issue_details,
            "import_batch_id": self.import_batch_id,
            "import_time": self.import_time.isoformat() if self.import_time else None,
            "version": self.version,
            "is_latest": self.is_latest,
            "tags": self.tags,
            "notes": self.notes,
            "final_status": self.get_final_status().value,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "QARecord":
        record = cls(
            question=data["question"],
            answer=data["answer"],
            source=data.get("source", ""),
            source_link=data.get("source_link", ""),
            qa_id=data.get("qa_id"),
        )
        if data.get("ai_judgment"):
            record.ai_judgment = JudgmentStatus(data["ai_judgment"])
        record.ai_reason = data.get("ai_reason", "")
        record.ai_confidence = data.get("ai_confidence", 0.0)
        
        if data.get("manual_judgment"):
            record.manual_judgment = JudgmentStatus(data["manual_judgment"])
        record.manual_reason = data.get("manual_reason", "")
        record.manual_operator = data.get("manual_operator", "")
        if data.get("manual_time"):
            record.manual_time = datetime.fromisoformat(data["manual_time"])
        
        record.issues = [IssueType(i) for i in data.get("issues", [])]
        record.issue_details = data.get("issue_details", {})
        
        record.import_batch_id = data.get("import_batch_id", "")
        if data.get("import_time"):
            record.import_time = datetime.fromisoformat(data["import_time"])
        record.version = data.get("version", 1)
        record.is_latest = data.get("is_latest", True)
        record.tags = data.get("tags", [])
        record.notes = data.get("notes", "")
        return record


class ImportBatch:
    def __init__(self, source_file: str, operator: str, batch_id: Optional[str] = None):
        self.batch_id = batch_id or str(uuid.uuid4())
        self.source_file = source_file
        self.operator = operator
        self.import_time = datetime.now()
        self.record_count: int = 0
        self.qa_ids: List[str] = []
        self.notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "source_file": self.source_file,
            "operator": self.operator,
            "import_time": self.import_time.isoformat(),
            "record_count": self.record_count,
            "qa_ids": self.qa_ids,
            "notes": self.notes,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ImportBatch":
        batch = cls(
            source_file=data["source_file"],
            operator=data["operator"],
            batch_id=data.get("batch_id"),
        )
        batch.import_time = datetime.fromisoformat(data["import_time"])
        batch.record_count = data.get("record_count", 0)
        batch.qa_ids = data.get("qa_ids", [])
        batch.notes = data.get("notes", "")
        return batch


class OperationLog:
    def __init__(self, operation_type: str, operator: str, details: str = ""):
        self.log_id = str(uuid.uuid4())
        self.operation_type = operation_type
        self.operator = operator
        self.timestamp = datetime.now()
        self.details = details
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "log_id": self.log_id,
            "operation_type": self.operation_type,
            "operator": self.operator,
            "timestamp": self.timestamp.isoformat(),
            "details": self.details,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "OperationLog":
        log = cls(
            operation_type=data["operation_type"],
            operator=data["operator"],
            details=data.get("details", ""),
        )
        log.log_id = data.get("log_id", log.log_id)
        log.timestamp = datetime.fromisoformat(data["timestamp"])
        return log


class WeeklyReport:
    def __init__(self, week_start: str, week_end: str, report_id: Optional[str] = None):
        self.report_id = report_id or str(uuid.uuid4())
        self.week_start = week_start
        self.week_end = week_end
        self.generated_time = datetime.now()
        self.generator: str = ""
        
        self.total_records: int = 0
        self.ai_pass_count: int = 0
        self.ai_fail_count: int = 0
        self.manual_pass_count: int = 0
        self.manual_fail_count: int = 0
        self.pending_count: int = 0
        self.questionable_count: int = 0
        
        self.issue_breakdown: Dict[str, int] = {}
        self.accuracy_rate: float = 0.0
        self.coverage_rate: float = 0.0
        
        self.qa_ids: List[str] = []
        self.highlights: str = ""
        self.next_steps: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "report_id": self.report_id,
            "week_start": self.week_start,
            "week_end": self.week_end,
            "generated_time": self.generated_time.isoformat(),
            "generator": self.generator,
            "total_records": self.total_records,
            "ai_pass_count": self.ai_pass_count,
            "ai_fail_count": self.ai_fail_count,
            "manual_pass_count": self.manual_pass_count,
            "manual_fail_count": self.manual_fail_count,
            "pending_count": self.pending_count,
            "questionable_count": self.questionable_count,
            "issue_breakdown": self.issue_breakdown,
            "accuracy_rate": self.accuracy_rate,
            "coverage_rate": self.coverage_rate,
            "qa_ids": self.qa_ids,
            "highlights": self.highlights,
            "next_steps": self.next_steps,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "WeeklyReport":
        report = cls(
            week_start=data["week_start"],
            week_end=data["week_end"],
            report_id=data.get("report_id"),
        )
        report.generated_time = datetime.fromisoformat(data["generated_time"])
        report.generator = data.get("generator", "")
        report.total_records = data.get("total_records", 0)
        report.ai_pass_count = data.get("ai_pass_count", 0)
        report.ai_fail_count = data.get("ai_fail_count", 0)
        report.manual_pass_count = data.get("manual_pass_count", 0)
        report.manual_fail_count = data.get("manual_fail_count", 0)
        report.pending_count = data.get("pending_count", 0)
        report.questionable_count = data.get("questionable_count", 0)
        report.issue_breakdown = data.get("issue_breakdown", {})
        report.accuracy_rate = data.get("accuracy_rate", 0.0)
        report.coverage_rate = data.get("coverage_rate", 0.0)
        report.qa_ids = data.get("qa_ids", [])
        report.highlights = data.get("highlights", "")
        report.next_steps = data.get("next_steps", "")
        return report


class DataStore:
    def __init__(self, base_path: str = "./data"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)
        self.qa_path = self.base_path / "qa_records"
        self.batch_path = self.base_path / "import_batches"
        self.log_path = self.base_path / "operation_logs"
        self.report_path = self.base_path / "weekly_reports"
        
        for p in [self.qa_path, self.batch_path, self.log_path, self.report_path]:
            p.mkdir(exist_ok=True)
    
    def save_qa_record(self, record: QARecord):
        file_path = self.qa_path / f"{record.qa_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_qa_record(self, qa_id: str) -> Optional[QARecord]:
        file_path = self.qa_path / f"{qa_id}.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return QARecord.from_dict(json.load(f))
        return None
    
    def load_all_qa_records(self) -> List[QARecord]:
        records = []
        for file_path in self.qa_path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                records.append(QARecord.from_dict(json.load(f)))
        return records
    
    def save_import_batch(self, batch: ImportBatch):
        file_path = self.batch_path / f"{batch.batch_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(batch.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_import_batch(self, batch_id: str) -> Optional[ImportBatch]:
        file_path = self.batch_path / f"{batch_id}.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return ImportBatch.from_dict(json.load(f))
        return None
    
    def load_all_import_batches(self) -> List[ImportBatch]:
        batches = []
        for file_path in self.batch_path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                batches.append(ImportBatch.from_dict(json.load(f)))
        return sorted(batches, key=lambda b: b.import_time, reverse=True)
    
    def save_operation_log(self, log: OperationLog):
        file_path = self.log_path / f"{log.log_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(log.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_all_operation_logs(self) -> List[OperationLog]:
        logs = []
        for file_path in self.log_path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                logs.append(OperationLog.from_dict(json.load(f)))
        return sorted(logs, key=lambda l: l.timestamp, reverse=True)
    
    def save_weekly_report(self, report: WeeklyReport):
        file_path = self.report_path / f"{report.report_id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
    
    def load_all_weekly_reports(self) -> List[WeeklyReport]:
        reports = []
        for file_path in self.report_path.glob("*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                reports.append(WeeklyReport.from_dict(json.load(f)))
        return sorted(reports, key=lambda r: r.generated_time, reverse=True)
