from typing import List, Dict, Set
from .models import (
    JenkinsParameter,
    BuildStep,
    JobAuditResult,
    RiskLevel,
    ParamType
)


class RiskAnalyzer:
    RISKY_PARAM_NAMES = {
        "force": "可能强制覆盖资源",
        "delete": "可能触发删除操作",
        "destroy": "可能销毁资源",
        "clean": "可能清理数据",
        "purge": "可能清除所有数据",
        "override": "可能覆盖配置",
        "production": "涉及生产环境",
        "prod": "涉及生产环境",
        "live": "涉及生产环境",
    }

    RISKY_DEFAULT_VALUES = {
        "true": "布尔参数默认为真，可能自动执行危险操作",
        "yes": "布尔参数默认为是，可能自动执行危险操作",
        "production": "默认指向生产环境",
        "prod": "默认指向生产环境",
        "*": "通配符默认值可能影响范围过大",
        "all": "默认值为'all'可能影响范围过大",
    }

    def __init__(self, result: JobAuditResult):
        self.result = result
        self.dangerous_step_params: Set[str] = set()

    def _link_params_to_steps(self) -> None:
        for step_idx, step in enumerate(self.result.build_steps):
            for param_name in step.uses_params:
                for param in self.result.parameters:
                    if param.name == param_name:
                        param.used_in_steps.append(step_idx)
                        if step.is_dangerous:
                            self.dangerous_step_params.add(param_name)

    def _analyze_param_risk(self, param: JenkinsParameter) -> None:
        risk_factors = []

        if param.default_value is None:
            risk_factors.append("参数无默认值，需人工确认")

        if param.param_type in [ParamType.PASSWORD, ParamType.FILE]:
            risk_factors.append(f"敏感参数类型: {param.param_type.value}")

        param_name_lower = param.name.lower()
        for risky_name, reason in self.RISKY_PARAM_NAMES.items():
            if risky_name in param_name_lower:
                risk_factors.append(reason)
                break

        if param.default_value is not None:
            default_lower = param.default_value.lower()
            for risky_value, reason in self.RISKY_DEFAULT_VALUES.items():
                if risky_value in default_lower:
                    risk_factors.append(reason)
                    break

        if param.name in self.dangerous_step_params:
            risk_factors.append("参数被危险构建步骤使用")

        if not param.used_in_steps:
            risk_factors.append("参数未被任何构建步骤使用，可能是冗余参数")

        if len(risk_factors) >= 3:
            param.risk_level = RiskLevel.CRITICAL
            param.risk_reason = " | ".join(risk_factors)
        elif len(risk_factors) >= 2:
            param.risk_level = RiskLevel.DANGER
            param.risk_reason = " | ".join(risk_factors)
        elif len(risk_factors) >= 1:
            param.risk_level = RiskLevel.WARNING
            param.risk_reason = " | ".join(risk_factors)
        else:
            param.risk_level = RiskLevel.SAFE

    def analyze(self) -> JobAuditResult:
        self._link_params_to_steps()

        for param in self.result.parameters:
            self._analyze_param_risk(param)

        self.result.calculate_summary()

        return self.result
