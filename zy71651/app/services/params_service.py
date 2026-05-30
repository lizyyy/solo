from typing import Optional, Dict, Any, List, Tuple
from sqlalchemy.orm import Session

from ..models import (
    SliceParamsVersion,
    EstimationTask,
    Material,
    TaskStatus,
)
from ..schemas import (
    SliceParamsCreate,
    SliceParamsUpdate,
    ParamsMergeRequest,
    ParamsMergeResponse,
    SliceParamsResponse,
)
from ..config import settings
from .status_service import StatusService
from .anomaly_service import AnomalyService
from ..models.enums import AnomalyType, AnomalySeverity

PARAM_FIELDS = [
    "layer_height",
    "nozzle_diameter",
    "print_speed",
    "infill_density",
    "infill_pattern",
    "wall_thickness",
    "top_bottom_layers",
    "support_enabled",
    "support_type",
    "support_density",
    "support_angle",
    "bed_temperature",
    "nozzle_temperature",
    "cooling_enabled",
    "material_id",
]

REQUIRED_PARAMS = [
    "layer_height",
    "nozzle_diameter",
    "print_speed",
    "infill_density",
]

DEFAULT_PARAMS = {
    "layer_height": 0.2,
    "nozzle_diameter": settings.default_nozzle_diameter,
    "print_speed": settings.default_print_speed,
    "infill_density": settings.default_infill_density,
    "support_enabled": True,
    "support_angle": 45.0,
    "support_density": 15.0,
    "cooling_enabled": True,
}


class ParamsService:
    @staticmethod
    def get_latest_version(db: Session, task_id: int) -> Optional[SliceParamsVersion]:
        return (
            db.query(SliceParamsVersion)
            .filter(SliceParamsVersion.task_id == task_id)
            .order_by(SliceParamsVersion.version.desc())
            .first()
        )

    @staticmethod
    def get_version(db: Session, task_id: int, version: int) -> Optional[SliceParamsVersion]:
        return (
            db.query(SliceParamsVersion)
            .filter(
                SliceParamsVersion.task_id == task_id,
                SliceParamsVersion.version == version,
            )
            .first()
        )

    @staticmethod
    def get_all_versions(db: Session, task_id: int) -> List[SliceParamsVersion]:
        return (
            db.query(SliceParamsVersion)
            .filter(SliceParamsVersion.task_id == task_id)
            .order_by(SliceParamsVersion.version.desc())
            .all()
        )

    @staticmethod
    def _get_next_version(db: Session, task_id: int) -> int:
        latest = ParamsService.get_latest_version(db, task_id)
        return (latest.version + 1) if latest else 1

    @staticmethod
    def _compare_values(old: Any, new: Any) -> bool:
        if old is None and new is None:
            return True
        if old is None or new is None:
            return False
        return abs(float(old) - float(new)) < 0.001 if isinstance(old, (int, float)) and isinstance(new, (int, float)) else old == new

    @staticmethod
    def merge_params(
        db: Session,
        task: EstimationTask,
        request: ParamsMergeRequest,
    ) -> Tuple[SliceParamsVersion, ParamsMergeResponse]:
        latest = ParamsService.get_latest_version(db, request.task_id)
        next_version = ParamsService._get_next_version(db, request.task_id)

        updated_fields: List[str] = []
        preserved_fields: List[str] = []
        conflicts: List[Dict[str, Any]] = []

        params_dict = request.params

        if latest and not request.create_new_version:
            for field in PARAM_FIELDS:
                new_val = params_dict.get(field)
                old_val = getattr(latest, field) if latest else None

                if new_val is not None and not ParamsService._compare_values(old_val, new_val):
                    if old_val is not None:
                        conflicts.append({
                            "field": field,
                            "old_value": old_val,
                            "new_value": new_val,
                            "resolution": "保留原值，新值已记录但未覆盖",
                        })
                        preserved_fields.append(field)
                    else:
                        setattr(latest, field, new_val)
                        updated_fields.append(field)
                elif new_val is None and old_val is None:
                    pass
                else:
                    preserved_fields.append(field)

            latest.source = f"{latest.source}+{request.source}" if latest.source else request.source
            if request.notes:
                latest.notes = f"{latest.notes}; {request.notes}" if latest.notes else request.notes

            result_params = latest
            is_new = False
            version = latest.version
        else:
            new_params = SliceParamsVersion(
                task_id=request.task_id,
                version=next_version,
                source=request.source,
                notes=request.notes,
                extra_params={},
            )

            for field in PARAM_FIELDS:
                new_val = params_dict.get(field)
                old_val = getattr(latest, field) if latest else None

                if new_val is not None:
                    setattr(new_params, field, new_val)
                    updated_fields.append(field)
                    if old_val is not None and not ParamsService._compare_values(old_val, new_val):
                        conflicts.append({
                            "field": field,
                            "old_value": old_val,
                            "new_value": new_val,
                            "resolution": "创建新版本，新旧值均保留",
                        })
                elif latest is not None and old_val is not None:
                    setattr(new_params, field, old_val)
                    preserved_fields.append(field)
                else:
                    default_val = DEFAULT_PARAMS.get(field)
                    if default_val is not None:
                        setattr(new_params, field, default_val)
                        preserved_fields.append(field)

            db.add(new_params)
            result_params = new_params
            is_new = True
            version = next_version

        db.flush()

        missing_params = [
            p for p in REQUIRED_PARAMS
            if getattr(result_params, p) is None
        ]
        if missing_params:
            AnomalyService.create_anomaly(
                db=db,
                task_id=task.id,
                anomaly_type=AnomalyType.PARAMS_INCOMPLETE,
                severity=AnomalySeverity.WARNING,
                format_params={"missing": "、".join(missing_params)},
                data_source=f"params_service:v{version}",
                params_version=version,
            )

        task.current_params_version = version
        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.PARAMS_RECEIVED.value,
            message=f"参数版本 v{version} 已{'创建' if is_new else '更新'}",
            triggered_by="params_service",
            metadata={
                "updated_fields": updated_fields,
                "preserved_fields": preserved_fields,
                "conflicts": conflicts,
            },
        )

        response = ParamsMergeResponse(
            task_id=request.task_id,
            version=version,
            is_new_version=is_new,
            updated_fields=updated_fields,
            preserved_fields=preserved_fields,
            conflicts=conflicts,
        )

        return result_params, response

    @staticmethod
    def create_params(
        db: Session,
        task: EstimationTask,
        params: SliceParamsCreate,
    ) -> SliceParamsVersion:
        version = ParamsService._get_next_version(db, params.task_id)
        new_params = SliceParamsVersion(
            **params.model_dump(exclude_unset=True),
            version=version,
        )
        db.add(new_params)
        db.flush()

        task.current_params_version = version
        StatusService.transition(
            db=db,
            task=task,
            target_status=TaskStatus.PARAMS_RECEIVED.value,
            message=f"参数版本 v{version} 已创建",
            triggered_by="params_service",
        )

        return new_params

    @staticmethod
    def to_response(
        db: Session,
        params: SliceParamsVersion,
    ) -> SliceParamsResponse:
        material = db.query(Material).filter(Material.id == params.material_id).first() if params.material_id else None
        return SliceParamsResponse(
            id=params.id,
            task_id=params.task_id,
            version=params.version,
            layer_height=params.layer_height,
            nozzle_diameter=params.nozzle_diameter,
            print_speed=params.print_speed,
            infill_density=params.infill_density,
            infill_pattern=params.infill_pattern,
            wall_thickness=params.wall_thickness,
            top_bottom_layers=params.top_bottom_layers,
            support_enabled=params.support_enabled,
            support_type=params.support_type,
            support_density=params.support_density,
            support_angle=params.support_angle,
            bed_temperature=params.bed_temperature,
            nozzle_temperature=params.nozzle_temperature,
            cooling_enabled=params.cooling_enabled,
            material_id=params.material_id,
            material_name=material.name if material else None,
            material_type=material.material_type if material else None,
            extra_params=params.extra_params or {},
            source=params.source,
            notes=params.notes,
            created_at=params.created_at,
            updated_at=params.updated_at,
        )

    @staticmethod
    def get_effective_params(
        db: Session,
        task_id: int,
        version: Optional[int] = None,
    ) -> Dict[str, Any]:
        if version:
            params = ParamsService.get_version(db, task_id, version)
        else:
            params = ParamsService.get_latest_version(db, task_id)

        if not params:
            return DEFAULT_PARAMS.copy()

        result = {}
        for field in PARAM_FIELDS:
            val = getattr(params, field)
            if val is not None:
                result[field] = val
            elif field in DEFAULT_PARAMS:
                result[field] = DEFAULT_PARAMS[field]

        return result
