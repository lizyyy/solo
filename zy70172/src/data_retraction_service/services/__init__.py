from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid
import hashlib

from sqlalchemy.orm import Session

from ..config import Config
from ..models import (
    User,
    TrainingDataset,
    DataRecord,
    Feature,
    MLModel,
    ModelFeatureLink,
    RetractionRequest,
    RetractionRequestStatus,
    RequestDataMapping,
    FeatureImpact,
    FeatureCleanup,
    FeatureCleanupStatus,
    ModelImpact,
    ModelImpactSeverity,
    ExecutionReceipt,
    ComplianceReport,
    ComplianceReportStatus
)
from ..rules import RuleEngine


class RequestService:
    def __init__(self, db: Session):
        self.db = db
        self.ruleset = Config.DEFAULT_RULESET
    
    def create_request(
        self,
        requester_id: str,
        retraction_reason: str,
        retraction_scope: Dict[str, Any]
    ) -> RetractionRequest:
        user = self.db.query(User).filter(User.id == requester_id).first()
        if not user:
            raise ValueError(f"User {requester_id} not found")
        
        request_id = f"REQ-{uuid.uuid4().hex[:12].upper()}"
        
        request = RetractionRequest(
            id=request_id,
            requester_id=requester_id,
            status=RetractionRequestStatus.PENDING,
            retraction_reason=retraction_reason,
            ruleset_version=self.ruleset
        )
        
        self.db.add(request)
        self.db.commit()
        self.db.refresh(request)
        
        return request
    
    def get_request(self, request_id: str) -> Optional[RetractionRequest]:
        return (
            self.db.query(RetractionRequest)
            .filter(RetractionRequest.id == request_id)
            .first()
        )
    
    def get_user_requests(self, requester_id: str) -> List[RetractionRequest]:
        return (
            self.db.query(RetractionRequest)
            .filter(RetractionRequest.requester_id == requester_id)
            .order_by(RetractionRequest.created_at.desc())
            .all()
        )
    
    def approve_request(self, request_id: str, notes: str = "") -> RetractionRequest:
        request = self.get_request(request_id)
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        if request.status != RetractionRequestStatus.PENDING:
            raise ValueError(f"Request is not in PENDING state: {request.status}")
        
        request.status = RetractionRequestStatus.APPROVED
        request.approved_at = datetime.utcnow()
        request.approval_notes = notes
        
        self.db.commit()
        self.db.refresh(request)
        
        return request
    
    def reject_request(
        self,
        request_id: str,
        rejection_reason: str
    ) -> RetractionRequest:
        request = self.get_request(request_id)
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        if request.status != RetractionRequestStatus.PENDING:
            raise ValueError(f"Request is not in PENDING state: {request.status}")
        
        request.status = RetractionRequestStatus.REJECTED
        request.rejection_reason = rejection_reason
        
        self.db.commit()
        self.db.refresh(request)
        
        return request


class DataLocatorService:
    def __init__(self, db: Session):
        self.db = db
    
    def locate_by_user_id(self, user_id: str) -> List[DataRecord]:
        records = (
            self.db.query(DataRecord)
            .filter(
                DataRecord.user_id == user_id,
                DataRecord.is_retracted == False
            )
            .all()
        )
        return records
    
    def locate_by_external_id(self, external_id: str) -> List[DataRecord]:
        records = (
            self.db.query(DataRecord)
            .filter(
                DataRecord.external_id == external_id,
                DataRecord.is_retracted == False
            )
            .all()
        )
        return records
    
    def locate_by_record_ids(self, record_ids: List[str]) -> List[DataRecord]:
        records = (
            self.db.query(DataRecord)
            .filter(
                DataRecord.id.in_(record_ids),
                DataRecord.is_retracted == False
            )
            .all()
        )
        return records
    
    def locate_for_request(
        self,
        request: RetractionRequest,
        location_criteria: Dict[str, Any]
    ) -> List[RequestDataMapping]:
        scope = location_criteria.get("scope", "user_all")
        located_records = []
        located_through = ""
        
        if scope == "user_all":
            located_through = "user_id_lookup"
            user = request.requester
            if user:
                located_records = self.locate_by_user_id(user.id)
        elif scope == "by_external_id":
            located_through = "external_id_lookup"
            external_id = location_criteria.get("external_id")
            if external_id:
                located_records = self.locate_by_external_id(external_id)
        elif scope == "specific_records":
            located_through = "specific_record_ids"
            record_ids = location_criteria.get("record_ids", [])
            located_records = self.locate_by_record_ids(record_ids)
        
        mappings = []
        for record in located_records:
            mapping = RequestDataMapping(
                request_id=request.id,
                data_record_id=record.id,
                located_through=located_through,
                location_confidence=100
            )
            self.db.add(mapping)
            mappings.append(mapping)
        
        self.db.commit()
        
        for mapping in mappings:
            self.db.refresh(mapping)
        
        return mappings
    
    def get_mappings_for_request(
        self,
        request_id: str
    ) -> List[RequestDataMapping]:
        return (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request_id)
            .all()
        )


class FeatureCleanupService:
    def __init__(self, db: Session):
        self.db = db
    
    def _calculate_feature_impacts(
        self,
        data_record: DataRecord
    ) -> List[FeatureImpact]:
        features = (
            self.db.query(Feature)
            .filter(Feature.dataset_id == data_record.dataset_id)
            .all()
        )
        
        impacts = []
        for feature in features:
            impact = FeatureImpact(
                feature_id=feature.id,
                data_record_id=data_record.id,
                impact_score=1,
                impact_reason=f"Record {data_record.id} contributed to feature {feature.name}"
            )
            self.db.add(impact)
            impacts.append(impact)
        
        return impacts
    
    def _determine_cleanup_action(
        self,
        feature: Feature,
        impacted_records: List[DataRecord]
    ) -> str:
        total_feature_records = (
            self.db.query(DataRecord)
            .filter(DataRecord.dataset_id == feature.dataset_id)
            .count()
        )
        
        impact_ratio = len(impacted_records) / max(total_feature_records, 1)
        
        if impact_ratio >= 0.5:
            return "recompute_feature_entirely"
        elif impact_ratio >= 0.1:
            return "partial_recomputation"
        else:
            return "mark_impacted"
    
    def plan_cleanup(
        self,
        request: RetractionRequest
    ) -> List[FeatureCleanup]:
        mappings = (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request.id)
            .all()
        )
        
        feature_impacts_map: Dict[str, List[DataRecord]] = {}
        
        for mapping in mappings:
            record = mapping.data_record
            impacts = self._calculate_feature_impacts(record)
            
            for impact in impacts:
                feature_id = impact.feature_id
                if feature_id not in feature_impacts_map:
                    feature_impacts_map[feature_id] = []
                feature_impacts_map[feature_id].append(record)
        
        cleanups = []
        for feature_id, records in feature_impacts_map.items():
            feature = (
                self.db.query(Feature)
                .filter(Feature.id == feature_id)
                .first()
            )
            if feature:
                action = self._determine_cleanup_action(feature, records)
                cleanup = FeatureCleanup(
                    request_id=request.id,
                    feature_id=feature_id,
                    status=FeatureCleanupStatus.PENDING,
                    cleanup_action=action
                )
                self.db.add(cleanup)
                cleanups.append(cleanup)
        
        self.db.commit()
        
        for cleanup in cleanups:
            self.db.refresh(cleanup)
        
        return cleanups
    
    def execute_cleanup(self, request_id: str) -> List[FeatureCleanup]:
        cleanups = (
            self.db.query(FeatureCleanup)
            .filter(
                FeatureCleanup.request_id == request_id,
                FeatureCleanup.status == FeatureCleanupStatus.PENDING
            )
            .all()
        )
        
        for cleanup in cleanups:
            cleanup.status = FeatureCleanupStatus.IN_PROGRESS
            self.db.commit()
            
            cleanup.status = FeatureCleanupStatus.COMPLETED
            cleanup.executed_at = datetime.utcnow()
            cleanup.notes = f"Executed action: {cleanup.cleanup_action}"
            self.db.commit()
        
        self.db.commit()
        
        mappings = (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request_id)
            .all()
        )
        
        for mapping in mappings:
            record = mapping.data_record
            record.is_retracted = True
            record.retracted_at = datetime.utcnow()
        
        self.db.commit()
        
        return cleanups
    
    def get_cleanups_for_request(
        self,
        request_id: str
    ) -> List[FeatureCleanup]:
        return (
            self.db.query(FeatureCleanup)
            .filter(FeatureCleanup.request_id == request_id)
            .all()
        )


class RetractionWorkflowService:
    def __init__(self, db: Session):
        self.db = db
        self.request_service = RequestService(db)
        self.locator_service = DataLocatorService(db)
        self.cleanup_service = FeatureCleanupService(db)
        self.rule_engine = RuleEngine(db)
    
    def _check_already_retracted(
        self,
        request: RetractionRequest,
        location_criteria: Dict[str, Any]
    ) -> bool:
        from ..models import DataRecord
        
        scope = location_criteria.get("scope")
        query = self.db.query(DataRecord).filter(DataRecord.is_retracted == True)
        
        if scope == "user_all":
            query = query.filter(DataRecord.user_id == request.requester_id)
            return query.count() > 0
        elif scope == "by_external_id":
            external_id = location_criteria.get("external_id")
            if external_id:
                query = query.filter(DataRecord.external_id == external_id)
                return query.count() > 0
        elif scope == "specific_records":
            record_ids = location_criteria.get("record_ids", [])
            if record_ids:
                query = query.filter(DataRecord.id.in_(record_ids))
                return query.count() > 0
        
        return False
    
    def _build_rule_context(
        self,
        request: RetractionRequest,
        location_criteria: Dict[str, Any],
        mappings: List[RequestDataMapping]
    ) -> Dict[str, Any]:
        user = request.requester
        user_exists = user is not None
        
        already_retracted_from_mappings = any(
            mapping.data_record.is_retracted
            for mapping in mappings
        ) if mappings else False
        
        already_retracted_pre_check = self._check_already_retracted(
            request=request,
            location_criteria=location_criteria
        )
        
        records_already_retracted = already_retracted_from_mappings or already_retracted_pre_check
        
        pending_same_user = (
            self.db.query(RetractionRequest)
            .filter(
                RetractionRequest.requester_id == request.requester_id,
                RetractionRequest.id != request.id,
                RetractionRequest.status == RetractionRequestStatus.PENDING
            )
            .count() > 0
        )
        
        return {
            "retraction_reason": request.retraction_reason,
            "user_exists": user_exists,
            "already_retracted": records_already_retracted,
            "record_count": len(mappings),
            "has_pending_same_user": pending_same_user,
            "scope": location_criteria.get("scope"),
            "within_retention_window": True
        }
    
    def submit_and_process(
        self,
        requester_id: str,
        retraction_reason: str,
        location_criteria: Dict[str, Any],
        auto_approve: bool = False
    ) -> Dict[str, Any]:
        request = self.request_service.create_request(
            requester_id=requester_id,
            retraction_reason=retraction_reason,
            retraction_scope=location_criteria
        )
        
        mappings = self.locator_service.locate_for_request(
            request=request,
            location_criteria=location_criteria
        )
        
        rule_context = self._build_rule_context(
            request=request,
            location_criteria=location_criteria,
            mappings=mappings
        )
        
        evaluations = self.rule_engine.evaluate_rules(
            request=request,
            context=rule_context
        )
        
        can_approve = self.rule_engine.should_approve(evaluations)
        
        if not can_approve:
            blocking_reasons = self.rule_engine.get_blocking_reasons(evaluations)
            request.status = RetractionRequestStatus.REJECTED
            request.rejection_reason = "; ".join(blocking_reasons)
            self.db.commit()
            self.db.refresh(request)
            
            return {
                "request_id": request.id,
                "status": "REJECTED",
                "rejection_reason": request.rejection_reason,
                "rule_evaluations": [
                    {
                        "rule_id": e.rule_id,
                        "passed": e.evaluation_result,
                        "notes": e.evaluation_notes
                    }
                    for e in evaluations
                ]
            }
        
        if auto_approve:
            self.request_service.approve_request(request.id)
        
        return {
            "request_id": request.id,
            "status": request.status,
            "located_records": len(mappings),
            "rule_evaluations": [
                {
                    "rule_id": e.rule_id,
                    "passed": e.evaluation_result,
                    "notes": e.evaluation_notes
                }
                for e in evaluations
            ]
        }
    
    def execute_approved_request(self, request_id: str) -> Dict[str, Any]:
        from ..validation import (
            ModelImpactService,
            ReceiptService,
            ComplianceReportService
        )
        
        request = self.request_service.get_request(request_id)
        if not request:
            raise ValueError(f"Request {request_id} not found")
        
        if request.status != RetractionRequestStatus.APPROVED:
            raise ValueError(f"Request is not in APPROVED state: {request.status}")
        
        request.status = RetractionRequestStatus.PROCESSING
        self.db.commit()
        
        cleanups = self.cleanup_service.plan_cleanup(request)
        
        model_service = ModelImpactService(self.db)
        model_impacts = model_service.assess_impacts(request)
        
        executed_cleanups = self.cleanup_service.execute_cleanup(request.id)
        
        receipt_service = ReceiptService(self.db)
        receipts = receipt_service.generate_all_receipts(request)
        
        report_service = ComplianceReportService(self.db)
        report = report_service.generate_report(request)
        
        request.status = RetractionRequestStatus.COMPLETED
        request.completed_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(request)
        
        return {
            "request_id": request.id,
            "status": "COMPLETED",
            "completed_at": request.completed_at,
            "features_cleaned": len(executed_cleanups),
            "models_impacted": len(model_impacts),
            "receipts_generated": len(receipts),
            "reports_generated": 1
        }


def _hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()
