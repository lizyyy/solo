import os
import yaml
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base


def load_config():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "config.yaml")
    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def get_engine():
    config = load_config()
    db_path = os.path.join(os.path.dirname(__file__), "..", config["database"]["path"])
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return create_engine(f"sqlite:///{db_path}")


def init_db():
    engine = get_engine()
    Base.metadata.create_all(engine)
    return engine


def get_session():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    return Session()
