import hashlib
import json
import re
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy.orm import Session
from app.models import ExceptionSample, SampleHistory, SampleStatus, ErrorCategory
from app.schemas import SampleCreate, SampleValidate, SampleClassify, SampleReproduce, SampleFix


class SanitizationService:
    SENSITIVE_FIELDS = [
        'password', 'token', 'secret', 'authorization', 'api_key',
        'apikey', 'access_token', 'refresh_token', 'credit_card',
        'ssn', 'phone', 'email', 'mobile'
    ]

    @classmethod
    def sanitize_payload(cls, payload: str) -> str:
        if not payload:
            return payload
        try:
            data = json.loads(payload)
            sanitized = cls._sanitize_dict(data)
            return json.dumps(sanitized, ensure_ascii=False, indent=2)
        except json.JSONDecodeError:
            return cls._sanitize_text(payload)

    @classmethod
    def _sanitize_dict(cls, data: dict) -> dict:
        result = {}
        for key, value in data.items():
            if isinstance(value, dict):
                result[key] = cls._sanitize_dict(value)
            elif isinstance(value, list):
                result[key] = [cls._sanitize_dict(item) if isinstance(item, dict) else item for item in value]
            elif key.lower() in cls.SENSITIVE_FIELDS or any(s in key.lower() for s in cls.SENSITIVE_FIELDS):
                result[key] = "***SANITIZED***"
            else:
                result[key] = value
        return result

    @classmethod
    def _sanitize_text(cls, text: str) -> str:
        patterns = [
            (r'Bearer\s+[A-Za-z0-9\-_]+', 'Bearer ***SANITIZED***'),
            (r'Basic\s+[A-Za-z0-9+/=]+', 'Basic ***SANITIZED***'),
        ]
        for pattern, replacement in patterns:
            text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        return text


class SampleHashService:
    @staticmethod
    def generate_sample_hash(sample: SampleCreate) -> str:
        hash_components = [
            sample.http_method.upper(),
            sample.api_endpoint,
            sample.error_code or "",
            sample.error_message or "",
        ]
        hash_input = "|".join(hash_components)
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()


class SampleService:
    def __init__(self, db: Session):
        self.db = db

    def get_by_hash(self, sample_hash: str) -> Optional[ExceptionSample]:
        return self.db.query(ExceptionSample).filter(
            ExceptionSample.sample_hash == sample_hash
        ).first()

    def get_by_id(self, sample_id: int) -> Optional[ExceptionSample]:
        return self.db.query(ExceptionSample).filter(
            ExceptionSample.id == sample_id
        ).first()

    def list_samples(self, status: Optional[SampleStatus] = None,
                     category: Optional[ErrorCategory] = None,
                     skip: int = 0, limit: int = 100) -> tuple[int, List[ExceptionSample]]:
        query = self.db.query(ExceptionSample)
        if status:
            query = query.filter(ExceptionSample.status == status)
        if category:
            query = query.filter(ExceptionSample.error_category == category)
        total = query.count()
        samples = query.order_by(ExceptionSample.created_at.desc()).offset(skip).limit(limit).all()
        return total, samples

    def create_sample(self, sample_data: SampleCreate) -> tuple[ExceptionSample, bool]:
        sample_hash = SampleHashService.generate_sample_hash(sample_data)
        existing_sample = self.get_by_hash(sample_hash)

        if existing_sample:
            self._add_history(existing_sample, existing_sample.status,
                              f"重复提交，已存在相同样本", sample_data.created_by)
            self.db.commit()
            return existing_sample, False

        sanitized_request = SanitizationService.sanitize_payload(sample_data.request_payload)
        sanitized_response = SanitizationService.sanitize_payload(sample_data.response_payload)
        sanitized_payload = json.dumps({
            "request": sanitized_request,
            "response": sanitized_response
        }, ensure_ascii=False)

        sample = ExceptionSample(
            sample_hash=sample_hash,
            status=SampleStatus.CREATED,
            http_method=sample_data.http_method.upper(),
            api_endpoint=sample_data.api_endpoint,
            request_payload=sample_data.request_payload,
            response_payload=sample_data.response_payload,
            sanitized_payload=sanitized_payload,
            error_code=sample_data.error_code,
            error_message=sample_data.error_message,
            created_by=sample_data.created_by,
            retention_days=sample_data.retention_days,
            expires_at=datetime.utcnow() + timedelta(days=sample_data.retention_days)
        )
        self.db.add(sample)
        self.db.flush()
        self._add_history(sample, SampleStatus.CREATED, "样本创建成功", sample_data.created_by)
        self.db.commit()
        self.db.refresh(sample)
        return sample, True

    def validate_sample(self, sample_id: int, validate_data: SampleValidate) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.CREATED:
            return None

        sample.status = SampleStatus.VALIDATED
        sample.handled_by = validate_data.validated_by
        self._add_history(sample, SampleStatus.VALIDATED,
                          validate_data.validation_notes or "校验通过",
                          validate_data.validated_by)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def classify_sample(self, sample_id: int, classify_data: SampleClassify) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.VALIDATED:
            return None

        sample.status = SampleStatus.CLASSIFIED
        sample.error_category = classify_data.error_category
        sample.handled_by = classify_data.classified_by
        self._add_history(sample, SampleStatus.CLASSIFIED,
                          f"分类为: {classify_data.error_category.value}",
                          classify_data.classified_by)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def start_reproduce(self, sample_id: int, operator: str) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.CLASSIFIED:
            return None

        sample.status = SampleStatus.REPRODUCING
        sample.handled_by = operator
        self._add_history(sample, SampleStatus.REPRODUCING, "开始复现", operator)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def reproduce_sample(self, sample_id: int, reproduce_data: SampleReproduce) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.REPRODUCING:
            return None

        sample.status = SampleStatus.REPRODUCED
        sample.reproduce_steps = reproduce_data.reproduce_steps
        sample.reproduce_success = reproduce_data.reproduce_success
        sample.handled_by = reproduce_data.reproduced_by
        status_text = "复现成功" if reproduce_data.reproduce_success else "复现失败"
        self._add_history(sample, SampleStatus.REPRODUCED, status_text, reproduce_data.reproduced_by)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def start_fix(self, sample_id: int, operator: str) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.REPRODUCED or not sample.reproduce_success:
            return None

        sample.status = SampleStatus.FIXING
        sample.handled_by = operator
        self._add_history(sample, SampleStatus.FIXING, "开始修复", operator)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def fix_sample(self, sample_id: int, fix_data: SampleFix) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.FIXING:
            return None

        sample.status = SampleStatus.FIXED
        sample.fix_issue_id = fix_data.fix_issue_id
        sample.fix_description = fix_data.fix_description
        sample.fixed_at = datetime.utcnow()
        sample.handled_by = fix_data.fixed_by
        self._add_history(sample, SampleStatus.FIXED,
                          f"修复完成: {fix_data.fix_issue_id}",
                          fix_data.fixed_by)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def archive_sample(self, sample_id: int, operator: str) -> Optional[ExceptionSample]:
        sample = self.get_by_id(sample_id)
        if not sample or sample.status != SampleStatus.FIXED:
            return None

        sample.status = SampleStatus.ARCHIVED
        sample.handled_by = operator
        self._add_history(sample, SampleStatus.ARCHIVED, "已归档", operator)
        self.db.commit()
        self.db.refresh(sample)
        return sample

    def cleanup_expired_samples(self) -> int:
        expired_samples = self.db.query(ExceptionSample).filter(
            ExceptionSample.status != SampleStatus.EXPIRED,
            ExceptionSample.expires_at <= datetime.utcnow()
        ).all()
        count = 0
        for sample in expired_samples:
            sample.status = SampleStatus.EXPIRED
            self._add_history(sample, SampleStatus.EXPIRED, "样本保留期限已到", "system")
            count += 1
        self.db.commit()
        return count

    def get_history(self, sample_id: int) -> List[SampleHistory]:
        return self.db.query(SampleHistory).filter(
            SampleHistory.sample_id == sample_id
        ).order_by(SampleHistory.created_at.asc()).all()

    def _add_history(self, sample: ExceptionSample, status: SampleStatus,
                     description: str, operated_by: str):
        history = SampleHistory(
            sample_id=sample.id,
            status=status,
            description=description,
            operated_by=operated_by
        )
        self.db.add(history)
