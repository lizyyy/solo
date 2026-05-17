#!/usr/bin/env python3
"""
测试数据脚本 - 初始化教室、课程、学员等基础数据
"""
from datetime import datetime, timedelta
from database import SessionLocal
from models import Room, RoomDevice, Course, DeviceRequirement, Student, DeviceType


def seed_all():
    db = SessionLocal()
    try:
        print("开始创建测试数据...")
        
        rooms = [
            {
                "name": "A101 多媒体教室",
                "location": "A栋1楼",
                "capacity": 50,
                "devices": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.WHITEBOARD, 2),
                    (DeviceType.MICROPHONE, 2),
                    (DeviceType.SPEAKER, 2),
                    (DeviceType.AIRCON, 2),
                ]
            },
            {
                "name": "A201 计算机教室",
                "location": "A栋2楼",
                "capacity": 40,
                "devices": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.COMPUTER, 40),
                    (DeviceType.WHITEBOARD, 1),
                    (DeviceType.AIRCON, 2),
                ]
            },
            {
                "name": "B101 小型会议室",
                "location": "B栋1楼",
                "capacity": 20,
                "devices": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.WHITEBOARD, 1),
                    (DeviceType.AIRCON, 1),
                ]
            },
            {
                "name": "B201 大型报告厅",
                "location": "B栋2楼",
                "capacity": 100,
                "devices": [
                    (DeviceType.PROJECTOR, 2),
                    (DeviceType.WHITEBOARD, 4),
                    (DeviceType.MICROPHONE, 4),
                    (DeviceType.SPEAKER, 8),
                    (DeviceType.AIRCON, 4),
                ]
            },
        ]
        
        for room_data in rooms:
            devices = room_data.pop("devices")
            room = Room(**room_data)
            db.add(room)
            db.commit()
            db.refresh(room)
            
            for dev_type, quantity in devices:
                device = RoomDevice(
                    room_id=room.id,
                    device_type=dev_type,
                    quantity=quantity,
                    is_working=True
                )
                db.add(device)
            db.commit()
            print(f"创建教室: {room.name}, ID: {room.id}")
        
        courses = [
            {
                "name": "Python高级编程",
                "code": "PY2024001",
                "instructor": "张老师",
                "student_count": 35,
                "duration_minutes": 180,
                "device_requirements": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.WHITEBOARD, 1),
                    (DeviceType.COMPUTER, 35),
                ],
                "students": [f"学员{i:02d}" for i in range(1, 36)]
            },
            {
                "name": "数据分析实战",
                "code": "DA2024001",
                "instructor": "李老师",
                "student_count": 25,
                "duration_minutes": 120,
                "device_requirements": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.WHITEBOARD, 1),
                    (DeviceType.COMPUTER, 25),
                ],
                "students": [f"学员{i:02d}" for i in range(36, 61)]
            },
            {
                "name": "团队管理培训",
                "code": "TM2024001",
                "instructor": "王老师",
                "student_count": 15,
                "duration_minutes": 240,
                "device_requirements": [
                    (DeviceType.PROJECTOR, 1),
                    (DeviceType.WHITEBOARD, 1),
                ],
                "students": [f"学员{i:02d}" for i in range(61, 76)]
            },
        ]
        
        all_rooms = db.query(Room).all()
        for idx, course_data in enumerate(courses):
            requirements = course_data.pop("device_requirements")
            students = course_data.pop("students")
            
            scheduled_time = datetime.now().replace(hour=9, minute=0, second=0, microsecond=0) + timedelta(days=idx + 1)
            
            course = Course(
                **course_data,
                original_room_id=all_rooms[idx % len(all_rooms)].id,
                scheduled_time=scheduled_time
            )
            db.add(course)
            db.commit()
            db.refresh(course)
            
            for dev_type, min_quantity in requirements:
                req = DeviceRequirement(
                    course_id=course.id,
                    device_type=dev_type,
                    min_quantity=min_quantity,
                    required=True
                )
                db.add(req)
            
            for i, student_name in enumerate(students):
                student = Student(
                    course_id=course.id,
                    name=student_name,
                    phone=f"138{idx:02d}{i:06d}",
                    email=f"{student_name}@example.com"
                )
                db.add(student)
            
            db.commit()
            print(f"创建课程: {course.name}, ID: {course.id}, 学员数: {len(students)}")
        
        print("\n测试数据创建完成！")
        print(f"教室数量: {db.query(Room).count()}")
        print(f"课程数量: {db.query(Course).count()}")
        print(f"学员数量: {db.query(Student).count()}")
        
    except Exception as e:
        print(f"创建测试数据失败: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_all()
