import json
from typing import List, Dict
from sqlalchemy.orm import Session
from app.models import (
    ImportBatch, RequisitionRecord, ReconciliationRecord,
    Employee, Coupon
)


def _match_employee(db: Session, emp_no: str, emp_name: str) -> Dict:
    emp = db.query(Employee).filter_by(emp_no=emp_no).first()
    if not emp:
        return {
            "match": "unmatched",
            "reason": f"员工表中无工号 {emp_no} 的记录，可能是临时工号或数据未同步",
            "employee": None,
        }
    if emp.status == "resigned" or emp.status == "离职":
        return {
            "match": "resigned",
            "reason": f"员工 {emp.name}（{emp_no}）已在员工表中标记为离职状态",
            "employee": emp,
        }
    if emp.name != emp_name:
        return {
            "match": "name_mismatch",
            "reason": f"员工表姓名为 {emp.name}，但领用记录姓名为 {emp_name}，可能存在代领或录入错误",
            "employee": emp,
        }
    return {
        "match": "matched",
        "reason": None,
        "employee": emp,
    }


def _match_coupon(db: Session, coupon_code: str, emp_no: str) -> Dict:
    if not coupon_code:
        return {
            "match": "no_code",
            "reason": "领用记录无券码，可能为现金发放或线下领取未登记券码",
            "coupon": None,
        }
    coupon = db.query(Coupon).filter_by(coupon_code=coupon_code).first()
    if not coupon:
        return {
            "match": "unmatched",
            "reason": f"券码表中无 {coupon_code} 的记录，券码可能已过期、作废或录入错误",
            "coupon": None,
        }
    if coupon.status == "used":
        if coupon.issued_emp_no and coupon.issued_emp_no != emp_no:
            return {
                "match": "cross_used",
                "reason": f"券码 {coupon_code} 已被标记为已使用，且绑定员工为 {coupon.issued_emp_no}（{coupon.issued_name}），与当前领取人 {emp_no} 不一致",
                "coupon": coupon,
            }
        return {
            "match": "already_used",
            "reason": f"券码 {coupon_code} 已被标记为已使用，需确认是否重复核销",
            "coupon": coupon,
        }
    if coupon.status == "expired":
        return {
            "match": "expired",
            "reason": f"券码 {coupon_code} 已过期（有效期 {coupon.expire_date}）",
            "coupon": coupon,
        }
    if coupon.issued_emp_no and coupon.issued_emp_no != emp_no:
        return {
            "match": "mismatch_holder",
            "reason": f"券码 {coupon_code} 原定发放给 {coupon.issued_emp_no}（{coupon.issued_name}），当前领取人 {emp_no} 不符",
            "coupon": coupon,
        }
    return {
        "match": "matched",
        "reason": None,
        "coupon": coupon,
    }


def run_reconciliation(db: Session, requisition_batch_no: str = None) -> Dict:
    if requisition_batch_no:
        batch = db.query(ImportBatch).filter_by(batch_no=requisition_batch_no).first()
        if not batch:
            return {"success": False, "error": f"批次 {requisition_batch_no} 不存在"}
        if batch.batch_type != "requisition":
            return {"success": False, "error": f"批次 {requisition_batch_no} 不是领用批次"}
        requisitions = db.query(RequisitionRecord).filter_by(batch_id=batch.id).all()
    else:
        requisitions = (
            db.query(RequisitionRecord)
            .outerjoin(ReconciliationRecord)
            .filter(ReconciliationRecord.id == None)
            .all()
        )

    if not requisitions:
        return {"success": True, "message": "没有需要对账的领用记录", "processed": 0}

    processed = 0
    created = 0
    updated = 0

    for req in requisitions:
        existing = db.query(ReconciliationRecord).filter_by(requisition_id=req.id).first()

        emp_result = _match_employee(db, req.emp_no, req.emp_name)
        cp_result = _match_coupon(db, req.coupon_code, req.emp_no) if req.coupon_code else {"match": "no_code", "reason": None, "coupon": None}

        batch_no = (
            db.query(ImportBatch.batch_no)
            .filter(ImportBatch.id == req.batch_id)
            .scalar()
        )

        flags = []
        anomaly_detail = {}
        is_resigned = False
        resigned_detail = None
        is_proxy = bool(req.proxy_emp_no and req.proxy_name)
        proxy_detail = None
        is_duplicate = False
        duplicate_with = None

        if emp_result["match"] == "resigned":
            is_resigned = True
            resigned_detail = emp_result["reason"]
            flags.append("离职拦截")
            anomaly_detail["resigned"] = emp_result["reason"]

        if emp_result["match"] == "unmatched":
            flags.append("员工未匹配")
            anomaly_detail["employee_unmatched"] = emp_result["reason"]

        if emp_result["match"] == "name_mismatch":
            if is_proxy:
                proxy_detail = f"姓名不一致（员工表：{emp_result['employee'].name}，领用记录：{req.emp_name}），存在代领人 {req.proxy_name}（{req.proxy_emp_no}），需确认代领是否经过授权"
                flags.append("代领")
                anomaly_detail["proxy"] = proxy_detail
            else:
                flags.append("姓名不一致")
                anomaly_detail["name_mismatch"] = emp_result["reason"]

        if is_proxy:
            if not proxy_detail:
                proxy_detail = f"代领人：{req.proxy_name}（{req.proxy_emp_no}），需确认代领是否经过授权"
            flags.append("代领")
            anomaly_detail.setdefault("proxy", proxy_detail)

        if cp_result["match"] == "unmatched":
            flags.append("券码未匹配")
            anomaly_detail["coupon_unmatched"] = cp_result["reason"]

        if cp_result["match"] == "already_used":
            flags.append("券码已使用")
            anomaly_detail["coupon_used"] = cp_result["reason"]
            duplicates = (
                db.query(RequisitionRecord)
                .filter(
                    RequisitionRecord.coupon_code == req.coupon_code,
                    RequisitionRecord.id != req.id,
                )
                .all()
            )
            if duplicates:
                is_duplicate = True
                duplicate_with = "; ".join(
                    [f"{d.emp_no}-{d.emp_name}({d.id})" for d in duplicates]
                )
                flags.append("重复领取")
                anomaly_detail["duplicate"] = f"券码 {req.coupon_code} 已被 {duplicate_with} 领取"

        if cp_result["match"] == "cross_used":
            flags.append("券码交叉使用")
            anomaly_detail["coupon_cross"] = cp_result["reason"]

        if cp_result["match"] == "expired":
            flags.append("券码过期")
            anomaly_detail["coupon_expired"] = cp_result["reason"]

        if cp_result["match"] == "mismatch_holder":
            flags.append("券码持有人不符")
            anomaly_detail["coupon_holder"] = cp_result["reason"]

        if existing:
            existing.employee_match = emp_result["match"]
            existing.employee_mismatch_reason = emp_result["reason"]
            existing.coupon_match = cp_result["match"]
            existing.coupon_mismatch_reason = cp_result["reason"]
            existing.is_resigned = is_resigned
            existing.resigned_detail = resigned_detail
            existing.is_duplicate = is_duplicate
            existing.duplicate_with = duplicate_with
            existing.is_proxy = is_proxy
            existing.proxy_detail = proxy_detail
            existing.anomaly_flags = json.dumps(flags, ensure_ascii=False) if flags else None
            updated += 1
        else:
            rec = ReconciliationRecord(
                requisition_id=req.id,
                batch_no=batch_no,
                employee_match=emp_result["match"],
                employee_mismatch_reason=emp_result["reason"],
                coupon_match=cp_result["match"],
                coupon_mismatch_reason=cp_result["reason"],
                is_resigned=is_resigned,
                resigned_detail=resigned_detail,
                is_duplicate=is_duplicate,
                duplicate_with=duplicate_with,
                is_proxy=is_proxy,
                proxy_detail=proxy_detail,
                anomaly_flags=json.dumps(flags, ensure_ascii=False) if flags else None,
                review_status="pending",
                final_status="pending",
                final_amount=req.claim_amount,
            )
            db.add(rec)
            created += 1
        processed += 1

    db.commit()

    return {
        "success": True,
        "processed": processed,
        "created": created,
        "updated": updated,
    }
