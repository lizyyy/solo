from sqlalchemy.orm import Session
from database import engine, Base
from models import Farmer, Plot, Project, GPSRecord, Confirmation
import random

Base.metadata.create_all(bind=engine)

def seed_data():
    db = Session(bind=engine)
    
    try:
        farmers = [
            {"name": "张三", "phone": "13800138001", "id_card": "110101199001010001", "village": "东村"},
            {"name": "李四", "phone": "13800138002", "id_card": "110101199001010002", "village": "西村"},
            {"name": "王五", "phone": "13800138003", "id_card": "110101199001010003", "village": "南村"},
        ]
        
        farmer_objs = []
        for f in farmers:
            farmer = Farmer(**f)
            db.add(farmer)
            db.flush()
            farmer_objs.append(farmer)
        
        plots = []
        for farmer in farmer_objs:
            for i in range(3):
                plot = Plot(
                    farmer_id=farmer.id,
                    plot_code=f"P{farmer.id}{i:03d}",
                    plot_name=f"{farmer.name}的第{i+1}块地",
                    location=f"{farmer.village}区域{i+1}",
                    standard_area=round(random.uniform(5, 20), 2),
                    land_type="水田" if random.random() > 0.5 else "旱地"
                )
                db.add(plot)
                db.flush()
                plots.append(plot)
        
        projects = [
            {"project_code": "PLOW001", "project_name": "耕地作业", "unit_price": 80.0, "unit": "mu"},
            {"project_code": "SEED001", "project_name": "播种作业", "unit_price": 50.0, "unit": "mu"},
            {"project_code": "HARV001", "project_name": "收割作业", "unit_price": 100.0, "unit": "mu"},
        ]
        
        project_objs = []
        for p in projects:
            project = Project(**p)
            db.add(project)
            db.flush()
            project_objs.append(project)
        
        batch_no = "BATCH20250101"
        for plot in plots:
            for project in project_objs:
                gps_area = plot.standard_area + random.uniform(-0.5, 0.5)
                gps_record = GPSRecord(
                    plot_id=plot.id,
                    project_id=project.id,
                    gps_area=round(gps_area, 2),
                    device_id=f"DEV{random.randint(100, 999)}",
                    operator=f"操作员{random.randint(1, 10)}",
                    batch_no=batch_no
                )
                db.add(gps_record)
        
        for plot in plots:
            for project in project_objs:
                base_area = plot.standard_area
                if random.random() > 0.3:
                    confirmed_area = base_area + random.uniform(-2, 2)
                else:
                    confirmed_area = base_area + random.uniform(-5, 5)
                
                confirmation = Confirmation(
                    plot_id=plot.id,
                    farmer_id=plot.farmer_id,
                    project_id=project.id,
                    confirmed_area=round(confirmed_area, 2),
                    confirmed_by=f"确认员{random.randint(1, 5)}",
                    batch_no=batch_no
                )
                db.add(confirmation)
        
        duplicate_plot = plots[0]
        duplicate_project = project_objs[0]
        for i in range(2):
            gps_record = GPSRecord(
                plot_id=duplicate_plot.id,
                project_id=duplicate_project.id,
                gps_area=round(duplicate_plot.standard_area + random.uniform(-0.1, 0.1), 2),
                device_id=f"DEV{random.randint(100, 999)}",
                operator=f"操作员{random.randint(1, 10)}",
                batch_no=batch_no
            )
            db.add(gps_record)
        
        db.commit()
        print("测试数据创建成功！")
        print(f"创建了 {len(farmer_objs)} 个农户")
        print(f"创建了 {len(plots)} 个地块")
        print(f"创建了 {len(project_objs)} 个作业项目")
        print(f"GPS记录包含重复作业地块用于测试去重功能")
        
    except Exception as e:
        db.rollback()
        print(f"创建测试数据失败: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
