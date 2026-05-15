import pandas as pd
import json
from shadow_checker.models.database import CloudResourceOrder, PurchaseInquiry


class DataLoader:
    def __init__(self, db):
        self.db = db
    
    def load_cloud_resource_orders(self, file_path, batch_id):
        if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
            df = pd.read_excel(file_path)
        elif file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            raise ValueError('不支持的文件格式')
        
        orders = []
        for idx, row in df.iterrows():
            row_number = idx + 2
            
            order = CloudResourceOrder(
                batch_id=batch_id,
                row_number=row_number,
                order_no=str(row.get('申请单号', '')),
                applicant=str(row.get('申请人', '')),
                department=str(row.get('部门', '')),
                apply_date=str(row.get('申请日期', '')),
                resource_type=str(row.get('资源类型', '')),
                specification=str(row.get('规格配置', '')),
                quantity=self._to_int(row.get('数量', 0)),
                unit_price=self._to_float(row.get('单价', 0)),
                total_amount=self._to_float(row.get('总金额', 0)),
                usage_duration=str(row.get('使用时长', '')),
                purpose=str(row.get('用途说明', '')),
                approval_status=str(row.get('审批状态', '')),
                approver=str(row.get('审批人', '')),
                approval_date=str(row.get('审批日期', '')),
                payment_proof=str(row.get('支付凭证', '')),
                rollback_evidence=str(row.get('回滚证据', ''))
            )
            self.db.add(order)
            orders.append(order)
        
        self.db.commit()
        return orders
    
    def load_purchase_inquiries(self, file_path, batch_id):
        if file_path.endswith('.xlsx') or file_path.endswith('.xls'):
            df = pd.read_excel(file_path)
        elif file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            raise ValueError('不支持的文件格式')
        
        inquiries = []
        for idx, row in df.iterrows():
            row_number = idx + 2
            
            inquiry = PurchaseInquiry(
                batch_id=batch_id,
                row_number=row_number,
                inquiry_no=str(row.get('询价单号', '')),
                item_name=str(row.get('物品名称', '')),
                specification=str(row.get('规格型号', '')),
                quantity=self._to_int(row.get('数量', 0)),
                unit=str(row.get('单位', '')),
                supplier=str(row.get('供应商', '')),
                quoted_price=self._to_float(row.get('报价', 0)),
                currency=str(row.get('币种', '')),
                quotation_date=str(row.get('报价日期', '')),
                manual_remark=str(row.get('人工备注', ''))
            )
            self.db.add(inquiry)
            inquiries.append(inquiry)
        
        self.db.commit()
        return inquiries
    
    def _to_int(self, value):
        try:
            return int(float(str(value).strip()))
        except (ValueError, TypeError):
            return 0
    
    def _to_float(self, value):
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return 0.0
