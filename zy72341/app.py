from flask import Flask, render_template, request, jsonify
from dataclasses import asdict
import sys
import os

sys.path.insert(0, '.')

from config import Config
from storage import DataStore
from core import DuplicateDetector, WeightUpdater

app = Flask(__name__)
app.config.from_object(Config)


def get_store():
    return DataStore()


@app.route('/')
def index():
    store = get_store()
    answers = store.get_all_answers()
    weights = store.get_all_weights()
    errors = store.get_all_error_logs()

    status_counts = {}
    for a in answers:
        status_counts[a.status] = status_counts.get(a.status, 0) + 1

    return render_template('index.html',
                           answers=answers,
                           weights=weights,
                           errors=errors,
                           status_counts=status_counts,
                           status_types=Config.STATUS_TYPES)


@app.route('/api/answers', methods=['GET'])
def api_get_answers():
    store = get_store()
    answers = store.get_all_answers()
    return jsonify([asdict(a) for a in answers])


@app.route('/api/answers', methods=['POST'])
def api_import_answers():
    data = request.json
    store = get_store()
    from core import StudentAnswer
    new_answers = []
    for item in data.get('answers', []):
        answer = StudentAnswer(**item)
        answer.import_batch = data.get('batch', 'API_BATCH')
        new_answers.append(answer)

    answers = DuplicateDetector.mark_duplicates(new_answers)
    store._answers.extend(answers)
    store._save_all()

    return jsonify({
        'status': 'success',
        'imported': len(answers),
        'duplicates_found': len([a for a in answers if a.status == 'DUPLICATE_PENDING'])
    })


@app.route('/api/weights', methods=['GET'])
def api_get_weights():
    store = get_store()
    weights = store.get_all_weights()
    return jsonify([asdict(w) for w in weights])


@app.route('/api/weights', methods=['POST'])
def api_import_weights():
    data = request.json
    store = get_store()
    from core import WeightTable
    new_weights = []
    for item in data.get('weights', []):
        weight = WeightTable(**item)
        new_weights.append(weight)

    store._weights.extend(new_weights)
    store._save_all()

    return jsonify({
        'status': 'success',
        'imported': len(new_weights)
    })


@app.route('/api/apply-weights', methods=['POST'])
def api_apply_weights():
    store = get_store()
    weights = store.get_all_weights()
    answers = store.get_all_answers()

    error_logs = WeightUpdater.apply_old_standard_update(answers, weights)
    store.add_error_logs(error_logs)

    return jsonify({
        'status': 'success',
        'errors_generated': len(error_logs)
    })


@app.route('/api/review/<answer_id>', methods=['POST'])
def api_review(answer_id):
    data = request.json
    store = get_store()
    success = store.review_duplicate(
        answer_id,
        reviewer=data.get('reviewer', '未知'),
        keep=data.get('keep', True)
    )
    return jsonify({'success': success})


@app.route('/api/errors', methods=['GET'])
def api_get_errors():
    store = get_store()
    errors = store.get_all_error_logs()
    return jsonify([asdict(e) for e in errors])


if __name__ == '__main__':
    Config.ensure_data_dir()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)
