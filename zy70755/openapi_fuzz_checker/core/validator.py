import jsonschema
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from enum import Enum
from ..utils.logger import get_logger
from .mutator import MutatedExample, MutationType

logger = get_logger(__name__)


class ValidationResultType(Enum):
    PASS = "pass"
    FAIL = "fail"
    WARNING = "warning"


@dataclass
class ValidationError:
    error_type: str
    message: str
    path: str
    attribute: Optional[str] = None
    expected: Optional[Any] = None
    actual: Optional[Any] = None


@dataclass
class ValidationResult:
    mutated_example: MutatedExample
    result_type: ValidationResultType
    errors: List[ValidationError]
    is_false_positive: bool = False
    attribution: Optional[str] = None


class SchemaValidator:
    def __init__(self, schema: Dict[str, Any]):
        self.schema = schema
        self.validator = jsonschema.Draft7Validator(schema)

    def validate(self, instance: Any) -> List[ValidationError]:
        errors = []
        for error in self.validator.iter_errors(instance):
            path = ".".join(str(p) for p in error.path) if error.path else "root"
            validation_error = ValidationError(
                error_type=error.validator,
                message=error.message,
                path=path,
                attribute=error.validator_value,
            )
            errors.append(validation_error)
        return errors

    def validate_mutated_example(
        self, mutated_example: MutatedExample
    ) -> ValidationResult:
        errors = self.validate(mutated_example.mutated)

        if errors:
            result_type = ValidationResultType.FAIL
            attribution = self._attribute_error(mutated_example, errors)
        else:
            result_type = ValidationResultType.PASS
            attribution = "验证通过"

        is_false_positive = self._check_false_positive(mutated_example, errors)

        return ValidationResult(
            mutated_example=mutated_example,
            result_type=result_type,
            errors=errors,
            is_false_positive=is_false_positive,
            attribution=attribution,
        )

    def _attribute_error(
        self, mutated_example: MutatedExample, errors: List[ValidationError]
    ) -> str:
        mutation_type = mutated_example.mutation_type
        mutation_path = mutated_example.path

        related_errors = [
            e for e in errors if self._path_matches(e.path, mutation_path)
        ]

        if related_errors:
            error_descriptions = []
            for error in related_errors[:3]:
                error_descriptions.append(f"{error.path}: {error.error_type}")

            attribution = f"扰动类型: {mutation_type.value}, 影响字段: {mutation_path}"
            if error_descriptions:
                attribution += f", 验证错误: {', '.join(error_descriptions)}"
            return attribution

        if errors:
            return f"扰动类型: {mutation_type.value}, 影响范围: 其他字段验证失败"

        return "未知原因"

    def _path_matches(self, error_path: str, mutation_path: str) -> bool:
        if error_path == mutation_path:
            return True
        if error_path.startswith(f"{mutation_path}."):
            return True
        if mutation_path == "" and "." not in error_path:
            return True
        return False

    def _check_false_positive(
        self, mutated_example: MutatedExample, errors: List[ValidationError]
    ) -> bool:
        mutation_type = mutated_example.mutation_type

        if mutation_type in [
            MutationType.REMOVE_REQUIRED_FIELD,
            MutationType.TYPE_MISMATCH,
            MutationType.WRONG_ENUM,
            MutationType.BOUNDARY_VALUE,
        ]:
            return len(errors) == 0

        if mutation_type in [
            MutationType.ARRAY_REORDER,
            MutationType.ADD_EXTRA_FIELD,
        ]:
            return len(errors) > 0

        return False

    def classify_errors(
        self, results: List[ValidationResult]
    ) -> Dict[str, List[ValidationResult]]:
        classification = {
            "missing_required": [],
            "type_mismatch": [],
            "enum_violation": [],
            "boundary_violation": [],
            "format_violation": [],
            "additional_properties": [],
            "other": [],
        }

        for result in results:
            for error in result.errors:
                if error.error_type == "required":
                    classification["missing_required"].append(result)
                    break
                elif error.error_type == "type":
                    classification["type_mismatch"].append(result)
                    break
                elif error.error_type == "enum":
                    classification["enum_violation"].append(result)
                    break
                elif error.error_type in ["minimum", "maximum", "minLength", "maxLength"]:
                    classification["boundary_violation"].append(result)
                    break
                elif error.error_type == "format":
                    classification["format_violation"].append(result)
                    break
                elif error.error_type == "additionalProperties":
                    classification["additional_properties"].append(result)
                    break
            else:
                if result.result_type == ValidationResultType.FAIL:
                    classification["other"].append(result)

        return classification
