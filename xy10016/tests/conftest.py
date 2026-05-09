import os
import tempfile
import pytest
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from inventory.models import Base
from inventory.seed.seed_data import seed_all


TEST_DB_PATH = tempfile.mktemp(suffix='.db')


@pytest.fixture
def engine():
    engine = create_engine(f'sqlite:///{TEST_DB_PATH}', echo=False, future=True)
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()
    if os.path.exists(TEST_DB_PATH):
        os.unlink(TEST_DB_PATH)


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
