import hashlib
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .models import (
    Contract,
    Sample,
    FieldDrift,
    DiffType,
    FieldType,
    SampleField,
    FieldDefinition,
)


def normalize_path_for_matching(path: str) -> str:
    return re.sub(r'\[\d+\]', '[*]', path)


def get_parent_path(path: str) -> Optional[str]:
    if '.' not in path:
        return None
    parts = path.rsplit('.', 1)
    return parts[0]


def is_path_present_via_children(path: str, existing_paths: Set[str]) -> bool:
    for p in existing_paths:
        if p.startswith(path + '.') or p.startswith(path + '['):
            return True
    return False


def match_paths(
    contract_paths: Set[str], sample_paths: Set[str]
) -> Tuple[Dict[str, str], Set[str], Set[str]]:
    sample_to_contract: Dict[str, str] = {}
    unmatched_contract: Set[str] = set(contract_paths)
    unmatched_sample: Set[str] = set(sample_paths)

    for sample_path in sample_paths:
        normalized = normalize_path_for_matching(sample_path)
        if normalized in contract_paths:
            sample_to_contract[sample_path] = normalized
            if sample_path in unmatched_sample:
                unmatched_sample.remove(sample_path)
            if normalized in unmatched_contract:
                unmatched_contract.remove(normalized)

    contract_paths_list = list(unmatched_contract)
    for contract_path in contract_paths_list:
        if is_path_present_via_children(contract_path, sample_paths):
            unmatched_contract.remove(contract_path)

    return sample_to_contract, unmatched_contract, unmatched_sample


class DriftDetector:
    def __init__(self):
        self.type_compatibility: Dict[FieldType, Set[FieldType]] = {
            FieldType.STRING: {FieldType.STRING, FieldType.NULL},
            FieldType.NUMBER: {
                FieldType.NUMBER,
                FieldType.INTEGER,
                FieldType.NULL,
            },
            FieldType.INTEGER: {FieldType.INTEGER, FieldType.NULL},
            FieldType.BOOLEAN: {FieldType.BOOLEAN, FieldType.NULL},
            FieldType.OBJECT: {FieldType.OBJECT, FieldType.NULL},
            FieldType.ARRAY: {FieldType.ARRAY, FieldType.NULL},
            FieldType.NULL: {FieldType.NULL},
        }

    def detect_drifts(
        self, contract: Contract, samples: List[Sample]
    ) -> List[FieldDrift]:
        all_drifts = []
        contract_fields = {f.path: f for f in contract.fields}

        for sample in samples:
            sample_drifts = self._detect_sample_drifts(
                contract, sample, contract_fields
            )
            all_drifts.extend(sample_drifts)

        return sorted(all_drifts, key=lambda d: (d.sample_id, d.field_path))

    def _detect_sample_drifts(
        self,
        contract: Contract,
        sample: Sample,
        contract_fields: Dict[str, FieldDefinition],
    ) -> List[FieldDrift]:
        drifts = []
        sample_fields = {f.path: f for f in sample.fields}

        contract_paths = set(contract_fields.keys())
        sample_paths = set(sample_fields.keys())

        sample_to_contract, unmatched_contract, unmatched_sample = match_paths(
            contract_paths, sample_paths
        )

        for sample_path, contract_path in sorted(sample_to_contract.items()):
            contract_field = contract_fields[contract_path]
            sample_field = sample_fields[sample_path]
            path_drifts = self._check_field(
                contract, sample, sample_path, contract_field, sample_field
            )
            drifts.extend(path_drifts)

        contract_non_array_paths = [
            p for p in unmatched_contract if '[*]' not in p
        ]
        for contract_path in sorted(contract_non_array_paths):
            contract_field = contract_fields[contract_path]
            path_drifts = self._check_field(
                contract, sample, contract_path, contract_field, None
            )
            drifts.extend(path_drifts)

        for sample_path in sorted(unmatched_sample):
            sample_field = sample_fields[sample_path]
            path_drifts = self._check_field(
                contract, sample, sample_path, None, sample_field
            )
            drifts.extend(path_drifts)

        return drifts

    def _check_field(
        self,
        contract: Contract,
        sample: Sample,
        path: str,
        contract_field: Optional[FieldDefinition],
        sample_field: Optional[SampleField],
    ) -> List[FieldDrift]:
        drifts = []

        if contract_field is None and sample_field is not None:
            drifts.append(
                self._create_drift(
                    contract=contract,
                    sample=sample,
                    field_path=path,
                    diff_type=DiffType.FIELD_ADDED,
                    actual=sample_field.value,
                    actual_type=sample_field.inferred_type,
                    sample_source=sample_field.source,
                    message=f"字段 '{path}' 在样例中存在，但契约中未定义",
                )
            )
        elif sample_field is None and contract_field is not None:
            if contract_field.required:
                drifts.append(
                    self._create_drift(
                        contract=contract,
                        sample=sample,
                        field_path=path,
                        diff_type=DiffType.REQUIRED_VIOLATION,
                        expected=contract_field.type.value,
                        expected_type=contract_field.type,
                        contract_source=contract_field.source,
                        message=f"必填字段 '{path}' 在样例中缺失",
                    )
                )
            else:
                drifts.append(
                    self._create_drift(
                        contract=contract,
                        sample=sample,
                        field_path=path,
                        diff_type=DiffType.FIELD_MISSING,
                        expected=contract_field.type.value,
                        expected_type=contract_field.type,
                        contract_source=contract_field.source,
                        message=f"字段 '{path}' 在契约中定义，但样例中缺失",
                    )
                )
        elif contract_field is not None and sample_field is not None:
            type_drift = self._check_type_compatibility(
                contract, sample, path, contract_field, sample_field
            )
            if type_drift:
                drifts.append(type_drift)

            format_drift = self._check_format(
                contract, sample, path, contract_field, sample_field
            )
            if format_drift:
                drifts.append(format_drift)

        return drifts

    def _check_type_compatibility(
        self,
        contract: Contract,
        sample: Sample,
        path: str,
        contract_field: FieldDefinition,
        sample_field: SampleField,
    ) -> Optional[FieldDrift]:
        expected_type = contract_field.type
        actual_type = sample_field.inferred_type

        if contract_field.nullable and actual_type == FieldType.NULL:
            return None

        compatible_types = self.type_compatibility.get(expected_type, set())

        if actual_type not in compatible_types:
            return self._create_drift(
                contract=contract,
                sample=sample,
                field_path=path,
                diff_type=DiffType.TYPE_MISMATCH,
                expected=expected_type.value,
                actual=actual_type.value,
                expected_type=expected_type,
                actual_type=actual_type,
                sample_source=sample_field.source,
                contract_source=contract_field.source,
                message=(
                    f"字段 '{path}' 类型不匹配: "
                    f"契约期望 {expected_type.value}, "
                    f"样例实际 {actual_type.value}"
                ),
            )

        return None

    def _check_format(
        self,
        contract: Contract,
        sample: Sample,
        path: str,
        contract_field: FieldDefinition,
        sample_field: SampleField,
    ) -> Optional[FieldDrift]:
        if not contract_field.format:
            return None

        format_validators = {
            "date-time": self._validate_datetime,
            "date": self._validate_date,
            "time": self._validate_time,
            "email": self._validate_email,
            "uuid": self._validate_uuid,
            "uri": self._validate_uri,
            "ipv4": self._validate_ipv4,
            "ipv6": self._validate_ipv6,
        }

        validator = format_validators.get(contract_field.format)
        if validator and not validator(sample_field.value):
            return self._create_drift(
                contract=contract,
                sample=sample,
                field_path=path,
                diff_type=DiffType.FORMAT_MISMATCH,
                expected=contract_field.format,
                actual=sample_field.value,
                sample_source=sample_field.source,
                contract_source=contract_field.source,
                message=(
                    f"字段 '{path}' 格式不匹配: "
                    f"期望格式 {contract_field.format}, "
                    f"实际值 '{sample_field.value}'"
                ),
            )

        return None

    def _create_drift(
        self,
        contract: Contract,
        sample: Sample,
        field_path: str,
        diff_type: DiffType,
        expected: Optional[Any] = None,
        actual: Optional[Any] = None,
        expected_type: Optional[FieldType] = None,
        actual_type: Optional[FieldType] = None,
        sample_source: Optional[Any] = None,
        contract_source: Optional[Any] = None,
        message: str = "",
    ) -> FieldDrift:
        drift_id = self._generate_drift_id(
            contract.id, sample.id, field_path, diff_type.value
        )
        return FieldDrift(
            drift_id=drift_id,
            contract_id=contract.id,
            sample_id=sample.id,
            field_path=field_path,
            diff_type=diff_type,
            expected=expected,
            actual=actual,
            expected_type=expected_type,
            actual_type=actual_type,
            sample_source=sample_source,
            contract_source=contract_source,
            message=message,
        )

    def _generate_drift_id(
        self,
        contract_id: str,
        sample_id: str,
        field_path: str,
        diff_type: str,
    ) -> str:
        key = f"{contract_id}:{sample_id}:{field_path}:{diff_type}"
        return hashlib.md5(key.encode()).hexdigest()[:16]

    def _validate_datetime(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$"
        return bool(re.match(pattern, value))

    def _validate_date(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^\d{4}-\d{2}-\d{2}$"
        return bool(re.match(pattern, value))

    def _validate_time(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^\d{2}:\d{2}:\d{2}(?:\.\d+)?$"
        return bool(re.match(pattern, value))

    def _validate_email(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(pattern, value))

    def _validate_uuid(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
        return bool(re.match(pattern, value.lower()))

    def _validate_uri(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        return value.startswith(("http://", "https://", "ftp://"))

    def _validate_ipv4(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = r"^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
        return bool(re.match(pattern, value))

    def _validate_ipv6(self, value: Any) -> bool:
        if not isinstance(value, str):
            return False
        import re

        pattern = (
            r"^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|"
            r"^::(?:[0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|"
            r"^[0-9a-fA-F]{1,4}::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4}$"
        )
        return bool(re.match(pattern, value))
