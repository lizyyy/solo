import sys
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from database import SessionLocal, engine, Base
from models import Show, Seat, GroupOrder, ReserveWindow, SeatChangeRequest, ExceptionLog
from models import SeatStatus, OrderStatus, ChangeStatus, ReserveWindowStatus
from services import SeatService, ReserveWindowService

def generate_sample_data():
    print("开始生成样例数据...")
    db = SessionLocal()

    try:
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)

        show_time = datetime.now() + timedelta(days=7)
        show = Show(
            name="《剧院魅影》中文版 - 首演场",
            venue="上海大剧院 - 大剧场",
            show_time=show_time,
            total_seats=50,
            available_seats=50
        )
        db.add(show)
        db.flush()
        print(f"已创建演出场次: {show.name}")

        seat_prices = {
            "A": 1280,
            "B": 880,
            "C": 580,
            "D": 380
        }

        seats_created = 0
        for section in ["A", "B", "C", "D"]:
            for row in range(1, 6):
                for num in range(1, 6):
                    seat = Seat(
                        show_id=show.id,
                        row=f"{row}",
                        number=f"{num}",
                        section=section,
                        price=seat_prices[section],
                        status=SeatStatus.AVAILABLE
                    )
                    db.add(seat)
                    seats_created += 1
        print(f"已创建 {seats_created} 个座位")

        order1 = GroupOrder(
            show_id=show.id,
            contact_name="张三",
            contact_phone="13800138001",
            group_name="XX公司团建",
            requested_seats_count=10,
            actual_seats_count=10,
            status=OrderStatus.PENDING,
            total_amount=8800
        )
        db.add(order1)
        db.flush()

        order1_seats = list(range(1, 11))
        SeatService.lock_seats(db, order1_seats, order1.id)
        window1 = ReserveWindowService.create_window(db, order1.id, show.id, order1_seats, minutes=30)
        print(f"已创建团体订单1: {order1.group_name}, 锁座10个")

        order2 = GroupOrder(
            show_id=show.id,
            contact_name="李四",
            contact_phone="13800138002",
            group_name="XX学校师生",
            requested_seats_count=5,
            actual_seats_count=5,
            status=OrderStatus.CONFIRMED,
            total_amount=2900
        )
        db.add(order2)
        db.flush()

        order2_seats = list(range(11, 16))
        SeatService.lock_seats(db, order2_seats, order2.id)
        window2 = ReserveWindowService.create_window(db, order2.id, show.id, order2_seats, minutes=60)
        print(f"已创建团体订单2: {order2.group_name}, 锁座5个")

        change_request = SeatChangeRequest(
            order_id=order1.id,
            show_id=show.id,
            original_seat_ids=order1_seats,
            requested_seat_ids=list(range(16, 26)),
            new_seat_count=10,
            reason="希望换到更好的区域观看",
            status=ChangeStatus.PENDING_REVIEW
        )
        db.add(change_request)
        print(f"已创建换座申请: 订单{order1.id}申请换座")

        expired_window = ReserveWindow(
            order_id=order1.id,
            show_id=show.id,
            seat_ids=[26, 27, 28],
            expire_at=datetime.now() - timedelta(hours=1),
            status=ReserveWindowStatus.EXPIRED,
            released_at=datetime.now(),
            released_reason="超时自动释放"
        )
        db.add(expired_window)
        print(f"已创建超时保留窗口示例")

        exception_log = ExceptionLog(
            exception_type="duplicate_lock",
            endpoint="/api/v1/orders",
            original_input={
                "show_id": show.id,
                "contact_name": "王五",
                "contact_phone": "13800138001",
                "seat_ids": [1, 2, 3]
            },
            error_message="该手机号已有活跃锁座: 订单1",
            resolved=False
        )
        db.add(exception_log)
        print(f"已创建异常日志示例")

        show.available_seats = seats_created - len(order1_seats) - len(order2_seats)

        db.commit()
        print("\n样例数据生成完成!")
        print(f"  - 演出场次: 1场")
        print(f"  - 座位总数: {seats_created}个")
        print(f"  - 可用座位: {show.available_seats}个")
        print(f"  - 团体订单: 2个")
        print(f"  - 保留窗口: 3个(1个已超时)")
        print(f"  - 换座申请: 1个(待审核)")
        print(f"  - 异常日志: 1条")
        print("\n数据库文件: theater_seats.db")

    except Exception as e:
        db.rollback()
        print(f"生成数据时出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    generate_sample_data()