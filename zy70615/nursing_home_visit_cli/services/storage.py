import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Type, TypeVar
from pydantic import BaseModel

from ..models import (
    Elder,
    Visitor,
    Room,
    Appointment,
    HealthDeclaration,
    AppointmentStatus
)

T = TypeVar('T', bound=BaseModel)


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, AppointmentStatus):
            return obj.value
        return super().default(obj)


def datetime_decoder(dct):
    for key, value in dct.items():
        if isinstance(value, str) and key in [
            'created_at', 'updated_at', 'scheduled_start',
            'scheduled_end', 'declaration_time', 'changed_at'
        ]:
            try:
                dct[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    return dct


class StorageService:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._ensure_dirs()
        self._load_all()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)

    def _get_file_path(self, entity_type: str) -> str:
        return os.path.join(self.data_dir, f"{entity_type}.json")

    def _save(self, entity_type: str, data: Dict[str, T]):
        file_path = self._get_file_path(entity_type)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(
                {k: v.model_dump() for k, v in data.items()},
                f,
                cls=DateTimeEncoder,
                ensure_ascii=False,
                indent=2
            )

    def _load(self, entity_type: str, cls: Type[T]) -> Dict[str, T]:
        file_path = self._get_file_path(entity_type)
        if not os.path.exists(file_path):
            return {}
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f, object_hook=datetime_decoder)
        return {k: cls(**v) for k, v in data.items()}

    def _load_all(self):
        self.elders: Dict[str, Elder] = self._load('elders', Elder)
        self.visitors: Dict[str, Visitor] = self._load('visitors', Visitor)
        self.rooms: Dict[str, Room] = self._load('rooms', Room)
        self.appointments: Dict[str, Appointment] = self._load('appointments', Appointment)
        self.health_declarations: Dict[str, HealthDeclaration] = self._load(
            'health_declarations',
            HealthDeclaration
        )

    def save_all(self):
        self._save('elders', self.elders)
        self._save('visitors', self.visitors)
        self._save('rooms', self.rooms)
        self._save('appointments', self.appointments)
        self._save('health_declarations', self.health_declarations)

    def add_elder(self, elder: Elder):
        self.elders[elder.id] = elder
        self.save_all()

    def add_visitor(self, visitor: Visitor):
        self.visitors[visitor.id] = visitor
        self.save_all()

    def add_room(self, room: Room):
        self.rooms[room.id] = room
        self.save_all()

    def add_appointment(self, appointment: Appointment):
        self.appointments[appointment.id] = appointment
        self.save_all()

    def add_health_declaration(self, declaration: HealthDeclaration):
        self.health_declarations[declaration.id] = declaration
        self.save_all()

    def get_elder(self, elder_id: str) -> Optional[Elder]:
        return self.elders.get(elder_id)

    def get_visitor(self, visitor_id: str) -> Optional[Visitor]:
        return self.visitors.get(visitor_id)

    def get_room(self, room_id: str) -> Optional[Room]:
        return self.rooms.get(room_id)

    def get_room_by_number(self, room_number: str) -> Optional[Room]:
        for room in self.rooms.values():
            if room.room_number == room_number:
                return room
        return None

    def get_appointment(self, appointment_id: str) -> Optional[Appointment]:
        return self.appointments.get(appointment_id)

    def get_all_appointments(self) -> List[Appointment]:
        return list(self.appointments.values())

    def get_all_elders(self) -> List[Elder]:
        return list(self.elders.values())

    def get_all_visitors(self) -> List[Visitor]:
        return list(self.visitors.values())

    def get_all_rooms(self) -> List[Room]:
        return list(self.rooms.values())

    def update_appointment(self, appointment: Appointment):
        self.appointments[appointment.id] = appointment
        self.save_all()
