from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Project, MachineCapacity
from app.schemas import (
    MachineCapacity as MachineCapacitySchema,
    MachineCapacityCreate,
    MachineCapacityUpdate,
    MachineCapacityList,
    ProjectCapacityReport,
)

router = APIRouter(prefix="/machine-capacities", tags=["Machine Capacities"])


@router.post("/", response_model=MachineCapacitySchema, status_code=201)
def create_machine_capacity(
    capacity: MachineCapacityCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == capacity.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    existing_capacity = db.query(MachineCapacity).filter(
        MachineCapacity.project_id == capacity.project_id,
        MachineCapacity.name == capacity.name,
    ).first()
    if existing_capacity:
        raise HTTPException(
            status_code=400,
            detail=f"机器名称 '{capacity.name}' 已存在于该项目中"
        )
    
    db_capacity = MachineCapacity(
        project_id=capacity.project_id,
        name=capacity.name,
        machine_type=capacity.machine_type,
        description=capacity.description,
        cpu_cores=capacity.cpu_cores,
        cpu_model=capacity.cpu_model,
        memory_gb=capacity.memory_gb,
        disk_gb=capacity.disk_gb,
        network_bandwidth_gbps=capacity.network_bandwidth_gbps,
        max_qps_estimated=capacity.max_qps_estimated,
        max_connections=capacity.max_connections,
        tags=capacity.tags,
        metadata=capacity.metadata,
        is_active=capacity.is_active,
    )
    db.add(db_capacity)
    db.commit()
    db.refresh(db_capacity)
    return db_capacity


@router.get("/", response_model=MachineCapacityList)
def list_machine_capacities(
    project_id: Optional[int] = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    machine_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(MachineCapacity)
    
    if project_id:
        query = query.filter(MachineCapacity.project_id == project_id)
    
    if machine_type:
        query = query.filter(MachineCapacity.machine_type == machine_type)
    
    if is_active is not None:
        query = query.filter(MachineCapacity.is_active == is_active)
    
    total = query.count()
    capacities = query.offset(skip).limit(limit).all()
    
    return MachineCapacityList(
        total=total,
        items=capacities,
        page=skip // limit + 1,
        page_size=limit,
    )


@router.get("/{capacity_id}", response_model=MachineCapacitySchema)
def get_machine_capacity(capacity_id: int, db: Session = Depends(get_db)):
    capacity = db.query(MachineCapacity).filter(
        MachineCapacity.id == capacity_id
    ).first()
    if not capacity:
        raise HTTPException(status_code=404, detail="机器容量不存在")
    return capacity


@router.put("/{capacity_id}", response_model=MachineCapacitySchema)
def update_machine_capacity(
    capacity_id: int,
    capacity_update: MachineCapacityUpdate,
    db: Session = Depends(get_db),
):
    capacity = db.query(MachineCapacity).filter(
        MachineCapacity.id == capacity_id
    ).first()
    if not capacity:
        raise HTTPException(status_code=404, detail="机器容量不存在")
    
    update_data = capacity_update.model_dump(exclude_unset=True)
    
    if 'name' in update_data:
        existing_capacity = db.query(MachineCapacity).filter(
            MachineCapacity.project_id == capacity.project_id,
            MachineCapacity.name == update_data['name'],
            MachineCapacity.id != capacity_id,
        ).first()
        if existing_capacity:
            raise HTTPException(
                status_code=400,
                detail=f"机器名称 '{update_data['name']}' 已存在"
            )
    
    for key, value in update_data.items():
        if hasattr(capacity, key):
            setattr(capacity, key, value)
    
    db.commit()
    db.refresh(capacity)
    return capacity


@router.delete("/{capacity_id}", status_code=204)
def delete_machine_capacity(capacity_id: int, db: Session = Depends(get_db)):
    capacity = db.query(MachineCapacity).filter(
        MachineCapacity.id == capacity_id
    ).first()
    if not capacity:
        raise HTTPException(status_code=404, detail="机器容量不存在")
    
    db.delete(capacity)
    db.commit()


@router.get("/project/{project_id}/report", response_model=ProjectCapacityReport)
def get_project_capacity_report(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    
    capacities = db.query(MachineCapacity).filter(
        MachineCapacity.project_id == project_id,
        MachineCapacity.is_active == True,
    ).all()
    
    if not capacities:
        raise HTTPException(status_code=404, detail="该项目没有配置机器容量")
    
    total_machines = len(capacities)
    total_cpu_cores = sum(c.cpu_cores for c in capacities)
    total_memory_gb = sum(c.memory_gb for c in capacities)
    
    estimated_max_qps = 0
    for c in capacities:
        if c.max_qps_estimated:
            estimated_max_qps += c.max_qps_estimated
        else:
            estimated_qps = c.cpu_cores * 1000
            estimated_max_qps += estimated_qps
    
    bottleneck_machines = []
    for c in capacities:
        if c.cpu_cores <= 2:
            bottleneck_machines.append({
                "id": c.id,
                "name": c.name,
                "machine_type": c.machine_type,
                "issue": "CPU核心数较少",
                "severity": "medium",
            })
        if c.memory_gb <= 4:
            bottleneck_machines.append({
                "id": c.id,
                "name": c.name,
                "machine_type": c.machine_type,
                "issue": "内存容量较小",
                "severity": "medium",
            })
    
    recommendations = []
    if any(c.cpu_cores <= 2 for c in capacities):
        recommendations.append("建议增加 CPU 核心数以提升计算能力")
    if any(c.memory_gb <= 4 for c in capacities):
        recommendations.append("建议增加内存容量以支持更多并发请求")
    if estimated_max_qps < 10000:
        recommendations.append(f"预估最大 QPS ({estimated_max_qps}) 较低，考虑增加机器数量或升级配置")
    
    return ProjectCapacityReport(
        total_machines=total_machines,
        total_cpu_cores=total_cpu_cores,
        total_memory_gb=total_memory_gb,
        estimated_max_qps=estimated_max_qps,
        current_utilization_percent=None,
        bottleneck_machines=bottleneck_machines,
        recommendations=recommendations,
    )
