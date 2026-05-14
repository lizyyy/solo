from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import pandas as pd
import io
import os

app = Flask(__name__)
CORS(app)

DATABASE_URL = 'sqlite:///vector_index.db'
engine = create_engine(DATABASE_URL)
Base = declarative_base()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class DataBatch(Base):
    __tablename__ = 'data_batches'
    
    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String(200), nullable=False)
    embedding_version = Column(String(100), nullable=False)
    owner = Column(String(100), nullable=False)
    status = Column(String(50), default='pending')
    total_records = Column(Integer, default=0)
    indexed_records = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    delete_syncs = relationship('DeleteSync', back_populates='batch', cascade='all, delete-orphan')
    recall_validations = relationship('RecallValidation', back_populates='batch', cascade='all, delete-orphan')


class DeleteSync(Base):
    __tablename__ = 'delete_syncs'
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('data_batches.id'))
    record_id = Column(String(200), nullable=False)
    status = Column(String(50), default='pending')
    fail_reason = Column(Text)
    handler = Column(String(100))
    handled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship('DataBatch', back_populates='delete_syncs')


class RecallValidation(Base):
    __tablename__ = 'recall_validations'
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey('data_batches.id'))
    query = Column(Text, nullable=False)
    expected_result = Column(String(200))
    actual_result = Column(String(200))
    is_valid = Column(Boolean)
    handler = Column(String(100))
    handled_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    batch = relationship('DataBatch', back_populates='recall_validations')


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.route('/api/batches', methods=['GET'])
def get_batches():
    db = next(get_db())
    search = request.args.get('search', '')
    status = request.args.get('status', '')
    
    query = db.query(DataBatch)
    
    if search:
        query = query.filter(
            (DataBatch.batch_name.like(f'%{search}%')) |
            (DataBatch.owner.like(f'%{search}%')) |
            (DataBatch.embedding_version.like(f'%{search}%'))
        )
    
    if status:
        query = query.filter(DataBatch.status == status)
    
    batches = query.order_by(DataBatch.updated_at.desc()).all()
    
    result = []
    for batch in batches:
        delete_syncs = db.query(DeleteSync).filter(DeleteSync.batch_id == batch.id).all()
        recall_validations = db.query(RecallValidation).filter(RecallValidation.batch_id == batch.id).all()
        
        failed_deletes = [d for d in delete_syncs if d.status == 'failed']
        passed_validations = [v for v in recall_validations if v.is_valid]
        
        result.append({
            'id': batch.id,
            'batch_name': batch.batch_name,
            'embedding_version': batch.embedding_version,
            'owner': batch.owner,
            'status': batch.status,
            'total_records': batch.total_records,
            'indexed_records': batch.indexed_records,
            'delete_sync_count': len(delete_syncs),
            'delete_failed_count': len(failed_deletes),
            'recall_count': len(recall_validations),
            'recall_pass_rate': f"{len(passed_validations)}/{len(recall_validations)}" if recall_validations else '-',
            'created_at': batch.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': batch.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    return jsonify(result)


@app.route('/api/batches/<int:batch_id>', methods=['GET'])
def get_batch_detail(batch_id):
    db = next(get_db())
    batch = db.query(DataBatch).filter(DataBatch.id == batch_id).first()
    
    if not batch:
        return jsonify({'error': 'Batch not found'}), 404
    
    delete_syncs = db.query(DeleteSync).filter(DeleteSync.batch_id == batch_id).all()
    recall_validations = db.query(RecallValidation).filter(RecallValidation.batch_id == batch_id).all()
    
    return jsonify({
        'batch': {
            'id': batch.id,
            'batch_name': batch.batch_name,
            'embedding_version': batch.embedding_version,
            'owner': batch.owner,
            'status': batch.status,
            'total_records': batch.total_records,
            'indexed_records': batch.indexed_records,
            'created_at': batch.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': batch.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        },
        'delete_syncs': [{
            'id': d.id,
            'record_id': d.record_id,
            'status': d.status,
            'fail_reason': d.fail_reason,
            'handler': d.handler,
            'handled_at': d.handled_at.strftime('%Y-%m-%d %H:%M:%S') if d.handled_at else None,
            'created_at': d.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for d in delete_syncs],
        'recall_validations': [{
            'id': v.id,
            'query': v.query,
            'expected_result': v.expected_result,
            'actual_result': v.actual_result,
            'is_valid': v.is_valid,
            'handler': v.handler,
            'handled_at': v.handled_at.strftime('%Y-%m-%d %H:%M:%S') if v.handled_at else None,
            'created_at': v.created_at.strftime('%Y-%m-%d %H:%M:%S')
        } for v in recall_validations]
    })


@app.route('/api/batches/import', methods=['POST'])
def import_batches():
    db = next(get_db())
    data = request.json
    
    if not data or 'batches' not in data:
        return jsonify({'error': 'Invalid data'}), 400
    
    imported_count = 0
    errors = []
    
    for batch_data in data['batches']:
        try:
            batch = DataBatch(
                batch_name=batch_data['batch_name'],
                embedding_version=batch_data['embedding_version'],
                owner=batch_data['owner'],
                status=batch_data.get('status', 'pending'),
                total_records=batch_data.get('total_records', 0)
            )
            db.add(batch)
            db.flush()
            
            if 'delete_syncs' in batch_data:
                for d_data in batch_data['delete_syncs']:
                    delete_sync = DeleteSync(
                        batch_id=batch.id,
                        record_id=d_data['record_id'],
                        status=d_data.get('status', 'pending'),
                        fail_reason=d_data.get('fail_reason')
                    )
                    db.add(delete_sync)
            
            if 'recall_validations' in batch_data:
                for v_data in batch_data['recall_validations']:
                    validation = RecallValidation(
                        batch_id=batch.id,
                        query=v_data['query'],
                        expected_result=v_data.get('expected_result'),
                        actual_result=v_data.get('actual_result'),
                        is_valid=v_data.get('is_valid')
                    )
                    db.add(validation)
            
            imported_count += 1
        except Exception as e:
            errors.append(f"Batch {batch_data.get('batch_name', 'unknown')}: {str(e)}")
    
    db.commit()
    
    return jsonify({
        'imported_count': imported_count,
        'errors': errors
    })


@app.route('/api/batches/<int:batch_id>/status', methods=['PUT'])
def update_batch_status(batch_id):
    db = next(get_db())
    batch = db.query(DataBatch).filter(DataBatch.id == batch_id).first()
    
    if not batch:
        return jsonify({'error': 'Batch not found'}), 404
    
    data = request.json
    batch.status = data.get('status', batch.status)
    batch.indexed_records = data.get('indexed_records', batch.indexed_records)
    batch.updated_at = datetime.utcnow()
    
    db.commit()
    return jsonify({'message': 'Status updated successfully'})


@app.route('/api/delete_syncs/<int:sync_id>/handle', methods=['PUT'])
def handle_delete_sync(sync_id):
    db = next(get_db())
    delete_sync = db.query(DeleteSync).filter(DeleteSync.id == sync_id).first()
    
    if not delete_sync:
        return jsonify({'error': 'Delete sync not found'}), 404
    
    data = request.json
    delete_sync.status = data.get('status', 'handled')
    delete_sync.handler = data.get('handler')
    delete_sync.handled_at = datetime.utcnow()
    
    db.commit()
    return jsonify({'message': 'Delete sync handled successfully'})


@app.route('/api/recall_validations/<int:validation_id>/handle', methods=['PUT'])
def handle_recall_validation(validation_id):
    db = next(get_db())
    validation = db.query(RecallValidation).filter(RecallValidation.id == validation_id).first()
    
    if not validation:
        return jsonify({'error': 'Validation not found'}), 404
    
    data = request.json
    validation.is_valid = data.get('is_valid')
    validation.actual_result = data.get('actual_result', validation.actual_result)
    validation.handler = data.get('handler')
    validation.handled_at = datetime.utcnow()
    
    db.commit()
    return jsonify({'message': 'Validation handled successfully'})


@app.route('/api/export', methods=['GET'])
def export_report():
    db = next(get_db())
    batches = db.query(DataBatch).order_by(DataBatch.owner, DataBatch.updated_at.desc()).all()
    
    output = io.BytesIO()
    writer = pd.ExcelWriter(output, engine='openpyxl')
    
    summary_data = []
    for batch in batches:
        delete_syncs = db.query(DeleteSync).filter(DeleteSync.batch_id == batch.id).all()
        recall_validations = db.query(RecallValidation).filter(RecallValidation.batch_id == batch.id).all()
        
        failed_deletes = len([d for d in delete_syncs if d.status == 'failed'])
        passed_validations = len([v for v in recall_validations if v.is_valid])
        
        summary_data.append({
            '负责人': batch.owner,
            '批次名称': batch.batch_name,
            'Embedding版本': batch.embedding_version,
            '索引状态': batch.status,
            '总记录数': batch.total_records,
            '已索引': batch.indexed_records,
            '删除同步总数': len(delete_syncs),
            '删除失败数': failed_deletes,
            '召回校验总数': len(recall_validations),
            '召回通过数': passed_validations,
            '创建时间': batch.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            '更新时间': batch.updated_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    df_summary = pd.DataFrame(summary_data)
    df_summary.to_excel(writer, sheet_name='批次汇总', index=False)
    
    delete_data = []
    delete_syncs = db.query(DeleteSync).order_by(DeleteSync.created_at.desc()).all()
    for d in delete_syncs:
        batch = db.query(DataBatch).filter(DataBatch.id == d.batch_id).first()
        delete_data.append({
            '负责人': batch.owner if batch else '-',
            '批次名称': batch.batch_name if batch else '-',
            '记录ID': d.record_id,
            '状态': d.status,
            '失败原因': d.fail_reason or '-',
            '处理人': d.handler or '-',
            '处理时间': d.handled_at.strftime('%Y-%m-%d %H:%M:%S') if d.handled_at else '-',
            '创建时间': d.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    df_delete = pd.DataFrame(delete_data)
    df_delete.to_excel(writer, sheet_name='删除同步详情', index=False)
    
    recall_data = []
    validations = db.query(RecallValidation).order_by(RecallValidation.created_at.desc()).all()
    for v in validations:
        batch = db.query(DataBatch).filter(DataBatch.id == v.batch_id).first()
        recall_data.append({
            '负责人': batch.owner if batch else '-',
            '批次名称': batch.batch_name if batch else '-',
            '查询语句': v.query,
            '期望结果': v.expected_result or '-',
            '实际结果': v.actual_result or '-',
            '是否通过': '是' if v.is_valid else '否' if v.is_valid is not None else '-',
            '处理人': v.handler or '-',
            '处理时间': v.handled_at.strftime('%Y-%m-%d %H:%M:%S') if v.handled_at else '-',
            '创建时间': v.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    
    df_recall = pd.DataFrame(recall_data)
    df_recall.to_excel(writer, sheet_name='召回校验详情', index=False)
    
    writer.close()
    output.seek(0)
    
    return send_file(
        output,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'向量索引同步报告_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
    )


@app.route('/api/stats', methods=['GET'])
def get_stats():
    db = next(get_db())
    batches = db.query(DataBatch).all()
    
    stats = {
        'total_batches': len(batches),
        'status_counts': {},
        'owner_counts': {}
    }
    
    for batch in batches:
        stats['status_counts'][batch.status] = stats['status_counts'].get(batch.status, 0) + 1
        stats['owner_counts'][batch.owner] = stats['owner_counts'].get(batch.owner, 0) + 1
    
    return jsonify(stats)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
