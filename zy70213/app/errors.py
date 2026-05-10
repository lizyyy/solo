from typing import Dict, Any


class BusinessError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        details: Dict[str, Any] = None,
        need_manual_handling: bool = True
    ):
        self.code = code
        self.message = message
        self.details = details or {}
        self.need_manual_handling = need_manual_handling
        super().__init__(message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success": False,
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
                "need_manual_handling": self.need_manual_handling
            }
        }


class AnimalProfileError(BusinessError):
    def __init__(self, message: str, animal_id: str = None, details: Dict[str, Any] = None):
        super().__init__(
            code="ANIMAL_PROFILE_INVALID",
            message=message,
            details={**(details or {}), "animal_id": animal_id},
            need_manual_handling=True
        )


class FeedFormulaError(BusinessError):
    def __init__(self, message: str, species: str = None, season: str = None, details: Dict[str, Any] = None):
        super().__init__(
            code="FEED_FORMULA_MISSING",
            message=message,
            details={**(details or {}), "species": species, "season": season},
            need_manual_handling=True
        )


class InventoryError(BusinessError):
    def __init__(self, message: str, feed_name: str = None, required: float = None, available: float = None, details: Dict[str, Any] = None):
        super().__init__(
            code="INVENTORY_INSUFFICIENT",
            message=message,
            details={
                **(details or {}),
                "feed_name": feed_name,
                "required": required,
                "available": available
            },
            need_manual_handling=True
        )


class DataConsistencyError(BusinessError):
    def __init__(self, message: str, details: Dict[str, Any] = None):
        super().__init__(
            code="DATA_CONSISTENCY_VIOLATION",
            message=message,
            details=details,
            need_manual_handling=True
        )


class StatusTransitionError(BusinessError):
    def __init__(self, message: str, from_status: str = None, to_status: str = None, details: Dict[str, Any] = None):
        super().__init__(
            code="STATUS_TRANSITION_INVALID",
            message=message,
            details={
                **(details or {}),
                "from_status": from_status,
                "to_status": to_status
            },
            need_manual_handling=False
        )


class ValidationError(BusinessError):
    def __init__(self, message: str, stage: str = None, details: Dict[str, Any] = None):
        super().__init__(
            code="VALIDATION_FAILED",
            message=message,
            details={**(details or {}), "stage": stage},
            need_manual_handling=True
        )
