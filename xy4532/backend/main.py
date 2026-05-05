from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pathlib import Path
from datetime import datetime, timedelta
from typing import Optional

from config import settings
from database import init_db, get_db
from models import WindTurbine, Blade, InspectionRecord, BladePhoto, RiskAssessment, SCADAAllarm, WorkOrder
from routers import turbines, inspections, risk_assessments, data_management
from schemas import APIResponse, DashboardStatistics

# 初始化数据库
init_db()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="海上风电运维AI初筛工具 - 用于叶片缺陷检测和风险评估"
)

# 配置CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 开发环境允许所有来源，生产环境应限制
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件目录
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

# 注册路由
app.include_router(turbines.router)
app.include_router(inspections.router)
app.include_router(risk_assessments.router)
app.include_router(data_management.router)


@app.get("/", response_model=APIResponse)
def root():
    """根路径 - 返回系统信息"""
    return APIResponse(
        message="海上风电运维AI初筛工具",
        data={
            "app_name": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "api_docs": "/docs",
            "status": "运行中"
        }
    )


@app.get("/api/health", response_model=APIResponse)
def health_check():
    """健康检查接口"""
    return APIResponse(
        message="服务健康",
        data={
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.get("/api/dashboard", response_model=APIResponse)
def get_dashboard_statistics(db: Session = Depends(get_db)):
    """获取仪表盘统计数据"""
    # 基础统计
    total_turbines = db.query(WindTurbine).count()
    total_blades = db.query(Blade).count()
    total_inspections = db.query(InspectionRecord).count()
    total_photos = db.query(BladePhoto).count()
    
    # 风险等级统计
    risk_summary = db.query(
        RiskAssessment.final_risk_level,
        func.count(RiskAssessment.id).label("count")
    ).group_by(RiskAssessment.final_risk_level).all()
    
    risk_counts = {"严重": 0, "高": 0, "中": 0, "低": 0}
    for row in risk_summary:
        if row.final_risk_level in risk_counts:
            risk_counts[row.final_risk_level] = row.count
    
    # 活跃告警和待处理工单
    active_alarms = db.query(SCADAAllarm).filter(SCADAAllarm.is_active == True).count()
    pending_work_orders = db.query(WorkOrder).filter(
        WorkOrder.status.in_(["待处理", "处理中"])
    ).count()
    
    # 最近巡检记录
    recent_inspections = db.query(InspectionRecord).order_by(
        desc(InspectionRecord.inspection_date)
    ).limit(5).all()
    
    recent_inspections_data = []
    for insp in recent_inspections:
        turbine = db.query(WindTurbine).filter(WindTurbine.id == insp.turbine_id).first()
        recent_inspections_data.append({
            "id": insp.id,
            "inspection_date": insp.inspection_date.isoformat() if insp.inspection_date else None,
            "inspector": insp.inspector,
            "turbine_id": turbine.turbine_id if turbine else None,
            "turbine_name": turbine.name if turbine else None
        })
    
    # 高风险项目
    high_risk_items = db.query(RiskAssessment).filter(
        RiskAssessment.final_risk_level.in_(["严重", "高"])
    ).order_by(desc(RiskAssessment.final_risk_score)).limit(10).all()
    
    high_risk_data = []
    for assessment in high_risk_items:
        photo = db.query(BladePhoto).filter(BladePhoto.id == assessment.photo_id).first()
        blade = None
        turbine = None
        if photo:
            blade = db.query(Blade).filter(Blade.id == photo.blade_id).first()
            if blade:
                turbine = db.query(WindTurbine).filter(WindTurbine.id == blade.turbine_id).first()
        
        high_risk_data.append({
            "id": assessment.id,
            "risk_level": assessment.final_risk_level,
            "risk_score": assessment.final_risk_score,
            "detection_type": assessment.ai_detection_type,
            "turbine_id": turbine.turbine_id if turbine else None,
            "blade_number": blade.blade_number if blade else None,
            "segment": photo.segment if photo else None,
            "manual_override": assessment.manual_override
        })
    
    return APIResponse(
        message="获取仪表盘统计成功",
        data=DashboardStatistics(
            total_turbines=total_turbines,
            total_blades=total_blades,
            total_inspections=total_inspections,
            total_photos=total_photos,
            critical_risks=risk_counts["严重"],
            high_risks=risk_counts["高"],
            medium_risks=risk_counts["中"],
            low_risks=risk_counts["低"],
            active_alarms=active_alarms,
            pending_work_orders=pending_work_orders,
            recent_inspections=recent_inspections_data,
            high_risk_items=high_risk_data
        )
    )


@app.get("/api/dashboard/trends", response_model=APIResponse)
def get_trend_data(
    days: int = 30,
    db: Session = Depends(get_db)
):
    """获取趋势数据"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    # 按日期统计风险评估数量
    from sqlalchemy import cast, Date
    
    daily_stats = db.query(
        cast(RiskAssessment.created_at, Date).label("date"),
        func.count(RiskAssessment.id).label("total"),
        func.sum(func.case((RiskAssessment.final_risk_level == "严重", 1), else_=0)).label("critical"),
        func.sum(func.case((RiskAssessment.final_risk_level == "高", 1), else_=0)).label("high"),
        func.sum(func.case((RiskAssessment.final_risk_level == "中", 1), else_=0)).label("medium"),
        func.sum(func.case((RiskAssessment.final_risk_level == "低", 1), else_=0)).label("low")
    ).filter(
        RiskAssessment.created_at >= start_date
    ).group_by(
        cast(RiskAssessment.created_at, Date)
    ).order_by(
        "date"
    ).all()
    
    trend_data = []
    for row in daily_stats:
        trend_data.append({
            "date": row.date.isoformat(),
            "total": row.total,
            "critical": row.critical or 0,
            "high": row.high or 0,
            "medium": row.medium or 0,
            "low": row.low or 0
        })
    
    return APIResponse(
        message="获取趋势数据成功",
        data={
            "days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "trends": trend_data
        }
    )


# 示例数据初始化接口（用于测试）
@app.post("/api/init-sample-data", response_model=APIResponse)
def init_sample_data(db: Session = Depends(get_db)):
    """初始化示例数据"""
    try:
        # 创建示例风机
        turbine1 = WindTurbine(
            turbine_id="W001",
            name="华能如东H12#001",
            location="如东H12海域",
            latitude=32.5,
            longitude=121.3,
            capacity=5.5,
            status="正常"
        )
        db.add(turbine1)
        db.flush()
        
        turbine2 = WindTurbine(
            turbine_id="W002",
            name="华能如东H12#002",
            location="如东H12海域",
            latitude=32.501,
            longitude=121.301,
            capacity=5.5,
            status="告警"
        )
        db.add(turbine2)
        db.flush()
        
        # 创建叶片（会在创建风机时自动创建，但这里确保）
        for turbine in [turbine1, turbine2]:
            for blade_num in [1, 2, 3]:
                blade = Blade(
                    turbine_id=turbine.id,
                    blade_number=blade_num,
                    length=75.0,
                    manufacturer="中材科技"
                )
                db.add(blade)
        
        # 创建巡检记录
        inspection1 = InspectionRecord(
            turbine_id=turbine1.id,
            inspection_date=datetime.utcnow() - timedelta(days=2),
            inspector="张三",
            weather_conditions="晴朗，风力3级",
            notes="常规巡检"
        )
        db.add(inspection1)
        db.flush()
        
        inspection2 = InspectionRecord(
            turbine_id=turbine2.id,
            inspection_date=datetime.utcnow() - timedelta(days=1),
            inspector="李四",
            weather_conditions="多云，风力4级",
            notes="发现异常后复检"
        )
        db.add(inspection2)
        db.flush()
        
        # 创建SCADA告警
        alarm1 = SCADAAllarm(
            turbine_id=turbine2.id,
            alarm_code="ALM-1001",
            alarm_name="叶片振动异常",
            alarm_type="叶片振动",
            severity="高",
            start_time=datetime.utcnow() - timedelta(hours=48),
            is_active=True,
            description="1号叶片振动值超过阈值，持续24小时"
        )
        db.add(alarm1)
        
        alarm2 = SCADAAllarm(
            turbine_id=turbine2.id,
            alarm_code="ALM-1002",
            alarm_name="温度异常",
            alarm_type="轴承温度",
            severity="中",
            start_time=datetime.utcnow() - timedelta(hours=12),
            is_active=True,
            description="齿轮箱温度偏高"
        )
        db.add(alarm2)
        
        # 创建维修工单
        work_order1 = WorkOrder(
            turbine_id=turbine2.id,
            blade_number=1,
            work_order_id="WO-2024-001",
            issue_type="裂纹",
            description="1号叶片前缘发现疑似裂纹，需要进一步检查",
            priority="高",
            status="待处理",
            assigned_to="维修组A"
        )
        db.add(work_order1)
        
        db.commit()
        
        return APIResponse(
            message="示例数据初始化成功",
            data={
                "turbines_created": 2,
                "inspections_created": 2,
                "alarms_created": 2,
                "work_orders_created": 1
            }
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"初始化示例数据失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
