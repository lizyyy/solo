from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.models import (
    Language, SdkConfig, RetryPolicy, PolicyReport, BackoffDiscrepancy
)
from app.utils.config_parser import parse_config, categorize_status_code


class PolicyEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def import_sdk_config(self, language: str, config_data: Dict[str, Any],
                          sdk_version: Optional[str] = None,
                          config_source: Optional[str] = None) -> Tuple[SdkConfig, int]:
        lang = self.db.query(Language).filter(Language.name == language).first()
        if not lang:
            lang = Language(name=language, display_name=language.capitalize())
            self.db.add(lang)
            self.db.commit()
            self.db.refresh(lang)
        
        policies = parse_config(language, config_data)
        
        sdk_config = SdkConfig(
            language_id=lang.id,
            sdk_version=sdk_version,
            config_source=config_source,
            config_content=str(config_data),
            is_active=True
        )
        self.db.add(sdk_config)
        self.db.commit()
        self.db.refresh(sdk_config)
        
        for policy_data in policies:
            policy = RetryPolicy(
                sdk_config_id=sdk_config.id,
                status_code=policy_data["status_code"],
                status_code_category=categorize_status_code(policy_data["status_code"]),
                max_retries=policy_data["max_retries"],
                backoff_strategy=policy_data["backoff_strategy"],
                initial_delay=policy_data.get("initial_delay"),
                max_delay=policy_data.get("max_delay"),
                multiplier=policy_data.get("multiplier"),
                jitter_enabled=policy_data.get("jitter_enabled", False),
                is_retryable=policy_data.get("is_retryable", True)
            )
            self.db.add(policy)
        
        self.db.commit()
        return sdk_config, len(policies)
    
    def get_policies(self, language: Optional[str] = None,
                    status_code: Optional[int] = None,
                    status_code_category: Optional[str] = None,
                    is_retryable: Optional[bool] = None) -> List[RetryPolicy]:
        query = self.db.query(RetryPolicy).join(SdkConfig).join(Language)
        
        if language:
            query = query.filter(Language.name == language)
        if status_code:
            query = query.filter(RetryPolicy.status_code == status_code)
        if status_code_category:
            query = query.filter(RetryPolicy.status_code_category == status_code_category)
        if is_retryable is not None:
            query = query.filter(RetryPolicy.is_retryable == is_retryable)
        
        return query.all()
    
    def compare_policies(self, languages: List[str],
                        status_codes: Optional[List[int]] = None) -> PolicyReport:
        all_policies = []
        for lang in languages:
            policies = self.get_policies(language=lang)
            for policy in policies:
                all_policies.append((lang, policy))
        
        if status_codes:
            all_policies = [(l, p) for l, p in all_policies if p.status_code in status_codes]
        
        grouped_by_status = {}
        for lang, policy in all_policies:
            key = policy.status_code
            if key not in grouped_by_status:
                grouped_by_status[key] = {}
            grouped_by_status[key][lang] = policy
        
        report_name = f"Comparison_{'_'.join(languages)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        report = PolicyReport(
            report_name=report_name,
            comparison_type="cross_language",
            status_codes_analyzed=len(grouped_by_status),
            discrepancies_found=0,
            needs_review=False
        )
        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)
        
        discrepancies = []
        comparison_fields = [
            "max_retries", "backoff_strategy", "initial_delay",
            "max_delay", "multiplier", "jitter_enabled", "is_retryable"
        ]
        
        for status_code, lang_policies in grouped_by_status.items():
            for i, lang_a in enumerate(languages):
                for lang_b in languages[i+1:]:
                    if lang_a not in lang_policies or lang_b not in lang_policies:
                        continue
                    
                    policy_a = lang_policies[lang_a]
                    policy_b = lang_policies[lang_b]
                    
                    for field in comparison_fields:
                        val_a = getattr(policy_a, field)
                        val_b = getattr(policy_b, field)
                        
                        if val_a != val_b:
                            severity = self._determine_severity(field)
                            discrepancy = BackoffDiscrepancy(
                                report_id=report.id,
                                status_code=status_code,
                                language_a=lang_a,
                                language_b=lang_b,
                                field_name=field,
                                value_a=str(val_a),
                                value_b=str(val_b),
                                severity=severity,
                                description=f"{lang_a} vs {lang_b}: {field} mismatch on status {status_code}"
                            )
                            discrepancies.append(discrepancy)
                            report.discrepancies_found += 1
        
        for d in discrepancies:
            self.db.add(d)
        
        if report.discrepancies_found > 0:
            report.needs_review = True
        
        self.db.commit()
        self.db.refresh(report)
        
        return report
    
    def _determine_severity(self, field_name: str) -> str:
        high_severity = ["max_retries", "is_retryable"]
        medium_severity = ["backoff_strategy", "max_delay", "initial_delay"]
        
        if field_name in high_severity:
            return "high"
        elif field_name in medium_severity:
            return "medium"
        return "low"
    
    def get_report(self, report_id: int) -> Optional[PolicyReport]:
        return self.db.query(PolicyReport).filter(PolicyReport.id == report_id).first()
    
    def get_report_discrepancies(self, report_id: int) -> List[BackoffDiscrepancy]:
        return self.db.query(BackoffDiscrepancy).filter(
            BackoffDiscrepancy.report_id == report_id
        ).all()
    
    def mark_reviewed(self, report_id: int, reviewer: str) -> bool:
        report = self.get_report(report_id)
        if not report:
            return False
        if report.reviewed:
            return False
        
        report.reviewed = True
        report.reviewed_by = reviewer
        report.reviewed_at = datetime.utcnow()
        self.db.commit()
        return True
    
    def export_report(self, report_id: int) -> Dict[str, Any]:
        report = self.get_report(report_id)
        if not report:
            return {}
        
        discrepancies = self.get_report_discrepancies(report_id)
        
        return {
            "report_id": report.id,
            "report_name": report.report_name,
            "generated_at": report.generated_at.isoformat(),
            "comparison_type": report.comparison_type,
            "status_codes_analyzed": report.status_codes_analyzed,
            "discrepancies_found": report.discrepancies_found,
            "needs_review": report.needs_review,
            "reviewed": report.reviewed,
            "discrepancies": [
                {
                    "status_code": d.status_code,
                    "language_a": d.language_a,
                    "language_b": d.language_b,
                    "field_name": d.field_name,
                    "value_a": d.value_a,
                    "value_b": d.value_b,
                    "severity": d.severity,
                    "description": d.description
                }
                for d in discrepancies
            ]
        }
    
    def get_all_languages(self) -> List[Language]:
        return self.db.query(Language).all()
    
    def resolve_discrepancy(self, discrepancy_id: int) -> bool:
        discrepancy = self.db.query(BackoffDiscrepancy).filter(
            BackoffDiscrepancy.id == discrepancy_id
        ).first()
        if not discrepancy or discrepancy.resolved:
            return False
        discrepancy.resolved = True
        discrepancy.resolved_at = datetime.utcnow()
        self.db.commit()
        return True