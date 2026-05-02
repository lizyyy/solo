"""
检测规则模块
负责识别新工单中的：
1. 可能属于旧簇的工单
2. 疑似全新问题
3. 同一用户重复投诉
4. 处理结论前后矛盾的记录
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Set, Tuple
from dataclasses import dataclass, field
from enum import Enum

from .config import Config
from .csv_parser import ParsedTicket, load_all_tickets
from .text_features import TextProcessor, TextFeatures, compute_cosine_similarity
from .clustering import Cluster, ClusteringResult, TicketClusterer, build_features_map
from .feedback_store import FeedbackStore, get_feedback_store


class DetectionType(Enum):
    OLD_CLUSTER = "old_cluster"
    NEW_ISSUE = "new_issue"
    DUPLICATE_USER = "duplicate_user"
    CONFLICTING_CONCLUSION = "conflicting_conclusion"


@dataclass
class DetectionResult:
    ticket_id: str
    detection_type: DetectionType
    confidence: float
    details: Dict[str, Any] = field(default_factory=dict)
    detected_at: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "ticket_id": self.ticket_id,
            "detection_type": self.detection_type.value,
            "confidence": self.confidence,
            "details": self.details,
            "detected_at": self.detected_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DetectionResult':
        return cls(
            ticket_id=data["ticket_id"],
            detection_type=DetectionType(data["detection_type"]),
            confidence=data["confidence"],
            details=data.get("details", {}),
            detected_at=datetime.fromisoformat(data["detected_at"])
        )


@dataclass
class DetectionReport:
    import_id: str
    results: List[DetectionResult] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    
    @property
    def old_cluster_count(self) -> int:
        return len([r for r in self.results if r.detection_type == DetectionType.OLD_CLUSTER])
    
    @property
    def new_issue_count(self) -> int:
        return len([r for r in self.results if r.detection_type == DetectionType.NEW_ISSUE])
    
    @property
    def duplicate_user_count(self) -> int:
        return len([r for r in self.results if r.detection_type == DetectionType.DUPLICATE_USER])
    
    @property
    def conflicting_count(self) -> int:
        return len([r for r in self.results if r.detection_type == DetectionType.CONFLICTING_CONCLUSION])
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "import_id": self.import_id,
            "results": [r.to_dict() for r in self.results],
            "generated_at": self.generated_at.isoformat(),
            "summary": {
                "total": len(self.results),
                "old_cluster": self.old_cluster_count,
                "new_issue": self.new_issue_count,
                "duplicate_user": self.duplicate_user_count,
                "conflicting_conclusion": self.conflicting_count
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DetectionReport':
        return cls(
            import_id=data["import_id"],
            results=[DetectionResult.from_dict(r) for r in data.get("results", [])],
            generated_at=datetime.fromisoformat(data["generated_at"])
        )


class TicketDetector:
    def __init__(self, config: Config):
        self.config = config
        self.similarity_threshold = config.similarity_threshold
        self.feedback_store: Optional[FeedbackStore] = None
        self._load_feedback()
    
    def _load_feedback(self):
        try:
            self.feedback_store = get_feedback_store(self.config)
        except Exception:
            self.feedback_store = None
    
    def detect(
        self,
        new_tickets: List[ParsedTicket],
        new_features_list: List[TextFeatures],
        existing_clusters: ClusteringResult,
        existing_features_map: Dict[str, TextFeatures],
        existing_tickets_map: Dict[str, ParsedTicket],
        import_id: str
    ) -> DetectionReport:
        report = DetectionReport(import_id=import_id)
        
        new_ticket_map = {t.ticket_id: t for t in new_tickets}
        new_features_map = {f.ticket_id: f for f in new_features_list}
        
        for ticket, features in zip(new_tickets, new_features_list):
            if self.feedback_store:
                override = self.feedback_store.get_override(ticket.ticket_id)
                if override and (override.is_ignored or override.is_false_positive):
                    continue
            
            old_cluster_result = self._detect_old_cluster(
                ticket, features, existing_clusters, existing_features_map
            )
            if old_cluster_result:
                report.results.append(old_cluster_result)
            
            new_issue_result = self._detect_new_issue(
                ticket, features, existing_clusters, existing_features_map,
                old_cluster_result
            )
            if new_issue_result:
                report.results.append(new_issue_result)
            
            duplicate_result = self._detect_duplicate_user(
                ticket, new_ticket_map, new_features_map,
                existing_tickets_map, existing_features_map
            )
            if duplicate_result:
                report.results.append(duplicate_result)
            
            conflict_result = self._detect_conflicting_conclusion(
                ticket, features, existing_clusters, existing_features_map, existing_tickets_map
            )
            if conflict_result:
                report.results.append(conflict_result)
        
        return report
    
    def _detect_old_cluster(
        self,
        ticket: ParsedTicket,
        features: TextFeatures,
        existing_clusters: ClusteringResult,
        existing_features_map: Dict[str, TextFeatures]
    ) -> Optional[DetectionResult]:
        if features.tfidf_vector is None:
            return None
        
        best_cluster: Optional[Cluster] = None
        best_similarity = 0.0
        best_ticket_id: Optional[str] = None
        
        for cluster in existing_clusters.clusters:
            if not cluster.ticket_ids:
                continue
            
            cluster_similarities = []
            cluster_best_ticket: Optional[str] = None
            cluster_best_sim = 0.0
            
            for ticket_id in cluster.ticket_ids[:10]:
                if ticket_id not in existing_features_map:
                    continue
                
                existing_features = existing_features_map[ticket_id]
                if existing_features.tfidf_vector is None:
                    continue
                
                sim = compute_cosine_similarity(features.tfidf_vector, existing_features.tfidf_vector)
                cluster_similarities.append(sim)
                
                if sim > cluster_best_sim:
                    cluster_best_sim = sim
                    cluster_best_ticket = ticket_id
            
            if cluster_similarities:
                avg_sim = sum(cluster_similarities) / len(cluster_similarities)
                if avg_sim > best_similarity:
                    best_similarity = avg_sim
                    best_cluster = cluster
                    best_ticket_id = cluster_best_ticket
        
        if best_cluster and best_similarity >= self.similarity_threshold:
            return DetectionResult(
                ticket_id=ticket.ticket_id,
                detection_type=DetectionType.OLD_CLUSTER,
                confidence=best_similarity,
                details={
                    "cluster_id": best_cluster.cluster_id,
                    "cluster_keywords": best_cluster.keywords,
                    "cluster_size": best_cluster.size,
                    "most_similar_ticket_id": best_ticket_id,
                    "similarity_score": best_similarity
                }
            )
        
        return None
    
    def _detect_new_issue(
        self,
        ticket: ParsedTicket,
        features: TextFeatures,
        existing_clusters: ClusteringResult,
        existing_features_map: Dict[str, TextFeatures],
        old_cluster_result: Optional[DetectionResult]
    ) -> Optional[DetectionResult]:
        if old_cluster_result:
            return None
        
        if features.tfidf_vector is None:
            return None
        
        max_similarity = 0.0
        
        for cluster in existing_clusters.clusters:
            if not cluster.ticket_ids:
                continue
            
            for ticket_id in cluster.ticket_ids[:5]:
                if ticket_id not in existing_features_map:
                    continue
                
                existing_features = existing_features_map[ticket_id]
                if existing_features.tfidf_vector is None:
                    continue
                
                sim = compute_cosine_similarity(features.tfidf_vector, existing_features.tfidf_vector)
                if sim > max_similarity:
                    max_similarity = sim
        
        if max_similarity < self.similarity_threshold * 0.7:
            return DetectionResult(
                ticket_id=ticket.ticket_id,
                detection_type=DetectionType.NEW_ISSUE,
                confidence=1.0 - max_similarity,
                details={
                    "max_similarity_to_existing": max_similarity,
                    "threshold": self.similarity_threshold * 0.7,
                    "description_preview": features.original_text[:100] if len(features.original_text) > 100 else features.original_text
                }
            )
        
        return None
    
    def _detect_duplicate_user(
        self,
        ticket: ParsedTicket,
        new_ticket_map: Dict[str, ParsedTicket],
        new_features_map: Dict[str, TextFeatures],
        existing_tickets_map: Dict[str, ParsedTicket],
        existing_features_map: Dict[str, TextFeatures]
    ) -> Optional[DetectionResult]:
        ticket_data = ticket.sanitized_data
        
        user_identifiers = []
        
        phone = ticket_data.get("手机号", "") or ticket_data.get("电话", "")
        if phone and len(str(phone)) >= 7:
            user_identifiers.append(("phone", str(phone)))
        
        email = ticket_data.get("邮箱", "")
        if email and "@" in str(email):
            user_identifiers.append(("email", str(email)))
        
        user_id = ticket_data.get("用户ID", "")
        if user_id and len(str(user_id)) >= 3:
            user_identifiers.append(("user_id", str(user_id)))
        
        if not user_identifiers:
            return None
        
        matching_tickets = []
        ticket_features = new_features_map.get(ticket.ticket_id)
        
        for other_ticket_id, other_ticket in new_ticket_map.items():
            if other_ticket_id == ticket.ticket_id:
                continue
            
            other_data = other_ticket.sanitized_data
            is_match = False
            
            for id_type, id_value in user_identifiers:
                if id_type == "phone":
                    other_phone = other_data.get("手机号", "") or other_data.get("电话", "")
                    if str(other_phone) == id_value:
                        is_match = True
                        break
                elif id_type == "email":
                    other_email = other_data.get("邮箱", "")
                    if str(other_email) == id_value:
                        is_match = True
                        break
                elif id_type == "user_id":
                    other_user_id = other_data.get("用户ID", "")
                    if str(other_user_id) == id_value:
                        is_match = True
                        break
            
            if is_match:
                other_features = new_features_map.get(other_ticket_id)
                text_similarity = 0.0
                if ticket_features and other_features and ticket_features.tfidf_vector is not None and other_features.tfidf_vector is not None:
                    text_similarity = compute_cosine_similarity(ticket_features.tfidf_vector, other_features.tfidf_vector)
                
                matching_tickets.append({
                    "ticket_id": other_ticket_id,
                    "source": "new_batch",
                    "text_similarity": text_similarity,
                    "time": other_data.get("时间", "")
                })
        
        for other_ticket_id, other_ticket in existing_tickets_map.items():
            other_data = other_ticket.sanitized_data
            is_match = False
            
            for id_type, id_value in user_identifiers:
                if id_type == "phone":
                    other_phone = other_data.get("手机号", "") or other_data.get("电话", "")
                    if str(other_phone) == id_value:
                        is_match = True
                        break
                elif id_type == "email":
                    other_email = other_data.get("邮箱", "")
                    if str(other_email) == id_value:
                        is_match = True
                        break
                elif id_type == "user_id":
                    other_user_id = other_data.get("用户ID", "")
                    if str(other_user_id) == id_value:
                        is_match = True
                        break
            
            if is_match:
                other_features = existing_features_map.get(other_ticket_id)
                text_similarity = 0.0
                if ticket_features and other_features and ticket_features.tfidf_vector is not None and other_features.tfidf_vector is not None:
                    text_similarity = compute_cosine_similarity(ticket_features.tfidf_vector, other_features.tfidf_vector)
                
                matching_tickets.append({
                    "ticket_id": other_ticket_id,
                    "source": "historical",
                    "text_similarity": text_similarity,
                    "time": other_data.get("时间", "")
                })
        
        if matching_tickets:
            high_similarity = [m for m in matching_tickets if m["text_similarity"] >= self.similarity_threshold]
            
            if high_similarity:
                confidence = max(m["text_similarity"] for m in high_similarity)
            else:
                confidence = 0.5
            
            return DetectionResult(
                ticket_id=ticket.ticket_id,
                detection_type=DetectionType.DUPLICATE_USER,
                confidence=confidence,
                details={
                    "matching_tickets": matching_tickets[:10],
                    "total_matches": len(matching_tickets),
                    "user_identifiers_found": [t[0] for t in user_identifiers]
                }
            )
        
        return None
    
    def _detect_conflicting_conclusion(
        self,
        ticket: ParsedTicket,
        features: TextFeatures,
        existing_clusters: ClusteringResult,
        existing_features_map: Dict[str, TextFeatures],
        existing_tickets_map: Dict[str, ParsedTicket]
    ) -> Optional[DetectionResult]:
        if features.tfidf_vector is None:
            return None
        
        current_conclusion = ticket.sanitized_data.get("处理结论", "")
        if not current_conclusion:
            return None
        
        similar_tickets = []
        
        for cluster in existing_clusters.clusters:
            if not cluster.ticket_ids:
                continue
            
            for ticket_id in cluster.ticket_ids:
                if ticket_id not in existing_features_map or ticket_id not in existing_tickets_map:
                    continue
                
                existing_features = existing_features_map[ticket_id]
                if existing_features.tfidf_vector is None:
                    continue
                
                sim = compute_cosine_similarity(features.tfidf_vector, existing_features.tfidf_vector)
                
                if sim >= self.similarity_threshold:
                    existing_ticket = existing_tickets_map[ticket_id]
                    existing_conclusion = existing_ticket.sanitized_data.get("处理结论", "")
                    
                    if existing_conclusion and current_conclusion != existing_conclusion:
                        similar_tickets.append({
                            "ticket_id": ticket_id,
                            "similarity": sim,
                            "conclusion": existing_conclusion,
                            "cluster_id": cluster.cluster_id
                        })
        
        if similar_tickets:
            confidence = max(t["similarity"] for t in similar_tickets)
            
            return DetectionResult(
                ticket_id=ticket.ticket_id,
                detection_type=DetectionType.CONFLICTING_CONCLUSION,
                confidence=confidence,
                details={
                    "current_conclusion": current_conclusion,
                    "conflicting_tickets": similar_tickets[:5],
                    "total_conflicts": len(similar_tickets)
                }
            )
        
        return None
    
    def save_report(self, report: DetectionReport, path: Optional[Path] = None) -> Path:
        if path is None:
            path = self.config.get_output_path() / f"detection_{report.import_id}.json"
        
        path.parent.mkdir(exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report.to_dict(), f, ensure_ascii=False, indent=2)
        
        return path


def run_detection(
    config: Config,
    new_tickets: List[ParsedTicket],
    import_id: str
) -> Tuple[DetectionReport, Path]:
    from .clustering import TicketClusterer
    
    existing_tickets, _ = load_all_tickets(config)
    
    existing_tickets = [t for t in existing_tickets if t.ticket_id not in {nt.ticket_id for nt in new_tickets}]
    
    text_processor = TextProcessor(config)
    
    new_features = text_processor.process_tickets(new_tickets)
    
    existing_features: Dict[str, TextFeatures] = {}
    if existing_tickets:
        all_features = text_processor.process_tickets(existing_tickets)
        try:
            text_processor.fit_tfidf(all_features)
            existing_features = {f.ticket_id: f for f in all_features}
        except Exception:
            pass
    
    if new_features and existing_features:
        new_texts = [' '.join(f.tokens) for f in new_features]
        try:
            text_processor.transform_tfidf(new_features)
        except Exception:
            if len(new_features) > 1:
                try:
                    text_processor.fit_tfidf(new_features)
                except Exception:
                    pass
    elif new_features and len(new_features) > 1:
        try:
            text_processor.fit_tfidf(new_features)
        except Exception:
            pass
    
    clusterer = TicketClusterer(config)
    try:
        existing_clusters = clusterer.load_result()
    except Exception:
        existing_clusters = ClusteringResult()
    
    detector = TicketDetector(config)
    report = detector.detect(
        new_tickets=new_tickets,
        new_features_list=new_features,
        existing_clusters=existing_clusters,
        existing_features_map=existing_features,
        existing_tickets_map={t.ticket_id: t for t in existing_tickets},
        import_id=import_id
    )
    
    report_path = detector.save_report(report)
    
    return report, report_path
