"""契约验证器 - 验证参数规则、互斥关系、依赖关系等"""

from typing import Any, Dict, List, Optional, Set, Tuple

from .models import ParameterRule, Subcommand


class ValidationError(Exception):
    """验证错误"""
    pass


class ContractValidator:
    """契约验证器"""

    @classmethod
    def validate_subcommand(
        cls,
        subcommand: Subcommand,
        provided_args: Dict[str, Any],
    ) -> Tuple[bool, List[str]]:
        """验证子命令的参数

        Args:
            subcommand: 子命令定义
            provided_args: 提供的参数字典

        Returns:
            (是否通过, 错误信息列表)
        """
        errors: List[str] = []

        param_map = {p.name: p for p in subcommand.parameters}

        errors.extend(cls._validate_required_parameters(param_map, provided_args))
        errors.extend(cls._validate_mutually_exclusive(param_map, provided_args))
        errors.extend(cls._validate_dependencies(param_map, provided_args))
        errors.extend(cls._validate_parameter_types(param_map, provided_args))
        errors.extend(cls._validate_choices(param_map, provided_args))

        return len(errors) == 0, errors

    @classmethod
    def _validate_required_parameters(
        cls,
        param_map: Dict[str, ParameterRule],
        provided_args: Dict[str, Any],
    ) -> List[str]:
        """验证必填参数"""
        errors = []
        for name, param in param_map.items():
            if param.required:
                if name not in provided_args or provided_args[name] is None:
                    if param.default is None:
                        errors.append(f"缺少必填参数: --{name}")
        return errors

    @classmethod
    def _validate_mutually_exclusive(
        cls,
        param_map: Dict[str, ParameterRule],
        provided_args: Dict[str, Any],
    ) -> List[str]:
        """验证互斥参数"""
        errors = []
        provided_names = set(provided_args.keys())

        for name, param in param_map.items():
            if name not in provided_args:
                continue

            exclusive_with = set(param.mutually_exclusive_with)
            conflicting = provided_names & exclusive_with

            if conflicting:
                errors.append(
                    f"参数 --{name} 与 --{', --'.join(conflicting)} 互斥，不能同时使用"
                )

        return errors

    @classmethod
    def _validate_dependencies(
        cls,
        param_map: Dict[str, ParameterRule],
        provided_args: Dict[str, Any],
    ) -> List[str]:
        """验证参数依赖关系"""
        errors = []
        provided_names = set(provided_args.keys())

        for name, param in param_map.items():
            if name not in provided_args:
                continue

            depends_on = set(param.depends_on)
            missing = depends_on - provided_names

            if missing:
                errors.append(
                    f"参数 --{name} 需要同时提供 --{', --'.join(missing)}"
                )

        return errors

    @classmethod
    def _validate_parameter_types(
        cls,
        param_map: Dict[str, ParameterRule],
        provided_args: Dict[str, Any],
    ) -> List[str]:
        """验证参数类型"""
        errors = []

        for name, value in provided_args.items():
            if name not in param_map:
                continue

            param = param_map[name]
            if value is None:
                continue

            type_error = cls._check_type(param.type, name, value)
            if type_error:
                errors.append(type_error)

        return errors

    @classmethod
    def _check_type(cls, expected_type: str, name: str, value: Any) -> Optional[str]:
        """检查单个参数类型"""
        if expected_type == "string":
            if not isinstance(value, str):
                return f"参数 --{name} 类型错误，期望 string，实际 {type(value).__name__}"
        elif expected_type == "integer":
            if not isinstance(value, int) or isinstance(value, bool):
                try:
                    int(value)
                except (TypeError, ValueError):
                    return f"参数 --{name} 类型错误，期望 integer"
        elif expected_type == "float":
            if not isinstance(value, (int, float)) or isinstance(value, bool):
                try:
                    float(value)
                except (TypeError, ValueError):
                    return f"参数 --{name} 类型错误，期望 float"
        elif expected_type == "boolean":
            if not isinstance(value, bool):
                return f"参数 --{name} 类型错误，期望 boolean"
        elif expected_type == "file":
            if not isinstance(value, str):
                return f"参数 --{name} 类型错误，期望文件路径 (string)"

        return None

    @classmethod
    def _validate_choices(
        cls,
        param_map: Dict[str, ParameterRule],
        provided_args: Dict[str, Any],
    ) -> List[str]:
        """验证参数可选值范围"""
        errors = []

        for name, value in provided_args.items():
            if name not in param_map:
                continue

            param = param_map[name]
            if param.choices is None or value is None:
                continue

            if value not in param.choices:
                errors.append(
                    f"参数 --{name} 值 '{value}' 不在允许范围内，可选值: {param.choices}"
                )

        return errors

    @classmethod
    def apply_defaults(
        cls,
        subcommand: Subcommand,
        provided_args: Dict[str, Any],
    ) -> Dict[str, Any]:
        """应用默认值到参数

        Args:
            subcommand: 子命令定义
            provided_args: 提供的参数字典

        Returns:
            应用默认值后的参数字典
        """
        result = dict(provided_args)

        for param in subcommand.parameters:
            if param.name not in result or result[param.name] is None:
                if param.default is not None:
                    result[param.name] = param.default

        return result
