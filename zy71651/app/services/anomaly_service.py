from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session

from ..models import (
    Anomaly,
    AnomalyType,
    AnomalySeverity,
    EstimationTask,
)
from ..schemas import AnomalyResponse

ANOMALY_MESSAGES: Dict[AnomalyType, Dict[str, str]] = {
    AnomalyType.MESH_BROKEN_FACES: {
        "title": "模型存在破面",
        "description": "检测到模型中有 {count} 个破损的面，这会导致支撑计算不准确和打印失败。",
        "suggestion": "请使用建模软件修复破面，或使用网格修复工具（如Meshmixer、Blender的3D打印工具箱）进行自动修复。",
    },
    AnomalyType.MESH_NON_MANIFOLD: {
        "title": "模型存在非流形边",
        "description": "检测到 {count} 条非流形边，这会导致切片软件无法正确处理模型。",
        "suggestion": "在建模软件中检查并合并重复顶点，删除内部面，确保模型是完全闭合的实体。",
    },
    AnomalyType.MESH_SELF_INTERSECTING: {
        "title": "模型存在自相交",
        "description": "检测到 {count} 处自相交，这会导致切片错误和支撑生成失败。",
        "suggestion": "检查模型中是否有面相互穿透，使用布尔运算合并相交部分。",
    },
    AnomalyType.MESH_DUPLICATE_FACES: {
        "title": "模型存在重复面",
        "description": "检测到 {count} 个重复面，这会增加切片时间并可能导致打印问题。",
        "suggestion": "使用建模软件的去除重复面功能清理模型。",
    },
    AnomalyType.SUPPORT_DUPLICATE: {
        "title": "存在重复支撑",
        "description": "检测到同一区域生成了多重支撑，这会浪费材料并增加打印时间。",
        "suggestion": "调整支撑密度和临界角参数，或在切片软件中手动编辑去除重复支撑。",
    },
    AnomalyType.SUPPORT_INSUFFICIENT: {
        "title": "支撑可能不足",
        "description": "检测到 {area:.2f} mm² 的大角度悬垂区域支撑不足，打印时可能会塌陷。",
        "suggestion": "减小支撑临界角（建议45°以下），增加支撑密度，或拆分模型为多个部分打印。",
    },
    AnomalyType.TIME_UNDERESTIMATED: {
        "title": "打印时间可能被低估",
        "description": "根据模型复杂度分析，实际打印时间可能比估算值多 {percent:.1f}%。",
        "suggestion": "预留额外的打印时间缓冲，建议增加 {extra_min:.0f} 分钟。实际时间还受打印机状态、材料特性影响。",
    },
    AnomalyType.MATERIAL_INSUFFICIENT: {
        "title": "材料可能不足",
        "description": "估算需要 {needed:.2f} g 材料，但当前材料可能不足以完成打印。",
        "suggestion": "请确认耗材重量足够，建议准备至少 {needed:.2f} g 的材料（含10%余量）。",
    },
    AnomalyType.PARAMS_INCOMPLETE: {
        "title": "切片参数不完整",
        "description": "缺少 {missing} 参数，估算结果可能不准确。",
        "suggestion": "请补充完整的切片参数，包括层高、打印速度、填充密度等关键参数。",
    },
    AnomalyType.MODEL_CORRUPTED: {
        "title": "模型文件损坏",
        "description": "无法正确解析模型文件，可能是文件损坏或格式不支持。",
        "suggestion": "请检查文件是否完整，尝试用其他软件打开验证，或重新导出模型文件。",
    },
}


class AnomalyService:
    @staticmethod
    def create_anomaly(
        db: Session,
        task_id: int,
        anomaly_type: AnomalyType,
        severity: AnomalySeverity,
        format_params: Optional[Dict[str, Any]] = None,
        location: Optional[str] = None,
        affected_value: Optional[float] = None,
        expected_range: Optional[str] = None,
        data_source: Optional[str] = None,
        params_version: Optional[int] = None,
        analysis_result_id: Optional[int] = None,
        estimation_id: Optional[int] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Anomaly:
        format_params = format_params or {}
        messages = ANOMALY_MESSAGES.get(anomaly_type, {
            "title": anomaly_type.value,
            "description": "检测到异常情况。",
            "suggestion": "请检查相关数据。",
        })

        anomaly = Anomaly(
            task_id=task_id,
            anomaly_type=anomaly_type.value,
            severity=severity.value,
            title=messages["title"],
            description=messages["description"].format(**format_params),
            suggestion=messages["suggestion"].format(**format_params),
            location=location,
            affected_value=affected_value,
            expected_range=expected_range,
            data_source=data_source,
            params_version=params_version,
            analysis_result_id=analysis_result_id,
            estimation_id=estimation_id,
            meta_data=metadata or {},
        )
        db.add(anomaly)
        db.flush()
        return anomaly

    @staticmethod
    def get_task_anomalies(
        db: Session,
        task_id: int,
        severity: Optional[AnomalySeverity] = None,
        include_resolved: bool = False,
    ) -> List[Anomaly]:
        query = db.query(Anomaly).filter(Anomaly.task_id == task_id)
        if severity:
            query = query.filter(Anomaly.severity == severity.value)
        if not include_resolved:
            query = query.filter(Anomaly.is_resolved == False)
        return query.order_by(Anomaly.created_at.desc()).all()

    @staticmethod
    def resolve_anomaly(
        db: Session,
        anomaly_id: int,
        resolution_notes: Optional[str] = None,
    ) -> Optional[Anomaly]:
        anomaly = db.query(Anomaly).filter(Anomaly.id == anomaly_id).first()
        if anomaly:
            anomaly.is_resolved = True
            anomaly.resolution_notes = resolution_notes
            db.flush()
        return anomaly

    @staticmethod
    def count_by_severity(anomalies: List[Anomaly]) -> Dict[str, int]:
        counts = {s.value: 0 for s in AnomalySeverity}
        for a in anomalies:
            if not a.is_resolved:
                counts[a.severity] = counts.get(a.severity, 0) + 1
        return counts

    @staticmethod
    def to_response(anomaly: Anomaly) -> AnomalyResponse:
        return AnomalyResponse(
            id=anomaly.id,
            task_id=anomaly.task_id,
            anomaly_type=AnomalyType(anomaly.anomaly_type),
            severity=AnomalySeverity(anomaly.severity),
            title=anomaly.title,
            description=anomaly.description,
            suggestion=anomaly.suggestion,
            location=anomaly.location,
            affected_value=anomaly.affected_value,
            expected_range=anomaly.expected_range,
            data_source=anomaly.data_source,
            params_version=anomaly.params_version,
            analysis_result_id=anomaly.analysis_result_id,
            estimation_id=anomaly.estimation_id,
            is_resolved=anomaly.is_resolved,
            resolution_notes=anomaly.resolution_notes,
            metadata=anomaly.meta_data or {},
            created_at=anomaly.created_at,
            updated_at=anomaly.updated_at,
        )
