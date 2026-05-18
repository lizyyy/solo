from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import json
from datetime import datetime
from database import (
    SamplingPoint, Unit, Parameter, Threshold, FieldRecord, LabResult,
    AuditLog, ReviewReport
)
import schemas


class UnitConversionService:
    @staticmethod
    def convert_value(db: Session, value: float, from_unit_id: int, to_unit_id: int) -> Optional[float]:
        from_unit = db.query(Unit).filter(Unit.id == from_unit_id).first()
        to_unit = db.query(Unit).filter(Unit.id == to_unit_id).first()

        if not from_unit or not to_unit:
            return None

        if from_unit.dimension != to_unit.dimension:
            return None

        from_base = from_unit.conversion_factor
        to_base = to_unit.conversion_factor

        base_value = value * from_base
        converted_value = base_value / to_base

        return round(converted_value, 6)


class PointMatchingService:
    @staticmethod
    def match_point(db: Session, point_code: str) -> Optional[SamplingPoint]:
        return db.query(SamplingPoint).filter(
            SamplingPoint.point_code == point_code,
            SamplingPoint.is_active == True
        ).first()

    @staticmethod
    def validate_sampling_point(db: Session, sampling_point_id: int) -> bool:
        point = db.query(SamplingPoint).filter(
            SamplingPoint.id == sampling_point_id,
            SamplingPoint.is_active == True
        ).first()
        return point is not None


class ThresholdService:
    @staticmethod
    def check_threshold(db: Session, parameter_id: int, value: float, unit_id: int) -> Dict[str, Any]:
        parameter = db.query(Parameter).filter(Parameter.id == parameter_id).first()
        if not parameter:
            return {"passed": False, "grade": None, "message": "参数不存在"}

        default_unit_id = parameter.default_unit_id

        if default_unit_id and unit_id != default_unit_id:
            converted_value = UnitConversionService.convert_value(
                db, value, unit_id, default_unit_id
            )
            if converted_value is None:
                return {"passed": False, "grade": None, "message": "单位换算失败"}
            check_value = converted_value
            check_unit_id = default_unit_id
        else:
            check_value = value
            check_unit_id = unit_id

        thresholds = db.query(Threshold).filter(
            Threshold.parameter_id == parameter_id,
            Threshold.unit_id == check_unit_id
        ).all()

        for threshold in thresholds:
            min_ok = threshold.min_value is None or check_value >= threshold.min_value
            max_ok = threshold.max_value is None or check_value <= threshold.max_value
            if min_ok and max_ok:
                return {
                    "passed": True,
                    "grade": threshold.water_grade,
                    "value": check_value,
                    "threshold_id": threshold.id
                }

        return {"passed": False, "grade": None, "message": "未匹配到水质等级阈值"}


class MissingSampleService:
    @staticmethod
    def find_missing_samples(db: Session, field_record_ids: List[int], required_params: Optional[List[int]] = None) -> Dict[str, Any]:
        missing_info = {}

        if required_params is None:
            required_params = [p.id for p in db.query(Parameter).all()]

        for record_id in field_record_ids:
            field_record = db.query(FieldRecord).filter(FieldRecord.id == record_id).first()
            if not field_record:
                continue

            existing_params = db.query(LabResult.parameter_id).filter(
                LabResult.field_record_id == record_id
            ).all()
            existing_param_ids = {p[0] for p in existing_params}

            missing_params = []
            for param_id in required_params:
                if param_id not in existing_param_ids:
                    param = db.query(Parameter).filter(Parameter.id == param_id).first()
                    if param:
                        missing_params.append({
                            "param_id": param.id,
                            "param_code": param.param_code,
                            "param_name": param.param_name
                        })

            if missing_params:
                missing_info[field_record.record_code] = {
                    "field_record_id": record_id,
                    "point_code": field_record.sampling_point.point_code,
                    "point_name": field_record.sampling_point.point_name,
                    "missing_params": missing_params
                }

        return {
            "has_missing": len(missing_info) > 0,
            "missing_count": len(missing_info),
            "details": missing_info
        }


class AuditService:
    @staticmethod
    def log_operation(
        db: Session,
        operation_type: str,
        entity_type: str,
        entity_id: Optional[int],
        operator: str,
        conclusion: str,
        original_data: Optional[Dict] = None,
        modified_data: Optional[Dict] = None
    ) -> AuditLog:
        audit_log = AuditLog(
            operation_type=operation_type,
            entity_type=entity_type,
            entity_id=entity_id,
            original_data=json.dumps(original_data, ensure_ascii=False) if original_data else None,
            modified_data=json.dumps(modified_data, ensure_ascii=False) if modified_data else None,
            operator=operator,
            conclusion=conclusion
        )
        db.add(audit_log)
        db.commit()
        db.refresh(audit_log)
        return audit_log


class LabResultService:
    @staticmethod
    def create_lab_result(db: Session, lab_result: schemas.LabResultCreate) -> LabResult:
        field_record = db.query(FieldRecord).filter(FieldRecord.id == lab_result.field_record_id).first()
        if not field_record:
            raise ValueError("现场记录不存在")

        if not PointMatchingService.validate_sampling_point(db, field_record.sampling_point_id):
            raise ValueError("采样点无效")

        parameter = db.query(Parameter).filter(Parameter.id == lab_result.parameter_id).first()
        if not parameter:
            raise ValueError("检测参数不存在")

        raw_unit = db.query(Unit).filter(Unit.id == lab_result.raw_unit_id).first()
        if not raw_unit:
            raise ValueError("原始数据单位不存在")

        converted_value = None
        if parameter.default_unit_id:
            converted_value = UnitConversionService.convert_value(
                db, lab_result.raw_value, lab_result.raw_unit_id, parameter.default_unit_id
            )
            if converted_value is None:
                raise ValueError("单位换算失败，请检查单位维度是否匹配")

        db_lab_result = LabResult(
            **lab_result.model_dump(),
            converted_value=converted_value,
            standard_unit_id=parameter.default_unit_id
        )
        db.add(db_lab_result)
        db.commit()
        db.refresh(db_lab_result)

        AuditService.log_operation(
            db, "create", "LabResult", db_lab_result.id,
            lab_result.analyst or "system", "创建实验室结果",
            modified_data=lab_result.model_dump()
        )

        return db_lab_result

    @staticmethod
    def approve_lab_result(db: Session, lab_result_id: int, operator: str, conclusion: Optional[str] = None) -> LabResult:
        lab_result = db.query(LabResult).filter(LabResult.id == lab_result_id).first()
        if not lab_result:
            raise ValueError("实验室结果不存在")

        if lab_result.is_approved:
            raise ValueError("该结果已审核")

        original_data = {
            "is_approved": lab_result.is_approved,
            "approver": lab_result.approver
        }

        lab_result.is_approved = True
        lab_result.approver = operator
        lab_result.approval_time = datetime.utcnow()
        db.commit()
        db.refresh(lab_result)

        AuditService.log_operation(
            db, "approve", "LabResult", lab_result_id,
            operator, conclusion or "审核通过",
            original_data=original_data,
            modified_data={"is_approved": True, "approver": operator}
        )

        return lab_result

    @staticmethod
    def correct_lab_result(db: Session, lab_result_id: int, correction: schemas.CorrectionRequest) -> LabResult:
        lab_result = db.query(LabResult).filter(LabResult.id == lab_result_id).first()
        if not lab_result:
            raise ValueError("实验室结果不存在")

        original_data = {
            "raw_value": lab_result.raw_value,
            "raw_unit_id": lab_result.raw_unit_id,
            "remark": lab_result.remark
        }

        modified_data = {}
        if correction.raw_value is not None:
            lab_result.raw_value = correction.raw_value
            modified_data["raw_value"] = correction.raw_value

            parameter = db.query(Parameter).filter(Parameter.id == lab_result.parameter_id).first()
            if parameter and parameter.default_unit_id:
                lab_result.converted_value = UnitConversionService.convert_value(
                    db, correction.raw_value, lab_result.raw_unit_id, parameter.default_unit_id
                )

        if correction.raw_unit_id is not None:
            lab_result.raw_unit_id = correction.raw_unit_id
            modified_data["raw_unit_id"] = correction.raw_unit_id

            parameter = db.query(Parameter).filter(Parameter.id == lab_result.parameter_id).first()
            if parameter and parameter.default_unit_id:
                lab_result.converted_value = UnitConversionService.convert_value(
                    db, lab_result.raw_value, correction.raw_unit_id, parameter.default_unit_id
                )

        if correction.remark is not None:
            lab_result.remark = correction.remark
            modified_data["remark"] = correction.remark

        if lab_result.is_approved:
            lab_result.is_approved = False
            lab_result.approver = None
            lab_result.approval_time = None
            modified_data["is_approved"] = False

        db.commit()
        db.refresh(lab_result)

        AuditService.log_operation(
            db, "correct", "LabResult", lab_result_id,
            correction.operator, correction.conclusion,
            original_data=original_data,
            modified_data=modified_data
        )

        return lab_result

    @staticmethod
    def withdraw_lab_result(db: Session, lab_result_id: int, operator: str, reason: str) -> LabResult:
        lab_result = db.query(LabResult).filter(LabResult.id == lab_result_id).first()
        if not lab_result:
            raise ValueError("实验室结果不存在")

        original_data = {"is_approved": lab_result.is_approved}

        lab_result.is_approved = False
        lab_result.approver = None
        lab_result.approval_time = None
        lab_result.remark = (lab_result.remark or "") + f" [撤回: {reason}]"
        db.commit()
        db.refresh(lab_result)

        AuditService.log_operation(
            db, "withdraw", "LabResult", lab_result_id,
            operator, reason,
            original_data=original_data,
            modified_data={"is_approved": False}
        )

        return lab_result
