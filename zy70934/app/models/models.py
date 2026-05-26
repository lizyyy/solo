from sqlalchemy import Column, Integer, String, DateTime, Text, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    project_name = Column(String(200), nullable=False, comment="工程名称")
    project_address = Column(String(500), comment="工程地址")
    customer_name = Column(String(100), comment="业主姓名")
    total_amount = Column(Float, default=0, comment="工程总金额")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    nodes = relationship("ConstructionNode", back_populates="project")
    rectification_orders = relationship("RectificationOrder", back_populates="project")
    reconciliation_results = relationship("ReconciliationResult", back_populates="project")


class ConstructionNode(Base):
    __tablename__ = "construction_nodes"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    node_code = Column(String(50), nullable=False, comment="节点编码")
    node_name = Column(String(100), nullable=False, comment="节点名称")
    node_type = Column(String(50), comment="节点类型：水电/泥木/油漆/验收等")
    planned_date = Column(DateTime, comment="计划完成日期")
    actual_date = Column(DateTime, comment="实际完成日期")
    node_amount = Column(Float, default=0, comment="节点金额")
    required_photos = Column(Integer, default=0, comment="要求照片数量")
    status = Column(String(50), default="pending", comment="节点状态")
    csv_source = Column(String(500), comment="CSV来源文件")
    csv_row_data = Column(JSON, comment="CSV原始行数据")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    project = relationship("Project", back_populates="nodes")
    photos = relationship("PhotoRecord", back_populates="node")
    reconciliation_details = relationship("ReconciliationDetail", back_populates="node")


class PhotoRecord(Base):
    __tablename__ = "photo_records"

    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("construction_nodes.id"), nullable=False)
    photo_id = Column(String(100), comment="照片ID")
    photo_name = Column(String(200), comment="照片名称")
    photo_url = Column(String(500), comment="照片URL")
    upload_time = Column(DateTime, comment="上传时间")
    photo_type = Column(String(50), comment="照片类型：验收前/验收后/整改后")
    uploader = Column(String(100), comment="上传人")
    json_source = Column(String(500), comment="JSON来源文件")
    json_data = Column(JSON, comment="JSON原始数据")
    created_at = Column(DateTime, default=datetime.now)

    node = relationship("ConstructionNode", back_populates="photos")


class RectificationOrder(Base):
    __tablename__ = "rectification_orders"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    node_id = Column(Integer, ForeignKey("construction_nodes.id"))
    order_no = Column(String(100), nullable=False, comment="整改单号")
    issue_description = Column(Text, comment="问题描述")
    required_completion_date = Column(DateTime, comment="要求完成日期")
    actual_completion_date = Column(DateTime, comment="实际完成日期")
    rectification_status = Column(String(50), default="pending", comment="整改状态")
    is_rework = Column(Boolean, default=False, comment="是否返工")
    rework_count = Column(Integer, default=0, comment="返工次数")
    fine_amount = Column(Float, default=0, comment="扣款金额")
    source_file = Column(String(500), comment="来源文件")
    raw_data = Column(JSON, comment="原始数据")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    project = relationship("Project", back_populates="rectification_orders")
    reviews = relationship("ReviewRecord", back_populates="rectification_order")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    batch_no = Column(String(100), nullable=False, comment="对账批次号")
    status = Column(String(50), default="draft", comment="对账状态：draft/auto_completed/reviewed/final")
    total_nodes = Column(Integer, default=0, comment="总节点数")
    completed_nodes = Column(Integer, default=0, comment="已完成节点数")
    missing_photo_nodes = Column(Integer, default=0, comment="缺照片节点数")
    overdue_nodes = Column(Integer, default=0, comment="逾期节点数")
    rework_count = Column(Integer, default=0, comment="返工次数")
    total_fine_amount = Column(Float, default=0, comment="总扣款金额")
    payable_amount = Column(Float, default=0, comment="应付金额")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    project = relationship("Project", back_populates="reconciliation_results")
    details = relationship("ReconciliationDetail", back_populates="reconciliation_result")
    review_records = relationship("ReviewRecord", back_populates="reconciliation_result")


class ReconciliationDetail(Base):
    __tablename__ = "reconciliation_details"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_result_id = Column(Integer, ForeignKey("reconciliation_results.id"), nullable=False)
    node_id = Column(Integer, ForeignKey("construction_nodes.id"), nullable=False)
    node_name = Column(String(100), comment="节点名称")
    node_type = Column(String(50), comment="节点类型")
    node_amount = Column(Float, default=0, comment="节点金额")
    planned_date = Column(DateTime, comment="计划日期")
    actual_date = Column(DateTime, comment="实际日期")
    required_photos = Column(Integer, default=0, comment="要求照片数")
    actual_photos = Column(Integer, default=0, comment="实际照片数")
    photo_status = Column(String(50), default="unknown", comment="照片状态：complete/missing/partial")
    is_overdue = Column(Boolean, default=False, comment="是否逾期")
    overdue_days = Column(Integer, default=0, comment="逾期天数")
    has_rectification = Column(Boolean, default=False, comment="是否有整改")
    rectification_count = Column(Integer, default=0, comment="整改次数")
    rework_count = Column(Integer, default=0, comment="返工次数")
    fine_amount = Column(Float, default=0, comment="扣款金额")
    is_rework = Column(Boolean, default=False, comment="是否返工复验")
    final_status = Column(String(50), default="pending", comment="最终状态：approved/rejected/need_material")
    difference_explanation = Column(Text, comment="差异说明")
    auto_check_result = Column(JSON, comment="自动检查结果")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    reconciliation_result = relationship("ReconciliationResult", back_populates="details")
    node = relationship("ConstructionNode", back_populates="reconciliation_details")
    review_records = relationship("ReviewRecord", back_populates="detail")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    reconciliation_result_id = Column(Integer, ForeignKey("reconciliation_results.id"), nullable=False)
    reconciliation_detail_id = Column(Integer, ForeignKey("reconciliation_details.id"))
    rectification_order_id = Column(Integer, ForeignKey("rectification_orders.id"))
    reviewer = Column(String(100), comment="复核人")
    review_action = Column(String(50), comment="复核动作：approve/reject/request_material/adjust_fine")
    review_comment = Column(Text, comment="复核意见")
    adjusted_fine_amount = Column(Float, comment="调整后的扣款金额")
    review_time = Column(DateTime, default=datetime.now)
    difference_source = Column(String(200), comment="差异来源说明")
    evidence = Column(JSON, comment="复核依据")
    created_at = Column(DateTime, default=datetime.now)

    reconciliation_result = relationship("ReconciliationResult", back_populates="review_records")
    detail = relationship("ReconciliationDetail", back_populates="review_records")
    rectification_order = relationship("RectificationOrder", back_populates="reviews")
