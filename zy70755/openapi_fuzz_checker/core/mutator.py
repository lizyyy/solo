import copy
import random
from typing import Any, Dict, List, Iterator, Tuple
from dataclasses import dataclass
from enum import Enum
from ..utils.logger import get_logger

logger = get_logger(__name__)


class MutationType(Enum):
    NULL_VALUE = "null_value"
    EMPTY_STRING = "empty_string"
    EMPTY_ARRAY = "empty_array"
    EMPTY_OBJECT = "empty_object"
    ARRAY_REORDER = "array_reorder"
    ARRAY_DUPLICATE = "array_duplicate"
    REMOVE_REQUIRED_FIELD = "remove_required_field"
    REMOVE_OPTIONAL_FIELD = "remove_optional_field"
    TYPE_MISMATCH = "type_mismatch"
    WRONG_ENUM = "wrong_enum"
    BOUNDARY_VALUE = "boundary_value"
    DIRTY_DATA = "dirty_data"
    ADD_EXTRA_FIELD = "add_extra_field"


@dataclass
class MutatedExample:
    original: Any
    mutated: Any
    mutation_type: MutationType
    path: str
    description: str


class ExampleMutator:
    def __init__(self, schema: Dict[str, Any]):
        self.schema = schema
        self.required_fields = schema.get("required", [])

    def generate_mutations(self, example: Any) -> Iterator[MutatedExample]:
        if example is None:
            return

        yield from self._mutate_object(example, self.schema, "")

    def _mutate_object(
        self, obj: Any, schema: Dict[str, Any], path: str
    ) -> Iterator[MutatedExample]:
        schema_type = schema.get("type", "object")

        if schema_type == "object" and isinstance(obj, dict):
            yield from self._mutate_dict_object(obj, schema, path)

        elif schema_type == "array" and isinstance(obj, list):
            yield from self._mutate_array_object(obj, schema, path)

        elif schema_type in ["string", "integer", "number", "boolean"]:
            yield from self._mutate_primitive(obj, schema, path)

    def _mutate_dict_object(
        self, obj: Dict[str, Any], schema: Dict[str, Any], path: str
    ) -> Iterator[MutatedExample]:
        properties = schema.get("properties", {})

        for field_name in list(obj.keys()):
            field_path = f"{path}.{field_name}" if path else field_name
            field_schema = properties.get(field_name, {})

            if field_name in self.required_fields:
                new_obj = copy.deepcopy(obj)
                del new_obj[field_name]
                yield MutatedExample(
                    original=obj,
                    mutated=new_obj,
                    mutation_type=MutationType.REMOVE_REQUIRED_FIELD,
                    path=field_path,
                    description=f"移除必填字段: {field_path}",
                )
            else:
                new_obj = copy.deepcopy(obj)
                del new_obj[field_name]
                yield MutatedExample(
                    original=obj,
                    mutated=new_obj,
                    mutation_type=MutationType.REMOVE_OPTIONAL_FIELD,
                    path=field_path,
                    description=f"移除可选字段: {field_path}",
                )

            field_value = obj[field_name]
            if isinstance(field_value, dict):
                for mutation in self._mutate_object(field_value, field_schema, field_path):
                    new_obj = copy.deepcopy(obj)
                    new_obj[field_name] = mutation.mutated
                    yield MutatedExample(
                        original=obj,
                        mutated=new_obj,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )
            elif isinstance(field_value, list):
                for mutation in self._mutate_object(field_value, field_schema, field_path):
                    new_obj = copy.deepcopy(obj)
                    new_obj[field_name] = mutation.mutated
                    yield MutatedExample(
                        original=obj,
                        mutated=new_obj,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )
            else:
                for mutation in self._mutate_primitive(field_value, field_schema, field_path):
                    new_obj = copy.deepcopy(obj)
                    new_obj[field_name] = mutation.mutated
                    yield MutatedExample(
                        original=obj,
                        mutated=new_obj,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )

        new_obj = copy.deepcopy(obj)
        new_obj["__extra_field__"] = "extra_value"
        yield MutatedExample(
            original=obj,
            mutated=new_obj,
            mutation_type=MutationType.ADD_EXTRA_FIELD,
            path=path,
            description=f"添加额外字段到: {path or 'root'}",
        )

    def _mutate_array_object(
        self, arr: List[Any], schema: Dict[str, Any], path: str
    ) -> Iterator[MutatedExample]:
        item_schema = schema.get("items", {})

        if len(arr) > 1:
            shuffled = arr.copy()
            random.shuffle(shuffled)
            yield MutatedExample(
                original=arr,
                mutated=shuffled,
                mutation_type=MutationType.ARRAY_REORDER,
                path=path,
                description=f"数组顺序打乱: {path}",
            )

        if len(arr) > 0:
            duplicated = arr + [arr[0]]
            yield MutatedExample(
                original=arr,
                mutated=duplicated,
                mutation_type=MutationType.ARRAY_DUPLICATE,
                path=path,
                description=f"数组元素重复: {path}",
            )

        yield MutatedExample(
            original=arr,
            mutated=[],
            mutation_type=MutationType.EMPTY_ARRAY,
            path=path,
            description=f"数组置空: {path}",
        )

        for i, item in enumerate(arr):
            item_path = f"{path}[{i}]"
            if isinstance(item, dict):
                for mutation in self._mutate_object(item, item_schema, item_path):
                    new_arr = arr.copy()
                    new_arr[i] = mutation.mutated
                    yield MutatedExample(
                        original=arr,
                        mutated=new_arr,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )
            elif isinstance(item, list):
                for mutation in self._mutate_object(item, item_schema, item_path):
                    new_arr = arr.copy()
                    new_arr[i] = mutation.mutated
                    yield MutatedExample(
                        original=arr,
                        mutated=new_arr,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )
            else:
                for mutation in self._mutate_primitive(item, item_schema, item_path):
                    new_arr = arr.copy()
                    new_arr[i] = mutation.mutated
                    yield MutatedExample(
                        original=arr,
                        mutated=new_arr,
                        mutation_type=mutation.mutation_type,
                        path=mutation.path,
                        description=mutation.description,
                    )

    def _mutate_primitive(
        self, value: Any, schema: Dict[str, Any], path: str
    ) -> Iterator[MutatedExample]:
        schema_type = schema.get("type", "string")

        yield MutatedExample(
            original=value,
            mutated=None,
            mutation_type=MutationType.NULL_VALUE,
            path=path,
            description=f"设置为null: {path}",
        )

        if schema_type == "string":
            yield MutatedExample(
                original=value,
                mutated="",
                mutation_type=MutationType.EMPTY_STRING,
                path=path,
                description=f"设置为空字符串: {path}",
            )

            if "enum" in schema:
                enum_values = schema["enum"]
                wrong_value = "__INVALID_ENUM_VALUE__"
                if wrong_value not in enum_values:
                    yield MutatedExample(
                        original=value,
                        mutated=wrong_value,
                        mutation_type=MutationType.WRONG_ENUM,
                        path=path,
                        description=f"使用非法枚举值: {path}",
                    )

            dirty_values = [
                "<script>alert(1)</script>",
                "../../etc/passwd",
                " OR 1=1 --",
                "\x00\x01\x02",
                "  ",
            ]
            for dirty_val in dirty_values:
                yield MutatedExample(
                    original=value,
                    mutated=dirty_val,
                    mutation_type=MutationType.DIRTY_DATA,
                    path=path,
                    description=f"脏数据注入: {path}",
                )

            if "maxLength" in schema:
                max_len = schema["maxLength"]
                boundary_val = "x" * (max_len + 1)
                yield MutatedExample(
                    original=value,
                    mutated=boundary_val,
                    mutation_type=MutationType.BOUNDARY_VALUE,
                    path=path,
                    description=f"超出最大长度: {path}",
                )

        elif schema_type in ["integer", "number"]:
            if "minimum" in schema:
                min_val = schema["minimum"]
                yield MutatedExample(
                    original=value,
                    mutated=min_val - 1,
                    mutation_type=MutationType.BOUNDARY_VALUE,
                    path=path,
                    description=f"低于最小值: {path}",
                )
            if "maximum" in schema:
                max_val = schema["maximum"]
                yield MutatedExample(
                    original=value,
                    mutated=max_val + 1,
                    mutation_type=MutationType.BOUNDARY_VALUE,
                    path=path,
                    description=f"超出最大值: {path}",
                )

            wrong_type_values = ["not_a_number", True, None, []]
            for wrong_val in wrong_type_values:
                if wrong_val != value:
                    yield MutatedExample(
                        original=value,
                        mutated=wrong_val,
                        mutation_type=MutationType.TYPE_MISMATCH,
                        path=path,
                        description=f"类型不匹配: {path}",
                    )

        elif schema_type == "boolean":
            wrong_type_values = ["true", 1, 0, None, []]
            for wrong_val in wrong_type_values:
                yield MutatedExample(
                    original=value,
                    mutated=wrong_val,
                    mutation_type=MutationType.TYPE_MISMATCH,
                    path=path,
                    description=f"类型不匹配: {path}",
                )

    def generate_all_mutations(self, example: Any) -> List[MutatedExample]:
        return list(self.generate_mutations(example))
