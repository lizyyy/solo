from typing import Dict, List, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from collections import defaultdict

from src.models.database import (
    SampleList, AdmissionRecord, AdmissionVersion,
    BorderlineCase, WorkflowStep, get_db
)
from src.utils.border_rules import BORDER_RULES


class MatchingResult:
    def __init__(self):
        self.total_samples = 0
        self.matched_samples = 0
        self.skipped_samples = 0
        self.borderline_samples = 0
        self.matched_by_volunteer = defaultdict(int)
        self.unmatched_samples = []
        self.borderline_details = []


class VolunteerMatchingEngine:
    def __init__(self, db: Session, major_quota: Dict[str, int] = None):
        self.db = db
        self.major_quota = major_quota or {}
        self.major_used = defaultdict(int)
        self.result = MatchingResult()

    def run_matching(self, batch_id: str = None, operator: str = "system") -> MatchingResult:
        """
        执行最大匹配志愿录取
        
        规则:
        1. 按分数从高到低排序
        2. 边界样本（负数、缺失）跳过，标记待复核
        3. 按志愿顺序匹配，专业名额满则下一志愿
        """
        self._record_workflow_step(batch_id, "matching_started", operator)
        
        samples = self._get_eligible_samples()
        self.result.total_samples = len(samples)
        
        samples_sorted = sorted(
            samples,
            key=lambda x: (x.score if x.score else -1),
            reverse=True
        )
        
        for sample in samples_sorted:
            self._process_sample(sample)
        
        self._record_workflow_step(batch_id, "matching_completed", operator)
        
        return self.result

    def _get_eligible_samples(self) -> List[SampleList]:
        """
        获取可参与匹配的样本（排除待复核的边界样本）
        """
        query = self.db.query(SampleList)
        
        return query.all()

    def _process_sample(self, sample: SampleList):
        """
        处理单个样本的志愿匹配
        """
        if self._is_borderline_sample(sample):
            self.result.borderline_samples += 1
            self.result.borderline_details.append({
                "student_id": sample.student_id,
                "student_name": sample.student_name,
                "reason": self._get_borderline_reason(sample)
            })
            return
        
        if not sample.score or sample.score < 0:
            self.result.skipped_samples += 1
            return
        
        matched = False
        volunteers = [
            (1, sample.volunteer_1),
            (2, sample.volunteer_2),
            (3, sample.volunteer_3)
        ]
        
        for vol_order, major in volunteers:
            if not major or major.strip() == "" or major == "nan":
                continue
            
            major = major.strip()
            quota = self.major_quota.get(major, 9999)
            
            if self.major_used[major] < quota:
                self._record_admission(sample, vol_order, major)
                matched = True
                break
        
        if not matched:
            self.result.unmatched_samples.append({
                "student_id": sample.student_id,
                "student_name": sample.student_name,
                "score": sample.score
            })
        else:
            self.result.matched_samples += 1

    def _is_borderline_sample(self, sample: SampleList) -> bool:
        """
        判断是否为边界样本（不参与自动匹配）
        """
        if sample.is_negative:
            return True
        if sample.is_missing:
            return True
        if sample.needs_review and sample.review_status == "pending":
            return True
        return False

    def _get_borderline_reason(self, sample: SampleList) -> str:
        """
        获取边界样本原因
        """
        reasons = []
        if sample.is_negative:
            reasons.append(f"负数分数(原始值: {sample.raw_score})")
        if sample.is_missing:
            reasons.append("缺失分数")
        if sample.needs_review:
            reasons.append("待人工复核")
        
        return "; ".join(reasons) if reasons else "未知边界问题"

    def _record_admission(self, sample: SampleList, vol_order: int, major: str):
        """
        记录录取结果（支持版本追踪）
        """
        self.major_used[major] += 1
        self.result.matched_by_volunteer[vol_order] += 1
        
        existing = self.db.query(AdmissionRecord).filter(
            AdmissionRecord.sample_id == sample.id
        ).first()
        
        if existing:
            version = len(existing.version_history) + 1
            version_record = AdmissionVersion(
                admission_id=existing.id,
                version=version,
                matched_volunteer=existing.matched_volunteer,
                matched_major=existing.matched_major,
                admission_status=existing.admission_status,
                change_reason="重新匹配更新",
                changed_by="system"
            )
            self.db.add(version_record)
            
            existing.matched_volunteer = vol_order
            existing.matched_major = major
            existing.match_score = sample.score
            existing.updated_at = datetime.utcnow()
        else:
            admission = AdmissionRecord(
                sample_id=sample.id,
                matched_volunteer=vol_order,
                matched_major=major,
                match_score=sample.score,
                is_borderline=False,
                admission_status="provisional",
                batch_id=f"match_{datetime.now().strftime('%Y%m%d')}"
            )
            self.db.add(admission)
        
        self.db.commit()

    def _record_workflow_step(self, batch_id: str, step_name: str, operator: str):
        """
        记录工作流步骤
        """
        step_order_map = {
            "import_completed": 1,
            "review_completed": 2,
            "matching_started": 3,
            "matching_completed": 4
        }
        
        step = WorkflowStep(
            step_name=step_name,
            step_order=step_order_map.get(step_name, 0),
            status="completed",
            batch_id=batch_id or "default",
            operator=operator,
            completed_at=datetime.utcnow()
        )
        self.db.add(step)
        self.db.commit()


def get_admission_traceability(db: Session, sample_id: int) -> Dict:
    """
    获取录取记录的完整追溯信息
    
    包括: 原始抽样数据、所有老师批注、版本历史、边界案例记录
    """
    sample = db.query(SampleList).filter(SampleList.id == sample_id).first()
    if not sample:
        return {}
    
    admission = db.query(AdmissionRecord).filter(
        AdmissionRecord.sample_id == sample_id
    ).first()
    
    version_history = []
    if admission:
        version_history = [{
            "version": v.version,
            "matched_major": v.matched_major,
            "matched_volunteer": v.matched_volunteer,
            "change_reason": v.change_reason,
            "changed_by": v.changed_by,
            "created_at": v.created_at.isoformat()
        } for v in admission.version_history]
    
    comments = [{
        "version": c.version,
        "is_latest": c.is_latest,
        "teacher": c.teacher_name,
        "comment": c.comment,
        "created_at": c.created_at.isoformat()
    } for c in sample.comments]
    
    borderline_cases = [{
        "case_type": bc.case_type,
        "description": bc.description,
        "original_value": bc.original_value,
        "status": bc.status,
        "assigned_to": bc.assigned_to
    } for bc in db.query(BorderlineCase).filter(
        BorderlineCase.sample_id == sample_id
    ).all()]
    
    return {
        "student": {
            "id": sample.student_id,
            "name": sample.student_name,
            "raw_score": sample.raw_score,
            "cleaned_score": sample.score,
            "remark": sample.remark
        },
        "borderline_flags": {
            "is_negative": sample.is_negative,
            "is_missing": sample.is_missing,
            "needs_review": sample.needs_review
        },
        "admission": {
            "matched_major": admission.matched_major if admission else None,
            "matched_volunteer": admission.matched_volunteer if admission else None,
            "status": admission.admission_status if admission else None
        } if admission else None,
        "version_history": version_history,
        "teacher_comments": comments,
        "borderline_cases": borderline_cases,
        "trace_source": {
            "sample_source": sample.source_file,
            "import_batch": sample.import_batch
        }
    }
