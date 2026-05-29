from datetime import date, datetime
from enum import Enum
from typing import Optional
import json


class RiskLevel(Enum):
    R1 = "R1"
    R2 = "R2"
    R3 = "R3"
    R4 = "R4"
    R5 = "R5"

    def __lt__(self, other):
        order = ["R1", "R2", "R3", "R4", "R5"]
        return order.index(self.value) < order.index(other.value)

    def __le__(self, other):
        return self < other or self == other

    def __gt__(self, other):
        return not self <= other

    def __ge__(self, other):
        return not self < other


class IssueType(Enum):
    ASSESSMENT_EXPIRED = "assessment_expired"
    GRADE_MISMATCH = "grade_mismatch"
    RECORDING_MISSING = "recording_missing"


class Source(Enum):
    CUST_ASSESSMENT = "cust_assessment"
    PROD_GRADE = "prod_grade"
    PURCHASE_APP = "purchase_app"


class CustAssessment:
    def __init__(
        self,
        cust_id: str,
        risk_level: RiskLevel,
        assess_date: date,
        expiry_date: date,
        source: str = "测评系统",
    ):
        self.cust_id = cust_id
        self.risk_level = risk_level
        self.assess_date = assess_date
        self.expiry_date = expiry_date
        self.source = source

    def to_dict(self):
        return {
            "cust_id": self.cust_id,
            "risk_level": self.risk_level.value,
            "assess_date": self.assess_date.isoformat(),
            "expiry_date": self.expiry_date.isoformat(),
            "source": self.source,
        }


class ProdGrade:
    def __init__(
        self,
        prod_code: str,
        risk_level: RiskLevel,
        grade_date: date,
        version: str,
        source: str = "产品评级系统",
    ):
        self.prod_code = prod_code
        self.risk_level = risk_level
        self.grade_date = grade_date
        self.version = version
        self.source = source

    def to_dict(self):
        return {
            "prod_code": self.prod_code,
            "risk_level": self.risk_level.value,
            "grade_date": self.grade_date.isoformat(),
            "version": self.version,
            "source": self.source,
        }


class PurchaseApp:
    def __init__(
        self,
        app_id: str,
        cust_id: str,
        prod_code: str,
        amount: float,
        app_date: date,
        has_recording: bool,
        recording_id: Optional[str] = None,
        source: str = "交易系统",
    ):
        self.app_id = app_id
        self.cust_id = cust_id
        self.prod_code = prod_code
        self.amount = amount
        self.app_date = app_date
        self.has_recording = has_recording
        self.recording_id = recording_id
        self.source = source

    def to_dict(self):
        return {
            "app_id": self.app_id,
            "cust_id": self.cust_id,
            "prod_code": self.prod_code,
            "amount": self.amount,
            "app_date": self.app_date.isoformat(),
            "has_recording": self.has_recording,
            "recording_id": self.recording_id,
            "source": self.source,
        }


class IssueDetail:
    def __init__(
        self,
        issue_type: IssueType,
        description: str,
        source: Source,
        raw_data: dict,
    ):
        self.issue_type = issue_type
        self.description = description
        self.source = source
        self.raw_data = raw_data

    def to_dict(self):
        return {
            "issue_type": self.issue_type.value,
            "description": self.description,
            "source": self.source.value,
            "raw_data": self.raw_data,
        }


class ReviewResult:
    def __init__(
        self,
        app_id: str,
        cust_id: str,
        prod_code: str,
        suitability_verify: str,
        material_version: str,
        callback_status: str,
        issues: list,
        cust_assessment: Optional[dict] = None,
        prod_grade: Optional[dict] = None,
        purchase_app: Optional[dict] = None,
    ):
        self.app_id = app_id
        self.cust_id = cust_id
        self.prod_code = prod_code
        self.suitability_verify = suitability_verify
        self.material_version = material_version
        self.callback_status = callback_status
        self.issues = issues
        self.cust_assessment = cust_assessment
        self.prod_grade = prod_grade
        self.purchase_app = purchase_app

    @property
    def is_pass(self):
        return len(self.issues) == 0

    def to_dict(self):
        return {
            "app_id": self.app_id,
            "cust_id": self.cust_id,
            "prod_code": self.prod_code,
            "suitability_verify": self.suitability_verify,
            "material_version": self.material_version,
            "callback_status": self.callback_status,
            "is_pass": self.is_pass,
            "issues": [i.to_dict() for i in self.issues],
            "cust_assessment": self.cust_assessment,
            "prod_grade": self.prod_grade,
            "purchase_app": self.purchase_app,
        }


class Correction:
    def __init__(
        self,
        app_id: str,
        field_name: str,
        old_value: str,
        new_value: str,
        reason: str,
        operator: str,
        corrected_at: datetime,
    ):
        self.app_id = app_id
        self.field_name = field_name
        self.old_value = old_value
        self.new_value = new_value
        self.reason = reason
        self.operator = operator
        self.corrected_at = corrected_at

    def to_dict(self):
        return {
            "app_id": self.app_id,
            "field_name": self.field_name,
            "old_value": self.old_value,
            "new_value": self.new_value,
            "reason": self.reason,
            "operator": self.operator,
            "corrected_at": self.corrected_at.isoformat(),
        }
