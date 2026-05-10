import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models.models import (
    TermLibrary,
    TermLibraryVersion,
    TermRule,
    RuleType,
    RuleStatus
)
from datetime import datetime


@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    library = TermLibrary(
        name="测试词库",
        description="测试用词库",
        is_active=True,
        created_by="test"
    )
    session.add(library)
    session.flush()
    
    version = TermLibraryVersion(
        library_id=library.id,
        version="v1.0.0",
        is_current=True,
        created_by="test",
        deployed_at=datetime.utcnow()
    )
    session.add(version)
    session.flush()
    
    yield session
    
    session.close()


@pytest.fixture
def sample_rule(test_db):
    rule = TermRule(
        library_id=1,
        rule_type=RuleType.BLACKLIST,
        term="测试词",
        match_type="exact",
        priority=1,
        action="filter",
        status=RuleStatus.DRAFT,
        created_by="tester"
    )
    test_db.add(rule)
    test_db.flush()
    return rule
