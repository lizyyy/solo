from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import Database, ScoringRecord, ReviewHistory, ErrorQuestion
from .scoring import EquivalentScorer

class ScoringManager:
    def __init__(self, db_path: str = None):
        self.db = Database(db_path)
        self.scorer = EquivalentScorer()
    
    def import_questions(self, questions_data: List[Dict]) -> int:
        count = 0
        for data in questions_data:
            eq = ErrorQuestion(
                question_id=data.get("question_id", ""),
                question_text=data.get("question_text", ""),
                standard_answer=data.get("standard_answer", ""),
                student_answer=data.get("student_answer", ""),
                student_id=data.get("student_id", ""),
                score=data.get("score", 0.0),
                max_score=data.get("max_score", 1.0),
                is_empty=data.get("is_empty", False)
            )
            self.db.add_error_question(eq)
            count += 1
        return count
    
    def run_scoring(self, question_id: str = None) -> Tuple[int, int]:
        questions = self.db.get_all_error_questions()
        if question_id:
            questions = [q for q in questions if q.question_id == question_id]
        
        total = 0
        controversial = 0
        
        for q in questions:
            result = self.scorer.score(
                standard_answer=q.standard_answer,
                student_answer=q.student_answer,
                question_id=q.question_id,
                student_id=q.student_id
            )
            
            record = ScoringRecord(
                question_id=result["question_id"],
                student_id=result["student_id"],
                standard_answer=result["standard_answer"],
                student_answer=result["student_answer"],
                similarity_score=result["similarity_score"],
                is_equivalent=result["is_equivalent"],
                threshold=result["threshold"],
                scoring_reason=result["scoring_reason"],
                is_controversial=result["is_controversial"],
                controversial_reason=result["controversial_reason"],
                reviewed=False
            )
            self.db.add_scoring_record(record)
            
            total += 1
            if result["is_controversial"]:
                controversial += 1
        
        return total, controversial
    
    def review_record(self, record_id: int, reviewer: str, 
                      is_equivalent: bool, final_score: float,
                      reason: str = "") -> ScoringRecord:
        record = self.db.get_scoring_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        history = ReviewHistory(
            record_id=record_id,
            reviewer=reviewer,
            action="manual_review",
            previous_equivalent=record.is_equivalent,
            new_equivalent=is_equivalent,
            previous_score=record.final_score,
            new_score=final_score,
            reason=reason
        )
        self.db.add_review_history(history)
        
        record.is_equivalent = is_equivalent
        record.final_score = final_score
        record.reviewer = reviewer
        record.reviewed = True
        record.reviewed_at = datetime.now().isoformat()
        record.controversial_reason = f"{record.controversial_reason} | 复核结论: {reason}" if record.controversial_reason else reason
        
        self.db.update_scoring_record(record)
        return record
    
    def batch_review(self, record_ids: List[int], reviewer: str,
                     is_equivalent: bool, final_score: float,
                     reason: str = "") -> int:
        count = 0
        for rid in record_ids:
            try:
                self.review_record(rid, reviewer, is_equivalent, final_score, reason)
                count += 1
            except ValueError:
                continue
        return count
    
    def mark_controversial(self, record_id: int, reason: str = "") -> ScoringRecord:
        record = self.db.get_scoring_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        record.is_controversial = True
        if reason:
            record.controversial_reason = reason
        
        self.db.update_scoring_record(record)
        return record
    
    def get_records(self, question_id: str = None, student_id: str = None,
                   reviewed: bool = None, controversial: bool = None) -> List[ScoringRecord]:
        return self.db.get_scoring_records(
            question_id=question_id,
            student_id=student_id,
            reviewed=reviewed,
            controversial=controversial
        )
    
    def get_record_history(self, record_id: int) -> List[ReviewHistory]:
        return self.db.get_review_history(record_id=record_id)
    
    def get_all_history(self) -> List[ReviewHistory]:
        return self.db.get_review_history()
    
    def get_statistics(self) -> Dict:
        all_records = self.db.get_scoring_records()
        reviewed_records = self.db.get_scoring_records(reviewed=True)
        controversial_records = self.db.get_scoring_records(controversial=True)
        
        equivalent_count = sum(1 for r in all_records if r.is_equivalent)
        non_equivalent_count = sum(1 for r in all_records if not r.is_equivalent)
        
        avg_similarity = 0.0
        if all_records:
            avg_similarity = sum(r.similarity_score for r in all_records) / len(all_records)
        
        questions = set(r.question_id for r in all_records)
        students = set(r.student_id for r in all_records)
        
        return {
            "total_records": len(all_records),
            "reviewed_count": len(reviewed_records),
            "unreviewed_count": len(all_records) - len(reviewed_records),
            "controversial_count": len(controversial_records),
            "equivalent_count": equivalent_count,
            "non_equivalent_count": non_equivalent_count,
            "average_similarity": round(avg_similarity, 4),
            "unique_questions": len(questions),
            "unique_students": len(students)
        }
    
    def get_controversial_details(self) -> List[Dict]:
        records = self.db.get_scoring_records(controversial=True)
        details = []
        for r in records:
            history = self.get_record_history(r.id)
            details.append({
                "record_id": r.id,
                "question_id": r.question_id,
                "student_id": r.student_id,
                "similarity": r.similarity_score,
                "is_equivalent": r.is_equivalent,
                "reviewed": r.reviewed,
                "controversial_reason": r.controversial_reason,
                "review_count": len(history),
                "standard_answer": r.standard_answer,
                "student_answer": r.student_answer
            })
        return details
    
    def rescore_record(self, record_id: int, threshold: float = None) -> ScoringRecord:
        record = self.db.get_scoring_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")
        
        original_threshold = self.scorer.threshold
        if threshold:
            self.scorer.threshold = threshold
        
        result = self.scorer.score(
            standard_answer=record.standard_answer,
            student_answer=record.student_answer,
            question_id=record.question_id,
            student_id=record.student_id
        )
        
        self.scorer.threshold = original_threshold
        
        history = ReviewHistory(
            record_id=record_id,
            reviewer="system",
            action="rescore",
            previous_equivalent=record.is_equivalent,
            new_equivalent=result["is_equivalent"],
            previous_score=record.final_score,
            new_score=None,
            reason=f"重新判分，阈值={threshold or original_threshold}"
        )
        self.db.add_review_history(history)
        
        record.similarity_score = result["similarity_score"]
        record.is_equivalent = result["is_equivalent"]
        record.threshold = result["threshold"]
        record.scoring_reason = result["scoring_reason"]
        record.is_controversial = result["is_controversial"]
        record.controversial_reason = result["controversial_reason"]
        
        self.db.update_scoring_record(record)
        return record
    
    def clear_all_data(self):
        self.db.clear_all()
