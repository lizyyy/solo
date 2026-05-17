from datetime import datetime
from typing import Optional
from .base import BaseEntity


class HealthDeclaration(BaseEntity):
    visitor_id: str
    appointment_id: str
    temperature: float
    has_fever: bool
    has_cough: bool
    has_other_symptoms: bool
    symptoms_detail: Optional[str] = None
    declaration_time: datetime
    is_passed: bool
