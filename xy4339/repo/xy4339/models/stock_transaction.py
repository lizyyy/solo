from extensions import db
from datetime import datetime
from enum import Enum

class TransactionType(Enum):
    INBOUND = 'inbound'
    OUTBOUND = 'outbound'
    ADJUSTMENT = 'adjustment'
    RETURN = 'return'

class StockTransaction(db.Model):
    __tablename__ = 'stock_transactions'
    
    id = db.Column(db.Integer, primary_key=True)
    stock_id = db.Column(db.Integer, db.ForeignKey('paper_stock.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('orders.id'))
    
    transaction_type = db.Column(db.String(20), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    previous_quantity = db.Column(db.Integer, nullable=False)
    new_quantity = db.Column(db.Integer, nullable=False)
    
    reference_number = db.Column(db.String(50))
    notes = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by = db.Column(db.String(50))
    
    def to_dict(self):
        return {
            'id': self.id,
            'stock_id': self.stock_id,
            'order_id': self.order_id,
            'transaction_type': self.transaction_type,
            'transaction_type_display': self.get_transaction_type_display(),
            'quantity': self.quantity,
            'previous_quantity': self.previous_quantity,
            'new_quantity': self.new_quantity,
            'reference_number': self.reference_number,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'created_by': self.created_by
        }
    
    def get_transaction_type_display(self):
        type_map = {
            'inbound': '入库',
            'outbound': '出库',
            'adjustment': '调整',
            'return': '退库'
        }
        return type_map.get(self.transaction_type, self.transaction_type)
    
    @staticmethod
    def create_transaction(stock, transaction_type, quantity, order_id=None, 
                           reference_number=None, notes=None, created_by=None):
        previous_quantity = stock.quantity
        
        if transaction_type == 'inbound':
            new_quantity = previous_quantity + quantity
        elif transaction_type == 'outbound':
            new_quantity = previous_quantity - quantity
        elif transaction_type == 'adjustment':
            new_quantity = quantity
        elif transaction_type == 'return':
            new_quantity = previous_quantity + quantity
        else:
            new_quantity = previous_quantity
        
        transaction = StockTransaction(
            stock_id=stock.id,
            order_id=order_id,
            transaction_type=transaction_type,
            quantity=abs(quantity),
            previous_quantity=previous_quantity,
            new_quantity=new_quantity,
            reference_number=reference_number,
            notes=notes,
            created_by=created_by
        )
        
        stock.quantity = new_quantity
        
        return transaction
    
    def __repr__(self):
        return f'<StockTransaction {self.get_transaction_type_display()}: {self.quantity}>'
