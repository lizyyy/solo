from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Form
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.models import Sample, TestItem, TestResult, RetestRule
from app.schemas import ProcessResponse
from app.utils.file_parser import parse_csv_file, parse_json_file, parse_date, generate_report_no
from app.rules.engine import RuleEngine

router = APIRouter(prefix='/api', tags=['samples'])

class RetestRuleCreate(BaseModel):
    rule_name: str
    rule_code: str
    rule_type: Optional[str] = None
    description: Optional[str] = None
    condition_expr: Optional[str] = None
    action_expr: Optional[str] = None
    priority: Optional[int] = 0
    is_active: Optional[bool] = True
    retest_window_days: Optional[int] = None
    max_retest_count: Optional[int] = 1
    parameter_json: Optional[str] = None

class RetestRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    rule_code: Optional[str] = None
    rule_type: Optional[str] = None
    description: Optional[str] = None
    condition_expr: Optional[str] = None
    action_expr: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None
    retest_window_days: Optional[int] = None
    max_retest_count: Optional[int] = None
    parameter_json: Optional[str] = None

@router.post('/process', response_model=ProcessResponse)
async def process_samples(
    samples_file: UploadFile = File(...),
    test_items_file: UploadFile = File(...),
    operator: str = Form('system'),
    db: Session = Depends(get_db)
):
    samples_content = await samples_file.read()
    samples_data = parse_csv_file(samples_content)
    
    test_items_content = await test_items_file.read()
    test_items_data = parse_json_file(test_items_content)
    
    engine = RuleEngine(db)
    
    normal_items = []
    pending_items = []
    failed_items = []
    
    for idx, sample_data in enumerate(samples_data):
        sample_data['original_line_no'] = idx + 2
        sample_code = sample_data.get('sample_code', '')
        batch_no = sample_data.get('batch_no', '')
        
        sample_test_items = test_items_data.get(sample_code, [])
        result = engine.process_sample(sample_data, sample_test_items)
        
        result_data = {
            'batch_no': batch_no,
            'sample_code': sample_code,
            'sample_name': sample_data.get('sample_name', ''),
            'cooperative': sample_data.get('cooperative', ''),
            'original_data': result.get('sample', sample_data),
            'test_items': result['test_items'],
            'failed_reason': result.get('failed_reason'),
            'suggestion': result.get('suggestion'),
            'rule_triggered': result.get('retest_required', False),
            'original_line_no': result.get('original_line_no'),
            'processed_at': datetime.now().isoformat()
        }
        
        status = result.get('status', 'normal')
        
        if status == 'normal':
            sample_obj = _create_sample_record(db, sample_data, result)
            _create_test_items_records(db, sample_obj.id, result['test_items'])
            test_result = _create_test_result_record(db, sample_obj, result, operator, 'normal')
            result_data['sample_id'] = sample_obj.id
            result_data['report_no'] = test_result.report_no
            normal_items.append(result_data)
        elif status == 'pending':
            sample_obj = _create_sample_record(db, sample_data, result)
            _create_test_items_records(db, sample_obj.id, result['test_items'])
            test_result = _create_test_result_record(db, sample_obj, result, operator, 'pending')
            result_data['sample_id'] = sample_obj.id
            result_data['report_no'] = test_result.report_no
            pending_items.append(result_data)
        else:
            test_result = _create_failed_test_result(db, sample_data, result, operator)
            result_data['report_no'] = test_result.report_no
            failed_items.append(result_data)
    
    db.commit()
    
    return ProcessResponse(
        normal=normal_items,
        pending=pending_items,
        failed=failed_items,
        total_processed=len(samples_data),
        message=f'处理完成: 正常{len(normal_items)}项, 待确认{len(pending_items)}项, 失败{len(failed_items)}项'
    )

def _create_sample_record(db, sample_data, result):
    sample = Sample(
        batch_no=sample_data.get('batch_no', ''),
        cooperative=sample_data.get('cooperative', ''),
        sample_type=sample_data.get('sample_type', ''),
        sample_name=sample_data.get('sample_name', ''),
        sample_code=sample_data.get('sample_code', ''),
        send_date=parse_date(sample_data.get('send_date', '')),
        sender=sample_data.get('sender', ''),
        receiver=sample_data.get('receiver', ''),
        quantity=int(sample_data.get('quantity', 0)) if sample_data.get('quantity') else None,
        unit=sample_data.get('unit', ''),
        production_base=sample_data.get('production_base', ''),
        harvest_date=parse_date(sample_data.get('harvest_date', '')),
        remarks=sample_data.get('remarks', ''),
        mixed_batch_info=','.join(result.get('mixed_batch_types', [])) if result.get('mixed_batch') else None
    )
    db.add(sample)
    db.flush()
    return sample

def _create_test_items_records(db, sample_id, test_items):
    for item in test_items:
        test_item = TestItem(
            sample_id=sample_id,
            item_name=item.get('item_name', ''),
            limit_value=float(item.get('limit_value', 0)) if item.get('limit_value') else None,
            test_value=float(item.get('test_value', 0)) if item.get('test_value') else None
        )
        db.add(test_item)

def _create_test_result_record(db, sample, result, operator, status):
    report_no = generate_report_no()
    test_result = TestResult(
        sample_id=sample.id,
        sample_code=sample.sample_code,
        batch_no=sample.batch_no,
        report_no=report_no,
        status=status,
        result_type=status,
        operator=operator,
        result_summary=result.get('failed_reason', ''),
        original_data=str(result.get('sample', {})),
        failed_reason=result.get('failed_reason', ''),
        suggestion=result.get('suggestion', ''),
        rule_triggered=result.get('retest_required', False),
        retest_count=0,
        is_retest=False
    )
    db.add(test_result)
    db.flush()
    return test_result

def _create_failed_test_result(db, sample_data, result, operator):
    report_no = generate_report_no()
    test_result = TestResult(
        sample_code=sample_data.get('sample_code', ''),
        batch_no=sample_data.get('batch_no', ''),
        report_no=report_no,
        status='failed',
        result_type='failed',
        operator=operator,
        result_summary=result.get('failed_reason', ''),
        original_data=str(sample_data),
        failed_reason=result.get('failed_reason', ''),
        suggestion=result.get('suggestion', ''),
        rule_triggered=result.get('retest_required', False),
        retest_count=0,
        is_retest=False
    )
    db.add(test_result)
    db.flush()
    return test_result

@router.get('/trace/{sample_code}')
async def trace_sample(sample_code: str, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.sample_code == sample_code).first()
    
    if not sample:
        return {
            'sample_code': sample_code,
            'found': False,
            'message': '未找到该样品信息'
        }
    
    test_items = db.query(TestItem).filter(TestItem.sample_id == sample.id).all()
    test_results = db.query(TestResult).filter(TestResult.sample_code == sample_code).order_by(TestResult.created_at.desc()).all()
    
    same_batch_samples = db.query(Sample).filter(
        Sample.batch_no == sample.batch_no,
        Sample.sample_code != sample_code
    ).all()
    
    sample_info = {
        'id': sample.id,
        'batch_no': sample.batch_no,
        'cooperative': sample.cooperative,
        'sample_type': sample.sample_type,
        'sample_name': sample.sample_name,
        'sample_code': sample.sample_code,
        'send_date': sample.send_date.isoformat() if sample.send_date else None,
        'sender': sample.sender,
        'receiver': sample.receiver,
        'quantity': sample.quantity,
        'unit': sample.unit,
        'production_base': sample.production_base,
        'harvest_date': sample.harvest_date.isoformat() if sample.harvest_date else None,
        'remarks': sample.remarks,
        'mixed_batch_info': sample.mixed_batch_info,
        'created_at': sample.created_at.isoformat() if sample.created_at else None
    }
    
    test_items_list = []
    for item in test_items:
        test_items_list.append({
            'id': item.id,
            'item_name': item.item_name,
            'limit_value': item.limit_value,
            'test_value': item.test_value,
            'status': 'normal' if (item.limit_value is None or item.test_value is None or item.test_value <= item.limit_value) else 'failed',
        })
    
    test_results_list = []
    for tr in test_results:
        test_results_list.append({
            'id': tr.id,
            'report_no': tr.report_no,
            'status': tr.status,
            'operator': tr.operator,
            'result_summary': tr.result_summary,
            'is_issued': tr.is_issued,
            'issued_at': tr.issued_at.isoformat() if tr.issued_at else None,
            'is_withdrawn': tr.is_withdrawn,
            'withdrawn_at': tr.withdrawn_at.isoformat() if tr.withdrawn_at else None,
            'withdraw_reason': tr.withdraw_reason,
            'created_at': tr.created_at.isoformat() if tr.created_at else None
        })
    
    same_batch_list = []
    for s in same_batch_samples:
        same_batch_list.append({
            'sample_code': s.sample_code,
            'sample_name': s.sample_name,
            'sample_type': s.sample_type
        })
    
    processing_chain = {
        'sample_reception': {
            'sender': sample.sender,
            'receiver': sample.receiver,
            'receive_date': sample.created_at.isoformat() if sample.created_at else None
        },
        'testing': {
            'test_items_count': len(test_items_list),
            'test_results_count': len(test_results_list),
            'latest_status': test_results_list[0]['status'] if test_results_list else 'unknown'
        },
        'same_batch_count': len(same_batch_list) + 1,
        'same_batch_samples': same_batch_list
    }
    
    return {
        'sample_code': sample_code,
        'found': True,
        'sample_info': sample_info,
        'test_items': test_items_list,
        'test_results_history': test_results_list,
        'processing_chain': processing_chain
    }

@router.get('/rules')
async def get_all_rules(db: Session = Depends(get_db)):
    rules = db.query(RetestRule).order_by(RetestRule.priority.desc()).all()
    return {
        'rules': [
            {
                'id': rule.id,
                'rule_name': rule.rule_name,
                'rule_code': rule.rule_code,
                'rule_type': rule.rule_type,
                'description': rule.description,
                'condition_expr': rule.condition_expr,
                'action_expr': rule.action_expr,
                'priority': rule.priority,
                'is_active': rule.is_active,
                'retest_window_days': rule.retest_window_days,
                'max_retest_count': rule.max_retest_count,
                'parameter_json': rule.parameter_json,
                'created_at': rule.created_at.isoformat() if rule.created_at else None,
                'updated_at': rule.updated_at.isoformat() if rule.updated_at else None
            }
            for rule in rules
        ]
    }

@router.post('/rules')
async def create_rule(rule_data: RetestRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(RetestRule).filter(RetestRule.rule_code == rule_data.rule_code).first()
    if existing:
        raise HTTPException(status_code=400, detail='规则编码已存在')
    
    rule = RetestRule(
        rule_name=rule_data.rule_name,
        rule_code=rule_data.rule_code,
        rule_type=rule_data.rule_type,
        description=rule_data.description,
        condition_expr=rule_data.condition_expr,
        action_expr=rule_data.action_expr,
        priority=rule_data.priority,
        is_active=rule_data.is_active,
        retest_window_days=rule_data.retest_window_days,
        max_retest_count=rule_data.max_retest_count,
        parameter_json=rule_data.parameter_json
    )
    db.add(rule)
    db.commit()
    db.refresh(rule)
    
    return {
        'message': '规则创建成功',
        'rule': {
            'id': rule.id,
            'rule_name': rule.rule_name,
            'rule_code': rule.rule_code,
            'rule_type': rule.rule_type,
            'description': rule.description,
            'priority': rule.priority,
            'is_active': rule.is_active
        }
    }

@router.put('/rules/{rule_id}')
async def update_rule(rule_id: int, rule_data: RetestRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(RetestRule).filter(RetestRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='规则不存在')
    
    if rule_data.rule_code and rule_data.rule_code != rule.rule_code:
        existing = db.query(RetestRule).filter(RetestRule.rule_code == rule_data.rule_code).first()
        if existing:
            raise HTTPException(status_code=400, detail='规则编码已存在')
    
    update_data = rule_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(rule, key, value)
    
    db.commit()
    db.refresh(rule)
    
    return {
        'message': '规则更新成功',
        'rule': {
            'id': rule.id,
            'rule_name': rule.rule_name,
            'rule_code': rule.rule_code,
            'rule_type': rule.rule_type,
            'description': rule.description,
            'priority': rule.priority,
            'is_active': rule.is_active
        }
    }

@router.delete('/rules/{rule_id}')
async def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(RetestRule).filter(RetestRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail='规则不存在')
    
    db.delete(rule)
    db.commit()
    
    return {
        'message': '规则删除成功'
    }
