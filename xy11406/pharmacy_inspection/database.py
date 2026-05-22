import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DB_PATH = os.path.expanduser('~/.pharmacy_inspection/inspection.db')
DB_DIR = os.path.dirname(DB_PATH)

Base = declarative_base()

def get_engine():
    os.makedirs(DB_DIR, exist_ok=True)
    return create_engine(f'sqlite:///{DB_PATH}', echo=False)

def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()

def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)
