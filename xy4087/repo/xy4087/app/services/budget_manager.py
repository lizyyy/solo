from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import Optional, List
from datetime import datetime
from app.models import BudgetLedger, BudgetTransaction, Dataset
from app.config import settings


class BudgetManager:
    """预算账本管理系统"""
    
    def __init__(self):
        self.default_epsilon = settings.DEFAULT_EPSILON
        self.min_epsilon = settings.MIN_EPSILON
        self.max_epsilon = settings.MAX_EPSILON
        self.default_delta = settings.DEFAULT_DELTA
        self.default_suppression_threshold = settings.SUPPRESSION_THRESHOLD
    
    def create_ledger(self,
                       db: Session,
                       dataset_id: int,
                       total_epsilon: float = None,
                       delta: float = None,
                       suppression_threshold: int = None) -> BudgetLedger:
        """
        为数据集创建预算账本
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            total_epsilon: 总隐私预算
            delta: delta值
            suppression_threshold: 样本抑制阈值
            
        Returns:
            创建的预算账本
        """
        # 使用默认值
        if total_epsilon is None:
            total_epsilon = self.default_epsilon
        if delta is None:
            delta = self.default_delta
        if suppression_threshold is None:
            suppression_threshold = self.default_suppression_threshold
        
        # 验证参数
        if total_epsilon <= 0:
            raise ValueError("Total epsilon must be positive")
        if total_epsilon < self.min_epsilon or total_epsilon > self.max_epsilon:
            raise ValueError(
                f"Total epsilon must be between {self.min_epsilon} and {self.max_epsilon}"
            )
        
        # 检查是否已存在账本
        existing = db.query(BudgetLedger).filter(
            BudgetLedger.dataset_id == dataset_id
        ).first()
        
        if existing:
            raise ValueError(f"Budget ledger already exists for dataset {dataset_id}")
        
        # 创建账本
        ledger = BudgetLedger(
            dataset_id=dataset_id,
            total_epsilon=total_epsilon,
            remaining_epsilon=total_epsilon,
            delta=delta,
            suppression_threshold=suppression_threshold
        )
        
        db.add(ledger)
        db.commit()
        db.refresh(ledger)
        
        return ledger
    
    def get_ledger(self,
                   db: Session,
                   dataset_id: int) -> Optional[BudgetLedger]:
        """
        获取数据集的预算账本
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            
        Returns:
            预算账本或None
        """
        return db.query(BudgetLedger).filter(
            BudgetLedger.dataset_id == dataset_id
        ).first()
    
    def check_budget(self,
                     db: Session,
                     dataset_id: int,
                     epsilon_requested: float) -> tuple:
        """
        检查是否有足够的预算
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            epsilon_requested: 请求的epsilon
            
        Returns:
            (是否有足够预算, 剩余预算, 错误消息)
        """
        if epsilon_requested <= 0:
            return False, 0, "Requested epsilon must be positive"
        
        ledger = self.get_ledger(db, dataset_id)
        
        if not ledger:
            return False, 0, f"No budget ledger found for dataset {dataset_id}"
        
        if ledger.remaining_epsilon < epsilon_requested:
            return (
                False,
                ledger.remaining_epsilon,
                f"Insufficient budget. Remaining: {ledger.remaining_epsilon}, "
                f"Requested: {epsilon_requested}"
            )
        
        return True, ledger.remaining_epsilon, None
    
    def consume_budget(self,
                   db: Session,
                   dataset_id: int,
                   epsilon_used: float,
                   reason: str,
                   query_id: int = None) -> Optional[BudgetTransaction]:
        """
        消费隐私预算
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            epsilon_used: 消费的epsilon
            reason: 消费原因
            query_id: 关联的查询ID（审计日志ID）
            
        Returns:
            创建的预算交易记录，或None如果失败
        """
        try:
            # 检查预算
            has_budget, remaining_before, error = self.check_budget(
                db, dataset_id, epsilon_used
            )
            
            if not has_budget:
                raise ValueError(error or "Insufficient budget")
            
            # 获取账本
            ledger = self.get_ledger(db, dataset_id)
            if not ledger:
                raise ValueError(f"No budget ledger found for dataset {dataset_id}")
            
            # 计算新的剩余预算
            remaining_after = remaining_before - epsilon_used
            
            # 创建交易记录
            transaction = BudgetTransaction(
                ledger_id=ledger.id,
                epsilon_used=epsilon_used,
                epsilon_before=remaining_before,
                epsilon_after=remaining_after,
                reason=reason,
                query_id=query_id
            )
            
            # 更新账本
            ledger.remaining_epsilon = remaining_after
            ledger.updated_at = datetime.utcnow()
            
            # 保存
            db.add(transaction)
            db.commit()
            db.refresh(transaction)
            
            return transaction
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    def get_transactions(self,
                          db: Session,
                          dataset_id: int,
                          limit: int = 100,
                          offset: int = 0) -> List[BudgetTransaction]:
        """
        获取数据集的预算交易记录
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            交易记录列表
        """
        ledger = self.get_ledger(db, dataset_id)
        
        if not ledger:
            return []
        
        return db.query(BudgetTransaction).filter(
            BudgetTransaction.ledger_id == ledger.id
        ).order_by(
            BudgetTransaction.created_at.desc()
        ).offset(offset).limit(limit).all()
    
    def refund_budget(self,
                       db: Session,
                       transaction_id: int,
                       reason: str = "Refund") -> Optional[BudgetTransaction]:
        """
        退回预算（用于失败的查询）
        
        Args:
            db: 数据库会话
            transaction_id: 交易ID
            reason: 退回原因
            
        Returns:
            新的交易记录（退回记录），或None如果失败
        """
        try:
            # 获取原始交易
            original_tx = db.query(BudgetTransaction).filter(
                BudgetTransaction.id == transaction_id
            ).first()
            
            if not original_tx:
                raise ValueError(f"Transaction {transaction_id} not found")
            
            # 获取账本
            ledger = db.query(BudgetLedger).filter(
                BudgetLedger.id == original_tx.ledger_id
            ).first()
            
            if not ledger:
                raise ValueError("Ledger not found")
            
            # 计算退回后的预算
            epsilon_to_refund = original_tx.epsilon_used
            remaining_before = ledger.remaining_epsilon
            remaining_after = remaining_before + epsilon_to_refund
            
            # 不能超过总预算
            if remaining_after > ledger.total_epsilon:
                remaining_after = ledger.total_epsilon
                epsilon_to_refund = remaining_after - remaining_before
            
            if epsilon_to_refund <= 0:
                return None  # 没有可退回的预算
            
            # 创建退回交易记录
            refund_tx = BudgetTransaction(
                ledger_id=ledger.id,
                epsilon_used=-epsilon_to_refund,  # 负数表示退回
                epsilon_before=remaining_before,
                epsilon_after=remaining_after,
                reason=reason
            )
            
            # 更新账本
            ledger.remaining_epsilon = remaining_after
            ledger.updated_at = datetime.utcnow()
            
            # 保存
            db.add(refund_tx)
            db.commit()
            db.refresh(refund_tx)
            
            return refund_tx
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    def reset_budget(self,
                     db: Session,
                     dataset_id: int,
                     new_total_epsilon: float = None) -> BudgetLedger:
        """
        重置预算（管理员功能）
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            new_total_epsilon: 新的总预算（如果不提供则使用原总预算）
            
        Returns:
            更新后的预算账本
        """
        try:
            ledger = self.get_ledger(db, dataset_id)
            
            if not ledger:
                raise ValueError(f"No budget ledger found for dataset {dataset_id}")
            
            # 记录重置前的状态
            remaining_before = ledger.remaining_epsilon
            
            # 更新总预算（如果提供）
            if new_total_epsilon is not None:
                if new_total_epsilon <= 0:
                    raise ValueError("Total epsilon must be positive")
                ledger.total_epsilon = new_total_epsilon
            
            # 重置剩余预算
            ledger.remaining_epsilon = ledger.total_epsilon
            ledger.updated_at = datetime.utcnow()
            
            # 创建重置交易记录
            reset_tx = BudgetTransaction(
                ledger_id=ledger.id,
                epsilon_used=ledger.total_epsilon - remaining_before,
                epsilon_before=remaining_before,
                epsilon_after=ledger.total_epsilon,
                reason="Budget reset"
            )
            
            db.add(reset_tx)
            db.commit()
            db.refresh(ledger)
            
            return ledger
            
        except SQLAlchemyError as e:
            db.rollback()
            raise e
    
    def get_budget_summary(self,
                           db: Session,
                           dataset_id: int) -> dict:
        """
        获取预算摘要信息
        
        Args:
            db: 数据库会话
            dataset_id: 数据集ID
            
        Returns:
            预算摘要字典
        """
        ledger = self.get_ledger(db, dataset_id)
        
        if not ledger:
            return {
                'dataset_id': dataset_id,
                'exists': False,
                'message': 'No budget ledger found'
            }
        
        # 获取交易统计
        transactions = self.get_transactions(db, dataset_id, limit=1000)
        
        total_consumed = sum(
            tx.epsilon_used for tx in transactions if tx.epsilon_used > 0
        )
        
        total_refunded = sum(
            -tx.epsilon_used for tx in transactions if tx.epsilon_used < 0
        )
        
        return {
            'dataset_id': dataset_id,
            'exists': True,
            'total_epsilon': ledger.total_epsilon,
            'remaining_epsilon': ledger.remaining_epsilon,
            'consumed_epsilon': total_consumed,
            'refunded_epsilon': total_refunded,
            'delta': ledger.delta,
            'suppression_threshold': ledger.suppression_threshold,
            'usage_percentage': (total_consumed / ledger.total_epsilon * 100) if ledger.total_epsilon > 0 else 0,
            'transaction_count': len(transactions),
            'created_at': ledger.created_at.isoformat() if ledger.created_at else None,
            'updated_at': ledger.updated_at.isoformat() if ledger.updated_at else None
        }


budget_manager = BudgetManager()
