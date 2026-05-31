import re
import urllib.parse
from typing import List, Tuple, Optional
from urllib.request import urlopen
from urllib.error import URLError, HTTPError

from models import DataStore, QARecord, OperationLog, IssueType, JudgmentStatus


class IssueDetector:
    def __init__(self, data_store: DataStore):
        self.data_store = data_store
        self.sensitive_words: List[str] = [
            "***",
            "###",
            "XXX",
            "xxx",
            "敏感词",
        ]
        self.desensitization_patterns = [
            re.compile(r"\*{3,}"),
            re.compile(r"#{3,}"),
            re.compile(r"X{3,}"),
            re.compile(r"x{3,}"),
        ]
    
    def add_sensitive_words(self, words: List[str]):
        self.sensitive_words.extend(words)
    
    def _check_sensitive_words(self, text: str) -> Tuple[bool, List[str]]:
        found_words = []
        
        for word in self.sensitive_words:
            if word in text:
                found_words.append(word)
        
        return len(found_words) > 0, found_words
    
    def _check_desensitization_incomplete(self, text: str) -> Tuple[bool, List[str]]:
        issues = []
        
        phone_pattern = re.compile(r"1[3-9]\d{9}")
        id_card_pattern = re.compile(r"\d{17}[\dXx]")
        email_pattern = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
        name_pattern = re.compile(r"(?:王|李|张|刘|陈|杨|赵|黄|周|吴)[\u4e00-\u9fa5]{1,2}")
        
        if phone_pattern.search(text):
            issues.append("可能存在未脱敏手机号")
        
        if id_card_pattern.search(text):
            issues.append("可能存在未脱敏身份证号")
        
        if email_pattern.search(text):
            issues.append("可能存在未脱敏邮箱")
        
        return len(issues) > 0, issues
    
    def check_sensitive_leak(self, record: QARecord) -> Tuple[bool, str]:
        text = f"{record.question} {record.answer}"
        
        has_sensitive, sensitive_words = self._check_sensitive_words(text)
        has_desensitize_issue, desensitize_issues = self._check_desensitization_incomplete(text)
        
        issues = []
        if has_sensitive:
            issues.append(f"检测到敏感词: {', '.join(sensitive_words)}")
        if has_desensitize_issue:
            issues.extend(desensitize_issues)
        
        if issues:
            return True, "; ".join(issues)
        
        return False, ""
    
    def _is_valid_url(self, url: str) -> bool:
        if not url:
            return False
        
        if not url.startswith(("http://", "https://")):
            return False
        
        try:
            result = urllib.parse.urlparse(url)
            return all([result.scheme, result.netloc])
        except Exception:
            return False
    
    def _check_link_accessible(self, url: str, timeout: int = 5) -> Tuple[bool, str]:
        try:
            with urlopen(url, timeout=timeout) as response:
                status = response.getcode()
                if 200 <= status < 400:
                    return True, f"链接可访问 (状态码: {status})"
                else:
                    return False, f"链接返回异常状态码: {status}"
        except HTTPError as e:
            return False, f"HTTP错误: {e.code}"
        except URLError as e:
            return False, f"URL错误: {str(e.reason)}"
        except Exception as e:
            return False, f"访问失败: {str(e)}"
    
    def check_broken_link(self, record: QARecord, check_accessibility: bool = False) -> Tuple[bool, str]:
        source_link = record.source_link
        
        if not source_link:
            if not record.source:
                return True, "缺少来源信息和来源链接"
            return False, ""
        
        if not self._is_valid_url(source_link):
            return True, f"来源链接格式无效: {source_link}"
        
        if check_accessibility:
            accessible, msg = self._check_link_accessible(source_link)
            if not accessible:
                return True, msg
        
        return False, ""
    
    def check_report_inconsistent(self, record: QARecord) -> Tuple[bool, str]:
        issues = []
        
        if record.ai_judgment and record.manual_judgment:
            ai_pass = record.ai_judgment == JudgmentStatus.AI_PASS
            manual_pass = record.manual_judgment in [
                JudgmentStatus.MANUAL_PASS,
                JudgmentStatus.MANUAL_REVISED,
            ]
            
            if ai_pass != manual_pass:
                issues.append(f"AI判断({record.ai_judgment.value})与人工判断({record.manual_judgment.value})不一致")
        
        if record.notes:
            note_indicators = ["存疑", "待确认", "需要复核", "不一致", "有问题"]
            for indicator in note_indicators:
                if indicator in record.notes:
                    if record.get_final_status() not in [
                        JudgmentStatus.QUESTIONABLE,
                        JudgmentStatus.PENDING,
                    ]:
                        issues.append(f"备注标注'{indicator}'但状态非存疑/待确认")
                    break
        
        if record.issues and record.get_final_status() != JudgmentStatus.QUESTIONABLE:
            issues.append("存在问题标记但最终状态未标记为存疑")
        
        if issues:
            return True, "; ".join(issues)
        
        return False, ""
    
    def check_incomplete_note(self, record: QARecord) -> Tuple[bool, str]:
        if record.manual_judgment and not record.manual_reason:
            return True, "有人工判断但无判断理由"
        
        note_keywords = ["待补充", "待完善", "后续补充", "稍后补充"]
        for keyword in note_keywords:
            if keyword in record.notes:
                return True, f"备注标注'{keyword}'，信息不完整"
        
        return False, ""
    
    def detect_issues(
        self,
        record: QARecord,
        operator: str = "system",
        check_link_access: bool = False,
    ) -> List[IssueType]:
        detected_issues: List[IssueType] = []
        
        has_sensitive_leak, sensitive_detail = self.check_sensitive_leak(record)
        if has_sensitive_leak:
            record.add_issue(IssueType.SENSITIVE_WORD, sensitive_detail)
            detected_issues.append(IssueType.SENSITIVE_WORD)
        
        has_broken_link, link_detail = self.check_broken_link(record, check_link_access)
        if has_broken_link:
            record.add_issue(IssueType.BROKEN_LINK, link_detail)
            detected_issues.append(IssueType.BROKEN_LINK)
        
        has_inconsistent, inconsistent_detail = self.check_report_inconsistent(record)
        if has_inconsistent:
            record.add_issue(IssueType.REPORT_INCONSISTENT, inconsistent_detail)
            detected_issues.append(IssueType.REPORT_INCONSISTENT)
        
        has_incomplete_note, note_detail = self.check_incomplete_note(record)
        if has_incomplete_note:
            record.add_issue(IssueType.INCOMPLETE_NOTE, note_detail)
            detected_issues.append(IssueType.INCOMPLETE_NOTE)
        
        if detected_issues:
            self.data_store.save_qa_record(record)
            
            issue_str = ", ".join([i.value for i in detected_issues])
            log = OperationLog(
                operation_type="问题检测",
                operator=operator,
                details=f"记录: {record.qa_id}, 检测到问题: {issue_str}",
            )
            self.data_store.save_operation_log(log)
        
        return detected_issues
    
    def batch_detect_issues(
        self,
        qa_ids: Optional[List[str]] = None,
        operator: str = "system",
        check_link_access: bool = False,
    ) -> dict:
        if qa_ids:
            records = [
                self.data_store.load_qa_record(qa_id)
                for qa_id in qa_ids
            ]
            records = [r for r in records if r is not None]
        else:
            records = self.data_store.load_all_qa_records()
            records = [r for r in records if r.is_latest]
        
        total_records = len(records)
        records_with_issues = 0
        issue_distribution = {}
        
        for record in records:
            old_issue_count = len(record.issues)
            detected = self.detect_issues(record, operator, check_link_access)
            
            if len(record.issues) > old_issue_count:
                records_with_issues += 1
                for issue in detected:
                    issue_str = issue.value
                    issue_distribution[issue_str] = issue_distribution.get(issue_str, 0) + 1
        
        return {
            "total_scanned": total_records,
            "records_with_new_issues": records_with_issues,
            "issue_distribution": issue_distribution,
        }
    
    def clear_issue(
        self,
        qa_id: str,
        issue_type: IssueType,
        reason: str,
        operator: str,
    ) -> Tuple[bool, str]:
        if not reason.strip():
            return False, "清除问题必须说明理由"
        
        record = self.data_store.load_qa_record(qa_id)
        if not record:
            return False, f"未找到记录: {qa_id}"
        
        if issue_type not in record.issues:
            return False, f"该记录不存在此问题类型: {issue_type.value}"
        
        record.issues.remove(issue_type)
        if issue_type.value in record.issue_details:
            del record.issue_details[issue_type.value]
        
        self.data_store.save_qa_record(record)
        
        log = OperationLog(
            operation_type="清除问题标记",
            operator=operator,
            details=f"记录: {qa_id}, 清除问题: {issue_type.value}, 理由: {reason}",
        )
        self.data_store.save_operation_log(log)
        
        return True, "问题标记已清除"
    
    def get_issue_summary(self) -> dict:
        records = self.data_store.load_all_qa_records()
        records = [r for r in records if r.is_latest]
        
        total_records = len(records)
        records_with_issues = 0
        issue_counts = {}
        
        for record in records:
            if record.issues:
                records_with_issues += 1
                for issue in record.issues:
                    issue_str = issue.value
                    issue_counts[issue_str] = issue_counts.get(issue_str, 0) + 1
        
        return {
            "total_records": total_records,
            "records_with_issues": records_with_issues,
            "issue_rate": records_with_issues / total_records if total_records > 0 else 0.0,
            "issue_breakdown": issue_counts,
        }
    
    def get_records_with_issues(
        self,
        issue_type: Optional[IssueType] = None,
    ) -> List[QARecord]:
        records = self.data_store.load_all_qa_records()
        records = [r for r in records if r.is_latest and r.issues]
        
        if issue_type:
            records = [r for r in records if issue_type in r.issues]
        
        return records
