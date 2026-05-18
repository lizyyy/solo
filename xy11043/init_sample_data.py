import os
from datetime import date, datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

from models import Base, CuttingQueue

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cutting_queue.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def init_sample_data():
    db = SessionLocal()
    
    try:
        sample_data = [
            {
                "order_no": "CQ20240518001",
                "customer_name": "张先生",
                "store_name": "北京朝阳店",
                "salesperson": "李明",
                "order_date": date(2024, 5, 18),
                "delivery_date": date(2024, 5, 28),
                "board_type": "颗粒板",
                "board_color": "暖白色",
                "board_thickness": 18.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 50,
                "cut_pieces": 0,
                "remaining_pieces": 50,
                "material_code": "KLB-NW-18",
                "material_batch": "B20240515",
                "material_location": "A区-01-03",
                "edge_banding": "四边PVC封边",
                "drilling": "三合一孔位",
                "special_processing": "无",
                "priority": 7,
                "status": "pending",
                "assigned_to": "王师傅",
                "machine_no": "CNC-001",
                "estimated_cutting_time": 120,
                "remarks": "客户要求加急处理",
                "is_urgent": True,
                "has_remaining_material": True,
                "remaining_material_info": "余料尺寸: 1200x600mm, 可用",
                "created_by": "admin"
            },
            {
                "order_no": "CQ20240518002",
                "customer_name": "李女士",
                "store_name": "上海浦东店",
                "salesperson": "王芳",
                "order_date": date(2024, 5, 17),
                "delivery_date": date(2024, 5, 30),
                "board_type": "多层板",
                "board_color": "深胡桃色",
                "board_thickness": 18.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 35,
                "cut_pieces": 10,
                "remaining_pieces": 25,
                "material_code": "DCB-HT-18",
                "material_batch": "B20240510",
                "material_location": "B区-02-05",
                "edge_banding": "四边ABS封边",
                "drilling": "三合一+铰链孔",
                "special_processing": "45度斜切",
                "priority": 5,
                "status": "cutting",
                "assigned_to": "张师傅",
                "machine_no": "CNC-002",
                "estimated_cutting_time": 90,
                "remarks": "",
                "is_urgent": False,
                "has_remaining_material": False,
                "created_by": "admin"
            },
            {
                "order_no": "CQ20240518003",
                "customer_name": "王总",
                "store_name": "广州天河店",
                "salesperson": "陈强",
                "order_date": date(2024, 5, 16),
                "delivery_date": date(2024, 6, 5),
                "board_type": "欧松板",
                "board_color": "原木色",
                "board_thickness": 15.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 80,
                "cut_pieces": 80,
                "remaining_pieces": 0,
                "material_code": "OSB-YM-15",
                "material_batch": "B20240508",
                "material_location": "C区-01-02",
                "edge_banding": "四边封边",
                "drilling": "标准孔位",
                "special_processing": "无",
                "priority": 6,
                "status": "completed",
                "assigned_to": "李师傅",
                "machine_no": "CNC-001",
                "estimated_cutting_time": 180,
                "remarks": "已完成裁切，等待封边",
                "is_urgent": False,
                "has_remaining_material": True,
                "remaining_material_info": "余料3块，尺寸分别为: 800x600, 500x400, 300x200",
                "created_by": "admin"
            },
            {
                "order_no": "CQ20240518004",
                "customer_name": "刘先生",
                "store_name": "深圳南山店",
                "salesperson": "赵丽",
                "order_date": date(2024, 5, 18),
                "delivery_date": date(2024, 6, 8),
                "board_type": "颗粒板",
                "board_color": "灰色",
                "board_thickness": 25.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 20,
                "cut_pieces": 0,
                "remaining_pieces": 20,
                "material_code": "KLB-GY-25",
                "material_batch": "B20240512",
                "material_location": "A区-03-01",
                "edge_banding": "厚边封边",
                "drilling": "层板孔",
                "special_processing": "无",
                "priority": 4,
                "status": "queued",
                "assigned_to": "王师傅",
                "machine_no": "CNC-003",
                "estimated_cutting_time": 60,
                "remarks": "用于制作台面",
                "is_urgent": False,
                "has_remaining_material": False,
                "created_by": "admin"
            },
            {
                "order_no": "CQ20240518005",
                "customer_name": "陈女士",
                "store_name": "成都武侯店",
                "salesperson": "刘伟",
                "order_date": date(2024, 5, 15),
                "delivery_date": date(2024, 5, 25),
                "board_type": "多层板",
                "board_color": "白色",
                "board_thickness": 9.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 100,
                "cut_pieces": 45,
                "remaining_pieces": 55,
                "material_code": "DCB-WH-09",
                "material_batch": "B20240505",
                "material_location": "D区-02-04",
                "edge_banding": "两边封边",
                "drilling": "无",
                "special_processing": "背板开槽",
                "priority": 8,
                "status": "paused",
                "assigned_to": "赵师傅",
                "machine_no": "CNC-002",
                "estimated_cutting_time": 150,
                "remarks": "暂停原因：等待物料补充",
                "is_urgent": True,
                "has_remaining_material": False,
                "created_by": "admin"
            },
            {
                "order_no": "CQ20240518006",
                "customer_name": "周先生",
                "store_name": "杭州西湖店",
                "salesperson": "孙明",
                "order_date": date(2024, 5, 14),
                "delivery_date": date(2024, 6, 10),
                "board_type": "颗粒板",
                "board_color": "橡木色",
                "board_thickness": 18.0,
                "board_length": 2440,
                "board_width": 1220,
                "required_pieces": 60,
                "cut_pieces": 0,
                "remaining_pieces": 60,
                "material_code": "KLB-XM-18",
                "material_batch": "B20240516",
                "material_location": "A区-01-03",
                "edge_banding": "四边封边",
                "drilling": "标准孔位",
                "special_processing": "无",
                "priority": 3,
                "status": "pending",
                "assigned_to": None,
                "machine_no": None,
                "estimated_cutting_time": 100,
                "remarks": "",
                "is_urgent": False,
                "has_remaining_material": True,
                "remaining_material_info": "与订单CQ20240518001共享余料",
                "created_by": "admin"
            }
        ]
        
        inserted_count = 0
        for data in sample_data:
            existing = db.query(CuttingQueue).filter(CuttingQueue.order_no == data["order_no"]).first()
            if not existing:
                queue = CuttingQueue(**data)
                db.add(queue)
                inserted_count += 1
        
        db.commit()
        print(f"成功插入 {inserted_count} 条样例数据")
        print("样例数据订单编号:")
        for data in sample_data:
            print(f"  - {data['order_no']} ({data['customer_name']} - {data['store_name']})")
        
    except Exception as e:
        print(f"初始化样例数据失败: {str(e)}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_sample_data()
