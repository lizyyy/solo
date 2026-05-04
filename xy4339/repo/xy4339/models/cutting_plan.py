from extensions import db
from datetime import datetime
import json

class CuttingLayout(db.Model):
    __tablename__ = 'cutting_layouts'
    
    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('cutting_plans.id'), nullable=False)
    
    sheet_width = db.Column(db.Float, nullable=False)
    sheet_height = db.Column(db.Float, nullable=False)
    piece_width = db.Column(db.Float, nullable=False)
    piece_height = db.Column(db.Float, nullable=False)
    
    cols = db.Column(db.Integer, nullable=False)
    rows = db.Column(db.Integer, nullable=False)
    total_per_sheet = db.Column(db.Integer, nullable=False)
    
    horizontal_gap = db.Column(db.Float, default=0)
    vertical_gap = db.Column(db.Float, default=0)
    left_margin = db.Column(db.Float, default=0)
    right_margin = db.Column(db.Float, default=0)
    top_margin = db.Column(db.Float, default=0)
    bottom_margin = db.Column(db.Float, default=0)
    
    waste_area = db.Column(db.Float, default=0)
    waste_percent = db.Column(db.Float, default=0)
    
    layout_data = db.Column(db.Text)
    is_rotated = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        layout_obj = None
        if self.layout_data:
            try:
                layout_obj = json.loads(self.layout_data)
            except:
                pass
        
        return {
            'id': self.id,
            'plan_id': self.plan_id,
            'sheet_width': self.sheet_width,
            'sheet_height': self.sheet_height,
            'piece_width': self.piece_width,
            'piece_height': self.piece_height,
            'cols': self.cols,
            'rows': self.rows,
            'total_per_sheet': self.total_per_sheet,
            'horizontal_gap': self.horizontal_gap,
            'vertical_gap': self.vertical_gap,
            'left_margin': self.left_margin,
            'right_margin': self.right_margin,
            'top_margin': self.top_margin,
            'bottom_margin': self.bottom_margin,
            'waste_area': self.waste_area,
            'waste_percent': self.waste_percent,
            'layout_data': layout_obj,
            'is_rotated': self.is_rotated,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
    
    def get_layout_object(self):
        if self.layout_data:
            try:
                return json.loads(self.layout_data)
            except:
                pass
        return None
    
    def set_layout_object(self, obj):
        if obj:
            self.layout_data = json.dumps(obj, ensure_ascii=False)
        else:
            self.layout_data = None
    
    def __repr__(self):
        return f'<CuttingLayout {self.cols}x{self.rows} = {self.total_per_sheet}>'

class CuttingPlan(db.Model):
    __tablename__ = 'cutting_plans'
    
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'), nullable=False)
    order_item_id = db.Column(db.Integer, db.ForeignKey('order_items.id'))
    stock_id = db.Column(db.Integer, db.ForeignKey('paper_stock.id'))
    
    sheet_width = db.Column(db.Float, nullable=False)
    sheet_height = db.Column(db.Float, nullable=False)
    sheet_name = db.Column(db.String(100))
    
    total_pieces_needed = db.Column(db.Integer, nullable=False)
    sheets_needed = db.Column(db.Integer, nullable=False)
    sheets_available = db.Column(db.Integer, default=0)
    sheets_shortage = db.Column(db.Integer, default=0)
    
    best_efficiency = db.Column(db.Float, default=0)
    total_waste_area = db.Column(db.Float, default=0)
    total_waste_percent = db.Column(db.Float, default=0)
    
    material_cost = db.Column(db.Float, default=0)
    labor_cost = db.Column(db.Float, default=0)
    urgent_surcharge = db.Column(db.Float, default=0)
    total_cost = db.Column(db.Float, default=0)
    quoted_price = db.Column(db.Float, default=0)
    
    risk_warnings = db.Column(db.Text)
    is_manual = db.Column(db.Boolean, default=False)
    manual_notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    layouts = db.relationship('CuttingLayout', backref='plan', lazy='dynamic',
                              cascade='all, delete-orphan')
    
    def to_dict(self):
        warnings = []
        if self.risk_warnings:
            try:
                warnings = json.loads(self.risk_warnings)
            except:
                warnings = [self.risk_warnings]
        
        return {
            'id': self.id,
            'order_id': self.order_id,
            'order_item_id': self.order_item_id,
            'stock_id': self.stock_id,
            'sheet_width': self.sheet_width,
            'sheet_height': self.sheet_height,
            'sheet_name': self.sheet_name,
            'total_pieces_needed': self.total_pieces_needed,
            'sheets_needed': self.sheets_needed,
            'sheets_available': self.sheets_available,
            'sheets_shortage': self.sheets_shortage,
            'has_shortage': self.sheets_shortage > 0,
            'best_efficiency': self.best_efficiency,
            'total_waste_area': self.total_waste_area,
            'total_waste_percent': self.total_waste_percent,
            'material_cost': self.material_cost,
            'labor_cost': self.labor_cost,
            'urgent_surcharge': self.urgent_surcharge,
            'total_cost': self.total_cost,
            'quoted_price': self.quoted_price,
            'risk_warnings': warnings,
            'has_risk': len(warnings) > 0,
            'is_manual': self.is_manual,
            'manual_notes': self.manual_notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }
    
    def set_risk_warnings(self, warnings):
        if warnings and isinstance(warnings, list):
            self.risk_warnings = json.dumps(warnings, ensure_ascii=False)
        else:
            self.risk_warnings = None
    
    def get_risk_warnings(self):
        if self.risk_warnings:
            try:
                return json.loads(self.risk_warnings)
            except:
                return [self.risk_warnings]
        return []
    
    def __repr__(self):
        return f'<CuttingPlan Need {self.sheets_needed} sheets, Shortage {self.sheets_shortage}>'
