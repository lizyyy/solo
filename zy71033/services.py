from datetime import datetime
from typing import Optional, Tuple, List
from sqlalchemy.orm import Session
import models
import schemas


def add_trace(db: Session, order_id: int, action: models.TraceAction,
              detail: str, result: str, operator: str = "system"):
    trace = models.ProcessingTrace(
        order_id=order_id,
        action=action,
        operator=operator,
        detail=detail,
        result=result
    )
    db.add(trace)
    db.commit()
    return trace


def check_certificate_validity(cert: models.QuarantineCertificate) -> Tuple[bool, str]:
    if not cert:
        return False, "未提供检疫证书"
    
    today = datetime.now().date()
    if cert.expiry_date < today:
        return False, f"证书已过期，有效期至 {cert.expiry_date}"
    
    if cert.status != models.CertificateStatus.VALID:
        return False, f"证书状态无效: {cert.status}"
    
    return True, "证书有效"


def check_destination_embargo(destination: models.Destination) -> Tuple[bool, str]:
    if not destination:
        return False, "目的地信息不存在"
    
    if destination.is_embargoed:
        reason = destination.embargo_reason or "禁运"
        return False, f"目的地禁运: {destination.region_name} - {reason}"
    
    return True, "目的地可发货"


def check_sales_order_rules(db: Session, order: models.SalesOrder) -> schemas.RuleCheckResult:
    cert_check = True
    cert_message = "证书未校验"
    embargo_check = True
    embargo_message = "目的地未校验"
    need_recheck = False
    need_reissue = False

    if order.certificate:
        cert_check, cert_message = check_certificate_validity(order.certificate)
    else:
        cert_check = False
        cert_message = "该订单未关联检疫证书"

    embargo_check, embargo_message = check_destination_embargo(order.destination)

    add_trace(
        db, order.id,
        models.TraceAction.CERT_CHECK,
        f"证书编号: {order.certificate.cert_no if order.certificate else '无'}",
        cert_message
    )

    add_trace(
        db, order.id,
        models.TraceAction.EMBARGO_CHECK,
        f"目的地: {order.destination.region_name} ({order.destination.region_code})",
        embargo_message
    )

    if not cert_check and order.certificate and "过期" in cert_message:
        final_status = models.SalesOrderStatus.NEED_REISSUE
        need_reissue = True
    elif not cert_check or not embargo_check:
        final_status = models.SalesOrderStatus.NEED_RECHECK
        need_recheck = True
    else:
        final_status = models.SalesOrderStatus.APPROVED

    order.status = final_status
    db.commit()

    return schemas.RuleCheckResult(
        order_no=order.order_no,
        cert_check=cert_check,
        cert_message=cert_message,
        embargo_check=embargo_check,
        embargo_message=embargo_message,
        final_status=final_status,
        need_recheck=need_recheck,
        need_reissue=need_reissue
    )


def split_sales_order(db: Session, order_no: str,
                      split_quantities: List[int], operator: str) -> List[models.SalesOrder]:
    original_order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()

    if not original_order:
        raise ValueError("订单不存在")

    if sum(split_quantities) != original_order.quantity:
        raise ValueError("拆单数量之和必须等于原订单数量")

    split_orders = []
    for i, qty in enumerate(split_quantities, 1):
        new_order_no = f"{original_order.order_no}-{i}"
        existing = db.query(models.SalesOrder).filter(
            models.SalesOrder.order_no == new_order_no
        ).first()
        if existing:
            continue

        new_order = models.SalesOrder(
            order_no=new_order_no,
            batch_id=original_order.batch_id,
            cert_id=original_order.cert_id,
            destination_id=original_order.destination_id,
            quantity=qty,
            customer=original_order.customer,
            status=models.SalesOrderStatus.PENDING,
            parent_order_id=original_order.id,
            is_split=True
        )
        db.add(new_order)
        db.flush()
        split_orders.append(new_order)

        add_trace(
            db, new_order.id,
            models.TraceAction.SPLIT_ORDER,
            f"从订单 {original_order.order_no} 拆分，数量: {qty}",
            "拆单成功",
            operator
        )

    original_order.is_split = True
    db.commit()

    return split_orders


def manual_override_order(db: Session, order_no: str,
                          target_status: models.SalesOrderStatus,
                          operator: str, reason: str) -> models.SalesOrder:
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()

    if not order:
        raise ValueError("订单不存在")

    old_status = order.status
    order.status = target_status
    db.commit()
    db.refresh(order)

    add_trace(
        db, order.id,
        models.TraceAction.MANUAL_OVERRIDE,
        f"状态变更: {old_status} -> {target_status}, 原因: {reason}",
        "人工改判成功",
        operator
    )

    return order


def create_reissue_application(db: Session, order_no: str,
                               reason: str) -> models.ReissueApplication:
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()

    if not order:
        raise ValueError("订单不存在")

    pending_reissue = db.query(models.ReissueApplication).filter(
        models.ReissueApplication.order_id == order.id,
        models.ReissueApplication.status.in_([
            models.ReissueStatus.PENDING,
            models.ReissueStatus.SUBMITTED
        ])
    ).first()

    if pending_reissue:
        raise ValueError("该订单已有待处理的补证申请")

    app_no = f"REISS-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    reissue = models.ReissueApplication(
        order_id=order.id,
        application_no=app_no,
        reason=reason,
        status=models.ReissueStatus.PENDING
    )
    db.add(reissue)
    db.commit()
    db.refresh(reissue)

    order.status = models.SalesOrderStatus.NEED_REISSUE
    db.commit()

    add_trace(
        db, order.id,
        models.TraceAction.REISSUE_REQUEST,
        f"补证申请编号: {app_no}, 原因: {reason}",
        "补证申请已创建"
    )

    return reissue


def submit_reissue_cert(db: Session, application_no: str,
                        new_cert_no: str) -> models.ReissueApplication:
    reissue = db.query(models.ReissueApplication).filter(
        models.ReissueApplication.application_no == application_no
    ).first()

    if not reissue:
        raise ValueError("补证申请不存在")

    if reissue.status != models.ReissueStatus.PENDING:
        raise ValueError("补证申请状态不允许提交新证书")

    new_cert = db.query(models.QuarantineCertificate).filter(
        models.QuarantineCertificate.cert_no == new_cert_no
    ).first()

    if not new_cert:
        raise ValueError("新证书不存在")

    reissue.new_cert_id = new_cert.id
    reissue.status = models.ReissueStatus.SUBMITTED
    reissue.submitted_at = datetime.utcnow()
    db.commit()
    db.refresh(reissue)

    return reissue


def review_reissue_application(db: Session, application_no: str,
                               status: models.ReissueStatus,
                               review_remark: str,
                               reviewer: str) -> models.ReissueApplication:
    reissue = db.query(models.ReissueApplication).filter(
        models.ReissueApplication.application_no == application_no
    ).first()

    if not reissue:
        raise ValueError("补证申请不存在")

    if reissue.status != models.ReissueStatus.SUBMITTED:
        raise ValueError("补证申请未提交，无法审核")

    reissue.status = status
    reissue.reviewer = reviewer
    reissue.review_remark = review_remark
    reissue.reviewed_at = datetime.utcnow()
    db.commit()
    db.refresh(reissue)

    if status == models.ReissueStatus.APPROVED and reissue.new_cert_id:
        reissue.order.cert_id = reissue.new_cert_id
        reissue.order.status = models.SalesOrderStatus.PENDING
        db.commit()

        add_trace(
            db, reissue.order_id,
            models.TraceAction.REISSUE_APPROVED,
            f"新证书编号: {reissue.new_certificate.cert_no}, 审核人: {reviewer}",
            "补证审核通过，订单已重新待审"
        )

    return reissue


def get_order_history(db: Session, order_no: str) -> Optional[schemas.OrderHistory]:
    order = db.query(models.SalesOrder).filter(
        models.SalesOrder.order_no == order_no
    ).first()

    if not order:
        return None

    traces = db.query(models.ProcessingTrace).filter(
        models.ProcessingTrace.order_id == order.id
    ).order_by(models.ProcessingTrace.created_at.desc()).all()

    reissues = db.query(models.ReissueApplication).filter(
        models.ReissueApplication.order_id == order.id
    ).order_by(models.ReissueApplication.created_at.desc()).all()

    return schemas.OrderHistory(
        order=schemas.SalesOrder.from_orm(order),
        traces=traces,
        reissues=reissues,
        shipping_report=order.shipping_report
    )
