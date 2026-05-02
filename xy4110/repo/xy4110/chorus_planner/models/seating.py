"""座位和排座模型"""
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import uuid


@dataclass
class Seat:
    """单个座位"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    row: int = 0
    col: int = 0
    label: str = ""
    
    is_enabled: bool = True
    is_priority: bool = False
    notes: str = ""

    def __post_init__(self):
        if not self.label:
            self.label = f"{self.row+1}排{self.col+1}座"

    def to_dict(self):
        return {
            "id": self.id,
            "row": self.row,
            "col": self.col,
            "label": self.label,
            "is_enabled": self.is_enabled,
            "is_priority": self.is_priority,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            row=data.get("row", 0),
            col=data.get("col", 0),
            label=data.get("label", ""),
            is_enabled=data.get("is_enabled", True),
            is_priority=data.get("is_priority", False),
            notes=data.get("notes", ""),
        )

    def position_key(self):
        """用于排序的位置键"""
        return (self.row, self.col)

    def __repr__(self):
        return f"<Seat {self.label} ({self.id})>"


@dataclass
class SeatingAssignment:
    """座位分配记录"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    seat_id: str = ""
    member_id: str = ""
    
    is_locked: bool = False
    notes: str = ""
    assigned_at: datetime = field(default_factory=datetime.now)

    def to_dict(self):
        return {
            "id": self.id,
            "seat_id": self.seat_id,
            "member_id": self.member_id,
            "is_locked": self.is_locked,
            "notes": self.notes,
            "assigned_at": self.assigned_at.isoformat() if self.assigned_at else None,
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            seat_id=data.get("seat_id", ""),
            member_id=data.get("member_id", ""),
            is_locked=data.get("is_locked", False),
            notes=data.get("notes", ""),
            assigned_at=datetime.fromisoformat(data["assigned_at"]) if data.get("assigned_at") else datetime.now(),
        )

    def __repr__(self):
        return f"<Assignment seat={self.seat_id} member={self.member_id} locked={self.is_locked}>"


@dataclass
class SeatingLayout:
    """座位布局（整个舞台/排练厅的座位网格）"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = "默认布局"
    rows: int = 4
    cols: int = 10
    
    seats: Dict[str, Seat] = field(default_factory=dict)
    assignments: Dict[str, SeatingAssignment] = field(default_factory=dict)
    
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    notes: str = ""

    def __post_init__(self):
        if not self.seats:
            self._initialize_grid()

    def _initialize_grid(self):
        """初始化默认座位网格"""
        self.seats = {}
        for row in range(self.rows):
            for col in range(self.cols):
                seat = Seat(row=row, col=col)
                self.seats[seat.id] = seat

    def get_seat_at(self, row: int, col: int) -> Optional[Seat]:
        """获取指定位置的座位"""
        for seat in self.seats.values():
            if seat.row == row and seat.col == col:
                return seat
        return None

    def get_assignment_by_seat(self, seat_id: str) -> Optional[SeatingAssignment]:
        """获取座位的分配记录"""
        return self.assignments.get(seat_id)

    def get_assignment_by_member(self, member_id: str) -> Optional[SeatingAssignment]:
        """获取成员的座位分配"""
        for assignment in self.assignments.values():
            if assignment.member_id == member_id:
                return assignment
        return None

    def assign_member(self, seat_id: str, member_id: str, is_locked: bool = False) -> SeatingAssignment:
        """分配成员到座位"""
        existing = self.get_assignment_by_member(member_id)
        if existing and existing.seat_id != seat_id:
            del self.assignments[existing.seat_id]
        
        old = self.assignments.get(seat_id)
        if old and old.is_locked:
            raise ValueError(f"座位 {seat_id} 已锁定，无法重新分配")
        
        assignment = SeatingAssignment(
            seat_id=seat_id,
            member_id=member_id,
            is_locked=is_locked
        )
        self.assignments[seat_id] = assignment
        self.updated_at = datetime.now()
        return assignment

    def unassign_seat(self, seat_id: str) -> bool:
        """取消座位分配"""
        assignment = self.assignments.get(seat_id)
        if assignment:
            if assignment.is_locked:
                raise ValueError(f"座位 {seat_id} 已锁定，无法取消分配")
            del self.assignments[seat_id]
            self.updated_at = datetime.now()
            return True
        return False

    def clear_assignments(self, keep_locked: bool = True):
        """清空所有分配"""
        if keep_locked:
            locked = {k: v for k, v in self.assignments.items() if v.is_locked}
            self.assignments = locked
        else:
            self.assignments = {}
        self.updated_at = datetime.now()

    def get_seats_by_row(self, row: int) -> List[Seat]:
        """获取某一排的所有座位（按列排序）"""
        row_seats = [s for s in self.seats.values() if s.row == row and s.is_enabled]
        return sorted(row_seats, key=lambda s: s.col)

    def get_total_enabled_seats(self) -> int:
        """获取启用的座位总数"""
        return sum(1 for s in self.seats.values() if s.is_enabled)

    def get_occupied_seats(self) -> List[Tuple[Seat, SeatingAssignment]]:
        """获取已占用的座位列表"""
        result = []
        for seat_id, assignment in self.assignments.items():
            seat = self.seats.get(seat_id)
            if seat and assignment.member_id:
                result.append((seat, assignment))
        return result

    def resize(self, new_rows: int, new_cols: int):
        """调整座位网格大小"""
        self.rows = new_rows
        self.cols = new_cols
        self._initialize_grid()
        self.updated_at = datetime.now()

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "rows": self.rows,
            "cols": self.cols,
            "seats": {k: v.to_dict() for k, v in self.seats.items()},
            "assignments": {k: v.to_dict() for k, v in self.assignments.items()},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "notes": self.notes,
        }

    @classmethod
    def from_dict(cls, data):
        seats = {}
        for k, v in data.get("seats", {}).items():
            seats[k] = Seat.from_dict(v)
        
        assignments = {}
        for k, v in data.get("assignments", {}).items():
            assignments[k] = SeatingAssignment.from_dict(v)
        
        return cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            name=data.get("name", "默认布局"),
            rows=data.get("rows", 4),
            cols=data.get("cols", 10),
            seats=seats,
            assignments=assignments,
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.now(),
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else datetime.now(),
            notes=data.get("notes", ""),
        )

    def __repr__(self):
        return f"<SeatingLayout {self.name}: {self.rows}x{self.cols}>"
