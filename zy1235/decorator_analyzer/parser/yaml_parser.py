"""Parser for decorators.yaml configuration file."""

import hashlib
from pathlib import Path
from typing import Any

import yaml

from decorator_analyzer.models import DecoratedFunction, DecoratorInfo, DecoratorType, FunctionMetadata


class YamlParseError(Exception):
    """Exception raised when YAML parsing fails."""
    pass


class YamlParser:
    """Parser for decorators.yaml configuration file."""

    def __init__(self, yaml_path: Path):
        self.yaml_path = yaml_path
        self._raw_data: dict[str, Any] = {}

    def parse(self) -> list[DecoratedFunction]:
        """Parse the YAML file and return list of DecoratedFunction objects."""
        self._validate_file()
        self._load_yaml()
        self._validate_structure()
        return self._parse_functions()

    def _validate_file(self) -> None:
        """Validate that the YAML file exists and is readable."""
        if not self.yaml_path.exists():
            raise YamlParseError(f"YAML file not found: {self.yaml_path}")
        if not self.yaml_path.is_file():
            raise YamlParseError(f"Path is not a file: {self.yaml_path}")

    def _load_yaml(self) -> None:
        """Load YAML content from file."""
        try:
            with open(self.yaml_path, "r", encoding="utf-8") as f:
                self._raw_data = yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            raise YamlParseError(f"Invalid YAML format: {e}") from e
        except UnicodeDecodeError as e:
            raise YamlParseError(f"File encoding error: {e}") from e

    def _validate_structure(self) -> None:
        """Validate the YAML structure against expected schema."""
        if "functions" not in self._raw_data:
            raise YamlParseError("Missing required 'functions' section in YAML")
        
        functions = self._raw_data.get("functions", [])
        if not isinstance(functions, list):
            raise YamlParseError("'functions' must be a list")
        
        for idx, func in enumerate(functions):
            self._validate_function(func, idx)

    def _validate_function(self, func: dict[str, Any], index: int) -> None:
        """Validate a single function entry in the YAML."""
        required_fields = ["name", "signature"]
        for field in required_fields:
            if field not in func:
                raise YamlParseError(f"Function at index {index} missing required field: {field}")
        
        if "decorators" in func:
            decorators = func["decorators"]
            if not isinstance(decorators, list):
                raise YamlParseError(f"Function '{func['name']}' has invalid 'decorators' (must be list)")
            
            for dec_idx, dec in enumerate(decorators):
                self._validate_decorator(dec, func["name"], dec_idx)

    def _validate_decorator(self, dec: dict[str, Any], func_name: str, index: int) -> None:
        """Validate a single decorator entry."""
        if not isinstance(dec, dict):
            raise YamlParseError(f"Decorator at index {index} for function '{func_name}' must be an object")
        
        if "name" not in dec:
            raise YamlParseError(f"Decorator at index {index} for function '{func_name}' missing 'name'")

    def _parse_functions(self) -> list[DecoratedFunction]:
        """Parse all functions from the YAML data."""
        results: list[DecoratedFunction] = []
        functions = self._raw_data.get("functions", [])
        
        for func_data in functions:
            decorated_func = self._parse_function(func_data)
            results.append(decorated_func)
        
        return results

    def _parse_function(self, func_data: dict[str, Any]) -> DecoratedFunction:
        """Parse a single function entry."""
        func_name = func_data["name"]
        module = func_data.get("module", "unknown")
        
        func_metadata = FunctionMetadata(
            name=func_name,
            module=module,
            signature=func_data["signature"],
            docstring=func_data.get("docstring"),
            is_async=func_data.get("is_async", False),
            is_method=func_data.get("is_method", False),
            annotations=func_data.get("annotations", {}),
        )
        
        decorators_data = func_data.get("decorators", [])
        decorators: list[DecoratorInfo] = []
        decorator_order: list[str] = []
        
        for dec_data in decorators_data:
            decorator = self._parse_decorator(dec_data, module)
            decorators.append(decorator)
            decorator_order.append(decorator.id)
        
        func_id = self._generate_id(f"{module}:{func_name}")
        
        return DecoratedFunction(
            id=func_id,
            function=func_metadata,
            decorators=decorators,
            decorator_order=decorator_order,
        )

    def _parse_decorator(self, dec_data: dict[str, Any], module: str) -> DecoratorInfo:
        """Parse a single decorator entry."""
        dec_name = dec_data["name"]
        dec_type = self._parse_decorator_type(dec_data.get("type", "simple"))
        
        dec_id = self._generate_id(f"{module}:{dec_name}:{dec_data.get('line_number', 0)}")
        
        return DecoratorInfo(
            id=dec_id,
            name=dec_name,
            decorator_type=dec_type,
            module=module,
            line_number=dec_data.get("line_number", 0),
            has_wraps=dec_data.get("has_wraps", False),
            parameters=dec_data.get("parameters", {}),
            source_code=dec_data.get("source_code"),
        )

    def _parse_decorator_type(self, type_str: str) -> DecoratorType:
        """Convert a string to DecoratorType enum."""
        type_map = {
            "simple": DecoratorType.SIMPLE,
            "with_args": DecoratorType.WITH_ARGS,
            "functools_wraps": DecoratorType.FUNCTOOLS_WRAPS,
            "class_decorator": DecoratorType.CLASS_DECORATOR,
            "descriptor": DecoratorType.DESCRIPTOR,
            "async": DecoratorType.ASYNC,
            "stacked": DecoratorType.STACKED,
        }
        return type_map.get(type_str.lower(), DecoratorType.SIMPLE)

    def _generate_id(self, identifier: str) -> str:
        """Generate a unique ID from an identifier string."""
        return hashlib.sha256(identifier.encode()).hexdigest()[:16]
