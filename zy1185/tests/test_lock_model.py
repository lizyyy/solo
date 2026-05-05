from datetime import datetime

import pytest

from lock_analyzer.lock_model import (
    DeadlockInfo,
    LockEvent,
    LockManager,
    LockStatus,
    LockType,
    StarvationInfo,
)


class TestLockType:
    def test_lock_type_values(self):
        assert LockType.UNLOCKED.value == "unlocked"
        assert LockType.SHARED.value == "shared"
        assert LockType.RESERVED.value == "reserved"
        assert LockType.PENDING.value == "pending"
        assert LockType.EXCLUSIVE.value == "exclusive"


class TestLockManagerCompatibility:
    def test_compatibility_matrix(self):
        assert LockType.SHARED in LockManager.COMPATIBILITY[LockType.UNLOCKED]
        assert LockType.RESERVED in LockManager.COMPATIBILITY[LockType.UNLOCKED]
        
        assert LockType.SHARED in LockManager.COMPATIBILITY[LockType.SHARED]
        assert LockType.RESERVED in LockManager.COMPATIBILITY[LockType.SHARED]
        
        assert LockType.SHARED in LockManager.COMPATIBILITY[LockType.RESERVED]
        assert LockType.RESERVED not in LockManager.COMPATIBILITY[LockType.RESERVED]
        
        assert LockType.SHARED not in LockManager.COMPATIBILITY[LockType.EXCLUSIVE]
        assert LockType.RESERVED not in LockManager.COMPATIBILITY[LockType.EXCLUSIVE]
        assert LockType.EXCLUSIVE not in LockManager.COMPATIBILITY[LockType.EXCLUSIVE]


class TestLockManagerBasic:
    def setup_method(self):
        self.lock_manager = LockManager(busy_timeout_ms=5000)
        self.now = datetime(2026, 5, 5, 10, 0, 0)

    def test_initial_state(self):
        status = self.lock_manager.get_status()
        assert status.current_lock == LockType.UNLOCKED
        assert len(status.holders) == 0
        assert len(status.waiting) == 0

    def test_acquire_shared_lock(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        
        status = self.lock_manager.get_status()
        assert status.current_lock == LockType.SHARED
        assert len(status.holders) == 1
        assert status.holders[0].connection_id == "conn-1"
        assert status.holders[0].lock_type == LockType.SHARED

    def test_multiple_shared_locks(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        self.lock_manager.request_lock("conn-2", LockType.SHARED, self.now, "read")
        
        status = self.lock_manager.get_status()
        assert status.current_lock == LockType.SHARED
        assert len(status.holders) == 2

    def test_reserved_lock_does_not_block_shared(self):
        self.lock_manager.request_lock("conn-writer", LockType.RESERVED, self.now, "write intent")
        self.lock_manager.request_lock("conn-reader", LockType.SHARED, self.now, "read")
        
        status = self.lock_manager.get_status()
        assert len(status.holders) == 2

    def test_exclusive_lock_blocks_all(self):
        self.lock_manager.request_lock("conn-1", LockType.EXCLUSIVE, self.now, "write")
        
        status = self.lock_manager.get_status()
        assert status.current_lock == LockType.EXCLUSIVE
        assert self.lock_manager.can_acquire(LockType.SHARED, "conn-2") is False
        assert self.lock_manager.can_acquire(LockType.RESERVED, "conn-2") is False
        assert self.lock_manager.can_acquire(LockType.EXCLUSIVE, "conn-2") is False

    def test_release_lock(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        self.lock_manager.release_lock("conn-1", self.now)
        
        status = self.lock_manager.get_status()
        assert status.current_lock == LockType.UNLOCKED
        assert len(status.holders) == 0


class TestLockManagerUpgrade:
    def setup_method(self):
        self.lock_manager = LockManager(busy_timeout_ms=5000)
        self.now = datetime(2026, 5, 5, 10, 0, 0)

    def test_upgrade_shared_to_reserved(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        
        later = self.now
        self.lock_manager.request_lock("conn-1", LockType.RESERVED, later, "write intent")
        
        status = self.lock_manager.get_status()
        assert len(status.holders) == 1
        assert status.holders[0].lock_type == LockType.RESERVED

    def test_cannot_upgrade_while_other_shared_holders(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        self.lock_manager.request_lock("conn-2", LockType.SHARED, self.now, "read")
        
        status = self.lock_manager.get_status()
        assert len(status.holders) == 2
        
        assert self.lock_manager.can_acquire(LockType.EXCLUSIVE, "conn-1") is False


class TestLockManagerWaitQueue:
    def setup_method(self):
        self.lock_manager = LockManager(busy_timeout_ms=5000)
        self.now = datetime(2026, 5, 5, 10, 0, 0)

    def test_wait_for_lock(self):
        self.lock_manager.request_lock("conn-1", LockType.EXCLUSIVE, self.now, "write")
        
        later = self.now
        request = self.lock_manager.request_lock("conn-2", LockType.SHARED, later, "read")
        
        assert request.granted_at is None
        
        status = self.lock_manager.get_status()
        assert len(status.waiting) == 1

    def test_grant_after_release(self):
        self.lock_manager.request_lock("conn-1", LockType.EXCLUSIVE, self.now, "write")
        
        later = self.now
        self.lock_manager.request_lock("conn-2", LockType.SHARED, later, "read")
        
        even_later = self.now
        self.lock_manager.release_lock("conn-1", even_later)
        
        status = self.lock_manager.get_status()
        assert len(status.holders) == 1
        assert status.holders[0].connection_id == "conn-2"
        assert len(status.waiting) == 0


class TestLockManagerHistory:
    def setup_method(self):
        self.lock_manager = LockManager(busy_timeout_ms=5000)
        self.now = datetime(2026, 5, 5, 10, 0, 0)

    def test_lock_history_records_acquire(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        
        assert len(self.lock_manager.lock_history) == 1
        event = self.lock_manager.lock_history[0]
        assert event.event_type == "ACQUIRE"
        assert event.connection_id == "conn-1"
        assert event.lock_type == LockType.SHARED

    def test_lock_history_records_upgrade(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        self.lock_manager.request_lock("conn-1", LockType.RESERVED, self.now, "write intent")
        
        assert len(self.lock_manager.lock_history) == 2
        upgrade_event = self.lock_manager.lock_history[1]
        assert upgrade_event.event_type == "UPGRADE"
        assert upgrade_event.from_type == LockType.SHARED
        assert upgrade_event.lock_type == LockType.RESERVED

    def test_lock_history_records_release(self):
        self.lock_manager.request_lock("conn-1", LockType.SHARED, self.now, "read")
        self.lock_manager.release_lock("conn-1", self.now)
        
        assert len(self.lock_manager.lock_history) == 2
        release_event = self.lock_manager.lock_history[1]
        assert release_event.event_type == "RELEASE"


class TestLockManagerStarvation:
    def setup_method(self):
        self.lock_manager = LockManager(busy_timeout_ms=5000)
        self.now = datetime(2026, 5, 5, 10, 0, 0)

    def test_no_starvation_risk_initially(self):
        risk = self.lock_manager.check_starvation_risk("conn-1", self.now, 30000)
        assert risk is None

    def test_starvation_risk_after_waiting(self):
        self.lock_manager.request_lock("conn-blocker", LockType.EXCLUSIVE, self.now, "long write")
        
        wait_start = self.now
        self.lock_manager.request_lock("conn-waiter", LockType.SHARED, wait_start, "read")
        
        wait_time = 40000
        later = datetime.fromtimestamp(self.now.timestamp() + wait_time / 1000)
        
        risk = self.lock_manager.check_starvation_risk("conn-waiter", later, 30000)
        assert risk is not None
        assert risk.connection_id == "conn-waiter"
        assert risk.wait_time_ms >= 30000
