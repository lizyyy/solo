from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from pathlib import Path
import csv
import json
import uuid

from .database import DatabaseManager
from .models import (
    Dormitory, RepairPerson, Material, RepairOrder, MaterialUsage,
    ImportRecord, RepairStatus, ResponsibilityType, FollowUpResult
)


REPEAT_WINDOW_DAYS = 30
REPEAT_SIMILARITY_THRESHOLD = 0.4
CATEGORIES = {
    'plumbing': ['水龙头', '水管', '漏水', '下水道', '花洒', '马桶'],
    'door_lock': ['门锁', '钥匙', '门把', '把手', '门禁'],
    'electrical': ['电路', '灯', '插座', '开关', '跳闸', '断电', '空调', '插座'],
    'furniture': ['床', '桌子', '椅子', '衣柜', '柜子', '家具', '书架', '抽屉'],
    'environment': ['清洁', '消毒', '蟑螂', '老鼠', '异味', '窗户', '玻璃'],
}

STUDENT_RESPONSIBLE_KEYWORDS = [
    '撞坏', '打碎', '踢坏', '弄坏', '人为', '故意', '打架', '喝酒', '醉酒',
    '烟头', '香烟', '私拉', '乱接', '改装', '违规', '超重', '砸坏', '摔碎',
]

NATURAL_DAMAGE_KEYWORDS = [
    '老化', '自然', '磨损', '锈蚀', '松动', '脱落', '年久', '正常使用',
    '使用寿命', '疲劳', '变形', '裂痕', '漏水', '渗水', '滴漏',
]


def classify_category(description: str) -> str:
    desc = description.lower()
    for category, keywords in CATEGORIES.items():
        for kw in keywords:
            if kw in description or kw in desc:
                return category
    return 'other'


def determine_responsibility(description: str, category: Optional[str] = None) -> ResponsibilityType:
    desc = description.lower()
    
    for kw in STUDENT_RESPONSIBLE_KEYWORDS:
        if kw in description or kw in desc:
            return ResponsibilityType.STUDENT_RESPONSIBLE
    
    for kw in NATURAL_DAMAGE_KEYWORDS:
        if kw in description or kw in desc:
            return ResponsibilityType.NATURAL_DAMAGE
    
    if category in ['door_lock']:
        return ResponsibilityType.STUDENT_RESPONSIBLE
    
    return ResponsibilityType.UNDETERMINED


class RepairService:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def _add_history(self, order: RepairOrder, action: str, operator: str, details: Optional[str] = None):
        entry = {
            'timestamp': datetime.now().isoformat(),
            'action': action,
            'operator': operator,
            'details': details or '',
            'status': order.status.value,
            'responsibility': order.responsibility.value,
        }
        order.history.append(entry)

    def create_order(
        self,
        dorm_id: str,
        reporter: str,
        reporter_phone: str,
        description: str,
        submit_time: Optional[datetime] = None,
        operator: str = "system"
    ) -> RepairOrder:
        dorm = self.db.get_dormitory(dorm_id)
        if not dorm:
            raise ValueError(f"宿舍 {dorm_id} 不存在")

        category = classify_category(description)
        responsibility = determine_responsibility(description, category)
        
        order = RepairOrder(
            order_id=f"RO-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8].upper()}",
            dorm_id=dorm_id,
            submit_time=submit_time or datetime.now(),
            reporter=reporter,
            reporter_phone=reporter_phone,
            description=description,
            category=category,
            responsibility=responsibility,
            status=RepairStatus.SUBMITTED
        )
        
        self._add_history(order, '创建报修单', operator, f"描述: {description}")
        
        repeat_check = self.check_repeat_order(order)
        if repeat_check:
            order.is_repeat = True
            order.original_order_id = repeat_check.order_id
            order.status = RepairStatus.REPEAT
            self._add_history(order, '检测为重复报修', operator, f"关联原单: {repeat_check.order_id}")
        
        self.db.save_repair_order(order, operator, reason="创建报修单")
        return order

    def check_repeat_order(self, new_order: RepairOrder) -> Optional[RepairOrder]:
        window_start = new_order.submit_time - timedelta(days=REPEAT_WINDOW_DAYS)
        
        existing = self.db.get_orders_for_dorm_in_period(
            dorm_id=new_order.dorm_id,
            start_time=window_start,
            category=new_order.category
        )
        
        for order in existing:
            if order.order_id == new_order.order_id:
                continue
            if order.status in [RepairStatus.REPEAT]:
                continue
            
            similarity = self._calculate_description_similarity(
                new_order.description, order.description
            )
            if similarity >= REPEAT_SIMILARITY_THRESHOLD:
                return order
        
        return None

    def _calculate_description_similarity(self, desc1: str, desc2: str) -> float:
        def get_char_ngrams(s, n=2):
            s_clean = s.replace('，', '').replace('。', '').replace(',', '').replace(' ', '')
            if len(s_clean) < n:
                return set(s_clean)
            return set(s_clean[i:i+n] for i in range(len(s_clean) - n + 1))
        
        tokens1 = get_char_ngrams(desc1)
        tokens2 = get_char_ngrams(desc2)
        
        if not tokens1 or not tokens2:
            return 0.0
        
        common = tokens1 & tokens2
        return len(common) / len(tokens1) if tokens1 else 0.0

    def assign_order(
        self,
        order_id: str,
        staff_id: str,
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status not in [RepairStatus.SUBMITTED, RepairStatus.REPEAT]:
            raise ValueError(f"报修单当前状态 {order.status.value} 不能分配，需为 submitted 或 repeat")
        
        person = self.db.get_repair_person(staff_id)
        if not person:
            raise ValueError(f"维修人员 {staff_id} 不存在")
        
        order.assigned_to = staff_id
        order.status = RepairStatus.ASSIGNED
        self._add_history(order, '分配维修人员', operator, f"分配给: {person.name}({staff_id})")
        
        self.db.save_repair_order(order, operator, reason="分配维修人员")
        return order

    def start_repair(
        self,
        order_id: str,
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status != RepairStatus.ASSIGNED:
            raise ValueError(f"报修单当前状态 {order.status.value} 不能开始维修，需为 assigned")
        
        if not order.assigned_to:
            raise ValueError("报修单未分配维修人员")
        
        order.status = RepairStatus.IN_PROGRESS
        order.start_time = datetime.now()
        self._add_history(order, '开始维修', operator)
        
        self.db.save_repair_order(order, operator, reason="开始维修")
        return order

    def add_material(
        self,
        order_id: str,
        material_id: str,
        quantity: float,
        operator: str = "system"
    ) -> Tuple[RepairOrder, MaterialUsage]:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status not in [RepairStatus.IN_PROGRESS, RepairStatus.ASSIGNED]:
            raise ValueError(f"报修单当前状态 {order.status.value} 不能添加材料")
        
        material = self.db.get_material(material_id)
        if not material:
            raise ValueError(f"材料 {material_id} 不存在")
        
        if material.current_stock < quantity:
            raise ValueError(
                f"材料 {material.name} 库存不足: 当前 {material.current_stock}{material.unit}，需要 {quantity}{material.unit}"
            )
        
        existing = next((m for m in order.materials if m['material_id'] == material_id), None)
        if existing:
            raise ValueError(f"材料 {material.name} 已在该报修单中，如需调整请使用 update_material")
        
        total_cost = material.unit_price * quantity
        
        usage = MaterialUsage(
            order_id=order_id,
            material_id=material_id,
            material_name=material.name,
            quantity=quantity,
            unit_price=material.unit_price,
            total_cost=total_cost,
            timestamp=datetime.now(),
            operator=operator
        )
        
        order.materials.append({
            'material_id': material_id,
            'material_name': material.name,
            'quantity': quantity,
            'unit': material.unit,
            'unit_price': material.unit_price,
            'total_cost': total_cost,
            'timestamp': datetime.now().isoformat()
        })
        
        material.current_stock -= quantity
        self.db.save_material(material, operator)
        self.db.save_material_usage(usage)
        
        self._add_history(order, '添加维修材料', operator, f"{material.name} x {quantity}{material.unit}")
        self.db.save_repair_order(order, operator, reason="添加材料")
        
        return order, usage

    def complete_repair(
        self,
        order_id: str,
        repairs: List[str],
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status != RepairStatus.IN_PROGRESS:
            raise ValueError(f"报修单当前状态 {order.status.value} 不能完成维修，需为 in_progress")
        
        order.status = RepairStatus.COMPLETED
        order.complete_time = datetime.now()
        order.repairs = repairs
        
        if order.responsibility == ResponsibilityType.STUDENT_RESPONSIBLE:
            total_material_cost = sum(m['total_cost'] for m in order.materials)
            order.student_fee = total_material_cost
        
        self._add_history(
            order, '完成维修', operator,
            f"维修内容: {'; '.join(repairs)}; 学生费用: ¥{order.student_fee:.2f}"
        )
        self.db.save_repair_order(order, operator, reason="完成维修")
        return order

    def do_follow_up(
        self,
        order_id: str,
        result: FollowUpResult,
        remarks: Optional[str] = None,
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status != RepairStatus.COMPLETED:
            raise ValueError(f"报修单当前状态 {order.status.value} 不能回访，需为 completed")
        
        order.follow_up_result = result
        order.follow_up_time = datetime.now()
        order.follow_up_remarks = remarks
        order.status = RepairStatus.FOLLOWED_UP
        
        result_desc = {
            FollowUpResult.SATISFIED: '满意',
            FollowUpResult.NEEDS_REWORK: '需返工',
            FollowUpResult.UNCONFIRMED: '未确认',
            FollowUpResult.NOT_ATTEMPTED: '未回访'
        }
        
        self._add_history(
            order, '完成回访', operator,
            f"回访结果: {result_desc.get(result, result.value)}; 备注: {remarks or ''}"
        )
        self.db.save_repair_order(order, operator, reason="完成回访")
        return order

    def close_order(
        self,
        order_id: str,
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.status == RepairStatus.CLOSED:
            return order
        
        if order.status != RepairStatus.FOLLOWED_UP:
            raise ValueError(
                f"报修单当前状态 {order.status.value} 不能关闭，需先完成回访 (followed_up)"
            )
        
        if order.follow_up_result in [FollowUpResult.NEEDS_REWORK, FollowUpResult.UNCONFIRMED]:
            raise ValueError(
                f"回访结果为 {order.follow_up_result.value}，不能关闭订单"
            )
        
        order.status = RepairStatus.CLOSED
        order.close_time = datetime.now()
        self._add_history(order, '关闭报修单', operator)
        self.db.save_repair_order(order, operator, reason="关闭报修单")
        return order

    def manual_update_responsibility(
        self,
        order_id: str,
        responsibility: ResponsibilityType,
        reason: str,
        operator: str = "system"
    ) -> RepairOrder:
        order = self.db.get_repair_order(order_id)
        if not order:
            raise ValueError(f"报修单 {order_id} 不存在")
        
        if order.responsibility == responsibility:
            return order
        
        old_resp = order.responsibility
        order.responsibility = responsibility
        
        if responsibility == ResponsibilityType.STUDENT_RESPONSIBLE:
            total_material_cost = sum(m['total_cost'] for m in order.materials)
            order.student_fee = total_material_cost
        elif old_resp == ResponsibilityType.STUDENT_RESPONSIBLE:
            order.student_fee = 0.0
        
        self._add_history(
            order, '人工修改责任类型', operator,
            f"从 {old_resp.value} 改为 {responsibility.value}; 原因: {reason}"
        )
        self.db.save_repair_order(order, operator, reason=f"人工修改: {reason}")
        return order

    def get_order_detail(self, order_id: str) -> Optional[Dict[str, Any]]:
        order = self.db.get_repair_order(order_id)
        if not order:
            return None
        
        dorm = self.db.get_dormitory(order.dorm_id)
        person = self.db.get_repair_person(order.assigned_to) if order.assigned_to else None
        material_usages = self.db.list_material_usage(order_id)
        audit_logs = self.db.get_audit_logs(order_id, 'repair_order')
        
        processing_time = None
        if order.start_time and order.complete_time:
            processing_time = (order.complete_time - order.start_time).total_seconds() / 3600
        
        total_cost = sum(m['total_cost'] for m in order.materials)
        
        return {
            'order': order,
            'dormitory': dorm,
            'repair_person': person,
            'material_usages': material_usages,
            'audit_logs': audit_logs,
            'processing_hours': processing_time,
            'total_material_cost': total_cost,
        }

    def run_checks(self) -> Dict[str, Any]:
        all_orders = self.db.list_repair_orders()
        materials = self.db.list_materials()
        dorms = self.db.list_dormitories()
        
        issues = []
        warnings = []
        
        for order in all_orders:
            if order.status == RepairStatus.COMPLETED:
                if not order.follow_up_time:
                    days_since = (datetime.now() - order.submit_time).days
                    if days_since > 7:
                        issues.append({
                            'type': 'missing_followup',
                            'order_id': order.order_id,
                            'dorm_id': order.dorm_id,
                            'message': f"完成维修超过7天未回访 ({days_since}天)"
                        })
            
            if order.status in [RepairStatus.SUBMITTED, RepairStatus.REPEAT]:
                days_since = (datetime.now() - order.submit_time).days
                if days_since > 3:
                    warnings.append({
                        'type': 'unassigned',
                        'order_id': order.order_id,
                        'dorm_id': order.dorm_id,
                        'message': f"提交超过3天未分配 ({days_since}天)"
                    })
        
        low_stock = []
        for m in materials:
            if m.current_stock <= m.min_stock:
                low_stock.append({
                    'material_id': m.material_id,
                    'name': m.name,
                    'current': m.current_stock,
                    'min': m.min_stock,
                    'unit': m.unit
                })
        
        return {
            'total_orders': len(all_orders),
            'open_orders': len([o for o in all_orders if o.status not in [RepairStatus.CLOSED]]),
            'closed_orders': len([o for o in all_orders if o.status == RepairStatus.CLOSED]),
            'issues': issues,
            'warnings': warnings,
            'low_stock_materials': low_stock,
            'needs_counselor_followup': self._get_counselor_followup_rooms(all_orders, dorms)
        }

    def _get_counselor_followup_rooms(
        self,
        orders: List[RepairOrder],
        dorms: List[Dormitory]
    ) -> List[Dict[str, Any]]:
        dorm_map = {d.dorm_id: d for d in dorms}
        result = []
        
        for order in orders:
            if order.status != RepairStatus.COMPLETED:
                continue
            if order.responsibility != ResponsibilityType.STUDENT_RESPONSIBLE:
                continue
            if order.student_fee <= 0:
                continue
            
            dorm = dorm_map.get(order.dorm_id)
            result.append({
                'order_id': order.order_id,
                'dorm_id': order.dorm_id,
                'building': dorm.building if dorm else 'N/A',
                'room': dorm.room_number if dorm else 'N/A',
                'counselor': dorm.counselor if dorm else '未指定',
                'fee': order.student_fee,
                'description': order.description,
                'reporter': order.reporter
            })
        
        return result

    def generate_report(self) -> Dict[str, Any]:
        all_orders = self.db.list_repair_orders()
        dorms = self.db.list_dormitories()
        materials = self.db.list_materials()
        material_usage = self.db.list_material_usage()
        
        buildings = sorted(set(d.building for d in dorms))
        
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_orders': len(all_orders),
                'closed': len([o for o in all_orders if o.status == RepairStatus.CLOSED]),
                'in_progress': len([o for o in all_orders if o.status == RepairStatus.IN_PROGRESS]),
                'pending': len([o for o in all_orders if o.status in [
                    RepairStatus.SUBMITTED, RepairStatus.REPEAT, RepairStatus.ASSIGNED
                ]]),
                'followup_needed': len([o for o in all_orders if o.status == RepairStatus.COMPLETED]),
                'repeat_orders': len([o for o in all_orders if o.is_repeat]),
            },
            'by_building': self._group_by_building(all_orders, dorms),
            'by_responsibility': self._group_by_responsibility(all_orders),
            'by_followup': self._group_by_followup(all_orders),
            'material_costs': self._calculate_material_costs(all_orders, material_usage),
            'processing_times': self._calculate_processing_times(all_orders),
            'unclosed_items': self._get_unclosed_items(all_orders, dorms),
            'counselor_actions': self._get_counselor_actions(all_orders, dorms),
        }
        
        return report

    def _group_by_building(self, orders: List[RepairOrder], dorms: List[Dormitory]) -> Dict[str, Any]:
        dorm_map = {d.dorm_id: d for d in dorms}
        result = {}
        
        for order in orders:
            dorm = dorm_map.get(order.dorm_id)
            building = dorm.building if dorm else '未知楼栋'
            
            if building not in result:
                result[building] = {
                    'total': 0,
                    'closed': 0,
                    'natural_damage': 0,
                    'student_responsible': 0,
                    'undetermined': 0,
                    'material_cost': 0.0,
                    'student_fees': 0.0,
                    'rooms': set()
                }
            
            b = result[building]
            b['total'] += 1
            if order.status == RepairStatus.CLOSED:
                b['closed'] += 1
            if order.responsibility == ResponsibilityType.NATURAL_DAMAGE:
                b['natural_damage'] += 1
            elif order.responsibility == ResponsibilityType.STUDENT_RESPONSIBLE:
                b['student_responsible'] += 1
            else:
                b['undetermined'] += 1
            b['material_cost'] += sum(m['total_cost'] for m in order.materials)
            b['student_fees'] += order.student_fee
            b['rooms'].add(order.dorm_id)
        
        for b in result.values():
            b['unique_rooms'] = len(b['rooms'])
            del b['rooms']
        
        return result

    def _group_by_responsibility(self, orders: List[RepairOrder]) -> Dict[str, Any]:
        result = {
            'natural_damage': {'count': 0, 'cost': 0.0, 'closed': 0},
            'student_responsible': {'count': 0, 'cost': 0.0, 'fees': 0.0, 'closed': 0},
            'undetermined': {'count': 0, 'cost': 0.0, 'closed': 0},
        }
        
        for order in orders:
            key = order.responsibility.value
            if key not in result:
                continue
            r = result[key]
            r['count'] += 1
            r['cost'] += sum(m['total_cost'] for m in order.materials)
            if 'fees' in r:
                r['fees'] += order.student_fee
            if order.status == RepairStatus.CLOSED:
                r['closed'] += 1
        
        return result

    def _group_by_followup(self, orders: List[RepairOrder]) -> Dict[str, int]:
        result = {
            'satisfied': 0,
            'needs_rework': 0,
            'unconfirmed': 0,
            'not_attempted': 0
        }
        for order in orders:
            result[order.follow_up_result.value] = result.get(order.follow_up_result.value, 0) + 1
        return result

    def _calculate_material_costs(
        self,
        orders: List[RepairOrder],
        usage: List[MaterialUsage]
    ) -> Dict[str, Any]:
        by_category = {}
        by_material = {}
        
        for u in usage:
            name = u.material_name
            if name not in by_material:
                by_material[name] = {'quantity': 0.0, 'cost': 0.0, 'unit': '个'}
            by_material[name]['quantity'] += u.quantity
            by_material[name]['cost'] += u.total_cost
        
        return {
            'total_cost': sum(u.total_cost for u in usage),
            'by_material': by_material,
        }

    def _calculate_processing_times(self, orders: List[RepairOrder]) -> Dict[str, Any]:
        times = []
        for order in orders:
            if order.start_time and order.complete_time:
                hours = (order.complete_time - order.start_time).total_seconds() / 3600
                times.append(hours)
        
        if not times:
            return {'avg_hours': 0, 'min_hours': 0, 'max_hours': 0, 'count': 0}
        
        return {
            'count': len(times),
            'avg_hours': round(sum(times) / len(times), 2),
            'min_hours': round(min(times), 2),
            'max_hours': round(max(times), 2)
        }

    def _get_unclosed_items(
        self,
        orders: List[RepairOrder],
        dorms: List[Dormitory]
    ) -> List[Dict[str, Any]]:
        dorm_map = {d.dorm_id: d for d in dorms}
        result = []
        
        for order in orders:
            if order.status == RepairStatus.CLOSED:
                continue
            
            dorm = dorm_map.get(order.dorm_id)
            days_waiting = (datetime.now() - order.submit_time).days
            
            result.append({
                'order_id': order.order_id,
                'building': dorm.building if dorm else '未知',
                'room': dorm.room_number if dorm else '未知',
                'status': order.status.value,
                'responsibility': order.responsibility.value,
                'description': order.description,
                'days_waiting': days_waiting,
                'reporter': order.reporter
            })
        
        return sorted(result, key=lambda x: x['days_waiting'], reverse=True)

    def _get_counselor_actions(
        self,
        orders: List[RepairOrder],
        dorms: List[Dormitory]
    ) -> List[Dict[str, Any]]:
        return self._get_counselor_followup_rooms(orders, dorms)


class ImportService:
    def __init__(self, db: DatabaseManager):
        self.db = db

    def import_csv(self, file_type: str, file_path: Path, operator: str = "system") -> ImportRecord:
        if not file_path.exists():
            raise ValueError(f"文件不存在: {file_path}")
        
        errors = []
        success_count = 0
        total_count = 0
        
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            total_count = len(rows)
            
            for i, row in enumerate(rows, 1):
                try:
                    if file_type == 'dormitories':
                        self._import_dormitory(row)
                    elif file_type == 'repair_persons':
                        self._import_repair_person(row)
                    elif file_type == 'materials':
                        self._import_material(row)
                    elif file_type == 'repair_orders':
                        self._import_repair_order(row)
                    elif file_type == 'material_usage':
                        self._import_material_usage(row, operator)
                    else:
                        raise ValueError(f"未知文件类型: {file_type}")
                    success_count += 1
                except Exception as e:
                    errors.append({
                        'row': i,
                        'error': str(e),
                        'data': dict(row)
                    })
        
        self.db.commit()
        
        record = ImportRecord(
            import_id=str(uuid.uuid4()),
            import_time=datetime.now(),
            file_type=file_type,
            file_name=file_path.name,
            total_count=total_count,
            success_count=success_count,
            failed_count=len(errors),
            operator=operator,
            errors=errors
        )
        self.db.save_import_record(record)
        
        return record

    def _import_dormitory(self, row: Dict[str, str]):
        dorm = Dormitory(
            dorm_id=row['dorm_id'],
            building=row['building'],
            room_number=row['room_number'],
            floor=int(row['floor']),
            capacity=int(row['capacity']),
            students=json.loads(row.get('students', '[]') or '[]'),
            counselor=row.get('counselor'),
            remarks=row.get('remarks')
        )
        self.db.save_dormitory(dorm)

    def _import_repair_person(self, row: Dict[str, str]):
        person = RepairPerson(
            staff_id=row['staff_id'],
            name=row['name'],
            phone=row['phone'],
            skills=json.loads(row.get('skills', '[]') or '[]'),
            work_area=json.loads(row.get('work_area', '[]') or '[]')
        )
        self.db.save_repair_person(person)

    def _import_material(self, row: Dict[str, str]):
        material = Material(
            material_id=row['material_id'],
            name=row['name'],
            unit=row['unit'],
            unit_price=float(row['unit_price']),
            current_stock=float(row['current_stock']),
            min_stock=float(row.get('min_stock', '0')),
            category=row.get('category')
        )
        self.db.save_material(material)

    def _import_repair_order(self, row: Dict[str, str]):
        from datetime import datetime
        from dateutil import parser
        
        submit_time = parser.parse(row['submit_time']) if row.get('submit_time') else datetime.now()
        
        existing = self.db.get_repair_order(row['order_id'])
        if existing:
            return
        
        service = RepairService(self.db)
        order = service.create_order(
            dorm_id=row['dorm_id'],
            reporter=row['reporter'],
            reporter_phone=row['reporter_phone'],
            description=row['description'],
            submit_time=submit_time
        )
        
        if row.get('order_id'):
            order.order_id = row['order_id']
        
        if row.get('category'):
            order.category = row['category']
        
        self.db.save_repair_order(order)

    def _import_material_usage(self, row: Dict[str, str], operator: str):
        service = RepairService(self.db)
        service.add_material(
            order_id=row['order_id'],
            material_id=row['material_id'],
            quantity=float(row['quantity']),
            operator=operator
        )
