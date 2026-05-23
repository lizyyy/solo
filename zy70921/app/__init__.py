from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)
