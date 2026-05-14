import re
from typing import List, Tuple, Optional
from datetime import datetime

from .models import (
    Dependency,
    DetectionRule,
    AuditRecord,
    EvidenceItem,
    DetectionStatus,
    FieldError,
    SourceLocation,
    AuditResult,
)


class LicenseDetector:
    def __init__(self):
        self.rules: List[DetectionRule] = []
        self._init_default_rules()

    def _init_default_rules(self):
        normal_rules = [
            DetectionRule(
                name="GPL-3.0-check",
                description="检测GPL-3.0许可证，该许可证具有强传染性",
                pattern=r"GPL.*3|GPL-3|gnu general public license.*3",
                is_overbroad=False,
                severity="high",
            ),
            DetectionRule(
                name="AGPL-check",
                description="检测AGPL许可证，网络使用也需要开源",
                pattern=r"AGPL|affero",
                is_overbroad=False,
                severity="high",
            ),
            DetectionRule(
                name="MIT-license",
                description="MIT许可证是宽松许可证，通过检测",
                pattern=r"^MIT$|MIT license|The MIT License",
                is_overbroad=False,
                severity="low",
            ),
            DetectionRule(
                name="Apache-2.0-check",
                description="Apache-2.0许可证检测",
                pattern=r"Apache.*2|Apache-2",
                is_overbroad=False,
                severity="low",
            ),
            DetectionRule(
                name="BSD-check",
                description="BSD许可证检测",
                pattern=r"BSD|Berkeley Software Distribution",
                is_overbroad=False,
                severity="low",
            ),
        ]

        overbroad_rules = [
            DetectionRule(
                name="OVERBROAD-any-GPL",
                description="[过宽规则] 只要包含GPL就标记为失败",
                pattern=r"GPL|gpl|General Public License",
                is_overbroad=True,
                severity="high",
            ),
            DetectionRule(
                name="OVERBROAD-non-MIT",
                description="[过宽规则] 不是MIT就标记为失败",
                pattern=r"^(?!.*MIT).*$",
                is_overbroad=True,
                severity="medium",
            ),
        ]

        self.rules.extend(normal_rules)
        self.rules.extend(overbroad_rules)

    def add_rule(self, rule: DetectionRule):
        self.rules.append(rule)

    def get_rules(self, include_overbroad: bool = True) -> List[DetectionRule]:
        if include_overbroad:
            return self.rules
        return [r for r in self.rules if not r.is_overbroad]

    def _match_rule(self, license_text: str, rule: DetectionRule) -> bool:
        flags = re.IGNORECASE if rule.is_overbroad else 0
        return bool(re.search(rule.pattern, license_text, flags=flags))

    def _detect_license(
        self, dependency: Dependency, rule: DetectionRule
    ) -> Tuple[DetectionStatus, str, List[FieldError]]:
        license_text = dependency.license or ""
        errors: List[FieldError] = []

        if not license_text:
            errors.append(
                FieldError(
                    field_name="license",
                    error_message="许可证字段为空",
                    actual_value="",
                    expected_value="有效的许可证名称",
                    source_location=dependency.source_location,
                )
            )
            return DetectionStatus.WARNING, "许可证字段为空", errors

        is_match = self._match_rule(license_text, rule)

        if "OVERBROAD" in rule.name:
            if is_match:
                errors.append(
                    FieldError(
                        field_name="license",
                        error_message=f"过宽规则 '{rule.name}' 匹配: '{license_text}' 被标记为失败",
                        actual_value=license_text,
                        expected_value="需要人工审核确认",
                        source_location=dependency.source_location,
                    )
                )
                return DetectionStatus.FAIL, f"过宽规则匹配: {rule.description}", errors
            else:
                return DetectionStatus.PASS, f"过宽规则未匹配", errors

        if rule.name in ["MIT-license", "Apache-2.0-check", "BSD-check"]:
            if is_match:
                return DetectionStatus.PASS, f"许可证 {license_text} 符合要求", errors
            else:
                return DetectionStatus.PENDING, "需要进一步检测", errors

        if rule.name in ["GPL-3.0-check", "AGPL-check"]:
            if is_match:
                errors.append(
                    FieldError(
                        field_name="license",
                        error_message=f"检测到高风险许可证: {license_text}",
                        actual_value=license_text,
                        expected_value="MIT/Apache/BSD等宽松许可证",
                        source_location=dependency.source_location,
                    )
                )
                return DetectionStatus.FAIL, f"高风险许可证: {rule.description}", errors
            else:
                return DetectionStatus.PASS, "未检测到高风险许可证", errors

        return DetectionStatus.PENDING, "未知规则", errors

    def audit(
        self, dependencies: List[Dependency], use_overbroad_rules: bool = False
    ) -> AuditResult:
        rules = self.get_rules(include_overbroad=use_overbroad_rules)
        records: List[AuditRecord] = []
        evidences: List[EvidenceItem] = []

        pass_count = 0
        fail_count = 0
        warning_count = 0
        pending_count = 0

        for dep in dependencies:
            for rule in rules:
                status, reason, errors = self._detect_license(dep, rule)

                if status == DetectionStatus.PASS:
                    if not use_overbroad_rules and "OVERBROAD" not in rule.name:
                        pass_count += 1
                elif status == DetectionStatus.FAIL:
                    fail_count += 1
                elif status == DetectionStatus.WARNING:
                    warning_count += 1
                else:
                    pending_count += 1

                record = AuditRecord(
                    dependency_id=dep.id,
                    dependency_name=dep.name,
                    environment_name=dep.environment_name,
                    detection_rule_id=rule.id,
                    detection_rule_name=rule.name,
                    system_status=status,
                    system_reason=reason,
                    field_errors=errors,
                )
                records.append(record)

                evidence = EvidenceItem(
                    audit_record_id=record.id,
                    field_name="license",
                    original_value=dep.license or "",
                    source_location=dep.source_location,
                    evidence_type="license_detection",
                )
                evidences.append(evidence)

        return AuditResult(
            total_dependencies=len(dependencies),
            pass_count=pass_count,
            fail_count=fail_count,
            warning_count=warning_count,
            pending_count=pending_count,
            records=records,
            evidences=evidences,
        )
