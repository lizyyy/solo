from enum import Enum
from typing import Optional
from datetime import datetime, timedelta
from .models import LinenStatus, Inventory

class LinenState(Enum):
    IN_ROOM = "IN_ROOM"
    IN_WASH = "IN_WASH"
    RETURNED = "RETURNED"
    LOST = "LOST"
    DAMAGED = "DAMAGED"

class StateMachine:
    @staticmethod
    def next_state(current_state: Optional[str], action: str) -> LinenState:
        if action == "SEND":
            if current_state in [None, LinenState.IN_ROOM.value, LinenState.RETURNED.value]:
                return LinenState.IN_WASH
        elif action == "RECEIVE":
            if current_state == LinenState.IN_WASH.value:
                return LinenState.RETURNED
        elif action == "REPORT_LOSS":
            return LinenState.LOST
        elif action == "REPORT_DAMAGE":
            return LinenState.DAMAGED
        raise ValueError(f"Invalid state transition: {current_state} -> {action}")

    @staticmethod
    def check_timeout(linen: LinenStatus, timeout_hours: int) -> bool:
        if linen.status == LinenState.IN_WASH.value and linen.send_time:
            elapsed = datetime.utcnow() - linen.send_time
            return elapsed > timedelta(hours=timeout_hours)
        return False

    @staticmethod
    def check_max_cycles(inventory: Inventory, max_cycles: dict) -> bool:
        max_cycle = max_cycles.get(inventory.type, 1000)
        return inventory.wash_cycles >= max_cycle
