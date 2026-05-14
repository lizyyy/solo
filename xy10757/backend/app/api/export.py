from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
import pandas as pd
from datetime import datetime
from app.core.database import get_db
from app.models import PointBatch, PointTransaction, BalanceSnapshot

router = APIRouter(prefix="/export", tags=["导出"])

@router.get("/transactions/{member_id}")
def export_transactions(member_id: str, db: Session = Depends(get_db)):
    transactions = db.query(PointTransaction).filter(
        PointTransaction.member_id == member_id
    ).order_by(PointTransaction.created_at).all()
    
    data = []
    for tx in transactions:
        data.append({
            "交易编号": tx.tx_no,
            "交易类型": tx.tx_type,
            "批次ID": tx.batch_id,
            "积分数": tx.points,
            "操作前余额": tx.before_balance,
            "操作后余额": tx.after_balance,
            "状态": tx.status,
            "是否复核": "是" if tx.is_reviewed else "否",
            "复核人": tx.reviewed_by,
            "是否人工修正": "是" if tx.is_manual else "否",
            "操作人": tx.operator,
            "创建时间": tx.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            "备注": tx.remark
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="交易记录")
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=transactions_{member_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        }
    )

@router.get("/snapshots/{member_id}")
def export_snapshots(member_id: str, db: Session = Depends(get_db)):
    snapshots = db.query(BalanceSnapshot).filter(
        BalanceSnapshot.member_id == member_id
    ).order_by(BalanceSnapshot.snapshot_date).all()
    
    data = []
    for s in snapshots:
        data.append({
            "快照日期": s.snapshot_date.strftime("%Y-%m-%d %H:%M:%S"),
            "总积分": s.total_points,
            "可用积分": s.available_points,
            "冻结积分": s.frozen_points,
            "过期积分": s.expired_points,
            "消费积分": s.consumed_points,
            "返还积分": s.refunded_points,
            "是否一致": "是" if s.is_consistent else "否",
            "不一致原因": s.inconsistency_reason,
            "创建时间": s.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="余额快照")
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=snapshots_{member_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        }
    )

@router.get("/full/{member_id}")
def export_full_ledger(member_id: str, db: Session = Depends(get_db)):
    batches = db.query(PointBatch).filter(PointBatch.member_id == member_id).all()
    transactions = db.query(PointTransaction).filter(PointTransaction.member_id == member_id).all()
    snapshots = db.query(BalanceSnapshot).filter(BalanceSnapshot.member_id == member_id).all()
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        batch_data = [{
            "批次号": b.batch_no,
            "积分数": b.points,
            "来源": b.source,
            "状态": b.status,
            "创建时间": b.created_at.strftime("%Y-%m-%d %H:%M:%S") if b.created_at else ""
        } for b in batches]
        pd.DataFrame(batch_data).to_excel(writer, index=False, sheet_name="积分批次")
        
        tx_data = [{
            "交易编号": t.tx_no,
            "交易类型": t.tx_type,
            "批次ID": t.batch_id,
            "积分数": t.points,
            "操作前余额": t.before_balance,
            "操作后余额": t.after_balance,
            "状态": t.status,
            "是否复核": "是" if t.is_reviewed else "否",
            "操作人": t.operator,
            "创建时间": t.created_at.strftime("%Y-%m-%d %H:%M:%S") if t.created_at else ""
        } for t in transactions]
        pd.DataFrame(tx_data).to_excel(writer, index=False, sheet_name="交易记录")
        
        snapshot_data = [{
            "快照日期": s.snapshot_date.strftime("%Y-%m-%d %H:%M:%S"),
            "总积分": s.total_points,
            "可用积分": s.available_points,
            "冻结积分": s.frozen_points,
            "过期积分": s.expired_points,
            "消费积分": s.consumed_points,
            "返还积分": s.refunded_points,
            "是否一致": "是" if s.is_consistent else "否"
        } for s in snapshots]
        pd.DataFrame(snapshot_data).to_excel(writer, index=False, sheet_name="余额快照")
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=full_ledger_{member_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}.xlsx"
        }
    )
