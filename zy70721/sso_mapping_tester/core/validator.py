from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from ..models.mapping import AttributeMapping, MappingRule, MappingType, ValidationRule
from ..models.user import IdentitySourceUser
from ..utils.validation import validate_email, validate_department, validate_not_empty
from ..utils.hash import stable_hash


@dataclass
class ValidationResult:
    field_name: str
    success: bool
    error_message: Optional[str]
    rule: MappingRule
    source_value: Any
    mapped_value: Any
    source_trace: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "field_name": self.field_name,
            "success": self.success,
            "error_message": self.error_message,
            "rule": self.rule.to_dict(),
            "source_value": self.source_value,
            "mapped_value": self.mapped_value,
            "source_trace": self.source_trace,
        }


@dataclass
class UserMappingResult:
    user_id: str
    mapped_attributes: Dict[str, Any]
    validation_results: List[ValidationResult]
    source_user: IdentitySourceUser

    @property
    def success(self) -> bool:
        return all(r.success for r in self.validation_results)

    @property
    def errors(self) -> List[ValidationResult]:
        return [r for r in self.validation_results if not r.success]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "mapped_attributes": self.mapped_attributes,
            "validation_results": [r.to_dict() for r in self.validation_results],
            "source_user": self.source_user.to_dict(),
            "success": self.success,
            "error_count": len(self.errors),
        }


class MappingValidator:
    def __init__(self, mapping: AttributeMapping):
        self.mapping = mapping

    def apply_transform(self, value: Any, transform_expr: str) -> Any:
        if not transform_expr:
            return value

        try:
            if transform_expr == "lower":
                return str(value).lower() if value else value
            elif transform_expr == "upper":
                return str(value).upper() if value else value
            elif transform_expr == "strip":
                return str(value).strip() if value else value
            elif transform_expr.startswith("replace:"):
                parts = transform_expr[8:].split(",", 1)
                if len(parts) == 2:
                    return str(value).replace(parts[0], parts[1]) if value else value
            elif transform_expr.startswith("prefix:"):
                prefix = transform_expr[7:]
                return prefix + str(value) if value else value
            elif transform_expr.startswith("suffix:"):
                suffix = transform_expr[7:]
                return str(value) + suffix if value else value
        except Exception:
            pass
        return value

    def map_field(self, rule: MappingRule, user: IdentitySourceUser) -> tuple[Any, Dict[str, Any]]:
        source_trace = {
            "source_file": user.source_file,
            "line_number": user.line_number,
            "source_field": rule.source_field,
            "target_field": rule.target_field,
            "mapping_type": rule.mapping_type.value,
            "rule_line_number": rule.line_number,
            "rule_file": rule.source_file,
        }

        if rule.mapping_type == MappingType.CONSTANT:
            return rule.constant_value, source_trace

        if rule.mapping_type == MappingType.DIRECT:
            value = user.get(rule.source_field)
            return value, source_trace

        if rule.mapping_type == MappingType.TRANSFORM:
            value = user.get(rule.source_field)
            transformed = self.apply_transform(value, rule.transform_expression)
            source_trace["transform"] = rule.transform_expression
            source_trace["original_value"] = value
            return transformed, source_trace

        if rule.mapping_type == MappingType.CONDITIONAL:
            value = user.get(rule.source_field)
            return value, source_trace

        return user.get(rule.source_field), source_trace

    def validate_field(self, rule: MappingRule, value: Any) -> tuple[bool, Optional[str]]:
        for validation_rule in rule.validation_rules:
            if validation_rule == ValidationRule.REQUIRED:
                ok, msg = validate_not_empty(value, rule.target_field)
                if not ok:
                    return False, msg
            elif validation_rule == ValidationRule.EMAIL:
                if value:
                    ok, msg = validate_email(value)
                    if not ok:
                        return False, msg
            elif validation_rule == ValidationRule.NOT_EMPTY:
                ok, msg = validate_not_empty(value, rule.target_field)
                if not ok:
                    return False, msg

        return True, None

    def validate_user(self, user: IdentitySourceUser) -> UserMappingResult:
        mapped_attributes: Dict[str, Any] = {}
        validation_results: List[ValidationResult] = []

        for rule in self.mapping.rules:
            mapped_value, source_trace = self.map_field(rule, user)
            mapped_attributes[rule.target_field] = mapped_value

            success, error_msg = self.validate_field(rule, mapped_value)

            validation_results.append(ValidationResult(
                field_name=rule.target_field,
                success=success,
                error_message=error_msg,
                rule=rule,
                source_value=user.get(rule.source_field),
                mapped_value=mapped_value,
                source_trace=source_trace,
            ))

        return UserMappingResult(
            user_id=user.source_id,
            mapped_attributes=mapped_attributes,
            validation_results=validation_results,
            source_user=user,
        )

    def validate_all(self, users: List[IdentitySourceUser]) -> List[UserMappingResult]:
        results = []
        for user in users:
            results.append(self.validate_user(user))
        return sorted(results, key=lambda x: stable_hash(x.user_id))
