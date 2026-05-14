from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import json
import os
from datetime import datetime


def custom_json_serializer(obj):
    """自定义JSON序列化器，处理datetime等类型"""
    def default(o):
        if isinstance(o, datetime):
            return o.isoformat()
        raise TypeError(f"Type {type(o)} not serializable")
    return json.dumps(obj, default=default)


def create_json_engine(database_url, **kwargs):
    """创建带自定义JSON序列化的引擎"""
    engine_options = {
        "json_serializer": custom_json_serializer
    }
    if "sqlite" in database_url:
        engine_options["connect_args"] = {"check_same_thread": False}
    engine_options.update(kwargs)
    return create_engine(database_url, **engine_options)


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/call_profile.db")

engine = create_json_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
