import pandas as pd
import json
import os
from datetime import datetime
from shadow_checker.models.database import (
    ValidationResult, FailedRecord, BatchInfo, CloudResourceOrder, PurchaseInquiry
)


class Exporter:
    def __init__(self, db, output_dir):
        self.db = db
        self.output_dir = output_dir
    
    def export_validation_report(self, batch_id):
        batch = self.db.query(BatchInfo).filter(BatchInfo.batch_id == batch_id).first()
        if not batch:
            raise ValueError(f'批次 {batch_id} 不存在')
        
        results = self.db.query(ValidationResult).filter(ValidationResult.batch_id == batch_id).all()
        
        data = []
        for r in results:
            data.append({
                '批次ID': batch_id,
                '记录类型': r.record_type,
                '记录ID': r.record_id,
                '原始行号': r.row_number,
                '校验项': r.check_item,
                '是否通过': '是' if r.is_pass else '否',
                '错误信息': r.error_message,
                '详细说明': r.detail,
                '校验时间': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })
        
        df = pd.DataFrame(data)
        
        filename = f'{batch_id}_校验报告.xlsx'
        filepath = os.path.join(self.output_dir, filename)
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='校验明细', index=False)
            
            summary_data = [{
                '批次ID': batch_id,
                '提交时间': batch.submit_time.strftime('%Y-%m-%d %H:%M:%S'),
                '总记录数': batch.total_records,
                '通过数': batch.passed_count,
                '失败数': batch.failed_count,
                '通过率': f'{(batch.passed_count / batch.total_records * 100):.2f}%' if batch.total_records > 0 else '0%'
            }]
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='汇总', index=False)
        
        return filepath
    
    def export_failed_records(self, batch_id):
        failed_records = self.db.query(FailedRecord).filter(
            FailedRecord.batch_id == batch_id
        ).all()
        
        data = []
        for r in failed_records:
            original_data = json.loads(r.original_data)
            row = {
                '批次ID': batch_id,
                '记录类型': r.record_type,
                '原始行号': r.row_number,
                '失败原因': r.failure_reason,
                '校验项': r.check_item,
                '是否已导出': '是' if r.is_exported else '否',
                '记录时间': r.created_at.strftime('%Y-%m-%d %H:%M:%S')
            }
            
            for key, value in original_data.items():
                row[f'原始数据_{key}'] = value
            
            data.append(row)
        
        df = pd.DataFrame(data)
        
        filename = f'{batch_id}_失败记录.xlsx'
        filepath = os.path.join(self.output_dir, filename)
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        for r in failed_records:
            r.is_exported = True
        self.db.commit()
        
        return filepath
    
    def export_cloud_orders_detail(self, batch_id):
        orders = self.db.query(CloudResourceOrder).filter(
            CloudResourceOrder.batch_id == batch_id
        ).all()
        
        data = []
        for order in orders:
            data.append({
                '批次ID': batch_id,
                '原始行号': order.row_number,
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
            })
        
        df = pd.DataFrame(data)
        
        filename = f'{batch_id}_云资源申请单明细.xlsx'
        filepath = os.path.join(self.output_dir, filename)
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        return filepath
    
    def export_purchase_inquiries_detail(self, batch_id):
        inquiries = self.db.query(PurchaseInquiry).filter(
            PurchaseInquiry.batch_id == batch_id
        ).all()
        
        data = []
        for inquiry in inquiries:
            data.append({
                '批次ID': batch_id,
                '原始行号': inquiry.row_number,
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
            })
        
        df = pd.DataFrame(data)
        
        filename = f'{batch_id}_采购询价单明细.xlsx'
        filepath = os.path.join(self.output_dir, filename)
        df.to_excel(filepath, index=False, engine='openpyxl')
        
        return filepath
