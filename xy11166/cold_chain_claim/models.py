from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict


@dataclass
class ClaimRecord:
    claim_id: str
    warehouse_code: str
    claim_date: datetime
    carrier: str
    product_name: str
    batch_number: str
    temperature_anomaly: str
    temperature_min: float
    temperature_max: float
    anomaly_duration: float
    loss_amount: float
    claim_status: str
    handler: str
    remark: str = ""
    source_file: str = ""
    process_time: datetime = field(default_factory=datetime.now)

    def get_unique_key(self) -> str:
        return f"{self.claim_id}_{self.batch_number}_{self.warehouse_code}"

    def to_dict(self) -> Dict:
        return {
            "赔付单号": self.claim_id,
            "仓库编码": self.warehouse_code,
            "赔付日期": self.claim_date.strftime("%Y-%m-%d") if self.claim_date else "",
            "承运商": self.carrier,
            "商品名称": self.product_name,
            "批次号": self.batch_number,
            "温度异常类型": self.temperature_anomaly,
            "最低温度": self.temperature_min,
            "最高温度": self.temperature_max,
            "异常持续时长(小时)": self.anomaly_duration,
            "损失金额": self.loss_amount,
            "赔付状态": self.claim_status,
            "处理人": self.handler,
            "备注": self.remark,
            "来源文件": self.source_file,
            "处理时间": self.process_time.strftime("%Y-%m-%d %H:%M:%S"),
        }


@dataclass
class ProcessResult:
    success: bool
    records: List[ClaimRecord] = field(default_factory=list)
    failed_files: List[Dict] = field(default_factory=list)
    skipped_records: int = 0
    new_records: int = 0
    total_records: int = 0

    def add_failure(self, filename: str, error: str, line: Optional[int] = None):
        self.failed_files.append({
            "filename": filename,
            "error": error,
            "line": line,
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })
