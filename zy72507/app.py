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


def find_free_port():
    for p in range(5000, 5100):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
            continue
    return 5080


TPL_HEAD = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>门店评论情绪漂移</title>
<style>
body{font-family:sans-serif;background:#f5f7fa;margin:0;padding:0}
.hd{background:#409eff;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
.hd h1{font-size:16px;margin:0}
.hd a{color:#fff;margin-left:12px;text-decoration:none;font-size:13px}
.ct{max-width:1200px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:6px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.card h2{font-size:16px;margin:0 0 12px 0;color:#333}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
.stat{background:#fff;border-radius:6px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.stat .num{font-size:28px;font-weight:bold;color:#409eff}
.stat .label{font-size:13px;color:#666;margin-top:4px}
