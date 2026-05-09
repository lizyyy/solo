import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session

from app.models import (
    Student, AcademicRecord, Discipline, Thesis,
    GraduationRule, RuleSnapshot, PreReview, MissingItem,
    ReviewAction, HistoryRecord, PreReviewStatus,
    RuleCategory, DisciplineLevel, ThesisStatus,
    TaskStatus, BatchTask, BatchSubtask
)


class PreReviewEngine:
    ERROR_CODES = {
        "CREDITS_TOTAL": "CREDITS_TOTAL",
        "CREDITS_REQUIRED": "CREDITS_REQUIRED",
        "CREDITS_ELECTIVE": "CREDITS_ELECTIVE",
        "CREDITS_GPA": "CREDITS_GPA",
        "CREDITS_FAILED": "CREDITS_FAILED",
        "DISCIPLINE_ACTIVE": "DISCIPLINE_ACTIVE",
        "DISCIPLINE_SEVERE": "DISCIPLINE_SEVERE",
        "THESIS_NOT_SUBMITTED": "THESIS_NOT_SUBMITTED",
        "THESIS_FAILED": "THESIS_FAILED",
        "THESIS_NO_SCORE": "THESIS_NO_SCORE",
    }

    def __init__(self, db: Session):
        self.db = db

    def create_rule_snapshot(self, description: str = None) -> RuleSnapshot:
        active_rules = self.db.query(GraduationRule).filter(
            GraduationRule.is_active == True
        ).order_by(GraduationRule.priority.desc()).all()
        
        rules_data = []
        for rule in active_rules:
            rules_data.append({
                "id": rule.id,
                "name": rule.name,
                "category": rule.category,
                "conditions": rule.conditions_json,
                "description": rule.description,
                "priority": rule.priority,
            })
        
        rules_json_str = json.dumps(rules_data, sort_keys=True, ensure_ascii=False)
        snapshot_hash = hashlib.sha256(rules_json_str.encode('utf-8')).hexdigest()
        
        existing_snapshot = self.db.query(RuleSnapshot).filter(
            RuleSnapshot.snapshot_hash == snapshot_hash
        ).first()
        
        if existing_snapshot:
            return existing_snapshot
        
        snapshot = RuleSnapshot(
            snapshot_hash=snapshot_hash,
            rules_json=rules_data,
            description=description or f"规则快照 {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot

    def check_credits(
        self, 
        student: Student, 
        academic_record: Optional[AcademicRecord],
        rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        missing_items = []
        
        if not academic_record:
            missing_items.append({
                "rule_category": RuleCategory.CREDITS.value,
                "rule_name": "学分要求检查",
                "error_code": "CREDITS_NO_RECORD",
                "message": "未找到学生的学业记录",
                "current_value": None,
                "required_value": {"message": "需要有效的学业记录"},
                "suggestion": "请先录入学生的学分信息"
            })
            return missing_items
        
        credit_rules = [r for r in rules if r["category"] == RuleCategory.CREDITS.value]
        
        for rule in credit_rules:
            conditions = rule["conditions"]
            
            if "total_credits_min" in conditions:
                if academic_record.total_credits < conditions["total_credits_min"]:
                    missing_items.append({
                        "rule_category": RuleCategory.CREDITS.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["CREDITS_TOTAL"],
                        "message": "总学分未达到要求",
                        "current_value": academic_record.total_credits,
                        "required_value": {
                            "requirement": f"总学分 >= {conditions['total_credits_min']}",
                            "min": conditions['total_credits_min']
                        },
                        "suggestion": f"还需修满 {conditions['total_credits_min'] - academic_record.total_credits} 学分"
                    })
            
            if "required_credits_min" in conditions:
                if academic_record.required_credits_earned < conditions["required_credits_min"]:
                    missing_items.append({
                        "rule_category": RuleCategory.CREDITS.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["CREDITS_REQUIRED"],
                        "message": "必修学分未达到要求",
                        "current_value": academic_record.required_credits_earned,
                        "required_value": {
                            "requirement": f"必修学分 >= {conditions['required_credits_min']}",
                            "min": conditions['required_credits_min']
                        },
                        "suggestion": f"还需修满 {conditions['required_credits_min'] - academic_record.required_credits_earned} 必修学分"
                    })
            
            if "elective_credits_min" in conditions:
                if academic_record.elective_credits_earned < conditions["elective_credits_min"]:
                    missing_items.append({
                        "rule_category": RuleCategory.CREDITS.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["CREDITS_ELECTIVE"],
                        "message": "选修学分未达到要求",
                        "current_value": academic_record.elective_credits_earned,
                        "required_value": {
                            "requirement": f"选修学分 >= {conditions['elective_credits_min']}",
                            "min": conditions['elective_credits_min']
                        },
                        "suggestion": f"还需修满 {conditions['elective_credits_min'] - academic_record.elective_credits_earned} 选修学分"
                    })
            
            if "gpa_min" in conditions:
                if academic_record.gpa < conditions["gpa_min"]:
                    missing_items.append({
                        "rule_category": RuleCategory.CREDITS.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["CREDITS_GPA"],
                        "message": "GPA未达到要求",
                        "current_value": academic_record.gpa,
                        "required_value": {
                            "requirement": f"GPA >= {conditions['gpa_min']}",
                            "min": conditions['gpa_min']
                        },
                        "suggestion": f"当前GPA {academic_record.gpa}，需达到 {conditions['gpa_min']}"
                    })
            
            if "failed_courses_max" in conditions:
                if academic_record.failed_courses_count > conditions["failed_courses_max"]:
                    missing_items.append({
                        "rule_category": RuleCategory.CREDITS.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["CREDITS_FAILED"],
                        "message": "不及格课程数量超过限制",
                        "current_value": academic_record.failed_courses_count,
                        "required_value": {
                            "requirement": f"不及格课程 <= {conditions['failed_courses_max']}",
                            "max": conditions['failed_courses_max']
                        },
                        "suggestion": f"有 {academic_record.failed_courses_count} 门课程不及格，最多允许 {conditions['failed_courses_max']} 门"
                    })
        
        return missing_items

    def check_discipline(
        self,
        student: Student,
        disciplines: List[Discipline],
        rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        missing_items = []
        discipline_rules = [r for r in rules if r["category"] == RuleCategory.DISCIPLINE.value]
        
        for rule in discipline_rules:
            conditions = rule["conditions"]
            
            active_disciplines = [d for d in disciplines if not d.is_cleared]
            severe_disciplines = []
            for d in active_disciplines:
                if "disallow_levels" in conditions and d.level in conditions["disallow_levels"]:
                    severe_disciplines.append(d)
            
            if severe_disciplines:
                for d in severe_disciplines:
                    missing_items.append({
                        "rule_category": RuleCategory.DISCIPLINE.value,
                        "rule_name": rule["name"],
                        "error_code": self.ERROR_CODES["DISCIPLINE_ACTIVE"],
                        "message": "存在未撤销的处分记录",
                        "current_value": {
                            "level": d.level,
                            "description": d.description,
                            "occurred_at": d.occurred_at.isoformat() if d.occurred_at else None
                        },
                        "required_value": {
                            "requirement": "无未撤销的严重处分",
                            "disallowed_levels": conditions.get("disallow_levels", [])
                        },
                        "suggestion": f"处分等级: {d.level}，需撤销处分后才能毕业"
                    })
        
        return missing_items

    def check_thesis(
        self,
        student: Student,
        theses: List[Thesis],
        rules: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        missing_items = []
        thesis_rules = [r for r in rules if r["category"] == RuleCategory.THESIS.value]
        
        if not theses:
            for rule in thesis_rules:
                missing_items.append({
                    "rule_category": RuleCategory.THESIS.value,
                    "rule_name": rule["name"],
                    "error_code": self.ERROR_CODES["THESIS_NOT_SUBMITTED"],
                    "message": "未提交毕业论文",
                    "current_value": None,
                    "required_value": {
                        "requirement": "需要提交并通过毕业论文"
                    },
                    "suggestion": "请尽快提交毕业论文"
                })
            return missing_items
        
        latest_thesis = max(theses, key=lambda t: t.updated_at)
        
        for rule in thesis_rules:
            conditions = rule["conditions"]
            
            if latest_thesis.status == ThesisStatus.NOT_SUBMITTED.value:
                missing_items.append({
                    "rule_category": RuleCategory.THESIS.value,
                    "rule_name": rule["name"],
                    "error_code": self.ERROR_CODES["THESIS_NOT_SUBMITTED"],
                    "message": "毕业论文未提交",
                    "current_value": latest_thesis.status,
                    "required_value": {
                        "requirement": "论文状态需为已提交"
                    },
                    "suggestion": "请提交毕业论文"
                })
            elif latest_thesis.status == ThesisStatus.FAILED.value:
                missing_items.append({
                    "rule_category": RuleCategory.THESIS.value,
                    "rule_name": rule["name"],
                    "error_code": self.ERROR_CODES["THESIS_FAILED"],
                    "message": "毕业论文未通过",
                    "current_value": latest_thesis.status,
                    "required_value": {
                        "requirement": "论文需通过"
                    },
                    "suggestion": "请修改论文并重新提交"
                })
            elif conditions.get("require_score", True) and latest_thesis.status != ThesisStatus.PASSED.value:
                    if conditions.get("min_score"):
                        if latest_thesis.score is None:
                            missing_items.append({
                                "rule_category": RuleCategory.THESIS.value,
                                "rule_name": rule["name"],
                                "error_code": self.ERROR_CODES["THESIS_NO_SCORE"],
                                "message": "毕业论文尚未评分",
                                "current_value": latest_thesis.status,
                                "required_value": {
                                    "requirement": f"论文需有评分 >= {conditions['min_score']}"
                                },
                                "suggestion": "等待论文评分"
                            })
                        elif latest_thesis.score < conditions["min_score"]:
                            missing_items.append({
                                "rule_category": RuleCategory.THESIS.value,
                                "rule_name": rule["name"],
                                "error_code": self.ERROR_CODES["THESIS_FAILED"],
                                "message": "毕业论文分数未达到要求",
                                "current_value": latest_thesis.score,
                                "required_value": {
                                    "requirement": f"分数 >= {conditions['min_score']}"
                                },
                                "suggestion": f"当前分数 {latest_thesis.score}，需达到 {conditions['min_score']}"
                            })
        
        return missing_items

    def calculate_pre_review(
        self,
        student_id: int,
        force_recalculate: bool = False,
        operator: str = "system"
    ) -> Tuple[PreReview, List[MissingItem]]:
        student = self.db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise ValueError(f"未找到学生 ID: {student_id}")
        
        existing_review = self.db.query(PreReview).filter(
            PreReview.student_id == student_id
        ).order_by(PreReview.created_at.desc()).first()
        
        if existing_review and not force_recalculate:
            if existing_review.status in [
                PreReviewStatus.MANUALLY_APPROVED.value, 
                PreReviewStatus.MANUALLY_REJECTED.value
            ]:
                return existing_review, list(existing_review.missing_items)
        
        snapshot = self.create_rule_snapshot()
        rules = snapshot.rules_json
        
        academic_record = self.db.query(AcademicRecord).filter(
            AcademicRecord.student_id == student_id
        ).first()
        
        disciplines = self.db.query(Discipline).filter(
            Discipline.student_id == student_id
        ).all()
        
        theses = self.db.query(Thesis).filter(
            Thesis.student_id == student_id
        ).all()
        
        all_missing = []
        all_missing.extend(self.check_credits(student, academic_record, rules))
        all_missing.extend(self.check_discipline(student, disciplines, rules))
        all_missing.extend(self.check_thesis(student, theses, rules))
        
        if existing_review:
            old_status = existing_review.status
            old_is_eligible = existing_review.is_eligible
            old_missing_count = len([i for i in existing_review.missing_items if not i.is_resolved]) if existing_review.missing_items else 0
            
            existing_review.status = PreReviewStatus.CALCULATING.value
            existing_review.rule_snapshot_id = snapshot.id
            
            for item in existing_review.missing_items:
                self.db.delete(item)
            
            new_missing_items = []
            for item_data in all_missing:
                new_item = MissingItem(**item_data)
                new_item.pre_review_id = existing_review.id
                new_missing_items.append(new_item)
            
            is_eligible = len(all_missing) == 0
            existing_review.is_eligible = is_eligible
            existing_review.status = (
                PreReviewStatus.ELIGIBLE.value if is_eligible 
                else PreReviewStatus.INELIGIBLE.value
            )
            existing_review.calculated_at = datetime.utcnow()
            
            if old_status != existing_review.status:
                review_action = ReviewAction(
                    pre_review_id=existing_review.id,
                    action_type="AUTO_RECALCULATE",
                    previous_status=old_status,
                    new_status=existing_review.status,
                    reason=f"自动重算: 状态从 {old_status} 变为 {existing_review.status}",
                    operator=operator
                )
                self.db.add(review_action)
            
            history = HistoryRecord(
                student_id=student_id,
                record_type="PRE_REVIEW_STATUS_CHANGE",
                before_data={
                    "status": old_status,
                    "is_eligible": old_is_eligible,
                    "missing_count": old_missing_count
                },
                after_data={
                    "status": existing_review.status,
                    "is_eligible": existing_review.is_eligible,
                    "missing_count": len(all_missing)
                },
                change_reason="自动重算预审结果",
                operator=operator
            )
            self.db.add(history)
            
            for item in new_missing_items:
                self.db.add(item)
            
            self.db.commit()
            self.db.refresh(existing_review)
            
            return existing_review, new_missing_items
        
        else:
            pre_review = PreReview(
                student_id=student_id,
                rule_snapshot_id=snapshot.id,
                status=PreReviewStatus.CALCULATING.value,
                calculated_at=datetime.utcnow()
            )
            self.db.add(pre_review)
            self.db.flush()
            
            missing_items = []
            for item_data in all_missing:
                item = MissingItem(**item_data)
                item.pre_review_id = pre_review.id
                missing_items.append(item)
                self.db.add(item)
            
            is_eligible = len(all_missing) == 0
            pre_review.is_eligible = is_eligible
            pre_review.status = (
                PreReviewStatus.ELIGIBLE.value if is_eligible 
                else PreReviewStatus.INELIGIBLE.value
            )
            
            review_action = ReviewAction(
                pre_review_id=pre_review.id,
                action_type="INITIAL_CALCULATION",
                previous_status=None,
                new_status=pre_review.status,
                reason="初次计算预审结果",
                operator=operator
            )
            self.db.add(review_action)
            
            history = HistoryRecord(
                student_id=student_id,
                record_type="PRE_REVIEW_INITIAL",
                before_data=None,
                after_data={
                    "status": pre_review.status,
                    "is_eligible": pre_review.is_eligible,
                    "missing_count": len(all_missing)
                },
                change_reason="初次预审结果初始化",
                operator=operator
            )
            self.db.add(history)
            
            self.db.commit()
            self.db.refresh(pre_review)
            
            return pre_review, missing_items

    def manual_review(
        self,
        pre_review_id: int,
        new_status: PreReviewStatus,
        reason: str,
        operator: str
    ) -> PreReview:
        pre_review = self.db.query(PreReview).filter(PreReview.id == pre_review_id).first()
        if not pre_review:
            raise ValueError(f"未找到预审记录 ID: {pre_review_id}")
        
        old_status = pre_review.status
        old_is_eligible = pre_review.is_eligible
        
        pre_review.status = new_status
        pre_review.is_eligible = new_status == PreReviewStatus.MANUALLY_APPROVED.value
        
        review_action = ReviewAction(
            pre_review_id=pre_review.id,
            action_type="MANUAL_REVIEW",
            previous_status=old_status,
            new_status=new_status,
            reason=reason,
            operator=operator
        )
        self.db.add(review_action)
        
        history = HistoryRecord(
            student_id=pre_review.student_id,
            record_type="PRE_REVIEW_MANUAL_CHANGE",
            before_data={
                "status": old_status,
                "is_eligible": old_is_eligible
            },
            after_data={
                "status": new_status,
                "is_eligible": pre_review.is_eligible
            },
            change_reason=reason,
            operator=operator
        )
        self.db.add(history)
        
        self.db.commit()
        self.db.refresh(pre_review)
        
        return pre_review

    def generate_report_summary(self) -> Dict[str, Any]:
        from sqlalchemy import func, text
        
        total_students = self.db.query(func.count(Student.id)).scalar() or 0
        
        status_counts = self.db.query(
            PreReview.status,
            func.count(PreReview.id)
        ).group_by(PreReview.status).all()
        
        status_map = {s.value: 0 for s in PreReviewStatus}
        for status, count in status_counts:
            if status in status_map:
                status_map[status] = count
        
        category_counts = self.db.query(
            MissingItem.rule_category,
            func.count(MissingItem.id)
        ).join(PreReview, MissingItem.pre_review_id == PreReview.id).filter(
            MissingItem.is_resolved == False
        ).group_by(MissingItem.rule_category).all()
        
        missing_by_category = {c.value: 0 for c in RuleCategory}
        for category, count in category_counts:
            if category in missing_by_category:
                missing_by_category[category] = count
        
        top_missing = self.db.query(
            MissingItem.error_code,
            MissingItem.message,
            MissingItem.rule_category,
            func.count(MissingItem.id).label('count')
        ).join(PreReview, MissingItem.pre_review_id == PreReview.id).filter(
            MissingItem.is_resolved == False
        ).group_by(
            MissingItem.error_code,
            MissingItem.message,
            MissingItem.rule_category
        ).order_by(text('count DESC')).limit(10).all()
        
        top_items = [
            {
                "error_code": code,
                "message": msg,
                "category": cat,
                "count": cnt
            }
            for code, msg, cat, cnt in top_missing
        ]
        
        return {
            "total_students": total_students,
            "eligible_count": status_map.get(PreReviewStatus.ELIGIBLE.value, 0),
            "ineligible_count": status_map.get(PreReviewStatus.INELIGIBLE.value, 0),
            "pending_count": status_map.get(PreReviewStatus.PENDING.value, 0),
            "manually_approved_count": status_map.get(PreReviewStatus.MANUALLY_APPROVED.value, 0),
            "manually_rejected_count": status_map.get(PreReviewStatus.MANUALLY_REJECTED.value, 0),
            "missing_items_by_category": missing_by_category,
            "top_missing_items": top_items
        }
