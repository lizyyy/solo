from datetime import datetime, timedelta
from enum import Enum
from typing import Optional, List, Dict
from pydantic import BaseModel, Field, field_validator, model_validator
import hashlib


class LeaseStatus(str, Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    RELEASED = "released"
    FORCE_RELEASED = "force_released"


class EnvironmentStatus(str, Enum):
    OCCUPIED = "occupied"
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"


class Lease(BaseModel):
    lease_id: Optional[str] = None
    env_id: str
    branch_name: str
    assignee: str
    start_time: datetime
    end_time: datetime
    reason: str
    status: LeaseStatus = LeaseStatus.ACTIVE
    release_reason: Optional[str] = None
    release_time: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.now)
    request_id: Optional[str] = None

    @model_validator(mode='after')
    def generate_lease_id(self):
        if self.lease_id:
            return self
        unique_str = f"{self.env_id}-{self.branch_name}-{self.assignee}-{self.start_time}"
        self.lease_id = hashlib.md5(unique_str.encode()).hexdigest()[:12]
        return self

    def is_expired(self, at_time: Optional[datetime] = None) -> bool:
        check_time = at_time or datetime.now()
        return check_time > self.end_time and self.status == LeaseStatus.ACTIVE

    def remaining_time(self, at_time: Optional[datetime] = None) -> Optional[timedelta]:
        if self.status != LeaseStatus.ACTIVE:
            return None
        check_time = at_time or datetime.now()
        if check_time > self.end_time:
            return timedelta(0)
        return self.end_time - check_time

    def model_dump(self, **kwargs):
        data = super().model_dump(**kwargs)
        if 'start_time' in data:
            data['start_time'] = data['start_time'].isoformat() if data['start_time'] else None
        if 'end_time' in data:
            data['end_time'] = data['end_time'].isoformat() if data['end_time'] else None
        if 'created_at' in data:
            data['created_at'] = data['created_at'].isoformat() if data['created_at'] else None
        if 'release_time' in data:
            data['release_time'] = data['release_time'].isoformat() if data['release_time'] else None
        return data


class Environment(BaseModel):
    env_id: str
    name: str
    status: EnvironmentStatus = EnvironmentStatus.AVAILABLE
    current_lease: Optional[Lease] = None
    lease_history: List[Lease] = Field(default_factory=list)

    def is_available(self) -> bool:
        return self.status == EnvironmentStatus.AVAILABLE and self.current_lease is None

    def can_renew(self, assignee: str) -> bool:
        if self.current_lease is None:
            return False
        return self.current_lease.assignee == assignee and self.current_lease.status == LeaseStatus.ACTIVE

    def has_conflict(self, branch_name: str = None) -> bool:
        if self.current_lease is None:
            return False
        if self.current_lease.status != LeaseStatus.ACTIVE:
            return False
        if branch_name and self.current_lease.branch_name != branch_name:
            return True
        return True


class LeaseManager:
    def __init__(self):
        self.environments: Dict[str, Environment] = {}
        self.leases: Dict[str, Lease] = {}
        self.request_ids: set = set()

    def add_environment(self, env: Environment):
        self.environments[env.env_id] = env

    def is_idempotent(self, request_id: str) -> bool:
        return request_id in self.request_ids

    def create_lease(self, env_id: str, branch_name: str, assignee: str,
                     duration_hours: int, reason: str, request_id: str = None) -> Dict:
        if request_id and self.is_idempotent(request_id):
            return {
                'success': True,
                'idempotent': True,
                'message': 'Duplicate request, already processed',
                'lease': None
            }

        if env_id not in self.environments:
            return {
                'success': False,
                'error': f'Environment {env_id} not found'
            }

        env = self.environments[env_id]

        if env.status == EnvironmentStatus.MAINTENANCE:
            return {
                'success': False,
                'error': f'Environment {env_id} is under maintenance'
            }

        if env.current_lease and env.current_lease.status == LeaseStatus.ACTIVE:
            return {
                'success': False,
                'error': f'Environment {env_id} is already occupied by {env.current_lease.assignee}',
                'conflict': {
                    'env_id': env_id,
                    'current_assignee': env.current_lease.assignee,
                    'current_branch': env.current_lease.branch_name,
                    'remaining_hours': env.current_lease.remaining_time().total_seconds() / 3600
                }
            }

        start_time = datetime.now()
        end_time = start_time + timedelta(hours=duration_hours)

        lease = Lease(
            env_id=env_id,
            branch_name=branch_name,
            assignee=assignee,
            start_time=start_time,
            end_time=end_time,
            reason=reason,
            request_id=request_id
        )

        if request_id:
            self.request_ids.add(request_id)

        self.leases[lease.lease_id] = lease
        env.current_lease = lease
        env.status = EnvironmentStatus.OCCUPIED
        env.lease_history.append(lease)

        return {
            'success': True,
            'lease': lease
        }

    def renew_lease(self, env_id: str, assignee: str, duration_hours: int,
                    reason: str, request_id: str = None) -> Dict:
        if request_id and self.is_idempotent(request_id):
            return {
                'success': True,
                'idempotent': True,
                'message': 'Duplicate request, already processed'
            }

        if env_id not in self.environments:
            return {
                'success': False,
                'error': f'Environment {env_id} not found'
            }

        env = self.environments[env_id]

        if env.current_lease is None:
            return {
                'success': False,
                'error': f'Environment {env_id} has no active lease'
            }

        if env.current_lease.assignee != assignee:
            return {
                'success': False,
                'error': f'Renewal conflict: environment {env_id} is occupied by {env.current_lease.assignee}, not {assignee}'
            }

        if env.current_lease.status != LeaseStatus.ACTIVE:
            return {
                'success': False,
                'error': f'Lease for environment {env_id} is not active (status: {env.current_lease.status})'
            }

        env.current_lease.end_time += timedelta(hours=duration_hours)
        env.current_lease.reason += f" | Renewed: {reason}"

        if request_id:
            self.request_ids.add(request_id)

        return {
            'success': True,
            'lease': env.current_lease,
            'new_end_time': env.current_lease.end_time
        }

    def release_lease(self, env_id: str, assignee: str = None,
                      reason: str = "manual release", force: bool = False) -> Dict:
        if env_id not in self.environments:
            return {
                'success': False,
                'error': f'Environment {env_id} not found'
            }

        env = self.environments[env_id]

        if env.current_lease is None:
            return {
                'success': True,
                'message': f'Environment {env_id} is already available'
            }

        if not force and assignee and env.current_lease.assignee != assignee:
            return {
                'success': False,
                'error': f'Release conflict: environment {env_id} is occupied by {env.current_lease.assignee}'
            }

        was_expired = env.current_lease.is_expired()

        env.current_lease.status = LeaseStatus.FORCE_RELEASED if force else LeaseStatus.RELEASED
        env.current_lease.release_reason = reason
        env.current_lease.release_time = datetime.now()

        env.current_lease = None
        env.status = EnvironmentStatus.AVAILABLE

        return {
            'success': True,
            'env_id': env_id,
            'was_expired': was_expired,
            'force_released': force
        }

    def check_expired_leases(self) -> List[Lease]:
        expired = []
        now = datetime.now()
        for env in self.environments.values():
            if env.current_lease and env.current_lease.is_expired(now):
                expired.append(env.current_lease)
                env.current_lease.status = LeaseStatus.EXPIRED
                env.current_lease = None
                env.status = EnvironmentStatus.AVAILABLE
        return expired

    def get_occupancy_report(self) -> Dict:
        total = len(self.environments)
        occupied = sum(1 for e in self.environments.values() if e.status == EnvironmentStatus.OCCUPIED)
        available = sum(1 for e in self.environments.values() if e.status == EnvironmentStatus.AVAILABLE)
        maintenance = sum(1 for e in self.environments.values() if e.status == EnvironmentStatus.MAINTENANCE)

        active_leases = [e.current_lease for e in self.environments.values() if e.current_lease]
        expiring_soon = sum(
            1 for l in active_leases
            if l and l.remaining_time() and l.remaining_time() < timedelta(hours=2)
        )

        return {
            'summary': {
                'total': total,
                'occupied': occupied,
                'available': available,
                'maintenance': maintenance,
                'utilization_rate': round(occupied / total * 100, 1) if total > 0 else 0,
                'expiring_soon': expiring_soon
            },
            'environments': [
                {
                    'env_id': e.env_id,
                    'status': e.status,
                    'assignee': e.current_lease.assignee if e.current_lease else None,
                    'branch': e.current_lease.branch_name if e.current_lease else None,
                    'remaining_hours': round(e.current_lease.remaining_time().total_seconds() / 3600, 1) if e.current_lease and e.current_lease.remaining_time() else None,
                    'is_expired': e.current_lease.is_expired() if e.current_lease else False
                }
                for e in self.environments.values()
            ]
        }

    def get_lease_history(self, env_id: str = None, limit: int = 50) -> List[Lease]:
        history = []
        for env in self.environments.values():
            if env_id and env.env_id != env_id:
                continue
            history.extend(env.lease_history)
        return sorted(history, key=lambda l: l.created_at, reverse=True)[:limit]
