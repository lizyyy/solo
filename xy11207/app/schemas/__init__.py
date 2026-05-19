from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any
from app.models import DeliveryStatus, AnomalyType, ImportRecordStatus


class DeliveryItemBase(BaseModel):
    product_code: str
    product_name: str
    batch_number: str
    quantity: int
    unit: str = "盒"
    manufacture_date: Optional[datetime] = None
    expiry_date: datetime
    storage_condition: Optional[str] = None
    min_temperature: Optional[float] = None
    max_temperature: Optional[float] = None
    remarks: Optional[str] = None


class DeliveryItemCreate(DeliveryItemBase):
    pass


class DeliveryItem(DeliveryItemBase):
    id: int
    delivery_order_id: int
    is_inspected: bool
    inspected_by: Optional[str] = None
    inspected_at: Optional[datetime] = None
    inspection_result: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemperatureRecordBase(BaseModel):
    record_time: datetime
    temperature: float
    humidity: Optional[float] = None
    device_id: Optional[str] = None
    location: Optional[str] = None
    remarks: Optional[str] = None


class TemperatureRecordCreate(TemperatureRecordBase):
    pass


class TemperatureRecord(TemperatureRecordBase):
    id: int
    delivery_order_id: int
    is_anomaly: bool
    anomaly_type: Optional[AnomalyType] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeliveryPhotoBase(BaseModel):
    file_name: str
    file_path: str
    file_size: Optional[int] = None
    photo_type: Optional[str] = None
    uploaded_by: Optional[str] = None
    description: Optional[str] = None
    is_anomaly_evidence: bool = False
    anomaly_id: Optional[int] = None


class DeliveryPhotoCreate(DeliveryPhotoBase):
    pass


class DeliveryPhoto(DeliveryPhotoBase):
    id: int
    delivery_order_id: int
    uploaded_at: datetime

    class Config:
        from_attributes = True


class AnomalyRecordBase(BaseModel):
    anomaly_type: AnomalyType
    description: str
    severity: str = "medium"
    reported_by: Optional[str] = None


class AnomalyRecordCreate(AnomalyRecordBase):
    pass


class AnomalyRecord(AnomalyRecordBase):
    id: int
    delivery_order_id: int
    reported_at: datetime
    status: str
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution: Optional[str] = None
    photos: List[DeliveryPhoto] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeliveryOrderBase(BaseModel):
    order_number: str
    supplier_name: str
    delivery_date: datetime
    remarks: Optional[str] = None


class DeliveryOrderCreate(DeliveryOrderBase):
    items: List[DeliveryItemCreate] = []


class DeliveryOrder(DeliveryOrderBase):
    id: int
    received_by: Optional[str] = None
    received_at: Optional[datetime] = None
    status: DeliveryStatus
    total_items: int
    anomaly_count: int
    items: List[DeliveryItem] = []
    temperature_records: List[TemperatureRecord] = []
    photos: List[DeliveryPhoto] = []
    anomalies: List[AnomalyRecord] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BadImportRecordBase(BaseModel):
    import_batch_id: str
    import_type: str
    original_position: str
    raw_data: str
    error_message: str
    suggested_fix: Optional[str] = None


class BadImportRecord(BadImportRecordBase):
    id: int
    is_resolved: bool
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    resolution_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ImportBatchBase(BaseModel):
    import_type: str
    file_name: str
    started_by: Optional[str] = None


class ImportBatchCreate(ImportBatchBase):
    pass


class ImportBatch(ImportBatchBase):
    id: str
    total_records: int
    success_count: int
    failed_count: int
    status: ImportRecordStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class ImportResult(BaseModel):
    batch_id: str
    total_records: int
    success_count: int
    failed_count: int
    successful_ids: List[int] = []
    failed_records: List[BadImportRecord] = []
    status: ImportRecordStatus


class BatchOperationResult(BaseModel):
    total: int
    success_count: int
    failed_count: int
    successful_ids: List[int]
    failed_details: List[dict]


class DeliveryOrderQuery(BaseModel):
    received_by: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[DeliveryStatus] = None
    anomaly_type: Optional[AnomalyType] = None
    has_anomaly: Optional[bool] = None
    supplier_name: Optional[str] = None
    page: int = 1
    page_size: int = 50


class PaginatedResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[Any]


class ReportExportRequest(BaseModel):
    query_params: DeliveryOrderQuery
    format: str = "xlsx"
    include_details: bool = True
