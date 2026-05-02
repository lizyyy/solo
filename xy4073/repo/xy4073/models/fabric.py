from dataclasses import dataclass, field
from typing import List, Optional, Tuple
from geometry.point import Point
from geometry.rectangle import Rectangle


@dataclass
class NoPlaceZone:
    id: str = ""
    name: str = ""
    zone: Rectangle = field(default_factory=Rectangle)
    reason: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "zone": {
                "x": self.zone.x,
                "y": self.zone.y,
                "width": self.zone.width,
                "height": self.zone.height
            },
            "reason": self.reason
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NoPlaceZone":
        zone_data = data.get("zone", {})
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            zone=Rectangle(
                zone_data.get("x", 0),
                zone_data.get("y", 0),
                zone_data.get("width", 0),
                zone_data.get("height", 0)
            ),
            reason=data.get("reason", "")
        )


@dataclass
class FabricSettings:
    id: str = "default"
    name: str = "默认布料"
    width: float = 150.0
    shrinkage_x: float = 0.0
    shrinkage_y: float = 0.0
    grain_direction: float = 0.0
    has_plaid: bool = False
    plaid_width_x: float = 10.0
    plaid_width_y: float = 10.0
    plaid_offset_x: float = 0.0
    plaid_offset_y: float = 0.0
    no_place_zones: List[NoPlaceZone] = field(default_factory=list)
    safety_margin: float = 0.5

    def get_effective_width(self) -> float:
        return self.width * (1 + self.shrinkage_x / 100.0)

    def get_effective_length(self, length: float) -> float:
        return length * (1 + self.shrinkage_y / 100.0)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "width": self.width,
            "shrinkage_x": self.shrinkage_x,
            "shrinkage_y": self.shrinkage_y,
            "grain_direction": self.grain_direction,
            "has_plaid": self.has_plaid,
            "plaid_width_x": self.plaid_width_x,
            "plaid_width_y": self.plaid_width_y,
            "plaid_offset_x": self.plaid_offset_x,
            "plaid_offset_y": self.plaid_offset_y,
            "no_place_zones": [z.to_dict() for z in self.no_place_zones],
            "safety_margin": self.safety_margin
        }

    @classmethod
    def from_dict(cls, data: dict) -> "FabricSettings":
        fabric = cls(
            id=data.get("id", "default"),
            name=data.get("name", "默认布料"),
            width=data.get("width", 150.0),
            shrinkage_x=data.get("shrinkage_x", 0.0),
            shrinkage_y=data.get("shrinkage_y", 0.0),
            grain_direction=data.get("grain_direction", 0.0),
            has_plaid=data.get("has_plaid", False),
            plaid_width_x=data.get("plaid_width_x", 10.0),
            plaid_width_y=data.get("plaid_width_y", 10.0),
            plaid_offset_x=data.get("plaid_offset_x", 0.0),
            plaid_offset_y=data.get("plaid_offset_y", 0.0),
            safety_margin=data.get("safety_margin", 0.5)
        )
        zones_data = data.get("no_place_zones", [])
        fabric.no_place_zones = [NoPlaceZone.from_dict(z) for z in zones_data]
        return fabric
