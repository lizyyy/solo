from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..database import Base


class GridStatus(str, enum.Enum):
    ACTIVE = "正常"
    SUSPENDED = "停用"
    MERGED = "已合并"
    SPLIT = "已拆分"


class FarmGrid(Base):
    __tablename__ = "farm_grids"
    
    id = Column(Integer, primary_key=True, index=True)
    
    grid_code = Column(String(50), unique=True, nullable=False, index=True, comment="地块编号")
    grid_name = Column(String(200), nullable=False, comment="地块名称")
    
    parent_grid_code = Column(String(50), index=True, comment="上级地块编号")
    
    crop_type = Column(String(100), comment="作物类型")
    planting_date = Column(DateTime, comment="种植日期")
    
    area_mu = Column(Float, default=0.0, comment="面积(亩)")
    area_km2 = Column(Float, default=0.0, comment="面积(平方公里)")
    
    center_longitude = Column(Float, nullable=False, comment="中心点经度")
    center_latitude = Column(Float, nullable=False, comment="中心点纬度")
    
    boundary_coordinates = Column(JSON, comment="边界坐标点集合")
    
    grid_level = Column(Integer, default=1, comment="地块层级")
    grid_index_x = Column(Integer, comment="网格X索引")
    grid_index_y = Column(Integer, comment="网格Y索引")
    
    region = Column(String(100), comment="所属区域")
    village = Column(String(100), comment="所属村庄")
    farmer_name = Column(String(100), comment="农户姓名")
    farmer_phone = Column(String(20), comment="联系电话")
    
    status = Column(Enum(GridStatus), default=GridStatus.ACTIVE, comment="地块状态")
    
    created_by = Column(String(100), nullable=False, comment="创建人")
    created_at = Column(DateTime, default=datetime.now, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, comment="更新时间")
    
    remark = Column(Text, comment="备注")
    
    lesions = relationship("LesionRecord", back_populates="grid")
    
    def __repr__(self):
        return f"<FarmGrid {self.grid_code} - {self.grid_name}>"
