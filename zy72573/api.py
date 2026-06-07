#!/usr/bin/env python3
import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

from core import (
    create_trial, load_trial, import_feature_snapshot,
    import_training_log, generate_summary, apply_correction,
    calculate_temperature, create_run
)
from models import TrialRecord


BASE_DIR = Path(__file__).parent


class CORSRequestHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type='application/json'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == '/':
            self.serve_file('dashboard.html', 'text/html')
        elif path == '/api/trial':
            self.handle_get_trial(query)
        elif path == '/api/trials':
            self.handle_list_trials()
        elif path == '/api/summary/latest':
            self.handle_get_latest_summary(query)
        elif path.endswith('.json'):
            self.serve_file(path.lstrip('/'), 'application/json')
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body) if body else {}

        if path == '/api/trial/create':
            self.handle_create_trial(data)
        elif path == '/api/trial/import-snapshot':
            self.handle_import_snapshot(data)
        elif path == '/api/trial/add-log':
            self.handle_add_log(data)
        elif path == '/api/trial/correct':
            self.handle_correct(data)
        elif path == '/api/trial/rerun':
            self.handle_rerun(data)
        elif path == '/api/trial/generate-summary':
            self.handle_generate_summary(data)
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Not found'}).encode())

    def serve_file(self, filename, content_type):
        filepath = BASE_DIR / filename
        if filepath.exists():
            self._set_headers(200, content_type)
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self._set_headers(404)
            self.wfile.write(b'Not found')

    def handle_list_trials(self):
        trials = []
        for f in BASE_DIR.glob('trial_*.json'):
            try:
                with open(f, 'r') as fp:
                    data = json.load(fp)
                    trials.append({
                        'trial_id': data['trial_id'],
                        'created_at': data['created_at'],
                        'status': data['status'],
                        'has_snapshot': bool(data.get('snapshot')),
                        'has_log': bool(data.get('training_log')),
                        'summary_count': len(data.get('summaries', []))
                    })
            except:
                pass
        self._set_headers()
        self.wfile.write(json.dumps({'trials': trials}).encode())

    def handle_get_trial(self, query):
        trial_id = query.get('id', [None])[0]
        if not trial_id:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing trial id'}).encode())
            return

        filepath = BASE_DIR / f'trial_{trial_id}.json'
        if not filepath.exists():
            filepath = BASE_DIR / f'{trial_id}.json'
        if filepath.exists():
            with open(filepath, 'r') as f:
                data = json.load(f)
            self._set_headers()
            self.wfile.write(json.dumps(data).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial not found'}).encode())

    def handle_get_latest_summary(self, query):
        trial_id = query.get('trial_id', [None])[0]
        if not trial_id:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing trial_id'}).encode())
            return

        filepath = BASE_DIR / f'trial_{trial_id}.json'
        if not filepath.exists():
            filepath = BASE_DIR / f'{trial_id}.json'
        if filepath.exists():
            with open(filepath, 'r') as f:
                data = json.load(f)
            summaries = data.get('summaries', [])
            if summaries:
                self._set_headers()
                self.wfile.write(json.dumps(summaries[-1]).encode())
            else:
                self._set_headers(404)
                self.wfile.write(json.dumps({'error': 'No summaries'}).encode())
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial not found'}).encode())

    def handle_create_trial(self, data):
        trial = create_trial()
        save_path = data.get('output', f'trial_{trial.trial_id}.json')
        trial.save(str(BASE_DIR / save_path))
        self._set_headers()
        self.wfile.write(json.dumps({
            'trial_id': trial.trial_id,
            'saved_to': save_path
        }).encode())

    def handle_import_snapshot(self, data):
        trial_path = data.get('trial_path')
        snapshot_file = data.get('snapshot_file')

        if not all([trial_path, snapshot_file]):
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing parameters'}).encode())
            return

        full_trial_path = BASE_DIR / trial_path
        full_snap_path = BASE_DIR / snapshot_file

        if not full_trial_path.exists():
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial file not found'}).encode())
            return

        trial = load_trial(str(full_trial_path))
        snapshot = import_feature_snapshot(str(full_snap_path))
        trial.snapshot = snapshot
        trial.status = 'snapshot_imported'

        summary = generate_summary(snapshot)
        trial.summaries.append(summary)

        run = create_run(snapshot, 'import_snapshot', {'file': snapshot_file})
        trial.runs.append(run)

        trial.save(str(full_trial_path))

        self._set_headers()
        self.wfile.write(json.dumps({
            'snapshot_id': snapshot.snapshot_id,
            'feature_count': len(snapshot.features),
            'default_count': sum(1 for f in snapshot.features if f.is_default),
            'summary': summary.to_dict()
        }).encode())

    def handle_add_log(self, data):
        trial_path = data.get('trial_path')
        log_file = data.get('log_file')

        if not all([trial_path, log_file]):
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing parameters'}).encode())
            return

        full_trial_path = BASE_DIR / trial_path
        full_log_path = BASE_DIR / log_file

        if not full_trial_path.exists():
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial file not found'}).encode())
            return

        trial = load_trial(str(full_trial_path))
        if not trial.snapshot:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Import snapshot first'}).encode())
            return

        training_log = import_training_log(str(full_log_path), trial.snapshot.snapshot_id)
        trial.training_log = training_log
        trial.status = 'log_added'

        prev_summary = trial.summaries[-1] if trial.summaries else None
        summary = generate_summary(trial.snapshot, training_log, trial.corrections, prev_summary)
        trial.summaries.append(summary)

        run = create_run(trial.snapshot, 'add_training_log', {'file': log_file}, summary.temperature_result)
        trial.runs.append(run)

        trial.save(str(full_trial_path))

        self._set_headers()
        self.wfile.write(json.dumps({
            'log_id': training_log.log_id,
            'point_count': len(training_log.points),
            'summary': summary.to_dict()
        }).encode())

    def handle_correct(self, data):
        trial_path = data.get('trial_path')
        corrections = data.get('corrections', {})
        corrected_by = data.get('corrected_by', 'anonymous')
        reason = data.get('reason', '人工修正')

        if not trial_path or not corrections:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing parameters'}).encode())
            return

        full_trial_path = BASE_DIR / trial_path
        if not full_trial_path.exists():
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial file not found'}).encode())
            return

        trial = load_trial(str(full_trial_path))
        if not trial.snapshot:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Import snapshot first'}).encode())
            return

        correction = apply_correction(trial.snapshot, corrections, corrected_by, reason)
        trial.corrections.append(correction)
        trial.status = 'corrected'

        prev_summary = trial.summaries[-1] if trial.summaries else None
        summary = generate_summary(trial.snapshot, trial.training_log, trial.corrections, prev_summary)
        trial.summaries.append(summary)

        run = create_run(trial.snapshot, 'manual_correction', {
            'corrections': corrections,
            'by': corrected_by,
            'reason': reason
        }, summary.temperature_result)
        trial.runs.append(run)

        trial.save(str(full_trial_path))

        self._set_headers()
        self.wfile.write(json.dumps({
            'correction_id': correction.correction_id,
            'summary': summary.to_dict()
        }).encode())

    def handle_rerun(self, data):
        trial_path = data.get('trial_path')
        note = data.get('note', 'API重跑')

        if not trial_path:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing trial_path'}).encode())
            return

        full_trial_path = BASE_DIR / trial_path
        if not full_trial_path.exists():
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial file not found'}).encode())
            return

        trial = load_trial(str(full_trial_path))
        if not trial.snapshot:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Import snapshot first'}).encode())
            return

        temp, details = calculate_temperature(
            trial.snapshot, trial.training_log,
            trial.corrections[-1] if trial.corrections else None
        )

        prev_summary = trial.summaries[-1] if trial.summaries else None
        summary = generate_summary(trial.snapshot, trial.training_log, trial.corrections, prev_summary)
        trial.summaries.append(summary)

        run = create_run(trial.snapshot, 'rerun', {'note': note}, temp)
        trial.runs.append(run)
        trial.status = 'rerun'

        trial.save(str(full_trial_path))

        self._set_headers()
        self.wfile.write(json.dumps({
            'temperature': temp,
            'summary': summary.to_dict(),
            'details': details
        }).encode())

    def handle_generate_summary(self, data):
        trial_path = data.get('trial_path')

        if not trial_path:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Missing trial_path'}).encode())
            return

        full_trial_path = BASE_DIR / trial_path
        if not full_trial_path.exists():
            self._set_headers(404)
            self.wfile.write(json.dumps({'error': 'Trial file not found'}).encode())
            return

        trial = load_trial(str(full_trial_path))
        if not trial.snapshot:
            self._set_headers(400)
            self.wfile.write(json.dumps({'error': 'Import snapshot first'}).encode())
            return

        prev_summary = trial.summaries[-1] if trial.summaries else None
        summary = generate_summary(trial.snapshot, trial.training_log, trial.corrections, prev_summary)
        trial.summaries.append(summary)
        trial.save(str(full_trial_path))

        self._set_headers()
        self.wfile.write(json.dumps(summary.to_dict()).encode())

    def log_message(self, format, *args):
        pass


def run_server(port=8765):
    server_address = ('', port)
    httpd = HTTPServer(server_address, CORSRequestHandler)
    print(f"🚀 知识蒸馏温度试算 API 服务已启动")
    print(f"   小看板地址: http://localhost:{port}/")
    print(f"   API 基础地址: http://localhost:{port}/api/")
    print(f"   按 Ctrl+C 停止服务")
    print()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        httpd.server_close()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    run_server(port)
