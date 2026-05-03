from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional

from .base_check import BaseCheck, CheckResult
from .time_conflict_check import TimeConflictCheck, TimeConflictCheckData
from .missing_signature_check import MissingSignatureCheck, MissingSignatureCheckData
from .dangerous_prop_check import DangerousPropCheck, DangerousPropCheckData
from .lost_overdue_check import LostOverdueCheck, LostOverdueCheckData
from app.models import HandoverRecord, Prop, Scene, Violation, CheckStatus


@dataclass
class RulesEngineConfig:
    grace_hours: int = 24
    critical_hours: int = 72
    check_only_completed_signatures: bool = True
    danger_level_threshold: str = "LOW"
    enable_time_conflict_check: bool = True
    enable_missing_signature_check: bool = True
    enable_dangerous_prop_check: bool = True
    enable_lost_overdue_check: bool = True


@dataclass
class RulesEngineResult:
    all_passed: bool = False
    check_results: List[CheckResult] = field(default_factory=list)
    all_violations: List[Violation] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    checked_at: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def total_violations(self) -> int:
        return len(self.all_violations)

    @property
    def unresolved_violations(self) -> List[Violation]:
        return [v for v in self.all_violations if not v.resolved]

    @property
    def error_count(self) -> int:
        return len([v for v in self.all_violations if v.check_status == CheckStatus.ERROR])

    @property
    def warning_count(self) -> int:
        return len([v for v in self.all_violations if v.check_status == CheckStatus.WARNING])


class RulesEngine:

    def __init__(self, config: Optional[RulesEngineConfig] = None):
        self.config = config or RulesEngineConfig()

    def run_all_checks(
        self,
        handovers: List[HandoverRecord],
        props: List[Prop],
        scenes: List[Scene],
        current_time: Optional[datetime] = None,
    ) -> RulesEngineResult:
        all_results: List[CheckResult] = []
        all_violations: List[Violation] = []
        all_warnings: List[str] = []
        all_errors: List[str] = []

        if self.config.enable_time_conflict_check:
            try:
                check = TimeConflictCheck()
                data = TimeConflictCheckData(
                    handovers=handovers,
                    props=props,
                    scenes=scenes,
                )
                result = check.execute(data)
                all_results.append(result)
                all_violations.extend(result.violations)
                all_warnings.extend(result.warnings)
            except Exception as e:
                all_errors.append(f"时间冲突检查失败: {str(e)}")

        if self.config.enable_missing_signature_check:
            try:
                check = MissingSignatureCheck(
                    check_only_completed=self.config.check_only_completed_signatures
                )
                data = MissingSignatureCheckData(handovers=handovers)
                result = check.execute(data)
                all_results.append(result)
                all_violations.extend(result.violations)
                all_warnings.extend(result.warnings)
            except Exception as e:
                all_errors.append(f"缺签检查失败: {str(e)}")

        if self.config.enable_dangerous_prop_check:
            try:
                from app.models.enums import DangerLevel
                try:
                    threshold = DangerLevel[self.config.danger_level_threshold.upper()]
                except KeyError:
                    threshold = DangerLevel.LOW
                
                check = DangerousPropCheck(danger_level_threshold=threshold)
                data = DangerousPropCheckData(
                    handovers=handovers,
                    props=props,
                )
                result = check.execute(data)
                all_results.append(result)
                all_violations.extend(result.violations)
                all_warnings.extend(result.warnings)
            except Exception as e:
                all_errors.append(f"危险品复核检查失败: {str(e)}")

        if self.config.enable_lost_overdue_check:
            try:
                check = LostOverdueCheck(
                    grace_hours=self.config.grace_hours,
                    critical_hours=self.config.critical_hours,
                )
                data = LostOverdueCheckData(
                    handovers=handovers,
                    current_time=current_time,
                )
                result = check.execute(data)
                all_results.append(result)
                all_violations.extend(result.violations)
                all_warnings.extend(result.warnings)
            except Exception as e:
                all_errors.append(f"遗失超时检查失败: {str(e)}")

        all_passed = len(all_errors) == 0 and len(all_violations) == 0

        return RulesEngineResult(
            all_passed=all_passed,
            check_results=all_results,
            all_violations=all_violations,
            errors=all_errors,
            warnings=all_warnings,
            metadata={
                "total_handovers": len(handovers),
                "total_props": len(props),
                "total_scenes": len(scenes),
                "checks_run": [r.check_name for r in all_results],
            }
        )

    def run_single_check(
        self,
        check_name: str,
        handovers: List[HandoverRecord],
        props: List[Prop],
        scenes: List[Scene],
        current_time: Optional[datetime] = None,
    ) -> Optional[CheckResult]:
        if check_name == "时间冲突检查":
            check = TimeConflictCheck()
            data = TimeConflictCheckData(handovers=handovers, props=props, scenes=scenes)
            return check.execute(data)
        
        elif check_name == "交接缺签检查":
            check = MissingSignatureCheck(check_only_completed=self.config.check_only_completed_signatures)
            data = MissingSignatureCheckData(handovers=handovers)
            return check.execute(data)
        
        elif check_name == "危险品复核检查":
            from app.models.enums import DangerLevel
            try:
                threshold = DangerLevel[self.config.danger_level_threshold.upper()]
            except KeyError:
                threshold = DangerLevel.LOW
            check = DangerousPropCheck(danger_level_threshold=threshold)
            data = DangerousPropCheckData(handovers=handovers, props=props)
            return check.execute(data)
        
        elif check_name == "遗失超时检查":
            check = LostOverdueCheck(
                grace_hours=self.config.grace_hours,
                critical_hours=self.config.critical_hours,
            )
            data = LostOverdueCheckData(handovers=handovers, current_time=current_time)
            return check.execute(data)
        
        return None

    def get_available_checks(self) -> List[Dict[str, Any]]:
        return [
            {
                "name": "时间冲突检查",
                "description": "检查同一件道具是否在时间冲突的场次中被同时借用",
                "enabled": self.config.enable_time_conflict_check,
            },
            {
                "name": "交接缺签检查",
                "description": "检查道具交接是否缺少借出或归还签名",
                "enabled": self.config.enable_missing_signature_check,
            },
            {
                "name": "危险品复核检查",
                "description": "检查危险道具是否经过必要的复核流程",
                "enabled": self.config.enable_dangerous_prop_check,
            },
            {
                "name": "遗失超时检查",
                "description": "检查道具是否超期未归还或已标记为遗失",
                "enabled": self.config.enable_lost_overdue_check,
            },
        ]
