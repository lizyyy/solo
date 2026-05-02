"""CSV文件解析器"""

import csv
from pathlib import Path
from typing import Any, Optional

from ..models.frame import Frame, FrameEntry
from ..models.lens import LensEntry, LensInventory, LensStock
from ..models.prescription import Prescription, PrescriptionEntry


def parse_float(value: Any, default: Optional[float] = None) -> Optional[float]:
    """解析浮点数值"""
    if value is None or value == "":
        return default
    try:
        s = str(value).strip()
        if s == "":
            return default
        return float(s)
    except (ValueError, TypeError):
        return default


def parse_int(value: Any, default: Optional[int] = None) -> Optional[int]:
    """解析整数值"""
    if value is None or value == "":
        return default
    try:
        s = str(value).strip()
        if s == "":
            return default
        return int(float(s))
    except (ValueError, TypeError):
        return default


def parse_prescriptions_csv(file_path: Path) -> list[Prescription]:
    """解析处方CSV文件
    
    CSV格式要求：
    - 订单号(order_no)
    - 患者姓名(patient_name) - 可选
    - 右眼球镜(re_sphere)
    - 右眼柱镜(re_cylinder) - 可选，默认0.0
    - 右眼轴位(re_axis) - 有散光时必填
    - 右眼下加光(re_add) - 可选
    - 左眼球镜(le_sphere)
    - 左眼柱镜(le_cylinder) - 可选，默认0.0
    - 左眼轴位(le_axis) - 有散光时必填
    - 左眼下加光(le_add) - 可选
    - 总瞳距(pd_total) - 可选
    - 右眼瞳距(pd_right) - 可选
    - 左眼瞳距(pd_left) - 可选
    - 右眼瞳高(ph_right) - 可选
    - 左眼瞳高(ph_left) - 可选
    - 镜架型号(frame_model) - 可选
    - 镜片类型(lens_type) - 可选
    - 验光师(optometrist) - 可选
    - 验光日期(exam_date) - 可选
    - 备注(notes) - 可选
    """
    prescriptions = []
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                entry = PrescriptionEntry(
                    order_no=row.get("order_no", f"RX-{row_num-1}").strip(),
                    patient_name=row.get("patient_name", "").strip() or None,
                    re_sphere=parse_float(row.get("re_sphere"), 0.0),
                    re_cylinder=parse_float(row.get("re_cylinder"), 0.0),
                    re_axis=parse_int(row.get("re_axis")),
                    re_add=parse_float(row.get("re_add")),
                    le_sphere=parse_float(row.get("le_sphere"), 0.0),
                    le_cylinder=parse_float(row.get("le_cylinder"), 0.0),
                    le_axis=parse_int(row.get("le_axis")),
                    le_add=parse_float(row.get("le_add")),
                    pd_total=parse_float(row.get("pd_total")),
                    pd_right=parse_float(row.get("pd_right")),
                    pd_left=parse_float(row.get("pd_left")),
                    ph_right=parse_float(row.get("ph_right")),
                    ph_left=parse_float(row.get("ph_left")),
                    frame_model=row.get("frame_model", "").strip() or None,
                    lens_type=row.get("lens_type", "").strip() or None,
                    optometrist=row.get("optometrist", "").strip() or None,
                    exam_date=row.get("exam_date", "").strip() or None,
                    notes=row.get("notes", "").strip() or None,
                )
                prescriptions.append(entry.to_prescription())
            except Exception as e:
                raise ValueError(f"第 {row_num} 行解析失败: {e}")
    
    return prescriptions


def parse_frames_csv(file_path: Path) -> list[Frame]:
    """解析镜架CSV文件
    
    CSV格式要求：
    - 镜架ID(frame_id)
    - 型号(model)
    - 品牌(brand) - 可选
    - 类型(style) - 全框/半框/无框/半无框
    - 材质(material) - 可选
    - 镜框宽度(eye_size)
    - 鼻梁宽度(bridge_size)
    - 镜腿长度(temple_length) - 可选
    - 镜片高度(lens_height) - 可选
    - 几何中心距(box_center_distance) - 可选，默认=eye_size+bridge_size
    - 颜色(color) - 可选
    - 库存数量(quantity) - 可选，默认1
    - 价格(price) - 可选
    - 备注(notes) - 可选
    """
    frames = []
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                entry = FrameEntry(
                    frame_id=row.get("frame_id", f"F-{row_num-1}").strip(),
                    model=row.get("model", "").strip(),
                    brand=row.get("brand", "").strip() or None,
                    style=row.get("style", "").strip() or None,
                    material=row.get("material", "").strip() or None,
                    eye_size=parse_float(row.get("eye_size"), 0.0),
                    bridge_size=parse_float(row.get("bridge_size"), 0.0),
                    temple_length=parse_float(row.get("temple_length")),
                    lens_height=parse_float(row.get("lens_height")),
                    box_center_distance=parse_float(row.get("box_center_distance")),
                    color=row.get("color", "").strip() or None,
                    quantity=parse_int(row.get("quantity"), 1),
                    price=parse_float(row.get("price")),
                    notes=row.get("notes", "").strip() or None,
                )
                frames.append(entry.to_frame())
            except Exception as e:
                raise ValueError(f"第 {row_num} 行解析失败: {e}")
    
    return frames


def parse_lenses_csv(file_path: Path) -> LensInventory:
    """解析镜片库存CSV文件
    
    CSV格式要求：
    - 库存ID(stock_id)
    - 类型(lens_type) - 单光/双光/渐进/防蓝光/变色/偏光
    - 材质(material) - CR39/PC/1.56/1.61/1.67/1.74/玻璃
    - 最小球镜(min_sphere)
    - 最大球镜(max_sphere)
    - 球镜步长(sphere_step) - 可选，默认0.25
    - 最小柱镜(min_cylinder) - 可选，默认0.0
    - 最大柱镜(max_cylinder) - 可选，默认0.0
    - 柱镜步长(cylinder_step) - 可选，默认0.25
    - 最小下加光(min_add) - 可选
    - 最大下加光(max_add) - 可选
    - 下加光步长(add_step) - 可选，默认0.25
    - 镜片直径(diameter) - 可选，默认65.0
    - 最小瞳高要求(minimum_lens_height) - 可选
    - 膜层(coating) - 可选
    - 品牌(brand) - 可选
    - 库存数量(quantity) - 可选，默认1
    - 单价(unit_price) - 可选
    - 供应商(supplier) - 可选
    - 备注(notes) - 可选
    """
    inventory = LensInventory()
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        
        for row_num, row in enumerate(reader, start=2):
            try:
                entry = LensEntry(
                    stock_id=row.get("stock_id", f"L-{row_num-1}").strip(),
                    lens_type=row.get("lens_type", "单光").strip(),
                    material=row.get("material", "CR39").strip(),
                    min_sphere=parse_float(row.get("min_sphere"), 0.0),
                    max_sphere=parse_float(row.get("max_sphere"), 0.0),
                    sphere_step=parse_float(row.get("sphere_step"), 0.25),
                    min_cylinder=parse_float(row.get("min_cylinder"), 0.0),
                    max_cylinder=parse_float(row.get("max_cylinder"), 0.0),
                    cylinder_step=parse_float(row.get("cylinder_step"), 0.25),
                    min_add=parse_float(row.get("min_add")),
                    max_add=parse_float(row.get("max_add")),
                    add_step=parse_float(row.get("add_step")),
                    diameter=parse_float(row.get("diameter"), 65.0),
                    minimum_lens_height=parse_float(row.get("minimum_lens_height")),
                    coating=row.get("coating", "").strip() or None,
                    brand=row.get("brand", "").strip() or None,
                    quantity=parse_int(row.get("quantity"), 1),
                    unit_price=parse_float(row.get("unit_price")),
                    supplier=row.get("supplier", "").strip() or None,
                    notes=row.get("notes", "").strip() or None,
                )
                inventory.add_item(entry.to_lens_stock())
            except Exception as e:
                raise ValueError(f"第 {row_num} 行解析失败: {e}")
    
    return inventory


def write_csv(file_path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    """写入CSV文件"""
    with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
