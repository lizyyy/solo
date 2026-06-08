from datetime import date, datetime
from typing import Optional, List
from enum import Enum
from pydantic import BaseModel, Field


class ReconcileStatus(str, Enum):
    CONFIRMED = "已确认"
    PENDING_DOC = "待补件"
    REJECTED = "退回"
    PENDING = "待处理"


class AbnormalType(str, Enum):
    DATE_MISSING = "疫苗日期缺失"
    SUPPLEMENT_MISMATCH = "主人补充与旧记录不符"
    MANUAL_OVERRIDE = "人工改判"
    SCHEDULE_OFFSET = "排程偏移超期"


class BoardingRegister(BaseModel):
    reg_id: str = Field(description="寄养登记表ID")
    dog_name: str = Field(description="犬只名称")
    owner_name: str = Field(description="主人姓名")
    owner_phone: str = Field(description="主人联系电话")
    checkin_date: date = Field(description="入住日期")
    checkout_date: Optional[date] = Field(None, description="预计离店日期")
    vaccine_last_date: Optional[date] = Field(None, description="旧记录-上次疫苗日期")
    vaccine_next_due: Optional[date] = Field(None, description="旧记录-下次应接种日期")
    vaccine_type_old: Optional[str] = Field(None, description="旧记录-疫苗种类")
    owner_supplement: Optional[str] = Field(None, description="主人临时补充信息原话")
    supplement_vaccine_date: Optional[date] = Field(None, description="主人补充-疫苗日期")
    supplement_vaccine_type: Optional[str] = Field(None, description="主人补充-疫苗种类")
    remark: Optional[str] = Field(None, description="备注")
    created_at: datetime = Field(default_factory=datetime.now, description="登记时间")
    created_by: str = Field(description="登记人")


class VaccineSchedule(BaseModel):
    schedule_id: str = Field(description="排程ID")
    reg_id: str = Field(description="关联寄养登记表ID")
    dog_name: str = Field(description="犬只名称")
    plan_date: Optional[date] = Field(None, description="计划接种日期")
    actual_date: Optional[date] = Field(None, description="实际接种日期")
    vaccine_type: Optional[str] = Field(None, description="疫苗种类")
    source: str = Field(description="数据来源：旧记录/主人补充/人工改判")
    source_line_no: Optional[int] = Field(None, description="来源登记行号")
    created_at: datetime = Field(default_factory=datetime.now)


class ReconcileItem(BaseModel):
    reconcile_id: str = Field(description="对账ID")
    reg_id: str = Field(description="寄养登记表ID")
    schedule_id: Optional[str] = Field(None, description="关联排程ID")
    dog_name: str = Field(description="犬只名称")
    owner_name: str = Field(description="主人姓名")
    status: ReconcileStatus = Field(default=ReconcileStatus.PENDING, description="对账状态")
    abnormal_types: List[AbnormalType] = Field(default_factory=list, description="异常类型集合")
    old_vaccine_date: Optional[date] = Field(None, description="旧记录疫苗日期")
    supplement_vaccine_date: Optional[date] = Field(None, description="主人补充疫苗日期")
    final_vaccine_date: Optional[date] = Field(None, description="最终认定疫苗日期")
    impact_scope: str = Field(description="影响范围说明")
    source_lines: List[str] = Field(default_factory=list, description="来源登记行（登记表原话引用）")
    owner_supplement_raw: Optional[str] = Field(None, description="主人临时补充原话")
    manual_override_flag: bool = Field(default=False, description="是否人工改判")
    override_reason: Optional[str] = Field(None, description="改判理由")
    handler: Optional[str] = Field(None, description="处理人")
    handled_at: Optional[datetime] = Field(None, description="处理时间")
    reconcile_month: str = Field(description="对账月份 YYYY-MM")


class AbnormalQueueItem(BaseModel):
    queue_id: str = Field(description="异常队列ID")
    reconcile_id: str = Field(description="对账ID")
    reg_id: str = Field(description="寄养登记表ID")
    dog_name: str = Field(description="犬只名称")
    status: ReconcileStatus = Field(description="状态（与对账明细一致）")
    abnormal_types: List[AbnormalType] = Field(description="异常类型")
    summary: str = Field(description="异常摘要")
    owner_supplement_raw: Optional[str] = Field(None, description="主人补充原话")
    source_register_ref: str = Field(description="来源登记表定位：ID+行号")
    impact_scope: str = Field(description="影响范围")
    created_at: datetime = Field(default_factory=datetime.now)
