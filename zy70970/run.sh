#!/bin/bash
export PYTHONPATH=/Users/lzy/pro/solo/workspaces/zy70970

cd /Users/lzy/pro/solo/workspaces/zy70970

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
