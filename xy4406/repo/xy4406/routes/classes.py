from datetime import datetime
from flask import Blueprint, request, jsonify
from models import db, TrainingClass, Student, Group

classes_bp = Blueprint('classes', __name__)

@classes_bp.route('/', methods=['GET'])
def get_classes():
    classes = TrainingClass.query.order_by(TrainingClass.training_date.desc()).all()
    result = []
    for c in classes:
        student_count = Student.query.filter_by(class_id=c.id).count()
        group_count = Group.query.filter_by(class_id=c.id).count()
        result.append({
            'id': c.id,
            'name': c.name,
            'training_date': c.training_date.strftime('%Y-%m-%d') if c.training_date else None,
            'instructor': c.instructor,
            'location': c.location,
            'student_count': student_count,
            'group_count': group_count,
            'notes': c.notes,
            'created_at': c.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })
    return jsonify(result)

@classes_bp.route('/', methods=['POST'])
def create_class():
    data = request.get_json()
    
    required_fields = ['name', 'training_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'缺少必填字段: {field}'}), 400
    
    try:
        training_date = datetime.strptime(data['training_date'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': '日期格式错误，应为 YYYY-MM-DD'}), 400
    
    new_class = TrainingClass(
        name=data['name'],
        training_date=training_date,
        instructor=data.get('instructor'),
        location=data.get('location'),
        notes=data.get('notes')
    )
    
    db.session.add(new_class)
    db.session.commit()
    
    return jsonify({
        'id': new_class.id,
        'message': '班级创建成功'
    }), 201

@classes_bp.route('/<int:class_id>', methods=['GET'])
def get_class_detail(class_id):
    training_class = TrainingClass.query.get_or_404(class_id)
    
    students = Student.query.filter_by(class_id=class_id).all()
    groups = Group.query.filter_by(class_id=class_id).all()
    
    students_list = []
    for s in students:
        students_list.append({
            'id': s.id,
            'student_id': s.student_id,
            'name': s.name,
            'gender': s.gender,
            'age': s.age,
            'group_id': s.group_id
        })
    
    groups_list = []
    for g in groups:
        group_students = [s.name for s in g.students]
        groups_list.append({
            'id': g.id,
            'group_number': g.group_number,
            'group_name': g.group_name,
            'device_id': g.device_id,
            'students': group_students
        })
    
    return jsonify({
        'class': {
            'id': training_class.id,
            'name': training_class.name,
            'training_date': training_class.training_date.strftime('%Y-%m-%d') if training_class.training_date else None,
            'instructor': training_class.instructor,
            'location': training_class.location,
            'notes': training_class.notes
        },
        'students': students_list,
        'groups': groups_list
    })

@classes_bp.route('/<int:class_id>', methods=['PUT'])
def update_class(class_id):
    training_class = TrainingClass.query.get_or_404(class_id)
    data = request.get_json()
    
    if 'name' in data:
        training_class.name = data['name']
    if 'training_date' in data:
        try:
            training_class.training_date = datetime.strptime(data['training_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '日期格式错误，应为 YYYY-MM-DD'}), 400
    if 'instructor' in data:
        training_class.instructor = data['instructor']
    if 'location' in data:
        training_class.location = data['location']
    if 'notes' in data:
        training_class.notes = data['notes']
    
    db.session.commit()
    
    return jsonify({'message': '班级信息更新成功'})

@classes_bp.route('/<int:class_id>', methods=['DELETE'])
def delete_class(class_id):
    training_class = TrainingClass.query.get_or_404(class_id)
    
    db.session.delete(training_class)
    db.session.commit()
    
    return jsonify({'message': '班级已删除'})
