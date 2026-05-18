from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

class ReplaceRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.String(50), unique=True, nullable=False, comment='换件单号')
    
    customer_name = db.Column(db.String(100), nullable=False, comment='客户姓名')
    customer_phone = db.Column(db.String(20), nullable=False, comment='客户电话')
    customer_address = db.Column(db.String(500), comment='客户地址')
    
    lock_model = db.Column(db.String(100), nullable=False, comment='门锁型号')
    lock_sn = db.Column(db.String(100), nullable=False, comment='门锁序列号')
    purchase_date = db.Column(db.Date, comment='购买日期')
    warranty_status = db.Column(db.String(20), comment='保修状态')
    
    fault_type = db.Column(db.String(100), nullable=False, comment='故障类型')
    fault_description = db.Column(db.Text, comment='故障描述')
    
    old_part_code = db.Column(db.String(100), comment='旧配件编码')
    old_part_name = db.Column(db.String(100), comment='旧配件名称')
    old_part_recycled = db.Column(db.Boolean, default=False, comment='旧配件是否回收')
    old_part_recycle_date = db.Column(db.Date, comment='旧配件回收日期')
    
    new_part_code = db.Column(db.String(100), nullable=False, comment='新配件编码')
    new_part_name = db.Column(db.String(100), nullable=False, comment='新配件名称')
    new_part_warehouse = db.Column(db.String(100), comment='新配件出库仓库')
    new_part_ship_date = db.Column(db.Date, comment='新配件发货日期')
    
    technician_name = db.Column(db.String(100), comment='上门工程师姓名')
    technician_phone = db.Column(db.String(20), comment='上门工程师电话')
    service_date = db.Column(db.Date, comment='上门服务日期')
    
    status = db.Column(db.String(20), nullable=False, comment='状态')
    status_flow = ['待审核', '配件出库', '工程师上门', '换件完成', '旧件回收', '售后闭环']
    
    manual_notes = db.Column(db.Text, comment='人工备注')
    has_manual_override = db.Column(db.Boolean, default=False, comment='是否人工覆盖')
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'record_id': self.record_id,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'customer_address': self.customer_address,
            'lock_model': self.lock_model,
            'lock_sn': self.lock_sn,
            'purchase_date': self.purchase_date.isoformat() if self.purchase_date else None,
            'warranty_status': self.warranty_status,
            'fault_type': self.fault_type,
            'fault_description': self.fault_description,
            'old_part_code': self.old_part_code,
            'old_part_name': self.old_part_name,
            'old_part_recycled': self.old_part_recycled,
            'old_part_recycle_date': self.old_part_recycle_date.isoformat() if self.old_part_recycle_date else None,
            'new_part_code': self.new_part_code,
            'new_part_name': self.new_part_name,
            'new_part_warehouse': self.new_part_warehouse,
            'new_part_ship_date': self.new_part_ship_date.isoformat() if self.new_part_ship_date else None,
            'technician_name': self.technician_name,
            'technician_phone': self.technician_phone,
            'service_date': self.service_date.isoformat() if self.service_date else None,
            'status': self.status,
            'manual_notes': self.manual_notes,
            'has_manual_override': self.has_manual_override,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
