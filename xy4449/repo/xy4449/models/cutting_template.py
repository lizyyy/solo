from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


class CuttingSize(BaseModel):
    width: float
    height: float
    quantity: int
    orientation: str = "portrait"


class CuttingTemplate(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    
    paper_width: float
    paper_height: float
    
    cuttings: List[CuttingSize] = Field(default_factory=list)
    
    total_sheets_required: int = 0
    total_pieces: int = 0
    
    waste_percentage: float = 0.0
    
    machine_compatible: List[str] = Field(default_factory=list)
    
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }
    
    def calculate_total_pieces(self) -> int:
        self.total_pieces = sum(c.quantity for c in self.cuttings)
        return self.total_pieces
    
    def calculate_waste(self) -> float:
        if not self.cuttings:
            return 0.0
        
        total_area_used = 0.0
        for cutting in self.cuttings:
            area = cutting.width * cutting.height
            total_area_used += area * cutting.quantity
        
        paper_area = self.paper_width * self.paper_height
        total_available_area = paper_area * self.total_sheets_required
        
        if total_available_area > 0:
            waste = total_available_area - total_area_used
            self.waste_percentage = (waste / total_available_area) * 100
        else:
            self.waste_percentage = 0.0
        
        return self.waste_percentage
    
    def is_compatible_with(self, machine_id: str) -> bool:
        return machine_id in self.machine_compatible or len(self.machine_compatible) == 0
    
    def matches_paper_size(self, width: float, height: float) -> bool:
        tolerance = 0.1
        return (
            (abs(self.paper_width - width) < tolerance and abs(self.paper_height - height) < tolerance) or
            (abs(self.paper_width - height) < tolerance and abs(self.paper_height - width) < tolerance)
        )
