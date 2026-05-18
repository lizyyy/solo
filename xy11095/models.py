from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()


class RepairRecord(db.Model):
    __tablename__ = 'repair_records'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    
    record_no = db.Column(db.String(50), unique=True, nullable=False, comment='返修记录编号')
    
    customer_name = db.Column(db.String(100), nullable=False, comment='客户姓名')
    customer_phone = db.Column(db.String(20), nullable=False, comment='客户电话')
    customer_wechat = db.Column(db.String(100), comment='客户微信号')
    
    product_type = db.Column(db.String(50), nullable=False, comment='皮具类型')
    product_brand = db.Column(db.String(100), comment='品牌')
    product_color = db.Column(db.String(50), comment='颜色')
    product_material = db.Column(db.String(50), comment='材质')
    original_order_no = db.Column(db.String(50), comment='原始护理订单号')
    
    receive_date = db.Column(db.DateTime, nullable=False, comment='门店收件日期')
    receive_staff = db.Column(db.String(50), nullable=False, comment='收件员工')
    store_name = db.Column(db.String(100), nullable=False, comment='门店名称')
    
    original_damage_description = db.Column(db.Text, comment='原始损伤描述')
    original_damage_photos = db.Column(db.Text, comment='旧伤照片路径，多个用逗号分隔')
    
    repair_content = db.Column(db.Text, nullable=False, comment='返修护理内容')
    repair_reason = db.Column(db.Text, comment='返修原因')
    repair_decision = db.Column(db.String(20), comment='返修判定：同意返修/拒绝返修/协商处理')
    repair_decision_note = db.Column(db.Text, comment='返修判定说明')
    repair_decision_date = db.Column(db.DateTime, comment='返修判定日期')
    repair_decision_staff = db.Column(db.String(50), comment='判定人')
    
    store_responsibility = db.Column(db.String(20), comment='门店责任：全责/部分责任/无责')
    responsibility_note = db.Column(db.Text, comment='责任判定说明')
    
    estimated_cost = db.Column(db.Float, comment='预估费用')
    actual_cost = db.Column(db.Float, comment='实际费用')
    cost_bearer = db.Column(db.String(20), comment='费用承担方：门店/客户/厂家/共担')
    
    repair_status = db.Column(db.String(20), default='待处理', comment='返修状态：待处理/处理中/已完成/已取走/已取消')
    
    customer_takeaway_date = db.Column(db.DateTime, comment='客户取走时间')
    customer_takeaway_staff = db.Column(db.String(50), comment='交件员工')
    customer_signature = db.Column(db.String(100), comment='客户签收')
    
    feedback_after_takeaway = db.Column(db.Text, comment='客户取走后反馈内容')
    feedback_date = db.Column(db.DateTime, comment='反馈日期')
    feedback_photos = db.Column(db.Text, comment='反馈问题照片')
    
    handling_result = db.Column(db.Text, comment='最终处理结果')
    completion_date = db.Column(db.DateTime, comment='完成日期')
    
    remarks = db.Column(db.Text, comment='备注')
    
    created_at = db.Column(db.DateTime, default=datetime.now, comment='创建时间')
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now, comment='更新时间')
    created_by = db.Column(db.String(50), comment='录入人')
    data_source = db.Column(db.String(20), default='人工录入', comment='数据来源：人工录入/批量补录')

    def to_dict(self):
        return {
            'id': self.id,
            'record_no': self.record_no,
            'customer_name': self.customer_name,
            'customer_phone': self.customer_phone,
            'customer_wechat': self.customer_wechat,
            'product_type': self.product_type,
            'product_brand': self.product_brand,
            'product_color': self.product_color,
            'product_material': self.product_material,
            'original_order_no': self.original_order_no,
            'receive_date': self.receive_date.isoformat() if self.receive_date else None,
            'receive_staff': self.receive_staff,
            'store_name': self.store_name,
            'original_damage_description': self.original_damage_description,
            'original_damage_photos': self.original_damage_photos.split(',') if self.original_damage_photos else [],
            'repair_content': self.repair_content,
            'repair_reason': self.repair_reason,
            'repair_decision': self.repair_decision,
            'repair_decision_note': self.repair_decision_note,
            'repair_decision_date': self.repair_decision_date.isoformat() if self.repair_decision_date else None,
            'repair_decision_staff': self.repair_decision_staff,
            'store_responsibility': self.store_responsibility,
            'responsibility_note': self.responsibility_note,
            'estimated_cost': self.estimated_cost,
            'actual_cost': self.actual_cost,
            'cost_bearer': self.cost_bearer,
            'repair_status': self.repair_status,
            'customer_takeaway_date': self.customer_takeaway_date.isoformat() if self.customer_takeaway_date else None,
            'customer_takeaway_staff': self.customer_takeaway_staff,
            'customer_signature': self.customer_signature,
            'feedback_after_takeaway': self.feedback_after_takeaway,
            'feedback_date': self.feedback_date.isoformat() if self.feedback_date else None,
            'feedback_photos': self.feedback_photos.split(',') if self.feedback_photos else [],
            'handling_result': self.handling_result,
            'completion_date': self.completion_date.isoformat() if self.completion_date else None,
            'remarks': self.remarks,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'created_by': self.created_by,
            'data_source': self.data_source
        }