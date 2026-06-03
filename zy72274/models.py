from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class InspectionPhoto(Base):
    __tablename__ = "inspection_photos"

    id = Column(Integer, primary_key=True, index=True)
    photo_number = Column(String(100), unique=True, index=True, nullable=False)
    floor = Column(String(50))
    location_x = Column(Float)
    location_y = Column(Float)
    location_z = Column(Float)
    route_length = Column(Float, comment="巡检路线长度")
    has_recalculated_length = Column(Boolean, default=True, comment="是否重新计算过长度")
    raw_data = Column(Text, comment="原始导入数据，不做清洗")
    import_batch_id = Column(String(100), index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cad_layers = relationship("CADLayer", back_populates="photo")
    profiles = relationship("RescueProfile", back_populates="photo")
    history = relationship("ChangeHistory", back_populates="photo")


class CADLayer(Base):
    __tablename__ = "cad_layers"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("inspection_photos.id"), nullable=False)
    layer_name = Column(String(200), nullable=False, comment="CAD图层全名，含备注")
    layer_name_clean = Column(String(100), comment="清洗后的图层名（仅展示用）")
    layer_remark = Column(Text, comment="CAD图层备注，许工补录内容")
    layer_material = Column(String(200), comment="图层材质信息")
    layer_thickness = Column(Float)
    has_remark = Column(Boolean, default=False, comment="是否有备注信息")
    reviewed_by = Column(String(50), comment="复核人，如'许工'")
    reviewed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    photo = relationship("InspectionPhoto", back_populates="cad_layers")


class RescueProfile(Base):
    __tablename__ = "rescue_profiles"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("inspection_photos.id"), nullable=False)
    profile_type = Column(String(20), default="2d", comment="2d/3d/chart")
    floor_section = Column(String(100))
    rescue_route = Column(Text, comment="救援路线描述")
    route_points = Column(Text, comment="路线坐标点JSON")
    status = Column(String(20), default="pending", comment="pending/reviewed/normal/abnormal")
    length_mismatch = Column(Boolean, default=False, comment="是否存在补录路线未重新计算长度")
    needs_review = Column(Boolean, default=False, comment="是否需要客户复核")
    screenshot_path = Column(String(500))
    workflow_step = Column(String(50), default="photo_import")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    photo = relationship("InspectionPhoto", back_populates="profiles")


class ChangeHistory(Base):
    __tablename__ = "change_history"

    id = Column(Integer, primary_key=True, index=True)
    photo_id = Column(Integer, ForeignKey("inspection_photos.id"))
    profile_id = Column(Integer, ForeignKey("rescue_profiles.id"))
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text, comment="修改前的值（保留完整备注）")
    new_value = Column(Text, comment="修改后的值（保留完整备注）")
    changed_by = Column(String(50))
    change_reason = Column(String(500))
    rollback_possible = Column(Boolean, default=True)
    rolled_back = Column(Boolean, default=False)
    rollback_from_id = Column(Integer, comment="从哪条历史回滚")
    created_at = Column(DateTime, default=datetime.utcnow)

    photo = relationship("InspectionPhoto", back_populates="history")


class ImportBatch(Base):
    __tablename__ = "import_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(100), unique=True, index=True, nullable=False)
    source_file = Column(String(500))
    total_count = Column(Integer, default=0)
    new_count = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)
    imported_by = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
