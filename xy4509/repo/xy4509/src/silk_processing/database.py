from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import contextmanager
from pathlib import Path
import json

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Float,
    DateTime,
    Text,
    ForeignKey,
    Enum as SQLEnum,
    JSON,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session

from .models import (
    CocoonBatch as CocoonBatchModel,
    MoistureInspection as MoistureInspectionModel,
    TemperaturePoint,
    CookingCurve as CookingCurveModel,
    BreakageRecord as BreakageRecordModel,
    DeliveryRecord as DeliveryRecordModel,
    ProcessCalculation as ProcessCalculationModel,
    BatchProcessData,
    CocoonGrade,
    DeliveryGrade,
    BreakageSeverity,
)

Base = declarative_base()


class CocoonBatch(Base):
    """蚕茧批次数据库模型"""
    __tablename__ = 'cocoon_batches'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    batch_id = Column(String(50), unique=True, nullable=False, index=True)
    source = Column(String(100), nullable=False)
    purchase_date = Column(DateTime, nullable=False)
    total_weight_kg = Column(Float, nullable=False)
    grade = Column(SQLEnum(CocoonGrade), nullable=False)
    supplier = Column(String(100))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    moisture_inspections = relationship("MoistureInspection", back_populates="batch", cascade="all, delete-orphan")
    cooking_curves = relationship("CookingCurve", back_populates="batch", cascade="all, delete-orphan")
    breakage_records = relationship("BreakageRecord", back_populates="batch", cascade="all, delete-orphan")
    delivery_records = relationship("DeliveryRecord", back_populates="batch", cascade="all, delete-orphan")
    calculations = relationship("ProcessCalculation", back_populates="batch", cascade="all, delete-orphan")
    
    def to_pydantic(self) -> CocoonBatchModel:
        return CocoonBatchModel(
            batch_id=self.batch_id,
            source=self.source,
            purchase_date=self.purchase_date,
            total_weight_kg=self.total_weight_kg,
            grade=self.grade,
            supplier=self.supplier,
            notes=self.notes,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class MoistureInspection(Base):
    """含水率抽检数据库模型"""
    __tablename__ = 'moisture_inspections'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    inspection_id = Column(String(50), unique=True, nullable=False)
    batch_id = Column(String(50), ForeignKey('cocoon_batches.batch_id'), nullable=False, index=True)
    inspection_date = Column(DateTime, nullable=False)
    sample_weight_g = Column(Float, nullable=False)
    dry_weight_g = Column(Float, nullable=False)
    moisture_content = Column(Float)
    inspector = Column(String(50))
    notes = Column(Text)
    
    batch = relationship("CocoonBatch", back_populates="moisture_inspections")
    
    def to_pydantic(self) -> MoistureInspectionModel:
        return MoistureInspectionModel(
            inspection_id=self.inspection_id,
            batch_id=self.batch_id,
            inspection_date=self.inspection_date,
            sample_weight_g=self.sample_weight_g,
            dry_weight_g=self.dry_weight_g,
            moisture_content=self.moisture_content,
            inspector=self.inspector,
            notes=self.notes,
        )


class CookingCurve(Base):
    """煮茧温度曲线数据库模型"""
    __tablename__ = 'cooking_curves'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    curve_id = Column(String(50), unique=True, nullable=False)
    batch_id = Column(String(50), ForeignKey('cocoon_batches.batch_id'), nullable=False, index=True)
    cooking_date = Column(DateTime, nullable=False)
    curve_name = Column(String(100), nullable=False)
    temperature_points_json = Column(JSON, nullable=False)
    total_cooking_time_min = Column(Float)
    max_temperature = Column(Float)
    operator = Column(String(50))
    notes = Column(Text)
    
    batch = relationship("CocoonBatch", back_populates="cooking_curves")
    
    @property
    def temperature_points(self) -> List[TemperaturePoint]:
        points_data = json.loads(self.temperature_points_json) if isinstance(self.temperature_points_json, str) else self.temperature_points_json
        return [TemperaturePoint(**p) for p in points_data]
    
    def to_pydantic(self) -> CookingCurveModel:
        return CookingCurveModel(
            curve_id=self.curve_id,
            batch_id=self.batch_id,
            cooking_date=self.cooking_date,
            curve_name=self.curve_name,
            temperature_points=self.temperature_points,
            total_cooking_time_min=self.total_cooking_time_min,
            max_temperature=self.max_temperature,
            operator=self.operator,
            notes=self.notes,
        )


class BreakageRecord(Base):
    """断头记录数据库模型"""
    __tablename__ = 'breakage_records'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    record_id = Column(String(50), unique=True, nullable=False)
    batch_id = Column(String(50), ForeignKey('cocoon_batches.batch_id'), nullable=False, index=True)
    record_date = Column(DateTime, nullable=False)
    machine_id = Column(String(50), nullable=False)
    spindle_count = Column(Integer, nullable=False)
    breakage_count = Column(Integer, nullable=False)
    breakage_per_hour = Column(Float)
    operating_hours = Column(Float, nullable=False)
    severity = Column(SQLEnum(BreakageSeverity), default=BreakageSeverity.MEDIUM)
    operator = Column(String(50))
    notes = Column(Text)
    
    batch = relationship("CocoonBatch", back_populates="breakage_records")
    
    def to_pydantic(self) -> BreakageRecordModel:
        return BreakageRecordModel(
            record_id=self.record_id,
            batch_id=self.batch_id,
            record_date=self.record_date,
            machine_id=self.machine_id,
            spindle_count=self.spindle_count,
            breakage_count=self.breakage_count,
            breakage_per_hour=self.breakage_per_hour,
            operating_hours=self.operating_hours,
            severity=self.severity,
            operator=self.operator,
            notes=self.notes,
        )


class DeliveryRecord(Base):
    """交货记录数据库模型"""
    __tablename__ = 'delivery_records'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    delivery_id = Column(String(50), unique=True, nullable=False)
    batch_id = Column(String(50), ForeignKey('cocoon_batches.batch_id'), nullable=False, index=True)
    delivery_date = Column(DateTime, nullable=False)
    silk_weight_kg = Column(Float, nullable=False)
    grade = Column(SQLEnum(DeliveryGrade), nullable=False)
    filature_rate = Column(Float)
    customer = Column(String(100))
    inspector = Column(String(50))
    notes = Column(Text)
    
    batch = relationship("CocoonBatch", back_populates="delivery_records")
    
    def to_pydantic(self) -> DeliveryRecordModel:
        return DeliveryRecordModel(
            delivery_id=self.delivery_id,
            batch_id=self.batch_id,
            delivery_date=self.delivery_date,
            silk_weight_kg=self.silk_weight_kg,
            grade=self.grade,
            filature_rate=self.filature_rate,
            customer=self.customer,
            inspector=self.inspector,
            notes=self.notes,
        )


class ProcessCalculation(Base):
    """工艺计算结果数据库模型"""
    __tablename__ = 'process_calculations'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    calculation_id = Column(String(50), unique=True, nullable=False)
    batch_id = Column(String(50), ForeignKey('cocoon_batches.batch_id'), nullable=False, index=True)
    calculation_date = Column(DateTime, default=datetime.now)
    
    target_moisture = Column(Float, nullable=False)
    current_moisture = Column(Float, nullable=False)
    water_supplement_kg = Column(Float, nullable=False)
    
    recommended_cooking_temp = Column(Float, nullable=False)
    recommended_cooking_time_min = Column(Float, nullable=False)
    soaking_time_min = Column(Float)
    steam_pressure = Column(Float)
    
    estimated_filature_rate = Column(Float, nullable=False)
    estimated_silk_output_kg = Column(Float, nullable=False)
    
    breakage_risk_level = Column(String(20), nullable=False)
    estimated_breakage_per_hour = Column(Float, nullable=False)
    risk_factors_json = Column(JSON, default=list)
    
    reviewer_notes = Column(Text)
    reviewed_by = Column(String(50))
    reviewed_at = Column(DateTime)
    
    anomalies_json = Column(JSON, default=list)
    warnings_json = Column(JSON, default=list)
    
    batch = relationship("CocoonBatch", back_populates="calculations")
    
    def to_pydantic(self) -> ProcessCalculationModel:
        risk_factors = json.loads(self.risk_factors_json) if isinstance(self.risk_factors_json, str) else self.risk_factors_json
        anomalies = json.loads(self.anomalies_json) if isinstance(self.anomalies_json, str) else self.anomalies_json
        warnings = json.loads(self.warnings_json) if isinstance(self.warnings_json, str) else self.warnings_json
        
        return ProcessCalculationModel(
            calculation_id=self.calculation_id,
            batch_id=self.batch_id,
            calculation_date=self.calculation_date,
            target_moisture=self.target_moisture,
            current_moisture=self.current_moisture,
            water_supplement_kg=self.water_supplement_kg,
            recommended_cooking_temp=self.recommended_cooking_temp,
            recommended_cooking_time_min=self.recommended_cooking_time_min,
            soaking_time_min=self.soaking_time_min,
            steam_pressure=self.steam_pressure,
            estimated_filature_rate=self.estimated_filature_rate,
            estimated_silk_output_kg=self.estimated_silk_output_kg,
            breakage_risk_level=self.breakage_risk_level,
            estimated_breakage_per_hour=self.estimated_breakage_per_hour,
            risk_factors=risk_factors or [],
            reviewer_notes=self.reviewer_notes,
            reviewed_by=self.reviewed_by,
            reviewed_at=self.reviewed_at,
            anomalies=anomalies or [],
            warnings=warnings or [],
        )


class DatabaseManager:
    """数据库管理器"""
    
    def __init__(self, db_path: str = None):
        import os
        if db_path is None:
            env_db_path = os.environ.get("SILK_DB_PATH")
            if env_db_path:
                db_path = env_db_path
            else:
                project_dir = Path(__file__).parent.parent.parent.parent
                db_path = str(project_dir / "data" / "silk_data.db")
        
        db_dir = Path(db_path).parent
        db_dir.mkdir(parents=True, exist_ok=True)
        
        self.engine = create_engine(f'sqlite:///{db_path}', echo=False)
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
    
    @contextmanager
    def get_session(self) -> Session:
        """获取数据库会话"""
        session = self.Session()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()
    
    def add_batch(self, batch: CocoonBatchModel) -> None:
        """添加蚕茧批次"""
        with self.get_session() as session:
            existing = session.query(CocoonBatch).filter_by(batch_id=batch.batch_id).first()
            if existing:
                raise ValueError(f"批次 {batch.batch_id} 已存在")
            
            db_batch = CocoonBatch(
                batch_id=batch.batch_id,
                source=batch.source,
                purchase_date=batch.purchase_date,
                total_weight_kg=batch.total_weight_kg,
                grade=batch.grade,
                supplier=batch.supplier,
                notes=batch.notes,
                created_at=batch.created_at,
                updated_at=batch.updated_at,
            )
            session.add(db_batch)
    
    def add_moisture_inspection(self, inspection: MoistureInspectionModel) -> None:
        """添加含水率抽检"""
        with self.get_session() as session:
            existing = session.query(MoistureInspection).filter_by(inspection_id=inspection.inspection_id).first()
            if existing:
                raise ValueError(f"抽检记录 {inspection.inspection_id} 已存在")
            
            db_inspection = MoistureInspection(
                inspection_id=inspection.inspection_id,
                batch_id=inspection.batch_id,
                inspection_date=inspection.inspection_date,
                sample_weight_g=inspection.sample_weight_g,
                dry_weight_g=inspection.dry_weight_g,
                moisture_content=inspection.moisture_content,
                inspector=inspection.inspector,
                notes=inspection.notes,
            )
            session.add(db_inspection)
    
    def add_cooking_curve(self, curve: CookingCurveModel) -> None:
        """添加煮茧温度曲线"""
        with self.get_session() as session:
            existing = session.query(CookingCurve).filter_by(curve_id=curve.curve_id).first()
            if existing:
                raise ValueError(f"曲线 {curve.curve_id} 已存在")
            
            points_json = json.dumps([p.dict() for p in curve.temperature_points])
            
            db_curve = CookingCurve(
                curve_id=curve.curve_id,
                batch_id=curve.batch_id,
                cooking_date=curve.cooking_date,
                curve_name=curve.curve_name,
                temperature_points_json=points_json,
                total_cooking_time_min=curve.total_cooking_time_min,
                max_temperature=curve.max_temperature,
                operator=curve.operator,
                notes=curve.notes,
            )
            session.add(db_curve)
    
    def add_breakage_record(self, record: BreakageRecordModel) -> None:
        """添加断头记录"""
        with self.get_session() as session:
            existing = session.query(BreakageRecord).filter_by(record_id=record.record_id).first()
            if existing:
                raise ValueError(f"记录 {record.record_id} 已存在")
            
            db_record = BreakageRecord(
                record_id=record.record_id,
                batch_id=record.batch_id,
                record_date=record.record_date,
                machine_id=record.machine_id,
                spindle_count=record.spindle_count,
                breakage_count=record.breakage_count,
                breakage_per_hour=record.breakage_per_hour,
                operating_hours=record.operating_hours,
                severity=record.severity,
                operator=record.operator,
                notes=record.notes,
            )
            session.add(db_record)
    
    def add_delivery_record(self, record: DeliveryRecordModel) -> None:
        """添加交货记录"""
        with self.get_session() as session:
            existing = session.query(DeliveryRecord).filter_by(delivery_id=record.delivery_id).first()
            if existing:
                raise ValueError(f"交货记录 {record.delivery_id} 已存在")
            
            db_record = DeliveryRecord(
                delivery_id=record.delivery_id,
                batch_id=record.batch_id,
                delivery_date=record.delivery_date,
                silk_weight_kg=record.silk_weight_kg,
                grade=record.grade,
                filature_rate=record.filature_rate,
                customer=record.customer,
                inspector=record.inspector,
                notes=record.notes,
            )
            session.add(db_record)
    
    def add_calculation(self, calculation: ProcessCalculationModel) -> None:
        """添加工艺计算结果"""
        with self.get_session() as session:
            existing = session.query(ProcessCalculation).filter_by(calculation_id=calculation.calculation_id).first()
            if existing:
                raise ValueError(f"计算结果 {calculation.calculation_id} 已存在")
            
            db_calc = ProcessCalculation(
                calculation_id=calculation.calculation_id,
                batch_id=calculation.batch_id,
                calculation_date=calculation.calculation_date,
                target_moisture=calculation.target_moisture,
                current_moisture=calculation.current_moisture,
                water_supplement_kg=calculation.water_supplement_kg,
                recommended_cooking_temp=calculation.recommended_cooking_temp,
                recommended_cooking_time_min=calculation.recommended_cooking_time_min,
                soaking_time_min=calculation.soaking_time_min,
                steam_pressure=calculation.steam_pressure,
                estimated_filature_rate=calculation.estimated_filature_rate,
                estimated_silk_output_kg=calculation.estimated_silk_output_kg,
                breakage_risk_level=calculation.breakage_risk_level,
                estimated_breakage_per_hour=calculation.estimated_breakage_per_hour,
                risk_factors_json=json.dumps(calculation.risk_factors),
                reviewer_notes=calculation.reviewer_notes,
                reviewed_by=calculation.reviewed_by,
                reviewed_at=calculation.reviewed_at,
                anomalies_json=json.dumps(calculation.anomalies),
                warnings_json=json.dumps(calculation.warnings),
            )
            session.add(db_calc)
    
    def get_batch(self, batch_id: str) -> Optional[CocoonBatchModel]:
        """获取单个批次"""
        with self.get_session() as session:
            db_batch = session.query(CocoonBatch).filter_by(batch_id=batch_id).first()
            return db_batch.to_pydantic() if db_batch else None
    
    def get_all_batches(self) -> List[CocoonBatchModel]:
        """获取所有批次"""
        with self.get_session() as session:
            db_batches = session.query(CocoonBatch).all()
            return [b.to_pydantic() for b in db_batches]
    
    def get_batch_process_data(self, batch_id: str) -> Optional[BatchProcessData]:
        """获取批次完整工艺数据"""
        with self.get_session() as session:
            db_batch = session.query(CocoonBatch).filter_by(batch_id=batch_id).first()
            if not db_batch:
                return None
            
            moisture_inspections = [
                m.to_pydantic() for m in 
                session.query(MoistureInspection).filter_by(batch_id=batch_id).all()
            ]
            
            cooking_curves = [
                c.to_pydantic() for c in 
                session.query(CookingCurve).filter_by(batch_id=batch_id).all()
            ]
            
            breakage_records = [
                b.to_pydantic() for b in 
                session.query(BreakageRecord).filter_by(batch_id=batch_id).all()
            ]
            
            delivery_records = [
                d.to_pydantic() for d in 
                session.query(DeliveryRecord).filter_by(batch_id=batch_id).all()
            ]
            
            calculations = [
                c.to_pydantic() for c in 
                session.query(ProcessCalculation).filter_by(batch_id=batch_id).all()
            ]
            
            return BatchProcessData(
                batch=db_batch.to_pydantic(),
                moisture_inspections=moisture_inspections,
                cooking_curves=cooking_curves,
                breakage_records=breakage_records,
                delivery_records=delivery_records,
                calculations=calculations,
            )
    
    def search_batches(
        self,
        batch_id: str = None,
        source: str = None,
        grade: CocoonGrade = None,
        start_date: datetime = None,
        end_date: datetime = None,
    ) -> List[CocoonBatchModel]:
        """搜索批次"""
        with self.get_session() as session:
            query = session.query(CocoonBatch)
            
            if batch_id:
                query = query.filter(CocoonBatch.batch_id.contains(batch_id))
            if source:
                query = query.filter(CocoonBatch.source.contains(source))
            if grade:
                query = query.filter(CocoonBatch.grade == grade)
            if start_date:
                query = query.filter(CocoonBatch.purchase_date >= start_date)
            if end_date:
                query = query.filter(CocoonBatch.purchase_date <= end_date)
            
            db_batches = query.all()
            return [b.to_pydantic() for b in db_batches]
    
    def update_calculation_review(
        self,
        calculation_id: str,
        reviewer_notes: str,
        reviewed_by: str,
    ) -> bool:
        """更新计算结果的复核信息"""
        with self.get_session() as session:
            db_calc = session.query(ProcessCalculation).filter_by(calculation_id=calculation_id).first()
            if not db_calc:
                return False
            
            db_calc.reviewer_notes = reviewer_notes
            db_calc.reviewed_by = reviewed_by
            db_calc.reviewed_at = datetime.now()
            return True
    
    def delete_batch(self, batch_id: str) -> bool:
        """删除批次及关联数据"""
        with self.get_session() as session:
            db_batch = session.query(CocoonBatch).filter_by(batch_id=batch_id).first()
            if not db_batch:
                return False
            
            session.delete(db_batch)
            return True
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取统计信息"""
        with self.get_session() as session:
            batch_count = session.query(CocoonBatch).count()
            total_weight = session.query(CocoonBatch.total_weight_kg).all()
            total_weight = sum(w[0] for w in total_weight) if total_weight else 0
            
            inspection_count = session.query(MoistureInspection).count()
            curve_count = session.query(CookingCurve).count()
            breakage_count = session.query(BreakageRecord).count()
            delivery_count = session.query(DeliveryRecord).count()
            calc_count = session.query(ProcessCalculation).count()
            
            return {
                "batch_count": batch_count,
                "total_weight_kg": round(total_weight, 2),
                "moisture_inspection_count": inspection_count,
                "cooking_curve_count": curve_count,
                "breakage_record_count": breakage_count,
                "delivery_record_count": delivery_count,
                "calculation_count": calc_count,
            }


_default_db_manager: Optional[DatabaseManager] = None


def get_default_db() -> DatabaseManager:
    """获取默认数据库管理器"""
    global _default_db_manager
    if _default_db_manager is None:
        _default_db_manager = DatabaseManager()
    return _default_db_manager
