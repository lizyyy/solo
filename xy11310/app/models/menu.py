from sqlalchemy import Column, Integer, String, Text, DateTime, Date, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Menu(Base):
    __tablename__ = "menus"

    id = Column(Integer, primary_key=True, index=True)
    menu_date = Column(Date, unique=True, index=True, nullable=False)
    
    breakfast = Column(JSON)
    lunch = Column(JSON)
    dinner = Column(JSON)
    
    breakfast_allergens = Column(JSON, default=list)
    lunch_allergens = Column(JSON, default=list)
    dinner_allergens = Column(JSON, default=list)
    
    notes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
