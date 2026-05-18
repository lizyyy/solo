from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class Medicine(Base):
    __tablename__ = "medicines"

    id = Column(Integer, primary_key=True, index=True)
    medicine_code = Column(String(50), unique=True, index=True, nullable=False, comment="药品编码")
    medicine_name = Column(String(200), nullable=False, comment="药品名称")
    generic_name = Column(String(200), comment="通用名")
    specification = Column(String(100), comment="规格")
    dosage_form = Column(String(50), comment="剂型")
    manufacturer = Column(String(200), comment="生产厂家")
    batch_number = Column(String(100), comment="批号")
    expiry_date = Column(DateTime, comment="有效期")
    storage_condition = Column(String(200), comment="储存条件")
    category = Column(String(50), comment="药品分类")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, comment="乐观锁版本号")


class Inventory(Base):
    __tablename__ = "inventories"

    id = Column(Integer, primary_key=True, index=True)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    quantity = Column(Integer, nullable=False, comment="库存数量")
    unit = Column(String(20), comment="单位")
    location = Column(String(100), comment="存放位置")
    last_counted_at = Column(DateTime, comment="上次盘点时间")
    last_counted_by = Column(String(100), comment="上次盘点人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, comment="乐观锁版本号")

    medicine = relationship("Medicine", backref="inventories")


class DoctorOrder(Base):
    __tablename__ = "doctor_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_no = Column(String(50), unique=True, index=True, nullable=False, comment="医嘱单号")
    elderly_name = Column(String(100), nullable=False, comment="老人姓名")
    elderly_id_card = Column(String(50), comment="老人身份证号")
    room_number = Column(String(50), comment="房间号")
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    medicine_name = Column(String(200), nullable=False, comment="药品名称")
    dosage = Column(String(100), comment="剂量")
    frequency = Column(String(100), comment="频次")
    start_date = Column(DateTime, nullable=False, comment="开始日期")
    end_date = Column(DateTime, comment="结束日期")
    is_stopped = Column(Boolean, default=False, comment="是否停药")
    stopped_at = Column(DateTime, comment="停药时间")
    stopped_by = Column(String(100), comment="停医嘱人")
    stop_reason = Column(Text, comment="停药原因")
    inventory_synced = Column(Boolean, default=False, comment="库存是否已同步")
    created_by = Column(String(100), comment="创建人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, comment="乐观锁版本号")

    medicine = relationship("Medicine", backref="orders")


class InventoryCheck(Base):
    __tablename__ = "inventory_checks"

    id = Column(Integer, primary_key=True, index=True)
    check_no = Column(String(50), unique=True, index=True, nullable=False, comment="盘点单号")
    check_type = Column(String(50), nullable=False, comment="盘点类型（日盘/周盘/月盘/临时）")
    check_date = Column(DateTime, nullable=False, comment="盘点日期")
    checker = Column(String(100), nullable=False, comment="盘点人")
    supervisor = Column(String(100), comment="监盘人")
    check_area = Column(String(200), comment="盘点区域")
    total_items = Column(Integer, default=0, comment="盘点品项数")
    matched_items = Column(Integer, default=0, comment="账实相符数")
    mismatched_items = Column(Integer, default=0, comment="账实不符数")
    status = Column(String(50), default="draft", comment="状态（草稿/进行中/已完成/已确认）")
    remarks = Column(Text, comment="备注")
    confirmed_by = Column(String(100), comment="确认人")
    confirmed_at = Column(DateTime, comment="确认时间")
    created_by = Column(String(100), comment="创建人")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    version = Column(Integer, default=1, comment="乐观锁版本号")


class InventoryCheckDetail(Base):
    __tablename__ = "inventory_check_details"

    id = Column(Integer, primary_key=True, index=True)
    check_id = Column(Integer, ForeignKey("inventory_checks.id"), nullable=False)
    medicine_id = Column(Integer, ForeignKey("medicines.id"), nullable=False)
    medicine_code = Column(String(50), comment="药品编码")
    medicine_name = Column(String(200), nullable=False, comment="药品名称")
    specification = Column(String(100), comment="规格")
    batch_number = Column(String(100), comment="批号")
    system_quantity = Column(Integer, nullable=False, comment="系统库存数量")
    actual_quantity = Column(Integer, comment="实际盘点数量")
    difference_quantity = Column(Integer, comment="差异数量")
    difference_reason = Column(Text, comment="差异原因")
    unit = Column(String(20), comment="单位")
    is_match = Column(Boolean, comment="是否账实相符")
    checked_by = Column(String(100), comment="盘点人")
    checked_at = Column(DateTime, comment="盘点时间")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    check = relationship("InventoryCheck", backref="details")
    medicine = relationship("Medicine", backref="check_details")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), nullable=False, comment="操作类型")
    business_type = Column(String(50), nullable=False, comment="业务类型")
    business_id = Column(Integer, nullable=False, comment="业务ID")
    business_no = Column(String(100), comment="业务编号")
    operator = Column(String(100), nullable=False, comment="操作人")
    operation_time = Column(DateTime, default=datetime.utcnow, comment="操作时间")
    original_data = Column(Text, comment="原始数据")
    new_data = Column(Text, comment="新数据")
    changed_fields = Column(Text, comment="变更字段")
    ip_address = Column(String(50), comment="IP地址")
    user_agent = Column(String(200), comment="User Agent")
    created_at = Column(DateTime, default=datetime.utcnow)
