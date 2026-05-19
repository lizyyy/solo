import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database import Base, FeatureFlag, ConflictRecord, ResolutionLog
from conflict_engine import ConditionMatcher, PriorityCalculator, ConflictResolver


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    yield db
    db.close()


class TestConditionMatcher:
    def test_simple_equality_match(self):
        conditions = {"region": "北京", "level": 3}
        context = {"region": "北京", "level": 3}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is True
        assert len(rules) == 2

    def test_simple_equality_no_match(self):
        conditions = {"region": "北京"}
        context = {"region": "上海"}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is False

    def test_operator_in_match(self):
        conditions = {"region": {"operator": "in", "value": ["北京", "上海"]}}
        context = {"region": "北京"}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is True

    def test_operator_in_no_match(self):
        conditions = {"region": {"operator": "in", "value": ["北京", "上海"]}}
        context = {"region": "广州"}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is False

    def test_operator_gte_match(self):
        conditions = {"login_days": {"operator": "gte", "value": 30}}
        context = {"login_days": 45}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is True

    def test_operator_gte_no_match(self):
        conditions = {"login_days": {"operator": "gte", "value": 30}}
        context = {"login_days": 20}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is False

    def test_operator_lte_match(self):
        conditions = {"level": {"operator": "lte", "value": 5}}
        context = {"level": 3}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is True

    def test_missing_key_no_match(self):
        conditions = {"region": "北京", "missing_key": "value"}
        context = {"region": "北京"}
        matched, rules = ConditionMatcher.match_condition(conditions, context)
        assert matched is False


class TestPriorityCalculator:
    def test_base_priority(self, db_session):
        flag = FeatureFlag(name="test", conditions={}, priority=50, user_group=None)
        db_session.add(flag)
        db_session.commit()

        context = {"user_group": "normal"}
        effective = PriorityCalculator.calculate_effective_priority(flag, context)
        assert effective == 50

    def test_user_group_match_bonus(self, db_session):
        flag = FeatureFlag(name="test", conditions={}, priority=50, user_group="vip")
        db_session.add(flag)
        db_session.commit()

        context = {"user_group": "vip"}
        effective = PriorityCalculator.calculate_effective_priority(flag, context)
        assert effective == 50 + 100 + 50

    def test_vip_user_bonus(self, db_session):
        flag = FeatureFlag(name="test", conditions={}, priority=50, user_group=None)
        db_session.add(flag)
        db_session.commit()

        context = {"user_group": "vip"}
        effective = PriorityCalculator.calculate_effective_priority(flag, context)
        assert effective == 50 + 50

    def test_combined_bonus(self, db_session):
        flag = FeatureFlag(name="test", conditions={}, priority=50, user_group="vip")
        db_session.add(flag)
        db_session.commit()

        context = {"user_group": "vip"}
        effective = PriorityCalculator.calculate_effective_priority(flag, context)
        assert effective == 50 + 100 + 50


class TestConflictResolver:
    def test_no_conflict_single_match(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "上海"},
            priority=60,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})

        assert result["has_conflict"] is False
        assert len(result["matched_flags"]) == 1
        assert result["matched_flags"][0]["name"] == "flag1"

    def test_no_conflict_no_match(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        db_session.add(flag1)
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "广州"})

        assert result["has_conflict"] is False
        assert len(result["matched_flags"]) == 0

    def test_has_conflict_multiple_match(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京", "level": {"operator": "gte", "value": 3}},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京", "level": {"operator": "gte", "value": 1}},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京", "level": 5})

        assert result["has_conflict"] is True
        assert len(result["matched_flags"]) == 2
        assert result["winning_flag"]["name"] == "flag2"
        assert "conflict_explanation" in result

    def test_conflict_saved_in_db(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京"},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})

        conflict = db_session.query(ConflictRecord).first()
        assert conflict is not None
        assert conflict.user_id == "user1"
        assert conflict.status == "pending"
        assert len(conflict.conflicting_flags) == 2

    def test_resolve_conflict(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京"},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})
        conflict_id = result["conflict_id"]

        resolved = resolver.resolve_conflict(
            conflict_id=conflict_id,
            resolution="业务确认使用flag1",
            operator="客服1",
            selected_flag_id=flag1.id
        )

        assert resolved.status == "resolved"
        assert resolved.resolution == "业务确认使用flag1"
        assert resolved.resolved_by == "客服1"
        assert resolved.final_result["winning_flag"]["name"] == "flag1"

        log = db_session.query(ResolutionLog).filter(ResolutionLog.conflict_id == conflict_id).first()
        assert log is not None
        assert log.action == "resolve"

    def test_withdraw_conflict(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京"},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})
        conflict_id = result["conflict_id"]

        withdrawn = resolver.withdraw_conflict(
            conflict_id=conflict_id,
            operator="客服1",
            reason="用户数据有误"
        )

        assert withdrawn.status == "withdrawn"

    def test_close_conflict(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京"},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})
        conflict_id = result["conflict_id"]

        closed = resolver.close_conflict(
            conflict_id=conflict_id,
            operator="主管1",
            reason="用户已注销"
        )

        assert closed.status == "closed"

    def test_generate_report(self, db_session):
        flag1 = FeatureFlag(
            name="flag1",
            conditions={"region": "北京"},
            priority=50,
            is_active=True
        )
        flag2 = FeatureFlag(
            name="flag2",
            conditions={"region": "北京"},
            priority=80,
            is_active=True
        )
        db_session.add_all([flag1, flag2])
        db_session.commit()

        resolver = ConflictResolver(db_session)
        result = resolver.evaluate_flags_for_user("user1", {"region": "北京"})
        conflict_id = result["conflict_id"]

        report = resolver.generate_report(conflict_id)

        assert report["conflict_id"] == conflict_id
        assert report["user_id"] == "user1"
        assert "conflicting_flags" in report
        assert "original_input" in report
        assert "audit_logs" in report
        assert len(report["conflicting_flags"]) == 2
