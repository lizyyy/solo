from datetime import datetime, date
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import database as models
import schemas


class DeclarationStatus:
    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    REVIEWING = "REVIEWING"
    PENDING_SUPPLEMENT = "PENDING_SUPPLEMENT"
    PROCESSING = "PROCESSING"
    REVIEW_AGAIN = "REVIEW_AGAIN"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CLOSED = "CLOSED"
    RETURNED = "RETURNED"


class ErrorCode:
    MISSING_REQUIRED = "MISSING_REQUIRED"
    INVALID_STATUS = "INVALID_STATUS"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    BATTERY_CONFLICT = "BATTERY_CONFLICT"
    CARRIER_RULE_EXPIRED = "CARRIER_RULE_EXPIRED"
    CARRIER_RULE_VIOLATION = "CARRIER_RULE_VIOLATION"
    NOT_FOUND = "NOT_FOUND"


class ErrorType:
    MISSING_MATERIAL = "MISSING_MATERIAL"
    STATUS_NOT_ALLOWED = "STATUS_NOT_ALLOWED"
    DUPLICATE_SUBMISSION = "DUPLICATE_SUBMISSION"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    RULE_VIOLATION = "RULE_VIOLATION"
    SYSTEM_ERROR = "SYSTEM_ERROR"


STATUS_TRANSITIONS = {
    DeclarationStatus.DRAFT: [DeclarationStatus.SUBMITTED, DeclarationStatus.CLOSED],
    DeclarationStatus.SUBMITTED: [DeclarationStatus.REVIEWING, DeclarationStatus.CLOSED],
    DeclarationStatus.REVIEWING: [
        DeclarationStatus.PENDING_SUPPLEMENT,
        DeclarationStatus.PROCESSING,
        DeclarationStatus.REJECTED,
        DeclarationStatus.CLOSED
    ],
    DeclarationStatus.PENDING_SUPPLEMENT: [
        DeclarationStatus.REVIEWING, DeclarationStatus.CLOSED],
    DeclarationStatus.PROCESSING: [
        DeclarationStatus.REVIEW_AGAIN,
        DeclarationStatus.APPROVED,
        DeclarationStatus.RETURNED,
        DeclarationStatus.CLOSED
    ],
    DeclarationStatus.REVIEW_AGAIN: [
        DeclarationStatus.PENDING_SUPPLEMENT,
        DeclarationStatus.PROCESSING,
        DeclarationStatus.REJECTED,
        DeclarationStatus.CLOSED
    ],
    DeclarationStatus.APPROVED: [DeclarationStatus.CLOSED],
    DeclarationStatus.REJECTED: [DeclarationStatus.REVIEWING, DeclarationStatus.CLOSED],
    DeclarationStatus.RETURNED: [
        DeclarationStatus.PENDING_SUPPLEMENT, DeclarationStatus.CLOSED],
    DeclarationStatus.CLOSED: []
}


class DeclarationStateException(Exception):
    def __init__(self, error_code: str, error_type: str, message: str, details: dict = None):
        self.error_code = error_code
        self.error_type = error_type
        self.message = message
        self.details = details or {}
        super().__init__(message)


def can_transition(from_status: str, to_status: str) -> bool:
    return to_status in STATUS_TRANSITIONS.get(from_status, [])


def create_audit_trail(
    db: Session,
    declaration_id: int,
    action: str,
    from_status: Optional[str],
    to_status: Optional[str],
    operator: Optional[str],
    reason: Optional[str] = None,
    details: Optional[str] = None
) -> models.AuditTrail:
    trail = models.AuditTrail(
        declaration_id=declaration_id,
        action=action,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        reason=reason,
        details=details
    )
    db.add(trail)
    db.flush()
    return trail


def check_duplicate_declaration(db: Session, business_no: str) -> Optional[models.Declaration]:
    return db.query(models.Declaration).filter(
        models.Declaration.business_no == business_no
    ).first()


def check_battery_conflict(db: Session, declaration: models.Declaration) -> List[str]:
    conflicts = []
    if not declaration.battery_type_id:
        return conflicts
    battery_type = db.query(models.BatteryType).get(declaration.battery_type_id)
    if battery_type and not battery_type.is_active:
        conflicts.append(f"电池类型 {battery_type.code} 已停用")
    product_battery_types = set()
    for item in declaration.items:
        product = item.product
        if product and product.battery_type_code:
            product_battery_types.add(product.battery_type_code)
            if battery_type and product.battery_type_code != battery_type.code:
                conflicts.append(
                    f"商品 {product.sku} 电池类型 {product.battery_type_code} 与申报单电池类型 {battery_type.code} 冲突"
                )
    if len(product_battery_types) > 1:
        conflicts.append(f"申报单包含多种电池类型: {', '.join(product_battery_types)}")
    return conflicts


def check_carrier_rules(db: Session, declaration: models.Declaration) -> List[str]:
    violations = []
    if not declaration.carrier_id:
        return violations
    carrier = db.query(models.Carrier).get(declaration.carrier_id)
    if not carrier or not carrier.is_active:
        violations.append("承运商不存在或已停用")
        return violations
    today = date.today()
    active_rules = db.query(models.CarrierRule).filter(
        and_(
            models.CarrierRule.carrier_id == declaration.carrier_id,
            models.CarrierRule.is_active == True,
            models.CarrierRule.effective_date <= today,
            or_(models.CarrierRule.expiry_date == None, models.CarrierRule.expiry_date >= today)
        )
    ).all()
    if not active_rules:
        violations.append(f"承运商 {carrier.name} 无有效规则")
        return violations
    battery_type = None
    if declaration.battery_type_id:
        battery_type = db.query(models.BatteryType).get(declaration.battery_type_id)
    for rule in active_rules:
        if battery_type and rule.allowed_battery_types:
            allowed = [bt.strip() for bt in rule.allowed_battery_types.split(",")]
            if battery_type.code not in allowed:
                violations.append(
                    f"规则 {rule.rule_code}: 电池类型 {battery_type.code} 不在允许列表 {allowed}"
                )
    return violations


def attribute_return_reason(return_reason: str, reason_code: Optional[str] = None) -> Tuple[str, str]:
    reason_mapping = {
        "BATTERY_TYPE_ERROR": "关务-电池类型申报错误",
        "BATTERY_DOC_MISSING": "关务-电池资料缺失",
        "PACKAGE_NON_COMPLIANT": "仓库-包装不符合要求",
        "LABEL_INCORRECT": "仓库-标签错误",
        "CARRIER_REJECTION": "承运商-承运限制",
        "DOC_INCOMPLETE": "关务-单证不全",
    }
    if reason_code and reason_code in reason_mapping:
        attribution = reason_mapping[reason_code]
    else:
        attribution = "待复核-需要人工复核"
    notes = f"退件原因: {return_reason}"
    return attribution, notes


def validate_declaration_materials(declaration: models.Declaration) -> List[str]:
    missing = []
    if not declaration.battery_type_id:
        missing.append("电池类型")
    if not declaration.carrier_id:
        missing.append("承运商信息")
    if not declaration.destination_country:
        missing.append("目的地国家")
    if len(declaration.items) == 0:
        missing.append("申报商品明细")
    if not declaration.warehouse_code:
        missing.append("仓库代码")
    return missing


def transition_declaration_status(
    db: Session,
    declaration: models.Declaration,
    new_status: str,
    operator: str,
    reason: Optional[str] = None
) -> models.Declaration:
    old_status = declaration.status
    if not can_transition(old_status, new_status):
        raise DeclarationStateException(
            error_code=ErrorCode.INVALID_STATUS,
            error_type=ErrorType.STATUS_NOT_ALLOWED,
            message=f"无法从状态 {old_status} 转换到 {new_status}",
            details={"from_status": old_status, "to_status": new_status}
        )
    declaration.status = new_status
    now = datetime.utcnow()
    if new_status == DeclarationStatus.REVIEWING:
        declaration.reviewer = operator
        declaration.review_time = now
    elif new_status == DeclarationStatus.PROCESSING:
        declaration.processor = operator
        declaration.process_time = now
    elif new_status == DeclarationStatus.CLOSED:
        declaration.closer = operator
        declaration.close_time = now
    create_audit_trail(
        db=db,
        declaration_id=declaration.id,
        action="STATUS_TRANSITION",
        from_status=old_status,
        to_status=new_status,
        operator=operator,
        reason=reason
    )
    db.flush()
    return declaration


def generate_declaration_report(db: Session, declaration_id: int, report_type: str, generated_by: str) -> models.DeclarationReport:
    declaration = db.query(models.Declaration).get(declaration_id)
    if not declaration:
        raise DeclarationStateException(
            error_code=ErrorCode.NOT_FOUND,
            error_type=ErrorType.SYSTEM_ERROR,
            message="申报单不存在"
        )
    report_content = f"""
    跨境电池申报报告
    ================
    
    基本信息:
    - 业务编号: {declaration.business_no}
    - 申报编号: {declaration.declaration_no or '未生成'}
    - 当前状态: {declaration.status}
    - 目的地: {declaration.destination_country}
    - 申请人: {declaration.applicant}
    
    电池信息:
    - 电池类型: {declaration.battery_type.name if declaration.battery_type else '未设置'}
    - 电池数量: {declaration.total_battery_count}
    
    商品明细:
    {chr(10).join([f'- {item.product.name}: {item.quantity}件' for item in declaration.items])}
    
    处理轨迹:
    {chr(10).join([f'- {trail.created_at}: {trail.action} ({trail.from_status} -> {trail.to_status} by {trail.operator}' for trail in declaration.audit_trails])}
    """
    report = models.DeclarationReport(
        declaration_id=declaration_id,
        report_type=report_type,
        report_content=report_content,
        generated_by=generated_by
    )
    db.add(report)
    db.flush()
    return report
