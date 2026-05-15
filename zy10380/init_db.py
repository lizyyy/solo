#!/usr/bin/env python3
from app import create_app, db
import os

if os.path.exists('import_confirmation.db'):
    os.remove('import_confirmation.db')
    print('Old database removed.')

app = create_app()
with app.app_context():
    db.create_all()
    print('Database tables created successfully.')
    
    from sqlalchemy import inspect
    inspector = inspect(db.engine)
    print('\nTables in database:')
    for table in inspector.get_table_names():
        print(f'  - {table}')
