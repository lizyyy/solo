from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class SurveyPlan(Base):
    __tablename__ = "survey_plans"

    id = Column(Integer, primary_key=True, index=True)
    plan_code = Column(String(64), unique=True, index=True, comment="方案编号，幂等键")
    plan_name = Column(String(200), comment="方案名称")
    building_address = Column(String(300), comment="旧楼地址")
    submitter = Column(String(64), comment="提交人")
    survey_method = Column(String(64), comment="测绘方式：如'三维激光扫描'/'全站仪+RTK'")
    total_stations = Column(Integer, default=0, comment="测站数")
    status = Column(String(32), default="pending", comment="pending/approved/rejected/supplement")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    remark = Column(Text, default="", comment="备注")
    idempotency_hash = Column(String(64), index=True, comment="请求哈希，用于幂等判重")

    layers = relationship("CadLayer", back_populates="plan", cascade="all, delete-orphan")
    collision_points = relationship("CollisionPoint", back_populates="plan", cascade="all, delete-orphan")
    manual_judgments = relationship("ManualJudgment", back_populates="plan", cascade="all, delete-orphan")
    review_histories = relationship("ReviewHistory", back_populates="plan", cascade="all, delete-orphan")


class CadLayer(Base):
    __tablename__ = "cad_layers"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("survey_plans.id"), index=True)
    layer_name = Column(String(200), comment="图层原始名称")
    normalized_name = Column(String(200), default="", comment="规范化后的名称")
    layer_type = Column(String(32), default="unknown", comment="图层类型：structure/wall/pipe/electrical/unknown")
    entity_count = Column(Integer, default=0, comment="实体数量")
    is_valid = Column(Boolean, default=True, comment="命名是否规范")
    block_reason = Column(String(500), default="", comment="拦截原因")
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)

    plan = relationship("SurveyPlan", back_populates="layers")


class CollisionPoint(Base):
    __tablename__ = "collision_points"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("survey_plans.id"), index=True)
    point_code = Column(String(64), unique=True, index=True, comment="碰撞点编码，全局唯一锚")
    layer_a = Column(String(200), comment="图层A")
    layer_b = Column(String(200), comment="图层B")
    anchor_x = Column(Float, comment="锚定坐标X（世界坐标系）")
    anchor_y = Column(Float, comment="锚定坐标Y")
    anchor_z = Column(Float, default=0.0, comment="锚定坐标Z")
    view_params = Column(JSON, comment="视角快照参数：旋转角、缩放比、视口范围")
    description = Column(String(500), default="", comment="碰撞描述")
    severity = Column(String(16), default="warning", comment="info/warning/danger")
    is_judged = Column(Boolean, default=False, comment="是否已人工改判")
    created_at = Column(DateTime, default=datetime.now)

    plan = relationship("SurveyPlan", back_populates="collision_points")


class ManualJudgment(Base):
    __tablename__ = "manual_judgments"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("survey_plans.id"), index=True)
    judgment_code = Column(String(64), unique=True, index=True, comment="改判单号，用于幂等去重")
    collision_point_id = Column(Integer, ForeignKey("collision_points.id"), nullable=True)
    point_code = Column(String(64), index=True, comment="冗余存碰撞点编码")
    judge = Column(String(64), comment="判定人")
    original_result = Column(String(32), comment="原始判定：valid_collision/false_alarm")
    final_result = Column(String(32), comment="最终判定")
    reason = Column(String(500), comment="改判理由")
    evidence = Column(JSON, comment="佐证材料（坐标复核、照片引用）")
    created_at = Column(DateTime, default=datetime.now)

    plan = relationship("SurveyPlan", back_populates="manual_judgments")


class ReviewHistory(Base):
    __tablename__ = "review_histories"

    id = Column(Integer, primary_key=True, index=True)
    plan_id = Column(Integer, ForeignKey("survey_plans.id"), index=True)
    reviewer = Column(String(64), comment="审核人")
    action = Column(String(32), comment="submit/approve/reject/judgment_change")
    before_snapshot = Column(JSON, comment="变更前快照")
    after_snapshot = Column(JSON, comment="变更后快照")
    diff_summary = Column(Text, comment="文字版差异摘要，用于社区沟通")
    comment = Column(String(500), default="")
    created_at = Column(DateTime, default=datetime.now)

    plan = relationship("SurveyPlan", back_populates="review_histories")
