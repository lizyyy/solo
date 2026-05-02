from dataclasses import dataclass, field
from typing import List, Optional, Dict
import uuid
from datetime import datetime

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings
from models.validation import ValidationResult


@dataclass
class ProjectStats:
    total_pieces: int = 0
    placed_pieces: int = 0
    total_area: float = 0.0
    fabric_used_length: float = 0.0
    fabric_total_area: float = 0.0
    waste_rate: float = 0.0

    def to_dict(self) -> dict:
        return {
            "total_pieces": self.total_pieces,
            "placed_pieces": self.placed_pieces,
            "total_area": self.total_area,
            "fabric_used_length": self.fabric_used_length,
            "fabric_total_area": self.fabric_total_area,
            "waste_rate": self.waste_rate
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProjectStats":
        return cls(
            total_pieces=data.get("total_pieces", 0),
            placed_pieces=data.get("placed_pieces", 0),
            total_area=data.get("total_area", 0.0),
            fabric_used_length=data.get("fabric_used_length", 0.0),
            fabric_total_area=data.get("fabric_total_area", 0.0),
            waste_rate=data.get("waste_rate", 0.0)
        )


@dataclass
class Project:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    name: str = "未命名项目"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""
    
    pieces: List[Piece] = field(default_factory=list)
    placements: List[PiecePlacement] = field(default_factory=list)
    fabric_settings: FabricSettings = field(default_factory=FabricSettings)
    validation_result: ValidationResult = field(default_factory=ValidationResult)
    stats: ProjectStats = field(default_factory=ProjectStats)

    def update_timestamp(self):
        self.updated_at = datetime.now().isoformat()

    def get_piece_by_id(self, piece_id: str) -> Optional[Piece]:
        for piece in self.pieces:
            if piece.id == piece_id:
                return piece
        return None

    def get_placement_by_piece_id(self, piece_id: str) -> Optional[PiecePlacement]:
        for placement in self.placements:
            if placement.piece.id == piece_id:
                return placement
        return None

    def add_piece(self, piece: Piece):
        self.pieces.append(piece)
        placement = PiecePlacement(piece=piece)
        self.placements.append(placement)
        self.update_timestamp()

    def remove_piece(self, piece_id: str):
        self.pieces = [p for p in self.pieces if p.id != piece_id]
        self.placements = [p for p in self.placements if p.piece.id != piece_id]
        self.update_timestamp()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "notes": self.notes,
            "pieces": [p.to_dict() for p in self.pieces],
            "placements": [p.to_dict() for p in self.placements],
            "fabric_settings": self.fabric_settings.to_dict(),
            "validation_result": self.validation_result.to_dict(),
            "stats": self.stats.to_dict()
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Project":
        project = cls(
            id=data.get("id", str(uuid.uuid4())),
            name=data.get("name", "未命名项目"),
            created_at=data.get("created_at", datetime.now().isoformat()),
            updated_at=data.get("updated_at", datetime.now().isoformat()),
            notes=data.get("notes", "")
        )
        
        pieces_data = data.get("pieces", [])
        project.pieces = [Piece.from_dict(p) for p in pieces_data]
        
        placements_data = data.get("placements", [])
        project.placements = [PiecePlacement.from_dict(p) for p in placements_data]
        
        fabric_data = data.get("fabric_settings", {})
        project.fabric_settings = FabricSettings.from_dict(fabric_data)
        
        validation_data = data.get("validation_result", {})
        project.validation_result = ValidationResult.from_dict(validation_data)
        
        stats_data = data.get("stats", {})
        project.stats = ProjectStats.from_dict(stats_data)
        
        return project
