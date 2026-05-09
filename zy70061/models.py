from datetime import datetime
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Student(db.Model):
    __tablename__ = 'students'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    student_no = db.Column(db.String(20), unique=True, nullable=False)
    name = db.Column(db.String(50), nullable=False)
    phone = db.Column(db.String(20))
    created_at = db.Column(db.DateTime, default=datetime.now)


class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    course_code = db.Column(db.String(20), unique=True, nullable=False)
    course_name = db.Column(db.String(100), nullable=False)
    total_hours = db.Column(db.Integer, nullable=False)
    unit_price = db.Column(db.Float, nullable=False)
    course_type = db.Column(db.String(20), default='普通班')


class Material(db.Model):
    __tablename__ = 'materials'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    material_code = db.Column(db.String(20), unique=True, nullable=False)
    material_name = db.Column(db.String(100), nullable=False)
    unit_price = db.Column(db.Float, nullable=False)


class Coupon(db.Model):
    __tablename__ = 'coupons'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    coupon_code = db.Column(db.String(20), unique=True, nullable=False)
    coupon_name = db.Column(db.String(100), nullable=False)
    discount_type = db.Column(db.String(20), nullable=False)
    discount_value = db.Column(db.Float, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)


class StudentEnrollment(db.Model):
    __tablename__ = 'student_enrollments'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    enrollment_no = db.Column(db.String(20), unique=True, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    paid_hours = db.Column(db.Integer, nullable=False)
    consumed_hours = db.Column(db.Integer, default=0)
    remaining_hours = db.Column(db.Integer, nullable=False)
    course_fee = db.Column(db.Float, nullable=False)
    paid_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='进行中')
    created_at = db.Column(db.DateTime, default=datetime.now)
    student = db.relationship('Student', backref='enrollments')
    course = db.relationship('Course', backref='enrollments')


class MaterialPurchase(db.Model):
    __tablename__ = 'material_purchases'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    purchase_no = db.Column(db.String(20), unique=True, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    material_id = db.Column(db.Integer, db.ForeignKey('materials.id'), nullable=False)
    quantity = db.Column(db.Integer, nullable=False)
    total_price = db.Column(db.Float, nullable=False)
    paid_amount = db.Column(db.Float, nullable=False)
    is_issued = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    student = db.relationship('Student', backref='material_purchases')
    material = db.relationship('Material', backref='purchases')


class CouponUsage(db.Model):
    __tablename__ = 'coupon_usages'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    usage_no = db.Column(db.String(20), unique=True, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    coupon_id = db.Column(db.Integer, db.ForeignKey('coupons.id'), nullable=False)
    related_enrollment_id = db.Column(db.Integer, db.ForeignKey('student_enrollments.id'))
    deducted_amount = db.Column(db.Float, nullable=False)
    is_recycled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    student = db.relationship('Student', backref='coupon_usages')
    coupon = db.relationship('Coupon', backref='usages')


class RefundApplication(db.Model):
    __tablename__ = 'refund_applications'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    application_no = db.Column(db.String(20), unique=True, nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    applicant = db.Column(db.String(50), nullable=False)
    application_time = db.Column(db.DateTime, default=datetime.now)
    status = db.Column(db.String(20), default='待审批')
    finance_status = db.Column(db.String(20), default='待处理')
    education_status = db.Column(db.String(20), default='待处理')
    total_refund_amount = db.Column(db.Float, default=0)
    course_refund = db.Column(db.Float, default=0)
    material_refund = db.Column(db.Float, default=0)
    coupon_recovery = db.Column(db.Float, default=0)
    approval_time = db.Column(db.DateTime)
    approver = db.Column(db.String(50))
    approval_comment = db.Column(db.String(500))
    student = db.relationship('Student', backref='refund_applications')
    items = db.relationship('RefundItem', backref='application', cascade='all, delete-orphan')
    transactions = db.relationship('RefundTransaction', backref='application', cascade='all, delete-orphan')


class RefundItem(db.Model):
    __tablename__ = 'refund_items'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    application_id = db.Column(db.Integer, db.ForeignKey('refund_applications.id'), nullable=False)
    item_type = db.Column(db.String(20), nullable=False)
    related_id = db.Column(db.Integer, nullable=False)
    related_no = db.Column(db.String(50))
    description = db.Column(db.String(200))
    original_amount = db.Column(db.Float, nullable=False)
    consumed_amount = db.Column(db.Float, default=0)
    refund_amount = db.Column(db.Float, nullable=False)


class RefundTransaction(db.Model):
    __tablename__ = 'refund_transactions'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    transaction_no = db.Column(db.String(20), unique=True, nullable=False)
    application_id = db.Column(db.Integer, db.ForeignKey('refund_applications.id'), nullable=False)
    transaction_type = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    operator = db.Column(db.String(50), nullable=False)
    operation_time = db.Column(db.DateTime, default=datetime.now)
    remark = db.Column(db.String(200))


class StatusLog(db.Model):
    __tablename__ = 'status_logs'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    application_id = db.Column(db.Integer, db.ForeignKey('refund_applications.id'), nullable=False)
    old_status = db.Column(db.String(20))
    new_status = db.Column(db.String(20), nullable=False)
    operator = db.Column(db.String(50), nullable=False)
    operation_time = db.Column(db.DateTime, default=datetime.now)
    remark = db.Column(db.String(200))
