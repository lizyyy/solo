#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory, abort
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(__file__))

from models import (
    load_points, save_points, get_point_by_id,
    load_streets, load_bus_data, build_street_tree,
    detect_street_membership, calculate_score,
    ScoreRecord, build_export_geojson
)

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)

PHOTOS_DIR = os.path.join(os.path.dirname(__file__), '..', 'photos')
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'exports')


@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')


@app.route('/api/points', methods=['GET'])
def get_points():
    points = load_points()
    result = []
    for p in points:
        d = {
            'id': p.id,
            'name': p.name,
            'lng': p.lng,
            'lat': p.lat,
            'cross_road': p.cross_road,
            'streets': p.streets,
            'is_boundary': p.is_boundary,
            'boundary_streets': p.boundary_streets,
            'bus_swipes_added': p.bus_swipes_added,
            'status': p.status,
            'score': {
                'total': p.current_score.total,
                'level': p.current_score.level,
                'method': p.current_score.method,
                'note': p.current_score.note
            },
            'photo_path': p.photo_path,
            'updated_at': p.updated_at
        }
        result.append(d)
    return jsonify(result)


@app.route('/api/points/<point_id>', methods=['GET'])
def get_point_detail(point_id):
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        return jsonify({'error': '点位不存在'}), 404

    bus_list = load_bus_data()
    bus_data = None
    for b in bus_list:
        if b.get('point_id') == point_id:
            bus_data = b
            break

    result = {
        'id': point.id,
        'name': point.name,
        'lng': point.lng,
        'lat': point.lat,
        'cross_road': point.cross_road,
        'streets': point.streets,
        'is_boundary': point.is_boundary,
        'boundary_streets': point.boundary_streets,
        'photo_path': point.photo_path,
        'bus_data': bus_data,
        'bus_swipes_added': point.bus_swipes_added,
        'manual_correction': point.manual_correction,
        'status': point.status,
        'current_score': {
            'total': point.current_score.total,
            'traffic_safety': point.current_score.traffic_safety,
            'pedestrian_facility': point.current_score.pedestrian_facility,
            'bus_access': point.current_score.bus_access,
            'play_space': point.current_score.play_space,
            'level': point.current_score.level,
            'method': point.current_score.method,
            'note': point.current_score.note,
            'calculated_at': point.current_score.calculated_at
        },
        'score_history': [
            {
                'total': h.total,
                'level': h.level,
                'method': h.method,
                'note': h.note,
                'calculated_at': h.calculated_at
            } for h in point.score_history
        ],
        'created_at': point.created_at,
        'updated_at': point.updated_at
    }
    return jsonify(result)


@app.route('/api/points/import', methods=['POST'])
def import_points():
    data = request.json
    points_data = data.get('points', [])

    streets = load_streets()
    street_tree, street_info = build_street_tree(streets)
    existing_points = load_points()
    existing_ids = {p.id for p in existing_points}

    now = datetime.now().isoformat()
    imported = []

    for pd in points_data:
        if pd['id'] in existing_ids:
            continue

        result = detect_street_membership(pd['lng'], pd['lat'], street_tree, street_info)
        point = type('PointRecord', (), {})()
        point.id = pd['id']
        point.name = pd['name']
        point.lng = pd['lng']
        point.lat = pd['lat']
        point.cross_road = pd.get('cross_road', '')
        point.photo_path = pd.get('photo_path', '')
        point.streets = result['streets']
        point.is_boundary = result['is_boundary']
        point.boundary_streets = result['boundary_streets']
        point.bus_data_id = None
        point.bus_swipes_added = False
        point.manual_correction = None
        point.status = 'pending' if result['is_boundary'] else 'processed'
        point.current_score = calculate_score(point, None)
        point.score_history = [ScoreRecord(**point.current_score.__dict__)]
        point.created_at = now
        point.updated_at = now

        from models import PointRecord
        real_point = PointRecord(
            id=point.id,
            name=point.name,
            lng=point.lng,
            lat=point.lat,
            cross_road=point.cross_road,
            photo_path=point.photo_path,
            streets=point.streets,
            is_boundary=point.is_boundary,
            boundary_streets=point.boundary_streets,
            bus_swipes_added=point.bus_swipes_added,
            status=point.status,
            current_score=point.current_score,
            score_history=point.score_history,
            created_at=now,
            updated_at=now
        )
        existing_points.append(real_point)
        imported.append(point.id)

    save_points(existing_points)
    return jsonify({'imported': imported, 'total': len(existing_points)})


@app.route('/api/points/<point_id>/add-bus', methods=['POST'])
def add_bus_data(point_id):
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        return jsonify({'error': '点位不存在'}), 404

    data = request.json
    bus_id = data.get('bus_data_id')

    bus_list = load_bus_data()
    bus_data = None
    for b in bus_list:
        if b['id'] == bus_id or b.get('point_id') == point_id:
            bus_data = b
            break

    if not bus_data:
        return jsonify({'error': '公交数据不存在'}), 404

    point.bus_data_id = bus_data['id']
    point.bus_swipes_added = True
    point.status = 'bus_added'

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data)
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    return jsonify({'success': True, 'new_score': point.current_score.total})


@app.route('/api/points/<point_id>/manual-correct', methods=['POST'])
def manual_correct(point_id):
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        return jsonify({'error': '点位不存在'}), 404

    data = request.json
    override = data.get('override', {})
    reason = data.get('reason', '')

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    override['reason'] = reason
    point.manual_correction = override

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, override)
    point.status = 'manually_corrected'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    return jsonify({'success': True, 'new_score': point.current_score.total})


@app.route('/api/points/<point_id>/rerun', methods=['POST'])
def rerun_score(point_id):
    points = load_points()
    point = get_point_by_id(points, point_id)
    if not point:
        return jsonify({'error': '点位不存在'}), 404

    bus_list = load_bus_data()
    bus_data = None
    if point.bus_data_id:
        for b in bus_list:
            if b['id'] == point.bus_data_id:
                bus_data = b
                break

    manual_override = point.manual_correction

    old_score = ScoreRecord(**point.current_score.__dict__)
    point.score_history.append(old_score)

    point.current_score = calculate_score(point, bus_data, manual_override)
    if point.is_boundary:
        point.status = 'pending_review'
    else:
        point.status = 'completed'
    point.updated_at = datetime.now().isoformat()

    save_points(points)
    return jsonify({'success': True, 'new_score': point.current_score.total})


@app.route('/api/streets', methods=['GET'])
def get_streets():
    streets = load_streets()
    return jsonify(streets)


@app.route('/api/bus-data', methods=['GET'])
def get_bus_data():
    bus_list = load_bus_data()
    return jsonify(bus_list)


@app.route('/api/export-map', methods=['POST'])
def export_map():
    data = request.json
    format_type = data.get('format', 'geojson')
    points = load_points()
    bus_list = load_bus_data()

    filename = f"map_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.geojson"
    filepath = os.path.join(EXPORTS_DIR, filename)

    output_path, geojson = build_export_geojson(points, bus_list, filepath)

    return jsonify({
        'success': True,
        'filename': filename,
        'filepath': output_path,
        'summary': geojson['summary'],
        'geojson': geojson
    })


@app.route('/photos/<path:filename>')
def serve_photo(filename):
    return send_from_directory(PHOTOS_DIR, filename)


if __name__ == '__main__':
    os.makedirs(EXPORTS_DIR, exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
