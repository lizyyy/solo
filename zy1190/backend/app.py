import os
import json
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from benchmark_runner import BenchmarkRunner, BenchmarkConfig
from data_manager import DataManager
from report_generator import ReportGenerator

app = Flask(__name__)
CORS(app)

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
engine_path = os.path.join(base_dir, "engine", "build", "cache_bench")
data_dir = os.path.join(base_dir, "data")

runner = BenchmarkRunner(engine_path=engine_path)
data_manager = DataManager(data_dir=data_dir)
report_generator = ReportGenerator(data_manager)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "engine_available": runner.is_engine_available()
    })

@app.route('/api/tests', methods=['GET'])
def list_tests():
    tests = [
        {
            "name": "sequential",
            "description": "Sequential memory access - best case for cache utilization",
            "config_params": ["array_size", "stride", "iterations", "cache_line_size"]
        },
        {
            "name": "stride",
            "description": "Strided memory access - demonstrates cache line utilization issues",
            "config_params": ["array_size", "stride", "iterations", "cache_line_size"]
        },
        {
            "name": "random",
            "description": "Random memory access - worst case for cache",
            "config_params": ["array_size", "iterations", "cache_line_size", "seed"]
        },
        {
            "name": "false_sharing",
            "description": "False sharing demonstration - threads sharing same cache line",
            "config_params": ["thread_count", "struct_layout", "iterations"]
        },
        {
            "name": "numa",
            "description": "NUMA local vs remote memory access comparison",
            "config_params": ["array_size", "numa_node", "iterations"]
        }
    ]
    return jsonify(tests)

@app.route('/api/experiments', methods=['GET'])
def list_experiments():
    limit = int(request.args.get('limit', 100))
    offset = int(request.args.get('offset', 0))
    experiments = data_manager.list_experiments(limit=limit, offset=offset)
    return jsonify(experiments)

@app.route('/api/experiments/<exp_id>', methods=['GET'])
def get_experiment(exp_id):
    experiment = data_manager.get_experiment(exp_id)
    if experiment is None:
        return jsonify({"error": "Experiment not found"}), 404
    return jsonify(experiment.to_dict())

@app.route('/api/experiments', methods=['POST'])
def create_experiment():
    data = request.get_json()
    
    name = data.get('name', 'Unnamed Experiment')
    description = data.get('description', '')
    config = data.get('config', {})
    tags = data.get('tags', [])
    
    experiment = data_manager.create_experiment(
        name=name,
        description=description,
        config=config,
        tags=tags
    )
    
    return jsonify(experiment.to_dict()), 201

@app.route('/api/experiments/<exp_id>/run', methods=['POST'])
def run_experiment(exp_id):
    experiment = data_manager.get_experiment(exp_id)
    if experiment is None:
        return jsonify({"error": "Experiment not found"}), 404
    
    config_data = experiment.config or {}
    test_name = config_data.get('test_name', 'sequential')
    
    config = BenchmarkConfig(
        test_name=test_name,
        array_size=config_data.get('array_size', 67108864),
        stride=config_data.get('stride', 1),
        thread_count=config_data.get('thread_count', 1),
        cache_line_size=config_data.get('cache_line_size', 64),
        iterations=config_data.get('iterations', 10),
        seed=config_data.get('seed', 42),
        struct_layout=config_data.get('struct_layout', 'bad'),
        numa_node=config_data.get('numa_node', 0)
    )
    
    result = runner.run_benchmark(config, exp_id)
    data_manager.update_experiment_result(exp_id, result.to_dict())
    
    return jsonify({
        "status": "completed",
        "experiment_id": exp_id,
        "result": result.to_dict()
    })

@app.route('/api/experiments/<exp_id>/run-async', methods=['POST'])
def run_experiment_async(exp_id):
    experiment = data_manager.get_experiment(exp_id)
    if experiment is None:
        return jsonify({"error": "Experiment not found"}), 404
    
    config_data = experiment.config or {}
    test_name = config_data.get('test_name', 'sequential')
    
    config = BenchmarkConfig(
        test_name=test_name,
        array_size=config_data.get('array_size', 67108864),
        stride=config_data.get('stride', 1),
        thread_count=config_data.get('thread_count', 1),
        cache_line_size=config_data.get('cache_line_size', 64),
        iterations=config_data.get('iterations', 10),
        seed=config_data.get('seed', 42),
        struct_layout=config_data.get('struct_layout', 'bad'),
        numa_node=config_data.get('numa_node', 0)
    )
    
    def callback(result):
        data_manager.update_experiment_result(exp_id, result.to_dict())
    
    runner.run_async(config, exp_id, callback=callback)
    
    return jsonify({
        "status": "running",
        "experiment_id": exp_id,
        "message": "Experiment started in background"
    })

@app.route('/api/experiments/<exp_id>/status', methods=['GET'])
def get_experiment_status(exp_id):
    status = runner.get_status(exp_id)
    return jsonify(status)

@app.route('/api/experiments/<exp_id>', methods=['DELETE'])
def delete_experiment(exp_id):
    if data_manager.delete_experiment(exp_id):
        return jsonify({"status": "deleted", "experiment_id": exp_id})
    return jsonify({"error": "Experiment not found"}), 404

@app.route('/api/comparisons', methods=['GET'])
def list_comparisons():
    comparisons = data_manager.list_comparisons()
    return jsonify(comparisons)

@app.route('/api/comparisons/<comp_id>', methods=['GET'])
def get_comparison(comp_id):
    comparison = data_manager.get_comparison(comp_id)
    if comparison is None:
        return jsonify({"error": "Comparison not found"}), 404
    return jsonify(comparison.to_dict())

@app.route('/api/comparisons', methods=['POST'])
def create_comparison():
    data = request.get_json()
    
    name = data.get('name', 'Unnamed Comparison')
    experiment_ids = data.get('experiment_ids', [])
    metrics = data.get('metrics', ["total_time_ms", "throughput_mbs", "avg_latency_ns", "cache_hits", "cache_misses"])
    notes = data.get('notes', '')
    
    if len(experiment_ids) < 2:
        return jsonify({"error": "Need at least 2 experiment IDs"}), 400
    
    comparison = data_manager.create_comparison(
        name=name,
        experiment_ids=experiment_ids,
        metrics=metrics,
        notes=notes
    )
    
    return jsonify(comparison.to_dict()), 201

@app.route('/api/comparisons/<comp_id>/analyze', methods=['GET'])
def analyze_comparison(comp_id):
    analysis = data_manager.run_comparison_analysis(comp_id)
    if "error" in analysis:
        return jsonify(analysis), 404
    return jsonify(analysis)

@app.route('/api/experiments/<exp_id>/report/markdown', methods=['GET'])
def export_experiment_markdown(exp_id):
    report = report_generator.generate_markdown_report(exp_id)
    filename = f"{exp_id}_report.md"
    file_path = report_generator.save_report(report, filename)
    return send_file(file_path, as_attachment=True, download_name=filename)

@app.route('/api/comparisons/<comp_id>/report/markdown', methods=['GET'])
def export_comparison_markdown(comp_id):
    report = report_generator.generate_comparison_markdown(comp_id)
    filename = f"{comp_id}_comparison.md"
    file_path = report_generator.save_report(report, filename)
    return send_file(file_path, as_attachment=True, download_name=filename)

@app.route('/api/experiments/<exp_id>/report/json', methods=['GET'])
def export_experiment_json(exp_id):
    file_path = data_manager.export_to_json(exp_id)
    if file_path is None:
        return jsonify({"error": "Experiment not found"}), 404
    return send_file(file_path, as_attachment=True, download_name=f"{exp_id}.json")

@app.route('/api/export/all', methods=['GET'])
def export_all():
    file_path = data_manager.export_all_to_json()
    return send_file(file_path, as_attachment=True, download_name=os.path.basename(file_path))

@app.route('/api/workload/import', methods=['POST'])
def import_workload():
    if 'file' not in request.files:
        return jsonify({"error": "No file provided"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
        file.save(f)
        temp_path = f.name
    
    try:
        result = data_manager.import_workload(temp_path)
        return jsonify(result)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)

@app.route('/api/quick-run', methods=['POST'])
def quick_run():
    data = request.get_json()
    
    test_name = data.get('test_name', 'sequential')
    
    config = BenchmarkConfig(
        test_name=test_name,
        array_size=data.get('array_size', 67108864),
        stride=data.get('stride', 1),
        thread_count=data.get('thread_count', 1),
        cache_line_size=data.get('cache_line_size', 64),
        iterations=data.get('iterations', 10),
        seed=data.get('seed', 42),
        struct_layout=data.get('struct_layout', 'bad'),
        numa_node=data.get('numa_node', 0)
    )
    
    result = runner.run_benchmark(config)
    
    return jsonify({
        "status": "completed",
        "result": result.to_dict()
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
