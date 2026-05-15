import hashlib
import json
from shadow_checker.models.database import (
    ValidationResult, FailedRecord, BatchInfo, CloudResourceOrder, PurchaseInquiry
)


class Validator:
    def __init__(self, db, batch_id):
        self.db = db
        self.batch_id = batch_id
    
    def calculate_data_hash(self, cloud_file, purchase_file):
        hasher = hashlib.sha256()
        
        with open(cloud_file, 'rb') as f:
            hasher.update(f.read())
        
        with open(purchase_file, 'rb') as f:
            hasher.update(f.read())
        
        return hasher.hexdigest()
    
    def check_duplicate_batch(self, cloud_file, purchase_file):
        data_hash = self.calculate_data_hash(cloud_file, purchase_file)
        
        existing_batch = self.db.query(BatchInfo).filter(
            BatchInfo.data_hash == data_hash
        ).order_by(BatchInfo.submit_time.desc()).first()
        
        if existing_batch:
            return {
                'is_duplicate': True,
                'previous_batch_id': existing_batch.batch_id,
                'message': f'检测到与批次 {existing_batch.batch_id} 完全相同的内容，提交时间: {existing_batch.submit_time}'
            }
        
        return {
            'is_duplicate': False,
            'previous_batch_id': None,
            'message': ''
        }
    
    def _add_validation_result(self, record_type, record_id, row_number, check_item, is_pass, error_message='', detail=''):
        result = ValidationResult(
            batch_id=self.batch_id,
            record_type=record_type,
            record_id=str(record_id),
            row_number=row_number,
            check_item=check_item,
            is_pass=is_pass,
            error_message=error_message,
            detail=detail
        )
        self.db.add(result)
        return result
    
    def _add_failed_record(self, record_type, row_number, original_data, failure_reason, check_item):
        failed = FailedRecord(
            batch_id=self.batch_id,
            record_type=record_type,
            row_number=row_number,
            original_data=json.dumps(original_data, ensure_ascii=False),
            failure_reason=failure_reason,
            check_item=check_item
        )
        self.db.add(failed)
        return failed
    
    def _get_cloud_order_dict(self, order):
        return {
            '申请单号': order.order_no,
            '申请人': order.applicant,
            '部门': order.department,
            '申请日期': order.apply_date,
            '资源类型': order.resource_type,
            '规格配置': order.specification,
            '数量': order.quantity,
            '单价': order.unit_price,
            '总金额': order.total_amount,
            '使用时长': order.usage_duration,
            '用途说明': order.purpose,
            '审批状态': order.approval_status,
            '审批人': order.approver,
            '审批日期': order.approval_date,
            '支付凭证': order.payment_proof,
            '回滚证据': order.rollback_evidence
        }
    
    def validate_cloud_orders(self, orders):
        passed = 0
        failed = 0
        
        for order in orders:
            order_passed = True
            
            if not order.order_no or order.order_no == 'nan':
                self._add_validation_result(
                    'cloud_resource', order.id, order.row_number,
                    '申请单号校验', False, '申请单号不能为空'
                )
                order_passed = False
            
            expected_total = order.quantity * order.unit_price
            if abs(order.total_amount - expected_total) > 0.01:
                self._add_validation_result(
                    'cloud_resource', order.id, order.row_number,
                    '金额计算校验', False,
                    f'总金额计算错误: 期望 {expected_total}, 实际 {order.total_amount}',
                    f'数量: {order.quantity} × 单价: {order.unit_price} = {expected_total}'
                )
                order_passed = False
            
            if not order.rollback_evidence or order.rollback_evidence.strip() in ['', 'nan', '无', '未提供']:
                self._add_validation_result(
                    'cloud_resource', order.id, order.row_number,
                    '回滚证据校验', False,
                    '回滚没有证据，无法确认操作合规性',
                    '请提供回滚操作的截图、日志或审批记录'
                )
                self._add_failed_record(
                    'cloud_resource', order.row_number,
                    self._get_cloud_order_dict(order),
                    '回滚没有证据，无法确认操作合规性',
                    '回滚证据校验'
                )
                order_passed = False
            
            if not order.payment_proof or order.payment_proof.strip() in ['', 'nan', '无', '未提供']:
                self._add_validation_result(
                    'cloud_resource', order.id, order.row_number,
                    '支付凭证校验', False,
                    '支付凭证缺失，无法确认费用真实性'
                )
                order_passed = False
            
            if order_passed:
                self._add_validation_result(
                    'cloud_resource', order.id, order.row_number,
                    '综合校验', True, '所有校验项通过'
                )
                passed += 1
            else:
                failed += 1
        
        self.db.commit()
        return {'passed': passed, 'failed': failed}
    
    def _get_purchase_inquiry_dict(self, inquiry):
        return {
            '询价单号': inquiry.inquiry_no,
            '物品名称': inquiry.item_name,
            '规格型号': inquiry.specification,
            '数量': inquiry.quantity,
            '单位': inquiry.unit,
            '供应商': inquiry.supplier,
            '报价': inquiry.quoted_price,
            '币种': inquiry.currency,
            '报价日期': inquiry.quotation_date,
            '人工备注': inquiry.manual_remark
        }
    
    def validate_purchase_inquiries(self, inquiries):
        passed = 0
        failed = 0
        
        for inquiry in inquiries:
            inquiry_passed = True
            
            if not inquiry.inquiry_no or inquiry.inquiry_no == 'nan':
                self._add_validation_result(
                    'purchase_inquiry', inquiry.id, inquiry.row_number,
                    '询价单号校验', False, '询价单号不能为空'
                )
                inquiry_passed = False
            
            if inquiry.quantity <= 0:
                self._add_validation_result(
                    'purchase_inquiry', inquiry.id, inquiry.row_number,
                    '数量校验', False, f'数量必须大于0，当前值: {inquiry.quantity}'
                )
                inquiry_passed = False
            
            if inquiry.quoted_price <= 0:
                self._add_validation_result(
                    'purchase_inquiry', inquiry.id, inquiry.row_number,
                    '报价校验', False, f'报价必须大于0，当前值: {inquiry.quoted_price}'
                )
                inquiry_passed = False
            
            if inquiry_passed:
                self._add_validation_result(
                    'purchase_inquiry', inquiry.id, inquiry.row_number,
                    '综合校验', True, '所有校验项通过'
                )
                passed += 1
            else:
                self._add_failed_record(
                    'purchase_inquiry', inquiry.row_number,
                    self._get_purchase_inquiry_dict(inquiry),
                    '采购询价单关键信息缺失或无效',
                    '综合校验'
                )
                failed += 1
        
        self.db.commit()
        return {'passed': passed, 'failed': failed}
