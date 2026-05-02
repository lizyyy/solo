from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas import (
    BudgetLedgerResponse, BudgetTransactionResponse, MessageResponse
)
from app.services.budget_manager import budget_manager

router = APIRouter(prefix="/datasets/{dataset_id}/budget", tags=["预算管理"])


@router.get("/", response_model=BudgetLedgerResponse)
def get_budget_ledger(dataset_id: int, db: Session = Depends(get_db)):
    """获取数据集的预算账本"""
    ledger = budget_manager.get_ledger(db=db, dataset_id=dataset_id)
    
    if not ledger:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 的预算账本不存在")
    
    return ledger


@router.get("/summary")
def get_budget_summary(dataset_id: int, db: Session = Depends(get_db)):
    """获取预算摘要信息"""
    summary = budget_manager.get_budget_summary(db=db, dataset_id=dataset_id)
    return summary


@router.get("/transactions", response_model=List[BudgetTransactionResponse])
def get_budget_transactions(
    dataset_id: int,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """获取预算交易记录"""
    transactions = budget_manager.get_transactions(
        db=db,
        dataset_id=dataset_id,
        limit=limit,
        offset=offset
    )
    return transactions


@router.post("/reset", response_model=BudgetLedgerResponse)
def reset_budget(
    dataset_id: int,
    new_total_epsilon: float = None,
    db: Session = Depends(get_db)
):
    """
    重置预算（管理员功能）
    
    此操作会将剩余预算重置为总预算。
    如果提供了 new_total_epsilon，还会更新总预算。
    """
    try:
        ledger = budget_manager.reset_budget(
            db=db,
            dataset_id=dataset_id,
            new_total_epsilon=new_total_epsilon
        )
        return ledger
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{transaction_id}/refund", response_model=MessageResponse)
def refund_transaction(
    dataset_id: int,
    transaction_id: int,
    reason: str = "手动退回",
    db: Session = Depends(get_db)
):
    """
    退回指定交易的预算（管理员功能）
    
    用于在查询失败或需要撤销的情况下退回预算。
    """
    try:
        refund_tx = budget_manager.refund_budget(
            db=db,
            transaction_id=transaction_id,
            reason=reason
        )
        
        if refund_tx:
            return MessageResponse(
                message=f"已成功退回预算 {abs(refund_tx.epsilon_used):.4f} ε",
                success=True
            )
        else:
            return MessageResponse(
                message="没有可退回的预算",
                success=True
            )
            
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
