from datetime import datetime, date
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from models import BoothCertificate, MaterialStatus, DepositStatus
from schemas import BoothCertificateCreate, ErrorDetail
import json


class MaterialValidator:
    def __init__(self, db: Session):
        self.db = db
        self.errors: List[ErrorDetail] = []
    
    def validate(self, data: BoothCertificateCreate) -> Tuple[bool, List[ErrorDetail]]:
        self.errors = []
        
        self._check_required_fields(data)
        self._check_date_consistency(data)
        self._check_duplicate_booth_number(data)
        self._check_certificate_expiry(data)
        
        return len(self.errors) == 0, self.errors
    
    def _check_required_fields(self, data: BoothCertificateCreate):
        required_fields = {
            'batch_number': '材料批次号',
            'booth_number': '摊位编号',
            'mall_name': '商场名称',
            'certificate_version': '证照版本',
            'processor': '处理人'
        }
        
        for field, display_name in required_fields.items():
            value = getattr(data, field)
            if not value or (isinstance(value, str) and value.strip() == ''):
                self.errors.append(ErrorDetail(
                    field=field,
                    message=f"{display_name}不能为空",
                    original_position=f"输入数据.{display_name}"
                ))
        
        if not data.business_license:
            self.errors.append(ErrorDetail(
                field='business_license',
                message="营业执照缺失",
                original_position="输入数据.营业执照"
            ))
        
        if not data.fire_safety_material:
            self.errors.append(ErrorDetail(
                field='fire_safety_material',
                message="消防材料缺失",
                original_position="输入数据.消防材料"
            ))
    
    def _check_date_consistency(self, data: BoothCertificateCreate):
        if data.schedule_start_date and data.schedule_end_date:
            if data.schedule_end_date < data.schedule_start_date:
                self.errors.append(ErrorDetail(
                    field='schedule_end_date',
                    message="场地档期结束日期不能早于开始日期",
                    original_position="输入数据.场地档期结束日期"
                ))
        
        if data.entry_time and data.schedule_start_date:
            if data.entry_time.date() < data.schedule_start_date:
                self.errors.append(ErrorDetail(
                    field='entry_time',
                    message="进场时间不能早于场地档期开始日期",
                    original_position="输入数据.进场时间"
                ))
    
    def _check_duplicate_booth_number(self, data: BoothCertificateCreate):
        existing = self.db.query(BoothCertificate).filter(
            BoothCertificate.booth_number == data.booth_number,
            BoothCertificate.batch_number == data.batch_number,
            BoothCertificate.is_duplicate == False
        ).first()
        
        if existing:
            self.errors.append(ErrorDetail(
                field='booth_number',
                message=f"摊位编号 {data.booth_number} 在批次 {data.batch_number} 中已存在",
                original_position="输入数据.摊位编号"
            ))
    
    def _check_certificate_expiry(self, data: BoothCertificateCreate):
        if data.certificate_expiry_date and data.certificate_expiry_date < date.today():
            self.errors.append(ErrorDetail(
                field='certificate_expiry_date',
                message=f"证照已过期（过期日期：{data.certificate_expiry_date}）",
                original_position="输入数据.证照过期日期"
            ))


class MaterialClassifier:
    @staticmethod
    def classify(errors: List[ErrorDetail], data: BoothCertificateCreate) -> Tuple[MaterialStatus, str, str]:
        has_blocking_errors = False
        has_expiry_error = False
        missing_fields = []
        
        for error in errors:
            if '已过期' in error.message:
                has_expiry_error = True
            elif '不能为空' in error.message or '缺失' in error.message:
                missing_fields.append(error.field)
            elif '已存在' in error.message:
                has_blocking_errors = True
        
        if has_expiry_error:
            return (
                MaterialStatus.PENDING_SUPPLEMENT,
                "请更新营业执照和消防材料，确保证照在有效期内",
                "证照过期，必须补充新材料"
            )
        
        if has_blocking_errors:
            return (
                MaterialStatus.BLOCKED,
                "材料已拦截，请检查并重新提交",
                "存在严重错误：重复编号或数据冲突"
            )
        
        if missing_fields:
            return (
                MaterialStatus.PENDING_SUPPLEMENT,
                f"请补充以下材料：{', '.join(missing_fields)}",
                f"缺少必填字段：{len(missing_fields)}个"
            )
        
        return (
            MaterialStatus.NORMAL,
            "材料审核通过，可以安排进场",
            "所有字段完整且符合要求"
        )


class DuplicateHandler:
    def __init__(self, db: Session):
        self.db = db
    
    def check_duplicate(self, data: BoothCertificateCreate) -> Optional[BoothCertificate]:
        existing = self.db.query(BoothCertificate).filter(
            BoothCertificate.batch_number == data.batch_number,
            BoothCertificate.booth_number == data.booth_number,
            BoothCertificate.mall_name == data.mall_name,
            BoothCertificate.is_duplicate == False
        ).first()
        
        return existing
    
    def create_duplicate_record(self, data: BoothCertificateCreate, original: BoothCertificate, processor: str) -> BoothCertificate:
        duplicate = BoothCertificate(
            batch_number=data.batch_number,
            booth_number=data.booth_number,
            mall_name=data.mall_name,
            certificate_version=data.certificate_version,
            schedule_start_date=data.schedule_start_date,
            schedule_end_date=data.schedule_end_date,
            entry_time=data.entry_time,
            business_license=data.business_license,
            fire_safety_material=data.fire_safety_material,
            certificate_expiry_date=data.certificate_expiry_date,
            deposit_status=data.deposit_status,
            status=original.status,
            follow_up_action=original.follow_up_action,
            reject_reason="重复提交，使用原有处理结果",
            error_details=json.dumps([{"field": "duplicate", "message": "批次重复提交", "original_position": "整批材料"}]),
            processor=processor,
            is_duplicate=True,
            original_batch_id=original.id
        )
        
        self.db.add(duplicate)
        self.db.commit()
        self.db.refresh(duplicate)
        
        return duplicate
