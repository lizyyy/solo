from datetime import datetime, timedelta
from models import db, Repair, RepairStatus, OperationType, OperationLog, PumpRoom, Reinspection, BatchOperation
import uuid
import json

class RepairService:
    REPEAT_REPAIR_HOURS = 24
    
    @staticmethod
    def check_duplicate_repair(pump_room_id, problem_type, description):
        cutoff_time = datetime.utcnow() - timedelta(hours=RepairService.REPEAT_REPAIR_HOURS)
        duplicates = Repair.query.filter(
            Repair.pump_room_id == pump_room_id,
            Repair.problem_type == problem_type,
            Repair.created_at >= cutoff_time,
            Repair.status != RepairStatus.CLOSED
        ).all()
        
        return len(duplicates) > 0, duplicates
    
    @staticmethod
    def create_repair(pump_room_id, report_source, problem_type, description, reporter, reporter_phone, operator='system'):
        is_duplicate, duplicates = RepairService.check_duplicate_repair(pump_room_id, problem_type, description)
        
        if is_duplicate:
            return {
                'success': False,
                'error': 'DUPLICATE_REPAIR',
                'message': f'该泵房在{RepairService.REPEAT_REPAIR_HOURS}小时内已有同类报修',
                'duplicate_ids': [d.id for d in duplicates]
            }
        
        repair = Repair(
            pump_room_id=pump_room_id,
            report_source=report_source,
            problem_type=problem_type,
            description=description,
            reporter=reporter,
            reporter_phone=reporter_phone
        )
        db.session.add(repair)
        db.session.flush()
        
        log = OperationLog(
            repair_id=repair.id,
            operation_type=OperationType.CREATE,
            operator=operator,
            reason='正常报修',
            details=f'创建报修单: {problem_type}'
        )
        db.session.add(log)
        db.session.commit()
        
        return {'success': True, 'data': repair.to_dict()}
    
    @staticmethod
    def assign_repair(repair_id, staff_id, operator='system'):
        repair = Repair.query.get(repair_id)
        if not repair:
            return {'success': False, 'error': 'NOT_FOUND', 'message': '报修单不存在'}
        
        if repair.status not in [RepairStatus.PENDING, RepairStatus.ESCALATED]:
            return {'success': False, 'error': 'INVALID_STATUS', 'message': '当前状态不可派工'}
        
        if repair.assigned_to == staff_id:
            return {'success': True, 'data': repair.to_dict(), 'message': '已派工给该人员，无需重复操作'}
        
        repair.assigned_to = staff_id
        repair.assigned_at = datetime.utcnow()
        repair.status = RepairStatus.ASSIGNED
        
        log = OperationLog(
            repair_id=repair.id,
            operation_type=OperationType.ASSIGN,
            operator=operator,
            reason='正常派工',
            details=f'派工给人员ID: {staff_id}'
        )
        db.session.add(log)
        db.session.commit()
        
        return {'success': True, 'data': repair.to_dict()}
    
    @staticmethod
    def mark_arrived(repair_id, operator='system'):
        repair = Repair.query.get(repair_id)
        if not repair:
            return {'success': False, 'error': 'NOT_FOUND', 'message': '报修单不存在'}
        
        if repair.status not in [RepairStatus.ASSIGNED]:
            return {'success': False, 'error': 'INVALID_STATUS', 'message': '当前状态不可标记到场'}
        
        if repair.arrived_at:
            return {'success': True, 'data': repair.to_dict(), 'message': '已标记到场，无需重复操作'}
        
        repair.arrived_at = datetime.utcnow()
        repair.status = RepairStatus.ARRIVED
        
        log = OperationLog(
            repair_id=repair.id,
            operation_type=OperationType.ARRIVE,
            operator=operator,
            reason='到场处理',
            details=f'到场时间: {repair.arrived_at.isoformat()}'
        )
        db.session.add(log)
        db.session.commit()
        
        return {'success': True, 'data': repair.to_dict()}
    
    @staticmethod
    def reinspect(repair_id, inspector, result, description, is_passed, operator='system'):
        repair = Repair.query.get(repair_id)
        if not repair:
            return {'success': False, 'error': 'NOT_FOUND', 'message': '报修单不存在'}
        
        if repair.status not in [RepairStatus.ARRIVED, RepairStatus.REINSPECTING]:
            return {'success': False, 'error': 'INVALID_STATUS', 'message': '当前状态不可复测'}
        
        reinspection = Reinspection(
            repair_id=repair_id,
            inspector=inspector,
            result=result,
            description=description,
            is_passed=is_passed
        )
        db.session.add(reinspection)
        
        if is_passed:
            repair.status = RepairStatus.REINSPECTING
        else:
            repair.status = RepairStatus.ARRIVED
        
        log = OperationLog(
            repair_id=repair.id,
            operation_type=OperationType.REINSPECT,
            operator=operator,
            reason=f'复测结果: {"通过" if is_passed else "不通过"}',
            details=description
        )
        db.session.add(log)
        db.session.commit()
        
        return {'success': True, 'data': {'repair': repair.to_dict(), 'reinspection': reinspection.to_dict()}}
    
    @staticmethod
    def close_repair(repair_id, operator='system'):
        repair = Repair.query.get(repair_id)
        if not repair:
            return {'success': False, 'error': 'NOT_FOUND', 'message': '报修单不存在'}
        
        if repair.status not in [RepairStatus.REINSPECTING]:
            return {'success': False, 'error': 'INVALID_STATUS', 'message': '当前状态不可关闭，需先复测通过'}
        
        if repair.closed_at:
            return {'success': True, 'data': repair.to_dict(), 'message': '已关闭，无需重复操作'}
        
        repair.closed_at = datetime.utcnow()
        repair.status = RepairStatus.CLOSED
        
        log = OperationLog(
            repair_id=repair.id,
            operation_type=OperationType.CLOSE,
            operator=operator,
            reason='复测通过，正常关闭',
            details='工单完成关闭'
        )
        db.session.add(log)
        db.session.commit()
        
        return {'success': True, 'data': repair.to_dict()}
    
    @staticmethod
    def escalate_if_timeout(timeout_hours=4):
        now = datetime.utcnow()
        cutoff_time = now - timedelta(hours=timeout_hours)
        repairs = Repair.query.filter(
            Repair.status.in_([RepairStatus.PENDING, RepairStatus.ASSIGNED, RepairStatus.ARRIVED]),
            Repair.created_at < cutoff_time,
            Repair.escalation_level < 3
        ).all()
        
        escalated = []
        for repair in repairs:
            repair.status = RepairStatus.ESCALATED
            repair.escalated_at = now
            repair.escalation_level += 1
            
            log = OperationLog(
                repair_id=repair.id,
                operation_type=OperationType.ESCALATE,
                operator='system',
                reason=f'超时{timeout_hours}小时未处理',
                details=f'升级至级别: {repair.escalation_level}'
            )
            db.session.add(log)
            escalated.append(repair.to_dict())
        
        db.session.commit()
        return escalated

class BatchService:
    @staticmethod
    def batch_operation(operation_type, items, processor, operator='system'):
        batch_id = str(uuid.uuid4())
        
        batch = BatchOperation(
            batch_id=batch_id,
            operation_type=operation_type,
            total_count=len(items)
        )
        db.session.add(batch)
        db.session.flush()
        
        success_count = 0
        fail_count = 0
        success_ids = []
        fail_details = []
        
        for i, item in enumerate(items):
            try:
                result = processor(item, operator, batch_id)
                if result.get('success'):
                    success_count += 1
                    if 'data' in result and 'id' in result['data']:
                        success_ids.append(result['data']['id'])
                else:
                    fail_count += 1
                    fail_details.append({
                        'index': i,
                        'item': item,
                        'error': result.get('error'),
                        'message': result.get('message')
                    })
            except Exception as e:
                fail_count += 1
                fail_details.append({
                    'index': i,
                    'item': item,
                    'error': 'EXCEPTION',
                    'message': str(e)
                })
        
        batch.success_count = success_count
        batch.fail_count = fail_count
        batch.success_ids = json.dumps(success_ids)
        batch.fail_details = json.dumps(fail_details, ensure_ascii=False)
        batch.completed_at = datetime.utcnow()
        db.session.commit()
        
        return {
            'batch_id': batch_id,
            'total': len(items),
            'success': success_count,
            'fail': fail_count,
            'success_ids': success_ids,
            'fail_details': fail_details
        }
    
    @staticmethod
    def batch_create_processor(item, operator, batch_id):
        return RepairService.create_repair(
            pump_room_id=item.get('pump_room_id'),
            report_source=item.get('report_source'),
            problem_type=item.get('problem_type'),
            description=item.get('description'),
            reporter=item.get('reporter'),
            reporter_phone=item.get('reporter_phone'),
            operator=operator
        )
    
    @staticmethod
    def batch_assign_processor(item, operator, batch_id):
        return RepairService.assign_repair(
            repair_id=item.get('repair_id'),
            staff_id=item.get('staff_id'),
            operator=operator
        )
