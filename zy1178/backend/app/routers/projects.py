from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import pandas as pd
from io import StringIO

from app.database import get_db
from app.models import Project, Roof, Obstacle, Panel, HourlyData, Layout, CalculationResult
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse,
    RoofCreate, RoofResponse,
    ObstacleCreate, ObstacleResponse,
    PanelCreate, PanelResponse,
    HourlyDataCreate, HourlyDataResponse,
    LayoutCreate, LayoutResponse,
    Point
)

router = APIRouter()

@router.post("/", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@router.get("/", response_model=List[ProjectResponse])
def list_projects(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).offset(skip).limit(limit).all()
    return projects

@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return project

@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, project: ProjectUpdate, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    for key, value in project.model_dump(exclude_unset=True).items():
        setattr(db_project, key, value)
    
    db.commit()
    db.refresh(db_project)
    return db_project

@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    db_project = db.query(Project).filter(Project.id == project_id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db.delete(db_project)
    db.commit()
    return {"message": "项目已删除"}

@router.post("/roofs/", response_model=RoofResponse)
def create_roof(roof: RoofCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == roof.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    coordinates_json = json.dumps([p.model_dump() for p in roof.coordinates])
    db_roof = Roof(
        project_id=roof.project_id,
        name=roof.name,
        coordinates=coordinates_json,
        area=roof.area,
        inclination=roof.inclination,
        azimuth=roof.azimuth
    )
    db.add(db_roof)
    db.commit()
    db.refresh(db_roof)
    
    db_roof.coordinates = [Point(**p) for p in json.loads(db_roof.coordinates)]
    return db_roof

@router.get("/{project_id}/roofs/", response_model=List[RoofResponse])
def list_roofs(project_id: int, db: Session = Depends(get_db)):
    roofs = db.query(Roof).filter(Roof.project_id == project_id).all()
    for roof in roofs:
        roof.coordinates = [Point(**p) for p in json.loads(roof.coordinates)]
    return roofs

@router.post("/obstacles/", response_model=ObstacleResponse)
def create_obstacle(obstacle: ObstacleCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == obstacle.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    coordinates_json = json.dumps([p.model_dump() for p in obstacle.coordinates])
    db_obstacle = Obstacle(
        project_id=obstacle.project_id,
        name=obstacle.name,
        coordinates=coordinates_json,
        height=obstacle.height,
        type=obstacle.type
    )
    db.add(db_obstacle)
    db.commit()
    db.refresh(db_obstacle)
    
    db_obstacle.coordinates = [Point(**p) for p in json.loads(db_obstacle.coordinates)]
    return db_obstacle

@router.get("/{project_id}/obstacles/", response_model=List[ObstacleResponse])
def list_obstacles(project_id: int, db: Session = Depends(get_db)):
    obstacles = db.query(Obstacle).filter(Obstacle.project_id == project_id).all()
    for obstacle in obstacles:
        obstacle.coordinates = [Point(**p) for p in json.loads(obstacle.coordinates)]
    return obstacles

@router.post("/panels/", response_model=PanelResponse)
def create_panel(panel: PanelCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == panel.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    db_panel = Panel(**panel.model_dump())
    db.add(db_panel)
    db.commit()
    db.refresh(db_panel)
    return db_panel

@router.get("/{project_id}/panels/", response_model=List[PanelResponse])
def list_panels(project_id: int, db: Session = Depends(get_db)):
    panels = db.query(Panel).filter(Panel.project_id == project_id).all()
    return panels

@router.post("/hourly-data/")
def create_hourly_data(data_list: List[HourlyDataCreate], db: Session = Depends(get_db)):
    if not data_list:
        raise HTTPException(status_code=400, detail="数据不能为空")
    
    project_id = data_list[0].project_id
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    for data in data_list:
        db_data = HourlyData(**data.model_dump())
        db.add(db_data)
    
    db.commit()
    return {"message": f"成功添加 {len(data_list)} 条数据"}

@router.post("/hourly-data/csv/")
async def import_hourly_data_csv(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    content = await file.read()
    try:
        df = pd.read_csv(StringIO(content.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV文件解析失败: {str(e)}")
    
    required_columns = ['timestamp', 'global_irradiance', 'electricity_price']
    for col in required_columns:
        if col not in df.columns:
            raise HTTPException(status_code=400, detail=f"缺少必要列: {col}")
    
    count = 0
    for _, row in df.iterrows():
        hourly_data = HourlyData(
            project_id=project_id,
            timestamp=pd.to_datetime(row['timestamp']).to_pydatetime(),
            global_irradiance=float(row['global_irradiance']),
            direct_irradiance=float(row.get('direct_irradiance', 0)) if pd.notna(row.get('direct_irradiance')) else None,
            diffuse_irradiance=float(row.get('diffuse_irradiance', 0)) if pd.notna(row.get('diffuse_irradiance')) else None,
            temperature=float(row.get('temperature', 25)) if pd.notna(row.get('temperature')) else None,
            wind_speed=float(row.get('wind_speed', 0)) if pd.notna(row.get('wind_speed')) else None,
            electricity_price=float(row['electricity_price']),
            feed_in_tariff=float(row.get('feed_in_tariff', row['electricity_price'])) if pd.notna(row.get('feed_in_tariff')) else None
        )
        db.add(hourly_data)
        count += 1
    
    db.commit()
    return {"message": f"成功导入 {count} 条数据"}

@router.get("/{project_id}/hourly-data/", response_model=List[HourlyDataResponse])
def list_hourly_data(
    project_id: int,
    limit: int = Query(1000, ge=1, le=10000),
    db: Session = Depends(get_db)
):
    data = db.query(HourlyData).filter(HourlyData.project_id == project_id).limit(limit).all()
    return data

@router.post("/layouts/", response_model=LayoutResponse)
def create_layout(layout: LayoutCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == layout.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    if layout.is_active:
        db.query(Layout).filter(Layout.project_id == layout.project_id).update({"is_active": False})
    
    panel_positions_json = json.dumps(layout.panel_positions)
    db_layout = Layout(
        project_id=layout.project_id,
        name=layout.name,
        panel_positions=panel_positions_json,
        panel_count=layout.panel_count,
        total_power=layout.total_power,
        is_active=layout.is_active
    )
    db.add(db_layout)
    db.commit()
    db.refresh(db_layout)
    
    db_layout.panel_positions = json.loads(db_layout.panel_positions)
    return db_layout

@router.get("/{project_id}/layouts/", response_model=List[LayoutResponse])
def list_layouts(project_id: int, db: Session = Depends(get_db)):
    layouts = db.query(Layout).filter(Layout.project_id == project_id).all()
    for layout in layouts:
        layout.panel_positions = json.loads(layout.panel_positions)
    return layouts

@router.put("/layouts/{layout_id}/activate")
def activate_layout(layout_id: int, db: Session = Depends(get_db)):
    layout = db.query(Layout).filter(Layout.id == layout_id).first()
    if not layout:
        raise HTTPException(status_code=404, detail="方案不存在")
    
    db.query(Layout).filter(Layout.project_id == layout.project_id).update({"is_active": False})
    layout.is_active = True
    db.commit()
    
    return {"message": "方案已激活"}
