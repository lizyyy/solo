from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PaperStock(BaseModel):
    id: str
    paper_type: str
    paper_size: Optional[str] = None
    paper_width: Optional[float] = None
    paper_height: Optional[float] = None
    quantity: int = 0
    unit: str = "sheets"
    minimum_threshold: int = 100
    
    supplier: Optional[str] = None
    purchase_date: Optional[datetime] = None
    location: Optional[str] = None
    
    notes: Optional[str] = None
    
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    @property
    def is_low(self) -> bool:
        return self.quantity <= self.minimum_threshold
    
    @property
    def available_quantity(self) -> int:
        return self.quantity
    
    def deduct(self, amount: int) -> bool:
        if self.quantity >= amount:
            self.quantity -= amount
            self.updated_at = datetime.now()
            return True
        return False
    
    def add(self, amount: int):
        self.quantity += amount
        self.updated_at = datetime.now()
