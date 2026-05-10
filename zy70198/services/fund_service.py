from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

from models import FundCalendar, FundCalendarEntry, FundStatus
from repositories import FundRepository


class FundService:
    def __init__(self, fund_repo: FundRepository):
        self.fund_repo = fund_repo

    def create_calendar(
        self,
        name: str,
        fiscal_year: int,
        created_by: str
    ) -> Tuple[FundCalendar, Dict]:
        rule_traces = []
        
        calendar_id = f'FC-{fiscal_year}-{str(uuid4())[:6].upper()}'
        
        existing = self.fund_repo.get_calendar_by_year(fiscal_year)
        if existing and existing.is_active:
            rule_traces.append({
                'rule': 'FC_CREATE_001',
                'description': '检查财年日历是否已存在',
                'input': {'fiscal_year': fiscal_year},
                'output': '该财年已有激活的资金日历',
                'passed': False
            })
            return existing, {
                'calendar_id': existing.id,
                'success': False,
                'error': f'{fiscal_year}财年已有激活的资金日历',
                'rule_traces': rule_traces
            }
        
        calendar = FundCalendar(
            id=calendar_id,
            name=name,
            fiscal_year=fiscal_year,
            is_active=True
        )
        
        self.fund_repo.save_calendar(calendar)
        
        rule_traces.append({
            'rule': 'FC_CREATE_002',
            'description': '资金日历创建成功',
            'input': {'fiscal_year': fiscal_year},
            'output': {'calendar_id': calendar_id},
            'passed': True
        })
        
        return calendar, {
            'calendar_id': calendar_id,
            'success': True,
            'next_action': '请配置每日资金额度',
            'rule_traces': rule_traces
        }

    def add_fund_entry(
        self,
        calendar_id: str,
        entry_date: date,
        total_fund: float,
        operator: str,
        remark: Optional[str] = None
    ) -> Tuple[FundCalendarEntry, Dict]:
        rule_traces = []
        
        calendar = self.fund_repo.get_calendar_by_id(calendar_id)
        if not calendar:
            raise ValueError(f'资金日历 {calendar_id} 不存在')
        
        existing = self.fund_repo.get_by_date(entry_date)
        if existing:
            rule_traces.append({
                'rule': 'FE_CREATE_001',
                'description': '检查该日期是否已有资金配置',
                'input': {'entry_date': entry_date.isoformat()},
                'output': '该日期已有资金配置',
                'passed': False
            })
            return existing, {
                'entry_id': existing.id,
                'success': False,
                'error': f'{entry_date.isoformat()} 已有资金配置',
                'rule_traces': rule_traces
            }
        
        entry_id = f'FE-{entry_date.strftime("%Y%m%d")}-{str(uuid4())[:4].upper()}'
        
        entry = FundCalendarEntry(
            id=entry_id,
            calendar_date=entry_date,
            total_fund=total_fund,
            reserved_fund=0,
            status=FundStatus.AVAILABLE,
            remark=remark
        )
        
        self.fund_repo.save_entry(entry)
        
        rule_traces.append({
            'rule': 'FE_CREATE_002',
            'description': '资金日历条目创建成功',
            'input': {
                'entry_date': entry_date.isoformat(),
                'total_fund': total_fund
            },
            'output': {'entry_id': entry_id, 'available_fund': total_fund},
            'passed': True
        })
        
        return entry, {
            'entry_id': entry_id,
            'calendar_date': entry_date.isoformat(),
            'total_fund': total_fund,
            'available_fund': total_fund,
            'success': True,
            'rule_traces': rule_traces
        }

    def check_fund_availability(
        self,
        check_date: date,
        required_amount: float
    ) -> Dict:
        rule_traces = []
        
        entry = self.fund_repo.get_by_date(check_date)
        
        if not entry:
            rule_traces.append({
                'rule': 'FA_CHECK_001',
                'description': '检查资金配置',
                'input': {'check_date': check_date.isoformat()},
                'output': '该日期未配置资金',
                'passed': False
            })
            return {
                'date': check_date.isoformat(),
                'has_fund': False,
                'available_fund': 0,
                'required_amount': required_amount,
                'sufficient': False,
                'message': f'{check_date.isoformat()} 未配置资金',
                'rule_traces': rule_traces
            }
        
        if entry.status in [FundStatus.LOCKED, FundStatus.CANCELLED]:
            rule_traces.append({
                'rule': 'FA_CHECK_002',
                'description': '检查资金状态',
                'input': {'status': entry.status.value},
                'output': '资金已锁定或取消',
                'passed': False
            })
            return {
                'date': check_date.isoformat(),
                'has_fund': True,
                'status': entry.status.value,
                'total_fund': entry.total_fund,
                'reserved_fund': entry.reserved_fund,
                'available_fund': entry.available_fund,
                'required_amount': required_amount,
                'sufficient': False,
                'message': f'该日期资金状态为{entry.status.value}，不可用',
                'rule_traces': rule_traces
            }
        
        available = entry.available_fund
        sufficient = available >= required_amount
        
        rule_traces.append({
            'rule': 'FA_CHECK_003',
            'description': '检查可用资金是否充足',
            'input': {
                'available_fund': available,
                'required_amount': required_amount
            },
            'output': '充足' if sufficient else f'不足，缺口{required_amount - available:.2f}元',
            'passed': sufficient
        })
        
        return {
            'date': check_date.isoformat(),
            'has_fund': True,
            'status': entry.status.value,
            'total_fund': entry.total_fund,
            'reserved_fund': entry.reserved_fund,
            'available_fund': available,
            'required_amount': required_amount,
            'sufficient': sufficient,
            'shortage': required_amount - available if not sufficient else 0,
            'message': f'可用资金{available:.2f}元，{"足够" if sufficient else "不足"}' if sufficient else f'可用资金{available:.2f}元，不足，缺口{required_amount - available:.2f}元',
            'rule_traces': rule_traces
        }

    def get_monthly_fund_summary(
        self,
        year: int,
        month: int
    ) -> Dict:
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            end_date = date(year, month + 1, 1) - timedelta(days=1)
        
        entries = self.fund_repo.get_by_date_range(start_date, end_date)
        
        total_fund = sum(e.total_fund for e in entries)
        reserved_fund = sum(e.reserved_fund for e in entries)
        available_fund = total_fund - reserved_fund
        
        return {
            'year_month': f'{year}-{month:02d}',
            'total_days': (end_date - start_date).days + 1,
            'days_with_fund': len(entries),
            'total_fund': total_fund,
            'reserved_fund': reserved_fund,
            'available_fund': available_fund,
            'utilization_rate': (reserved_fund / total_fund * 100) if total_fund > 0 else 0,
            'entries': [
                {
                    'date': e.calendar_date.isoformat(),
                    'total_fund': e.total_fund,
                    'reserved_fund': e.reserved_fund,
                    'available_fund': e.available_fund,
                    'status': e.status.value
                }
                for e in entries
            ]
        }
