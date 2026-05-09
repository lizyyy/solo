from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from collections import Counter
from backend.database import (
    Conflict, Annotation, Sample, ReviewDecision, Project
)
from backend.schemas import ReviewDecisionCreate


class ReviewService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_pending_conflicts(self, project_id: int, severity: Optional[str] = None) -> List[Dict]:
        query = (
            self.db.query(Conflict)
            .join(Sample)
            .filter(Sample.project_id == project_id, Conflict.status == "pending")
        )
        
        if severity:
            query = query.filter(Conflict.severity == severity)
        
        conflicts = query.order_by(Conflict.created_at).all()
        
        result = []
        for conflict in conflicts:
            annotations = [a for a in conflict.sample.annotations if a.is_active]
            labels = [a.label for a in annotations]
            label_counts = Counter(labels)
            majority_label = max(label_counts, key=label_counts.get) if labels else None
            
            result.append({
                "conflict": conflict,
                "annotations": annotations,
                "majority_label": majority_label,
                "conflicting_labels": list(label_counts.keys()),
                "label_distribution": dict(label_counts)
            })
        
        return result
    
    def make_decision(
        self,
        conflict_id: int,
        decision_data: ReviewDecisionCreate
    ) -> Dict[str, Any]:
        conflict = self.db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            raise ValueError(f"Conflict {conflict_id} not found")
        
        if conflict.status != "pending":
            raise ValueError(f"Conflict {conflict_id} is already resolved")
        
        for existing_decision in conflict.review_decisions:
            existing_decision.is_final = False
        
        review_decision = ReviewDecision(
            conflict_id=conflict_id,
            annotation_id=decision_data.annotation_id,
            reviewer=decision_data.reviewer,
            decision=decision_data.decision,
            reasoning=decision_data.reasoning,
            is_final=True
        )
        self.db.add(review_decision)
        
        if decision_data.decision == "accept_annotation" and decision_data.annotation_id:
            selected_ann = (
                self.db.query(Annotation).filter(Annotation.id == decision_data.annotation_id).first()
            )
            if selected_ann:
                for ann in conflict.sample.annotations:
                    if ann.id != decision_data.annotation_id and ann.is_active:
                        ann.is_active = False
        
        elif decision_data.decision == "accept_majority":
            annotations = [a for a in conflict.sample.annotations if a.is_active]
            labels = [a.label for a in annotations]
            label_counts = Counter(labels)
            majority_label = max(label_counts, key=label_counts.get)
            
            for ann in annotations:
                if ann.label != majority_label:
                    ann.is_active = False
        
        elif decision_data.decision == "mark_invalid":
            for ann in conflict.sample.annotations:
                ann.is_active = False
        
        elif decision_data.decision == "reopen_for_reannotation":
            pass
        
        conflict.status = "resolved"
        conflict.resolved_at = datetime.utcnow()
        conflict.resolved_by = decision_data.reviewer
        conflict.resolution_notes = decision_data.reasoning
        
        self.db.commit()
        self.db.refresh(review_decision)
        
        return {
            "conflict_id": conflict_id,
            "decision": decision_data.decision,
            "reviewer": decision_data.reviewer,
            "resolved": True,
            "review_decision_id": review_decision.id
        }
    
    def revert_decision(self, conflict_id: int, reviewer: str) -> Dict[str, Any]:
        conflict = self.db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            raise ValueError(f"Conflict {conflict_id} not found")
        
        if conflict.status != "resolved":
            raise ValueError(f"Conflict {conflict_id} is not resolved")
        
        latest_decision = None
        for decision in conflict.review_decisions:
            if decision.is_final:
                latest_decision = decision
                decision.is_final = False
                break
        
        for ann in conflict.sample.annotations:
            ann.is_active = True
        
        conflict.status = "pending"
        conflict.resolved_at = None
        conflict.resolved_by = None
        conflict.resolution_notes = None
        
        revert_decision = ReviewDecision(
            conflict_id=conflict_id,
            reviewer=reviewer,
            decision="reverted",
            reasoning=f"Reverted previous decision by {latest_decision.reviewer if latest_decision else 'unknown'}",
            is_final=True
        )
        self.db.add(revert_decision)
        
        self.db.commit()
        
        return {
            "conflict_id": conflict_id,
            "status": "pending",
            "reverted_by": reviewer
        }
    
    def get_decision_history(self, conflict_id: int) -> List[Dict]:
        conflict = self.db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            raise ValueError(f"Conflict {conflict_id} not found")
        
        decisions = sorted(conflict.review_decisions, key=lambda d: d.created_at)
        
        return [
            {
                "id": d.id,
                "reviewer": d.reviewer,
                "decision": d.decision,
                "reasoning": d.reasoning,
                "is_final": d.is_final,
                "created_at": d.created_at
            }
            for d in decisions
        ]
    
    def batch_decide(
        self,
        conflict_ids: List[int],
        decision: str,
        reviewer: str,
        reasoning: str
    ) -> Dict[str, Any]:
        results = {"successful": [], "failed": []}
        
        for conflict_id in conflict_ids:
            try:
                result = self.make_decision(
                    conflict_id,
                    ReviewDecisionCreate(
                        reviewer=reviewer,
                        decision=decision,
                        reasoning=reasoning
                    )
                )
                results["successful"].append(result)
            except Exception as e:
                results["failed"].append({
                    "conflict_id": conflict_id,
                    "error": str(e)
                })
        
        return results
    
    def get_sample_history(self, sample_id: int) -> Dict[str, Any]:
        sample = self.db.query(Sample).filter(Sample.id == sample_id).first()
        if not sample:
            raise ValueError(f"Sample {sample_id} not found")
        
        annotations = [
            {
                "id": a.id,
                "annotator": a.annotator,
                "label": a.label,
                "confidence": a.confidence,
                "reasoning": a.reasoning,
                "is_active": a.is_active,
                "created_at": a.created_at
            }
            for a in sample.annotations
        ]
        
        conflicts = []
        for conflict in sample.conflicts:
            conflicts.append({
                "id": conflict.id,
                "status": conflict.status,
                "severity": conflict.severity,
                "detection_method": conflict.detection_method,
                "created_at": conflict.created_at,
                "resolved_at": conflict.resolved_at,
                "resolved_by": conflict.resolved_by,
                "resolution_notes": conflict.resolution_notes,
                "decisions": [
                    {
                        "reviewer": d.reviewer,
                        "decision": d.decision,
                        "reasoning": d.reasoning,
                        "created_at": d.created_at
                    }
                    for d in conflict.review_decisions
                ]
            })
        
        return {
            "sample_id": sample_id,
            "content": sample.content,
            "annotations": annotations,
            "conflicts": conflicts
        }
