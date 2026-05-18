from datetime import datetime
from models import db, RepairRecord
import pandas as pd
from io import BytesIO


class RepairService:
    
    def _generate_record_no(self):
        today = datetime.now().strftime('%Y%m%d')
        count = RepairRecord.query.filter(
            RepairRecord.record_no.like(f'FX{today}%')
        ).count()
        return f'FX{today}{str(count + 1).zfill(4)}'
    
    def _parse_datetime(self, date_str):
        if not date_str:
            return None
        if isinstance(date_str, datetime):
            return date_str
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except:
            return None
    
    def create_single_record(self, data):
        try:
            record_no = data.get('record_no') or self._generate_record_no()
            
            record = RepairRecord(
                record_no=record_no,
                customer_name=data.get('customer_name'),
                customer_phone=data.get('customer_phone'),
                customer_wechat=data.get('customer_wechat'),
                product_type=data.get('product_type'),
                product_brand=data.get('product_brand'),
                product_color=data.get('product_color'),
                product_material=data.get('product_material'),
                original_order_no=data.get('original_order_no'),
                receive_date=self._parse_datetime(data.get('receive_date')),
                receive_staff=data.get('receive_staff'),
                store_name=data.get('store_name'),
                original_damage_description=data.get('original_damage_description'),
                original_damage_photos=','.join(data.get('original_damage_photos', [])) if data.get('original_damage_photos') else None,
                repair_content=data.get('repair_content'),
                repair_reason=data.get('repair_reason'),
                repair_decision=data.get('repair_decision'),
                repair_decision_note=data.get('repair_decision_note'),
                repair_decision_date=self._parse_datetime(data.get('repair_decision_date')),
                repair_decision_staff=data.get('repair_decision_staff'),
                store_responsibility=data.get('store_responsibility'),
                responsibility_note=data.get('responsibility_note'),
                estimated_cost=data.get('estimated_cost'),
                actual_cost=data.get('actual_cost'),
                cost_bearer=data.get('cost_bearer'),
                repair_status=data.get('repair_status', '待处理'),
                customer_takeaway_date=self._parse_datetime(data.get('customer_takeaway_date')),
                customer_takeaway_staff=data.get('customer_takeaway_staff'),
                customer_signature=data.get('customer_signature'),
                feedback_after_takeaway=data.get('feedback_after_takeaway'),
                feedback_date=self._parse_datetime(data.get('feedback_date')),
                feedback_photos=','.join(data.get('feedback_photos', [])) if data.get('feedback_photos') else None,
                handling_result=data.get('handling_result'),
                completion_date=self._parse_datetime(data.get('completion_date')),
                remarks=data.get('remarks'),
                created_by=data.get('created_by'),
                data_source='人工录入'
            )
            
            db.session.add(record)
            db.session.commit()
            
            validation = self._validate_record(record)
            
            return {
                'success': True,
                'message': '创建成功',
                'record_id': record.id,
                'record_no': record.record_no,
                'validation': validation
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'创建失败: {str(e)}'}
    
    def create_batch_records(self, records):
        try:
            success_count = 0
            failed_records = []
            created_records = []
            
            for idx, data in enumerate(records):
                try:
                    record_no = data.get('record_no') or self._generate_record_no()
                    
                    record = RepairRecord(
                        record_no=record_no,
                        customer_name=data.get('customer_name'),
                        customer_phone=data.get('customer_phone'),
                        customer_wechat=data.get('customer_wechat'),
                        product_type=data.get('product_type'),
                        product_brand=data.get('product_brand'),
                        product_color=data.get('product_color'),
                        product_material=data.get('product_material'),
                        original_order_no=data.get('original_order_no'),
                        receive_date=self._parse_datetime(data.get('receive_date')),
                        receive_staff=data.get('receive_staff'),
                        store_name=data.get('store_name'),
                        original_damage_description=data.get('original_damage_description'),
                        original_damage_photos=','.join(data.get('original_damage_photos', [])) if data.get('original_damage_photos') else None,
                        repair_content=data.get('repair_content'),
                        repair_reason=data.get('repair_reason'),
                        repair_decision=data.get('repair_decision'),
                        repair_decision_note=data.get('repair_decision_note'),
                        repair_decision_date=self._parse_datetime(data.get('repair_decision_date')),
                        repair_decision_staff=data.get('repair_decision_staff'),
                        store_responsibility=data.get('store_responsibility'),
                        responsibility_note=data.get('responsibility_note'),
                        estimated_cost=data.get('estimated_cost'),
                        actual_cost=data.get('actual_cost'),
                        cost_bearer=data.get('cost_bearer'),
                        repair_status=data.get('repair_status', '待处理'),
                        customer_takeaway_date=self._parse_datetime(data.get('customer_takeaway_date')),
                        customer_takeaway_staff=data.get('customer_takeaway_staff'),
                        customer_signature=data.get('customer_signature'),
                        feedback_after_takeaway=data.get('feedback_after_takeaway'),
                        feedback_date=self._parse_datetime(data.get('feedback_date')),
                        feedback_photos=','.join(data.get('feedback_photos', [])) if data.get('feedback_photos') else None,
                        handling_result=data.get('handling_result'),
                        completion_date=self._parse_datetime(data.get('completion_date')),
                        remarks=data.get('remarks'),
                        created_by=data.get('created_by'),
                        data_source='批量补录'
                    )
                    
                    db.session.add(record)
                    db.session.flush()
                    success_count += 1
                    created_records.append({
                        'index': idx,
                        'record_id': record.id,
                        'record_no': record.record_no
                    })
                except Exception as e:
                    failed_records.append({
                        'index': idx,
                        'error': str(e),
                        'data': data
                    })
            
            db.session.commit()
            
            return {
                'success': True,
                'message': f'批量导入完成：成功{success_count}条，失败{len(failed_records)}条',
                'success_count': success_count,
                'failed_count': len(failed_records),
                'created_records': created_records,
                'failed_records': failed_records
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'批量导入失败: {str(e)}'}
    
    def get_record(self, record_id):
        record = RepairRecord.query.get(record_id)
        if not record:
            return {'success': False, 'message': '记录不存在'}
        
        validation = self._validate_record(record)
        
        return {
            'success': True,
            'data': record.to_dict(),
            'validation': validation
        }
    
    def update_record(self, record_id, data):
        record = RepairRecord.query.get(record_id)
        if not record:
            return {'success': False, 'message': '记录不存在'}
        
        try:
            for key, value in data.items():
                if hasattr(record, key):
                    if key in ['original_damage_photos', 'feedback_photos'] and isinstance(value, list):
                        setattr(record, key, ','.join(value))
                    elif key in ['receive_date', 'repair_decision_date', 'customer_takeaway_date', 
                                 'feedback_date', 'completion_date']:
                        setattr(record, key, self._parse_datetime(value))
                    else:
                        setattr(record, key, value)
            
            db.session.commit()
            
            validation = self._validate_record(record)
            
            return {
                'success': True,
                'message': '更新成功',
                'validation': validation
            }
        except Exception as e:
            db.session.rollback()
            return {'success': False, 'message': f'更新失败: {str(e)}'}
    
    def list_records(self, page=1, per_page=20):
        pagination = RepairRecord.query.order_by(
            RepairRecord.created_at.desc()
        ).paginate(page=page, per_page=per_page, error_out=False)
        
        return {
            'success': True,
            'data': [r.to_dict() for r in pagination.items],
            'total': pagination.total,
            'page': page,
            'per_page': per_page,
            'pages': pagination.pages
        }
    
    def _validate_record(self, record):
        missing_materials = []
        issues = []
        is_complete = True
        
        if not record.original_damage_description:
            missing_materials.append('原始损伤描述')
            is_complete = False
        if not record.original_damage_photos:
            missing_materials.append('旧伤照片')
            is_complete = False
        
        if not record.repair_decision:
            missing_materials.append('返修判定结果')
            is_complete = False
        if not record.store_responsibility:
            missing_materials.append('门店责任判定')
            is_complete = False
        
        if record.feedback_after_takeaway and not record.feedback_photos:
            missing_materials.append('客户反馈问题照片')
            is_complete = False
        
        if record.repair_status == '已取走' and not record.customer_takeaway_date:
            issues.append('状态标记为已取走，但未填写客户取走时间')
            is_complete = False
        
        if record.customer_takeaway_date and record.feedback_after_takeaway:
            feedback_date = record.feedback_date or datetime.now()
            days_diff = (feedback_date - record.customer_takeaway_date).days
            if days_diff > 7:
                issues.append(f'客户在取走{days_diff}天后反馈问题，已超过7天异议期，需特别注意')
        
        return {
            'is_complete': is_complete,
            'missing_materials': missing_materials,
            'issues': issues,
            'next_steps': self._generate_next_steps(missing_materials, issues, record)
        }
    
    def _generate_next_steps(self, missing_materials, issues, record):
        steps = []
        
        if missing_materials:
            steps.append(f'请补充以下材料：{"、".join(missing_materials)}')
        
        if record.repair_status == '待处理':
            if not record.repair_decision:
                steps.append('请尽快完成返修判定：同意返修/拒绝返修/协商处理')
            if not record.store_responsibility:
                steps.append('请完成门店责任判定：全责/部分责任/无责')
        
        if record.feedback_after_takeaway:
            steps.append('客户取走后反馈问题，建议：1.核对旧伤照片确认是否为原有问题 2.与客户沟通协商解决方案 3.留存沟通记录')
        
        if not steps:
            steps.append('记录完整，可继续后续处理流程')
        
        return steps
    
    def validate_and_suggest_materials(self, record_id):
        record = RepairRecord.query.get(record_id)
        if not record:
            return {'success': False, 'message': '记录不存在'}
        
        validation = self._validate_record(record)
        
        return {
            'success': True,
            'record_no': record.record_no,
            'customer_name': record.customer_name,
            'product_type': record.product_type,
            'validation': validation,
            'action_recommendation': self._get_action_recommendation(validation)
        }
    
    def _get_action_recommendation(self, validation):
        if not validation['is_complete']:
            return '优先补充缺失材料后再继续处理'
        if validation['issues']:
            return '注意处理标注的问题后继续流程'
        return '记录完整，可正常推进处理'
    
    def export_records(self, start_date=None, end_date=None):
        query = RepairRecord.query
        
        if start_date:
            query = query.filter(RepairRecord.receive_date >= self._parse_datetime(start_date))
        if end_date:
            query = query.filter(RepairRecord.receive_date <= self._parse_datetime(end_date))
        
        records = query.order_by(RepairRecord.receive_date.desc()).all()
        
        export_data = []
        for r in records:
            export_data.append({
                '返修记录编号': r.record_no,
                '客户姓名': r.customer_name,
                '客户电话': r.customer_phone,
                '皮具类型': r.product_type,
                '品牌': r.product_brand,
                '颜色': r.product_color,
                '材质': r.product_material,
                '原始订单号': r.original_order_no,
                '门店名称': r.store_name,
                '收件日期': r.receive_date.strftime('%Y-%m-%d') if r.receive_date else '',
                '收件员工': r.receive_staff,
                '原始损伤描述': r.original_damage_description,
                '旧伤照片': '有' if r.original_damage_photos else '无',
                '返修护理内容': r.repair_content,
                '返修原因': r.repair_reason,
                '返修判定': r.repair_decision,
                '门店责任': r.store_responsibility,
                '返修状态': r.repair_status,
                '预估费用': r.estimated_cost,
                '实际费用': r.actual_cost,
                '费用承担方': r.cost_bearer,
                '客户取走时间': r.customer_takeaway_date.strftime('%Y-%m-%d') if r.customer_takeaway_date else '',
                '客户取走后反馈': r.feedback_after_takeaway,
                '反馈日期': r.feedback_date.strftime('%Y-%m-%d') if r.feedback_date else '',
                '最终处理结果': r.handling_result,
                '完成日期': r.completion_date.strftime('%Y-%m-%d') if r.completion_date else '',
                '数据来源': r.data_source,
                '录入人': r.created_by,
                '备注': r.remarks
            })
        
        df = pd.DataFrame(export_data)
        
        output = BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='返修记录', index=False)
        
        output.seek(0)
        return output
    
    def get_statistics(self):
        total = RepairRecord.query.count()
        status_stats = db.session.query(
            RepairRecord.repair_status,
            db.func.count(RepairRecord.id)
        ).group_by(RepairRecord.repair_status).all()
        
        decision_stats = db.session.query(
            RepairRecord.repair_decision,
            db.func.count(RepairRecord.id)
        ).filter(RepairRecord.repair_decision.isnot(None)).group_by(RepairRecord.repair_decision).all()
        
        responsibility_stats = db.session.query(
            RepairRecord.store_responsibility,
            db.func.count(RepairRecord.id)
        ).filter(RepairRecord.store_responsibility.isnot(None)).group_by(RepairRecord.store_responsibility).all()
        
        source_stats = db.session.query(
            RepairRecord.data_source,
            db.func.count(RepairRecord.id)
        ).group_by(RepairRecord.data_source).all()
        
        has_feedback = RepairRecord.query.filter(
            RepairRecord.feedback_after_takeaway.isnot(None)
        ).count()
        
        return {
            'success': True,
            'total_records': total,
            'status_breakdown': {s: c for s, c in status_stats},
            'decision_breakdown': {d: c for d, c in decision_stats},
            'responsibility_breakdown': {r: c for r, c in responsibility_stats},
            'data_source_breakdown': {s: c for s, c in source_stats},
            'customer_feedback_after_takeaway': has_feedback
        }