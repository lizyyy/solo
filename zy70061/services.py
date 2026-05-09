from datetime import datetime
from models import (
    db, Student, Course, Material, Coupon,
    StudentEnrollment, MaterialPurchase, CouponUsage,
    RefundApplication, RefundItem, RefundTransaction, StatusLog
)


def generate_no(prefix):
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    import random
    random_suffix = str(random.randint(1000, 9999))
    return f"{prefix}{timestamp}{random_suffix}"


class RefundService:
    STATUS_FLOW = {
        '待审批': ['已通过', '已拒绝'],
        '已通过': ['退款中'],
        '退款中': ['已完成'],
        '已拒绝': [],
        '已完成': []
    }

    @staticmethod
    def create_application(data):
        student_no = data.get('student_no')
        applicant = data.get('applicant')
        reason = data.get('reason')
        items = data.get('items', [])

        student = Student.query.filter_by(student_no=student_no).first()
        if not student:
            return {'success': False, 'message': f'未找到学号为「{student_no}」的学员'}

        app_no = generate_no('REF')
        application = RefundApplication(
            application_no=app_no,
            student_id=student.id,
            reason=reason,
            applicant=applicant
        )
        db.session.add(application)
        db.session.flush()

        course_refund_total = 0
        material_refund_total = 0
        coupon_recovery_total = 0

        for item in items:
            item_type = item.get('type')
            if item_type == 'course':
                result = RefundService._process_course_item(application.id, item)
                if not result['success']:
                    db.session.rollback()
                    return result
                course_refund_total += result['refund_amount']
            elif item_type == 'material':
                result = RefundService._process_material_item(application.id, item)
                if not result['success']:
                    db.session.rollback()
                    return result
                material_refund_total += result['refund_amount']
            elif item_type == 'coupon':
                result = RefundService._process_coupon_item(application.id, item)
                if not result['success']:
                    db.session.rollback()
                    return result
                coupon_recovery_total += result['recovery_amount']
            else:
                db.session.rollback()
                return {'success': False, 'message': f'不支持的退费项目类型：{item_type}'}

        application.course_refund = course_refund_total
        application.material_refund = material_refund_total
        application.coupon_recovery = coupon_recovery_total
        application.total_refund_amount = course_refund_total + material_refund_total

        StatusLog.query.filter_by(application_id=application.id, old_status=None).delete()
        log = StatusLog(
            application_id=application.id,
            old_status=None,
            new_status='待审批',
            operator=applicant,
            remark='退费申请已提交'
        )
        db.session.add(log)
        db.session.commit()

        return {
            'success': True,
            'message': '退费申请已提交成功',
            'data': {
                'application_no': app_no,
                'student': {'no': student.student_no, 'name': student.name},
                'course_refund': course_refund_total,
                'material_refund': material_refund_total,
                'coupon_recovery': coupon_recovery_total,
                'total_refund': course_refund_total + material_refund_total,
                'status': '待审批'
            }
        }

    @staticmethod
    def _process_course_item(application_id, item):
        enrollment_no = item.get('enrollment_no')
        refund_hours = item.get('refund_hours', 0)

        enrollment = StudentEnrollment.query.filter_by(enrollment_no=enrollment_no).first()
        if not enrollment:
            return {'success': False, 'message': f'未找到报名记录「{enrollment_no}」'}

        if enrollment.status == '已退费':
            return {'success': False, 'message': f'报名「{enrollment_no}」已全部退费，无法再次申请'}

        if refund_hours <= 0:
            return {'success': False, 'message': f'退费课时必须大于0'}

        if refund_hours > enrollment.remaining_hours:
            return {
                'success': False,
                'message': f'剩余课时不足，当前剩余「{enrollment.remaining_hours}」课时，申请退费「{refund_hours}」课时'
            }

        course = enrollment.course
        unit_price = course.unit_price
        original_amount = unit_price * enrollment.paid_hours
        consumed_amount = unit_price * enrollment.consumed_hours
        refund_amount = unit_price * refund_hours

        refund_item = RefundItem(
            application_id=application_id,
            item_type='课程',
            related_id=enrollment.id,
            related_no=enrollment_no,
            description=f'{course.course_name}，退费{refund_hours}课时',
            original_amount=original_amount,
            consumed_amount=consumed_amount,
            refund_amount=refund_amount
        )
        db.session.add(refund_item)

        return {'success': True, 'refund_amount': refund_amount}

    @staticmethod
    def _process_material_item(application_id, item):
        purchase_no = item.get('purchase_no')
        refund_quantity = item.get('refund_quantity', 0)

        purchase = MaterialPurchase.query.filter_by(purchase_no=purchase_no).first()
        if not purchase:
            return {'success': False, 'message': f'未找到教材购买记录「{purchase_no}」'}

        if purchase.is_issued:
            return {'success': False, 'message': f'教材「{purchase.material.material_name}」已发放，不可退费'}

        if refund_quantity <= 0:
            return {'success': False, 'message': f'退费数量必须大于0'}

        total_remaining = purchase.quantity
        refunded_already = sum(
            ri.refund_amount / purchase.material.unit_price
            for ri in RefundItem.query.filter_by(item_type='教材', related_id=purchase.id).all()
        )
        available_quantity = total_remaining - int(refunded_already)

        if refund_quantity > available_quantity:
            return {
                'success': False,
                'message': f'剩余可退费数量不足，当前可退「{available_quantity}」本，申请退费「{refund_quantity}」本'
            }

        unit_price = purchase.material.unit_price
        refund_amount = unit_price * refund_quantity

        refund_item = RefundItem(
            application_id=application_id,
            item_type='教材',
            related_id=purchase.id,
            related_no=purchase_no,
            description=f'{purchase.material.material_name}，退费{refund_quantity}本',
            original_amount=purchase.total_price,
            consumed_amount=0,
            refund_amount=refund_amount
        )
        db.session.add(refund_item)

        return {'success': True, 'refund_amount': refund_amount}

    @staticmethod
    def _process_coupon_item(application_id, item):
        usage_no = item.get('usage_no')

        usage = CouponUsage.query.filter_by(usage_no=usage_no).first()
        if not usage:
            return {'success': False, 'message': f'未找到优惠券使用记录「{usage_no}」'}

        if usage.is_recycled:
            return {'success': False, 'message': f'优惠券使用记录「{usage_no}」已回收，不可重复回收'}

        recovery_amount = usage.deducted_amount

        refund_item = RefundItem(
            application_id=application_id,
            item_type='优惠券',
            related_id=usage.id,
            related_no=usage_no,
            description=f'{usage.coupon.coupon_name}，回收金额{recovery_amount}元',
            original_amount=recovery_amount,
            consumed_amount=0,
            refund_amount=recovery_amount
        )
        db.session.add(refund_item)

        return {'success': True, 'recovery_amount': recovery_amount}

    @staticmethod
    def approve_application(application_no, approver, action, comment=''):
        application = RefundApplication.query.filter_by(application_no=application_no).first()
        if not application:
            return {'success': False, 'message': f'未找到退费申请「{application_no}」'}

        current_status = application.status
        allowed_next = RefundService.STATUS_FLOW.get(current_status, [])
        next_status = '已通过' if action == 'approve' else '已拒绝'

        if next_status not in allowed_next:
            return {
                'success': False,
                'message': f'状态流转不合法：当前状态为「{current_status}」，不能执行「{"审批通过" if action == "approve" else "审批拒绝"}」操作',
                'allowed_actions': RefundService._get_allowed_actions(current_status)
            }

        old_status = current_status
        application.status = next_status
        application.approver = approver
        application.approval_time = datetime.now()
        application.approval_comment = comment

        log = StatusLog(
            application_id=application.id,
            old_status=old_status,
            new_status=next_status,
            operator=approver,
            remark=f'审批{"通过" if action == "approve" else "拒绝"}: {comment}'
        )
        db.session.add(log)

        if next_status == '已通过':
            application.education_status = '已确认'
            application.finance_status = '待打款'

        db.session.commit()

        return {
            'success': True,
            'message': f'审批{"通过" if action == "approve" else "拒绝"}成功',
            'data': {
                'application_no': application_no,
                'old_status': old_status,
                'new_status': next_status,
                'approver': approver,
                'comment': comment
            }
        }

    @staticmethod
    def execute_refund(application_no, operator):
        application = RefundApplication.query.filter_by(application_no=application_no).first()
        if not application:
            return {'success': False, 'message': f'未找到退费申请「{application_no}」'}

        current_status = application.status
        allowed_next = RefundService.STATUS_FLOW.get(current_status, [])
        next_status = '退款中'

        if next_status not in allowed_next:
            return {
                'success': False,
                'message': f'状态流转不合法：当前状态为「{current_status}」，不能执行「打款」操作',
                'allowed_actions': RefundService._get_allowed_actions(current_status)
            }

        old_status = current_status
        application.status = next_status
        application.finance_status = '打款中'

        log = StatusLog(
            application_id=application.id,
            old_status=old_status,
            new_status=next_status,
            operator=operator,
            remark='财务已执行打款'
        )
        db.session.add(log)

        transaction_no = generate_no('TXN')
        transaction = RefundTransaction(
            transaction_no=transaction_no,
            application_id=application.id,
            transaction_type='退款打款',
            amount=application.total_refund_amount,
            operator=operator,
            remark=f'退费申请「{application_no}」打款'
        )
        db.session.add(transaction)
        db.session.commit()

        return {
            'success': True,
            'message': '退款打款已执行',
            'data': {
                'application_no': application_no,
                'transaction_no': transaction_no,
                'refund_amount': application.total_refund_amount,
                'old_status': old_status,
                'new_status': next_status
            }
        }

    @staticmethod
    def complete_refund(application_no, operator):
        application = RefundApplication.query.filter_by(application_no=application_no).first()
        if not application:
            return {'success': False, 'message': f'未找到退费申请「{application_no}」'}

        current_status = application.status
        allowed_next = RefundService.STATUS_FLOW.get(current_status, [])
        next_status = '已完成'

        if next_status not in allowed_next:
            return {
                'success': False,
                'message': f'状态流转不合法：当前状态为「{current_status}」，不能执行「确认到账」操作',
                'allowed_actions': RefundService._get_allowed_actions(current_status)
            }

        old_status = current_status
        application.status = next_status
        application.finance_status = '已完成'

        RefundService._update_business_data(application)

        log = StatusLog(
            application_id=application.id,
            old_status=old_status,
            new_status=next_status,
            operator=operator,
            remark='学员已确认收到退款'
        )
        db.session.add(log)

        transaction_no = generate_no('TXN')
        transaction = RefundTransaction(
            transaction_no=transaction_no,
            application_id=application.id,
            transaction_type='退款确认',
            amount=application.total_refund_amount,
            operator=operator,
            remark=f'退费申请「{application_no}」确认完成'
        )
        db.session.add(transaction)
        db.session.commit()

        return {
            'success': True,
            'message': '退费流程已完成',
            'data': {
                'application_no': application_no,
                'transaction_no': transaction_no,
                'total_refund': application.total_refund_amount,
                'old_status': old_status,
                'new_status': next_status
            }
        }

    @staticmethod
    def _update_business_data(application):
        for item in application.items:
            if item.item_type == '课程':
                enrollment = StudentEnrollment.query.get(item.related_id)
                if enrollment:
                    refund_hours = int(item.refund_amount / enrollment.course.unit_price)
                    enrollment.remaining_hours -= refund_hours
                    if enrollment.remaining_hours == 0:
                        enrollment.status = '已退费'
                    db.session.add(enrollment)
            elif item.item_type == '教材':
                purchase = MaterialPurchase.query.get(item.related_id)
                if purchase:
                    refund_qty = int(item.refund_amount / purchase.material.unit_price)
                    purchase.quantity -= refund_qty
                    db.session.add(purchase)
            elif item.item_type == '优惠券':
                usage = CouponUsage.query.get(item.related_id)
                if usage:
                    usage.is_recycled = True
                    db.session.add(usage)

    @staticmethod
    def _get_allowed_actions(current_status):
        action_map = {
            '待审批': ['审批通过', '审批拒绝'],
            '已通过': ['财务打款'],
            '退款中': ['确认到账'],
            '已拒绝': [],
            '已完成': []
        }
        return action_map.get(current_status, [])

    @staticmethod
    def get_application_detail(application_no):
        application = RefundApplication.query.filter_by(application_no=application_no).first()
        if not application:
            return {'success': False, 'message': f'未找到退费申请「{application_no}」'}

        items = []
        for item in application.items:
            items.append({
                'type': item.item_type,
                'related_no': item.related_no,
                'description': item.description,
                'original_amount': item.original_amount,
                'consumed_amount': item.consumed_amount,
                'refund_amount': item.refund_amount
            })

        logs = []
        for log in StatusLog.query.filter_by(application_id=application.id).order_by(StatusLog.operation_time).all():
            logs.append({
                'old_status': log.old_status,
                'new_status': log.new_status,
                'operator': log.operator,
                'time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'remark': log.remark
            })

        transactions = []
        for txn in application.transactions:
            transactions.append({
                'transaction_no': txn.transaction_no,
                'type': txn.transaction_type,
                'amount': txn.amount,
                'operator': txn.operator,
                'time': txn.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'remark': txn.remark
            })

        return {
            'success': True,
            'data': {
                'application_no': application.application_no,
                'student': {
                    'no': application.student.student_no,
                    'name': application.student.name,
                    'phone': application.student.phone
                },
                'reason': application.reason,
                'applicant': application.applicant,
                'application_time': application.application_time.strftime('%Y-%m-%d %H:%M:%S'),
                'status': application.status,
                'finance_status': application.finance_status,
                'education_status': application.education_status,
                'course_refund': application.course_refund,
                'material_refund': application.material_refund,
                'coupon_recovery': application.coupon_recovery,
                'total_refund': application.total_refund_amount,
                'items': items,
                'status_history': logs,
                'transactions': transactions,
                'approver': application.approver,
                'approval_time': application.approval_time.strftime('%Y-%m-%d %H:%M:%S') if application.approval_time else None,
                'approval_comment': application.approval_comment
            }
        }

    @staticmethod
    def list_applications(status=None):
        query = RefundApplication.query
        if status:
            query = query.filter_by(status=status)
        applications = query.order_by(RefundApplication.application_time.desc()).all()

        result = []
        for app in applications:
            result.append({
                'application_no': app.application_no,
                'student_name': app.student.name,
                'student_no': app.student.student_no,
                'reason': app.reason,
                'status': app.status,
                'total_refund': app.total_refund_amount,
                'application_time': app.application_time.strftime('%Y-%m-%d %H:%M:%S')
            })
        return {'success': True, 'data': result}

    @staticmethod
    def export_reconciliation(start_date=None, end_date=None):
        query = RefundApplication.query
        if start_date:
            query = query.filter(RefundApplication.application_time >= start_date)
        if end_date:
            query = query.filter(RefundApplication.application_time <= end_date)

        applications = query.order_by(RefundApplication.application_time).all()

        rows = []
        total_course_refund = 0
        total_material_refund = 0
        total_coupon_recovery = 0
        total_net_refund = 0

        for app in applications:
            net_refund = app.total_refund_amount - app.coupon_recovery
            total_course_refund += app.course_refund
            total_material_refund += app.material_refund
            total_coupon_recovery += app.coupon_recovery
            total_net_refund += net_refund

            rows.append({
                '申请编号': app.application_no,
                '学员姓名': app.student.name,
                '学员学号': app.student.student_no,
                '申请时间': app.application_time.strftime('%Y-%m-%d %H:%M:%S'),
                '申请状态': app.status,
                '课程退费': app.course_refund,
                '教材退费': app.material_refund,
                '优惠券回收': app.coupon_recovery,
                '实际退款金额': net_refund,
                '审批人': app.approver or '',
                '审批时间': app.approval_time.strftime('%Y-%m-%d %H:%M:%S') if app.approval_time else ''
            })

        summary = {
            '课程退费合计': total_course_refund,
            '教材退费合计': total_material_refund,
            '优惠券回收合计': total_coupon_recovery,
            '实际退款合计': total_net_refund
        }

        return {
            'success': True,
            'data': {
                'records': rows,
                'summary': summary,
                'record_count': len(rows)
            }
        }

    @staticmethod
    def get_student_info(student_no):
        student = Student.query.filter_by(student_no=student_no).first()
        if not student:
            return {'success': False, 'message': f'未找到学号为「{student_no}」的学员'}

        enrollments = []
        for e in student.enrollments:
            enrollments.append({
                'enrollment_no': e.enrollment_no,
                'course_name': e.course.course_name,
                'paid_hours': e.paid_hours,
                'consumed_hours': e.consumed_hours,
                'remaining_hours': e.remaining_hours,
                'unit_price': e.course.unit_price,
                'course_fee': e.course_fee,
                'status': e.status
            })

        materials = []
        for mp in student.material_purchases:
            materials.append({
                'purchase_no': mp.purchase_no,
                'material_name': mp.material.material_name,
                'quantity': mp.quantity,
                'unit_price': mp.material.unit_price,
                'is_issued': '已发放' if mp.is_issued else '未发放'
            })

        coupons = []
        for cu in student.coupon_usages:
            coupons.append({
                'usage_no': cu.usage_no,
                'coupon_name': cu.coupon.coupon_name,
                'deducted_amount': cu.deducted_amount,
                'is_recycled': '已回收' if cu.is_recycled else '可回收'
            })

        return {
            'success': True,
            'data': {
                'student': {
                    'no': student.student_no,
                    'name': student.name,
                    'phone': student.phone
                },
                'enrollments': enrollments,
                'materials': materials,
                'coupons': coupons
            }
        }
