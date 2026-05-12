from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
import uuid
import json

from app.models import (
    Member, Transaction, DuplicateCandidate, 
    MergeRecord, MergeHistory, ManualReview, MergeReport
)
from app.schemas import MemberCreate, AssetPreview

class MemberService:
    @staticmethod
    def create_member(db: Session, member_data: MemberCreate) -> Member:
        existing = db.query(Member).filter(Member.member_no == member_data.member_no).first()
        if existing:
            raise ValueError(f"会员号 {member_data.member_no} 已存在")
        
        member = Member(
            member_no=member_data.member_no,
            name=member_data.name,
            phone=member_data.phone,
            balance=member_data.balance or 0.0,
            points=member_data.points or 0,
            points_expire_at=member_data.points_expire_at,
            store_id=member_data.store_id,
            status="active"
        )
        db.add(member)
        db.flush()
        
        if member.balance > 0:
            db.add(Transaction(
                member_id=member.id,
                type="initial_deposit",
                amount=member.balance,
                points=0,
                description="初始储值",
                ref_no=f"INIT-{member.member_no}",
                operator="system"
            ))
        if member.points > 0:
            db.add(Transaction(
                member_id=member.id,
                type="initial_points",
                amount=0,
                points=member.points,
                description="初始积分",
                ref_no=f"INIT-{member.member_no}",
                operator="system"
            ))
        
        db.commit()
        db.refresh(member)
        return member

    @staticmethod
    def get_member(db: Session, member_no: str) -> Optional[Member]:
        return db.query(Member).filter(Member.member_no == member_no).first()

    @staticmethod
    def get_member_by_id(db: Session, member_id: int) -> Optional[Member]:
        return db.query(Member).filter(Member.id == member_id).first()

    @staticmethod
    def get_members_by_phone(db: Session, phone: str) -> List[Member]:
        return db.query(Member).filter(Member.phone == phone).all()

    @staticmethod
    def get_transactions(db: Session, member_id: int) -> List[Transaction]:
        return db.query(Transaction).filter(
            Transaction.member_id == member_id
        ).order_by(Transaction.created_at.desc()).all()

class DuplicateService:
    @staticmethod
    def scan_duplicates(db: Session) -> List[DuplicateCandidate]:
        phone_counts = db.query(
            Member.phone
        ).group_by(Member.phone).having(
            Member.phone != '', Member.phone != None
        ).all()
        
        candidates = []
        for (phone,) in phone_counts:
            members = db.query(Member).filter(
                Member.phone == phone,
                Member.status == 'active'
            ).all()
            
            if len(members) >= 2:
                existing = db.query(DuplicateCandidate).filter(
                    DuplicateCandidate.phone == phone,
                    DuplicateCandidate.status == 'pending'
                ).first()
                
                if not existing:
                    member_ids = ",".join(str(m.id) for m in members)
                    names = [m.name for m in members]
                    reason = f"同一手机号{phone}对应多个姓名: {', '.join(names)}" if len(set(names)) > 1 else f"同一手机号{phone}注册多个账户"
                    
                    candidate = DuplicateCandidate(
                        phone=phone,
                        member_ids=member_ids,
                        reason=reason,
                        status="pending"
                    )
                    db.add(candidate)
                    db.flush()
                    candidates.append(candidate)
        
        db.commit()
        return candidates

    @staticmethod
    def get_pending_candidates(db: Session) -> List[DuplicateCandidate]:
        return db.query(DuplicateCandidate).filter(
            DuplicateCandidate.status == 'pending'
        ).order_by(DuplicateCandidate.created_at.desc()).all()

    @staticmethod
    def resolve_candidate(db: Session, candidate_id: int) -> Optional[DuplicateCandidate]:
        candidate = db.query(DuplicateCandidate).filter(DuplicateCandidate.id == candidate_id).first()
        if candidate:
            candidate.status = "resolved"
            candidate.resolved_at = datetime.utcnow()
            db.commit()
            db.refresh(candidate)
        return candidate

class MergeService:
    @staticmethod
    def generate_merge_no() -> str:
        return f"MG{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def add_history(
        db: Session, 
        merge_id: int, 
        phase: str, 
        old_status: Optional[str], 
        new_status: str,
        operator: Optional[str],
        description: str,
        change_summary: Optional[str] = None
    ):
        history = MergeHistory(
            merge_record_id=merge_id,
            phase=phase,
            old_status=old_status,
            new_status=new_status,
            operator=operator,
            description=description,
            change_summary=change_summary
        )
        db.add(history)

    @staticmethod
    def preview_merge(db: Session, source_no: str, target_no: str) -> AssetPreview:
        source = MemberService.get_member(db, source_no)
        target = MemberService.get_member(db, target_no)
        
        if not source:
            raise ValueError(f"源会员 {source_no} 不存在")
        if not target:
            raise ValueError(f"目标会员 {target_no} 不存在")
        if source.id == target.id:
            raise ValueError("不能合并同一会员")
        if source.status != "active":
            raise ValueError(f"源会员状态异常: {source.status}")
        if target.status != "active":
            raise ValueError(f"目标会员状态异常: {target.status}")
        
        conflicts = []
        warnings = []
        is_mergeable = True
        reason_not_mergeable = None
        
        if source.phone != target.phone:
            is_mergeable = False
            reason_not_mergeable = f"手机号不一致: 源 {source.phone} vs 目标 {target.phone}"
            conflicts.append({
                "field": "phone",
                "source_value": source.phone,
                "target_value": target.phone,
                "level": "error",
                "description": "手机号必须一致才能合并"
            })
        elif source.name != target.name:
            conflicts.append({
                "field": "name",
                "source_value": source.name,
                "target_value": target.name,
                "level": "warning",
                "description": "姓名不一致，需要人工确认"
            })
            warnings.append(f"姓名不一致: 源 {source.name} vs 目标 {target.name}")
        
        if source.balance < 0:
            is_mergeable = False
            reason_not_mergeable = f"源会员储值余额为负: {source.balance}"
            conflicts.append({
                "field": "balance",
                "source_value": source.balance,
                "target_value": target.balance,
                "level": "error",
                "description": "源会员储值余额异常"
            })
        
        if source.points_expire_at:
            days_to_expire = (source.points_expire_at - datetime.utcnow()).days
            if days_to_expire <= 30:
                warnings.append(f"源会员积分将于 {days_to_expire} 天后过期")
        
        existing_merges = db.query(MergeRecord).filter(
            or_(
                and_(MergeRecord.source_member_no == source_no, MergeRecord.status == 'completed'),
                and_(MergeRecord.target_member_no == source_no, MergeRecord.status == 'completed')
            )
        ).all()
        
        if existing_merges:
            warnings.append(f"源会员 {source_no} 已参与过 {len(existing_merges)} 次合并")
        
        estimated_balance = target.balance + source.balance
        estimated_points = target.points + source.points
        
        return AssetPreview(
            source_member=source,
            target_member=target,
            source_balance=source.balance,
            source_points=source.points,
            target_balance=target.balance,
            target_points=target.points,
            estimated_target_balance=estimated_balance,
            estimated_target_points=estimated_points,
            conflicts=conflicts,
            warnings=warnings,
            is_mergeable=is_mergeable,
            reason_if_not_mergeable=reason_not_mergeable
        )

    @staticmethod
    def initiate_merge(
        db: Session,
        source_no: str,
        target_no: str,
        reason: Optional[str],
        operator: str,
        idempotency_key: Optional[str]
    ) -> Tuple[MergeRecord, str]:
        if idempotency_key:
            existing = db.query(MergeRecord).filter(
                MergeRecord.idempotency_key == idempotency_key
            ).first()
            if existing:
                return existing, "idempotent"
        
        preview = MergeService.preview_merge(db, source_no, target_no)
        
        source = MemberService.get_member(db, source_no)
        target = MemberService.get_member(db, target_no)
        
        has_conflicts = any(c["level"] == "warning" for c in preview.conflicts)
        initial_status = "pending_review" if has_conflicts else "pending_confirm"
        initial_phase = "conflict_detection" if has_conflicts else "preview_ready"
        
        record = MergeRecord(
            merge_no=MergeService.generate_merge_no(),
            source_member_id=source.id,
            target_member_id=target.id,
            source_member_no=source_no,
            target_member_no=target_no,
            status=initial_status,
            phase=initial_phase,
            operator=operator,
            reason=reason,
            balance_before=source.balance,
            points_before=source.points,
            target_balance_before=target.balance,
            target_points_before=target.points,
            idempotency_key=idempotency_key
        )
        db.add(record)
        db.flush()
        
        MergeService.add_history(
            db, record.id, "initiated", None, initial_status,
            operator, f"创建并卡申请: {source_no} -> {target_no}",
            f"源: 储值{source.balance}, 积分{source.points}; 目标: 储值{target.balance}, 积分{target.points}"
        )
        
        db.commit()
        db.refresh(record)
        return record, "new"

    @staticmethod
    def review_conflict(
        db: Session,
        merge_no: str,
        conflict_type: str,
        decision: str,
        after_value: Optional[str],
        explanation: str,
        operator: str
    ) -> MergeRecord:
        record = db.query(MergeRecord).filter(MergeRecord.merge_no == merge_no).first()
        if not record:
            raise ValueError(f"并卡记录 {merge_no} 不存在")
        if record.status != "pending_review":
            raise ValueError(f"当前状态 {record.status} 不允许审核")
        
        source = MemberService.get_member_by_id(db, record.source_member_id)
        target = MemberService.get_member_by_id(db, record.target_member_id)
        
        before_val = None
        after_val = after_value
        
        if conflict_type == "name":
            before_val = f"源: {source.name}, 目标: {target.name}"
        
        review = ManualReview(
            merge_record_id=record.id,
            conflict_type=conflict_type,
            before_value=before_val,
            after_value=after_val,
            decision=decision,
            operator=operator,
            explanation=explanation
        )
        db.add(review)
        
        old_status = record.status
        if decision == "accept":
            record.status = "pending_confirm"
            record.phase = "preview_ready"
            desc = f"冲突审核通过: {conflict_type}"
        elif decision == "reject":
            record.status = "review_rejected"
            record.phase = "rejected"
            desc = f"冲突审核驳回: {conflict_type}"
        else:
            raise ValueError(f"无效决策: {decision}")
        
        MergeService.add_history(
            db, record.id, "manual_review", old_status, record.status,
            operator, desc,
            f"类型: {conflict_type}, 决策: {decision}, 说明: {explanation}"
        )
        
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def confirm_merge(db: Session, merge_no: str, operator: str, remark: Optional[str]) -> MergeRecord:
        record = db.query(MergeRecord).filter(MergeRecord.merge_no == merge_no).first()
        if not record:
            raise ValueError(f"并卡记录 {merge_no} 不存在")
        
        if record.status == "completed":
            return record
        
        if record.status not in ["pending_confirm", "preview_ready"]:
            raise ValueError(f"当前状态 {record.status} 不允许确认合并")
        
        source = MemberService.get_member_by_id(db, record.source_member_id)
        target = MemberService.get_member_by_id(db, record.target_member_id)
        
        if source.status != "active":
            raise ValueError(f"源会员状态异常: {source.status}")
        if target.status != "active":
            raise ValueError(f"目标会员状态异常: {target.status}")
        
        balance_to_move = source.balance
        points_to_move = source.points
        
        record.balance_moved = balance_to_move
        record.points_moved = points_to_move
        record.balance_after = 0.0
        record.points_after = 0
        record.target_balance_after = target.balance + balance_to_move
        record.target_points_after = target.points + points_to_move
        record.remark = remark
        
        target.balance += balance_to_move
        target.points += points_to_move
        
        source.balance = 0.0
        source.points = 0
        source.status = "merged"
        
        db.add(Transaction(
            member_id=source.id,
            type="merge_out",
            amount=-balance_to_move,
            points=-points_to_move,
            description=f"并卡转出至 {target.member_no}",
            ref_no=record.merge_no,
            operator=operator
        ))
        
        db.add(Transaction(
            member_id=target.id,
            type="merge_in",
            amount=balance_to_move,
            points=points_to_move,
            description=f"接收 {source.member_no} 并卡转入",
            ref_no=record.merge_no,
            operator=operator
        ))
        
        old_status = record.status
        record.status = "completed"
        record.phase = "executed"
        record.completed_at = datetime.utcnow()
        
        MergeService.add_history(
            db, record.id, "execution", old_status, "completed",
            operator, "并卡执行完成",
            f"转移储值: {balance_to_move}, 转移积分: {points_to_move}"
        )
        
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def cancel_merge(db: Session, merge_no: str, operator: str, remark: Optional[str]) -> MergeRecord:
        record = db.query(MergeRecord).filter(MergeRecord.merge_no == merge_no).first()
        if not record:
            raise ValueError(f"并卡记录 {merge_no} 不存在")
        
        if record.status in ["completed", "cancelled"]:
            return record
        
        if record.status not in ["pending_review", "pending_confirm", "preview_ready", "initiated"]:
            raise ValueError(f"当前状态 {record.status} 不允许撤销")
        
        old_status = record.status
        record.status = "cancelled"
        record.phase = "cancelled"
        record.cancelled_at = datetime.utcnow()
        record.remark = remark
        
        MergeService.add_history(
            db, record.id, "cancellation", old_status, "cancelled",
            operator, "并卡已撤销",
            remark or "用户主动撤销"
        )
        
        db.commit()
        db.refresh(record)
        return record

    @staticmethod
    def get_merge_detail(db: Session, merge_no: str) -> Optional[Dict[str, Any]]:
        record = db.query(MergeRecord).filter(MergeRecord.merge_no == merge_no).first()
        if not record:
            return None
        
        histories = db.query(MergeHistory).filter(
            MergeHistory.merge_record_id == record.id
        ).order_by(MergeHistory.created_at.asc()).all()
        
        reviews = db.query(ManualReview).filter(
            ManualReview.merge_record_id == record.id
        ).order_by(ManualReview.created_at.asc()).all()
        
        source = MemberService.get_member_by_id(db, record.source_member_id)
        target = MemberService.get_member_by_id(db, record.target_member_id)
        
        source_transactions = []
        if record.status == "completed":
            source_transactions = MemberService.get_transactions(db, record.source_member_id)
        
        return {
            "merge": record,
            "histories": histories,
            "reviews": reviews,
            "source_member": source,
            "target_member": target,
            "source_transactions": source_transactions
        }

    @staticmethod
    def query_merges(
        db: Session,
        merge_no: Optional[str] = None,
        status: Optional[str] = None,
        phone: Optional[str] = None
    ) -> List[MergeRecord]:
        query = db.query(MergeRecord)
        
        if merge_no:
            query = query.filter(MergeRecord.merge_no == merge_no)
        if status:
            query = query.filter(MergeRecord.status == status)
        if phone:
            query = query.filter(
                or_(
                    MergeRecord.source_member_no.in_(
                        db.query(Member.member_no).filter(Member.phone == phone)
                    ),
                    MergeRecord.target_member_no.in_(
                        db.query(Member.member_no).filter(Member.phone == phone)
                    )
                )
            )
        
        return query.order_by(MergeRecord.created_at.desc()).all()

class ReportService:
    @staticmethod
    def generate_report_no() -> str:
        return f"RP{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6].upper()}"

    @staticmethod
    def generate_merge_report(db: Session, merge_no: str, report_type: str, operator: str) -> MergeReport:
        detail = MergeService.get_merge_detail(db, merge_no)
        if not detail:
            raise ValueError(f"并卡记录 {merge_no} 不存在")
        
        report = MergeReport(
            report_no=ReportService.generate_report_no(),
            merge_record_id=detail["merge"].id,
            report_type=report_type,
            status="generating",
            operator=operator
        )
        db.add(report)
        db.flush()
        
        m = detail["merge"]
        s = detail["source_member"]
        t = detail["target_member"]
        
        history_lines = []
        for h in detail["histories"]:
            history_lines.append(
                f"[{h.created_at}] {h.phase}: {h.old_status or '-'} -> {h.new_status} | 操作: {h.operator or 'system'} | {h.description}"
            )
            if h.change_summary:
                history_lines.append(f"    变更摘要: {h.change_summary}")
        
        review_lines = []
        for r in detail["reviews"]:
            review_lines.append(
                f"[{r.created_at}] {r.conflict_type}: {r.decision} | 操作: {r.operator} | {r.explanation}"
            )
            if r.before_value:
                review_lines.append(f"    前值: {r.before_value} -> 后值: {r.after_value or '-'}")
        
        tx_lines = []
        for tx in detail["source_transactions"]:
            tx_lines.append(
                f"[{tx.created_at}] {tx.type}: 金额{tx.amount}, 积分{tx.points} | {tx.description} | 参考: {tx.ref_no}"
            )
        
        content = f"""
========================================================
                门店会员并卡报告
========================================================
报告编号: {report.report_no}
报告类型: {report_type}
并卡单号: {m.merge_no}
生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}
操作员: {operator}

--------------------------------------------------------
【1. 合并基本信息】
--------------------------------------------------------
源会员卡号: {m.source_member_no}
源会员姓名: {s.name if s else '未知'}
源会员手机号: {s.phone if s else '未知'}
目标会员卡号: {m.target_member_no}
目标会员姓名: {t.name if t else '未知'}
目标会员手机号: {t.phone if t else '未知'}
合并原因: {m.reason or '未填写'}
备注: {m.remark or '无'}
当前状态: {m.status}
创建时间: {m.created_at}
完成时间: {m.completed_at or '未完成'}

--------------------------------------------------------
【2. 资产变更明细】
--------------------------------------------------------
=== 源会员 ===
合并前储值: ¥{m.balance_before:.2f}
合并前积分: {m.points_before} 分
转移储值: ¥{m.balance_moved:.2f}
转移积分: {m.points_moved} 分
合并后储值: ¥{m.balance_after:.2f}
合并后积分: {m.points_after} 分

=== 目标会员 ===
合并前储值: ¥{m.target_balance_before:.2f}
合并前积分: {m.target_points_before} 分
合并后储值: ¥{m.target_balance_after:.2f}
合并后积分: {m.target_points_after} 分

--------------------------------------------------------
【3. 并卡操作历史】
--------------------------------------------------------
{chr(10).join(history_lines) if history_lines else '无历史记录'}

--------------------------------------------------------
【4. 人工审核记录】
--------------------------------------------------------
{chr(10).join(review_lines) if review_lines else '无需审核'}

--------------------------------------------------------
【5. 被合并卡交易历史】
--------------------------------------------------------
{chr(10).join(tx_lines) if tx_lines else '无交易记录'}

--------------------------------------------------------
【6. 客服解释记录】
--------------------------------------------------------
并卡申请由 {m.operator or 'system'} 发起
{review_lines[-1] if review_lines else '无特殊说明'}

========================================================
                        报告结束
========================================================
"""
        
        report.content = content
        report.status = "completed"
        report.completed_at = datetime.utcnow()
        
        db.commit()
        db.refresh(report)
        return report

    @staticmethod
    def get_report(db: Session, report_no: str) -> Optional[MergeReport]:
        return db.query(MergeReport).filter(MergeReport.report_no == report_no).first()
