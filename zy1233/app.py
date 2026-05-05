from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
import json
import os
import io
from datetime import datetime
from gil_simulator import GILSimulator, SimulationConfig

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'experiments.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


class Experiment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=True)
    config = db.Column(db.Text, nullable=False)
    results = db.Column(db.Text, nullable=False)
    events = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    seed = db.Column(db.Integer, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'config': json.loads(self.config),
            'results': json.loads(self.results),
            'events': json.loads(self.events) if self.events else None,
            'created_at': self.created_at.isoformat(),
            'seed': self.seed
        }


with app.app_context():
    db.create_all()


@app.route('/api/experiments', methods=['GET'])
def get_experiments():
    experiments = Experiment.query.order_by(Experiment.created_at.desc()).all()
    return jsonify([e.to_dict() for e in experiments])


@app.route('/api/experiments/<int:experiment_id>', methods=['GET'])
def get_experiment(experiment_id):
    experiment = Experiment.query.get_or_404(experiment_id)
    return jsonify(experiment.to_dict())


@app.route('/api/experiments', methods=['POST'])
def run_experiment():
    data = request.get_json()
    
    config = SimulationConfig(
        cpu_intensive=data.get('cpu_intensive', True),
        io_blocking=data.get('io_blocking', False),
        c_extension_gil_release=data.get('c_extension_gil_release', False),
        thread_count=data.get('thread_count', 4),
        switch_interval=data.get('switch_interval', 0.005),
        lock_contention=data.get('lock_contention', False),
        seed=data.get('seed')
    )
    
    simulator = GILSimulator(config)
    results = simulator.run()
    
    experiment = Experiment(
        name=data.get('name', f"Experiment {datetime.now().strftime('%Y-%m-%d %H:%M')}"),
        config=json.dumps(config.to_dict()),
        results=json.dumps(results['summary']),
        events=json.dumps(results['events']),
        seed=config.seed
    )
    
    db.session.add(experiment)
    db.session.commit()
    
    return jsonify(experiment.to_dict())


@app.route('/api/experiments/<int:experiment_id>/export/json', methods=['GET'])
def export_json(experiment_id):
    experiment = Experiment.query.get_or_404(experiment_id)
    
    output = io.BytesIO()
    output.write(json.dumps(experiment.to_dict(), indent=2).encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/json',
        as_attachment=True,
        download_name=f'experiment_{experiment_id}.json'
    )


@app.route('/api/experiments/<int:experiment_id>/export/markdown', methods=['GET'])
def export_markdown(experiment_id):
    experiment = Experiment.query.get_or_404(experiment_id)
    config = json.loads(experiment.config)
    results = json.loads(experiment.results)
    
    markdown = f"""# GIL Experiment Report - {experiment.name}

## Experiment Info
- **ID**: {experiment.id}
- **Created**: {experiment.created_at}
- **Seed**: {experiment.seed or 'N/A'}

## Configuration

| Parameter | Value |
|-----------|-------|
| CPU Intensive | {'✓' if config['cpu_intensive'] else '✗'} |
| I/O Blocking | {'✓' if config['io_blocking'] else '✗'} |
| C Extension GIL Release | {'✓' if config['c_extension_gil_release'] else '✗'} |
| Thread Count | {config['thread_count']} |
| Switch Interval | {config['switch_interval']}s |
| Lock Contention | {'✓' if config['lock_contention'] else '✗'} |

## Results

### Summary
- **Total Instructions**: {results['total_instructions']}
- **Total Time**: {results['total_time']:.4f}s
- **Throughput**: {results['throughput']:.2f} instructions/s

### Thread Statistics
| Thread | Instructions | Wait Time | GIL Acquisitions |
|--------|--------------|-----------|------------------|
"""
    
    for i, stat in enumerate(results['thread_stats']):
        markdown += f"| Thread {i} | {stat['instructions']} | {stat['wait_time']:.4f}s | {stat['gil_acquisitions']} |\n"
    
    markdown += """
### GIL Events Summary
- **GIL Acquisitions**: {gil_acquisitions}
- **GIL Releases**: {gil_releases}
- **Preemptions**: {preemptions}
- **I/O Waits**: {io_waits}

### Risk Analysis
{risk_analysis}
""".format(
        gil_acquisitions=results['gil_events']['acquisitions'],
        gil_releases=results['gil_events']['releases'],
        preemptions=results['gil_events']['preemptions'],
        io_waits=results['gil_events']['io_waits'],
        risk_analysis=results['risk_analysis']
    )
    
    output = io.BytesIO()
    output.write(markdown.encode('utf-8'))
    output.seek(0)
    
    return send_file(
        output,
        mimetype='text/markdown',
        as_attachment=True,
        download_name=f'experiment_{experiment_id}.md'
    )


@app.route('/api/import', methods=['POST'])
def import_events():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        events = []
        for line in file:
            line = line.decode('utf-8').strip()
            if line:
                events.append(json.loads(line))
        
        summary = analyze_imported_events(events)
        
        experiment = Experiment(
            name=f"Imported - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            config=json.dumps({'type': 'imported', 'source': file.filename}),
            results=json.dumps(summary),
            events=json.dumps(events)
        )
        
        db.session.add(experiment)
        db.session.commit()
        
        return jsonify(experiment.to_dict())
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def analyze_imported_events(events):
    acquisitions = sum(1 for e in events if e.get('type') == 'gil_acquire')
    releases = sum(1 for e in events if e.get('type') == 'gil_release')
    preemptions = sum(1 for e in events if e.get('type') == 'preemption')
    io_waits = sum(1 for e in events if e.get('type') == 'io_wait')
    
    thread_stats = {}
    for event in events:
        tid = event.get('thread_id', 'unknown')
        if tid not in thread_stats:
            thread_stats[tid] = {'instructions': 0, 'wait_time': 0, 'gil_acquisitions': 0}
        
        if event.get('type') == 'gil_acquire':
            thread_stats[tid]['gil_acquisitions'] += 1
        if event.get('type') == 'instruction':
            thread_stats[tid]['instructions'] += 1
    
    return {
        'total_instructions': sum(s['instructions'] for s in thread_stats.values()),
        'total_time': events[-1]['timestamp'] - events[0]['timestamp'] if events else 0,
        'throughput': 0,
        'thread_stats': [
            {'thread_id': tid, **stats}
            for tid, stats in thread_stats.items()
        ],
        'gil_events': {
            'acquisitions': acquisitions,
            'releases': releases,
            'preemptions': preemptions,
            'io_waits': io_waits
        },
        'risk_analysis': 'Imported experiment - analysis limited'
    }


@app.route('/')
def index():
    return send_file('static/index.html')


@app.route('/api/config/validate', methods=['POST'])
def validate_config():
    data = request.get_json()
    errors = []
    warnings = []
    
    thread_count = data.get('thread_count', 4)
    if thread_count < 1:
        errors.append('Thread count must be at least 1')
    elif thread_count > 64:
        warnings.append('High thread count may cause excessive context switching')
    
    switch_interval = data.get('switch_interval', 0.005)
    if switch_interval <= 0:
        errors.append('Switch interval must be positive')
    elif switch_interval > 1.0:
        warnings.append('Long switch interval may reduce responsiveness')
    
    if not data.get('cpu_intensive', True) and not data.get('io_blocking', False):
        warnings.append('Neither CPU-intensive nor I/O-blocking workload selected - simulation may be trivial')
    
    return jsonify({
        'valid': len(errors) == 0,
        'errors': errors,
        'warnings': warnings
    })


if __name__ == '__main__':
    app.run(debug=True, port=5000)
