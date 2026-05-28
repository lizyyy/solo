import csv
import json
from pathlib import Path
from typing import Union
from delivery_cluster.models import Order, Rider, RoadEdge, Bridge, CapacityConfig, Node


class ImportError(Exception):
    def __init__(self, message: str, file_path: str = None, line_number: int = None):
        self.file_path = file_path
        self.line_number = line_number
        location = ""
        if file_path:
            location = f"（文件: {file_path}"
            if line_number:
                location += f", 第 {line_number} 行"
            location += "）"
        super().__init__(f"{message}{location}")


class ImportResult:
    def __init__(self):
        self.items: list = []
        self.errors: list = []
        self.warnings: list = []

    @property
    def success(self) -> bool:
        return len(self.errors) == 0

    def add_error(self, message: str, line_number: int = None, row_data: dict = None):
        self.errors.append({
            "message": message,
            "line_number": line_number,
            "row_data": row_data,
        })

    def add_warning(self, message: str, line_number: int = None, row_data: dict = None):
        self.warnings.append({
            "message": message,
            "line_number": line_number,
            "row_data": row_data,
        })


def _safe_float(value, field_name: str, line_number: int = None) -> float:
    try:
        return float(value)
    except (ValueError, TypeError):
        raise ImportError(
            f"字段 '{field_name}' 值 '{value}' 无法转为数字",
            line_number=line_number,
        )


def import_orders(file_path: Union[str, Path]) -> ImportResult:
    result = ImportResult()
    file_path = str(file_path)
    path = Path(file_path)

    if not path.exists():
        result.add_error(f"文件不存在: {file_path}")
        return result

    suffix = path.suffix.lower()

    if suffix == ".csv":
        _import_orders_csv(file_path, result)
    elif suffix == ".json":
        _import_orders_json(file_path, result)
    else:
        result.add_error(f"不支持的文件格式: {suffix}，仅支持 .csv 和 .json")

    return result


def _import_orders_csv(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames:
                result.add_error("CSV 文件为空或缺少表头", line_number=1)
                return

            required = {"id", "lat", "lng"}
            missing = required - set(reader.fieldnames)
            if missing:
                result.add_error(f"CSV 缺少必要字段: {missing}", line_number=1)
                return

            for line_num, row in enumerate(reader, start=2):
                try:
                    order = Order(
                        id=str(row["id"]).strip(),
                        lat=_safe_float(row["lat"], "lat", line_num),
                        lng=_safe_float(row["lng"], "lng", line_num),
                        timestamp=row.get("timestamp", "").strip() or None,
                        weight=_safe_float(row.get("weight", 1.0), "weight", line_num),
                        source_file=file_path,
                        source_line=line_num,
                    )
                    result.items.append(order)
                except (ValueError, ImportError) as e:
                    result.add_error(str(e), line_number=line_num, row_data=dict(row))

    except UnicodeDecodeError:
        result.add_error(f"文件编码错误，请使用 UTF-8 编码: {file_path}")
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")


def _import_orders_json(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"JSON 解析失败: {e}")
        return
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")
        return

    if not isinstance(data, list):
        result.add_error("JSON 根元素必须是数组")
        return

    for idx, item in enumerate(data):
        line_num = idx + 1
        try:
            if not isinstance(item, dict):
                result.add_error(f"第 {line_num} 项不是对象", line_number=line_num)
                continue
            required = {"id", "lat", "lng"}
            missing = required - set(item.keys())
            if missing:
                result.add_error(f"第 {line_num} 项缺少字段: {missing}", line_number=line_num)
                continue

            order = Order(
                id=str(item["id"]),
                lat=float(item["lat"]),
                lng=float(item["lng"]),
                timestamp=item.get("timestamp"),
                weight=float(item.get("weight", 1.0)),
                source_file=file_path,
                source_line=line_num,
            )
            result.items.append(order)
        except (ValueError, TypeError) as e:
            result.add_error(str(e), line_number=line_num, row_data=item)


def import_riders(file_path: Union[str, Path]) -> ImportResult:
    result = ImportResult()
    file_path = str(file_path)
    path = Path(file_path)

    if not path.exists():
        result.add_error(f"文件不存在: {file_path}")
        return result

    suffix = path.suffix.lower()

    if suffix == ".csv":
        _import_riders_csv(file_path, result)
    elif suffix == ".json":
        _import_riders_json(file_path, result)
    else:
        result.add_error(f"不支持的文件格式: {suffix}")

    return result


def _import_riders_csv(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            required = {"id", "lat", "lng"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                result.add_error(f"CSV 缺少必要字段: {missing}", line_number=1)
                return

            for line_num, row in enumerate(reader, start=2):
                try:
                    rider = Rider(
                        id=str(row["id"]).strip(),
                        lat=_safe_float(row["lat"], "lat", line_num),
                        lng=_safe_float(row["lng"], "lng", line_num),
                        capacity=_safe_float(row.get("capacity", 50.0), "capacity", line_num),
                        source_file=file_path,
                        source_line=line_num,
                    )
                    result.items.append(rider)
                except (ValueError, ImportError) as e:
                    result.add_error(str(e), line_number=line_num, row_data=dict(row))
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")


def _import_riders_json(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"JSON 解析失败: {e}")
        return

    if not isinstance(data, list):
        result.add_error("JSON 根元素必须是数组")
        return

    for idx, item in enumerate(data):
        line_num = idx + 1
        try:
            rider = Rider(
                id=str(item["id"]),
                lat=float(item["lat"]),
                lng=float(item["lng"]),
                capacity=float(item.get("capacity", 50.0)),
                source_file=file_path,
                source_line=line_num,
            )
            result.items.append(rider)
        except (ValueError, TypeError) as e:
            result.add_error(str(e), line_number=line_num, row_data=item)


def import_road_network(file_path: Union[str, Path]) -> ImportResult:
    result = ImportResult()
    file_path = str(file_path)
    path = Path(file_path)

    if not path.exists():
        result.add_error(f"文件不存在: {file_path}")
        return result

    suffix = path.suffix.lower()

    if suffix == ".csv":
        _import_roads_csv(file_path, result)
    elif suffix == ".json":
        _import_roads_json(file_path, result)
    else:
        result.add_error(f"不支持的文件格式: {suffix}")

    return result


def _import_roads_csv(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            required = {"from_node", "to_node", "distance_m"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                result.add_error(f"CSV 缺少必要字段: {missing}", line_number=1)
                return

            for line_num, row in enumerate(reader, start=2):
                try:
                    has_bridge_str = row.get("has_bridge", "false").strip().lower()
                    edge = RoadEdge(
                        from_node=str(row["from_node"]).strip(),
                        to_node=str(row["to_node"]).strip(),
                        distance_m=_safe_float(row["distance_m"], "distance_m", line_num),
                        has_bridge=has_bridge_str in ("true", "1", "yes"),
                        bridge_id=row.get("bridge_id", "").strip() or None,
                        source_file=file_path,
                        source_line=line_num,
                    )
                    if edge.distance_m == 0:
                        result.add_warning(
                            f"路段 {edge.from_node}->{edge.to_node} 距离为 0",
                            line_number=line_num,
                        )
                    result.items.append(edge)
                except (ValueError, ImportError) as e:
                    result.add_error(str(e), line_number=line_num, row_data=dict(row))
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")


def _import_roads_json(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"JSON 解析失败: {e}")
        return

    edges = data.get("edges", data) if isinstance(data, dict) else data
    if not isinstance(edges, list):
        result.add_error("路网数据必须是边数组或包含 'edges' 字段的对象")
        return

    for idx, item in enumerate(edges):
        line_num = idx + 1
        try:
            edge = RoadEdge(
                from_node=str(item["from_node"]),
                to_node=str(item["to_node"]),
                distance_m=float(item["distance_m"]),
                has_bridge=bool(item.get("has_bridge", False)),
                bridge_id=item.get("bridge_id"),
                source_file=file_path,
                source_line=line_num,
            )
            result.items.append(edge)
        except (ValueError, TypeError, KeyError) as e:
            result.add_error(str(e), line_number=line_num, row_data=item)


def import_bridges(file_path: Union[str, Path]) -> ImportResult:
    result = ImportResult()
    file_path = str(file_path)
    path = Path(file_path)

    if not path.exists():
        result.add_error(f"文件不存在: {file_path}")
        return result

    suffix = path.suffix.lower()

    if suffix == ".csv":
        _import_bridges_csv(file_path, result)
    elif suffix == ".json":
        _import_bridges_json(file_path, result)
    else:
        result.add_error(f"不支持的文件格式: {suffix}")

    return result


def _import_bridges_csv(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            required = {"id", "lat", "lng"}
            missing = required - set(reader.fieldnames or [])
            if missing:
                result.add_error(f"CSV 缺少必要字段: {missing}", line_number=1)
                return

            for line_num, row in enumerate(reader, start=2):
                try:
                    bridge = Bridge(
                        id=str(row["id"]).strip(),
                        name=row.get("name", "").strip() or f"桥梁_{row['id']}",
                        lat=_safe_float(row["lat"], "lat", line_num),
                        lng=_safe_float(row["lng"], "lng", line_num),
                        detour_penalty_m=_safe_float(
                            row.get("detour_penalty_m", 0), "detour_penalty_m", line_num
                        ),
                        source_file=file_path,
                        source_line=line_num,
                    )
                    result.items.append(bridge)
                except (ValueError, ImportError) as e:
                    result.add_error(str(e), line_number=line_num, row_data=dict(row))
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")


def _import_bridges_json(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"JSON 解析失败: {e}")
        return

    if not isinstance(data, list):
        result.add_error("JSON 根元素必须是数组")
        return

    for idx, item in enumerate(data):
        line_num = idx + 1
        try:
            bridge = Bridge(
                id=str(item["id"]),
                name=item.get("name", f"桥梁_{item['id']}"),
                lat=float(item["lat"]),
                lng=float(item["lng"]),
                detour_penalty_m=float(item.get("detour_penalty_m", 0)),
                source_file=file_path,
                source_line=line_num,
            )
            result.items.append(bridge)
        except (ValueError, TypeError, KeyError) as e:
            result.add_error(str(e), line_number=line_num, row_data=item)


def import_nodes(file_path: Union[str, Path]) -> ImportResult:
    result = ImportResult()
    file_path = str(file_path)
    path = Path(file_path)

    if not path.exists():
        result.add_error(f"文件不存在: {file_path}")
        return result

    suffix = path.suffix.lower()

    if suffix == ".csv":
        _import_nodes_csv(file_path, result)
    elif suffix == ".json":
        _import_nodes_json(file_path, result)
    else:
        result.add_error(f"不支持的文件格式: {suffix}")

    return result


def _import_nodes_csv(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    node = Node(
                        id=str(row["id"]).strip(),
                        lat=_safe_float(row["lat"], "lat", line_num),
                        lng=_safe_float(row["lng"], "lng", line_num),
                    )
                    result.items.append(node)
                except (ValueError, ImportError) as e:
                    result.add_error(str(e), line_number=line_num, row_data=dict(row))
    except Exception as e:
        result.add_error(f"读取文件失败: {e}")


def _import_nodes_json(file_path: str, result: ImportResult):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.add_error(f"JSON 解析失败: {e}")
        return

    for idx, item in enumerate(data):
        try:
            node = Node(
                id=str(item["id"]),
                lat=float(item["lat"]),
                lng=float(item["lng"]),
            )
            result.items.append(node)
        except (ValueError, TypeError, KeyError) as e:
            result.add_error(str(e), line_number=idx + 1, row_data=item)


def import_capacity_config(file_path: Union[str, Path]) -> CapacityConfig:
    path = Path(str(file_path))

    if not path.exists():
        return CapacityConfig()

    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ImportError(f"容量配置 JSON 解析失败: {e}", file_path=str(path))
    except Exception as e:
        raise ImportError(f"读取容量配置失败: {e}", file_path=str(path))

    return CapacityConfig(
        max_orders_per_zone=int(data.get("max_orders_per_zone", 60)),
        max_weight_per_zone=float(data.get("max_weight_per_zone", 300.0)),
        max_radius_m=float(data.get("max_radius_m", 3000.0)),
        straight_line_ratio_threshold=float(data.get("straight_line_ratio_threshold", 0.65)),
        min_distance_diff_m=float(data.get("min_distance_diff_m", 200.0)),
        bridge_detour_threshold_m=float(data.get("bridge_detour_threshold_m", 500.0)),
    )
