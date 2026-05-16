#!/usr/bin/env python3
"""
权益用量对账API - 企业客户权益扣减对账系统
"""

import os
import json
import uuid
import sqlite3
from datetime import datetime, date
from enum import Enum
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from contextlib import contextmanager

from flask import Flask, request, jsonify, Response
from flask_cors import CORS


class DeductionStatus(Enum):
    SUCCESS = "success"
    PENDING_REVIEW = "pending_review"
    BLOCKED = "blocked"
    COMPENSATED = "compensated"


class CorrectionStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


@dataclass
class CustomerAccount:
    account_id: str
    customer_name: str
    created_at: str
    is_active: bool


@dataclass
class EquityPackage:
    package_id: str
    account_id: str
    package_type: str
    total_quota: int
    used_quota: int
    remaining_quota: int
    valid_from: str
    valid_to: str
    created_at: str


@dataclass
class CallEvent:
    event_id: str
    account_id: str
    package_id: str
    request_id: str
    api_name: str
    call_time: str
    request_body: str
    deducted_amount: int
    deducted_reason: str


@dataclass
class DeductionDetail:
    detail_id: str
    event_id: str
    account_id: str
    package_id: str
    deduction_time: str
    amount: int
    reason: str
    status: str
    raw_request: str
    processing_result: str
    operator: Optional[str] = None


@dataclass
class CorrectionRequest:
    correction_id: str
    account_id: str
    package_id: str
    detail_id: str
    request_time: str
    requested_by: str
    correction_type: str
    correction_amount: int
    reason: str
    status: str
    reviewed_by: Optional[str] = None
    review_time: Optional[str] = None
    review_comment: Optional[str] = None


@dataclass
class ReconciliationResult:
    reconciliation_id: str
    account_id: str
    package_id: str
    reconciliation_date: str
    start_time: str
    end_time: str
    total_calls: int
    total_deducted: int
    expected_remaining: int
    actual_remaining: int
    discrepancy: int
    status: str
    generated_by: str
    generated_at: str


DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "equity_reconciliation.db")


@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_database():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS customer_accounts (
                account_id TEXT PRIMARY KEY,
                customer_name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS equity_packages (
                package_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                package_type TEXT NOT NULL,
                total_quota INTEGER NOT NULL,
                used_quota INTEGER NOT NULL DEFAULT 0,
                remaining_quota INTEGER NOT NULL,
                valid_from TEXT NOT NULL,
                valid_to TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS call_events (
                event_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                package_id TEXT NOT NULL,
                request_id TEXT NOT NULL UNIQUE,
                api_name TEXT NOT NULL,
                call_time TEXT NOT NULL,
                request_body TEXT,
                deducted_amount INTEGER NOT NULL,
                deducted_reason TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
                FOREIGN KEY (package_id) REFERENCES equity_packages(package_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS deduction_details (
                detail_id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
                account_id TEXT NOT NULL,
                package_id TEXT NOT NULL,
                deduction_time TEXT NOT NULL,
                amount INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                raw_request TEXT,
                processing_result TEXT NOT NULL,
                operator TEXT,
                FOREIGN KEY (event_id) REFERENCES call_events(event_id),
                FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
                FOREIGN KEY (package_id) REFERENCES equity_packages(package_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS correction_requests (
                correction_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                package_id TEXT NOT NULL,
                detail_id TEXT NOT NULL,
                request_time TEXT NOT NULL,
                requested_by TEXT NOT NULL,
                correction_type TEXT NOT NULL,
                correction_amount INTEGER NOT NULL,
                reason TEXT NOT NULL,
                status TEXT NOT NULL,
                reviewed_by TEXT,
                review_time TEXT,
                review_comment TEXT,
                FOREIGN KEY (detail_id) REFERENCES deduction_details(detail_id),
                FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
                FOREIGN KEY (package_id) REFERENCES equity_packages(package_id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS reconciliation_results (
                reconciliation_id TEXT PRIMARY KEY,
                account_id TEXT NOT NULL,
                package_id TEXT NOT NULL,
                reconciliation_date TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                total_calls INTEGER NOT NULL,
                total_deducted INTEGER NOT NULL,
                expected_remaining INTEGER NOT NULL,
                actual_remaining INTEGER NOT NULL,
                discrepancy INTEGER NOT NULL,
                status TEXT NOT NULL,
                generated_by TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                FOREIGN KEY (account_id) REFERENCES customer_accounts(account_id),
                FOREIGN KEY (package_id) REFERENCES equity_packages(package_id)
            )
        ''')


app = Flask(__name__)
CORS(app)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def now_str() -> str:
    return datetime.now().isoformat()


class EquityService:
    
    @staticmethod
    def create_customer_account(customer_name: str) -> CustomerAccount:
        account_id = generate_id("acc")
        account = CustomerAccount(
            account_id=account_id,
            customer_name=customer_name,
            created_at=now_str(),
            is_active=True
        )
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO customer_accounts (account_id, customer_name, created_at, is_active)
                VALUES (?, ?, ?, ?)
            ''', (account.account_id, account.customer_name, account.created_at, 1))
        return account
    
    @staticmethod
    def get_customer_account(account_id: str) -> Optional[CustomerAccount]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM customer_accounts WHERE account_id = ?', (account_id,))
            row = cursor.fetchone()
            if row:
                return CustomerAccount(
                    account_id=row['account_id'],
                    customer_name=row['customer_name'],
                    created_at=row['created_at'],
                    is_active=bool(row['is_active'])
                )
        return None
    
    @staticmethod
    def create_equity_package(
        account_id: str,
        package_type: str,
        total_quota: int,
        valid_from: str,
        valid_to: str
    ) -> EquityPackage:
        package_id = generate_id("pkg")
        package = EquityPackage(
            package_id=package_id,
            account_id=account_id,
            package_type=package_type,
            total_quota=total_quota,
            used_quota=0,
            remaining_quota=total_quota,
            valid_from=valid_from,
            valid_to=valid_to,
            created_at=now_str()
        )
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO equity_packages (
                    package_id, account_id, package_type, total_quota,
                    used_quota, remaining_quota, valid_from, valid_to, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                package.package_id, package.account_id, package.package_type,
                package.total_quota, package.used_quota, package.remaining_quota,
                package.valid_from, package.valid_to, package.created_at
            ))
        return package
    
    @staticmethod
    def get_equity_package(package_id: str) -> Optional[EquityPackage]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM equity_packages WHERE package_id = ?', (package_id,))
            row = cursor.fetchone()
            if row:
                return EquityPackage(
                    package_id=row['package_id'],
                    account_id=row['account_id'],
                    package_type=row['package_type'],
                    total_quota=row['total_quota'],
                    used_quota=row['used_quota'],
                    remaining_quota=row['remaining_quota'],
                    valid_from=row['valid_from'],
                    valid_to=row['valid_to'],
                    created_at=row['created_at']
                )
        return None
    
    @staticmethod
    def get_equity_packages_by_account(account_id: str) -> List[EquityPackage]:
        packages = []
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM equity_packages WHERE account_id = ?', (account_id,))
            for row in cursor.fetchall():
                packages.append(EquityPackage(
                    package_id=row['package_id'],
                    account_id=row['account_id'],
                    package_type=row['package_type'],
                    total_quota=row['total_quota'],
                    used_quota=row['used_quota'],
                    remaining_quota=row['remaining_quota'],
                    valid_from=row['valid_from'],
                    valid_to=row['valid_to'],
                    created_at=row['created_at']
                ))
        return packages
    
    @staticmethod
    def check_duplicate_request(request_id: str) -> bool:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT 1 FROM call_events WHERE request_id = ?', (request_id,))
            return cursor.fetchone() is not None
    
    @staticmethod
    def process_deduction(
        account_id: str,
        package_id: str,
        request_id: str,
        api_name: str,
        deducted_amount: int,
        deducted_reason: str,
        request_body: Optional[str] = None,
        operator: Optional[str] = None
    ) -> Dict[str, Any]:
        if EquityService.check_duplicate_request(request_id):
            return {
                "success": False,
                "status": DeductionStatus.BLOCKED.value,
                "message": "重复请求被拦截",
                "detail_id": None
            }
        
        package = EquityService.get_equity_package(package_id)
        if not package:
            return {
                "success": False,
                "status": DeductionStatus.BLOCKED.value,
                "message": "权益包不存在",
                "detail_id": None
            }
        
        if package.account_id != account_id:
            return {
                "success": False,
                "status": DeductionStatus.BLOCKED.value,
                "message": "权益包不属于该账号",
                "detail_id": None
            }
        
        if not package.is_active:
            return {
                "success": False,
                "status": DeductionStatus.BLOCKED.value,
                "message": "权益包已失效",
                "detail_id": None
            }
        
        if package.remaining_quota < deducted_amount:
            status = DeductionStatus.PENDING_REVIEW.value
            processing_result = "额度不足，待人工复核"
        else:
            status = DeductionStatus.SUCCESS.value
            processing_result = "扣减成功"
        
        event_id = generate_id("evt")
        detail_id = generate_id("dtl")
        call_time = now_str()
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO call_events (
                    event_id, account_id, package_id, request_id, api_name,
                    call_time, request_body, deducted_amount, deducted_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                event_id, account_id, package_id, request_id, api_name,
                call_time, request_body, deducted_amount, deducted_reason
            ))
            
            cursor.execute('''
                INSERT INTO deduction_details (
                    detail_id, event_id, account_id, package_id, deduction_time,
                    amount, reason, status, raw_request, processing_result, operator
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                detail_id, event_id, account_id, package_id, call_time,
                deducted_amount, deducted_reason, status,
                request_body or "", processing_result, operator
            ))
            
            if status == DeductionStatus.SUCCESS.value:
                cursor.execute('''
                    UPDATE equity_packages
                    SET used_quota = used_quota + ?,
                        remaining_quota = remaining_quota - ?
                    WHERE package_id = ?
                ''', (deducted_amount, deducted_amount, package_id))
        
        return {
            "success": status == DeductionStatus.SUCCESS.value,
            "status": status,
            "message": processing_result,
            "detail_id": detail_id,
            "event_id": event_id
        }
    
    @staticmethod
    def get_deduction_details(
        account_id: Optional[str] = None,
        package_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[DeductionDetail]:
        details = []
        query = 'SELECT * FROM deduction_details WHERE 1=1'
        params = []
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        if package_id:
            query += ' AND package_id = ?'
            params.append(package_id)
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        query += ' ORDER BY deduction_time DESC LIMIT ?'
        params.append(limit)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                details.append(DeductionDetail(
                    detail_id=row['detail_id'],
                    event_id=row['event_id'],
                    account_id=row['account_id'],
                    package_id=row['package_id'],
                    deduction_time=row['deduction_time'],
                    amount=row['amount'],
                    reason=row['reason'],
                    status=row['status'],
                    raw_request=row['raw_request'],
                    processing_result=row['processing_result'],
                    operator=row['operator']
                ))
        return details
    
    @staticmethod
    def get_deduction_detail(detail_id: str) -> Optional[DeductionDetail]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM deduction_details WHERE detail_id = ?', (detail_id,))
            row = cursor.fetchone()
            if row:
                return DeductionDetail(
                    detail_id=row['detail_id'],
                    event_id=row['event_id'],
                    account_id=row['account_id'],
                    package_id=row['package_id'],
                    deduction_time=row['deduction_time'],
                    amount=row['amount'],
                    reason=row['reason'],
                    status=row['status'],
                    raw_request=row['raw_request'],
                    processing_result=row['processing_result'],
                    operator=row['operator']
                )
        return None
    
    @staticmethod
    def create_correction_request(
        account_id: str,
        package_id: str,
        detail_id: str,
        requested_by: str,
        correction_type: str,
        correction_amount: int,
        reason: str
    ) -> CorrectionRequest:
        correction_id = generate_id("corr")
        correction = CorrectionRequest(
            correction_id=correction_id,
            account_id=account_id,
            package_id=package_id,
            detail_id=detail_id,
            request_time=now_str(),
            requested_by=requested_by,
            correction_type=correction_type,
            correction_amount=correction_amount,
            reason=reason,
            status=CorrectionStatus.PENDING.value
        )
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO correction_requests (
                    correction_id, account_id, package_id, detail_id, request_time,
                    requested_by, correction_type, correction_amount, reason, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                correction.correction_id, correction.account_id, correction.package_id,
                correction.detail_id, correction.request_time, correction.requested_by,
                correction.correction_type, correction.correction_amount,
                correction.reason, correction.status
            ))
        return correction
    
    @staticmethod
    def review_correction_request(
        correction_id: str,
        reviewed_by: str,
        approve: bool,
        review_comment: str
    ) -> Dict[str, Any]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM correction_requests WHERE correction_id = ?', (correction_id,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "修正申请不存在"}
            
            if row['status'] != CorrectionStatus.PENDING.value:
                return {"success": False, "message": "该申请已处理"}
            
            new_status = CorrectionStatus.APPROVED.value if approve else CorrectionStatus.REJECTED.value
            review_time = now_str()
            
            cursor.execute('''
                UPDATE correction_requests
                SET status = ?, reviewed_by = ?, review_time = ?, review_comment = ?
                WHERE correction_id = ?
            ''', (new_status, reviewed_by, review_time, review_comment, correction_id))
            
            if approve:
                correction_amount = row['correction_amount']
                package_id = row['package_id']
                detail_id = row['detail_id']
                
                if row['correction_type'] == "refund":
                    cursor.execute('''
                        UPDATE equity_packages
                        SET used_quota = used_quota - ?,
                            remaining_quota = remaining_quota + ?
                        WHERE package_id = ?
                    ''', (correction_amount, correction_amount, package_id))
                    
                    cursor.execute('''
                        UPDATE deduction_details
                        SET status = ?, processing_result = ?
                        WHERE detail_id = ?
                    ''', (DeductionStatus.COMPENSATED.value, "已补偿", detail_id))
                
                elif row['correction_type'] == "additional_deduct":
                    cursor.execute('''
                        UPDATE equity_packages
                        SET used_quota = used_quota + ?,
                            remaining_quota = remaining_quota - ?
                        WHERE package_id = ?
                    ''', (correction_amount, correction_amount, package_id))
        
        return {
            "success": True,
            "status": new_status,
            "message": "审批完成"
        }
    
    @staticmethod
    def get_correction_requests(
        account_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100
    ) -> List[CorrectionRequest]:
        corrections = []
        query = 'SELECT * FROM correction_requests WHERE 1=1'
        params = []
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        query += ' ORDER BY request_time DESC LIMIT ?'
        params.append(limit)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                corrections.append(CorrectionRequest(
                    correction_id=row['correction_id'],
                    account_id=row['account_id'],
                    package_id=row['package_id'],
                    detail_id=row['detail_id'],
                    request_time=row['request_time'],
                    requested_by=row['requested_by'],
                    correction_type=row['correction_type'],
                    correction_amount=row['correction_amount'],
                    reason=row['reason'],
                    status=row['status'],
                    reviewed_by=row['reviewed_by'],
                    review_time=row['review_time'],
                    review_comment=row['review_comment']
                ))
        return corrections
    
    @staticmethod
    def recalculate_balance(package_id: str) -> Dict[str, Any]:
        package = EquityService.get_equity_package(package_id)
        if not package:
            return {"success": False, "message": "权益包不存在"}
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COALESCE(SUM(amount), 0) as total_deducted
                FROM deduction_details
                WHERE package_id = ? AND status = ?
            ''', (package_id, DeductionStatus.SUCCESS.value))
            row = cursor.fetchone()
            total_deducted = row['total_deducted']
            
            cursor.execute('''
                SELECT COALESCE(SUM(correction_amount), 0) as total_compensated
                FROM correction_requests
                WHERE package_id = ? AND status = ? AND correction_type = 'refund'
            ''', (package_id, CorrectionStatus.APPROVED.value))
            row = cursor.fetchone()
            total_compensated = row['total_compensated']
            
            actual_used = total_deducted - total_compensated
            actual_remaining = package.total_quota - actual_used
            
            cursor.execute('''
                UPDATE equity_packages
                SET used_quota = ?, remaining_quota = ?
                WHERE package_id = ?
            ''', (actual_used, actual_remaining, package_id))
        
        return {
            "success": True,
            "package_id": package_id,
            "total_quota": package.total_quota,
            "recalculated_used": actual_used,
            "recalculated_remaining": actual_remaining,
            "previous_used": package.used_quota,
            "previous_remaining": package.remaining_quota
        }
    
    @staticmethod
    def generate_reconciliation(
        account_id: str,
        package_id: str,
        start_time: str,
        end_time: str,
        generated_by: str
    ) -> ReconciliationResult:
        reconciliation_id = generate_id("rec")
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT COUNT(*) as total_calls, COALESCE(SUM(amount), 0) as total_deducted
                FROM deduction_details
                WHERE package_id = ? AND deduction_time >= ? AND deduction_time <= ? AND status = ?
            ''', (package_id, start_time, end_time, DeductionStatus.SUCCESS.value))
            row = cursor.fetchone()
            total_calls = row['total_calls']
            total_deducted = row['total_deducted']
            
            package = EquityService.get_equity_package(package_id)
            
            cursor.execute('''
                SELECT COALESCE(SUM(amount), 0) as total_before
                FROM deduction_details
                WHERE package_id = ? AND deduction_time < ? AND status = ?
            ''', (package_id, start_time, DeductionStatus.SUCCESS.value))
            row = cursor.fetchone()
            used_before = row['total_before']
            
            expected_remaining = package.total_quota - used_before - total_deducted
            actual_remaining = package.remaining_quota
            discrepancy = actual_remaining - expected_remaining
            
            status = "normal" if discrepancy == 0 else "discrepancy"
            
            reconciliation = ReconciliationResult(
                reconciliation_id=reconciliation_id,
                account_id=account_id,
                package_id=package_id,
                reconciliation_date=date.today().isoformat(),
                start_time=start_time,
                end_time=end_time,
                total_calls=total_calls,
                total_deducted=total_deducted,
                expected_remaining=expected_remaining,
                actual_remaining=actual_remaining,
                discrepancy=discrepancy,
                status=status,
                generated_by=generated_by,
                generated_at=now_str()
            )
            
            cursor.execute('''
                INSERT INTO reconciliation_results (
                    reconciliation_id, account_id, package_id, reconciliation_date,
                    start_time, end_time, total_calls, total_deducted,
                    expected_remaining, actual_remaining, discrepancy, status,
                    generated_by, generated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                reconciliation.reconciliation_id, reconciliation.account_id,
                reconciliation.package_id, reconciliation.reconciliation_date,
                reconciliation.start_time, reconciliation.end_time,
                reconciliation.total_calls, reconciliation.total_deducted,
                reconciliation.expected_remaining, reconciliation.actual_remaining,
                reconciliation.discrepancy, reconciliation.status,
                reconciliation.generated_by, reconciliation.generated_at
            ))
        
        return reconciliation
    
    @staticmethod
    def get_reconciliation_results(
        account_id: Optional[str] = None,
        package_id: Optional[str] = None,
        limit: int = 100
    ) -> List[ReconciliationResult]:
        results = []
        query = 'SELECT * FROM reconciliation_results WHERE 1=1'
        params = []
        
        if account_id:
            query += ' AND account_id = ?'
            params.append(account_id)
        if package_id:
            query += ' AND package_id = ?'
            params.append(package_id)
        
        query += ' ORDER BY generated_at DESC LIMIT ?'
        params.append(limit)
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(query, params)
            for row in cursor.fetchall():
                results.append(ReconciliationResult(
                    reconciliation_id=row['reconciliation_id'],
                    account_id=row['account_id'],
                    package_id=row['package_id'],
                    reconciliation_date=row['reconciliation_date'],
                    start_time=row['start_time'],
                    end_time=row['end_time'],
                    total_calls=row['total_calls'],
                    total_deducted=row['total_deducted'],
                    expected_remaining=row['expected_remaining'],
                    actual_remaining=row['actual_remaining'],
                    discrepancy=row['discrepancy'],
                    status=row['status'],
                    generated_by=row['generated_by'],
                    generated_at=row['generated_at']
                ))
        return results
    
    @staticmethod
    def export_reconciliation(reconciliation_id: str) -> Dict[str, Any]:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM reconciliation_results WHERE reconciliation_id = ?', (reconciliation_id,))
            row = cursor.fetchone()
            if not row:
                return {"success": False, "message": "对账记录不存在"}
            
            reconciliation = ReconciliationResult(
                reconciliation_id=row['reconciliation_id'],
                account_id=row['account_id'],
                package_id=row['package_id'],
                reconciliation_date=row['reconciliation_date'],
                start_time=row['start_time'],
                end_time=row['end_time'],
                total_calls=row['total_calls'],
                total_deducted=row['total_deducted'],
                expected_remaining=row['expected_remaining'],
                actual_remaining=row['actual_remaining'],
                discrepancy=row['discrepancy'],
                status=row['status'],
                generated_by=row['generated_by'],
                generated_at=row['generated_at']
            )
            
            cursor.execute('''
                SELECT * FROM deduction_details
                WHERE package_id = ? AND deduction_time >= ? AND deduction_time <= ?
                ORDER BY deduction_time
            ''', (reconciliation.package_id, reconciliation.start_time, reconciliation.end_time))
            
            details = []
            for d_row in cursor.fetchall():
                details.append({
                    "detail_id": d_row['detail_id'],
                    "deduction_time": d_row['deduction_time'],
                    "amount": d_row['amount'],
                    "reason": d_row['reason'],
                    "status": d_row['status'],
                    "processing_result": d_row['processing_result']
                })
            
            account = EquityService.get_customer_account(reconciliation.account_id)
            package = EquityService.get_equity_package(reconciliation.package_id)
            
            return {
                "success": True,
                "reconciliation": asdict(reconciliation),
                "account": asdict(account) if account else None,
                "package": asdict(package) if package else None,
                "deduction_details": details
            }


@app.route('/api/accounts', methods=['POST'])
def create_account():
    data = request.json
    account = EquityService.create_customer_account(data['customer_name'])
    return jsonify({"success": True, "data": asdict(account)})


@app.route('/api/accounts/<account_id>', methods=['GET'])
def get_account(account_id):
    account = EquityService.get_customer_account(account_id)
    if not account:
        return jsonify({"success": False, "message": "账号不存在"}), 404
    return jsonify({"success": True, "data": asdict(account)})


@app.route('/api/packages', methods=['POST'])
def create_package():
    data = request.json
    package = EquityService.create_equity_package(
        account_id=data['account_id'],
        package_type=data['package_type'],
        total_quota=data['total_quota'],
        valid_from=data['valid_from'],
        valid_to=data['valid_to']
    )
    return jsonify({"success": True, "data": asdict(package)})


@app.route('/api/packages/<package_id>', methods=['GET'])
def get_package(package_id):
    package = EquityService.get_equity_package(package_id)
    if not package:
        return jsonify({"success": False, "message": "权益包不存在"}), 404
    return jsonify({"success": True, "data": asdict(package)})


@app.route('/api/accounts/<account_id>/packages', methods=['GET'])
def get_account_packages(account_id):
    packages = EquityService.get_equity_packages_by_account(account_id)
    return jsonify({"success": True, "data": [asdict(p) for p in packages]})


@app.route('/api/deductions', methods=['POST'])
def process_deduction():
    data = request.json
    result = EquityService.process_deduction(
        account_id=data['account_id'],
        package_id=data['package_id'],
        request_id=data['request_id'],
        api_name=data['api_name'],
        deducted_amount=data['deducted_amount'],
        deducted_reason=data['deducted_reason'],
        request_body=data.get('request_body'),
        operator=data.get('operator')
    )
    return jsonify(result)


@app.route('/api/deductions', methods=['GET'])
def list_deductions():
    account_id = request.args.get('account_id')
    package_id = request.args.get('package_id')
    status = request.args.get('status')
    limit = int(request.args.get('limit', 100))
    
    details = EquityService.get_deduction_details(account_id, package_id, status, limit)
    return jsonify({"success": True, "data": [asdict(d) for d in details]})


@app.route('/api/deductions/<detail_id>', methods=['GET'])
def get_deduction(detail_id):
    detail = EquityService.get_deduction_detail(detail_id)
    if not detail:
        return jsonify({"success": False, "message": "扣减记录不存在"}), 404
    return jsonify({"success": True, "data": asdict(detail)})


@app.route('/api/corrections', methods=['POST'])
def create_correction():
    data = request.json
    correction = EquityService.create_correction_request(
        account_id=data['account_id'],
        package_id=data['package_id'],
        detail_id=data['detail_id'],
        requested_by=data['requested_by'],
        correction_type=data['correction_type'],
        correction_amount=data['correction_amount'],
        reason=data['reason']
    )
    return jsonify({"success": True, "data": asdict(correction)})


@app.route('/api/corrections/<correction_id>/review', methods=['POST'])
def review_correction(correction_id):
    data = request.json
    result = EquityService.review_correction_request(
        correction_id=correction_id,
        reviewed_by=data['reviewed_by'],
        approve=data['approve'],
        review_comment=data['review_comment']
    )
    return jsonify(result)


@app.route('/api/corrections', methods=['GET'])
def list_corrections():
    account_id = request.args.get('account_id')
    status = request.args.get('status')
    limit = int(request.args.get('limit', 100))
    
    corrections = EquityService.get_correction_requests(account_id, status, limit)
    return jsonify({"success": True, "data": [asdict(c) for c in corrections]})


@app.route('/api/packages/<package_id>/recalculate', methods=['POST'])
def recalculate_balance(package_id):
    result = EquityService.recalculate_balance(package_id)
    return jsonify(result)


@app.route('/api/reconciliations', methods=['POST'])
def create_reconciliation():
    data = request.json
    reconciliation = EquityService.generate_reconciliation(
        account_id=data['account_id'],
        package_id=data['package_id'],
        start_time=data['start_time'],
        end_time=data['end_time'],
        generated_by=data['generated_by']
    )
    return jsonify({"success": True, "data": asdict(reconciliation)})


@app.route('/api/reconciliations', methods=['GET'])
def list_reconciliations():
    account_id = request.args.get('account_id')
    package_id = request.args.get('package_id')
    limit = int(request.args.get('limit', 100))
    
    results = EquityService.get_reconciliation_results(account_id, package_id, limit)
    return jsonify({"success": True, "data": [asdict(r) for r in results]})


@app.route('/api/reconciliations/<reconciliation_id>/export', methods=['GET'])
def export_reconciliation(reconciliation_id):
    result = EquityService.export_reconciliation(reconciliation_id)
    if not result['success']:
        return jsonify(result), 404
    
    export_data = json.dumps(result, ensure_ascii=False, indent=2)
    return Response(
        export_data,
        mimetype='application/json',
        headers={'Content-Disposition': f'attachment; filename=reconciliation_{reconciliation_id}.json'}
    )


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "timestamp": now_str()})


if __name__ == '__main__':
    init_database()
    print("数据库初始化完成")
    app.run(host='0.0.0.0', port=5000, debug=True)
