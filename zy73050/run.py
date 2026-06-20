#!/usr/bin/env python3
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import uvicorn
from server import app, init_db
init_db()
if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')
