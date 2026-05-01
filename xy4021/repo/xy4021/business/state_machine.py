from enum import Enum
from typing import Set, Dict, List


class PackageStatus(Enum):
    PENDING_STERILIZATION = '待灭菌'
    IN_STERILIZATION = '灭菌中'
    PENDING_RELEASE = '待放行'
    RELEASED = '已放行'
    USED = '已领用'
    ISOLATED = '已隔离'
    DISCARDED = '已报废'


class CycleStatus(Enum):
    IN_PROGRESS = '进行中'
    COMPLETED = '已完成'
    FAILED = '失败'


class IndicatorResult(Enum):
    PASS = '通过'
    FAIL = '未通过'
    PENDING = '待确认'


class StateTransitionError(Exception):
    pass


class BusinessRuleError(Exception):
    pass


class StateMachine:
    VALID_TRANSITIONS: Dict[str, Set[str]] = {
        PackageStatus.PENDING_STERILIZATION.value: {
            PackageStatus.IN_STERILIZATION.value,
            PackageStatus.DISCARDED.value
        },
        PackageStatus.IN_STERILIZATION.value: {
            PackageStatus.PENDING_RELEASE.value,
            PackageStatus.ISOLATED.value,
            PackageStatus.DISCARDED.value
        },
        PackageStatus.PENDING_RELEASE.value: {
            PackageStatus.RELEASED.value,
            PackageStatus.ISOLATED.value,
            PackageStatus.DISCARDED.value
        },
        PackageStatus.RELEASED.value: {
            PackageStatus.USED.value,
            PackageStatus.ISOLATED.value,
            PackageStatus.DISCARDED.value
        },
        PackageStatus.USED.value: set(),
        PackageStatus.ISOLATED.value: {
            PackageStatus.DISCARDED.value,
            PackageStatus.PENDING_STERILIZATION.value
        },
        PackageStatus.DISCARDED.value: set()
    }

    @classmethod
    def can_transition(cls, from_status: str, to_status: str) -> bool:
        if from_status not in cls.VALID_TRANSITIONS:
            return False
        return to_status in cls.VALID_TRANSITIONS[from_status]

    @classmethod
    def validate_transition(cls, from_status: str, to_status: str) -> None:
        if not cls.can_transition(from_status, to_status):
            raise StateTransitionError(
                f'不允许从状态 "{from_status}" 转换到 "{to_status}"'
            )

    @classmethod
    def get_valid_next_states(cls, current_status: str) -> List[str]:
        if current_status not in cls.VALID_TRANSITIONS:
            return []
        return list(cls.VALID_TRANSITIONS[current_status])


class BusinessRules:
    @staticmethod
    def validate_release(
        biological_indicator: str,
        chemical_indicator: str
    ) -> None:
        if biological_indicator == IndicatorResult.FAIL.value:
            raise BusinessRuleError('生物指示结果未通过，不能放行')
        if chemical_indicator == IndicatorResult.FAIL.value:
            raise BusinessRuleError('化学指示结果未通过，不能放行')
        
        if biological_indicator is None or biological_indicator == IndicatorResult.PENDING.value:
            raise BusinessRuleError('生物指示结果缺失，不能放行')
        if chemical_indicator is None or chemical_indicator == IndicatorResult.PENDING.value:
            raise BusinessRuleError('化学指示结果缺失，不能放行')

    @staticmethod
    def validate_package_in_active_cycle(
        package_status: str,
        current_cycle_id: int = None
    ) -> None:
        if current_cycle_id is not None and package_status in [
            PackageStatus.IN_STERILIZATION.value,
            PackageStatus.PENDING_RELEASE.value
        ]:
            raise BusinessRuleError('该器械包已在进行中的锅次中，不能重复加入')

    @staticmethod
    def validate_used_package_return(package_status: str) -> None:
        if package_status == PackageStatus.USED.value:
            raise BusinessRuleError('已领用的器械包不能再回到待放行状态')

    @staticmethod
    def validate_cycle_failure_packages(
        package_status: str,
        package_id: int
    ) -> bool:
        return package_status not in [
            PackageStatus.USED.value,
            PackageStatus.DISCARDED.value
        ]

    @staticmethod
    def can_add_to_cycle(package_status: str) -> bool:
        return package_status in [
            PackageStatus.PENDING_STERILIZATION.value,
            PackageStatus.ISOLATED.value
        ]

    @staticmethod
    def can_remove_from_cycle(package_status: str) -> bool:
        return package_status in [
            PackageStatus.IN_STERILIZATION.value,
            PackageStatus.PENDING_RELEASE.value
        ]
