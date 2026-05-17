import re
from typing import List, Optional
from .models import (
    ImageInfo,
    ValidationResult,
    ValidationError,
    ValidationStatus,
    NamingRule,
)


class TagValidator:
    DEFAULT_RULES = [
        NamingRule(
            name="semantic_version",
            pattern=r'^v?\d+\.\d+\.\d+',
            description="标签必须包含语义化版本号 (x.y.z)",
            examples=["v1.2.3", "2.0.1-beta"],
            bad_examples=["latest", "v1", "build-123"],
        ),
        NamingRule(
            name="commit_hash",
            pattern=r'[0-9a-f]{7,40}',
            description="标签应包含Git提交哈希 (7-40位十六进制)",
            required=False,
            examples=["a1b2c3d", "abc123def456"],
            bad_examples=["123", "g1h2i3j"],
        ),
        NamingRule(
            name="environment_stage",
            pattern=r'-(dev|test|staging|prod)$',
            description="标签应以环境阶段结尾 (-dev/-test/-staging/-prod)",
            examples=["v1.2.3-dev", "2.0.0-prod"],
            bad_examples=["v1.2.3-production", "dev-v1.0.0"],
        ),
        NamingRule(
            name="no_latest",
            pattern=r'^(?!latest$)',
            description="禁止使用 'latest' 标签",
            examples=["v1.0.0"],
            bad_examples=["latest"],
        ),
        NamingRule(
            name="lowercase_only",
            pattern=r'^[a-z0-9._-]+$',
            description="标签只能使用小写字母、数字、点、下划线和连字符",
            examples=["v1.2.3-beta", "build-20240101"],
            bad_examples=["V1.2.3", "Release-1.0"],
        ),
        NamingRule(
            name="length_limit",
            pattern=r'^.{1,128}$',
            description="标签长度应在1-128字符之间",
            examples=["v1.0.0"],
            bad_examples=["a" * 130],
        ),
    ]

    def __init__(self, custom_rules: Optional[List[NamingRule]] = None):
        self.rules = custom_rules if custom_rules else self.DEFAULT_RULES

    def validate(self, image_info: ImageInfo) -> ValidationResult:
        errors: List[ValidationError] = []
        warnings: List[ValidationError] = []
        tag = image_info.tag

        if not tag:
            errors.append(
                ValidationError(
                    code="empty_tag",
                    message="标签为空",
                    severity=ValidationStatus.INVALID,
                    suggestion="请指定有效的镜像标签",
                )
            )

        for rule in self.rules:
            if not re.search(rule.pattern, tag):
                error = ValidationError(
                    code=rule.name,
                    message=rule.description,
                    severity=ValidationStatus.WARNING if not rule.required else ValidationStatus.INVALID,
                    field="tag",
                    suggestion=f"参考示例: {', '.join(rule.examples) if rule.examples else '无'}",
                )
                if error.severity == ValidationStatus.INVALID:
                    errors.append(error)
                else:
                    warnings.append(error)

        if image_info.commit_hash and image_info.parsed_commit:
            if image_info.commit_hash != image_info.parsed_commit:
                warnings.append(
                    ValidationError(
                        code="commit_mismatch",
                        message=f"提交号不匹配: 输入 '{image_info.commit_hash}' vs 标签解析 '{image_info.parsed_commit}'",
                        severity=ValidationStatus.WARNING,
                        field="commit_hash",
                    )
                )

        if image_info.environment and image_info.parsed_stage:
            if image_info.environment != image_info.parsed_stage:
                warnings.append(
                    ValidationError(
                        code="stage_mismatch",
                        message=f"环境阶段不匹配: 输入 '{image_info.environment}' vs 标签解析 '{image_info.parsed_stage}'",
                        severity=ValidationStatus.WARNING,
                        field="environment",
                    )
                )

        if errors:
            status = ValidationStatus.INVALID
        elif warnings:
            status = ValidationStatus.WARNING
        else:
            status = ValidationStatus.VALID

        return ValidationResult(
            image_info=image_info,
            status=status,
            errors=errors,
            warnings=warnings,
        )
