import hashlib
import json
import time
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session

import models
import schemas


class EventConverger:
    def __init__(self, db: Session):
        self.db = db
        self.active_rule = self._get_active_rule()
    
    def _get_active_rule(self) -> models.ConvergenceRule:
        rule = self.db.query(models.ConvergenceRule).filter(
            models.ConvergenceRule.is_active == True
        ).first()
        
        if not rule:
            rule = self._create_default_rule()
        
        return rule
    
    def _create_default_rule(self) -> models.ConvergenceRule:
        default_rule = models.ConvergenceRule(
            version="v1.0.0",
            rule_name="高峰药房配送回执收敛规则",
            description="针对药房配送回执的事件收敛规则，重点处理空值误判问题",
            success_conditions={
                "status_fields": ["delivery_status", "receipt_status"],
                "success_values": ["success", "completed", "delivered", "已完成", "已送达"],
                "require_all_fields": False,
                "allow_null": False
            },
            failure_conditions={
                "status_fields": ["delivery_status", "receipt_status"],
                "failure_values": ["failed", "cancelled", "returned", "失败", "取消", "退回"],
                "null_treatment": "failure",
                "empty_string_treatment": "failure"
            },
            risk_weightings={
                "null_status": 0.8,
                "empty_status": 0.7,
                "partial_success": 0.5,
                "mismatch_fields": 0.6
            },
            is_active=True,
            created_by="system"
        )
        self.db.add(default_rule)
        self.db.commit()
        self.db.refresh(default_rule)
        return default_rule
    
    def calculate_batch_hash(self, events: List[Dict[str, Any]]) -> str:
        sorted_events = sorted(events, key=lambda x: json.dumps(x, sort_keys=True))
        hash_content = json.dumps(sorted_events, sort_keys=True)
        return hashlib.sha256(hash_content.encode()).hexdigest()
    
    def check_duplicate_batch(self, batch_hash: str) -> Optional[models.EventBatch]:
        return self.db.query(models.EventBatch).filter(
            models.EventBatch.batch_hash == batch_hash
        ).first()
    
    def _extract_status_from_event(self, event_data: Dict[str, Any], status_fields: List[str]) -> Tuple[Optional[str], List[str]]:
        found_statuses = []
        missing_fields = []
        
        for field in status_fields:
            value = event_data.get(field)
            if value is not None and value != "":
                found_statuses.append(str(value).lower())
            else:
                missing_fields.append(field)
        
        if found_statuses:
            return found_statuses[0], missing_fields
        return None, missing_fields
    
    def _determine_raw_status(self, event_data: Dict[str, Any]) -> str:
        success_conditions = self.active_rule.success_conditions
        failure_conditions = self.active_rule.failure_conditions
        
        status_fields = success_conditions.get("status_fields", [])
        status_value, missing_fields = self._extract_status_from_event(event_data, status_fields)
        
        if status_value is None:
            null_treatment = failure_conditions.get("null_treatment", "failure")
            if null_treatment == "failure":
                return "null_failure"
            return "null_unknown"
        
        success_values = [v.lower() for v in success_conditions.get("success_values", [])]
        if status_value in success_values:
            return "raw_success"
        
        failure_values = [v.lower() for v in failure_conditions.get("failure_values", [])]
        if status_value in failure_values:
            return "raw_failure"
        
        return "raw_unknown"
    
    def _determine_final_status(self, raw_status: str, event_data: Dict[str, Any]) -> Tuple[str, float, List[str]]:
        failure_conditions = self.active_rule.failure_conditions
        risk_weightings = self.active_rule.risk_weightings
        corrections = []
        risk_score = 0.0
        
        if raw_status == "null_failure":
            final_status = "failure"
            risk_score = risk_weightings.get("null_status", 0.8)
            corrections.append("空值状态被判定为失败")
        elif raw_status == "null_unknown":
            final_status = "pending_review"
            risk_score = risk_weightings.get("null_status", 0.8)
            corrections.append("空值状态需要人工审核")
        elif raw_status == "raw_success":
            final_status = "success"
        elif raw_status == "raw_failure":
            final_status = "failure"
        else:
            final_status = "pending_review"
            risk_score = 0.3
            corrections.append("未知状态需要人工审核")
        
        return final_status, risk_score, corrections
    
    def _calculate_risk_level(self, risk_score: float) -> str:
        if risk_score >= 0.7:
            return "high"
        elif risk_score >= 0.4:
            return "medium"
        else:
            return "low"
    
    def _merge_similar_events(self, events: List[models.Event]) -> List[models.Event]:
        merged_map = {}
        result_events = []
        
        for event in events:
            key_data = event.original_data.copy()
            key_fields = ["order_id", "pharmacy_id", "delivery_date"]
            key_parts = []
            for field in key_fields:
                key_parts.append(str(key_data.get(field, "")))
            merge_key = "|".join(key_parts)
            
            if merge_key not in merged_map:
                merged_map[merge_key] = event
                result_events.append(event)
            else:
                target_event = merged_map[merge_key]
                event.is_merged = True
                event.merged_into_event_id = target_event.id
                
                if not target_event.processing_notes:
                    target_event.processing_notes = ""
                target_event.processing_notes += f"合并事件ID: {event.event_id}; "
        
        return result_events
    
    def process_batch(self, batch_data: schemas.BatchCreate) -> Dict[str, Any]:
        start_time = time.time()
        
        events_list = [event.model_dump() for event in batch_data.events]
        batch_hash = self.calculate_batch_hash(events_list)
        
        existing_batch = self.check_duplicate_batch(batch_hash)
        if existing_batch:
            return {
                "is_duplicate": True,
                "existing_batch": existing_batch,
                "conflict_details": {
                    "message": "该批次内容已存在",
                    "existing_batch_id": existing_batch.batch_id,
                    "processed_at": existing_batch.processing_completed_at
                }
            }
        
        batch = models.EventBatch(
            batch_id=batch_data.batch_id,
            batch_hash=batch_hash,
            source=batch_data.source,
            description=batch_data.description,
            total_events=len(batch_data.events),
            rule_version=self.active_rule.version,
            processing_status="processing",
            processing_started_at=datetime.utcnow()
        )
        self.db.add(batch)
        self.db.commit()
        
        processed_events = []
        before_summary = {
            "total": len(batch_data.events),
            "status_counts": {}
        }
        
        for event_data in batch_data.events:
            raw_status = self._determine_raw_status(event_data.original_data)
            final_status, risk_score, corrections = self._determine_final_status(
                raw_status, event_data.original_data
            )
            risk_level = self._calculate_risk_level(risk_score)
            
            before_summary["status_counts"][raw_status] = before_summary["status_counts"].get(raw_status, 0) + 1
            
            db_event = models.Event(
                event_id=event_data.event_id,
                batch_id=batch_data.batch_id,
                original_data=event_data.original_data,
                raw_status=raw_status,
                final_status=final_status,
                risk_level=risk_level,
                risk_score=risk_score,
                corrections=corrections if corrections else None
            )
            processed_events.append(db_event)
        
        for event in processed_events:
            self.db.add(event)
        
        self.db.commit()
        
        merged_events = self._merge_similar_events(processed_events)
        
        for event in processed_events:
            self.db.add(event)
        
        self.db.commit()
        
        processing_duration = (time.time() - start_time) * 1000
        
        after_summary = {
            "total": len(processed_events),
            "merged_count": len(processed_events) - len(merged_events),
            "status_counts": {},
            "risk_level_counts": {}
        }
        
        for event in processed_events:
            after_summary["status_counts"][event.final_status] = after_summary["status_counts"].get(event.final_status, 0) + 1
            after_summary["risk_level_counts"][event.risk_level] = after_summary["risk_level_counts"].get(event.risk_level, 0) + 1
        
        batch.processing_status = "completed"
        batch.processing_completed_at = datetime.utcnow()
        batch.processing_duration_ms = processing_duration
        self.db.commit()
        
        report = self._generate_report(
            batch, before_summary, after_summary, processed_events, processing_duration
        )
        
        self._create_outsourcing_records(batch.batch_id, processed_events)
        
        return {
            "is_duplicate": False,
            "batch": batch,
            "report": report,
            "events": processed_events
        }
    
    def _generate_report(
        self,
        batch: models.EventBatch,
        before_summary: Dict[str, Any],
        after_summary: Dict[str, Any],
        events: List[models.Event],
        execution_time_ms: float
    ) -> models.ProcessingReport:
        comparison_details = {
            "status_changes": [],
            "risk_analysis": {},
            "null_value_treatment": {
                "count": 0,
                "details": []
            }
        }
        
        for event in events:
            if event.raw_status != event.final_status:
                comparison_details["status_changes"].append({
                    "event_id": event.event_id,
                    "from": event.raw_status,
                    "to": event.final_status,
                    "reason": event.corrections
                })
            
            if "null" in event.raw_status:
                comparison_details["null_value_treatment"]["count"] += 1
                comparison_details["null_value_treatment"]["details"].append({
                    "event_id": event.event_id,
                    "treatment": event.final_status,
                    "risk_level": event.risk_level
                })
        
        next_steps = []
        high_risk_count = after_summary.get("risk_level_counts", {}).get("high", 0)
        pending_count = after_summary.get("status_counts", {}).get("pending_review", 0)
        
        if high_risk_count > 0:
            next_steps.append({
                "priority": "high",
                "action": f"审核 {high_risk_count} 个高风险事件",
                "description": "高风险事件需要优先人工审核"
            })
        
        if pending_count > 0:
            next_steps.append({
                "priority": "medium",
                "action": f"处理 {pending_count} 个待审核事件",
                "description": "未知状态事件需要人工确认"
            })
        
        if comparison_details["null_value_treatment"]["count"] > 0:
            next_steps.append({
                "priority": "medium",
                "action": "验证空值处理逻辑",
                "description": f"共 {comparison_details['null_value_treatment']['count']} 个空值被处理，建议抽查验证"
            })
        
        summary_stats = {
            "convergence_rate": (after_summary["merged_count"] / after_summary["total"]) if after_summary["total"] > 0 else 0,
            "success_rate": (after_summary.get("status_counts", {}).get("success", 0) / after_summary["total"]) if after_summary["total"] > 0 else 0,
            "failure_rate": (after_summary.get("status_counts", {}).get("failure", 0) / after_summary["total"]) if after_summary["total"] > 0 else 0
        }
        
        report = models.ProcessingReport(
            batch_id=batch.batch_id,
            report_type="convergence_report",
            before_summary=before_summary,
            after_summary=after_summary,
            comparison_details=comparison_details,
            execution_time_ms=execution_time_ms,
            next_steps=next_steps,
            summary_stats=summary_stats
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        return report
    
    def _create_outsourcing_records(self, batch_id: str, events: List[models.Event]):
        for event in events:
            if event.corrections:
                acceptance = models.OutsourcingAcceptance(
                    event_id=event.id,
                    batch_id=batch_id,
                    original_value={"raw_status": event.raw_status, "data": event.original_data},
                    corrected_value={"final_status": event.final_status, "risk_level": event.risk_level},
                    correction_reason="; ".join(event.corrections) if event.corrections else "",
                    risk_level=event.risk_level
                )
                self.db.add(acceptance)
        self.db.commit()
