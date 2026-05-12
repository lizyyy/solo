from dataclasses import dataclass, field
from typing import List, Optional
from .base import BaseModel


@dataclass
class FridgeLocation(BaseModel):
    fridge_id: str = ""
    fridge_name: str = ""
    compartment: str = ""
    shelf: str = ""
    position: str = ""
    is_occupied: bool = False
    current_sample_id: Optional[str] = None
    notes: Optional[str] = None

    def get_full_location(self) -> str:
        return f"{self.fridge_name}/{self.compartments}/{self.shelf}/{self.position}"
