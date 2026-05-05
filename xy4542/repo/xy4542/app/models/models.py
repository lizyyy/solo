from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.config import Base


class TellerPayment(Base):
    __tablename__ = "teller_payments"

    id = Column(Integer, primary_key=True, index=True)
    teller_no = Column(String(20), index=True, comment="柜员号")
    teller_name = Column(String(50), comment="柜员姓名")
    business_date = Column(String(10), index=True, comment="营业日期")
    payment_time = Column(DateTime, default=datetime.utcnow, comment="缴款时间")
    currency = Column(String(3), default="CNY", comment="币种")
    denomination = Column(Integer, comment="面额")
    quantity = Column(Integer, comment="数量")
    amount = Column(Float, comment="金额")
    bundle_no = Column(String(50), index=True, comment="扎把编号")
    source_file = Column(String(100), comment="来源文件")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SortingLog(Base):
    __tablename__ = "sorting_logs"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    machine_no = Column(String(20), comment="清分机号")
    operator = Column(String(50), comment="操作员")
    serial_number = Column(String(20), index=True, comment="冠字号")
    denomination = Column(Integer, comment="面额")
    version = Column(String(10), comment="版本")
    bundle_no = Column(String(50), index=True, comment="扎把编号")
    sort_result = Column(String(20), comment="清分结果")
    source_file = Column(String(100), comment="来源文件")
    created_at = Column(DateTime, default=datetime.utcnow)


class BundleTag(Base):
    __tablename__ = "bundle_tags"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    bundle_no = Column(String(50), unique=True, index=True, comment="扎把编号")
    denomination = Column(Integer, comment="面额")
    quantity = Column(Integer, default=100, comment="数量")
    amount = Column(Float, comment="金额")
    operator = Column(String(50), comment="操作员")
    bundle_time = Column(DateTime, comment="扎把时间")
    start_serial = Column(String(20), comment="起始冠字号")
    end_serial = Column(String(20), comment="结束冠字号")
    source_file = Column(String(100), comment="来源文件")
    created_at = Column(DateTime, default=datetime.utcnow)


class ATMPlan(Base):
    __tablename__ = "atm_plans"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    atm_no = Column(String(20), index=True, comment="ATM编号")
    atm_location = Column(String(100), comment="ATM位置")
    box_no = Column(String(10), index=True, comment="钞箱编号")
    denomination = Column(Integer, comment="面额")
    plan_quantity = Column(Integer, comment="计划数量")
    plan_amount = Column(Float, comment="计划金额")
    actual_quantity = Column(Integer, nullable=True, comment="实际数量")
    actual_amount = Column(Float, nullable=True, comment="实际金额")
    bundle_nos = Column(Text, comment="扎把编号列表(逗号分隔)")
    source_file = Column(String(100), comment="来源文件")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ErrorRemark(Base):
    __tablename__ = "error_remarks"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    error_type = Column(String(50), index=True, comment="差错类型")
    reference_id = Column(String(50), index=True, comment="关联ID(扎把号/柜员号等)")
    amount = Column(Float, nullable=True, comment="差错金额")
    description = Column(Text, comment="差错描述")
    operator = Column(String(50), comment="操作人")
    remark_time = Column(DateTime, default=datetime.utcnow, comment="备注时间")
    is_resolved = Column(Boolean, default=False, comment="是否已解决")
    source_file = Column(String(100), comment="来源文件")
    created_at = Column(DateTime, default=datetime.utcnow)


class Bundle(Base):
    __tablename__ = "bundles"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    bundle_no = Column(String(50), unique=True, index=True, comment="扎把编号")
    denomination = Column(Integer, comment="面额")
    quantity = Column(Integer, default=100, comment="数量")
    amount = Column(Float, comment="金额")
    teller_no = Column(String(20), nullable=True, index=True, comment="所属柜员")
    is_duplicate = Column(Boolean, default=False, comment="是否重复入库")
    status = Column(String(20), default="pending", comment="状态: pending/verified/rejected")
    source = Column(String(20), comment="来源: teller/atm")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RiskAlert(Base):
    __tablename__ = "risk_alerts"

    id = Column(Integer, primary_key=True, index=True)
    business_date = Column(String(10), index=True, comment="营业日期")
    alert_type = Column(String(50), index=True, comment="风险类型")
    alert_code = Column(String(20), index=True, comment="风险编码")
    severity = Column(String(20), default="medium", comment="严重程度: low/medium/high")
    reference_id = Column(String(50), index=True, comment="关联ID")
    description = Column(Text, comment="风险描述")
    expected_value = Column(String(100), nullable=True, comment="期望值")
    actual_value = Column(String(100), nullable=True, comment="实际值")
    is_reviewed = Column(Boolean, default=False, comment="是否已复核")
    reviewed_by = Column(String(50), nullable=True, comment="复核人")
    reviewed_at = Column(DateTime, nullable=True, comment="复核时间")
    review_remark = Column(Text, nullable=True, comment="复核备注")
    created_at = Column(DateTime, default=datetime.utcnow)


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    risk_alert_id = Column(Integer, ForeignKey("risk_alerts.id"), comment="风险预警ID")
    reviewer = Column(String(50), comment="复核人")
    review_time = Column(DateTime, default=datetime.utcnow, comment="复核时间")
    decision = Column(String(20), comment="复核结论: confirm/dismiss")
    remark = Column(Text, comment="复核备注")
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), index=True, comment="操作类型")
    operator = Column(String(50), comment="操作人")
    business_date = Column(String(10), nullable=True, index=True, comment="营业日期")
    details = Column(Text, comment="操作详情")
    created_at = Column(DateTime, default=datetime.utcnow)
