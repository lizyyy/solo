#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from farm_verification.database import SessionLocal, init_db
from farm_verification.models.batch import ImageBatch, BatchStatus
from farm_verification.models.grid import FarmGrid, GridStatus
from farm_verification.models.lesion import LesionRecord, LesionStatus, LesionSource
from farm_verification.models.verification import VerificationRecord, VerificationResult


def init_sample_data():
    print("=" * 60)
    print("正在初始化示例数据...")
    print("=" * 60)
    
    init_db()
    db = SessionLocal()
    
    try:
        print("\n1. 创建示例地块数据...")
        sample_grids = [
            {
                "grid_code": "DK-001",
                "grid_name": "东河村1号地块",
                "center_longitude": 116.4074,
                "center_latitude": 39.9042,
                "area_mu": 150.0,
                "area_km2": 0.1,
                "crop_type": "小麦",
                "region": "华北平原",
                "village": "东河村",
                "farmer_name": "张三",
                "farmer_phone": "13800138001",
                "boundary_coordinates": [
                    {"longitude": 116.4064, "latitude": 39.9032},
                    {"longitude": 116.4084, "latitude": 39.9032},
                    {"longitude": 116.4084, "latitude": 39.9052},
                    {"longitude": 116.4064, "latitude": 39.9052},
                    {"longitude": 116.4064, "latitude": 39.9032}
                ]
            },
            {
                "grid_code": "DK-002",
                "grid_name": "东河村2号地块",
                "center_longitude": 116.4104,
                "center_latitude": 39.9042,
                "area_mu": 200.0,
                "area_km2": 0.133,
                "crop_type": "玉米",
                "region": "华北平原",
                "village": "东河村",
                "farmer_name": "李四",
                "farmer_phone": "13800138002",
                "boundary_coordinates": [
                    {"longitude": 116.4094, "latitude": 39.9032},
                    {"longitude": 116.4114, "latitude": 39.9032},
                    {"longitude": 116.4114, "latitude": 39.9052},
                    {"longitude": 116.4094, "latitude": 39.9052},
                    {"longitude": 116.4094, "latitude": 39.9032}
                ]
            },
            {
                "grid_code": "DK-003",
                "grid_name": "西河村1号地块",
                "center_longitude": 116.4074,
                "center_latitude": 39.9082,
                "area_mu": 180.0,
                "area_km2": 0.12,
                "crop_type": "大豆",
                "region": "华北平原",
                "village": "西河村",
                "farmer_name": "王五",
                "farmer_phone": "13800138003",
                "boundary_coordinates": [
                    {"longitude": 116.4064, "latitude": 39.9072},
                    {"longitude": 116.4084, "latitude": 39.9072},
                    {"longitude": 116.4084, "latitude": 39.9092},
                    {"longitude": 116.4064, "latitude": 39.9092},
                    {"longitude": 116.4064, "latitude": 39.9072}
                ]
            }
        ]
        
        created_grids = 0
        for grid_data in sample_grids:
            existing = db.query(FarmGrid).filter(
                FarmGrid.grid_code == grid_data["grid_code"]
            ).first()
            if not existing:
                grid = FarmGrid(
                    **grid_data,
                    status=GridStatus.ACTIVE,
                    created_by="system"
                )
                db.add(grid)
                created_grids += 1
        db.commit()
        print(f"   已创建 {created_grids} 个地块")
        
        print("\n2. 创建示例批次数据...")
        sample_batches = [
            {
                "batch_code": "PC-20240510-001",
                "batch_name": "2024年5月东河村第一次巡查",
                "flight_date": datetime.now() - timedelta(days=3),
                "flight_area": "东河村区域",
                "drone_id": "DRONE-001",
                "image_count": 150,
                "total_area_km2": 2.5,
                "status": BatchStatus.COMPLETED
            },
            {
                "batch_code": "PC-20240510-002",
                "batch_name": "2024年5月西河村第一次巡查",
                "flight_date": datetime.now() - timedelta(days=2),
                "flight_area": "西河村区域",
                "drone_id": "DRONE-002",
                "image_count": 120,
                "total_area_km2": 2.0,
                "status": BatchStatus.PROCESSING
            }
        ]
        
        created_batches = 0
        for batch_data in sample_batches:
            existing = db.query(ImageBatch).filter(
                ImageBatch.batch_code == batch_data["batch_code"]
            ).first()
            if not existing:
                batch = ImageBatch(
                    **batch_data,
                    created_by="system"
                )
                db.add(batch)
                created_batches += 1
        db.commit()
        print(f"   已创建 {created_batches} 个批次")
        
        batch1 = db.query(ImageBatch).filter(
            ImageBatch.batch_code == "PC-20240510-001"
        ).first()
        grid1 = db.query(FarmGrid).filter(FarmGrid.grid_code == "DK-001").first()
        grid2 = db.query(FarmGrid).filter(FarmGrid.grid_code == "DK-002").first()
        
        if batch1:
            print("\n3. 创建示例病斑数据...")
            sample_lesions = [
                {
                    "lesion_code": "LB-001",
                    "longitude": 116.4070,
                    "latitude": 39.9040,
                    "pixel_x": 1500,
                    "pixel_y": 2000,
                    "image_name": "DJI_0001.jpg",
                    "lesion_type": "锈病",
                    "confidence_score": 0.85,
                    "estimated_area_m2": 25.5,
                    "severity_level": "中度",
                    "status": LesionStatus.CONFIRMED,
                    "is_false_positive": False,
                    "grid_id": grid1.id if grid1 else None,
                    "grid_code": grid1.grid_code if grid1 else None,
                    "grid_name": grid1.grid_name if grid1 else None
                },
                {
                    "lesion_code": "LB-002",
                    "longitude": 116.4078,
                    "latitude": 39.9045,
                    "pixel_x": 2500,
                    "pixel_y": 1800,
                    "image_name": "DJI_0005.jpg",
                    "lesion_type": "白粉病",
                    "confidence_score": 0.72,
                    "estimated_area_m2": 18.3,
                    "severity_level": "轻度",
                    "status": LesionStatus.FALSE_POSITIVE,
                    "is_false_positive": True,
                    "grid_id": grid1.id if grid1 else None,
                    "grid_code": grid1.grid_code if grid1 else None,
                    "grid_name": grid1.grid_name if grid1 else None
                },
                {
                    "lesion_code": "LB-003",
                    "longitude": 116.4100,
                    "latitude": 39.9040,
                    "pixel_x": 1800,
                    "pixel_y": 2200,
                    "image_name": "DJI_0010.jpg",
                    "lesion_type": "叶斑病",
                    "confidence_score": 0.91,
                    "estimated_area_m2": 35.2,
                    "severity_level": "重度",
                    "status": LesionStatus.PENDING,
                    "is_false_positive": False,
                    "grid_id": grid2.id if grid2 else None,
                    "grid_code": grid2.grid_code if grid2 else None,
                    "grid_name": grid2.grid_name if grid2 else None
                },
                {
                    "lesion_code": "LB-004",
                    "longitude": 116.4108,
                    "latitude": 39.9048,
                    "pixel_x": 3000,
                    "pixel_y": 1500,
                    "image_name": "DJI_0015.jpg",
                    "lesion_type": "锈病",
                    "confidence_score": 0.78,
                    "estimated_area_m2": 22.1,
                    "severity_level": "中度",
                    "status": LesionStatus.PENDING,
                    "is_false_positive": False,
                    "grid_id": grid2.id if grid2 else None,
                    "grid_code": grid2.grid_code if grid2 else None,
                    "grid_name": grid2.grid_name if grid2 else None
                }
            ]
            
            created_lesions = 0
            for lesion_data in sample_lesions:
                existing = db.query(LesionRecord).filter(
                    LesionRecord.lesion_code == lesion_data["lesion_code"]
                ).first()
                if not existing:
                    lesion = LesionRecord(
                        batch_id=batch1.id,
                        source=LesionSource.AI_DETECTION,
                        created_by="system",
                        **lesion_data
                    )
                    db.add(lesion)
                    created_lesions += 1
            db.commit()
            print(f"   已创建 {created_lesions} 条病斑记录")
            
            print("\n4. 创建示例核验数据...")
            lesion1 = db.query(LesionRecord).filter(
                LesionRecord.lesion_code == "LB-001"
            ).first()
            lesion2 = db.query(LesionRecord).filter(
                LesionRecord.lesion_code == "LB-002"
            ).first()
            
            if lesion1:
                existing = db.query(VerificationRecord).filter(
                    VerificationRecord.verification_code == "HY-001"
                ).first()
                if not existing:
                    verification1 = VerificationRecord(
                        verification_code="HY-001",
                        lesion_id=lesion1.id,
                        lesion_code=lesion1.lesion_code,
                        grid_code=lesion1.grid_code,
                        grid_name=lesion1.grid_name,
                        verification_round=1,
                        result=VerificationResult.CONFIRMED,
                        actual_lesion_type="锈病",
                        actual_area_m2=28.0,
                        actual_severity="中度",
                        verification_method="现场核验",
                        verification_location="东河村1号地块",
                        photo_evidence="/photos/verify_HY001.jpg",
                        verified_by="核验员-王工",
                        is_active=True
                    )
                    db.add(verification1)
            
            if lesion2:
                existing = db.query(VerificationRecord).filter(
                    VerificationRecord.verification_code == "HY-002"
                ).first()
                if not existing:
                    verification2 = VerificationRecord(
                        verification_code="HY-002",
                        lesion_id=lesion2.id,
                        lesion_code=lesion2.lesion_code,
                        grid_code=lesion2.grid_code,
                        grid_name=lesion2.grid_name,
                        verification_round=1,
                        result=VerificationResult.FALSE_POSITIVE,
                        false_positive_type="阴影干扰",
                        false_positive_reason="影像阴影被误识别为病斑",
                        verification_method="现场核验",
                        verification_location="东河村1号地块",
                        verified_by="核验员-李工",
                        is_active=True
                    )
                    db.add(verification2)
            
            db.commit()
            print("   已创建示例核验数据")
        
        print("\n" + "=" * 60)
        print("示例数据初始化完成！")
        print("=" * 60)
        print("\n已创建的数据:")
        print(f"  - 地块: {db.query(FarmGrid).count()} 个")
        print(f"  - 批次: {db.query(ImageBatch).count()} 个")
        print(f"  - 病斑记录: {db.query(LesionRecord).count()} 条")
        print(f"  - 核验记录: {db.query(VerificationRecord).count()} 条")
        
        print("\n快速开始:")
        print("  1. 安装依赖: pip install -r requirements.txt")
        print("  2. 启动服务: python main.py")
        print("  3. 访问API文档: http://localhost:8000/docs")
        
    except Exception as e:
        print(f"\n错误: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_sample_data()
