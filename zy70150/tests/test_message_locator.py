import pytest
from datetime import datetime, timedelta

from mrs.services import MessageLocator
from mrs.exceptions import InvalidScopeError, NoMessagesFoundError


class TestMessageLocator:
    def test_locate_by_message_ids(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            target_ids = [sample_messages[0].message_id, sample_messages[2].message_id]
            messages = locator.locate(
                "message_ids",
                {"message_ids": target_ids},
            )
            
            assert len(messages) == 2
            assert {m.message_id for m in messages} == set(target_ids)

    def test_locate_by_business_ids(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            target_ids = [sample_messages[0].business_id, sample_messages[1].business_id]
            messages = locator.locate(
                "business_ids",
                {"business_type": "order", "business_ids": target_ids},
            )
            
            assert len(messages) == 2

    def test_locate_by_time_range(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            now = datetime.utcnow()
            start_time = now - timedelta(hours=11)
            end_time = now - timedelta(hours=5)

            messages = locator.locate(
                "time_range",
                {"start_time": start_time, "end_time": end_time},
            )

            assert len(messages) == 6

    def test_locate_by_offset_range(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            messages = locator.locate(
                "offset_range",
                {
                    "topic": "order.events",
                    "start_offset": 200,
                    "end_offset": 500,
                },
            )
            
            assert len(messages) == 4

    def test_locate_invalid_scope_type(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            with pytest.raises(InvalidScopeError):
                locator.locate("invalid_type", {})

    def test_locate_no_messages(self, db_session):
        with MessageLocator(db_session) as locator:
            with pytest.raises(NoMessagesFoundError):
                locator.locate(
                    "message_ids",
                    {"message_ids": ["non_existent_id"]},
                )

    def test_get_message_summary(self, db_session, sample_messages):
        with MessageLocator(db_session) as locator:
            messages = locator.locate(
                "message_ids",
                {"message_ids": [m.message_id for m in sample_messages[:5]]},
            )
            summary = locator.get_message_summary(messages)
            
            assert summary["count"] == 5
            assert summary["total_amount"] == 100 + 150 + 200 + 250 + 300
            assert summary["total_quantity"] == 1 + 2 + 3 + 4 + 5
            assert "order.events" in summary["topics"]
