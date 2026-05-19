import json
import random
import hashlib
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

import jsonschema
from faker import Faker


class SampleType(str, Enum):
    VALID = "valid"
    BOUNDARY = "boundary"
    INVALID = "invalid"
    EDGE_CASE = "edge_case"


@dataclass
class Sample:
    id: str
    type: SampleType
    data: Dict[str, Any]
    reason: Optional[str] = None
    field: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type.value,
            "data": self.data,
            "reason": self.reason,
            "field": self.field
        }


class SchemaSampleGenerator:
    def __init__(self, schema: Dict[str, Any], seed: int = 42):
        self.schema = schema
        self.seed = seed
        self.fake = Faker()
        Faker.seed(seed)
        random.seed(seed)
        self.samples: List[Sample] = []

    def _generate_id(self, data: Dict[str, Any], prefix: str) -> str:
        data_str = json.dumps(data, sort_keys=True)
        hash_part = hashlib.md5(data_str.encode()).hexdigest()[:8]
        return f"{prefix}_{hash_part}"

    def _resolve_refs(self, schema_part: Dict[str, Any]) -> Dict[str, Any]:
        if "$ref" in schema_part:
            ref_path = schema_part["$ref"].replace("#/", "").split("/")
            resolved = self.schema
            for part in ref_path:
                resolved = resolved.get(part, {})
            return resolved
        return schema_part

    def generate_valid_sample(self, schema_part: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        schema_part = schema_part or self.schema
        schema_part = self._resolve_refs(schema_part)

        if "type" not in schema_part:
            return {}

        schema_type = schema_part["type"]

        if schema_type == "object":
            return self._generate_valid_object(schema_part)
        elif schema_type == "array":
            return self._generate_valid_array(schema_part)
        elif schema_type == "string":
            return self._generate_valid_string(schema_part)
        elif schema_type == "number" or schema_type == "integer":
            return self._generate_valid_number(schema_part)
        elif schema_type == "boolean":
            return random.choice([True, False])
        elif schema_type == "null":
            return None

        return {}

    def _generate_valid_object(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        for prop_name, prop_schema in properties.items():
            if prop_name in required or random.random() > 0.3:
                result[prop_name] = self.generate_valid_sample(prop_schema)

        return result

    def _generate_valid_array(self, schema: Dict[str, Any]) -> List[Any]:
        items = schema.get("items", {})
        min_items = schema.get("minItems", 0)
        max_items = schema.get("maxItems", 5)

        if max_items == 0:
            return []

        lower = min_items
        upper = min(max_items, 5)
        count = random.randint(lower, upper)
        return [self.generate_valid_sample(items) for _ in range(count)]

    def _generate_valid_string(self, schema: Dict[str, Any]) -> str:
        min_length = schema.get("minLength", 1)
        max_length = schema.get("maxLength", 20)
        pattern = schema.get("pattern")
        enum_values = schema.get("enum")
        format_type = schema.get("format")

        if enum_values:
            return random.choice(enum_values)

        if format_type == "email":
            return self.fake.email()
        elif format_type == "date-time":
            return self.fake.iso8601()
        elif format_type == "uri":
            return self.fake.url()
        elif format_type == "uuid":
            return str(self.fake.uuid4())

        length = random.randint(min_length, min(max_length, 20))
        if length == 0:
            return ""
        if length < 5:
            return "x" * length
        return self.fake.text(length)[:length].strip()

    def _generate_valid_number(self, schema: Dict[str, Any]) -> float:
        minimum = schema.get("minimum", 0)
        maximum = schema.get("maximum", 100)
        is_integer = schema.get("type") == "integer"

        if is_integer:
            return random.randint(int(minimum), int(maximum))
        return round(random.uniform(minimum, maximum), 2)

    def generate_boundary_samples(self) -> List[Sample]:
        samples = []
        properties = self.schema.get("properties", {})

        for field_name, field_schema in properties.items():
            field_schema = self._resolve_refs(field_schema)
            field_samples = self._generate_field_boundary_samples(field_name, field_schema)
            samples.extend(field_samples)

        return samples

    def _generate_field_boundary_samples(self, field_name: str, field_schema: Dict[str, Any]) -> List[Sample]:
        samples = []
        schema_type = field_schema.get("type", "string")

        base_valid = self.generate_valid_sample()

        if schema_type == "string":
            if "minLength" in field_schema:
                min_len = field_schema["minLength"]
                data = base_valid.copy()
                data[field_name] = "x" * min_len
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_minlen"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"String at minimum length {min_len}",
                    field=field_name
                )
                samples.append(sample)

            if "maxLength" in field_schema:
                max_len = field_schema["maxLength"]
                data = base_valid.copy()
                data[field_name] = "x" * max_len
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_maxlen"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"String at maximum length {max_len}",
                    field=field_name
                )
                samples.append(sample)

        elif schema_type in ["number", "integer"]:
            if "minimum" in field_schema:
                data = base_valid.copy()
                data[field_name] = field_schema["minimum"]
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_min"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"Number at minimum value {field_schema['minimum']}",
                    field=field_name
                )
                samples.append(sample)

            if "maximum" in field_schema:
                data = base_valid.copy()
                data[field_name] = field_schema["maximum"]
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_max"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"Number at maximum value {field_schema['maximum']}",
                    field=field_name
                )
                samples.append(sample)

        elif schema_type == "array":
            if "minItems" in field_schema:
                min_items = field_schema["minItems"]
                item_schema = field_schema.get("items", {})
                data = base_valid.copy()
                data[field_name] = [self.generate_valid_sample(item_schema) for _ in range(min_items)]
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_minitems"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"Array at minimum items {min_items}",
                    field=field_name
                )
                samples.append(sample)

            if "maxItems" in field_schema:
                max_items = field_schema["maxItems"]
                item_schema = field_schema.get("items", {})
                data = base_valid.copy()
                data[field_name] = [self.generate_valid_sample(item_schema) for _ in range(max_items)]
                sample = Sample(
                    id=self._generate_id(data, f"boundary_{field_name}_maxitems"),
                    type=SampleType.BOUNDARY,
                    data=data,
                    reason=f"Array at maximum items {max_items}",
                    field=field_name
                )
                samples.append(sample)

        return samples

    def generate_invalid_samples(self) -> List[Sample]:
        samples = []
        properties = self.schema.get("properties", {})
        required = self.schema.get("required", [])

        base_valid = self.generate_valid_sample()

        for field_name, field_schema in properties.items():
            field_schema = self._resolve_refs(field_schema)
            field_samples = self._generate_field_invalid_samples(field_name, field_schema, base_valid)
            samples.extend(field_samples)

        for req_field in required:
            data = base_valid.copy()
            if req_field in data:
                del data[req_field]
                sample = Sample(
                    id=self._generate_id(data, f"invalid_missing_{req_field}"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"Missing required field '{req_field}'",
                    field=req_field
                )
                samples.append(sample)

        return samples

    def _generate_field_invalid_samples(self, field_name: str, field_schema: Dict[str, Any], base: Dict[str, Any]) -> List[Sample]:
        samples = []
        schema_type = field_schema.get("type", "string")

        if schema_type == "string":
            if "minLength" in field_schema:
                min_len = field_schema["minLength"]
                if min_len > 0:
                    data = base.copy()
                    data[field_name] = "x" * (min_len - 1)
                    sample = Sample(
                        id=self._generate_id(data, f"invalid_{field_name}_short"),
                        type=SampleType.INVALID,
                        data=data,
                        reason=f"String too short: length {min_len - 1} < minLength {min_len}",
                        field=field_name
                    )
                    samples.append(sample)

            if "maxLength" in field_schema:
                max_len = field_schema["maxLength"]
                data = base.copy()
                data[field_name] = "x" * (max_len + 1)
                sample = Sample(
                    id=self._generate_id(data, f"invalid_{field_name}_long"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"String too long: length {max_len + 1} > maxLength {max_len}",
                    field=field_name
                )
                samples.append(sample)

            if "pattern" in field_schema:
                data = base.copy()
                data[field_name] = "!!!invalid_pattern!!!"
                sample = Sample(
                    id=self._generate_id(data, f"invalid_{field_name}_pattern"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"String does not match pattern {field_schema['pattern']}",
                    field=field_name
                )
                samples.append(sample)

        elif schema_type in ["number", "integer"]:
            if "minimum" in field_schema:
                data = base.copy()
                data[field_name] = field_schema["minimum"] - 1
                sample = Sample(
                    id=self._generate_id(data, f"invalid_{field_name}_under"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"Number below minimum: {data[field_name]} < {field_schema['minimum']}",
                    field=field_name
                )
                samples.append(sample)

            if "maximum" in field_schema:
                data = base.copy()
                data[field_name] = field_schema["maximum"] + 1
                sample = Sample(
                    id=self._generate_id(data, f"invalid_{field_name}_over"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"Number above maximum: {data[field_name]} > {field_schema['maximum']}",
                    field=field_name
                )
                samples.append(sample)

        elif schema_type == "array":
            item_schema = field_schema.get("items", {})
            if "minItems" in field_schema:
                min_items = field_schema["minItems"]
                if min_items > 0:
                    data = base.copy()
                    data[field_name] = [self.generate_valid_sample(item_schema) for _ in range(min_items - 1)]
                    sample = Sample(
                        id=self._generate_id(data, f"invalid_{field_name}_few"),
                        type=SampleType.INVALID,
                        data=data,
                        reason=f"Array too few items: {min_items - 1} < minItems {min_items}",
                        field=field_name
                    )
                    samples.append(sample)

            if "maxItems" in field_schema:
                max_items = field_schema["maxItems"]
                data = base.copy()
                data[field_name] = [self.generate_valid_sample(item_schema) for _ in range(max_items + 1)]
                sample = Sample(
                    id=self._generate_id(data, f"invalid_{field_name}_many"),
                    type=SampleType.INVALID,
                    data=data,
                    reason=f"Array too many items: {max_items + 1} > maxItems {max_items}",
                    field=field_name
                )
                samples.append(sample)

        if "enum" in field_schema:
            data = base.copy()
            data[field_name] = "NOT_IN_ENUM_VALUE"
            sample = Sample(
                id=self._generate_id(data, f"invalid_{field_name}_enum"),
                type=SampleType.INVALID,
                data=data,
                reason=f"Value not in enum: {field_schema['enum']}",
                field=field_name
            )
            samples.append(sample)

        type_mismatches = {
            "string": 12345,
            "number": "not_a_number",
            "integer": "not_an_integer",
            "boolean": "not_boolean",
            "array": "not_an_array",
            "object": "not_an_object"
        }
        if schema_type in type_mismatches:
            data = base.copy()
            data[field_name] = type_mismatches[schema_type]
            sample = Sample(
                id=self._generate_id(data, f"invalid_{field_name}_type"),
                type=SampleType.INVALID,
                data=data,
                reason=f"Type mismatch: expected {schema_type}, got {type(data[field_name]).__name__}",
                field=field_name
            )
            samples.append(sample)

        return samples

    def generate_edge_cases(self) -> List[Sample]:
        samples = []

        sample = Sample(
            id="edge_empty",
            type=SampleType.EDGE_CASE,
            data={},
            reason="Empty object",
            field=None
        )
        samples.append(sample)

        sample = Sample(
            id="edge_null",
            type=SampleType.EDGE_CASE,
            data=None,
            reason="Null value",
            field=None
        )
        samples.append(sample)

        properties = self.schema.get("properties", {})
        if properties:
            all_null = {k: None for k in properties.keys()}
            sample = Sample(
                id="edge_all_null",
                type=SampleType.EDGE_CASE,
                data=all_null,
                reason="All fields set to null",
                field=None
            )
            samples.append(sample)

        return samples

    def generate_all(self) -> List[Sample]:
        self.samples = []

        valid_data = self.generate_valid_sample()
        self.samples.append(Sample(
            id=self._generate_id(valid_data, "valid"),
            type=SampleType.VALID,
            data=valid_data,
            reason="Valid sample",
            field=None
        ))

        self.samples.extend(self.generate_boundary_samples())
        self.samples.extend(self.generate_invalid_samples())
        self.samples.extend(self.generate_edge_cases())

        return self.samples

    def validate_sample(self, sample: Sample) -> Tuple[bool, Optional[str]]:
        try:
            jsonschema.validate(instance=sample.data, schema=self.schema)
            return True, None
        except jsonschema.ValidationError as e:
            return False, str(e.message)
        except Exception as e:
            return False, str(e)
