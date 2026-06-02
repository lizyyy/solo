import uuid
from datetime import datetime


class ParkingSpot:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", str(uuid.uuid4())[:8])
        self.点位名称 = kwargs.get("点位名称", "")
        self.路口名称 = kwargs.get("路口名称", "")
        self.地址 = kwargs.get("地址", "")
        self.经度 = kwargs.get("经度", 0.0)
        self.纬度 = kwargs.get("纬度", 0.0)
        self.时段 = kwargs.get("时段", "")
        self.容量 = kwargs.get("容量", 0)
        self.小区名称 = kwargs.get("小区名称", "")
        self.来源 = kwargs.get("来源", "")
        self.来源详情 = kwargs.get("来源详情", "")
        self.照片 = kwargs.get("照片", [])
        self.备注 = kwargs.get("备注", "")
        self.数据时段 = kwargs.get("数据时段", "")
        self.创建时间 = kwargs.get("创建时间", datetime.now().isoformat())
        self.更新时间 = kwargs.get("更新时间", datetime.now().isoformat())
        self.审核状态 = kwargs.get("审核状态", "待审核")
        self.来源批次 = kwargs.get("来源批次", "")
        self.补录备注 = kwargs.get("补录备注", "")
        self.补录时间 = kwargs.get("补录时间", "")

    def to_dict(self):
        return {
            "id": self.id,
            "点位名称": self.点位名称,
            "路口名称": self.路口名称,
            "地址": self.地址,
            "经度": self.经度,
            "纬度": self.纬度,
            "时段": self.时段,
            "容量": self.容量,
            "小区名称": self.小区名称,
            "来源": self.来源,
            "来源详情": self.来源详情,
            "照片": self.照片,
            "备注": self.备注,
            "数据时段": self.数据时段,
            "创建时间": self.创建时间,
            "更新时间": self.更新时间,
            "审核状态": self.审核状态,
            "来源批次": self.来源批次,
            "补录备注": self.补录备注,
            "补录时间": self.补录时间,
        }


class ApprovalRecord:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", str(uuid.uuid4())[:8])
        self.项目名称 = kwargs.get("项目名称", "")
        self.路口名称 = kwargs.get("路口名称", "")
        self.地址 = kwargs.get("地址", "")
        self.批准时段 = kwargs.get("批准时段", "")
        self.批准容量 = kwargs.get("批准容量", 0)
        self.审批日期 = kwargs.get("审批日期", "")
        self.审批文号 = kwargs.get("审批文号", "")
        self.备注 = kwargs.get("备注", "")
        self.数据时段 = kwargs.get("数据时段", "")

    def to_dict(self):
        return {
            "id": self.id,
            "项目名称": self.项目名称,
            "路口名称": self.路口名称,
            "地址": self.地址,
            "批准时段": self.批准时段,
            "批准容量": self.批准容量,
            "审批日期": self.审批日期,
            "审批文号": self.审批文号,
            "备注": self.备注,
            "数据时段": self.数据时段,
        }


class Conflict:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", str(uuid.uuid4())[:8])
        self.类型 = kwargs.get("类型", "")
        self.点位id = kwargs.get("点位id", "")
        self.台账id = kwargs.get("台账id", "")
        self.冲突描述 = kwargs.get("冲突描述", "")
        self.建议动作 = kwargs.get("建议动作", "")
        self.证据A = kwargs.get("证据A", {})
        self.证据B = kwargs.get("证据B", {})
        self.状态 = kwargs.get("状态", "待处理")
        self.创建时间 = kwargs.get("创建时间", datetime.now().isoformat())
        self.处理备注 = kwargs.get("处理备注", "")

    def to_dict(self):
        return {
            "id": self.id,
            "类型": self.类型,
            "点位id": self.点位id,
            "台账id": self.台账id,
            "冲突描述": self.冲突描述,
            "建议动作": self.建议动作,
            "证据A": self.证据A,
            "证据B": self.证据B,
            "状态": self.状态,
            "创建时间": self.创建时间,
            "处理备注": self.处理备注,
        }


class ReviewSnapshot:
    def __init__(self, **kwargs):
        self.id = kwargs.get("id", str(uuid.uuid4())[:8])
        self.时间戳 = kwargs.get("时间戳", datetime.now().isoformat())
        self.操作 = kwargs.get("操作", "")
        self.记录id = kwargs.get("记录id", "")
        self.记录类型 = kwargs.get("记录类型", "")
        self.变更前 = kwargs.get("变更前", {})
        self.变更后 = kwargs.get("变更后", {})
        self.操作人 = kwargs.get("操作人", "系统")

    def to_dict(self):
        return {
            "id": self.id,
            "时间戳": self.时间戳,
            "操作": self.操作,
            "记录id": self.记录id,
            "记录类型": self.记录类型,
            "变更前": self.变更前,
            "变更后": self.变更后,
            "操作人": self.操作人,
        }
