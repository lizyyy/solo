import os
f = open("/Users/lzy/pro/solo/workspaces/zy72507/app.py", "w")
f.write("""
import os, sys, socket, json, csv
from datetime import datetime
from io import StringIO
from flask import Flask, render_template_string, request, jsonify, send_file, redirect

sys.path.insert(0, os.path.dirname(__file__))
from drift_system import (
    init_db, get_db, DataAccessor, ImportService, AdjustmentService,
    SelfCheckService, ExportService, ReportService, STATUS_LABEL,
)
app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)

