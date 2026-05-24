#!/usr/bin/env python3
import sys

def main():
    with open('main.py', 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. 添加状态机校验和关闭校验函数
    old_log = '''def log_operation(db: Session, hazard_id: int, op_type: OperationType, operator: str = None, remark: str = None, old_status: str = None, new_status: str = None, old_level: str = None, new_level: str = None):
    log = OperationLogDB(
        hazard_id=hazard_id,
        operation_type=op_type.value,
        operator=operator,
        remark=remark,
        old_status=old_status,
        new_status=new_status,
        old_level=old_level,
        new_level=new_level,
    )
    db.add(log)
    db.commit()'''

    new_log = '''def log_operation(db: Session, hazard_id: int, op_type: OperationType, operator: str = None, remark: str = None, old_status: str = None, new_status: str = None, old_level: str = None, new_level: str = None):
    log = OperationLogDB(
        hazard_id=hazard_id,
        operation_type=op_type.value,
        operator=operator,
        remark=remark,
        old_status=old_status,
        new_status=new_status,
        old_level=old_level,
        new_level=new_level,
    )
    db.add(log)
    db.commit()

STATUS_TRANSITIONS = {
    HazardStatus.PENDING_REVIEW: [HazardStatus.BLOCKED, HazardStatus.APPROVED, HazardStatus.CLOSED],
    HazardStatus.BLOCKED: [HazardStatus.PENDING_REVIEW, HazardStatus.CLOSED],
    HazardStatus.APPROVED: [HazardStatus.IN_PROGRESS, HazardStatus.PENDING_REVIEW, HazardStatus.CLOSED],
    HazardStatus.IN_PROGRESS: [HazardStatus.PENDING_RECHECK, HazardStatus.PENDING_REVIEW, HazardStatus.COMPLETED, HazardStatus.CLOSED],
    HazardStatus.PENDING_RECHECK: [HazardStatus.COMPLETED, HazardStatus.IN_PROGRESS, HazardStatus.CLOSED],
    HazardStatus.COMPLETED: [HazardStatus.PENDING_REVIEW, HazardStatus.CLOSED],
    HazardStatus.CLOSED: [HazardStatus.PENDING_REVIEW],
}

def validate_status_transition(old_status: str, new_status: str) -> bool:
    try:
        old = HazardStatus(old_status)
        new = HazardStatus(new_status)
        if old == new:
            return True
        return new in STATUS_TRANSITIONS.get(old, [])
    except:
        return False

def can_close(hazard) -> tuple:
    if hazard.hazard_level == HazardLevel.EMERGENCY.value:
        if not hazard.recheck_conclusion:
            return False, "封路等级隐患必须有复查结论才能关闭"
    if hazard.status in [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_RECHECK.value]:
        if not hazard.recheck_conclusion:
            return False, "处置中或待复查的隐患必须先提交复查结论"
    return True, ""'''

    if old_log in content:
        content = content.replace(old_log, new_log)
        print("Added status machine and can_close")
    else:
        print("Already has status machine")

    # 2. 修改close接口
    old_close = '''@app.post("/api/hazards/{hazard_id}/close", response_model=HazardResponse)
def close_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h: raise HTTPException(404, "Not found")
    old_status = h.status
    h.status = HazardStatus.CLOSED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.CLOSE, operator=req.operator, remark=req.remark, old_status=old_status, new_status=h.status)
    return h'''

    new_close = '''@app.post("/api/hazards/{hazard_id}/close", response_model=HazardResponse)
def close_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    can_close_flag, msg = can_close(h)
    if not can_close_flag:
        raise HTTPException(400, msg)
    if not validate_status_transition(h.status, HazardStatus.CLOSED.value):
        raise HTTPException(400, f"状态不允许关闭: {h.status}")
    old_status = h.status
    h.status = HazardStatus.CLOSED.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.CLOSE, operator=req.operator, remark=req.remark, old_status=old_status, new_status=h.status)
    return h'''

    if old_close in content:
        content = content.replace(old_close, new_close)
        print("Fixed close interface")
    else:
        print("Close interface already fixed")

    # 3. 在 if __name__ 前添加新接口
    marker = 'if __name__ == "__main__":'
    if 'def withdraw_hazard' not in content:
        pos = content.find(marker)
        new_interfaces = '''

@app.post("/api/hazards/{hazard_id}/withdraw", response_model=HazardResponse)
def withdraw_hazard(hazard_id: int, req: StatusChangeRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status == HazardStatus.CLOSED.value:
        raise HTTPException(400, "已关闭的隐患不能撤回")
    old_status = h.status
    h.status = HazardStatus.PENDING_REVIEW.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.WITHDRAW, operator=req.operator, remark=req.remark or "撤回申请", old_status=old_status, new_status=h.status)
    return h

@app.post("/api/hazards/{hazard_id}/resubmit", response_model=HazardResponse)
def resubmit_hazard(hazard_id: int, update: Optional[HazardUpdate] = None, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if h.status != HazardStatus.PENDING_REVIEW.value:
        raise HTTPException(400, "只有待审核状态的隐患才能重提")
    old_level = h.hazard_level
    level_changed = False
    if update:
        if update.hazard_level and update.hazard_level.value != h.hazard_level:
            h.hazard_level = update.hazard_level.value
            h.level_modified_count += 1
            level_changed = True
        if update.disposal_team is not None:
            h.disposal_team = update.disposal_team
        if update.description is not None:
            h.description = update.description
    old_status = h.status
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.RESUBMIT, operator=operator, remark="重新提交" if not level_changed else "重新提交并修改等级", old_status=old_status, new_status=h.status, old_level=old_level if level_changed else None, new_level=h.hazard_level if level_changed else None)
    return h

@app.post("/api/hazards/{hazard_id}/recheck_supplement", response_model=HazardResponse)
def supplement_recheck(hazard_id: int, conclusion: str, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    if not h.recheck_conclusion:
        h.recheck_conclusion = conclusion
        remark = "补录复查结论"
    else:
        h.recheck_conclusion = h.recheck_conclusion + "\\n【补录】" + conclusion
        remark = "追加补录复查结论"
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.RECHECK_SUBMIT, operator=operator, remark=remark, old_level=h.hazard_level, new_level=h.hazard_level)
    return h

'''
        content = content[:pos] + new_interfaces + content[pos:]
        print("Added new interfaces")
    else:
        print("Interfaces already exist")

    with open('main.py', 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("All done!")

if __name__ == "__main__":
    main()
