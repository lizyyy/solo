import json
import csv
from pathlib import Path
from typing import List, Dict, Optional
from datetime import datetime
import os

from models.data_models import CheckSession, CheckResult


class HistoryManager:
    def __init__(self, history_dir: str = "./history"):
        self.history_dir = Path(history_dir)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.sessions: Dict[str, CheckSession] = {}
        self._load_history()

    def _session_to_dict(self, session: CheckSession) -> Dict:
        return {
            "session_id": session.session_id,
            "created_at": session.created_at.isoformat(),
            "status": session.status,
            "total_pending": session.total_pending,
            "total_issues": session.total_issues,
            "total_normal": session.total_normal,
            "results": [
                {
                    "employee_id": r.employee_id,
                    "employee_name": r.employee_name,
                    "company_name": r.company_name,
                    "add_on_id": r.add_on_id,
                    "item_code": r.item_code,
                    "item_name": r.item_name,
                    "quantity": r.quantity,
                    "unit_price": r.unit_price,
                    "discount_rate": r.discount_rate,
                    "expected_amount": r.expected_amount,
                    "paid_amount": r.paid_amount,
                    "refund_amount": r.refund_amount,
                    "status": r.status,
                    "issue_type": r.issue_type,
                    "issue_description": r.issue_description
                }
                for r in session.results
            ]
        }

    def _dict_to_session(self, data: Dict) -> CheckSession:
        results = []
        for r in data.get("results", []):
            results.append(CheckResult(
                employee_id=r["employee_id"],
                employee_name=r["employee_name"],
                company_name=r["company_name"],
                add_on_id=r["add_on_id"],
                item_code=r["item_code"],
                item_name=r["item_name"],
                quantity=r["quantity"],
                unit_price=r["unit_price"],
                discount_rate=r["discount_rate"],
                expected_amount=r["expected_amount"],
                paid_amount=r["paid_amount"],
                refund_amount=r["refund_amount"],
                status=r["status"],
                issue_type=r.get("issue_type"),
                issue_description=r.get("issue_description")
            ))
        
        return CheckSession(
            session_id=data["session_id"],
            created_at=datetime.fromisoformat(data["created_at"]),
            status=data["status"],
            results=results,
            total_pending=data.get("total_pending", 0),
            total_issues=data.get("total_issues", 0),
            total_normal=data.get("total_normal", 0)
        )

    def _load_history(self):
        for file in self.history_dir.glob("session_*.json"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    session = self._dict_to_session(data)
                    self.sessions[session.session_id] = session
            except Exception as e:
                print(f"⚠️ 加载历史记录失败: {file.name}")

    def save_session(self, session: CheckSession) -> str:
        self.sessions[session.session_id] = session
        
        file_path = self.history_dir / f"session_{session.session_id}.json"
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(self._session_to_dict(session), f, ensure_ascii=False, indent=2)
        
        return session.session_id

    def confirm_session(self, session_id: str) -> bool:
        if session_id not in self.sessions:
            return False
        
        session = self.sessions[session_id]
        session.status = "confirmed"
        self.save_session(session)
        return True

    def get_session(self, session_id: str) -> Optional[CheckSession]:
        return self.sessions.get(session_id)

    def list_sessions(self, limit: int = 10) -> List[CheckSession]:
        sorted_sessions = sorted(
            self.sessions.values(),
            key=lambda s: s.created_at,
            reverse=True
        )
        return sorted_sessions[:limit]

    def export_to_csv(self, session_id: str, output_path: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False

        with open(output_path, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.writer(f)
            writer.writerow([
                '员工ID', '姓名', '企业', '加项ID', '项目编码', '项目名称',
                '数量', '单价', '折扣率', '应收金额', '已收金额', '退费金额',
                '状态', '问题类型', '问题描述'
            ])
            
            for r in session.results:
                writer.writerow([
                    r.employee_id, r.employee_name, r.company_name,
                    r.add_on_id, r.item_code, r.item_name,
                    r.quantity, r.unit_price, r.discount_rate,
                    r.expected_amount, r.paid_amount, r.refund_amount,
                    r.status, r.issue_type or '', r.issue_description or ''
                ])
        
        return True

    def export_to_json(self, session_id: str, output_path: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self._session_to_dict(session), f, ensure_ascii=False, indent=2)
        
        return True
