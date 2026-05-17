#!/usr/bin/env python3
from database import SessionLocal
import models
import crud
import schemas
from datetime import datetime, timedelta

def main():
    db = SessionLocal()
    
    print('=' * 50)
    print('=== 测试异常路径日志记录与冻结课时限制 ===')
    print('=' * 50)
    print()
    
    # 清理数据
    print('清理数据库...')
    db.query(models.OperationLog).delete()
    db.commit()
    
    # 测试1: 重复消课
    print('【测试1: 重复消课与异常日志】')
    bookings = db.query(models.Booking).filter(models.Booking.status == 'confirmed').all()
    print(f'找到 {len(bookings)} 个已确认的预约')
    
    if bookings:
        booking = bookings[0]
        print(f'  预约 ID: {booking.id}, 会员: {booking.member_card.member_name}')
        
        # 第一次消课 - 应该成功
        print('  第一次消课...')
        try:
            crud.consume_booking(db, booking.id, 'admin', '正常消课')
            print('  ✓ 第一次消课成功')
        except Exception as e:
            print(f'  ✗ 第一次消课失败: {e}')
        
        # 第二次消课 - 应该失败并记录异常日志
        print('  第二次消课（重复消课）...')
        try:
            crud.consume_booking(db, booking.id, 'admin', '重复消课')
            print('  ✗ 第二次消课成功（不应该发生）')
        except ValueError as e:
            print(f'  ✓ 第二次消课失败（预期行为）: {e}')
        
        # 检查操作日志
        logs = db.query(models.OperationLog).filter(
            models.OperationLog.operation_type == 'consume_booking'
        ).order_by(models.OperationLog.id).all()
        print(f'  消课操作日志数量: {len(logs)}')
        for log in logs:
            status = '✓ SUCCESS' if log.success else '✗ FAILED'
            print(f'    {status} - {log.conclusion} - 处理人: {log.handler}')
    
    print()
    
    # 测试2: 课时冻结后限制
    print('【测试2: 课时冻结后预约限制】')
    leave_bookings = db.query(models.Booking).filter(
        models.Booking.status == 'confirmed',
        models.Booking.id != booking.id
    ).all()
    
    if leave_bookings:
        leave_booking = leave_bookings[0]
        course_package = leave_booking.course_package
        member_card = leave_booking.member_card
        
        print(f'  选择预约 ID={leave_booking.id} 申请请假')
        print(f'  冻结前 - 剩余课时={course_package.remaining_hours}, '
              f'冻结课时={course_package.frozen_hours}, '
              f'可用课时={course_package.remaining_hours - course_package.frozen_hours}')
        
        # 申请请假
        leave = schemas.LeaveApplicationCreate(
            booking_id=leave_booking.id,
            reason='测试请假冻结',
            freeze_hours=True
        )
        db_leave = crud.apply_leave(db, leave, 'member')
        print(f'  ✓ 请假申请 ID={db_leave.id} 创建成功')
        
        # 批准请假
        crud.approve_leave(db, db_leave.id, 'admin')
        print(f'  ✓ 请假已批准')
        
        # 检查冻结课时
        db.refresh(course_package)
        print(f'  冻结后 - 剩余课时={course_package.remaining_hours}, '
              f'冻结课时={course_package.frozen_hours}, '
              f'可用课时={course_package.remaining_hours - course_package.frozen_hours}')
        
        # 尝试创建预约（可用课时应该为0或不足）
        print('  尝试在可用课时不足时创建预约...')
        try:
            new_booking = schemas.BookingCreate(
                member_card_id=member_card.id,
                course_package_id=course_package.id,
                main_coach_id=leave_booking.main_coach_id,
                booking_date=datetime.now() + timedelta(days=10),
                start_time="10:00",
                end_time="11:00",
                hours=1,
                created_by="test"
            )
            crud.create_booking(db, new_booking)
            print('  ✗ 预约创建成功（不应该发生）')
        except ValueError as e:
            print(f'  ✓ 预约创建失败（预期行为）: {e}')
    
    print()
    
    # 测试3: 代课教练显示
    print('【测试3: 代课消课报表显示代课教练】')
    substitute_bookings = db.query(models.Booking).filter(
        models.Booking.status == 'confirmed'
    ).all()
    
    if substitute_bookings:
        sub_booking = substitute_bookings[-1]
        print(f'  选择预约 ID={sub_booking.id} 申请代课')
        print(f'  原教练: {sub_booking.main_coach.name}')
        
        coaches = db.query(models.Coach).filter(
            models.Coach.id != sub_booking.main_coach_id
        ).all()
        if coaches:
            substitute_coach = coaches[0]
            print(f'  代课教练: {substitute_coach.name}')
            
            # 申请代课
            substitute = schemas.SubstituteRecordCreate(
                booking_id=sub_booking.id,
                substitute_coach_id=substitute_coach.id,
                reason='原教练临时有事'
            )
            db_sub = crud.request_substitute(db, substitute, 'admin')
            print(f'  ✓ 代课申请 ID={db_sub.id} 创建成功')
            
            # 确认代课
            crud.confirm_substitute(db, db_sub.id, 'admin')
            print(f'  ✓ 代课已确认')
            
            # 消课
            crud.consume_booking(db, sub_booking.id, 'admin', '代课消课')
            print(f'  ✓ 已消课')
            
            # 生成报表检查教练
            report = crud.generate_report(db, schemas.ReportQuery())
            print(f'  报表记录数: {report["total_records"]}')
            for item in report["data"]:
                if item["has_substitute"]:
                    print(f'    ✓ 代课记录 - 显示教练: {item["coach_name"]}, '
                          f'原教练: {item["original_coach_name"]}')
                else:
                    print(f'    ✓ 正常记录 - 教练: {item["coach_name"]}')
    
    print()
    print('=' * 50)
    print('所有测试场景执行完成！')
    print('=' * 50)
    
    db.close()

if __name__ == '__main__':
    main()
