from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
from enum import Enum


class RiskLevel(Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    DANGER = "DANGER"
    CRITICAL = "CRITICAL"


class ParamType(Enum):
    STRING = "StringParameterDefinition"
    TEXT = "TextParameterDefinition"
    BOOLEAN = "BooleanParameterDefinition"
    CHOICE = "ChoiceParameterDefinition"
    PASSWORD = "PasswordParameterDefinition"
    FILE = "FileParameterDefinition"
    RUN = "RunParameterDefinition"
    UNKNOWN = "Unknown"


@dataclass
class BuildStep:
    step_type: str
    raw_xml: str
    line_number: int
    uses_params: List[str] = field(default_factory=list)
    is_dangerous: bool = False
    danger_reason: Optional[str] = None


@dataclass
class JenkinsParameter:
    name: str
    param_type: ParamType
    default_value: Optional[str]
    description: Optional[str]
    raw_xml: str
    line_number: int
    choices: List[str] = field(default_factory=list)
    used_in_steps: List[int] = field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.SAFE
    risk_reason: Optional[str] = None


@dataclass
class ParseError:
    file_path: str
    line_number: int
    error_type: str
    message: str
    raw_content: Optional[str] = None


@dataclass
class JobAuditResult:
    job_name: str
    file_path: str
    parameters: List[JenkinsParameter] = field(default_factory=list)
    build_steps: List[BuildStep] = field(default_factory=list)
    parse_errors: List[ParseError] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def calculate_summary(self) -> None:
        total_params = len(self.parameters)
        params_with_default = sum(1 for p in self.parameters if p.default_value is not None)
        params_without_default = total_params - params_with_default
        
        risk_counts: Dict[str, int] = {r.value: 0 for r in RiskLevel}
        for p in self.parameters:
            risk_counts[p.risk_level.value] += 1
        
        dangerous_steps = sum(1 for s in self.build_steps if s.is_dangerous)
        total_steps = len(self.build_steps)
        
        self.summary = {
            "total_parameters": total_params,
            "parameters_with_default": params_with_default,
            "parameters_without_default": params_without_default,
            "risk_distribution": risk_counts,
            "total_build_steps": total_steps,
            "dangerous_steps": dangerous_steps,
            "parse_errors": len(self.parse_errors)
        }
