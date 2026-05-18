from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime
from models import WaitlistStatus, ImportRecordStatus, BadRowReason
import json


class WaitlistImportRow(BaseModel):
    waitlist_no: str = Field(..., description="候补编号")
    class_name: str = Field(..., description="课程名称")
    class_date: str = Field(..., description="上课日期 YYYY-MM-DD")
    start_time: str = Field(..., description="开始时间 HH:MM")
    instructor: str = Field(..., description="授课老师")
    member_no: str = Field(..., description="会员编号")
    member_name: str = Field(..., description="会员姓名")
    phone: str = Field(..., description="联系电话")
    waitlist_order: int = Field(..., description="候补顺序号")
    status: str = Field(..., description="候补状态")
    apply_time: str = Field(..., description="申请候补时间 YYYY-MM-DD HH:MM:SS")
    confirm_deadline: Optional[str] = Field(None, description="确认截止时间")
    operator: str = Field(..., description="操作人")
    quota_source: Optional[str] = Field(None, description="名额来源说明")


class BadRowResponse(BaseModel):
    row_number: int
    original_data: dict
    error_reason: str
    error_detail: str
    suggestion: str

    @validator("original_data", pre=True)
    def parse_original_data(cls, v):
        if isinstance(v, str):
            return json.loads(v)
        return v


class ImportResponse(BaseModel):
    batch_no: str
    total_count: int
    success_count: int
    failed_count: int
    review_count: int
    bad_rows: List[BadRowResponse]
    import_time: datetime


class WaitlistRecordResponse(BaseModel):
    id: int
    waitlist_no: str
    waitlist_order: int
    status: str
    apply_time: datetime
    member_name: str
    class_name: str
    instructor: str
    manual_remark: Optional[str]

    class Config:
        orm_mode = True


class AuditLogResponse(BaseModel):
    id: int
    action: str
    table_name: Optional[str]
    record_id: Optional[int]
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    operator: Optional[str]
    operation_time: datetime

    class Config:
        orm_mode = True


class ReviewRequest(BaseModel):
    bad_row_id: int
    manual_remark: str
    operator: str


class SampleDataGenerator:
    @staticmethod
    def generate_valid_sample() -> List[dict]:
        return [
            {
                "waitlist_no": "WL20240518001",
                "class_name": "流瑜伽进阶",
                "class_date": "2024-05-20",
                "start_time": "09:00",
                "instructor": "李老师",
                "member_no": "M001",
                "member_name": "张三",
                "phone": "13800138001",
                "waitlist_order": 1,
                "status": "等待候补",
                "apply_time": "2024-05-17 10:30:00",
                "confirm_deadline": "2024-05-19 18:00:00",
                "operator": "前台小王",
                "quota_source": "会员李四取消名额"
            },
            {
                "waitlist_no": "WL20240518002",
                "class_name": "阴瑜伽放松",
                "class_date": "2024-05-20",
                "start_time": "14:00",
                "instructor": "王老师",
                "member_no": "M002",
                "member_name": "李四",
                "phone": "13800138002",
                "waitlist_order": 1,
                "status": "确认中",
                "apply_time": "2024-05-17 11:00:00",
                "confirm_deadline": "2024-05-19 20:00:00",
                "operator": "前台小王",
                "quota_source": ""
            }
        ]

    @staticmethod
    def generate_mixed_sample() -> List[dict]:
        return [
            {
                "waitlist_no": "WL20240518003",
                "class_name": "阿斯汤加",
                "class_date": "2024-05-21",
                "start_time": "07:00",
                "instructor": "陈老师",
                "member_no": "M003",
                "member_name": "王五",
                "phone": "13800138003",
                "waitlist_order": 1,
                "status": "等待候补",
                "apply_time": "2024-05-18 08:00:00",
                "confirm_deadline": "2024-05-20 18:00:00",
                "operator": "前台小李",
                "quota_source": ""
            },
            {
                "waitlist_no": "WL20240518003",
                "class_name": "阿斯汤加",
                "class_date": "2024-05-21",
                "start_time": "07:00",
                "instructor": "陈老师",
                "member_no": "M003",
                "member_name": "王五",
                "phone": "13800138003",
                "waitlist_order": 1,
                "status": "等待候补",
                "apply_time": "2024-05-18 08:00:00",
                "confirm_deadline": "2024-05-20 18:00:00",
                "operator": "前台小李",
                "quota_source": ""
            },
            {
                "waitlist_no": "WL20240518004",
                "class_name": "",
                "class_date": "2024-05-21",
                "start_time": "10:00",
                "instructor": "赵老师",
                "member_no": "M004",
                "member_name": "",
                "phone": "13800138004",
                "waitlist_order": 2,
                "status": "已确认转正",
                "apply_time": "2024-05-18 09:00:00",
                "confirm_deadline": "",
                "operator": "",
                "quota_source": ""
            },
            {
                "waitlist_no": "WL20240518005",
                "class_name": "修复瑜伽",
                "class_date": "2024-05-22",
                "start_time": "15:00",
                "instructor": "孙老师",
                "member_no": "M005",
                "member_name": "钱七",
                "phone": "13800138005",
                "waitlist_order": 3,
                "status": "已取消",
                "apply_time": "2024-05-18 10:00:00",
                "confirm_deadline": "2024-05-21 18:00:00",
                "operator": "前台小张",
                "quota_source": "候补顺序应为1，存在不一致"
            }
        ]
