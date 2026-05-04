import os
import json
from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_cors import CORS
from io import StringIO, BytesIO
import zipfile

import config
from calculator import DataLoader, AssessmentEngine, ServiceCalculator, ConflictChecker
from scheme_manager import SchemeManager
from report_exporter import ReportExporter

app = Flask(__name__)
CORS(app)

data_loader = DataLoader(config.DATA_DIR)
scheme_manager = SchemeManager(config.SCHEMES_DIR)
report_exporter = ReportExporter(config.EXPORTS_DIR)

def init_data():
    data_loader.load_all()

init_data()

def get_parcels_from_scheme_or_default(scheme_id: str = None):
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
        if scheme_data and 'parcels' in scheme_data:
            return scheme_data['parcels']
    return [p.to_dict() for p in data_loader.parcels]

def get_facilities_from_scheme_or_default(scheme_id: str = None):
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
        if scheme_data and 'facilities' in scheme_data:
            return scheme_data['facilities']
    return [f.to_dict() for f in data_loader.facilities]

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/parcels', methods=['GET'])
def get_parcels():
    scheme_id = request.args.get('scheme_id')
    parcels = get_parcels_from_scheme_or_default(scheme_id)
    
    features = []
    for p in parcels:
        feature = {
            "type": "Feature",
            "properties": {
                "id": p.get('id'),
                "name": p.get('name'),
                "land_use": p.get('land_use'),
                "area_sqm": p.get('area_sqm'),
                "current_far": p.get('current_far'),
                "plan_far": p.get('plan_far'),
                "max_far": p.get('max_far'),
                "building_area": p.get('building_area'),
                "estimated_population": p.get('estimated_population'),
                "existing_population": p.get('existing_population')
            },
            "geometry": p.get('geometry')
        }
        features.append(feature)
    
    return jsonify({
        "type": "FeatureCollection",
        "features": features
    })

@app.route('/api/parcels/<parcel_id>', methods=['GET'])
def get_parcel_detail(parcel_id):
    scheme_id = request.args.get('scheme_id')
    parcels = get_parcels_from_scheme_or_default(scheme_id)
    
    for p in parcels:
        if p.get('id') == parcel_id:
            return jsonify(p)
    
    return jsonify({"error": "Parcel not found"}), 404

@app.route('/api/parcels/<parcel_id>', methods=['PUT'])
def update_parcel(parcel_id):
    scheme_id = request.args.get('scheme_id')
    updates = request.get_json()
    
    if scheme_id:
        result = scheme_manager.update_parcel_in_scheme(scheme_id, parcel_id, updates)
        if result:
            return jsonify(result)
        return jsonify({"error": "Scheme or parcel not found"}), 404
    
    for i, p in enumerate(data_loader.parcels):
        if p.id == parcel_id:
            for key, value in updates.items():
                if hasattr(p, key):
                    setattr(p, key, value)
            p.modified = True
            p.modifications.update(updates)
            if 'plan_far' in updates:
                p.calculate_metrics('plan')
            return jsonify(p.to_dict())
    
    return jsonify({"error": "Parcel not found"}), 404

@app.route('/api/facilities', methods=['GET'])
def get_facilities():
    scheme_id = request.args.get('scheme_id')
    facilities = get_facilities_from_scheme_or_default(scheme_id)
    
    features = []
    for f in facilities:
        feature = {
            "type": "Feature",
            "properties": {
                "id": f.get('id'),
                "name": f.get('name'),
                "type": f.get('type'),
                "capacity": f.get('capacity'),
                "status": f.get('status'),
                "description": f.get('description')
            },
            "geometry": {
                "type": "Point",
                "coordinates": [f.get('lon'), f.get('lat')]
            }
        }
        features.append(feature)
    
    return jsonify({
        "type": "FeatureCollection",
        "features": features
    })

@app.route('/api/facilities', methods=['POST'])
def add_facility():
    scheme_id = request.args.get('scheme_id')
    facility_data = request.get_json()
    
    if scheme_id:
        result = scheme_manager.add_facility_to_scheme(scheme_id, facility_data)
        if result:
            return jsonify(result)
    
    return jsonify({"error": "Scheme required"}), 400

@app.route('/api/assessment', methods=['GET'])
def get_assessment():
    scheme_id = request.args.get('scheme_id')
    
    parcels = get_parcels_from_scheme_or_default(scheme_id)
    facilities = get_facilities_from_scheme_or_default(scheme_id)
    
    from models import Parcel, Facility
    parcel_objs = []
    for p in parcels:
        try:
            from shapely.geometry import shape
            geom = shape(p.get('geometry')) if p.get('geometry') else None
        except Exception:
            geom = None
        
        obj = Parcel(
            id=p.get('id', ''),
            name=p.get('name', ''),
            land_use=p.get('land_use', ''),
            area_sqm=float(p.get('area_sqm', 0)),
            current_far=float(p.get('current_far', 0)),
            plan_far=float(p.get('plan_far', 0)),
            max_far=float(p.get('max_far', 0)),
            building_area=float(p.get('building_area', 0)),
            estimated_population=int(p.get('estimated_population', 0)),
            geometry=geom
        )
        obj.calculate_metrics('plan')
        parcel_objs.append(obj)
    
    facility_objs = []
    for f in facilities:
        from shapely.geometry import Point
        facility_objs.append(Facility(
            id=f.get('id', ''),
            name=f.get('name', ''),
            type=f.get('type', ''),
            lon=float(f.get('lon', 0)),
            lat=float(f.get('lat', 0)),
            capacity=float(f.get('capacity', 0)),
            status=f.get('status', 'active'),
            description=f.get('description', ''),
            geometry=Point(float(f.get('lon', 0)), float(f.get('lat', 0)))
        ))
    
    engine = AssessmentEngine(parcel_objs, facility_objs, data_loader.population_data, data_loader.plan_rules)
    assessment = engine.generate_full_assessment()
    
    return jsonify(assessment)

@app.route('/api/schemes', methods=['GET'])
def list_schemes():
    schemes = scheme_manager.list_schemes()
    return jsonify(schemes)

@app.route('/api/schemes', methods=['POST'])
def create_scheme():
    data = request.get_json()
    name = data.get('name', '未命名方案')
    description = data.get('description', '')
    base_scheme_id = data.get('base_scheme_id')
    
    base_parcels = None
    base_facilities = None
    
    if base_scheme_id:
        base_data = scheme_manager.get_scheme(base_scheme_id)
        if base_data:
            base_parcels = base_data.get('parcels')
            base_facilities = base_data.get('facilities')
    else:
        base_parcels = [p.to_dict() for p in data_loader.parcels]
        base_facilities = [f.to_dict() for f in data_loader.facilities]
    
    scheme = scheme_manager.create_scheme(
        name=name,
        description=description,
        base_parcels=base_parcels,
        base_facilities=base_facilities,
        base_scheme_id=base_scheme_id
    )
    
    return jsonify(scheme)

@app.route('/api/schemes/<scheme_id>', methods=['GET'])
def get_scheme(scheme_id):
    scheme = scheme_manager.get_scheme(scheme_id)
    if scheme:
        return jsonify(scheme)
    return jsonify({"error": "Scheme not found"}), 404

@app.route('/api/schemes/<scheme_id>', methods=['PUT'])
def update_scheme(scheme_id):
    updates = request.get_json()
    scheme = scheme_manager.update_scheme(scheme_id, updates)
    if scheme:
        return jsonify(scheme)
    return jsonify({"error": "Scheme not found"}), 404

@app.route('/api/schemes/<scheme_id>', methods=['DELETE'])
def delete_scheme(scheme_id):
    success = scheme_manager.delete_scheme(scheme_id)
    if success:
        return jsonify({"success": True})
    return jsonify({"error": "Scheme not found"}), 404

@app.route('/api/schemes/compare', methods=['GET'])
def compare_schemes():
    scheme_id1 = request.args.get('scheme1')
    scheme_id2 = request.args.get('scheme2')
    
    if not scheme_id1 or not scheme_id2:
        return jsonify({"error": "Both scheme1 and scheme2 are required"}), 400
    
    comparison = scheme_manager.compare_schemes(scheme_id1, scheme_id2)
    if comparison:
        return jsonify(comparison)
    return jsonify({"error": "One or both schemes not found"}), 404

@app.route('/api/export/markdown', methods=['GET'])
def export_markdown():
    scheme_id = request.args.get('scheme_id')
    
    assessment_response = get_assessment()
    assessment = json.loads(assessment_response.response[0].decode())
    
    scheme_data = None
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
    
    md_content = report_exporter.export_markdown(assessment, scheme_data)
    
    return Response(
        md_content,
        mimetype='text/markdown',
        headers={'Content-Disposition': 'attachment; filename=assessment_report.md'}
    )

@app.route('/api/export/html', methods=['GET'])
def export_html():
    scheme_id = request.args.get('scheme_id')
    
    assessment_response = get_assessment()
    assessment = json.loads(assessment_response.response[0].decode())
    
    scheme_data = None
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
    
    html_content = report_exporter.export_html(assessment, scheme_data)
    
    return Response(
        html_content,
        mimetype='text/html',
        headers={'Content-Disposition': 'attachment; filename=assessment_report.html'}
    )

@app.route('/api/export/csv', methods=['GET'])
def export_csv():
    scheme_id = request.args.get('scheme_id')
    
    assessment_response = get_assessment()
    assessment = json.loads(assessment_response.response[0].decode())
    
    scheme_data = None
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
    
    csv_files = report_exporter.export_csv(assessment, scheme_data)
    
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename, content in csv_files.items():
            zf.writestr(filename, content.encode('utf-8-sig'))
    
    zip_buffer.seek(0)
    
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='assessment_csv.zip'
    )

@app.route('/api/export/geojson', methods=['GET'])
def export_geojson():
    scheme_id = request.args.get('scheme_id')
    
    parcels = get_parcels_from_scheme_or_default(scheme_id)
    facilities = get_facilities_from_scheme_or_default(scheme_id)
    
    geojson_files = report_exporter.export_geojson(parcels, facilities)
    
    if len(geojson_files) == 1:
        filename, content = next(iter(geojson_files.items()))
        return Response(
            content,
            mimetype='application/geo+json',
            headers={'Content-Disposition': f'attachment; filename={filename}'}
        )
    
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for filename, content in geojson_files.items():
            zf.writestr(filename, content.encode('utf-8'))
    
    zip_buffer.seek(0)
    
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='assessment_geojson.zip'
    )

@app.route('/api/export/all', methods=['GET'])
def export_all():
    scheme_id = request.args.get('scheme_id')
    
    assessment_response = get_assessment()
    assessment = json.loads(assessment_response.response[0].decode())
    
    scheme_data = None
    if scheme_id:
        scheme_data = scheme_manager.get_scheme(scheme_id)
    
    parcels = get_parcels_from_scheme_or_default(scheme_id)
    facilities = get_facilities_from_scheme_or_default(scheme_id)
    
    md_content = report_exporter.export_markdown(assessment, scheme_data)
    html_content = report_exporter.export_html(assessment, scheme_data)
    csv_files = report_exporter.export_csv(assessment, scheme_data)
    geojson_files = report_exporter.export_geojson(parcels, facilities)
    
    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('assessment_report.md', md_content.encode('utf-8'))
        zf.writestr('assessment_report.html', html_content.encode('utf-8'))
        
        for filename, content in csv_files.items():
            zf.writestr(f'csv/{filename}', content.encode('utf-8-sig'))
        
        for filename, content in geojson_files.items():
            zf.writestr(f'geojson/{filename}', content.encode('utf-8'))
    
    zip_buffer.seek(0)
    
    return send_file(
        zip_buffer,
        mimetype='application/zip',
        as_attachment=True,
        download_name='city_update_assessment.zip'
    )

@app.route('/api/stats', methods=['GET'])
def get_stats():
    total_parcels = len(data_loader.parcels)
    total_facilities = len(data_loader.facilities)
    
    total_residential = sum(1 for p in data_loader.parcels if p.land_use in ['R', 'R2', 'R3'])
    total_area = sum(p.area_sqm for p in data_loader.parcels)
    total_pop = sum(p.existing_population for p in data_loader.parcels)
    
    schemes = scheme_manager.list_schemes()
    
    return jsonify({
        'parcels': {
            'total': total_parcels,
            'residential': total_residential,
            'total_area_sqm': total_area,
            'total_population': total_pop
        },
        'facilities': {
            'total': total_facilities,
            'by_type': {}
        },
        'schemes': {
            'count': len(schemes)
        }
    })

if __name__ == '__main__':
    print("=" * 50)
    print("城市更新评估系统启动中...")
    print("=" * 50)
    print(f"数据目录: {config.DATA_DIR}")
    print(f"方案目录: {config.SCHEMES_DIR}")
    print(f"导出目录: {config.EXPORTS_DIR}")
    print("")
    print(f"地块数: {len(data_loader.parcels)}")
    print(f"配套设施数: {len(data_loader.facilities)}")
    print(f"人口数据条目: {len(data_loader.population_data)}")
    print("")
    print("请访问 http://localhost:5001 查看应用")
    print("=" * 50)
    
    app.run(debug=True, host='0.0.0.0', port=5001)
