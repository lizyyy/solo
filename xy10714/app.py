from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import json
import os

app = Flask(__name__)
CORS(app)

DATABASE_URL = 'sqlite:///search_index.db'
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class DataSource(Base):
    __tablename__ = 'data_sources'
    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String, index=True)
    original_data = Column(Text)
    processed_data = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class IndexVersion(Base):
    __tablename__ = 'index_versions'
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String, index=True)
    alias_name = Column(String, index=True)
    status = Column(String, default='pending')
    data_source_id = Column(Integer, ForeignKey('data_sources.id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    is_active = Column(Boolean, default=False)
    message = Column(Text)

class SearchValidation(Base):
    __tablename__ = 'search_validations'
    id = Column(Integer, primary_key=True, index=True)
    index_version_id = Column(Integer, ForeignKey('index_versions.id'))
    status = Column(String, default='pending')
    check_type = Column(String)
    details = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    has_dirty_data = Column(Boolean, default=False)

class RollbackHistory(Base):
    __tablename__ = 'rollback_history'
    id = Column(Integer, primary_key=True, index=True)
    index_version_id = Column(Integer, ForeignKey('index_versions.id'))
    from_version = Column(String)
    to_version = Column(String)
    reason = Column(String)
    operator = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default='success')

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/versions', methods=['GET'])
def get_versions():
    db = next(get_db())
    versions = db.query(IndexVersion).order_by(IndexVersion.created_at.desc()).all()
    result = []
    for v in versions:
        data_source = db.query(DataSource).filter(DataSource.id == v.data_source_id).first()
        result.append({
            'id': v.id,
            'version': v.version,
            'alias_name': v.alias_name,
            'status': v.status,
            'created_at': v.created_at.isoformat(),
            'completed_at': v.completed_at.isoformat() if v.completed_at else None,
            'is_active': v.is_active,
            'message': v.message,
            'data_source': {
                'table_name': data_source.table_name if data_source else None,
                'original_data': json.loads(data_source.original_data) if data_source and data_source.original_data else None,
                'processed_data': json.loads(data_source.processed_data) if data_source and data_source.processed_data else None
            }
        })
    return jsonify(result)

@app.route('/api/versions/<int:version_id>', methods=['GET'])
def get_version_detail(version_id):
    db = next(get_db())
    version = db.query(IndexVersion).filter(IndexVersion.id == version_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    data_source = db.query(DataSource).filter(DataSource.id == version.data_source_id).first()
    validations = db.query(SearchValidation).filter(SearchValidation.index_version_id == version.id).all()
    
    return jsonify({
        'id': version.id,
        'version': version.version,
        'alias_name': version.alias_name,
        'status': version.status,
        'created_at': version.created_at.isoformat(),
        'completed_at': version.completed_at.isoformat() if version.completed_at else None,
        'is_active': version.is_active,
        'message': version.message,
        'data_source': {
            'table_name': data_source.table_name if data_source else None,
            'original_data': json.loads(data_source.original_data) if data_source and data_source.original_data else None,
            'processed_data': json.loads(data_source.processed_data) if data_source and data_source.processed_data else None
        },
        'validations': [{
            'id': v.id,
            'status': v.status,
            'check_type': v.check_type,
            'details': json.loads(v.details) if v.details else None,
            'has_dirty_data': v.has_dirty_data,
            'created_at': v.created_at.isoformat()
        } for v in validations]
    })

@app.route('/api/rollback/<int:version_id>', methods=['POST'])
def rollback_version(version_id):
    db = next(get_db())
    data = request.get_json()
    reason = data.get('reason', 'Manual rollback')
    operator = data.get('operator', 'admin')
    
    version = db.query(IndexVersion).filter(IndexVersion.id == version_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    previous_version = db.query(IndexVersion).filter(
        IndexVersion.created_at < version.created_at,
        IndexVersion.status == 'success'
    ).order_by(IndexVersion.created_at.desc()).first()
    
    if not previous_version:
        return jsonify({'error': 'No previous version to rollback to'}), 400
    
    version.is_active = False
    version.status = 'rolled_back'
    previous_version.is_active = True
    
    rollback = RollbackHistory(
        index_version_id=version.id,
        from_version=version.version,
        to_version=previous_version.version,
        reason=reason,
        operator=operator,
        status='success'
    )
    db.add(rollback)
    db.commit()
    
    return jsonify({
        'success': True,
        'message': f'Successfully rolled back from {version.version} to {previous_version.version}',
        'rollback_id': rollback.id
    })

@app.route('/api/retry/<int:version_id>', methods=['POST'])
def retry_version(version_id):
    db = next(get_db())
    version = db.query(IndexVersion).filter(IndexVersion.id == version_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    if version.status not in ['failed', 'blocked']:
        return jsonify({'error': 'Only failed or blocked versions can be retried'}), 400
    
    version.status = 'pending'
    version.message = 'Retrying...'
    db.commit()
    
    return jsonify({
        'success': True,
        'message': f'Version {version.version} is now pending retry',
        'status': 'pending'
    })

@app.route('/api/validate/<int:version_id>', methods=['POST'])
def validate_version(version_id):
    db = next(get_db())
    version = db.query(IndexVersion).filter(IndexVersion.id == version_id).first()
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    data_source = db.query(DataSource).filter(DataSource.id == version.data_source_id).first()
    original_data = json.loads(data_source.original_data) if data_source and data_source.original_data else []
    processed_data = json.loads(data_source.processed_data) if data_source and data_source.processed_data else []
    
    has_dirty_data = len(original_data) != len(processed_data)
    
    validation = SearchValidation(
        index_version_id=version.id,
        status='completed',
        check_type='data_consistency',
        details=json.dumps({
            'original_count': len(original_data),
            'processed_count': len(processed_data),
            'difference': len(original_data) - len(processed_data)
        }),
        has_dirty_data=has_dirty_data
    )
    db.add(validation)
    
    if has_dirty_data:
        version.status = 'blocked'
        version.message = f'Alias switch blocked: dirty data detected. Original: {len(original_data)}, Processed: {len(processed_data)}'
    else:
        version.status = 'pending_review'
        version.message = 'Data validation passed, pending review'
    
    db.commit()
    
    return jsonify({
        'success': True,
        'status': version.status,
        'has_dirty_data': has_dirty_data,
        'message': version.message
    })

@app.route('/api/rollback-history', methods=['GET'])
def get_rollback_history():
    db = next(get_db())
    history = db.query(RollbackHistory).order_by(RollbackHistory.created_at.desc()).all()
    return jsonify([{
        'id': h.id,
        'from_version': h.from_version,
        'to_version': h.to_version,
        'reason': h.reason,
        'operator': h.operator,
        'created_at': h.created_at.isoformat(),
        'status': h.status
    } for h in history])

@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = next(get_db())
    total = db.query(IndexVersion).count()
    success = db.query(IndexVersion).filter(IndexVersion.status == 'success').count()
    blocked = db.query(IndexVersion).filter(IndexVersion.status == 'blocked').count()
    failed = db.query(IndexVersion).filter(IndexVersion.status == 'failed').count()
    pending = db.query(IndexVersion).filter(IndexVersion.status == 'pending').count()
    pending_review = db.query(IndexVersion).filter(IndexVersion.status == 'pending_review').count()
    
    return jsonify({
        'total': total,
        'success': success,
        'blocked': blocked,
        'failed': failed,
        'pending': pending,
        'pending_review': pending_review
    })

def init_sample_data():
    db = next(get_db())
    
    if db.query(IndexVersion).count() > 0:
        return
    
    data_sources = [
        {
            'table_name': 'products_v1',
            'original': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200},
                {'id': 3, 'name': 'Product C', 'price': 300},
                {'id': 4, 'name': 'Product D', 'price': 400}
            ],
            'processed': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200},
                {'id': 3, 'name': 'Product C', 'price': 300}
            ]
        },
        {
            'table_name': 'products_v2',
            'original': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200}
            ],
            'processed': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200}
            ]
        },
        {
            'table_name': 'products_v3',
            'original': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200},
                {'id': 3, 'name': 'Product C', 'price': 300}
            ],
            'processed': [
                {'id': 1, 'name': 'Product A', 'price': 100},
                {'id': 2, 'name': 'Product B', 'price': 200},
                {'id': 3, 'name': 'Product C', 'price': 300}
            ]
        }
    ]
    
    versions = [
        {
            'version': 'v1.0.0',
            'alias_name': 'search_prod',
            'status': 'success',
            'is_active': True,
            'message': 'Initial version deployed successfully'
        },
        {
            'version': 'v1.1.0',
            'alias_name': 'search_prod',
            'status': 'blocked',
            'is_active': False,
            'message': 'Alias switch blocked: dirty data detected'
        },
        {
            'version': 'v1.2.0',
            'alias_name': 'search_prod',
            'status': 'pending_review',
            'is_active': False,
            'message': 'Data validation passed, pending review'
        }
    ]
    
    for i, ds in enumerate(data_sources):
        data_source = DataSource(
            table_name=ds['table_name'],
            original_data=json.dumps(ds['original']),
            processed_data=json.dumps(ds['processed'])
        )
        db.add(data_source)
        db.flush()
        
        version = IndexVersion(
            version=versions[i]['version'],
            alias_name=versions[i]['alias_name'],
            status=versions[i]['status'],
            data_source_id=data_source.id,
            is_active=versions[i]['is_active'],
            message=versions[i]['message']
        )
        db.add(version)
        db.flush()
        
        if i == 1:
            validation = SearchValidation(
                index_version_id=version.id,
                status='completed',
                check_type='data_consistency',
                details=json.dumps({
                    'original_count': 4,
                    'processed_count': 3,
                    'difference': 1
                }),
                has_dirty_data=True
            )
            db.add(validation)
        elif i == 2:
            validation = SearchValidation(
                index_version_id=version.id,
                status='completed',
                check_type='data_consistency',
                details=json.dumps({
                    'original_count': 3,
                    'processed_count': 3,
                    'difference': 0
                }),
                has_dirty_data=False
            )
            db.add(validation)
    
    db.commit()

if __name__ == '__main__':
    init_sample_data()
    app.run(debug=True, port=5000)
