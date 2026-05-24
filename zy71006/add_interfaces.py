#!/usr/bin/env python3
import sys

def add_interfaces():
    with open('main.py', 'a') as f:
        f.write('''

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

@app.post("/api/hazards/{hazard_id}/close", response_model=HazardResponse)
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
    return h

@app.post("/api/hazards/{hazard_id}/assign", response_model=HazardResponse)
def assign_hazard(hazard_id: int, team: str, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    old_team = h.disposal_team
    h.disposal_team = team
    h.status = HazardStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.ASSIGN, operator=operator, remark=f"派单给: {team}", old_status=old_team, new_status=team)
    return h

@app.post("/api/hazards/{hazard_id}/recheck", response_model=HazardResponse)
def submit_recheck(hazard_id: int, req: RecheckRequest, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    h.recheck_conclusion = req.conclusion
    old_status = h.status
    if req.passed:
        h.status = HazardStatus.COMPLETED.value
    else:
        h.status = HazardStatus.IN_PROGRESS.value
    db.commit()
    db.refresh(h)
    log_operation(db, h.id, OperationType.RECHECK_SUBMIT, operator=req.operator, remark=req.conclusion, old_status=old_status, new_status=h.status)
    return h

@app.get("/api/hazards/{hazard_id}/logs", response_model=list[OperationLogResponse])
def get_hazard_logs(hazard_id: int, db: Session = Depends(get_db)):
    logs = db.query(OperationLogDB).filter(OperationLogDB.hazard_id == hazard_id).order_by(OperationLogDB.created_at.desc()).all()
    return logs

@app.put("/api/hazards/{hazard_id}", response_model=HazardResponse)
def update_hazard(hazard_id: int, update: HazardUpdate, operator: Optional[str] = None, db: Session = Depends(get_db)):
    h = db.query(HazardDB).filter(HazardDB.id == hazard_id).first()
    if not h:
        raise HTTPException(404, "Not found")
    old_level = h.hazard_level
    level_changed = False
    if update.hazard_level and update.hazard_level.value != h.hazard_level:
        h.hazard_level = update.hazard_level.value
        h.level_modified_count += 1
        level_changed = True
    if update.disposal_team is not None:
        h.disposal_team = update.disposal_team
    if update.description is not None:
        h.description = update.description
    if update.recheck_conclusion is not None:
        h.recheck_conclusion = update.recheck_conclusion
    db.commit()
    db.refresh(h)
    if level_changed:
        log_operation(db, h.id, OperationType.MODIFY, operator=operator, remark="等级变更", old_level=old_level, new_level=h.hazard_level)
    return h

@app.get("/api/statistics")
def get_statistics(db: Session = Depends(get_db)):
    total = db.query(HazardDB).filter(HazardDB.is_duplicate == 0).count()
    by_level = {l.value: db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.hazard_level == l.value).count() for l in HazardLevel}
    by_status = {s.value: db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.status == s.value).count() for s in HazardStatus}
    teams = db.query(HazardDB.disposal_team).filter(HazardDB.disposal_team != None).distinct().all()
    by_team = {t[0]: db.query(HazardDB).filter(HazardDB.disposal_team == t[0]).count() for t in teams if t[0]}
    pending_recheck = db.query(HazardDB).filter(HazardDB.is_duplicate == 0, HazardDB.status == HazardStatus.PENDING_RECHECK.value).count()
    return {"total": total, "by_level": by_level, "by_status": by_status, "by_team": by_team, "pending_recheck": pending_recheck}

@app.get("/api/exports/excel")
def export_excel(
    status: Optional[HazardStatus] = None,
    level: Optional[HazardLevel] = None,
    team: Optional[str] = None,
    include_duplicates: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(HazardDB)
    if not include_duplicates:
        query = query.filter(HazardDB.is_duplicate == 0)
    if status:
        query = query.filter(HazardDB.status == status.value)
    if level:
        query = query.filter(HazardDB.hazard_level == level.value)
    if team:
        query = query.filter(HazardDB.disposal_team.contains(team))
    items = query.order_by(HazardDB.created_at.desc()).all()
    data = []
    for h in items:
        data.append({
            "ID": h.id,
            "树木编号": h.tree_number,
            "道路位置": h.road_location,
            "隐患等级": h.hazard_level,
            "状态": h.status,
            "处置队伍": h.disposal_team,
            "复查结论": h.recheck_conclusion,
            "批次ID": h.batch_id,
            "创建时间": h.created_at,
            "是否重复": "是" if h.is_duplicate else "否",
        })
    df = pd.DataFrame(data)
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="隐患列表")
    output.seek(0)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"tree_hazards_{ts}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
''')
    print("Interfaces added")

if __name__ == "__main__":
    add_interfaces()
