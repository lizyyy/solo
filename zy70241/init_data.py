#!/usr/bin/env python3
"""
初始化净水站滤芯寿命预测器的样例数据
"""

import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal
from app.models import Filter, WaterQualityRecord, WaterVolumeRecord, Complaint, FilterPrediction, ReplacementReport
from app.predictor import FilterLifePredictor

def init_sample_data():
    """
    导入样例数据并运行预测
    """
    db = SessionLocal()
    
    try:
        print("=" * 60)
        print("净水站滤芯寿命预测器 - 数据初始化")
        print("=" * 60)
        
        print("\n[1/5] 导入滤芯数据...")
        filters_df = pd.read_csv('sample_data/filters.csv')
        filters_imported = 0
        
        for _, row in filters_df.iterrows():
            existing = db.query(Filter).filter(Filter.filter_id == row['filter_id']).first()
            if existing:
                print(f"  跳过: {row['filter_id']} (已存在)")
                continue
            
            db_filter = Filter(
                filter_id=row['filter_id'],
                station_name=row['station_name'],
                filter_type=row['filter_type'],
                install_date=pd.to_datetime(row['install_date']).to_pydatetime(),
                max_lifespan_days=int(row['max_lifespan_days']),
                max_lifespan_liters=float(row['max_lifespan_liters']),
                status=row.get('status', 'active')
            )
            db.add(db_filter)
            filters_imported += 1
            print(f"  导入: {row['filter_id']} - {row['station_name']}")
        
        db.commit()
        print(f"✓ 滤芯数据导入完成: {filters_imported} 条")
        
        print("\n[2/5] 导入水质数据...")
        quality_df = pd.read_csv('sample_data/water_quality.csv')
        quality_imported = 0
        
        for _, row in quality_df.iterrows():
            db_record = WaterQualityRecord(
                filter_id=row['filter_id'],
                record_date=pd.to_datetime(row['record_date']).to_pydatetime(),
                turbidity=float(row['turbidity']) if pd.notna(row.get('turbidity')) else None,
                ph=float(row['ph']) if pd.notna(row.get('ph')) else None,
                residual_chlorine=float(row['residual_chlorine']) if pd.notna(row.get('residual_chlorine')) else None,
                conductivity=float(row['conductivity']) if pd.notna(row.get('conductivity')) else None,
                total_dissolved_solids=float(row['total_dissolved_solids']) if pd.notna(row.get('total_dissolved_solids')) else None,
                color=float(row['color']) if pd.notna(row.get('color')) else None,
                odor=str(row['odor']) if pd.notna(row.get('odor')) else None,
                is_valid=True
            )
            db.add(db_record)
            quality_imported += 1
        
        db.commit()
        print(f"✓ 水质数据导入完成: {quality_imported} 条")
        
        print("\n[3/5] 导入水量数据...")
        volume_df = pd.read_csv('sample_data/water_volume.csv')
        volume_imported = 0
        
        for _, row in volume_df.iterrows():
            db_record = WaterVolumeRecord(
                filter_id=row['filter_id'],
                record_date=pd.to_datetime(row['record_date']).to_pydatetime(),
                daily_volume_liters=float(row['daily_volume_liters']),
                cumulative_volume_liters=float(row['cumulative_volume_liters']),
                peak_hour=str(row['peak_hour']) if pd.notna(row.get('peak_hour')) else None,
                avg_flow_rate=float(row['avg_flow_rate']) if pd.notna(row.get('avg_flow_rate')) else None,
                is_valid=True
            )
            db.add(db_record)
            volume_imported += 1
        
        db.commit()
        print(f"✓ 水量数据导入完成: {volume_imported} 条")
        
        print("\n[4/5] 导入投诉数据...")
        complaints_df = pd.read_csv('sample_data/complaints.csv')
        complaints_imported = 0
        
        for _, row in complaints_df.iterrows():
            db_complaint = Complaint(
                filter_id=row['filter_id'],
                complaint_date=pd.to_datetime(row['complaint_date']).to_pydatetime(),
                complaint_type=str(row['complaint_type']),
                description=str(row['description']),
                severity=str(row['severity']).lower(),
                reporter=str(row['reporter']) if pd.notna(row.get('reporter')) else None,
                status=str(row.get('status', 'open'))
            )
            db.add(db_complaint)
            complaints_imported += 1
        
        db.commit()
        print(f"✓ 投诉数据导入完成: {complaints_imported} 条")
        
        print("\n[5/5] 运行寿命预测...")
        predictor = FilterLifePredictor(db)
        filters = db.query(Filter).filter(Filter.status == 'active').all()
        
        predictions_created = 0
        risk_summary = {'critical': 0, 'high': 0, 'medium': 0, 'low': 0, 'normal': 0}
        
        for filter_obj in filters:
            result = predictor.predict(filter_obj.filter_id)
            
            if 'error' not in result:
                db_prediction = FilterPrediction(
                    filter_id=filter_obj.filter_id,
                    prediction_date=result['prediction_date'],
                    predicted_remaining_days=result['predicted_remaining_days'],
                    predicted_remaining_liters=result['predicted_remaining_liters'],
                    health_score=result['health_score'],
                    risk_level=result['risk_level'],
                    recommendation=result['recommendation'],
                    explanation=result['explanation'],
                    confidence=result['confidence']
                )
                db.add(db_prediction)
                predictions_created += 1
                
                if result['risk_level'] in risk_summary:
                    risk_summary[result['risk_level']] += 1
                
                print(f"  {filter_obj.filter_id}: 健康分 {result['health_score']:.1f}, "
                      f"风险等级 {result['risk_level']}, "
                      f"剩余 {result['predicted_remaining_days']} 天")
        
        db.commit()
        print(f"✓ 预测完成: {predictions_created} 条")
        print(f"  风险分布: 严重={risk_summary['critical']}, 高={risk_summary['high']}, "
              f"中={risk_summary['medium']}, 低={risk_summary['low']}, 正常={risk_summary['normal']}")
        
        print("\n" + "=" * 60)
        print("数据初始化完成！")
        print("=" * 60)
        
        print("\n关键判断验证:")
        print("-" * 40)
        
        critical_filters = db.query(FilterPrediction).filter(
            FilterPrediction.risk_level.in_(['critical', 'high'])
        ).order_by(FilterPrediction.prediction_date.desc()).all()
        
        if critical_filters:
            print(f"\n⚠️ 发现 {len(critical_filters)} 个高风险滤芯需要关注:")
            for pred in critical_filters:
                filter_obj = db.query(Filter).filter(Filter.filter_id == pred.filter_id).first()
                complaints = db.query(Complaint).filter(
                    Complaint.filter_id == pred.filter_id,
                    Complaint.status == 'open'
                ).all()
                
                print(f"\n  滤芯ID: {pred.filter_id}")
                print(f"  净水站: {filter_obj.station_name}")
                print(f"  风险等级: {pred.risk_level.upper()}")
                print(f"  健康评分: {pred.health_score:.1f}/100")
                print(f"  剩余寿命: {pred.predicted_remaining_days} 天")
                print(f"  建议: {pred.recommendation}")
                
                if complaints:
                    print(f"  ⚠️ 关联投诉: {len(complaints)} 条未解决")
                    for c in complaints:
                        print(f"     - {c.complaint_type}: {c.description[:50]}...")
        
        print("\n" + "=" * 60)
        print("启动命令: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")
        print("访问地址: http://localhost:8000")
        print("API文档: http://localhost:8000/docs")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 错误: {str(e)}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_sample_data()
