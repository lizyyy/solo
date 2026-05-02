from datetime import date, timedelta
from decimal import Decimal

import pytest

from hazardous_gate.models.database import Batch, HazardLevel, Reagent, StorageGroup
from hazardous_gate.models.schemas import (
    CourseUsageCreate,
    UsageItemCreate,
)
from hazardous_gate.rules.engine import UsageRuleEngine
from hazardous_gate.storage.crud import BatchCRUD, ReagentCRUD


class TestUsageRuleEngine:
    @pytest.mark.asyncio
    async def test_check_quantity_sufficient(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-001",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        test_session.add(batch)
        await test_session.commit()
        await test_session.refresh(batch)

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_quantity(batch, Decimal("100"))
        assert violation is None

    @pytest.mark.asyncio
    async def test_check_quantity_insufficient(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-002",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("100"),
            current_quantity=Decimal("50"),
            expiry_date=date.today() + timedelta(days=365),
        )
        test_session.add(batch)
        await test_session.commit()
        await test_session.refresh(batch)

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_quantity(batch, Decimal("100"))
        assert violation is not None
        assert violation.rule_name == "超量领用"
        assert violation.severity == "error"

    @pytest.mark.asyncio
    async def test_check_expiry_valid(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-003",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        test_session.add(batch)
        await test_session.commit()
        await test_session.refresh(batch)

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_expiry(batch)
        assert violation is None

    @pytest.mark.asyncio
    async def test_check_expiry_expired(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-004",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() - timedelta(days=30),
        )
        test_session.add(batch)
        await test_session.commit()
        await test_session.refresh(batch)

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_expiry(batch)
        assert violation is not None
        assert violation.rule_name == "过期试剂"
        assert violation.severity == "error"

    @pytest.mark.asyncio
    async def test_check_expiry_soon_warning(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-005",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=15),
        )
        test_session.add(batch)
        await test_session.commit()
        await test_session.refresh(batch)

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_expiry(batch)
        assert violation is not None
        assert violation.rule_name == "即将过期"
        assert violation.severity == "warning"

    @pytest.mark.asyncio
    async def test_check_authorization_authorized(self, test_session):
        reagent = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
            min_authorization_level=2,
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-006",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch.reagent = reagent
        test_session.add(batch)
        await test_session.commit()

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_authorization(batch, user_authorization_level=3)
        assert violation is None

    @pytest.mark.asyncio
    async def test_check_authorization_unauthorized(self, test_session):
        reagent = Reagent(
            name="剧毒试剂",
            cas_number="123-45-6",
            hazard_level=HazardLevel.EXTREME,
            storage_group=StorageGroup.CYANIDE,
            cabinet_type="毒品柜",
            min_authorization_level=4,
        )
        test_session.add(reagent)
        await test_session.commit()
        await test_session.refresh(reagent)

        batch = Batch(
            reagent_id=reagent.id,
            batch_number="TEST-007",
            concentration=Decimal("100"),
            concentration_unit="%",
            initial_quantity=Decimal("100"),
            current_quantity=Decimal("100"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch.reagent = reagent
        test_session.add(batch)
        await test_session.commit()

        engine = UsageRuleEngine(test_session)
        violation = await engine.check_authorization(batch, user_authorization_level=2)
        assert violation is not None
        assert violation.rule_name == "授权不足"
        assert violation.severity == "error"

    @pytest.mark.asyncio
    async def test_check_incompatible_groups(self, test_session):
        reagent1 = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        reagent2 = Reagent(
            name="氢氧化钠",
            cas_number="1310-73-2",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.BASE,
            cabinet_type="碱柜",
        )
        test_session.add_all([reagent1, reagent2])
        await test_session.commit()
        await test_session.refresh(reagent1)
        await test_session.refresh(reagent2)

        batch1 = Batch(
            reagent_id=reagent1.id,
            batch_number="TEST-008",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch1.reagent = reagent1

        batch2 = Batch(
            reagent_id=reagent2.id,
            batch_number="TEST-009",
            concentration=Decimal("50"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch2.reagent = reagent2

        test_session.add_all([batch1, batch2])
        await test_session.commit()

        engine = UsageRuleEngine(test_session)
        violations = await engine.check_incompatible_groups([batch1, batch2])
        assert len(violations) > 0
        assert violations[0].rule_name == "互斥试剂同车"
        assert violations[0].severity == "error"

    @pytest.mark.asyncio
    async def test_check_compatible_groups(self, test_session):
        reagent1 = Reagent(
            name="盐酸",
            cas_number="7647-01-0",
            hazard_level=HazardLevel.MEDIUM,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        reagent2 = Reagent(
            name="硫酸",
            cas_number="7664-93-9",
            hazard_level=HazardLevel.HIGH,
            storage_group=StorageGroup.ACID,
            cabinet_type="酸柜",
        )
        test_session.add_all([reagent1, reagent2])
        await test_session.commit()
        await test_session.refresh(reagent1)
        await test_session.refresh(reagent2)

        batch1 = Batch(
            reagent_id=reagent1.id,
            batch_number="TEST-010",
            concentration=Decimal("37.5"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch1.reagent = reagent1

        batch2 = Batch(
            reagent_id=reagent2.id,
            batch_number="TEST-011",
            concentration=Decimal("98"),
            concentration_unit="%",
            initial_quantity=Decimal("500"),
            current_quantity=Decimal("500"),
            expiry_date=date.today() + timedelta(days=365),
        )
        batch2.reagent = reagent2

        test_session.add_all([batch1, batch2])
        await test_session.commit()

        engine = UsageRuleEngine(test_session)
        violations = await engine.check_incompatible_groups([batch1, batch2])
        assert len(violations) == 0
