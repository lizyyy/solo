import re
import os
import glob
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from app.models.models import MaskingRule, RetainedField, RiskWord
from app.core.constants import DiffType


class MaskingEngine:
    def __init__(self, db: Session):
        self.db = db
        self.rules: List[MaskingRule] = []
        self.retained_fields: List[RetainedField] = []
        self.risk_words: List[RiskWord] = []
        self._load_rules()
        self._load_retained_fields()
        self._load_risk_words()

    def _load_rules(self):
        self.rules = self.db.query(MaskingRule).filter(
            MaskingRule.is_active == True
        ).order_by(MaskingRule.priority.desc()).all()

    def _load_retained_fields(self):
        self.retained_fields = self.db.query(RetainedField).filter(
            RetainedField.is_active == True
        ).all()

    def _load_risk_words(self):
        self.risk_words = self.db.query(RiskWord).filter(
            RiskWord.is_active == True
        ).all()

    def reload(self):
        self._load_rules()
        self._load_retained_fields()
        self._load_risk_words()

    def apply_masking(self, content: str) -> Tuple[str, List[str]]:
        masked_content = content
        applied_rules = []

        for rule in self.rules:
            if rule.rule_type == "regex":
                try:
                    pattern = re.compile(rule.pattern)
                    matches = pattern.findall(masked_content)
                    if matches:
                        masked_content = pattern.sub(rule.replacement, masked_content)
                        applied_rules.append(rule.name)
                except re.error:
                    continue

        return masked_content, applied_rules

    def check_retained_fields(self, original: str, masked: str) -> List[Dict[str, str]]:
        diffs = []
        for field in self.retained_fields:
            if field.field_pattern:
                try:
                    pattern = re.compile(field.field_pattern)
                    orig_matches = set(pattern.findall(original))
                    masked_matches = set(pattern.findall(masked))

                    missing_in_masked = orig_matches - masked_matches
                    new_in_masked = masked_matches - orig_matches

                    for match in missing_in_masked:
                        diffs.append({
                            "diff_type": DiffType.OVER_MASK,
                            "field_name": field.field_name,
                            "original_value": match,
                            "masked_value": "***",
                            "severity": "high"
                        })

                    for match in new_in_masked:
                        diffs.append({
                            "diff_type": DiffType.NEW_FIELD,
                            "field_name": field.field_name,
                            "original_value": None,
                            "masked_value": match,
                            "severity": "medium"
                        })
                except re.error:
                    continue
        return diffs

    def check_risk_words(self, content: str) -> List[Dict[str, Any]]:
        risks = []
        for risk_word in self.risk_words:
            if risk_word.word.lower() in content.lower():
                risks.append({
                    "word": risk_word.word,
                    "severity": risk_word.severity,
                    "category": risk_word.category
                })
        return risks

    def compare_contents(self, original: str, masked: str) -> List[Dict[str, Any]]:
        diffs = []

        if original == masked:
            return diffs

        retained_diffs = self.check_retained_fields(original, masked)
        diffs.extend(retained_diffs)

        if not retained_diffs and original != masked:
            diffs.append({
                "diff_type": DiffType.CONTENT_CHANGE,
                "field_name": None,
                "original_value": original[:100],
                "masked_value": masked[:100],
                "severity": "low"
            })

        return diffs
