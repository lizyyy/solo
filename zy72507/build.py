import os
L = []
w = L.append
w("import os, sys, socket, json, csv")
w("from datetime import datetime")
w("from io import StringIO")
w("from flask import Flask, render_template_string, request, jsonify, send_file, redirect")
w("")
w("sys.path.insert(0, os.path.dirname(__file__))")
w("from drift_system import (")
w("    init_db, get_db, DataAccessor, ImportService, AdjustmentService,")
w("    SelfCheckService, ExportService, ReportService, STATUS_LABEL,")
w(")")
w("")
w("app = Flask(__name__)")
w('app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024')
w('EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "exports")')
w("os.makedirs(EXPORTS_DIR, exist_ok=True)")
