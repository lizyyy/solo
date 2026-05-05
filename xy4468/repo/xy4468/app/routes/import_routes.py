import os
import json
import pandas as pd
from datetime import datetime
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from app import db
from app.models import ConstructionApplication, UndergroundPipeline, BusStop, CalendarEvent

import_bp = Blueprint('import', __name__)

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

@import_bp.route('/applications', methods=['POST'])
def import_applications():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename, {'csv'}):
        return jsonify({'error': 'Only CSV files allowed'}), 400
    
    try:
        df = pd.read_csv(file)
        imported_count = 0
        errors = []
        
        for _, row in df.iterrows():
            try:
                # Check if application already exists
                existing = ConstructionApplication.query.filter_by(
                    application_id=str(row.get('application_id', row.get('id', '')))
                ).first()
                
                if existing:
                    errors.append(f"Application {row.get('application_id', row.get('id'))} already exists")
                    continue
                
                # Parse dates
                start_date = pd.to_datetime(row.get('start_date', row.get('start', ''))).date()
                end_date = pd.to_datetime(row.get('end_date', row.get('end', ''))).date()
                
                application = ConstructionApplication(
                    application_id=str(row.get('application_id', row.get('id', f"APP-{datetime.now().timestamp()}"))),
                    project_name=str(row.get('project_name', row.get('project', 'Unknown'))),
                    road_name=str(row.get('road_name', row.get('road', 'Unknown'))),
                    road_section=str(row.get('road_section', row.get('section', 'Unknown'))),
                    start_date=start_date,
                    end_date=end_date,
                    construction_type=str(row.get('construction_type', row.get('type', ''))),
                    applicant=str(row.get('applicant', row.get('company', ''))),
                    contact_info=str(row.get('contact_info', row.get('contact', ''))),
                    description=str(row.get('description', row.get('desc', '')))
                )
                
                db.session.add(application)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing row {_+2}: {str(e)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} applications'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500

@import_bp.route('/pipelines', methods=['POST'])
def import_pipelines():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename, {'geojson', 'json'}):
        return jsonify({'error': 'Only GeoJSON/JSON files allowed'}), 400
    
    try:
        geojson_data = json.load(file)
        imported_count = 0
        errors = []
        
        if 'features' not in geojson_data:
            return jsonify({'error': 'Invalid GeoJSON: missing features array'}), 400
        
        for i, feature in enumerate(geojson_data['features']):
            try:
                properties = feature.get('properties', {})
                geometry = json.dumps(feature.get('geometry', {}))
                
                # Check if pipeline already exists
                pipeline_id = str(properties.get('pipeline_id', properties.get('id', f"PIPE-{i}")))
                existing = UndergroundPipeline.query.filter_by(pipeline_id=pipeline_id).first()
                
                if existing:
                    errors.append(f"Pipeline {pipeline_id} already exists")
                    continue
                
                pipeline = UndergroundPipeline(
                    pipeline_id=pipeline_id,
                    pipeline_type=str(properties.get('pipeline_type', properties.get('type', 'unknown'))),
                    material=str(properties.get('material', '')),
                    diameter=float(properties.get('diameter', 0)),
                    depth=float(properties.get('depth', 0)),
                    buffer_distance=float(properties.get('buffer_distance', properties.get('buffer', 1.0))),
                    geometry=geometry,
                    road_name=str(properties.get('road_name', properties.get('road', ''))),
                    road_section=str(properties.get('road_section', properties.get('section', '')))
                )
                
                db.session.add(pipeline)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing feature {i}: {str(e)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} pipelines'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500

@import_bp.route('/bus-stops', methods=['POST'])
def import_bus_stops():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename, {'csv'}):
        return jsonify({'error': 'Only CSV files allowed'}), 400
    
    try:
        df = pd.read_csv(file)
        imported_count = 0
        errors = []
        
        for _, row in df.iterrows():
            try:
                # Check if bus stop already exists
                stop_id = str(row.get('stop_id', row.get('id', '')))
                existing = BusStop.query.filter_by(stop_id=stop_id).first()
                
                if existing:
                    errors.append(f"Bus stop {stop_id} already exists")
                    continue
                
                # Parse bus routes
                bus_routes = row.get('bus_routes', row.get('routes', '[]'))
                if isinstance(bus_routes, str):
                    try:
                        json.loads(bus_routes)
                    except json.JSONDecodeError:
                        # If not valid JSON, treat as comma-separated
                        routes_list = [r.strip() for r in bus_routes.split(',')]
                        bus_routes = json.dumps(routes_list)
                
                bus_stop = BusStop(
                    stop_id=stop_id,
                    stop_name=str(row.get('stop_name', row.get('name', 'Unknown'))),
                    road_name=str(row.get('road_name', row.get('road', 'Unknown'))),
                    latitude=float(row.get('latitude', row.get('lat', 0))),
                    longitude=float(row.get('longitude', row.get('lon', row.get('lng', 0)))),
                    bus_routes=bus_routes,
                    contact_person=str(row.get('contact_person', row.get('contact', ''))),
                    contact_phone=str(row.get('contact_phone', row.get('phone', ''))),
                    notification_status=str(row.get('notification_status', 'pending'))
                )
                
                db.session.add(bus_stop)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing row {_+2}: {str(e)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} bus stops'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500

@import_bp.route('/calendar', methods=['POST'])
def import_calendar():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not allowed_file(file.filename, {'csv'}):
        return jsonify({'error': 'Only CSV files allowed'}), 400
    
    try:
        df = pd.read_csv(file)
        imported_count = 0
        errors = []
        
        for _, row in df.iterrows():
            try:
                # Check if calendar event already exists
                event_id = str(row.get('event_id', row.get('id', '')))
                existing = CalendarEvent.query.filter_by(event_id=event_id).first()
                
                if existing:
                    errors.append(f"Calendar event {event_id} already exists")
                    continue
                
                # Parse dates
                start_date = pd.to_datetime(row.get('start_date', row.get('start', ''))).date()
                end_date = pd.to_datetime(row.get('end_date', row.get('end', ''))).date()
                
                # Parse times
                start_time = None
                end_time = None
                
                if row.get('start_time'):
                    try:
                        start_time = pd.to_datetime(row.get('start_time')).time()
                    except:
                        pass
                
                if row.get('end_time'):
                    try:
                        end_time = pd.to_datetime(row.get('end_time')).time()
                    except:
                        pass
                
                # Parse affected roads
                affected_roads = row.get('affected_roads', row.get('roads', '[]'))
                if isinstance(affected_roads, str):
                    try:
                        json.loads(affected_roads)
                    except json.JSONDecodeError:
                        # If not valid JSON, treat as comma-separated
                        roads_list = [r.strip() for r in affected_roads.split(',')]
                        affected_roads = json.dumps(roads_list)
                
                calendar_event = CalendarEvent(
                    event_id=event_id,
                    event_type=str(row.get('event_type', row.get('type', 'noise_prohibition'))),
                    event_name=str(row.get('event_name', row.get('name', 'Unknown'))),
                    start_date=start_date,
                    end_date=end_date,
                    start_time=start_time,
                    end_time=end_time,
                    affected_roads=affected_roads,
                    description=str(row.get('description', row.get('desc', '')))
                )
                
                db.session.add(calendar_event)
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Error importing row {_+2}: {str(e)}")
                continue
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'imported_count': imported_count,
            'errors': errors,
            'message': f'Successfully imported {imported_count} calendar events'
        })
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Import failed: {str(e)}'}), 500
