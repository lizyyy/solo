import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Date, Float, JSON
from sqlalchemy.orm import relationship
from canteen.database import Base


class ImportStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    PARTIAL = "partial"


class ElderlyStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"


class MenuStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class DeliveryStatus(str, enum.Enum):
    PENDING = "pending"
    PREPARING = "preparing"
    DELIVERING = "delivering"
    DELIVERED = "delivered"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    import_type = Column(String(50), nullable=False)
    file_name = Column(String(255), nullable=False)
    status = Column(String(50), default=ImportStatus.PENDING)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    details = relationship("ImportDetail", back_populates="import_record", cascade="all, delete-orphan")


class ImportDetail(Base):
    __tablename__ = "import_details"

    id = Column(Integer, primary_key=True, index=True)
    import_record_id = Column(Integer, ForeignKey("import_records.id"), nullable=False)
    row_number = Column(Integer, nullable=False)
    raw_data = Column(JSON, nullable=False)
    status = Column(String(50), default=ImportStatus.PENDING)
    error_message = Column(Text, nullable=True)
    fix_suggestion = Column(Text, nullable=True)
    target_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    import_record = relationship("ImportRecord", back_populates="details")


class Elderly(Base):
    __tablename__ = "elderly"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    id_card = Column(String(18), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    gender = Column(String(10), nullable=True)
    age = Column(Integer, nullable=True)
    address = Column(String(500), nullable=True)
    community = Column(String(100), nullable=True)
    building = Column(String(50), nullable=True)
    room = Column(String(50), nullable=True)
    route_code = Column(String(50), nullable=True, index=True)
    dietary_restrictions = Column(JSON, default=list)
    chronic_diseases = Column(JSON, default=list)
    notes = Column(Text, nullable=True)
    status = Column(String(50), default=ElderlyStatus.ACTIVE)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    delivery_assignments = relationship("DeliveryAssignment", back_populates="elderly")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=True)
    price = Column(Float, default=0.0)
    ingredients = Column(JSON, default=list)
    allergens = Column(JSON, default=list)
    suitable_diseases = Column(JSON, default=list)
    unsuitable_diseases = Column(JSON, default=list)
    is_vegetarian = Column(Boolean, default=False)
    is_soft = Column(Boolean, default=False)
    status = Column(String(50), default=MenuStatus.PUBLISHED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyMenu(Base):
    __tablename__ = "daily_menus"

    id = Column(Integer, primary_key=True, index=True)
    menu_date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(50), nullable=False)
    menu_item_ids = Column(JSON, default=list)
    status = Column(String(50), default=MenuStatus.PUBLISHED)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeliveryAssignment(Base):
    __tablename__ = "delivery_assignments"

    id = Column(Integer, primary_key=True, index=True)
    elderly_id = Column(Integer, ForeignKey("elderly.id"), nullable=False)
    delivery_date = Column(Date, nullable=False, index=True)
    meal_type = Column(String(50), nullable=False)
    menu_item_ids = Column(JSON, default=list)
    route_code = Column(String(50), nullable=True, index=True)
    delivery_sequence = Column(Integer, default=0)
    volunteer_name = Column(String(100), nullable=True)
    volunteer_phone = Column(String(20), nullable=True)
    status = Column(String(50), default=DeliveryStatus.PENDING)
    review_status = Column(String(50), default="pending")
    review_notes = Column(Text, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    reviewed_by = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    elderly = relationship("Elderly", back_populates="delivery_assignments")


class Route(Base):
    __tablename__ = "routes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    sequence = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
