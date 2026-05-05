from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import json


class Plan(Base):
    __tablename__ = 'plans'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, default='')
    monthly_cost = Column(Float, nullable=False)
    features = Column(Text, default='[]')  # JSON array
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'monthly_cost': self.monthly_cost,
            'features': json.loads(self.features) if self.features else [],
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class DiscountRule(Base):
    __tablename__ = 'discount_rules'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    rule_type = Column(String(50), nullable=False)  # percentage, fixed, volume
    conditions = Column(Text, default='{}')  # JSON object with conditions
    discount_value = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    valid_from = Column(DateTime, nullable=True)
    valid_until = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'rule_type': self.rule_type,
            'conditions': json.loads(self.conditions) if self.conditions else {},
            'discount_value': self.discount_value,
            'is_active': self.is_active,
            'valid_from': self.valid_from.isoformat() if self.valid_from else None,
            'valid_until': self.valid_until.isoformat() if self.valid_until else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class CustomerUsage(Base):
    __tablename__ = 'customer_usages'
    
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, nullable=False, index=True)
    plan_id = Column(Integer, ForeignKey('plans.id'), nullable=False)
    usage_month = Column(String(7), nullable=False)  # YYYY-MM
    usage_data = Column(Text, default='{}')  # JSON object with usage metrics
    calculated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    plan = relationship('Plan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'plan_id': self.plan_id,
            'usage_month': self.usage_month,
            'usage_data': json.loads(self.usage_data) if self.usage_data else {},
            'calculated_at': self.calculated_at.isoformat() if self.calculated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class BillingResult(Base):
    __tablename__ = 'billing_results'
    
    id = Column(Integer, primary_key=True)
    customer_id = Column(Integer, nullable=False, index=True)
    usage_id = Column(Integer, ForeignKey('customer_usages.id'), nullable=False)
    plan_id = Column(Integer, ForeignKey('plans.id'), nullable=False)
    discount_rule_id = Column(Integer, ForeignKey('discount_rules.id'), nullable=True)
    billing_month = Column(String(7), nullable=False)  # YYYY-MM
    base_cost = Column(Float, nullable=False)
    discount_amount = Column(Float, default=0.0)
    final_cost = Column(Float, nullable=False)
    calculation_details = Column(Text, default='{}')  # JSON object with breakdown
    config_version_id = Column(Integer, ForeignKey('config_versions.id'), nullable=True)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    usage = relationship('CustomerUsage')
    plan = relationship('Plan')
    discount_rule = relationship('DiscountRule')
    config_version = relationship('ConfigVersion')
    
    def to_dict(self):
        return {
            'id': self.id,
            'customer_id': self.customer_id,
            'usage_id': self.usage_id,
            'plan_id': self.plan_id,
            'discount_rule_id': self.discount_rule_id,
            'billing_month': self.billing_month,
            'base_cost': self.base_cost,
            'discount_amount': self.discount_amount,
            'final_cost': self.final_cost,
            'calculation_details': json.loads(self.calculation_details) if self.calculation_details else {},
            'config_version_id': self.config_version_id,
            'calculated_at': self.calculated_at.isoformat() if self.calculated_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class ConfigVersion(Base):
    __tablename__ = 'config_versions'
    
    id = Column(Integer, primary_key=True)
    version = Column(String(50), nullable=False, unique=True)
    changes = Column(Text, default='{}')  # JSON object describing changes
    author = Column(String(100), default='system')
    description = Column(Text, default='')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'version': self.version,
            'changes': json.loads(self.changes) if self.changes else {},
            'author': self.author,
            'description': self.description,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class CacheKey(Base):
    __tablename__ = 'cache_keys'
    
    id = Column(Integer, primary_key=True)
    key = Column(String(255), nullable=False, unique=True, index=True)
    key_type = Column(String(50), nullable=False)  # plan, discount, customer_billing, usage
    entity_id = Column(Integer, nullable=True)  # plan_id, discount_id, customer_id, etc.
    data = Column(Text, default='{}')  # cached data as JSON
    expires_at = Column(DateTime, nullable=True)
    is_valid = Column(Boolean, default=True)
    last_used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'key_type': self.key_type,
            'entity_id': self.entity_id,
            'data': json.loads(self.data) if self.data else {},
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_valid': self.is_valid,
            'last_used_at': self.last_used_at.isoformat() if self.last_used_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Dependency(Base):
    __tablename__ = 'dependencies'
    
    id = Column(Integer, primary_key=True)
    dependent_type = Column(String(50), nullable=False)  # cache_key, billing_result, customer
    dependent_id = Column(Integer, nullable=False)
    depends_on_type = Column(String(50), nullable=False)  # plan, discount_rule, config_version
    depends_on_id = Column(Integer, nullable=False)
    dependency_type = Column(String(50), default='direct')  # direct, indirect
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'dependent_type': self.dependent_type,
            'dependent_id': self.dependent_id,
            'depends_on_type': self.depends_on_type,
            'depends_on_id': self.depends_on_id,
            'dependency_type': self.dependency_type,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }


class RecalcTask(Base):
    __tablename__ = 'recalc_tasks'
    
    id = Column(Integer, primary_key=True)
    task_type = Column(String(50), nullable=False)  # full, partial, specific
    config_version_id = Column(Integer, ForeignKey('config_versions.id'), nullable=True)
    customer_ids = Column(Text, default='[]')  # JSON array of customer IDs
    status = Column(String(20), default='pending')  # pending, running, completed, failed
    progress = Column(Integer, default=0)  # 0-100
    total_items = Column(Integer, default=0)
    processed_items = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    result_summary = Column(Text, default='{}')  # JSON object with results
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    config_version = relationship('ConfigVersion')
    
    def to_dict(self):
        return {
            'id': self.id,
            'task_type': self.task_type,
            'config_version_id': self.config_version_id,
            'customer_ids': json.loads(self.customer_ids) if self.customer_ids else [],
            'status': self.status,
            'progress': self.progress,
            'total_items': self.total_items,
            'processed_items': self.processed_items,
            'error_message': self.error_message,
            'result_summary': json.loads(self.result_summary) if self.result_summary else {},
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }
