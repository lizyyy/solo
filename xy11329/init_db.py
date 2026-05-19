#!/usr/bin/env python3
from app.database import engine, Base
from app.models import *

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Database tables created successfully!")
