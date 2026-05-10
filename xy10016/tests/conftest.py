import os
import tempfile
import pytest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from inventory.models import Base
from inventory.seed.seed_data import seed_all


@pytest.fixture
def engine():
    db_path = tempfile.mktemp(suffix='.db')
    engine = create_engine(f'sqlite:///{db_path}', echo=False, future=True)
    Base.metadata.create_all(engine)
    try:
        yield engine
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()
        if os.path.exists(db_path):
            os.unlink(db_path)


@pytest.fixture
def db_session(engine):
    Session = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    session = Session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@pytest.fixture
def seeded_db(db_session):
    seed_all(db_session, clear=False)
    return db_session
