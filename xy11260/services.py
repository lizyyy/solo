from datetime import datetime
from typing import Optional, Dict, List, Any
from sqlalchemy.orm import Session
from database import (
    Hazard, HazardStatus, OperationLog, OperationType, IdempotentRequest,
    User, RoleType
)
from utils import (
    generate_request_key, generate_hash, to_json, parse_json,
    hazard_to_dict, operation_log_to_dict, logger, mask_sensitive_data
)


class HazardManagementService:
    def __init__(self, db: Session):
        self.db = db

    def _get_user(self, user_id: str) -> Optional[User]:
        return self.db.query(User).filter(User.user_id == user_id, User.is_active == True).first()

    def _get_hazard_by_no(self, hazard_no: str) -> Optional[Hazard]:
        return self.db.query(Hazard).filter(Hazard.hazard_no == hazard_no, Hazard.is_deleted == False).first()

    def _check_idempotent(self, request_key: str) -> Optional[Dict]:
        idempotent = self.db.query(IdempotentRequest).filter(
            IdempotentRequest.request_key == request_key
        ).first()
        if idempotent:
            logger.info(f"幂等请求命中: {request_key}")
            return parse_json(idempotent.response_data)
        return None

    def _save_idempotent_response(self, request_key: str, operation_type: str,
                                   hazard_no: Optional[str], operator_id: str,
                                   response_data: Dict):
        response_json = to_json(response_data)
        response_hash = generate_hash(response_json)
        idempotent = IdempotentRequest(
            request_key=request_key,
            operation_type=operation_type,
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_hash=response_hash,
            response_data=response_json
        )
        self.db.add(idempotent)

    def _log_operation(self, hazard_id: int, operation_type: OperationType,
                       operator_id: str, operator_name: str, operator_role: RoleType,
                       remark: Optional[str] = None, old_values: Optional[Dict] = None,
                       new_values: Optional[Dict] = None, ip_address: Optional[str] = None,
                       user_agent: Optional[str] = None):
        log = OperationLog(
            hazard_id=hazard_id,
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            operator_role=operator_role,
            remark=remark,
            old_values=to_json(old_values) if old_values else None,
            new_values=to_json(new_values) if new_values else None,
            ip_address=ip_address,
            user_agent=user_agent
        )
        self.db.add(log)

    def register_hazard(self, hazard_no: str, title: str, description: str,
                        location: str, level: str, operator_id: str,
                        photo_path: Optional[str] = None, request_id: Optional[str] = None,
                        ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Dict:
        unique_id = request_id or hazard_no
        request_key = generate_request_key('register', operator_id, unique_id)

        cached = self._check_idempotent(request_key)
        if cached:
            return cached

        operator = self._get_user(operator_id)
        if not operator:
            raise ValueError(f"操作人不存在: {operator_id}")

        if operator.role not in [RoleType.SAFETY_OFFICER, RoleType.ADMIN]:
            raise PermissionError(f"无权限登记隐患: {operator.role}")

        existing = self._get_hazard_by_no(hazard_no)
        if existing:
            raise ValueError(f"隐患编号已存在: {hazard_no}")

        hazard = Hazard(
            hazard_no=hazard_no,
            title=title,
            description=description,
            location=location,
            level=level,
            status=HazardStatus.REGISTERED,
            photo_path=photo_path,
            photo_hash=generate_hash(photo_path) if photo_path else None,
            registered_by_id=operator.user_id,
            registered_by_name=operator.username,
            registered_time=datetime.utcnow()
        )

        self.db.add(hazard)
        self.db.flush()

        self._log_operation(
            hazard_id=hazard.id,
            operation_type=OperationType.REGISTER,
            operator_id=operator.user_id,
            operator_name=operator.username,
            operator_role=operator.role,
            remark=f"登记隐患: {title}",
            new_values=hazard_to_dict(hazard),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.commit()

        result = {
            "success": True,
            "message": "隐患登记成功",
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

        self._save_idempotent_response(
            request_key=request_key,
            operation_type='register',
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_data=result
        )
        self.db.commit()

        logger.info(f"隐患登记成功: {hazard_no}, 操作人: {mask_sensitive_data({'id': operator_id})}")
        return result

    def assign_hazard(self, hazard_no: str, rectifier_id: str, deadline: datetime,
                      operator_id: str, remark: Optional[str] = None,
                      request_id: Optional[str] = None, ip_address: Optional[str] = None,
                      user_agent: Optional[str] = None) -> Dict:
        unique_id = request_id or f"{hazard_no}_{rectifier_id}"
        request_key = generate_request_key('assign', operator_id, unique_id)

        cached = self._check_idempotent(request_key)
        if cached:
            return cached

        operator = self._get_user(operator_id)
        if not operator:
            raise ValueError(f"操作人不存在: {operator_id}")

        if operator.role not in [RoleType.SAFETY_OFFICER, RoleType.ADMIN]:
            raise PermissionError(f"无权限派发隐患: {operator.role}")

        hazard = self._get_hazard_by_no(hazard_no)
        if not hazard:
            raise ValueError(f"隐患不存在: {hazard_no}")

        if hazard.status not in [HazardStatus.REGISTERED, HazardStatus.REJECTED]:
            raise ValueError(f"隐患状态不允许派发: {hazard.status}")

        rectifier = self._get_user(rectifier_id)
        if not rectifier:
            raise ValueError(f"整改人不存在: {rectifier_id}")

        if rectifier.role not in [RoleType.RECTIFIER, RoleType.ADMIN]:
            raise PermissionError(f"该用户无整改权限: {rectifier.role}")

        old_values = hazard_to_dict(hazard)

        hazard.rectifier_id = rectifier.user_id
        hazard.rectifier_name = rectifier.username
        hazard.rectifier_phone = rectifier.phone
        hazard.rectifier_dept = rectifier.department
        hazard.deadline = deadline
        hazard.status = HazardStatus.ASSIGNED
        hazard.assigned_by_id = operator.user_id
        hazard.assigned_by_name = operator.username
        hazard.assigned_time = datetime.utcnow()

        self._log_operation(
            hazard_id=hazard.id,
            operation_type=OperationType.ASSIGN,
            operator_id=operator.user_id,
            operator_name=operator.username,
            operator_role=operator.role,
            remark=remark or f"派发给: {rectifier.username}",
            old_values=old_values,
            new_values=hazard_to_dict(hazard),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.commit()

        result = {
            "success": True,
            "message": "隐患派发成功",
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

        self._save_idempotent_response(
            request_key=request_key,
            operation_type='assign',
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_data=result
        )
        self.db.commit()

        logger.info(f"隐患派发成功: {hazard_no} -> {mask_sensitive_data({'id': rectifier_id})}")
        return result

    def rectify_hazard(self, hazard_no: str, rectification_desc: str, operator_id: str,
                       photo_path: Optional[str] = None, request_id: Optional[str] = None,
                       ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Dict:
        unique_id = request_id or f"{hazard_no}_rectify"
        request_key = generate_request_key('rectify', operator_id, unique_id)

        cached = self._check_idempotent(request_key)
        if cached:
            return cached

        operator = self._get_user(operator_id)
        if not operator:
            raise ValueError(f"操作人不存在: {operator_id}")

        hazard = self._get_hazard_by_no(hazard_no)
        if not hazard:
            raise ValueError(f"隐患不存在: {hazard_no}")

        if hazard.status != HazardStatus.ASSIGNED:
            raise ValueError(f"隐患状态不允许整改: {hazard.status}")

        if hazard.rectifier_id != operator.user_id and operator.role != RoleType.ADMIN:
            raise PermissionError(f"只有指定整改人可以整改")

        old_values = hazard_to_dict(hazard)

        hazard.rectification_desc = rectification_desc
        hazard.rectification_photo_path = photo_path
        hazard.rectification_time = datetime.utcnow()
        hazard.status = HazardStatus.RECTIFIED
        hazard.rectified_by_id = operator.user_id
        hazard.rectified_by_name = operator.username

        self._log_operation(
            hazard_id=hazard.id,
            operation_type=OperationType.RECTIFY,
            operator_id=operator.user_id,
            operator_name=operator.username,
            operator_role=operator.role,
            remark=f"完成整改: {rectification_desc[:50]}...",
            old_values=old_values,
            new_values=hazard_to_dict(hazard),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.commit()

        result = {
            "success": True,
            "message": "隐患整改完成",
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

        self._save_idempotent_response(
            request_key=request_key,
            operation_type='rectify',
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_data=result
        )
        self.db.commit()

        logger.info(f"隐患整改完成: {hazard_no}")
        return result

    def recheck_hazard(self, hazard_no: str, recheck_result: bool, recheck_opinion: str,
                       operator_id: str, photo_path: Optional[str] = None,
                       request_id: Optional[str] = None, ip_address: Optional[str] = None,
                       user_agent: Optional[str] = None) -> Dict:
        unique_id = request_id or f"{hazard_no}_recheck_{recheck_result}"
        request_key = generate_request_key('recheck', operator_id, unique_id)

        cached = self._check_idempotent(request_key)
        if cached:
            return cached

        operator = self._get_user(operator_id)
        if not operator:
            raise ValueError(f"操作人不存在: {operator_id}")

        if operator.role not in [RoleType.SAFETY_OFFICER, RoleType.REVIEWER, RoleType.ADMIN]:
            raise PermissionError(f"无权限复查: {operator.role}")

        hazard = self._get_hazard_by_no(hazard_no)
        if not hazard:
            raise ValueError(f"隐患不存在: {hazard_no}")

        if hazard.status != HazardStatus.RECTIFIED:
            raise ValueError(f"隐患状态不允许复查: {hazard.status}")

        old_values = hazard_to_dict(hazard)

        hazard.recheck_result = recheck_result
        hazard.recheck_opinion = recheck_opinion
        hazard.recheck_photo_path = photo_path
        hazard.recheck_time = datetime.utcnow()
        hazard.rechecked_by_id = operator.user_id
        hazard.rechecked_by_name = operator.username

        if recheck_result:
            hazard.status = HazardStatus.RECHECKED
            remark = f"复查通过: {recheck_opinion[:50]}..."
        else:
            hazard.status = HazardStatus.REJECTED
            remark = f"复查不通过,需重新整改: {recheck_opinion[:50]}..."

        self._log_operation(
            hazard_id=hazard.id,
            operation_type=OperationType.RECHECK,
            operator_id=operator.user_id,
            operator_name=operator.username,
            operator_role=operator.role,
            remark=remark,
            old_values=old_values,
            new_values=hazard_to_dict(hazard),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.commit()

        result = {
            "success": True,
            "message": "隐患复查完成",
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

        self._save_idempotent_response(
            request_key=request_key,
            operation_type='recheck',
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_data=result
        )
        self.db.commit()

        logger.info(f"隐患复查完成: {hazard_no}, 结果: {'通过' if recheck_result else '不通过'}")
        return result

    def archive_hazard(self, hazard_no: str, operator_id: str,
                       remark: Optional[str] = None, request_id: Optional[str] = None,
                       ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> Dict:
        unique_id = request_id or f"{hazard_no}_archive"
        request_key = generate_request_key('archive', operator_id, unique_id)

        cached = self._check_idempotent(request_key)
        if cached:
            return cached

        operator = self._get_user(operator_id)
        if not operator:
            raise ValueError(f"操作人不存在: {operator_id}")

        if operator.role not in [RoleType.SAFETY_OFFICER, RoleType.ADMIN]:
            raise PermissionError(f"无权限归档: {operator.role}")

        hazard = self._get_hazard_by_no(hazard_no)
        if not hazard:
            raise ValueError(f"隐患不存在: {hazard_no}")

        if hazard.status != HazardStatus.RECHECKED:
            raise ValueError(f"隐患状态不允许归档: {hazard.status}")

        old_values = hazard_to_dict(hazard)

        hazard.status = HazardStatus.ARCHIVED
        hazard.archived_by_id = operator.user_id
        hazard.archived_by_name = operator.username
        hazard.archived_time = datetime.utcnow()

        self._log_operation(
            hazard_id=hazard.id,
            operation_type=OperationType.ARCHIVE,
            operator_id=operator.user_id,
            operator_name=operator.username,
            operator_role=operator.role,
            remark=remark or "隐患闭环归档",
            old_values=old_values,
            new_values=hazard_to_dict(hazard),
            ip_address=ip_address,
            user_agent=user_agent
        )

        self.db.commit()

        result = {
            "success": True,
            "message": "隐患归档完成",
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

        self._save_idempotent_response(
            request_key=request_key,
            operation_type='archive',
            hazard_no=hazard_no,
            operator_id=operator_id,
            response_data=result
        )
        self.db.commit()

        logger.info(f"隐患归档完成: {hazard_no}")
        return result

    def get_hazard(self, hazard_no: str) -> Dict:
        hazard = self._get_hazard_by_no(hazard_no)
        if not hazard:
            raise ValueError(f"隐患不存在: {hazard_no}")
        return {
            "success": True,
            "data": mask_sensitive_data(hazard_to_dict(hazard))
        }

    def list_hazards(self, status: Optional[HazardStatus] = None,
                     level: Optional[str] = None, rectifier_id: Optional[str] = None,
                     start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                     page: int = 1, page_size: int = 20) -> Dict:
        query = self.db.query(Hazard).filter(Hazard.is_deleted == False)

        if status:
            query = query.filter(Hazard.status == status)
        if level:
            query = query.filter(Hazard.level == level)
        if rectifier_id:
            query = query.filter(Hazard.rectifier_id == rectifier_id)
        if start_date:
            query = query.filter(Hazard.registered_time >= start_date)
        if end_date:
            query = query.filter(Hazard.registered_time <= end_date)

        total = query.count()
        hazards = query.order_by(Hazard.registered_time.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()

        return {
            "success": True,
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "items": [mask_sensitive_data(hazard_to_dict(h)) for h in hazards]
            }
        }

    def get_operation_logs(self, hazard_no: Optional[str] = None,
                           operation_type: Optional[OperationType] = None,
                           operator_id: Optional[str] = None,
                           start_date: Optional[datetime] = None,
                           end_date: Optional[datetime] = None,
                           page: int = 1, page_size: int = 50) -> Dict:
        query = self.db.query(OperationLog)

        if hazard_no:
            hazard = self._get_hazard_by_no(hazard_no)
            if hazard:
                query = query.filter(OperationLog.hazard_id == hazard.id)
        if operation_type:
            query = query.filter(OperationLog.operation_type == operation_type)
        if operator_id:
            query = query.filter(OperationLog.operator_id == operator_id)
        if start_date:
            query = query.filter(OperationLog.operation_time >= start_date)
        if end_date:
            query = query.filter(OperationLog.operation_time <= end_date)

        total = query.count()
        logs = query.order_by(OperationLog.operation_time.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()

        return {
            "success": True,
            "data": {
                "total": total,
                "page": page,
                "page_size": page_size,
                "items": [mask_sensitive_data(operation_log_to_dict(log)) for log in logs]
            }
        }

    def get_statistics(self, start_date: Optional[datetime] = None,
                       end_date: Optional[datetime] = None) -> Dict:
        query = self.db.query(Hazard).filter(Hazard.is_deleted == False)

        if start_date:
            query = query.filter(Hazard.registered_time >= start_date)
        if end_date:
            query = query.filter(Hazard.registered_time <= end_date)

        total = query.count()
        registered = query.filter(Hazard.status == HazardStatus.REGISTERED).count()
        assigned = query.filter(Hazard.status == HazardStatus.ASSIGNED).count()
        rectified = query.filter(Hazard.status == HazardStatus.RECTIFIED).count()
        rechecked = query.filter(Hazard.status == HazardStatus.RECHECKED).count()
        archived = query.filter(Hazard.status == HazardStatus.ARCHIVED).count()
        rejected = query.filter(Hazard.status == HazardStatus.REJECTED).count()

        closed = archived
        pending = total - closed

        return {
            "success": True,
            "data": {
                "total": total,
                "pending": pending,
                "closed": closed,
                "closure_rate": round(closed / total * 100, 2) if total > 0 else 0,
                "status_detail": {
                    "registered": registered,
                    "assigned": assigned,
                    "rectified": rectified,
                    "rechecked": rechecked,
                    "archived": archived,
                    "rejected": rejected
                }
            }
        }
