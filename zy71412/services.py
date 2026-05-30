from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Dict, Any, Optional
import hashlib
import json

from database import (
    Material, Collateral, CollateralVersion, CreditContract,
    CreditOccupancy, Reassessment, ReassessmentTask, Warning
)


def calculate_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def create_material(db: Session, material_type: str, file_name: str,
                    file_content: bytes, uploaded_by: str,
                    source: str = None, remark: str = None) -> Material:
    file_hash = calculate_file_hash(file_content)
    material = Material(
        material_type=material_type,
        file_name=file_name,
        file_hash=file_hash,
        uploaded_by=uploaded_by,
        source=source,
        remark=remark
    )
    db.add(material)
    db.flush()
    return material


def get_or_create_collateral(db: Session, collateral_no: str, name: str,
                             collateral_type: str = None, address: str = None,
                             owner: str = None, id_card: str = None) -> Collateral:
    collateral = db.query(Collateral).filter(Collateral.collateral_no == collateral_no).first()
    if collateral:
        return collateral
    collateral = Collateral(
        collateral_no=collateral_no,
        name=name,
        collateral_type=collateral_type,
        address=address,
        owner=owner,
        id_card=id_card
    )
    db.add(collateral)
    db.flush()
    return collateral


def add_collateral_version(db: Session, collateral_id: int, appraised_value: float,
                           appraisal_date: date, appraisal_expiry_date: date,
                           mortgage_rate: float, material_id: int = None,
                           appraiser: str = None, appraisal_report_no: str = None,
                           remark: str = None) -> CollateralVersion:
    existing_versions = db.query(CollateralVersion).filter(
        CollateralVersion.collateral_id == collateral_id
    ).order_by(CollateralVersion.version_no.desc()).first()

    new_version_no = 1 if not existing_versions else existing_versions.version_no + 1

    db.query(CollateralVersion).filter(
        and_(
            CollateralVersion.collateral_id == collateral_id,
            CollateralVersion.is_active == True
        )
    ).update({"is_active": False})

    version = CollateralVersion(
        collateral_id=collateral_id,
        version_no=new_version_no,
        material_id=material_id,
        appraised_value=appraised_value,
        appraisal_date=appraisal_date,
        appraisal_expiry_date=appraisal_expiry_date,
        mortgage_rate=mortgage_rate,
        appraiser=appraiser,
        appraisal_report_no=appraisal_report_no,
        remark=remark,
        is_active=True
    )
    db.add(version)
    db.flush()
    return version


def create_credit_contract(db: Session, contract_no: str, borrower: str,
                           credit_amount: float, start_date: date, end_date: date,
                           material_id: int = None, borrower_id_card: str = None,
                           bank: str = None, account_manager: str = None,
                           remark: str = None) -> CreditContract:
    contract = CreditContract(
        contract_no=contract_no,
        material_id=material_id,
        borrower=borrower,
        borrower_id_card=borrower_id_card,
        credit_amount=credit_amount,
        start_date=start_date,
        end_date=end_date,
        bank=bank,
        account_manager=account_manager,
        remark=remark
    )
    db.add(contract)
    db.flush()
    return contract


def create_credit_occupancy(db: Session, contract_id: int, collateral_id: int,
                            collateral_version_id: int, occupancy_amount: float,
                            occupancy_date: date, remark: str = None) -> CreditOccupancy:
    occupancy = CreditOccupancy(
        contract_id=contract_id,
        collateral_id=collateral_id,
        collateral_version_id=collateral_version_id,
        occupancy_amount=occupancy_amount,
        occupancy_date=occupancy_date,
        remark=remark,
        is_active=True
    )
    db.add(occupancy)
    db.flush()
    return occupancy


def calculate_collateral_balance(db: Session, collateral_id: int, as_of_date: date = None) -> float:
    if as_of_date is None:
        as_of_date = date.today()

    occupancies = db.query(CreditOccupancy).filter(
        and_(
            CreditOccupancy.collateral_id == collateral_id,
            CreditOccupancy.is_active == True,
            CreditOccupancy.occupancy_date <= as_of_date
        )
    ).all()

    total = 0.0
    for occ in occupancies:
        contract = occ.contract
        if contract and contract.start_date <= as_of_date <= contract.end_date:
            total += occ.occupancy_amount
    return total


def get_latest_active_version(db: Session, collateral_id: int) -> Optional[CollateralVersion]:
    return db.query(CollateralVersion).filter(
        and_(
            CollateralVersion.collateral_id == collateral_id,
            CollateralVersion.is_active == True
        )
    ).first()


def check_appraisal_expiry(db: Session, version: CollateralVersion,
                           check_date: date = None) -> Optional[Dict[str, Any]]:
    if check_date is None:
        check_date = date.today()

    if check_date > version.appraisal_expiry_date:
        days_expired = (check_date - version.appraisal_expiry_date).days
        return {
            "expired": True,
            "days_expired": days_expired,
            "expiry_date": version.appraisal_expiry_date,
            "check_date": check_date
        }
    return None


def check_mortgage_rate_exceed(db: Session, collateral_id: int, version: CollateralVersion,
                               max_rate: float = 0.7, check_date: date = None) -> Optional[Dict[str, Any]]:
    if check_date is None:
        check_date = date.today()

    balance = calculate_collateral_balance(db, collateral_id, check_date)
    allowed_amount = version.appraised_value * max_rate

    if balance > allowed_amount:
        current_rate = balance / version.appraised_value if version.appraised_value > 0 else float('inf')
        return {
            "exceeded": True,
            "current_balance": balance,
            "allowed_amount": allowed_amount,
            "appraised_value": version.appraised_value,
            "current_rate": current_rate,
            "max_allowed_rate": max_rate,
            "excess_amount": balance - allowed_amount
        }
    return None


def check_duplicate_guarantee(db: Session, collateral_id: int,
                              check_date: date = None) -> List[Dict[str, Any]]:
    if check_date is None:
        check_date = date.today()

    occupancies = db.query(CreditOccupancy).filter(
        and_(
            CreditOccupancy.collateral_id == collateral_id,
            CreditOccupancy.is_active == True,
            CreditOccupancy.occupancy_date <= check_date
        )
    ).all()

    active_contracts = []
    for occ in occupancies:
        contract = occ.contract
        if contract and contract.start_date <= check_date <= contract.end_date:
            active_contracts.append({
                "contract_id": contract.id,
                "contract_no": contract.contract_no,
                "borrower": contract.borrower,
                "occupancy_amount": occ.occupancy_amount,
                "occupancy_date": occ.occupancy_date,
                "material_id": contract.material_id
            })

    if len(active_contracts) > 1:
        return active_contracts
    return []


def detect_warnings_for_collateral(db: Session, collateral_id: int, task_id: int = None,
                                   max_rate: float = 0.7, check_date: date = None) -> List[Warning]:
    if check_date is None:
        check_date = date.today()

    warnings = []
    version = get_latest_active_version(db, collateral_id)

    if not version:
        warning = Warning(
            warning_type="missing_version",
            severity="error",
            task_id=task_id,
            collateral_id=collateral_id,
            message="抵押物没有有效的评估版本",
            blocked_at="获取最新评估版本时失败",
            next_action="请先导入该抵押物的评估报告并创建评估版本"
        )
        warnings.append(warning)
        db.add(warning)
        return warnings

    expiry_check = check_appraisal_expiry(db, version, check_date)
    if expiry_check:
        warning = Warning(
            warning_type="appraisal_expired",
            severity="error",
            task_id=task_id,
            material_id=version.material_id,
            collateral_id=collateral_id,
            collateral_version_id=version.id,
            message=f"评估报告已过期 {expiry_check['days_expired']} 天，到期日 {expiry_check['expiry_date']}",
            blocked_at=f"评估有效期检查：评估报告于 {expiry_check['expiry_date']} 到期，当前日期 {check_date}",
            next_action=f"需要重新委托评估机构出具新的评估报告，原报告编号：{version.appraisal_report_no or '未记录'}"
        )
        warnings.append(warning)
        db.add(warning)

    rate_check = check_mortgage_rate_exceed(db, collateral_id, version, max_rate, check_date)
    if rate_check:
        warning = Warning(
            warning_type="mortgage_rate_exceed",
            severity="error",
            task_id=task_id,
            material_id=version.material_id,
            collateral_id=collateral_id,
            collateral_version_id=version.id,
            message=f"抵押率超限：当前 {rate_check['current_rate']:.2%}，最高允许 {max_rate:.2%}，超额度 {rate_check['excess_amount']:.2f} 元",
            blocked_at=f"抵押率计算：授信余额 {rate_check['current_balance']:.2f} / 评估价 {rate_check['appraised_value']:.2f} = {rate_check['current_rate']:.2%}",
            next_action=f"需要补充抵押物或归还部分授信，超额度为 {rate_check['excess_amount']:.2f} 元"
        )
        warnings.append(warning)
        db.add(warning)

    dup_check = check_duplicate_guarantee(db, collateral_id, check_date)
    if dup_check:
        contracts_str = "、".join([f"{c['contract_no']}({c['borrower']}:{c['occupancy_amount']:.2f})" for c in dup_check])
        warning = Warning(
            warning_type="duplicate_guarantee",
            severity="warning",
            task_id=task_id,
            collateral_id=collateral_id,
            contract_id=dup_check[0]["contract_id"],
            material_id=dup_check[0].get("material_id"),
            message=f"同一抵押物为多笔授信提供担保：{contracts_str}",
            blocked_at=f"重复担保检查：发现 {len(dup_check)} 个有效授信合同同时占用该抵押物",
            next_action="请核实各授信合同的担保顺序，确认是否存在超额担保风险，必要时要求补充其他抵押物"
        )
        warnings.append(warning)
        db.add(warning)

    return warnings


def create_reassessment(db: Session, name: str, collateral_ids: List[int],
                        triggered_by: str = None, max_rate: float = 0.7) -> Reassessment:
    count = db.query(Reassessment).count() + 1
    reassessment_no = f"FG{date.today().strftime('%Y%m%d')}{count:04d}"

    reassessment = Reassessment(
        reassessment_no=reassessment_no,
        name=name,
        status="pending",
        triggered_by=triggered_by
    )
    db.add(reassessment)
    db.flush()

    for coll_id in collateral_ids:
        task = ReassessmentTask(
            reassessment_id=reassessment.id,
            collateral_id=coll_id,
            status="pending",
            max_allowed_rate=max_rate
        )
        db.add(task)

    db.flush()
    return reassessment


def process_reassessment_task(db: Session, task_id: int, handler: str = None) -> ReassessmentTask:
    task = db.query(ReassessmentTask).filter(ReassessmentTask.id == task_id).first()
    if not task:
        raise ValueError(f"Task {task_id} not found")

    collateral_id = task.collateral_id
    version = get_latest_active_version(db, collateral_id)

    if version:
        task.latest_appraised_value = version.appraised_value
        task.calculated_balance = calculate_collateral_balance(db, collateral_id)
        if version.appraised_value > 0:
            task.current_mortgage_rate = task.calculated_balance / version.appraised_value

    warnings = detect_warnings_for_collateral(
        db, collateral_id, task_id=task_id,
        max_rate=task.max_allowed_rate
    )

    has_error = any(w.severity == "error" for w in warnings)
    task.status = "warning" if has_error else "normal"
    task.processed_at = datetime.now()
    task.remark = f"自动检测到 {len(warnings)} 条预警"

    reassessment = task.reassessment
    reassessment.handler = handler
    reassessment.processed_at = datetime.now()
    reassessment.status = "processed"

    db.flush()
    return task


def process_reassessment(db: Session, reassessment_id: int, handler: str = None) -> Reassessment:
    reassessment = db.query(Reassessment).filter(Reassessment.id == reassessment_id).first()
    if not reassessment:
        raise ValueError(f"Reassessment {reassessment_id} not found")

    for task in reassessment.tasks:
        process_reassessment_task(db, task.id, handler)

    all_normal = all(t.status == "normal" for t in reassessment.tasks)
    reassessment.status = "processed" if all_normal else "processed_with_warning"

    db.flush()
    return reassessment


def review_reassessment(db: Session, reassessment_id: int, reviewer: str,
                        review_opinion: str = None, approve: bool = True) -> Reassessment:
    reassessment = db.query(Reassessment).filter(Reassessment.id == reassessment_id).first()
    if not reassessment:
        raise ValueError(f"Reassessment {reassessment_id} not found")

    reassessment.reviewer = reviewer
    reassessment.review_opinion = review_opinion
    reassessment.review_at = datetime.now()
    reassessment.status = "reviewed" if approve else "rejected"

    db.flush()
    return reassessment


def export_reassessment_data(db: Session, reassessment_id: int) -> Dict[str, Any]:
    reassessment = db.query(Reassessment).filter(Reassessment.id == reassessment_id).first()
    if not reassessment:
        raise ValueError(f"Reassessment {reassessment_id} not found")

    tasks_data = []
    for task in reassessment.tasks:
        collateral = task.collateral
        version = get_latest_active_version(db, collateral.id)

        version_history = []
        for v in collateral.versions:
            version_history.append({
                "version_no": v.version_no,
                "appraised_value": v.appraised_value,
                "appraisal_date": v.appraisal_date.isoformat(),
                "appraisal_expiry_date": v.appraisal_expiry_date.isoformat(),
                "mortgage_rate": v.mortgage_rate,
                "source_material": v.source_material.file_name if v.source_material else None,
                "source_material_id": v.material_id,
                "is_active": v.is_active
            })

        occupancies = db.query(CreditOccupancy).filter(
            CreditOccupancy.collateral_id == collateral.id,
            CreditOccupancy.is_active == True
        ).all()

        occupancy_data = []
        for occ in occupancies:
            contract = occ.contract
            occupancy_data.append({
                "contract_no": contract.contract_no,
                "borrower": contract.borrower,
                "credit_amount": contract.credit_amount,
                "occupancy_amount": occ.occupancy_amount,
                "occupancy_date": occ.occupancy_date.isoformat(),
                "contract_start": contract.start_date.isoformat(),
                "contract_end": contract.end_date.isoformat(),
                "source_material": contract.source_material.file_name if contract.source_material else None
            })

        warnings_data = []
        for w in task.warnings:
            warnings_data.append({
                "id": w.id,
                "warning_type": w.warning_type,
                "severity": w.severity,
                "message": w.message,
                "blocked_at": w.blocked_at,
                "next_action": w.next_action,
                "trigger_material": w.trigger_material.file_name if w.trigger_material else None,
                "is_resolved": w.is_resolved
            })

        tasks_data.append({
            "task_id": task.id,
            "status": task.status,
            "collateral": {
                "collateral_no": collateral.collateral_no,
                "name": collateral.name,
                "type": collateral.collateral_type,
                "address": collateral.address,
                "owner": collateral.owner
            },
            "current_version": {
                "version_no": version.version_no,
                "appraised_value": version.appraised_value,
                "appraisal_date": version.appraisal_date.isoformat(),
                "appraisal_expiry_date": version.appraisal_expiry_date.isoformat(),
                "mortgage_rate": version.mortgage_rate,
                "appraiser": version.appraiser,
                "appraisal_report_no": version.appraisal_report_no
            } if version else None,
            "version_history": version_history,
            "credit_occupancies": occupancy_data,
            "calculation": {
                "calculated_balance": task.calculated_balance,
                "latest_appraised_value": task.latest_appraised_value,
                "current_mortgage_rate": task.current_mortgage_rate,
                "max_allowed_rate": task.max_allowed_rate
            },
            "warnings": warnings_data
        })

    return {
        "reassessment_no": reassessment.reassessment_no,
        "name": reassessment.name,
        "status": reassessment.status,
        "triggered_by": reassessment.triggered_by,
        "handler": reassessment.handler,
        "reviewer": reassessment.reviewer,
        "review_opinion": reassessment.review_opinion,
        "created_at": reassessment.created_at.isoformat(),
        "processed_at": reassessment.processed_at.isoformat() if reassessment.processed_at else None,
        "review_at": reassessment.review_at.isoformat() if reassessment.review_at else None,
        "tasks": tasks_data
    }


def get_collateral_full_history(db: Session, collateral_id: int) -> Dict[str, Any]:
    collateral = db.query(Collateral).filter(Collateral.id == collateral_id).first()
    if not collateral:
        raise ValueError(f"Collateral {collateral_id} not found")

    versions_data = []
    for v in collateral.versions:
        versions_data.append({
            "version_no": v.version_no,
            "appraised_value": v.appraised_value,
            "appraisal_date": v.appraisal_date.isoformat(),
            "appraisal_expiry_date": v.appraisal_expiry_date.isoformat(),
            "mortgage_rate": v.mortgage_rate,
            "source_material": v.source_material.file_name if v.source_material else None,
            "source_material_id": v.material_id,
            "uploaded_by": v.source_material.uploaded_by if v.source_material else None,
            "uploaded_at": v.source_material.uploaded_at.isoformat() if v.source_material else None,
            "is_active": v.is_active
        })

    occupancies_data = []
    for occ in collateral.occupancies:
        contract = occ.contract
        occupancies_data.append({
            "contract_no": contract.contract_no,
            "borrower": contract.borrower,
            "occupancy_amount": occ.occupancy_amount,
            "occupancy_date": occ.occupancy_date.isoformat(),
            "contract_end": contract.end_date.isoformat(),
            "is_active": occ.is_active
        })

    warnings_data = []
    warnings = db.query(Warning).filter(Warning.collateral_id == collateral_id).all()
    for w in warnings:
        warnings_data.append({
            "id": w.id,
            "warning_type": w.warning_type,
            "severity": w.severity,
            "message": w.message,
            "blocked_at": w.blocked_at,
            "next_action": w.next_action,
            "trigger_material": w.trigger_material.file_name if w.trigger_material else None,
            "is_resolved": w.is_resolved,
            "created_at": w.created_at.isoformat()
        })

    return {
        "collateral": {
            "collateral_no": collateral.collateral_no,
            "name": collateral.name,
            "type": collateral.collateral_type,
            "address": collateral.address,
            "owner": collateral.owner
        },
        "version_history": versions_data,
        "occupancy_history": occupancies_data,
        "warnings": warnings_data
    }
