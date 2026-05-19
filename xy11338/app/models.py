from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    ENGINEER = "engineer"
    WAREHOUSE = "warehouse"
    CLAIM = "claim"
    FINANCE = "finance"


class PartStatus(str, enum.Enum):
    IN_STOCK = "in_stock"
    ALLOCATED = "allocated"
    ISSUED = "issued"
    INSTALLED = "installed"
    RETURNED = "returned"
    DEFECTIVE = "defective"
    CLAIMED = "claimed"
    WRITTEN_OFF = "written_off"


class ClaimStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    PAID = "paid"
    CLOSED = "closed"


class VerificationResult(str, enum.Enum):
    PASSED = "passed"
    BLOCKED = "blocked"
    WARNING = "warning"


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    phone = Column(String(20))
    role = Column(String(20), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    issues = relationship("Issue", back_populates="engineer", foreign_keys="Issue.engineer_id")
    installations = relationship("Installation", back_populates="engineer", foreign_keys="Installation.engineer_id")
    returns = relationship("PartReturn", back_populates="received_by", foreign_keys="PartReturn.received_by_id")


class Part(Base):
    __tablename__ = "parts"
    
    id = Column(Integer, primary_key=True, index=True)
    part_code = Column(String(50), unique=True, index=True, nullable=False)
    part_name = Column(String(200), nullable=False)
    category = Column(String(100))
    brand = Column(String(100))
    model = Column(String(100))
    unit_price = Column(Float, nullable=False)
    stock_quantity = Column(Integer, default=0)
    min_stock = Column(Integer, default=5)
    location = Column(String(100))
    batch_no = Column(String(50), index=True)
    status = Column(String(20), default=PartStatus.IN_STOCK)
    is_old_part = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    issues = relationship("IssueItem", back_populates="part")
    returns = relationship("ReturnItem", back_populates="part")


class Issue(Base):
    __tablename__ = "issues"
    
    id = Column(Integer, primary_key=True, index=True)
    issue_no = Column(String(50), unique=True, index=True, nullable=False)
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    work_order_no = Column(String(50), index=True)
    customer_name = Column(String(100))
    customer_phone = Column(String(20))
    customer_address = Column(String(255))
    appliance_type = Column(String(100))
    appliance_model = Column(String(100))
    fault_description = Column(Text)
    batch_no = Column(String(50), index=True)
    is_installed = Column(Boolean, default=False)
    installed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    engineer = relationship("User", back_populates="issues", foreign_keys=[engineer_id])
    items = relationship("IssueItem", back_populates="issue", cascade="all, delete-orphan")
    installation = relationship("Installation", back_populates="issue", uselist=False)
    returns = relationship("PartReturn", back_populates="issue")


class IssueItem(Base):
    __tablename__ = "issue_items"
    
    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    status = Column(String(20), default=PartStatus.ISSUED)
    old_part_expected = Column(Boolean, default=True)
    old_part_returned = Column(Boolean, default=False)
    remarks = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    issue = relationship("Issue", back_populates="items")
    part = relationship("Part", back_populates="issues")


class Installation(Base):
    __tablename__ = "installations"
    
    id = Column(Integer, primary_key=True, index=True)
    installation_no = Column(String(50), unique=True, index=True, nullable=False)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    engineer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    work_order_no = Column(String(50), index=True)
    serial_number = Column(String(100))
    installation_date = Column(DateTime(timezone=True), nullable=False)
    customer_signature = Column(String(255))
    remarks = Column(Text)
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    issue = relationship("Issue", back_populates="installation")
    engineer = relationship("User", back_populates="installations", foreign_keys=[engineer_id])


class PartReturn(Base):
    __tablename__ = "part_returns"
    
    id = Column(Integer, primary_key=True, index=True)
    return_no = Column(String(50), unique=True, index=True, nullable=False)
    issue_id = Column(Integer, ForeignKey("issues.id"), nullable=False)
    received_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    return_date = Column(DateTime(timezone=True), nullable=False)
    tracking_number = Column(String(100))
    warehouse_remarks = Column(Text)
    batch_no = Column(String(50), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    issue = relationship("Issue", back_populates="returns")
    received_by = relationship("User", back_populates="returns", foreign_keys=[received_by_id])
    items = relationship("ReturnItem", back_populates="part_return", cascade="all, delete-orphan")


class ReturnItem(Base):
    __tablename__ = "return_items"
    
    id = Column(Integer, primary_key=True, index=True)
    part_return_id = Column(Integer, ForeignKey("part_returns.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    is_defective = Column(Boolean, default=True)
    defect_description = Column(Text)
    condition_verified = Column(Boolean, default=False)
    batch_no = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    part_return = relationship("PartReturn", back_populates="items")
    part = relationship("Part", back_populates="returns")


class Claim(Base):
    __tablename__ = "claims"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_no = Column(String(50), unique=True, index=True, nullable=False)
    vendor = Column(String(100), nullable=False)
    vendor_contact = Column(String(100))
    vendor_phone = Column(String(20))
    total_amount = Column(Float, nullable=False)
    status = Column(String(20), default=ClaimStatus.DRAFT)
    batch_no = Column(String(50), index=True)
    submitted_at = Column(DateTime(timezone=True))
    approved_at = Column(DateTime(timezone=True))
    paid_at = Column(DateTime(timezone=True))
    remarks = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    items = relationship("ClaimItem", back_populates="claim", cascade="all, delete-orphan")
    verifications = relationship("ClaimVerification", back_populates="claim", cascade="all, delete-orphan")
    write_offs = relationship("WriteOff", back_populates="claim")


class ClaimItem(Base):
    __tablename__ = "claim_items"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    return_item_id = Column(Integer, ForeignKey("return_items.id"))
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    part_code = Column(String(50), nullable=False)
    part_name = Column(String(200), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    defect_code = Column(String(50))
    defect_description = Column(Text)
    work_order_no = Column(String(50))
    is_duplicate = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    claim = relationship("Claim", back_populates="items")
    return_item = relationship("ReturnItem")
    part = relationship("Part")


class ClaimVerification(Base):
    __tablename__ = "claim_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    rule_name = Column(String(100), nullable=False)
    result = Column(String(20), nullable=False)
    reason = Column(Text, nullable=False)
    affected_item_ids = Column(Text)
    verified_by = Column(Integer, ForeignKey("users.id"))
    verified_at = Column(DateTime(timezone=True), server_default=func.now())
    
    claim = relationship("Claim", back_populates="verifications")


class WriteOff(Base):
    __tablename__ = "write_offs"
    
    id = Column(Integer, primary_key=True, index=True)
    write_off_no = Column(String(50), unique=True, index=True, nullable=False)
    claim_id = Column(Integer, ForeignKey("claims.id"))
    total_amount = Column(Float, nullable=False)
    reason = Column(Text, nullable=False)
    batch_no = Column(String(50), index=True)
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    claim = relationship("Claim", back_populates="write_offs")
    items = relationship("WriteOffItem", back_populates="write_off", cascade="all, delete-orphan")


class WriteOffItem(Base):
    __tablename__ = "write_off_items"
    
    id = Column(Integer, primary_key=True, index=True)
    write_off_id = Column(Integer, ForeignKey("write_offs.id"), nullable=False)
    part_id = Column(Integer, ForeignKey("parts.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    write_off = relationship("WriteOff", back_populates="items")
    part = relationship("Part")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(100))
    batch_no = Column(String(50), index=True)
    old_value = Column(Text)
    new_value = Column(Text)
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
