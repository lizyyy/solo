with open("app/api/endpoints.py", "r") as f:
    content = f.read()

history_route = '''

@router.get("/grievances/{grievance_no}/history", response_model=List[ProcessingHistorySchema])
def get_grievance_history(grievance_no: str, db: Session = Depends(get_db)):
    grievance = db.query(Grievance).filter(Grievance.grievance_no == grievance_no).first()
    if not grievance:
        raise HTTPException(status_code=404, detail="Not found")
    return db.query(ProcessingHistory).filter(ProcessingHistory.grievance_id == grievance.id).order_by(ProcessingHistory.created_at.asc()).all()
'''

content = content + history_route
print("修改4完成")

with open("app/api/endpoints.py", "w") as f:
    f.write(content)
print("文件已保存")
