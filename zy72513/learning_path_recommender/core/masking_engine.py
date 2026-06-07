import re
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from ..models import MaskingRule, Recommendation
from ..storage import JSONStorage
from ..audit import AuditLogger


class MaskingEngine:
    def __init__(self, storage: JSONStorage, audit_logger: AuditLogger):
        self.storage = storage
        self.audit = audit_logger
        self._initialize_default_rules()

    def _initialize_default_rules(self):
        existing = self.storage.get_masking_rules(enabled_only=False)
        if existing:
            return

        default_rules = [
            MaskingRule(
                name="phone_number_china",
                pattern=r"1[3-9]\d{9}",
                replacement=r"1*********",
                description="中国手机号脱敏：13812345678 -> 1*********",
                category="pii",
                severity="high",
            ),
            MaskingRule(
                name="id_card_china",
                pattern=r"\d{17}[\dXx]",
                replacement=r"*****************",
                description="中国身份证号脱敏",
                category="pii",
                severity="high",
            ),
            MaskingRule(
                name="email_general",
                pattern=r"[\w.-]+@[\w.-]+\.\w+",
                replacement=r"***@***.com",
                description="邮箱地址脱敏",
                category="pii",
                severity="medium",
            ),
        ]

        for rule in default_rules:
            self.storage.save_masking_rule(rule)
            self.audit.log_masking_rule_create(
                rule_id=rule.id,
                rule_name=rule.name,
                created_by="system",
            )

    def check_unmasked_content(self, text: str) -> List[Dict[str, Any]]:
        violations = []
        rules = self.storage.get_masking_rules(enabled_only=True)

        for rule in rules:
            if rule.check(text):
                pattern = re.compile(rule.pattern)
                matches = pattern.findall(text)
                for match in matches:
                    violations.append(
                        {
                            "rule_id": rule.id,
                            "rule_name": rule.name,
                            "severity": rule.severity,
                            "category": rule.category,
                            "matched_text": match,
                            "description": rule.description,
                        }
                    )

        return violations

    def apply_masking(self, text: str) -> Tuple[str, List[Dict[str, Any]]]:
        violations = self.check_unmasked_content(text)
        result = text
        rules = self.storage.get_masking_rules(enabled_only=True)

        for rule in rules:
            result = rule.apply(result)

        return result, violations

    def process_recommendation(
        self,
        recommendation_id: str,
        processed_by: str,
        auto_fix: bool = False,
    ) -> Dict[str, Any]:
        recommendation = self.storage.get_recommendation(recommendation_id)
        if not recommendation:
            raise ValueError(f"Recommendation not found: {recommendation_id}")

        violations = self.check_unmasked_content(recommendation.content)
        has_phone = any(v["rule_name"] == "phone_number_china" for v in violations)

        result = {
            "recommendation_id": recommendation_id,
            "has_unmasked": len(violations) > 0,
            "has_unmasked_phone": has_phone,
            "violations": violations,
            "masking_applied": False,
            "review_required": has_phone,
            "review_status": recommendation.review_status,
        }

        if has_phone:
            recommendation.has_unmasked_phone = True
            recommendation.masking_status = "needs_review"
            recommendation.updated_at = datetime.now()
            self.storage.save_recommendation(recommendation)

            self.audit.log_unmasked_detected(
                recommendation_id=recommendation_id,
                detected_by=processed_by,
                violation_type="phone_number",
                matched_texts=[v["matched_text"] for v in violations if v["rule_name"] == "phone_number_china"],
                severity="high",
            )
        elif violations:
            recommendation.has_unmasked_phone = False
            recommendation.masking_status = "violations_found"
            recommendation.updated_at = datetime.now()
            self.storage.save_recommendation(recommendation)
        else:
            recommendation.has_unmasked_phone = False
            recommendation.masking_status = "clean"
            recommendation.updated_at = datetime.now()
            self.storage.save_recommendation(recommendation)

        if auto_fix and violations and not has_phone:
            original_content = recommendation.content
            masked_content, _ = self.apply_masking(recommendation.content)
            recommendation.content = masked_content
            recommendation.version += 1
            recommendation.masking_status = "auto_masked"
            recommendation.updated_at = datetime.now()
            self.storage.save_recommendation(recommendation)
            result["masking_applied"] = True
            result["masked_content"] = masked_content

            self.audit.log_masking_apply(
                recommendation_id=recommendation_id,
                applied_by=processed_by,
                method="auto",
                original_content_preview=original_content[:100],
                masked_content_preview=masked_content[:100],
            )

        return result

    def mark_for_algorithm_review(
        self,
        recommendation_id: str,
        marked_by: str,
        comment: str = None,
    ) -> Recommendation:
        recommendation = self.storage.get_recommendation(recommendation_id)
        if not recommendation:
            raise ValueError(f"Recommendation not found: {recommendation_id}")

        recommendation.review_status = "pending_algorithm_review"
        recommendation.reviewer = marked_by
        recommendation.review_comment = comment or "手机号漏遮，待算法同事复核"
        recommendation.updated_at = datetime.now()
        self.storage.save_recommendation(recommendation)

        self.audit.log_review_escalate(
            recommendation_id=recommendation_id,
            escalated_by=marked_by,
            escalate_to="algorithm_team",
            reason="unmasked_phone_number",
            comment=comment,
        )

        return recommendation

    def export_masked(
        self,
        recommendation_ids: List[str],
        exported_by: str,
        include_unreviewed: bool = False,
    ) -> Tuple[List[Dict[str, Any]], List[str]]:
        exported = []
        skipped = []

        for rec_id in recommendation_ids:
            recommendation = self.storage.get_recommendation(rec_id)
            if not recommendation:
                skipped.append(rec_id)
                continue

            if recommendation.has_unmasked_phone and not include_unreviewed:
                skipped.append(rec_id)
                self.audit.log_export_skip(
                    recommendation_id=rec_id,
                    reason="has_unmasked_phone",
                    exported_by=exported_by,
                )
                continue

            masked_content, violations = self.apply_masking(recommendation.content)

            export_item = recommendation.to_dict()
            export_item["masked_content"] = masked_content
            export_item["masking_violations"] = violations
            export_item["exported_at"] = datetime.now().isoformat()
            export_item["exported_by"] = exported_by

            exported.append(export_item)

        self.audit.log_export_complete(
            total_requested=len(recommendation_ids),
            exported=len(exported),
            skipped=len(skipped),
            exported_by=exported_by,
            include_unreviewed=include_unreviewed,
        )

        return exported, skipped

    def add_rule(self, rule: MaskingRule, created_by: str) -> MaskingRule:
        self.storage.save_masking_rule(rule)
        self.audit.log_masking_rule_create(
            rule_id=rule.id,
            rule_name=rule.name,
            created_by=created_by,
        )
        return rule

    def list_rules(self, enabled_only: bool = True) -> List[MaskingRule]:
        return self.storage.get_masking_rules(enabled_only=enabled_only)
