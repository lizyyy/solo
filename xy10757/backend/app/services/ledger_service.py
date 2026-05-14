from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app.models import PointBatch, FrozenBalance, PointTransaction, BalanceSnapshot, ReviewRecord
from app.schemas.schemas import PointBatchCreate, FrozenBalanceCreate, PointTransactionCreate, BalanceSnapshotCreate

class LedgerService:
    def __init__(self, db: Session):
        self.db = db
    
    def calculate_member_balance(self, member_id: str) -> dict:
        batches = self.db.query(PointBatch).filter(
            PointBatch.member_id == member_id,
            PointBatch.status == "active"
        ).all()
        
        total_points = sum(b.points for b in batches)
        
        frozen = self.db.query(FrozenBalance).filter(
            FrozenBalance.member_id == member_id,
            FrozenBalance.status == "frozen"
        ).all()
        frozen_points = sum(f.frozen_points for f in frozen)
        
        transactions = self.db.query(PointTransaction).filter(
            PointTransaction.member_id == member_id,
            PointTransaction.status == "completed"
        ).all()
        
        consumed = sum(t.points for t in transactions if t.tx_type == "consume")
        expired = sum(t.points for t in transactions if t.tx_type == "expire")
        refunded = sum(t.points for t in transactions if t.tx_type == "refund")
        
        available = total_points - frozen_points - consumed - expired + refunded
        
        return {
            "total_points": total_points,
            "available_points": available,
            "frozen_points": frozen_points,
            "expired_points": expired,
            "consumed_points": consumed,
            "refunded_points": refunded
        }
    
    def create_batch(self, batch_data: PointBatchCreate) -> PointBatch:
        batch = PointBatch(**batch_data.model_dump())
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch
    
    def freeze_points(self, frozen_data: FrozenBalanceCreate) -> FrozenBalance:
        frozen = FrozenBalance(**frozen_data.model_dump())
        self.db.add(frozen)
        self.db.commit()
        self.db.refresh(frozen)
        return frozen
    
    def create_transaction(self, tx_data: PointTransactionCreate) -> PointTransaction:
        balance = self.calculate_member_balance(tx_data.member_id)
        before_balance = balance["available_points"]
        
        tx = PointTransaction(**tx_data.model_dump())
        tx.before_balance = before_balance
        
        if tx.tx_type in ["consume", "expire"]:
            tx.after_balance = before_balance - tx.points
        elif tx.tx_type in ["refund"]:
            tx.after_balance = before_balance + tx.points
        else:
            tx.after_balance = before_balance
        
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx
    
    def expire_points(self, member_id: str, batch_id: int, points: int, operator: str, tx_no: str = None) -> PointTransaction:
        if not tx_no:
            tx_no = f"EXP{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        balance = self.calculate_member_balance(member_id)
        before_balance = balance["available_points"]
        
        tx = PointTransaction(
            tx_no=tx_no,
            member_id=member_id,
            batch_id=batch_id,
            tx_type="expire",
            points=points,
            before_balance=before_balance,
            after_balance=before_balance - points,
            operator=operator,
            status="completed"
        )
        self.db.add(tx)
        
        batch = self.db.query(PointBatch).filter(PointBatch.id == batch_id).first()
        if batch:
            batch.status = "expired"
        
        self.db.commit()
        self.db.refresh(tx)
        return tx
    
    def refund_points(self, member_id: str, batch_id: int, points: int, related_tx_id: int, operator: str, tx_no: str = None) -> PointTransaction:
        if not tx_no:
            tx_no = f"REF{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        balance = self.calculate_member_balance(member_id)
        before_balance = balance["available_points"]
        
        tx = PointTransaction(
            tx_no=tx_no,
            member_id=member_id,
            batch_id=batch_id,
            tx_type="refund",
            points=points,
            before_balance=before_balance,
            after_balance=before_balance + points,
            related_tx_id=related_tx_id,
            operator=operator,
            status="completed"
        )
        self.db.add(tx)
        self.db.commit()
        self.db.refresh(tx)
        return tx
    
    def create_snapshot(self, snapshot_data: BalanceSnapshotCreate) -> BalanceSnapshot:
        snapshot = BalanceSnapshot(**snapshot_data.model_dump())
        self.db.add(snapshot)
        self.db.commit()
        self.db.refresh(snapshot)
        return snapshot
    
    def compare_balance(self, member_id: str, snapshot_id: int) -> dict:
        snapshot = self.db.query(BalanceSnapshot).filter(BalanceSnapshot.id == snapshot_id).first()
        if not snapshot:
            raise ValueError("快照不存在")
        
        calculated = self.calculate_member_balance(member_id)
        differences = []
        
        if calculated["total_points"] != snapshot.total_points:
            differences.append(f"总积分差异: 计算值{calculated['total_points']} vs 快照值{snapshot.total_points}")
        if calculated["available_points"] != snapshot.available_points:
            differences.append(f"可用积分差异: 计算值{calculated['available_points']} vs 快照值{snapshot.available_points}")
        if calculated["frozen_points"] != snapshot.frozen_points:
            differences.append(f"冻结积分差异: 计算值{calculated['frozen_points']} vs 快照值{snapshot.frozen_points}")
        if calculated["expired_points"] != snapshot.expired_points:
            differences.append(f"过期积分差异: 计算值{calculated['expired_points']} vs 快照值{snapshot.expired_points}")
        if calculated["consumed_points"] != snapshot.consumed_points:
            differences.append(f"消费积分差异: 计算值{calculated['consumed_points']} vs 快照值{snapshot.consumed_points}")
        if calculated["refunded_points"] != snapshot.refunded_points:
            differences.append(f"返还积分差异: 计算值{calculated['refunded_points']} vs 快照值{snapshot.refunded_points}")
        
        return {
            "is_consistent": len(differences) == 0,
            "differences": differences,
            "calculated_balance": calculated["available_points"],
            "snapshot_balance": snapshot.available_points
        }
    
    def manual_correct(self, tx_id: int, new_points: int, reason: str, operator: str) -> PointTransaction:
        original_tx = self.db.query(PointTransaction).filter(PointTransaction.id == tx_id).first()
        if not original_tx:
            raise ValueError("交易不存在")
        
        if original_tx.is_reviewed:
            raise ValueError("已复核的交易不能修正")
        
        if abs(new_points - original_tx.points) > 1000:
            raise ValueError("修正幅度过大，超过规则限制")
        
        before_data = f'{{"points": {original_tx.points}, "status": "{original_tx.status}"}}'
        
        point_diff = new_points - original_tx.points
        original_tx.points = new_points
        original_tx.is_manual = True
        original_tx.remark = f"{original_tx.remark or ''} 人工修正: {reason}"
        
        if original_tx.tx_type in ["consume", "expire"]:
            original_tx.after_balance = original_tx.before_balance - new_points
        elif original_tx.tx_type in ["refund"]:
            original_tx.after_balance = original_tx.before_balance + new_points
        
        after_data = f'{{"points": {new_points}, "status": "{original_tx.status}"}}'
        
        review = ReviewRecord(
            review_type="manual_correction",
            target_id=tx_id,
            target_type="transaction",
            before_data=before_data,
            after_data=after_data,
            status="completed",
            reviewer=operator,
            reviewed_at=datetime.now(),
            remark=reason
        )
        self.db.add(review)
        
        self.recalculate_subsequent_balances(original_tx.member_id, original_tx.created_at)
        
        self.db.commit()
        self.db.refresh(original_tx)
        return original_tx
    
    def recalculate_subsequent_balances(self, member_id: str, from_time: datetime):
        transactions = self.db.query(PointTransaction).filter(
            PointTransaction.member_id == member_id,
            PointTransaction.created_at > from_time
        ).order_by(PointTransaction.created_at).all()
        
        for tx in transactions:
            prev_tx = self.db.query(PointTransaction).filter(
                PointTransaction.member_id == member_id,
                PointTransaction.created_at < tx.created_at
            ).order_by(PointTransaction.created_at.desc()).first()
            
            if prev_tx:
                tx.before_balance = prev_tx.after_balance
            else:
                balance = self.calculate_member_balance(member_id)
                tx.before_balance = balance["available_points"] + (tx.points if tx.tx_type in ["consume", "expire"] else -tx.points if tx.tx_type == "refund" else 0)
            
            if tx.tx_type in ["consume", "expire"]:
                tx.after_balance = tx.before_balance - tx.points
            elif tx.tx_type == "refund":
                tx.after_balance = tx.before_balance + tx.points
    
    def review_transaction(self, tx_id: int, reviewer: str) -> PointTransaction:
        tx = self.db.query(PointTransaction).filter(PointTransaction.id == tx_id).first()
        if not tx:
            raise ValueError("交易不存在")
        
        tx.is_reviewed = True
        tx.reviewed_by = reviewer
        tx.reviewed_at = datetime.now()
        
        self.db.commit()
        self.db.refresh(tx)
        return tx
    
    def get_process_chain(self, batch_id: int) -> dict:
        batch = self.db.query(PointBatch).filter(PointBatch.id == batch_id).first()
        if not batch:
            raise ValueError("批次不存在")
        
        frozen = self.db.query(FrozenBalance).filter(FrozenBalance.batch_id == batch_id).all()
        transactions = self.db.query(PointTransaction).filter(PointTransaction.batch_id == batch_id).order_by(PointTransaction.created_at).all()
        snapshots = self.db.query(BalanceSnapshot).filter(BalanceSnapshot.member_id == batch.member_id).order_by(BalanceSnapshot.snapshot_date).all()
        
        chain = []
        order = 1
        
        chain.append({
            "order": order,
            "type": "batch",
            "id": batch.id,
            "no": batch.batch_no,
            "points": batch.points,
            "date": batch.created_at,
            "status": batch.status,
            "description": f"积分批次发放: {batch.points}积分"
        })
        order += 1
        
        for f in frozen:
            chain.append({
                "order": order,
                "type": "frozen",
                "id": f.id,
                "no": f"FRO{f.id}",
                "points": f.frozen_points,
                "date": f.created_at,
                "status": f.status,
                "description": f"冻结积分: {f.frozen_points}积分, 原因: {f.reason}"
            })
            order += 1
        
        for tx in transactions:
            type_desc = {
                "consume": "消费抵扣",
                "expire": "过期回收",
                "refund": "退款返还",
                "freeze": "冻结"
            }.get(tx.tx_type, tx.tx_type)
            
            chain.append({
                "order": order,
                "type": tx.tx_type,
                "id": tx.id,
                "no": tx.tx_no,
                "points": tx.points,
                "date": tx.created_at,
                "status": tx.status,
                "description": f"{type_desc}: {tx.points}积分, 余额: {tx.before_balance} -> {tx.after_balance}"
            })
            order += 1
        
        for s in snapshots:
            chain.append({
                "order": order,
                "type": "snapshot",
                "id": s.id,
                "no": f"SNP{s.id}",
                "points": s.available_points,
                "date": s.snapshot_date,
                "status": "consistent" if s.is_consistent else "inconsistent",
                "description": f"余额快照: 可用{s.available_points}, 总计{s.total_points}, 冻结{s.frozen_points}"
            })
            order += 1
        
        return {
            "member_id": batch.member_id,
            "batch": batch,
            "frozen": frozen,
            "transactions": transactions,
            "snapshots": snapshots,
            "chain": chain
        }
