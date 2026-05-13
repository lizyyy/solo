from datetime import datetime
from enum import Enum


class DefectSeverity(Enum):
    CRITICAL = 'CRITICAL'
    HIGH = 'HIGH'
    MEDIUM = 'MEDIUM'
    LOW = 'LOW'


class TicketStatus(Enum):
    PENDING = 'PENDING'
    ASSIGNED = 'ASSIGNED'
    IN_PROGRESS = 'IN_PROGRESS'
    COMPLETED = 'COMPLETED'
    REINSPECTED = 'REINSPECTED'
    REOPENED = 'REOPENED'
    CLOSED = 'CLOSED'


STATUS_TRANSITIONS = {
    TicketStatus.PENDING: [TicketStatus.ASSIGNED],
    TicketStatus.ASSIGNED: [TicketStatus.IN_PROGRESS],
    TicketStatus.IN_PROGRESS: [TicketStatus.COMPLETED],
    TicketStatus.COMPLETED: [TicketStatus.REINSPECTED, TicketStatus.REOPENED],
    TicketStatus.REOPENED: [TicketStatus.ASSIGNED],
    TicketStatus.REINSPECTED: [TicketStatus.CLOSED],
    TicketStatus.CLOSED: []
}
