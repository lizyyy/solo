from flask import Flask, request, jsonify
from models import (
    db, Student, Course, Material, Coupon,
    StudentEnrollment, MaterialPurchase, CouponUsage
)
from services import RefundService
from datetime import datetime, timedelta
import os

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///refund_system.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db.init_app(app)


def init_sample_data():
    if Student.query.count() > 0:
        print('样例数据已存在，跳过初始化')
        return

    print('正在初始化样例数据...')

    s1 = Student(student_no='S001', name='张三', phone='13800138001')
    s2 = Student(student_no='S002', name='李四', phone='13800138002')
    s3 = Student(student_no='S003', name='王五', phone='13800138003')
    db.session.add_all([s1, s2, s3])

    c1 = Course(course_code='MATH101', course_name='小学数学进阶班', total_hours=40, unit_price=150.0, course_type='普通班')
    c2 = Course(course_code='ENG101', course_name='初中英语强化班', total_hours=30, unit_price=200.0, course_type='强化班')
    c3 = Course(course_code='ART101', course_name='少儿美术兴趣班', total_hours=20, unit_price=100.0, course_type='兴趣班')
    db.session.add_all([c1, c2, c3])

    m1 = Material(material_code='MAT001', material_name='《数学思维训练》教材', unit_price=80.0)
    m2 = Material(material_code='MAT002', material_name='《英语语法大全》', unit_price=120.0)
    m3 = Material(material_code='MAT003', material_name='美术画材套装', unit_price=200.0)
    db.session.add_all([m1, m2, m3])

    cp1 = Coupon(coupon_code='NEW200', coupon_name='新学员立减券', discount_type='立减', discount_value=200.0, total_amount=200.0)
    cp2 = Coupon(coupon_code='VIP10PCT', coupon_name='VIP九折券', discount_type='折扣', discount_value=0.9, total_amount=300.0)
    cp3 = Coupon(coupon_code='SUMMER500', coupon_name='暑期特惠券', discount_type='立减', discount_value=500.0, total_amount=500.0)
    db.session.add_all([cp1, cp2, cp3])
    db.session.flush()

    e1 = StudentEnrollment(
        enrollment_no='ENR001', student_id=s1.id, course_id=c1.id,
        paid_hours=40, consumed_hours=12, remaining_hours=28,
        course_fee=6000.0, paid_amount=5800.0, status='进行中'
    )
    e2 = StudentEnrollment(
        enrollment_no='ENR002', student_id=s2.id, course_id=c2.id,
        paid_hours=30, consumed_hours=5, remaining_hours=25,
        course_fee=6000.0, paid_amount=5700.0, status='进行中'
    )
    e3 = StudentEnrollment(
        enrollment_no='ENR003', student_id=s3.id, course_id=c3.id,
        paid_hours=20, consumed_hours=20, remaining_hours=0,
        course_fee=2000.0, paid_amount=1500.0, status='已完成'
    )
    e4 = StudentEnrollment(
        enrollment_no='ENR004', student_id=s2.id, course_id=c1.id,
        paid_hours=20, consumed_hours=8, remaining_hours=12,
        course_fee=3000.0, paid_amount=3000.0, status='进行中'
    )
    db.session.add_all([e1, e2, e3, e4])
    db.session.flush()

    mp1 = MaterialPurchase(
        purchase_no='MP001', student_id=s1.id, material_id=m1.id,
        quantity=1, total_price=80.0, paid_amount=80.0, is_issued=False
    )
    mp2 = MaterialPurchase(
        purchase_no='MP002', student_id=s2.id, material_id=m2.id,
        quantity=1, total_price=120.0, paid_amount=120.0, is_issued=True
    )
    mp3 = MaterialPurchase(
        purchase_no='MP003', student_id=s1.id, material_id=m3.id,
        quantity=2, total_price=400.0, paid_amount=400.0, is_issued=False
    )
    db.session.add_all([mp1, mp2, mp3])
    db.session.flush()

    cu1 = CouponUsage(
        usage_no='CU001', student_id=s1.id, coupon_id=cp1.id,
        related_enrollment_id=e1.id, deducted_amount=200.0, is_recycled=False
    )
    cu2 = CouponUsage(
        usage_no='CU002', student_id=s2.id, coupon_id=cp2.id,
        related_enrollment_id=e2.id, deducted_amount=300.0, is_recycled=False
    )
    cu3 = CouponUsage(
        usage_no='CU003', student_id=s3.id, coupon_id=cp3.id,
        related_enrollment_id=e3.id, deducted_amount=500.0, is_recycled=False
    )
    db.session.add_all([cu1, cu2, cu3])

    db.session.commit()
    print('样例数据初始化完成')


@app.route('/api/students/<student_no>', methods=['GET'])
def get_student(student_no):
    result = RefundService.get_student_info(student_no)
    return jsonify(result)


@app.route('/api/refund/applications', methods=['POST'])
def create_application():
    data = request.get_json()
    result = RefundService.create_application(data)
    return jsonify(result)


@app.route('/api/refund/applications', methods=['GET'])
def list_applications():
    status = request.args.get('status')
    result = RefundService.list_applications(status)
    return jsonify(result)


@app.route('/api/refund/applications/<application_no>', methods=['GET'])
def get_application(application_no):
    result = RefundService.get_application_detail(application_no)
    return jsonify(result)


@app.route('/api/refund/applications/<application_no>/approve', methods=['POST'])
def approve_application(application_no):
    data = request.get_json() or {}
    approver = data.get('approver', '系统管理员')
    comment = data.get('comment', '')
    result = RefundService.approve_application(application_no, approver, 'approve', comment)
    return jsonify(result)


@app.route('/api/refund/applications/<application_no>/reject', methods=['POST'])
def reject_application(application_no):
    data = request.get_json() or {}
    approver = data.get('approver', '系统管理员')
    comment = data.get('comment', '')
    result = RefundService.approve_application(application_no, approver, 'reject', comment)
    return jsonify(result)


@app.route('/api/refund/applications/<application_no>/execute', methods=['POST'])
def execute_refund(application_no):
    data = request.get_json() or {}
    operator = data.get('operator', '财务专员')
    result = RefundService.execute_refund(application_no, operator)
    return jsonify(result)


@app.route('/api/refund/applications/<application_no>/complete', methods=['POST'])
def complete_refund(application_no):
    data = request.get_json() or {}
    operator = data.get('operator', '系统确认')
    result = RefundService.complete_refund(application_no, operator)
    return jsonify(result)


@app.route('/api/reconciliation/export', methods=['GET'])
def export_reconciliation():
    start_date_str = request.args.get('start_date')
    end_date_str = request.args.get('end_date')
    
    start_date = None
    end_date = None
    if start_date_str:
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
    if end_date_str:
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1)
    
    result = RefundService.export_reconciliation(start_date, end_date)
    return jsonify(result)


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'success': True,
        'message': '课程退费分摊API服务运行正常',
        'time': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    })


def format_result_for_cli(result):
    if not result.get('success'):
        lines = [
            '=' * 60,
            '❌ 操作失败',
            '=' * 60,
            f'失败原因: {result.get("message", "未知错误")}',
        ]
        if 'allowed_actions' in result:
            lines.append(f'当前可执行操作: {", ".join(result["allowed_actions"]) or "无"}')
        lines.append('=' * 60)
        return '\n'.join(lines)

    data = result.get('data', {})
    lines = [
        '=' * 60,
        '✅ 操作成功',
        '=' * 60,
        f'操作说明: {result.get("message", "")}',
        '-' * 60,
    ]

    if 'application_no' in data:
        lines.append(f'申请编号: {data["application_no"]}')
    if 'student' in data and isinstance(data['student'], dict):
        student = data['student']
        lines.append(f'学员信息: {student.get("name", "")} ({student.get("no", "")})')
    if 'course_refund' in data:
        lines.append(f'课程退费: {data["course_refund"]:.2f} 元')
    if 'material_refund' in data:
        lines.append(f'教材退费: {data["material_refund"]:.2f} 元')
    if 'coupon_recovery' in data:
        lines.append(f'优惠券回收: {data["coupon_recovery"]:.2f} 元')
    if 'total_refund' in data:
        lines.append(f'退费合计: {data["total_refund"]:.2f} 元')
    if 'old_status' in data:
        lines.append(f'状态变化: {data["old_status"]} → {data["new_status"]}')
    if 'transaction_no' in data:
        lines.append(f'交易流水号: {data["transaction_no"]}')
    if 'refund_amount' in data and 'total_refund' not in data:
        lines.append(f'退款金额: {data["refund_amount"]:.2f} 元')
    if 'approver' in data:
        lines.append(f'审批人: {data["approver"]}')
    if 'comment' in data and data['comment']:
        lines.append(f'审批备注: {data["comment"]}')
    if 'status' in data:
        lines.append(f'当前状态: {data["status"]}')

    lines.append('=' * 60)
    return '\n'.join(lines)


def interactive_cli():
    with app.app_context():
        while True:
            print('\n' + '=' * 60)
            print('🎓 课程退费分摊系统 - 命令行模式')
            print('=' * 60)
            print('请选择操作:')
            print('  1. 查看学员信息及可退费项目')
            print('  2. 提交退费申请（正常流程）')
            print('  3. 审批通过退费申请')
            print('  4. 财务打款')
            print('  5. 确认退费完成')
            print('  6. 查看申请详情')
            print('  7. 异常场景测试（重复提交/非法流转）')
            print('  8. 查看所有退费申请')
            print('  9. 对账汇总（财务口径）')
            print('  0. 退出')
            print('=' * 60)

            choice = input('请输入选项 (0-9): ').strip()

            if choice == '0':
                print('感谢使用，再见！')
                break

            elif choice == '1':
                student_no = input('请输入学员学号 (如 S001): ').strip() or 'S001'
                result = RefundService.get_student_info(student_no)
                if result['success']:
                    data = result['data']
                    print('\n' + '=' * 60)
                    print(f'📋 学员信息: {data["student"]["name"]} ({data["student"]["no"]})')
                    print('=' * 60)
                    print('📚 已报课程:')
                    for e in data['enrollments']:
                        print(f'  [{e["enrollment_no"]}] {e["course_name"]}')
                        print(f'      已购课时: {e["paid_hours"]} | 已消耗: {e["consumed_hours"]} | 剩余: {e["remaining_hours"]}')
                        print(f'      单价: {e["unit_price"]:.2f}元/课时 | 状态: {e["status"]}')
                    print('\n📖 已购教材:')
                    for m in data['materials']:
                        print(f'  [{m["purchase_no"]}] {m["material_name"]}')
                        print(f'      数量: {m["quantity"]}本 | 单价: {m["unit_price"]:.2f}元 | 发放状态: {m["is_issued"]}')
                    print('\n🎫 优惠券使用记录:')
                    for c in data['coupons']:
                        print(f'  [{c["usage_no"]}] {c["coupon_name"]}')
                        print(f'      抵扣金额: {c["deducted_amount"]:.2f}元 | 回收状态: {c["is_recycled"]}')
                    print('=' * 60)
                else:
                    print(format_result_for_cli(result))

            elif choice == '2':
                print('\n📝 提交退费申请')
                print('提示: 学员 S001 有以下可退项目:')
                print('  - 课程 [ENR001]: 剩余28课时，单价150元')
                print('  - 教材 [MP001]: 1本，未发放')
                print('  - 教材 [MP003]: 2本，未发放')
                print('  - 优惠券 [CU001]: 新学员立减券，抵扣200元')
                print()
                student_no = input('学员学号 (默认 S001): ').strip() or 'S001'
                applicant = input('申请人 (默认 前台小李): ').strip() or '前台小李'
                reason = input('退费原因 (默认 学员转学): ').strip() or '学员转学'
                
                refund_hours = input('退费课时数 (默认 10): ').strip()
                refund_hours = int(refund_hours) if refund_hours else 10
                
                include_material = input('是否包含教材退费? (y/n，默认 y): ').strip().lower() or 'y'
                include_coupon = input('是否包含优惠券回收? (y/n，默认 y): ').strip().lower() or 'y'

                items = [
                    {'type': 'course', 'enrollment_no': 'ENR001', 'refund_hours': refund_hours}
                ]
                if include_material == 'y':
                    items.append({'type': 'material', 'purchase_no': 'MP001', 'refund_quantity': 1})
                if include_coupon == 'y':
                    items.append({'type': 'coupon', 'usage_no': 'CU001'})

                data = {
                    'student_no': student_no,
                    'applicant': applicant,
                    'reason': reason,
                    'items': items
                }
                result = RefundService.create_application(data)
                print('\n' + format_result_for_cli(result))
                if result['success']:
                    print(f'💡 请记住申请编号: {result["data"]["application_no"]}，后续操作需要使用')

            elif choice == '3':
                app_no = input('请输入申请编号: ').strip()
                if not app_no:
                    print('⚠️ 请先执行选项2提交申请，获取申请编号')
                    continue
                approver = input('审批人 (默认 教务主任王老师): ').strip() or '教务主任王老师'
                comment = input('审批备注 (默认 情况属实，同意退费): ').strip() or '情况属实，同意退费'
                result = RefundService.approve_application(app_no, approver, 'approve', comment)
                print('\n' + format_result_for_cli(result))

            elif choice == '4':
                app_no = input('请输入申请编号: ').strip()
                if not app_no:
                    print('⚠️ 请先执行选项2-3完成审批')
                    continue
                operator = input('操作人 (默认 财务小张): ').strip() or '财务小张'
                result = RefundService.execute_refund(app_no, operator)
                print('\n' + format_result_for_cli(result))

            elif choice == '5':
                app_no = input('请输入申请编号: ').strip()
                if not app_no:
                    print('⚠️ 请先执行选项2-4完成打款')
                    continue
                operator = input('操作人 (默认 系统确认): ').strip() or '系统确认'
                result = RefundService.complete_refund(app_no, operator)
                print('\n' + format_result_for_cli(result))

            elif choice == '6':
                app_no = input('请输入申请编号: ').strip()
                if not app_no:
                    print('⚠️ 请输入申请编号')
                    continue
                result = RefundService.get_application_detail(app_no)
                if result['success']:
                    data = result['data']
                    print('\n' + '=' * 60)
                    print(f'📋 退费申请详情: {data["application_no"]}')
                    print('=' * 60)
                    print(f'学员: {data["student"]["name"]} ({data["student"]["no"]})')
                    print(f'申请时间: {data["application_time"]}')
                    print(f'申请原因: {data["reason"]}')
                    print(f'申请人: {data["applicant"]}')
                    print(f'当前状态: {data["status"]}')
                    print(f'教务口径状态: {data["education_status"]}')
                    print(f'财务口径状态: {data["finance_status"]}')
                    print('-' * 60)
                    print('💰 费用明细:')
                    print(f'  课程退费: {data["course_refund"]:.2f} 元')
                    print(f'  教材退费: {data["material_refund"]:.2f} 元')
                    print(f'  优惠券回收: {data["coupon_recovery"]:.2f} 元')
                    print(f'  实际退款金额: {data["total_refund"] - data["coupon_recovery"]:.2f} 元')
                    print('-' * 60)
                    print('📦 退费项目明细:')
                    for item in data['items']:
                        print(f'  [{item["type"]}] {item["description"]}')
                        print(f'      原价: {item["original_amount"]:.2f} | 已消耗: {item["consumed_amount"]:.2f} | 退费: {item["refund_amount"]:.2f}')
                    print('-' * 60)
                    print('📜 状态流转历史:')
                    for log in data['status_history']:
                        old = log['old_status'] or '(初始)'
                        print(f'  [{log["time"]}] {log["operator"]}: {old} → {log["new_status"]}')
                        print(f'      备注: {log["remark"]}')
                    if data['transactions']:
                        print('-' * 60)
                        print('💳 退款流水:')
                        for txn in data['transactions']:
                            print(f'  [{txn["transaction_no"]}] {txn["type"]}: {txn["amount"]:.2f}元')
                            print(f'      操作人: {txn["operator"]} | 时间: {txn["time"]}')
                    if data['approver']:
                        print('-' * 60)
                        print(f'审批人: {data["approver"]}')
                        print(f'审批时间: {data["approval_time"]}')
                        print(f'审批备注: {data["approval_comment"]}')
                    print('=' * 60)
                else:
                    print(format_result_for_cli(result))

            elif choice == '7':
                print('\n🧪 异常场景测试')
                print('=' * 60)
                print('请选择要测试的异常场景:')
                print('  A. 非法状态流转: 待审批 → 直接打款')
                print('  B. 非法状态流转: 已完成 → 再次审批')
                print('  C. 重复操作: 同一报名多次退费（超剩余课时）')
                print('  D. 业务规则拦截: 已发放教材申请退费')
                print('  E. 业务规则拦截: 已回收优惠券再次回收')
                print('  F. 返回演示')
                
                sub_choice = input('请选择 (A-F): ').strip().upper()

                if sub_choice == 'A':
                    print('\n📌 测试场景: 待审批状态直接执行打款（非法流转）')
                    data = {
                        'student_no': 'S002',
                        'applicant': '测试人员',
                        'reason': '异常测试',
                        'items': [{'type': 'course', 'enrollment_no': 'ENR002', 'refund_hours': 5}]
                    }
                    create_result = RefundService.create_application(data)
                    if create_result['success']:
                        app_no = create_result['data']['application_no']
                        print(f'✅ 已创建申请: {app_no}，状态: 待审批')
                        print('\n尝试直接执行打款操作...')
                        result = RefundService.execute_refund(app_no, '测试财务')
                        print('\n' + format_result_for_cli(result))

                elif sub_choice == 'B':
                    print('\n📌 测试场景: 已完成的申请再次审批（非法流转）')
                    result1 = RefundService.get_student_info('S003')
                    if result1['success'] and len(result1['data']['enrollments']) > 0:
                        data = {
                            'student_no': 'S002',
                            'applicant': '测试人员',
                            'reason': '完整流程测试',
                            'items': [{'type': 'course', 'enrollment_no': 'ENR004', 'refund_hours': 5}]
                        }
                        create_result = RefundService.create_application(data)
                        if create_result['success']:
                            app_no = create_result['data']['application_no']
                            print(f'✅ 已创建申请: {app_no}')
                            RefundService.approve_application(app_no, '审批人A', 'approve', '测试')
                            print('✅ 已审批通过')
                            RefundService.execute_refund(app_no, '财务A')
                            print('✅ 已打款')
                            RefundService.complete_refund(app_no, '确认人A')
                            print('✅ 已确认完成')
                            print('\n尝试对已完成的申请再次执行审批...')
                            result = RefundService.approve_application(app_no, '审批人B', 'approve', '再次审批')
                            print('\n' + format_result_for_cli(result))

                elif sub_choice == 'C':
                    print('\n📌 测试场景: 超出剩余课时申请退费（业务规则拦截）')
                    data = {
                        'student_no': 'S001',
                        'applicant': '测试人员',
                        'reason': '超额退费测试',
                        'items': [{'type': 'course', 'enrollment_no': 'ENR001', 'refund_hours': 100}]
                    }
                    result = RefundService.create_application(data)
                    print('\n' + format_result_for_cli(result))

                elif sub_choice == 'D':
                    print('\n📌 测试场景: 已发放教材申请退费（业务规则拦截）')
                    data = {
                        'student_no': 'S002',
                        'applicant': '测试人员',
                        'reason': '已发教材退费测试',
                        'items': [{'type': 'material', 'purchase_no': 'MP002', 'refund_quantity': 1}]
                    }
                    result = RefundService.create_application(data)
                    print('\n' + format_result_for_cli(result))

                elif sub_choice == 'E':
                    print('\n📌 测试场景: 已回收优惠券再次回收（业务规则拦截）')
                    data1 = {
                        'student_no': 'S002',
                        'applicant': '测试人员',
                        'reason': '优惠券回收测试',
                        'items': [{'type': 'coupon', 'usage_no': 'CU002'}]
                    }
                    result1 = RefundService.create_application(data1)
                    if result1['success']:
                        app_no = result1['data']['application_no']
                        print(f'✅ 第一次回收申请创建成功: {app_no}')
                        RefundService.approve_application(app_no, '审批人', 'approve')
                        RefundService.execute_refund(app_no, '财务')
                        RefundService.complete_refund(app_no, '确认人')
                        print('✅ 第一次回收流程完成，优惠券已标记为已回收')
                        print('\n尝试再次回收同一张优惠券...')
                        data2 = {
                            'student_no': 'S002',
                            'applicant': '测试人员',
                            'reason': '重复回收测试',
                            'items': [{'type': 'coupon', 'usage_no': 'CU002'}]
                        }
                        result2 = RefundService.create_application(data2)
                        print('\n' + format_result_for_cli(result2))

                elif sub_choice == 'F':
                    print('\n📌 演示: 完整的正常退费流程')
                    data = {
                        'student_no': 'S003',
                        'applicant': '前台小王',
                        'reason': '学员家庭搬迁',
                        'items': [
                            {'type': 'coupon', 'usage_no': 'CU003'}
                        ]
                    }
                    create_result = RefundService.create_application(data)
                    print('\n--- 步骤1: 提交申请 ---')
                    print(format_result_for_cli(create_result))
                    
                    if create_result['success']:
                        app_no = create_result['data']['application_no']
                        
                        print('\n--- 步骤2: 教务审批 ---')
                        approve_result = RefundService.approve_application(
                            app_no, '教务主任', 'approve', '情况属实，符合退费政策'
                        )
                        print(format_result_for_cli(approve_result))
                        
                        print('\n--- 步骤3: 财务打款 ---')
                        execute_result = RefundService.execute_refund(app_no, '财务小李')
                        print(format_result_for_cli(execute_result))
                        
                        print('\n--- 步骤4: 确认到账 ---')
                        complete_result = RefundService.complete_refund(app_no, '系统确认')
                        print(format_result_for_cli(complete_result))
                        
                        print('\n--- 步骤5: 查看完整详情 ---')
                        detail_result = RefundService.get_application_detail(app_no)
                        if detail_result['success']:
                            d = detail_result['data']
                            print(f'📋 申请状态: {d["status"]}')
                            print(f'📜 状态历史共 {len(d["status_history"])} 条记录')
                            print(f'💳 退款流水共 {len(d["transactions"])} 条记录')
                            print('=' * 60)

            elif choice == '8':
                result = RefundService.list_applications()
                if result['success']:
                    data = result['data']
                    print('\n' + '=' * 60)
                    print(f'📋 退费申请列表 (共 {len(data)} 条)')
                    print('=' * 60)
                    for app in data:
                        print(f'  [{app["application_no"]}] {app["student_name"]}({app["student_no"]})')
                        print(f'      原因: {app["reason"][:30]}...')
                        print(f'      金额: {app["total_refund"]:.2f}元 | 状态: {app["status"]}')
                        print(f'      时间: {app["application_time"]}')
                        print()
                    print('=' * 60)
                else:
                    print(format_result_for_cli(result))

            elif choice == '9':
                result = RefundService.export_reconciliation()
                if result['success']:
                    data = result['data']
                    print('\n' + '=' * 60)
                    print('💰 对账汇总（财务口径）')
                    print('=' * 60)
                    print(f'记录总数: {data["record_count"]} 条')
                    print('-' * 60)
                    print('汇总数据:')
                    print(f'  课程退费合计: {data["summary"]["课程退费合计"]:.2f} 元')
                    print(f'  教材退费合计: {data["summary"]["教材退费合计"]:.2f} 元')
                    print(f'  优惠券回收合计: {data["summary"]["优惠券回收合计"]:.2f} 元')
                    print(f'  实际退款合计: {data["summary"]["实际退款合计"]:.2f} 元')
                    print('-' * 60)
                    print('明细记录:')
                    for record in data['records']:
                        net = record['实际退款金额']
                        print(f'  [{record["申请编号"]}] {record["学员姓名"]}({record["学员学号"]})')
                        print(f'      状态: {record["申请状态"]} | 时间: {record["申请时间"]}')
                        print(f'      课程:{record["课程退费"]:.2f} | 教材:{record["教材退费"]:.2f} | 券:{record["优惠券回收"]:.2f} | 实退:{net:.2f}')
                    print('=' * 60)
                else:
                    print(format_result_for_cli(result))

            else:
                print('⚠️ 无效选项，请重新选择')


if __name__ == '__main__':
    import sys
    with app.app_context():
        db.create_all()
        init_sample_data()

    if '--cli' in sys.argv or len(sys.argv) > 1 and sys.argv[1] == 'cli':
        interactive_cli()
    else:
        print('🚀 课程退费分摊API服务启动中...')
        print('📖 API文档:')
        print('  GET  /api/health                 - 健康检查')
        print('  GET  /api/students/<no>          - 查看学员信息')
        print('  POST /api/refund/applications    - 提交退费申请')
        print('  GET  /api/refund/applications    - 查看申请列表')
        print('  GET  /api/refund/applications/<no> - 查看申请详情')
        print('  POST /api/refund/applications/<no>/approve  - 审批通过')
        print('  POST /api/refund/applications/<no>/reject   - 审批拒绝')
        print('  POST /api/refund/applications/<no>/execute  - 财务打款')
        print('  POST /api/refund/applications/<no>/complete - 确认完成')
        print('  GET  /api/reconciliation/export  - 对账导出')
        print()
        print('💡 提示: 运行 python app.py cli 可进入交互式命令行模式')
        app.run(host='0.0.0.0', port=5000, debug=False)
