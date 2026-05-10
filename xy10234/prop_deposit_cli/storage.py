import os
import json
import uuid
from typing import Dict, List, Optional, Any
from datetime import datetime, date
from .config import DATA_DIR, PROBLEMS_DIR, REPORTS_DIR, ensure_dirs
from .models import Prop, BorrowRecord, ProblemRecord, PropStatus, BorrowStatus, DamageLevel


class Storage:
    def __init__(self):
        ensure_dirs()
        self.props_file = os.path.join(DATA_DIR, "props.json")
        self.borrows_file = os.path.join(DATA_DIR, "borrows.json")
        self.problems_file = os.path.join(PROBLEMS_DIR, "problems.json")
        self._load_all()
    
    def _load_all(self):
        self.props: Dict[str, Prop] = self._load_props()
        self.borrows: Dict[str, BorrowRecord] = self._load_borrows()
        self.problems: Dict[str, ProblemRecord] = self._load_problems()
    
    def _load_props(self) -> Dict[str, Prop]:
        if not os.path.exists(self.props_file):
            return {}
        with open(self.props_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        props = {}
        for prop_id, prop_data in data.items():
            props[prop_id] = Prop(
                prop_id=prop_data['prop_id'],
                name=prop_data['name'],
                category=prop_data['category'],
                value=prop_data['value'],
                deposit_rate=prop_data['deposit_rate'],
                status=PropStatus(prop_data['status']),
                location=prop_data.get('location', ''),
                description=prop_data.get('description', ''),
                created_at=datetime.fromisoformat(prop_data['created_at']),
                last_updated=datetime.fromisoformat(prop_data['last_updated'])
            )
        return props
    
    def _load_borrows(self) -> Dict[str, BorrowRecord]:
        if not os.path.exists(self.borrows_file):
            return {}
        with open(self.borrows_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        borrows = {}
        for borrow_id, borrow_data in data.items():
            borrows[borrow_id] = BorrowRecord(
                borrow_id=borrow_data['borrow_id'],
                prop_id=borrow_data['prop_id'],
                crew_name=borrow_data['crew_name'],
                borrow_date=date.fromisoformat(borrow_data['borrow_date']),
                scheduled_return_date=date.fromisoformat(borrow_data['scheduled_return_date']),
                actual_return_date=date.fromisoformat(borrow_data['actual_return_date']) if borrow_data.get('actual_return_date') else None,
                required_deposit=borrow_data.get('required_deposit', 0.0),
                deposit_paid=borrow_data.get('deposit_paid', 0.0),
                status=BorrowStatus(borrow_data['status']),
                damage_level=DamageLevel(borrow_data.get('damage_level', 'none')),
                damage_fee=borrow_data.get('damage_fee', 0.0),
                delay_fee=borrow_data.get('delay_fee', 0.0),
                refund_amount=borrow_data.get('refund_amount', 0.0),
                notes=borrow_data.get('notes', ''),
                created_at=datetime.fromisoformat(borrow_data['created_at']),
                last_updated=datetime.fromisoformat(borrow_data['last_updated'])
            )
        return borrows
    
    def _load_problems(self) -> Dict[str, ProblemRecord]:
        if not os.path.exists(self.problems_file):
            return {}
        with open(self.problems_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        problems = {}
        for problem_id, problem_data in data.items():
            problems[problem_id] = ProblemRecord(
                problem_id=problem_data['problem_id'],
                source_file=problem_data['source_file'],
                line_number=problem_data['line_number'],
                data=problem_data['data'],
                error_type=problem_data['error_type'],
                error_message=problem_data['error_message'],
                fixed=problem_data.get('fixed', False),
                created_at=datetime.fromisoformat(problem_data['created_at'])
            )
        return problems
    
    def _save_props(self):
        data = {}
        for prop_id, prop in self.props.items():
            data[prop_id] = {
                'prop_id': prop.prop_id,
                'name': prop.name,
                'category': prop.category,
                'value': prop.value,
                'deposit_rate': prop.deposit_rate,
                'status': prop.status.value,
                'location': prop.location,
                'description': prop.description,
                'created_at': prop.created_at.isoformat(),
                'last_updated': prop.last_updated.isoformat()
            }
        with open(self.props_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _save_borrows(self):
        data = {}
        for borrow_id, borrow in self.borrows.items():
            data[borrow_id] = {
                'borrow_id': borrow.borrow_id,
                'prop_id': borrow.prop_id,
                'crew_name': borrow.crew_name,
                'borrow_date': borrow.borrow_date.isoformat(),
                'scheduled_return_date': borrow.scheduled_return_date.isoformat(),
                'actual_return_date': borrow.actual_return_date.isoformat() if borrow.actual_return_date else None,
                'required_deposit': borrow.required_deposit,
                'deposit_paid': borrow.deposit_paid,
                'status': borrow.status.value,
                'damage_level': borrow.damage_level.value,
                'damage_fee': borrow.damage_fee,
                'delay_fee': borrow.delay_fee,
                'refund_amount': borrow.refund_amount,
                'notes': borrow.notes,
                'created_at': borrow.created_at.isoformat(),
                'last_updated': borrow.last_updated.isoformat()
            }
        with open(self.borrows_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _save_problems(self):
        data = {}
        for problem_id, problem in self.problems.items():
            data[problem_id] = {
                'problem_id': problem.problem_id,
                'source_file': problem.source_file,
                'line_number': problem.line_number,
                'data': problem.data,
                'error_type': problem.error_type,
                'error_message': problem.error_message,
                'fixed': problem.fixed,
                'created_at': problem.created_at.isoformat()
            }
        with open(self.problems_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def save_all(self):
        self._save_props()
        self._save_borrows()
        self._save_problems()
    
    def add_prop(self, prop: Prop) -> Prop:
        if prop.prop_id in self.props:
            raise ValueError(f"道具ID {prop.prop_id} 已存在")
        self.props[prop.prop_id] = prop
        self._save_props()
        return prop
    
    def update_prop(self, prop: Prop) -> Prop:
        if prop.prop_id not in self.props:
            raise ValueError(f"道具ID {prop.prop_id} 不存在")
        prop.last_updated = datetime.now()
        self.props[prop.prop_id] = prop
        self._save_props()
        return prop
    
    def get_prop(self, prop_id: str) -> Optional[Prop]:
        return self.props.get(prop_id)
    
    def get_all_props(self) -> List[Prop]:
        return list(self.props.values())
    
    def add_borrow(self, borrow: BorrowRecord) -> BorrowRecord:
        if borrow.borrow_id in self.borrows:
            raise ValueError(f"借用单ID {borrow.borrow_id} 已存在")
        self.borrows[borrow.borrow_id] = borrow
        self._save_borrows()
        return borrow
    
    def update_borrow(self, borrow: BorrowRecord) -> BorrowRecord:
        if borrow.borrow_id not in self.borrows:
            raise ValueError(f"借用单ID {borrow.borrow_id} 不存在")
        borrow.last_updated = datetime.now()
        self.borrows[borrow.borrow_id] = borrow
        self._save_borrows()
        return borrow
    
    def get_borrow(self, borrow_id: str) -> Optional[BorrowRecord]:
        return self.borrows.get(borrow_id)
    
    def get_all_borrows(self) -> List[BorrowRecord]:
        return list(self.borrows.values())
    
    def get_borrows_by_prop(self, prop_id: str) -> List[BorrowRecord]:
        return [b for b in self.borrows.values() if b.prop_id == prop_id]
    
    def add_problem(self, problem: ProblemRecord) -> ProblemRecord:
        self.problems[problem.problem_id] = problem
        self._save_problems()
        return problem
    
    def get_all_problems(self, include_fixed: bool = False) -> List[ProblemRecord]:
        if include_fixed:
            return list(self.problems.values())
        return [p for p in self.problems.values() if not p.fixed]
    
    def mark_problem_fixed(self, problem_id: str):
        if problem_id in self.problems:
            self.problems[problem_id].fixed = True
            self._save_problems()
