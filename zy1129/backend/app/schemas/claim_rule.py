from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class ClaimRuleBase(BaseModel):
    rule_name: str
    rule_type: str
    policy_type: Optional[str] = None
    coverage_type: Optional[str] = None
    conditions: Optional[Dict[str, Any]] = None
    actions: Optional[Dict[str, Any]] = None
    is_active: bool = True
    priority: int = 0


class ClaimRuleCreate(ClaimRuleBase):
    pass


class ClaimRuleUpdate(ClaimRuleBase):
    rule_name: Optional[str] = None
    rule_type: Optional[str] = None


class ClaimRuleResponse(ClaimRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
