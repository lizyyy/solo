from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, Note, CompressionResult, AEDResult

notes_bp = Blueprint('notes', __name__)

@notes_bp.route('/compression/<int:result_id>', methods=['POST'])
def add_compression_note(result_id):
    result = CompressionResult.query.get_or_404(result_id)
    
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': '缺少备注内容'}), 400
    
    note = Note(
        compression_result_id=result_id,
        note_type='compression_review',
        content=data['content'],
        created_by=data.get('created_by', '老师')
    )
    
    db.session.add(note)
    db.session.commit()
    
    return jsonify({
        'id': note.id,
        'message': '备注添加成功'
    }), 201

@notes_bp.route('/aed/<int:result_id>', methods=['POST'])
def add_aed_note(result_id):
    result = AEDResult.query.get_or_404(result_id)
    
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': '缺少备注内容'}), 400
    
    note = Note(
        aed_result_id=result_id,
        note_type='aed_review',
        content=data['content'],
        created_by=data.get('created_by', '老师')
    )
    
    db.session.add(note)
    db.session.commit()
    
    return jsonify({
        'id': note.id,
        'message': '备注添加成功'
    }), 201

@notes_bp.route('/<int:note_id>', methods=['PUT'])
def update_note(note_id):
    note = Note.query.get_or_404(note_id)
    
    data = request.get_json()
    if not data or 'content' not in data:
        return jsonify({'error': '缺少备注内容'}), 400
    
    note.content = data['content']
    note.updated_at = datetime.utcnow()
    
    db.session.commit()
    
    return jsonify({'message': '备注更新成功'})

@notes_bp.route('/<int:note_id>', methods=['DELETE'])
def delete_note(note_id):
    note = Note.query.get_or_404(note_id)
    
    db.session.delete(note)
    db.session.commit()
    
    return jsonify({'message': '备注已删除'})

@notes_bp.route('/compression/<int:result_id>', methods=['GET'])
def get_compression_notes(result_id):
    notes = Note.query.filter_by(compression_result_id=result_id).order_by(Note.created_at).all()
    
    result = []
    for n in notes:
        result.append({
            'id': n.id,
            'content': n.content,
            'created_by': n.created_by,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': n.updated_at.strftime('%Y-%m-%d %H:%M:%S') if n.updated_at else None
        })
    
    return jsonify(result)

@notes_bp.route('/aed/<int:result_id>', methods=['GET'])
def get_aed_notes(result_id):
    notes = Note.query.filter_by(aed_result_id=result_id).order_by(Note.created_at).all()
    
    result = []
    for n in notes:
        result.append({
            'id': n.id,
            'content': n.content,
            'created_by': n.created_by,
            'created_at': n.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'updated_at': n.updated_at.strftime('%Y-%m-%d %H:%M:%S') if n.updated_at else None
        })
    
    return jsonify(result)
