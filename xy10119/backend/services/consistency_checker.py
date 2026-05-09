from typing import List, Dict, Optional, Tuple
from collections import Counter
from sqlalchemy.orm import Session
from datetime import datetime
from backend.database import Sample, Annotation, Conflict


class ConsistencyChecker:
    def __init__(self, db: Session):
        self.db = db
    
    def check_sample_consistency(self, sample: Sample) -> Tuple[bool, Optional[Dict]]:
        annotations = [a for a in sample.annotations if a.is_active]
        
        if len(annotations) < 2:
            return True, None
        
        labels = [a.label for a in annotations]
        label_counts = Counter(labels)
        
        if len(label_counts) == 1:
            return True, None
        
        majority_label = max(label_counts, key=label_counts.get)
        majority_count = label_counts[majority_label]
        total_count = sum(label_counts.values())
        agreement_ratio = majority_count / total_count
        
        severity = "high" if agreement_ratio < 0.5 else ("medium" if agreement_ratio < 0.7 else "low")
        
        conflict_info = {
            "majority_label": majority_label,
            "majority_count": majority_count,
            "conflicting_labels": list(label_counts.keys()),
            "label_distribution": dict(label_counts),
            "agreement_ratio": agreement_ratio,
            "severity": severity
        }
        
        return False, conflict_info
    
    def detect_conflicts(self, project_id: int) -> List[Dict]:
        samples = self.db.query(Sample).filter(Sample.project_id == project_id).all()
        conflicts = []
        
        for sample in samples:
            is_consistent, info = self.check_sample_consistency(sample)
            
            if not is_consistent:
                existing_conflict = (
                    self.db.query(Conflict)
                    .filter(
                        Conflict.sample_id == sample.id,
                        Conflict.status == "pending"
                    )
                    .first()
                )
                
                if existing_conflict:
                    existing_conflict.severity = info["severity"]
                    self.db.commit()
                    conflicts.append({
                        "sample_id": sample.id,
                        "conflict_id": existing_conflict.id,
                        "details": info
                    })
                else:
                    new_conflict = Conflict(
                        sample_id=sample.id,
                        status="pending",
                        severity=info["severity"],
                        detection_method="rule_based"
                    )
                    self.db.add(new_conflict)
                    self.db.commit()
                    self.db.refresh(new_conflict)
                    conflicts.append({
                        "sample_id": sample.id,
                        "conflict_id": new_conflict.id,
                        "details": info
                    })
        
        return conflicts
    
    def calculate_annotator_consistency(self, project_id: int) -> Dict[str, float]:
        samples = self.db.query(Sample).filter(Sample.project_id == project_id).all()
        
        annotator_pairs = {}
        
        for sample in samples:
            annotations = [a for a in sample.annotations if a.is_active]
            annotators = sorted([a.annotator for a in annotations])
            
            for i, ann1 in enumerate(annotations):
                for j, ann2 in enumerate(annotations[i+1:], i+1):
                    pair = (ann1.annotator, ann2.annotator)
                    pair_key = tuple(sorted(pair))
                    
                    if pair_key not in annotator_pairs:
                        annotator_pairs[pair_key] = {"agreements": 0, "total": 0}
                    
                    annotator_pairs[pair_key]["total"] += 1
                    if ann1.label == ann2.label:
                        annotator_pairs[pair_key]["agreements"] += 1
        
        consistency_scores = {}
        for (a1, a2), stats in annotator_pairs.items():
            if stats["total"] > 0:
                score = stats["agreements"] / stats["total"]
                key = f"{a1} <-> {a2}"
                consistency_scores[key] = score
        
        return consistency_scores
    
    def get_majority_vote(self, sample_id: int) -> Optional[str]:
        sample = self.db.query(Sample).filter(Sample.id == sample_id).first()
        if not sample:
            return None
        
        annotations = [a for a in sample.annotations if a.is_active]
        if not annotations:
            return None
        
        labels = [a.label for a in annotations]
        label_counts = Counter(labels)
        return max(label_counts, key=label_counts.get)


class ConfidenceBasedChecker(ConsistencyChecker):
    def check_sample_consistency(self, sample: Sample) -> Tuple[bool, Optional[Dict]]:
        annotations = [a for a in sample.annotations if a.is_active]
        
        if len(annotations) < 2:
            return True, None
        
        weighted_labels = {}
        for ann in annotations:
            if ann.label not in weighted_labels:
                weighted_labels[ann.label] = 0
            weighted_labels[ann.label] += ann.confidence
        
        if len(weighted_labels) == 1:
            return True, None
        
        majority_label = max(weighted_labels, key=weighted_labels.get)
        total_weight = sum(weighted_labels.values())
        agreement_ratio = weighted_labels[majority_label] / total_weight
        
        severity = "high" if agreement_ratio < 0.5 else ("medium" if agreement_ratio < 0.7 else "low")
        
        conflict_info = {
            "majority_label": majority_label,
            "weighted_majority_count": weighted_labels[majority_label],
            "conflicting_labels": list(weighted_labels.keys()),
            "label_distribution": weighted_labels,
            "agreement_ratio": agreement_ratio,
            "severity": severity,
            "detection_type": "confidence_weighted"
        }
        
        return False, conflict_info


def get_consistency_checker(db: Session, method: str = "rule_based") -> ConsistencyChecker:
    if method == "confidence_weighted":
        return ConfidenceBasedChecker(db)
    return ConsistencyChecker(db)
