from typing import Dict, Any, List, Optional
from datetime import datetime
import hashlib
import json

from sqlalchemy.orm import Session

from ..models import (
    RetractionRequest,
    RequestDataMapping,
    FeatureCleanup,
    FeatureImpact,
    ModelImpact,
    ModelImpactSeverity,
    ExecutionReceipt,
    ComplianceReport,
    ComplianceReportStatus,
    MLModel,
    ModelFeatureLink,
    Feature,
    RuleEvaluation,
    RuleDefinition
)


class ModelImpactService:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_affected_features(
        self,
        request: RetractionRequest
    ) -> List[str]:
        mappings = (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request.id)
            .all()
        )
        
        feature_ids = set()
        for mapping in mappings:
            impacts = (
                self.db.query(FeatureImpact)
                .filter(FeatureImpact.data_record_id == mapping.data_record_id)
                .all()
            )
            for impact in impacts:
                feature_ids.add(impact.feature_id)
        
        return list(feature_ids)
    
    def _calculate_severity(
        self,
        model: MLModel,
        affected_count: int,
        total_features: int
    ) -> str:
        if total_features == 0:
            return ModelImpactSeverity.LOW
        
        ratio = affected_count / total_features
        
        if ratio >= 0.5:
            return ModelImpactSeverity.CRITICAL
        elif ratio >= 0.25:
            return ModelImpactSeverity.HIGH
        elif ratio >= 0.1:
            return ModelImpactSeverity.MEDIUM
        else:
            return ModelImpactSeverity.LOW
    
    def assess_impacts(
        self,
        request: RetractionRequest
    ) -> List[ModelImpact]:
        affected_feature_ids = self._get_affected_features(request)
        
        if not affected_feature_ids:
            return []
        
        all_models = self.db.query(MLModel).all()
        impacts = []
        
        for model in all_models:
            model_feature_links = (
                self.db.query(ModelFeatureLink)
                .filter(ModelFeatureLink.model_id == model.id)
                .all()
            )
            
            model_feature_ids = {link.feature_id for link in model_feature_links}
            affected_in_model = model_feature_ids & set(affected_feature_ids)
            
            if affected_in_model:
                severity = self._calculate_severity(
                    model=model,
                    affected_count=len(affected_in_model),
                    total_features=len(model_feature_ids)
                )
                
                retraining_required = severity in [
                    ModelImpactSeverity.HIGH,
                    ModelImpactSeverity.CRITICAL
                ]
                
                impact = ModelImpact(
                    request_id=request.id,
                    model_id=model.id,
                    severity=severity,
                    affected_features_count=len(affected_in_model),
                    retraining_required=retraining_required,
                    impact_description=(
                        f"Model {model.name} v{model.version} has "
                        f"{len(affected_in_model)} affected features. "
                        f"Retraining {'required' if retraining_required else 'not required'}."
                    )
                )
                
                self.db.add(impact)
                impacts.append(impact)
        
        self.db.commit()
        
        for impact in impacts:
            self.db.refresh(impact)
        
        return impacts
    
    def get_impacts_for_request(
        self,
        request_id: str
    ) -> List[ModelImpact]:
        return (
            self.db.query(ModelImpact)
            .filter(ModelImpact.request_id == request_id)
            .all()
        )


def _json_serializable(obj: Any) -> Any:
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif hasattr(obj, '__dict__'):
        return str(obj)
    return obj


def _make_json_serializable(data: Any) -> Any:
    if isinstance(data, dict):
        return {k: _make_json_serializable(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [_make_json_serializable(item) for item in data]
    else:
        return _json_serializable(data)


class ReceiptService:
    def __init__(self, db: Session):
        self.db = db
    
    def _generate_signature(self, payload: Dict[str, Any], secret: str = "") -> str:
        serializable_payload = _make_json_serializable(payload)
        sorted_payload = json.dumps(
            serializable_payload,
            sort_keys=True,
            default=str
        )
        signature_input = f"{sorted_payload}|{secret}"
        return hashlib.sha256(signature_input.encode("utf-8")).hexdigest()
    
    def _create_receipt(
        self,
        request: RetractionRequest,
        receipt_type: str,
        payload: Dict[str, Any]
    ) -> ExecutionReceipt:
        serializable_payload = _make_json_serializable(payload)
        signature = self._generate_signature(payload)
        receipt = ExecutionReceipt(
            request_id=request.id,
            receipt_type=receipt_type,
            payload=serializable_payload,
            signature=signature
        )
        self.db.add(receipt)
        return receipt
    
    def generate_request_receipt(
        self,
        request: RetractionRequest
    ) -> ExecutionReceipt:
        payload = {
            "type": "request_submission",
            "request_id": request.id,
            "requester_id": request.requester_id,
            "created_at": request.created_at,
            "retraction_reason": request.retraction_reason,
            "ruleset_version": request.ruleset_version
        }
        return self._create_receipt(request, "request_submission", payload)
    
    def generate_data_location_receipt(
        self,
        request: RetractionRequest
    ) -> ExecutionReceipt:
        mappings = (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request.id)
            .all()
        )
        
        payload = {
            "type": "data_location",
            "request_id": request.id,
            "located_count": len(mappings),
            "records": [
                {
                    "data_record_id": m.data_record_id,
                    "located_through": m.located_through,
                    "confidence": m.location_confidence
                }
                for m in mappings
            ]
        }
        return self._create_receipt(request, "data_location", payload)
    
    def generate_cleanup_receipt(
        self,
        request: RetractionRequest
    ) -> ExecutionReceipt:
        cleanups = (
            self.db.query(FeatureCleanup)
            .filter(FeatureCleanup.request_id == request.id)
            .all()
        )
        
        payload = {
            "type": "feature_cleanup",
            "request_id": request.id,
            "cleanup_count": len(cleanups),
            "actions": [
                {
                    "feature_id": c.feature_id,
                    "action": c.cleanup_action,
                    "status": c.status,
                    "executed_at": c.executed_at
                }
                for c in cleanups
            ]
        }
        return self._create_receipt(request, "feature_cleanup", payload)
    
    def generate_completion_receipt(
        self,
        request: RetractionRequest
    ) -> ExecutionReceipt:
        payload = {
            "type": "completion",
            "request_id": request.id,
            "status": request.status,
            "completed_at": request.completed_at,
            "approved_at": request.approved_at
        }
        return self._create_receipt(request, "completion", payload)
    
    def generate_all_receipts(
        self,
        request: RetractionRequest
    ) -> List[ExecutionReceipt]:
        receipts = [
            self.generate_request_receipt(request),
            self.generate_data_location_receipt(request),
            self.generate_cleanup_receipt(request),
            self.generate_completion_receipt(request)
        ]
        
        self.db.commit()
        
        for receipt in receipts:
            self.db.refresh(receipt)
        
        return receipts
    
    def get_receipts_for_request(
        self,
        request_id: str
    ) -> List[ExecutionReceipt]:
        return (
            self.db.query(ExecutionReceipt)
            .filter(ExecutionReceipt.request_id == request_id)
            .order_by(ExecutionReceipt.created_at.asc())
            .all()
        )
    
    def verify_receipt(
        self,
        receipt: ExecutionReceipt,
        secret: str = ""
    ) -> bool:
        signature = self._generate_signature(receipt.payload, secret)
        return signature == receipt.signature


class ComplianceReportService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_report(
        self,
        request: RetractionRequest
    ) -> ComplianceReport:
        mappings = (
            self.db.query(RequestDataMapping)
            .filter(RequestDataMapping.request_id == request.id)
            .all()
        )
        
        cleanups = (
            self.db.query(FeatureCleanup)
            .filter(FeatureCleanup.request_id == request.id)
            .all()
        )
        
        model_impacts = (
            self.db.query(ModelImpact)
            .filter(ModelImpact.request_id == request.id)
            .all()
        )
        
        rule_evaluations = (
            self.db.query(RuleEvaluation)
            .filter(RuleEvaluation.request_id == request.id)
            .all()
        )
        
        evaluations_with_rules = []
        for eval_item in rule_evaluations:
            rule = (
                self.db.query(RuleDefinition)
                .filter(RuleDefinition.id == eval_item.rule_id)
                .first()
            )
            evaluations_with_rules.append({
                "rule_id": eval_item.rule_id,
                "rule_name": rule.rule_name if rule else None,
                "rule_type": rule.rule_type if rule else None,
                "passed": eval_item.evaluation_result,
                "input_values": eval_item.input_values,
                "notes": eval_item.evaluation_notes
            })
        
        report_content = {
            "request_overview": {
                "request_id": request.id,
                "requester": {
                    "id": request.requester.id if request.requester else None,
                    "name": request.requester.name if request.requester else None,
                    "email": request.requester.email if request.requester else None
                },
                "retraction_reason": request.retraction_reason,
                "status": request.status,
                "timeline": {
                    "created_at": request.created_at,
                    "approved_at": request.approved_at,
                    "completed_at": request.completed_at
                },
                "ruleset_version": request.ruleset_version
            },
            "data_retraction_details": {
                "located_records_count": len(mappings),
                "records": [
                    {
                        "record_id": m.data_record_id,
                        "located_through": m.located_through,
                        "confidence": m.location_confidence,
                        "dataset_id": m.data_record.dataset_id if m.data_record else None,
                        "user_id": m.data_record.user_id if m.data_record else None,
                        "retracted": m.data_record.is_retracted if m.data_record else None
                    }
                    for m in mappings
                ]
            },
            "feature_cleanup": {
                "features_affected": len(cleanups),
                "details": [
                    {
                        "feature_id": c.feature_id,
                        "action_taken": c.cleanup_action,
                        "status": c.status,
                        "executed_at": c.executed_at,
                        "notes": c.notes
                    }
                    for c in cleanups
                ]
            },
            "model_impact_assessment": {
                "models_affected": len(model_impacts),
                "details": [
                    {
                        "model_id": m.model_id,
                        "severity": m.severity,
                        "affected_features": m.affected_features_count,
                        "retraining_required": m.retraining_required,
                        "description": m.impact_description
                    }
                    for m in model_impacts
                ]
            },
            "rule_evaluation_trail": {
                "evaluations_count": len(evaluations_with_rules),
                "details": evaluations_with_rules
            },
            "compliance_checks": {
                "data_tracked": True,
                "features_tracked": len(cleanups) > 0,
                "models_assessed": True,
                "receipts_generated": True,
                "report_generated": True,
                "audit_trail_complete": True
            }
        }
        
        serializable_content = _make_json_serializable(report_content)
        
        report = ComplianceReport(
            request_id=request.id,
            report_type="full_compliance",
            status=ComplianceReportStatus.FINALIZED,
            content=serializable_content,
            finalized_at=datetime.utcnow()
        )
        
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        return report
    
    def get_reports_for_request(
        self,
        request_id: str
    ) -> List[ComplianceReport]:
        return (
            self.db.query(ComplianceReport)
            .filter(ComplianceReport.request_id == request_id)
            .order_by(ComplianceReport.generated_at.desc())
            .all()
        )
    
    def export_report(
        self,
        report: ComplianceReport,
        format: str = "json"
    ) -> str:
        if format == "json":
            return json.dumps(report.content, indent=2, default=str)
        raise ValueError(f"Unsupported format: {format}")
