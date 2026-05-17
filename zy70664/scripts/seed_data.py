#!/usr/bin/env python3
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.models import Department, Employee, MealType, OrderRecord, CancellationRecord
from datetime import date, timedelta
import random


def seed_departments(db: Session):
    print("创建部门数据...")
    depts = [
        {"name": "技术部", "code": "TECH", "contact": "张三", "phone": "13800138001"},
        {"name": "产品部", "code": "PROD", "contact": "李四", "phone": "13800138002"},
        {"name": "运营部", "code": "OPS", "contact": "王五", "phone": "13800138003"},
        {"name": "市场部", "code": "MKT", "contact": "赵六", "phone": "13800138004"},
        {"name": "人力资源部", "code": "HR", "contact": "钱七", "phone": "13800138005"},
    ]

    for d in depts:
        existing = db.query(Department).filter(Department.code == d["code"]).first()
        if not existing:
            dept = Department(**d)
            db.add(dept)
    db.commit()
    print("部门数据创建完成")


def seed_meal_types(db: Session):
    print("创建餐别数据...")
    meals = [
        {"name": "早餐", "code": "BREAKFAST", "start_time": "07:00", "end_time": "09:00", "sort_order": 1},
        {"name": "午餐", "code": "LUNCH", "start_time": "11:30", "end_time": "13:30", "sort_order": 2},
        {"name": "晚餐", "code": "DINNER", "start_time": "17:30", "end_time": "19:30", "sort_order": 3},
    ]

    for m in meals:
        existing = db.query(MealType).filter(MealType.code == m["code"]).first()
        if not existing:
            mt = MealType(**m)
            db.add(mt)
    db.commit()
    print("餐别数据创建完成")


def seed_employees(db: Session):
    print("创建员工数据...")
    depts = db.query(Department).all()
    names = ["王伟", "李娜", "张磊", "刘洋", "陈静", "杨帆", "赵磊", "周杰", "吴强", "郑敏",
             "孙涛", "马云飞", "朱婷", "胡军", "郭靖", "林峰", "何冰", "高圆圆", "罗晋", "唐嫣"]

    depts = db.query(Department).all()
    restrictions = ["", "不吃辣", "素食", "不吃猪肉", "清真", "不吃海鲜", "对花生过敏"]

    emp_no = 1001
    for dept in depts:
        for i in range(random.randint(3, 8)):
            name = random.choice(names)
            existing = db.query(Employee).filter(Employee.employee_no == f"EMP{emp_no}").first()
            if not existing:
                emp = Employee(
                    department_id=dept.id,
                    name=f"{name}{emp_no}",
                    employee_no=f"EMP{emp_no}",
                    default_diet_restriction=random.choice(restrictions)
                )
                db.add(emp)
            emp_no += 1
    db.commit()
    print("员工数据创建完成")


def seed_orders(db: Session):
    print("创建订餐记录...")
    employees = db.query(Employee).all()
    meal_types = db.query(MealType).all()
    today = date.today()
    tomorrow = today + timedelta(days=1)

    restrictions = ["", "不吃辣", "素食", "不吃猪肉", "清真", "不吃海鲜"]
    remarks = ["", "打包", "多放米饭", "少放盐", "需要餐具"]

    order_count = 0
    for meal_date in [today, tomorrow]:
        for mt in meal_types:
            for emp in random.sample(employees, min(len(employees), random.randint(15, 30))):
                order = OrderRecord(
                    department_id=emp.department_id,
                    employee_id=emp.id,
                    meal_date=meal_date,
                    meal_type_id=mt.id,
                    quantity=1,
                    diet_restriction=random.choice(restrictions),
                    remarks=random.choice(remarks),
                    status="pending"
                )
                db.add(order)
                order_count += 1
    db.commit()
    print(f"订餐记录创建完成，共 {order_count} 条")


def seed_cancellations(db: Session):
    print("创建取消记录...")
    orders = db.query(OrderRecord).all()
    cancel_count = 0

    for order in random.sample(orders, min(len(orders), 15)):
        cancel = CancellationRecord(
            order_record_id=order.id,
            cancel_date=order.meal_date,
            cancel_quantity=1,
            reason=random.choice(["临时有事", "外出开会", "请假", "其他"]),
            matched=True,
            status="matched"
        )
        db.add(cancel)
        cancel_count += 1

    for _ in range(5):
        cancel = CancellationRecord(
            cancel_date=date.today(),
            cancel_quantity=1,
            reason="无法匹配的取消记录",
            matched=False,
            status="unmatched"
        )
        db.add(cancel)
        cancel_count += 1

    db.commit()
    print(f"取消记录创建完成，共 {cancel_count} 条")


def main():
    db = SessionLocal()
    try:
        seed_departments(db)
        seed_meal_types(db)
        seed_employees(db)
        seed_orders(db)
        seed_cancellations(db)
        print("\n造数完成！")
    except Exception as e:
        print(f"造数失败: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    os.makedirs("scripts", exist_ok=True)
    main()
