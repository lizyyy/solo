"""CSV解析器

支持货品参数、车辆配置、装车计划的CSV文件解析和校验。
"""

import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, TypeVar, Type
from pydantic import ValidationError

from pre_cool_validator.models import (
    ProductParams,
    VehicleConfig,
    BatchItem,
    LoadingPlan,
    ProjectConfig,
)


T = TypeVar('T')


class CSVParseError(Exception):
    """CSV解析错误"""
    def __init__(self, message: str, row: int = 0, column: str = ""):
        self.row = row
        self.column = column
        super().__init__(f"行 {row}, 列 {column}: {message}" if column else message)


class CSVParser:
    """CSV解析器基类"""

    REQUIRED_COLUMNS: List[str] = []
    OPTIONAL_COLUMNS: List[str] = []

    @classmethod
    def _validate_headers(cls, headers: List[str]) -> Tuple[bool, List[str]]:
        """验证CSV表头"""
        headers_lower = [h.strip().lower() for h in headers]
        required_lower = [c.lower() for c in cls.REQUIRED_COLUMNS]

        missing = []
        for req in required_lower:
            if req not in headers_lower:
                original_name = cls.REQUIRED_COLUMNS[required_lower.index(req)]
                missing.append(original_name)

        return len(missing) == 0, missing

    @classmethod
    def _parse_value(cls, value: str, expected_type: type) -> Any:
        """解析值为指定类型"""
        value = value.strip() if value else ""
        if not value:
            return None

        if expected_type is float:
            try:
                return float(value.replace(',', ''))
            except ValueError:
                raise ValueError(f"无法将 '{value}' 转换为浮点数")

        if expected_type is int:
            try:
                return int(float(value.replace(',', '')))
            except ValueError:
                raise ValueError(f"无法将 '{value}' 转换为整数")

        if expected_type is bool:
            lower_val = value.lower()
            if lower_val in ['1', 'true', 'yes', '是', '有']:
                return True
            elif lower_val in ['0', 'false', 'no', '否', '无']:
                return False
            raise ValueError(f"无法将 '{value}' 转换为布尔值")

        return value

    @classmethod
    def _row_to_dict(cls, headers: List[str], row: List[str]) -> Dict[str, str]:
        """将行数据转换为字典"""
        return {
            headers[i].strip().lower(): row[i].strip() if i < len(row) else ""
            for i in range(len(headers))
        }


class ProductParamsCSVParser(CSVParser):
    """货品参数CSV解析器"""

    REQUIRED_COLUMNS = [
        "product_id", "product_name", "specific_heat", "density",
        "default_target_temp", "max_precool_time"
    ]
    OPTIONAL_COLUMNS = [
        "heat_transfer_coeff", "respiration_rate", "notes"
    ]

    @classmethod
    def parse(cls, file_path: Path) -> List[ProductParams]:
        """解析货品参数CSV文件"""
        products = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, [])

            valid, missing = cls._validate_headers(headers)
            if not valid:
                raise CSVParseError(f"缺少必需列: {', '.join(missing)}")

            header_map = {h.strip().lower(): i for i, h in enumerate(headers)}

            for row_num, row in enumerate(reader, start=2):
                if not row or all(cell.strip() == '' for cell in row):
                    continue

                try:
                    row_dict = cls._row_to_dict(headers, row)

                    product = ProductParams(
                        product_id=row_dict.get('product_id', ''),
                        product_name=row_dict.get('product_name', ''),
                        specific_heat=cls._parse_value(row_dict.get('specific_heat', '0'), float),
                        density=cls._parse_value(row_dict.get('density', '0'), float),
                        default_target_temp=cls._parse_value(row_dict.get('default_target_temp', '0'), float),
                        max_precool_time=cls._parse_value(row_dict.get('max_precool_time', '0'), int),
                        heat_transfer_coeff=cls._parse_value(
                            row_dict.get('heat_transfer_coeff', '10.0'), float
                        ) if row_dict.get('heat_transfer_coeff') else 10.0,
                        respiration_rate=cls._parse_value(
                            row_dict.get('respiration_rate', '0.0'), float
                        ) if row_dict.get('respiration_rate') else 0.0,
                        notes=row_dict.get('notes'),
                    )
                    products.append(product)

                except (ValueError, ValidationError) as e:
                    raise CSVParseError(str(e), row=row_num)

        return products

    @classmethod
    def export(cls, products: List[ProductParams], file_path: Path) -> None:
        """导出货品参数到CSV文件"""
        headers = [
            "product_id", "product_name", "specific_heat", "density",
            "default_target_temp", "max_precool_time", "heat_transfer_coeff",
            "respiration_rate", "notes"
        ]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for p in products:
                writer.writerow([
                    p.product_id,
                    p.product_name,
                    p.specific_heat,
                    p.density,
                    p.default_target_temp,
                    p.max_precool_time,
                    p.heat_transfer_coeff,
                    p.respiration_rate,
                    p.notes or "",
                ])


class VehicleConfigCSVParser(CSVParser):
    """车辆配置CSV解析器"""

    REQUIRED_COLUMNS = [
        "vehicle_id", "vehicle_name", "cargo_volume", "cargo_surface_area",
        "insulation_k", "cooling_capacity", "fan_airflow", "door_area"
    ]
    OPTIONAL_COLUMNS = [
        "ambient_temp_standard", "max_door_open_duration", "notes"
    ]

    @classmethod
    def parse(cls, file_path: Path) -> List[VehicleConfig]:
        """解析车辆配置CSV文件"""
        vehicles = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, [])

            valid, missing = cls._validate_headers(headers)
            if not valid:
                raise CSVParseError(f"缺少必需列: {', '.join(missing)}")

            for row_num, row in enumerate(reader, start=2):
                if not row or all(cell.strip() == '' for cell in row):
                    continue

                try:
                    row_dict = cls._row_to_dict(headers, row)

                    vehicle = VehicleConfig(
                        vehicle_id=row_dict.get('vehicle_id', ''),
                        vehicle_name=row_dict.get('vehicle_name', ''),
                        cargo_volume=cls._parse_value(row_dict.get('cargo_volume', '0'), float),
                        cargo_surface_area=cls._parse_value(row_dict.get('cargo_surface_area', '0'), float),
                        insulation_k=cls._parse_value(row_dict.get('insulation_k', '0'), float),
                        cooling_capacity=cls._parse_value(row_dict.get('cooling_capacity', '0'), float),
                        fan_airflow=cls._parse_value(row_dict.get('fan_airflow', '0'), float),
                        door_area=cls._parse_value(row_dict.get('door_area', '0'), float),
                        ambient_temp_standard=cls._parse_value(
                            row_dict.get('ambient_temp_standard', '30.0'), float
                        ) if row_dict.get('ambient_temp_standard') else 30.0,
                        max_door_open_duration=cls._parse_value(
                            row_dict.get('max_door_open_duration', '30'), int
                        ) if row_dict.get('max_door_open_duration') else 30,
                        notes=row_dict.get('notes'),
                    )
                    vehicles.append(vehicle)

                except (ValueError, ValidationError) as e:
                    raise CSVParseError(str(e), row=row_num)

        return vehicles

    @classmethod
    def export(cls, vehicles: List[VehicleConfig], file_path: Path) -> None:
        """导出车辆配置到CSV文件"""
        headers = [
            "vehicle_id", "vehicle_name", "cargo_volume", "cargo_surface_area",
            "insulation_k", "cooling_capacity", "fan_airflow", "door_area",
            "ambient_temp_standard", "max_door_open_duration", "notes"
        ]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for v in vehicles:
                writer.writerow([
                    v.vehicle_id,
                    v.vehicle_name,
                    v.cargo_volume,
                    v.cargo_surface_area,
                    v.insulation_k,
                    v.cooling_capacity,
                    v.fan_airflow,
                    v.door_area,
                    v.ambient_temp_standard,
                    v.max_door_open_duration,
                    v.notes or "",
                ])


class LoadingPlanCSVParser(CSVParser):
    """装车计划CSV解析器"""

    REQUIRED_COLUMNS = [
        "plan_id", "vehicle_id", "ambient_temp", "total_precool_time",
        "door_open_duration", "batch_id", "product_id", "product_name",
        "volume", "mass", "initial_temp", "target_temp"
    ]
    OPTIONAL_COLUMNS = [
        "plan_name", "arrival_time", "deadline_time",
        "specific_heat_override", "notes"
    ]

    @classmethod
    def parse(cls, file_path: Path) -> LoadingPlan:
        """解析装车计划CSV文件
        
        注意：装车计划CSV需要包含计划信息和批次信息，
        计划信息在每一行重复，批次信息逐行变化。
        """
        batches: Dict[str, BatchItem] = {}
        plan_info: Optional[Dict[str, Any]] = None

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            headers = next(reader, [])

            valid, missing = cls._validate_headers(headers)
            if not valid:
                raise CSVParseError(f"缺少必需列: {', '.join(missing)}")

            for row_num, row in enumerate(reader, start=2):
                if not row or all(cell.strip() == '' for cell in row):
                    continue

                try:
                    row_dict = cls._row_to_dict(headers, row)

                    if plan_info is None:
                        plan_info = {
                            "plan_id": row_dict.get('plan_id', ''),
                            "plan_name": row_dict.get('plan_name'),
                            "vehicle_id": row_dict.get('vehicle_id', ''),
                            "ambient_temp": cls._parse_value(row_dict.get('ambient_temp', '0'), float),
                            "total_precool_time": cls._parse_value(
                                row_dict.get('total_precool_time', '0'), int
                            ),
                            "door_open_duration": cls._parse_value(
                                row_dict.get('door_open_duration', '0'), int
                            ),
                        }

                    batch_id = row_dict.get('batch_id', '')
                    if batch_id not in batches:
                        batch = BatchItem(
                            batch_id=batch_id,
                            product_id=row_dict.get('product_id', ''),
                            product_name=row_dict.get('product_name', ''),
                            volume=cls._parse_value(row_dict.get('volume', '0'), float),
                            mass=cls._parse_value(row_dict.get('mass', '0'), float),
                            initial_temp=cls._parse_value(row_dict.get('initial_temp', '0'), float),
                            target_temp=cls._parse_value(row_dict.get('target_temp', '0'), float),
                            arrival_time=cls._parse_value(
                                row_dict.get('arrival_time', '0'), int
                            ) if row_dict.get('arrival_time') else 0,
                            deadline_time=cls._parse_value(
                                row_dict.get('deadline_time', '0'), int
                            ) if row_dict.get('deadline_time') else None,
                            specific_heat_override=cls._parse_value(
                                row_dict.get('specific_heat_override', '0'), float
                            ) if row_dict.get('specific_heat_override') else None,
                            notes=row_dict.get('notes'),
                        )
                        batches[batch_id] = batch

                except (ValueError, ValidationError) as e:
                    raise CSVParseError(str(e), row=row_num)

        if plan_info is None:
            raise CSVParseError("CSV文件为空或格式不正确")

        return LoadingPlan(
            plan_id=plan_info["plan_id"],
            plan_name=plan_info.get("plan_name"),
            vehicle_id=plan_info["vehicle_id"],
            ambient_temp=plan_info["ambient_temp"],
            total_precool_time=plan_info["total_precool_time"],
            door_open_duration=plan_info["door_open_duration"],
            batches=list(batches.values()),
        )

    @classmethod
    def export(cls, plan: LoadingPlan, file_path: Path) -> None:
        """导出装车计划到CSV文件"""
        headers = [
            "plan_id", "plan_name", "vehicle_id", "ambient_temp",
            "total_precool_time", "door_open_duration",
            "batch_id", "product_id", "product_name",
            "volume", "mass", "initial_temp", "target_temp",
            "arrival_time", "deadline_time", "specific_heat_override", "notes"
        ]

        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(headers)

            for batch in plan.batches:
                writer.writerow([
                    plan.plan_id,
                    plan.plan_name or "",
                    plan.vehicle_id,
                    plan.ambient_temp,
                    plan.total_precool_time,
                    plan.door_open_duration,
                    batch.batch_id,
                    batch.product_id,
                    batch.product_name,
                    batch.volume,
                    batch.mass,
                    batch.initial_temp,
                    batch.target_temp,
                    batch.arrival_time,
                    batch.deadline_time or "",
                    batch.specific_heat_override or "",
                    batch.notes or "",
                ])


class ProjectConfigIO:
    """项目配置读写（JSON格式）"""

    @classmethod
    def load(cls, file_path: Path) -> ProjectConfig:
        """从JSON文件加载项目配置"""
        if not file_path.exists():
            return ProjectConfig()

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        products = {}
        for pid, pdata in data.get('products', {}).items():
            products[pid] = ProductParams(**pdata)

        vehicles = {}
        for vid, vdata in data.get('vehicles', {}).items():
            vehicles[vid] = VehicleConfig(**vdata)

        return ProjectConfig(
            products=products,
            vehicles=vehicles,
            version=data.get('version', '1.0'),
        )

    @classmethod
    def save(cls, config: ProjectConfig, file_path: Path) -> None:
        """保存项目配置到JSON文件"""
        data = {
            "version": config.version,
            "last_updated": config.last_updated.isoformat(),
            "products": {
                pid: p.model_dump() for pid, p in config.products.items()
            },
            "vehicles": {
                vid: v.model_dump() for vid, v in config.vehicles.items()
            },
        }

        file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)
