"""数据验证器 - 检测常见录入错误"""

from typing import Optional, Tuple

from ..models.config import ValidationRules
from ..models.frame import Frame
from ..models.prescription import EyePrescription, Prescription


def validate_power_step(
    value: float,
    step: float = 0.25,
    tolerance: float = 0.01,
) -> Tuple[bool, Optional[str]]:
    """验证度数是否符合步长要求
    
    Args:
        value: 度数值
        step: 步长(通常0.25D)
        tolerance: 容错范围
        
    Returns:
        (是否有效, 错误信息)
    """
    if abs(value) < tolerance:
        return True, None
    
    relative = abs(value)
    remainder = relative % step
    
    if remainder > tolerance and (step - remainder) > tolerance:
        expected = round(value / step) * step
        return False, f"度数 {value} 不符合步长 {step}D，建议调整为 {expected}"
    
    return True, None


def validate_axis(
    axis: Optional[int],
    has_cylinder: bool = False,
    min_axis: int = 0,
    max_axis: int = 180,
) -> Tuple[bool, Optional[str]]:
    """验证轴位
    
    Args:
        axis: 轴位值
        has_cylinder: 是否有散光
        min_axis: 最小轴位
        max_axis: 最大轴位
        
    Returns:
        (是否有效, 错误信息)
    """
    if not has_cylinder:
        return True, None
    
    if axis is None:
        return False, "有散光但轴位为空"
    
    if axis < min_axis or axis > max_axis:
        return False, f"轴位 {axis} 超出范围 [{min_axis}-{max_axis}]"
    
    if axis == 0 or axis == 180:
        return True, "轴位0°等同于180°，建议统一使用180°"
    
    return True, None


def validate_pd(
    pd_total: Optional[float] = None,
    pd_right: Optional[float] = None,
    pd_left: Optional[float] = None,
    min_pd: float = 50.0,
    max_pd: float = 75.0,
    tolerance: float = 2.0,
) -> Tuple[bool, list[str]]:
    """验证瞳距
    
    Args:
        pd_total: 总瞳距
        pd_right: 右眼瞳距
        pd_left: 左眼瞳距
        min_pd: 最小瞳距
        max_pd: 最大瞳距
        tolerance: 误差允许范围
        
    Returns:
        (是否有效, 警告/错误信息列表)
    """
    valid = True
    messages = []
    
    if pd_total is not None:
        if pd_total < min_pd:
            valid = False
            messages.append(f"总瞳距 {pd_total}mm 小于最小值 {min_pd}mm")
        if pd_total > max_pd:
            valid = False
            messages.append(f"总瞳距 {pd_total}mm 大于最大值 {max_pd}mm")
    
    if pd_right is not None and pd_left is not None:
        calculated_total = pd_right + pd_left
        
        if pd_total is not None:
            diff = abs(calculated_total - pd_total)
            if diff > tolerance:
                messages.append(
                    f"单眼瞳距之和({calculated_total}mm)与总瞳距({pd_total}mm)相差 {diff}mm，超出允许范围"
                )
        
        if pd_right < (min_pd / 2 - 2):
            valid = False
            messages.append(f"右眼瞳距 {pd_right}mm 过小")
        if pd_left < (min_pd / 2 - 2):
            valid = False
            messages.append(f"左眼瞳距 {pd_left}mm 过小")
        if pd_right > (max_pd / 2 + 2):
            valid = False
            messages.append(f"右眼瞳距 {pd_right}mm 过大")
        if pd_left > (max_pd / 2 + 2):
            valid = False
            messages.append(f"左眼瞳距 {pd_left}mm 过大")
        
        pd_diff = abs(pd_right - pd_left)
        if pd_diff > 4.0:
            messages.append(f"左右眼瞳距差异较大({pd_diff}mm)，请确认是否正确")
    
    if pd_total is None and (pd_right is None or pd_left is None):
        messages.append("缺少瞳距数据，无法完全验证")
    
    return valid, messages


def validate_frame_size(
    frame: Frame,
    min_eye_size: float = 40.0,
    max_eye_size: float = 62.0,
    min_bridge: float = 12.0,
    max_bridge: float = 26.0,
) -> Tuple[bool, list[str]]:
    """验证镜架尺寸
    
    Args:
        frame: 镜架对象
        min_eye_size: 最小镜框宽度
        max_eye_size: 最大镜框宽度
        min_bridge: 最小鼻梁宽度
        max_bridge: 最大鼻梁宽度
        
    Returns:
        (是否有效, 警告/错误信息列表)
    """
    valid = True
    messages = []
    
    if frame.eye_size < min_eye_size:
        valid = False
        messages.append(f"镜框宽度 {frame.eye_size}mm 小于最小值 {min_eye_size}mm")
    if frame.eye_size > max_eye_size:
        valid = False
        messages.append(f"镜框宽度 {frame.eye_size}mm 大于最大值 {max_eye_size}mm")
    
    if frame.bridge_size < min_bridge:
        valid = False
        messages.append(f"鼻梁宽度 {frame.bridge_size}mm 小于最小值 {min_bridge}mm")
    if frame.bridge_size > max_bridge:
        valid = False
        messages.append(f"鼻梁宽度 {frame.bridge_size}mm 大于最大值 {max_bridge}mm")
    
    bc = frame.get_box_center_distance()
    if bc < 52:
        messages.append(f"几何中心距({bc}mm)偏小，需注意瞳距匹配")
    if bc > 80:
        messages.append(f"几何中心距({bc}mm)偏大，需注意瞳距匹配")
    
    return valid, messages


def detect_sign_errors(
    eye: EyePrescription,
    eye_side: str,
    allow_plus_cylinder: bool = False,
) -> list[dict]:
    """检测度数符号错误
    
    常见错误：
    1. 近视写成正号（应该负）
    2. 远视写成负号（应该正）
    3. 散光符号错误（通常应为负）
    4. 球柱镜符号混淆
    
    Args:
        eye: 单眼处方
        eye_side: 眼别（右眼/左眼）
        allow_plus_cylinder: 是否允许正柱镜格式
        
    Returns:
        检测到的潜在问题列表
    """
    issues = []
    
    if abs(eye.sphere) > 0.001:
        if eye.sphere > 0:
            issues.append({
                "type": "sign_hint",
                "severity": "info",
                "message": f"{eye_side}球镜为正(+{eye.sphere}D)，请确认是否为远视",
                "detail": "大部分配镜订单为近视（球镜负），远视（球镜正）相对较少",
            })
        else:
            issues.append({
                "type": "sign_hint",
                "severity": "info",
                "message": f"{eye_side}球镜为负({eye.sphere}D)，为近视处方",
            })
    
    if abs(eye.cylinder) > 0.001:
        if eye.cylinder > 0 and not allow_plus_cylinder:
            issues.append({
                "type": "plus_cylinder",
                "severity": "warning",
                "message": f"{eye_side}柱镜为正(+{eye.cylinder}D)，门店通常使用负柱镜格式",
                "detail": "正柱镜格式可能导致加工错误，建议转换为负柱镜",
                "suggestion": f"转换后: 球镜{eye.sphere + eye.cylinder}D, 柱镜{-eye.cylinder}D, 轴位{(eye.axis + 90) % 180 if eye.axis else 'N/A'}°",
            })
        
        if abs(eye.cylinder) > 4.0:
            issues.append({
                "type": "high_astigmatism",
                "severity": "warning",
                "message": f"{eye_side}散光度数较高({eye.cylinder}D)，请确认库存是否支持",
            })
    
    if abs(eye.sphere) > 10.0:
        issues.append({
            "type": "high_power",
            "severity": "warning",
            "message": f"{eye_side}度数较高({eye.sphere}D)，请注意镜片库存和加工要求",
        })
    
    return issues


def detect_axis_swap(
    re_axis: Optional[int],
    le_axis: Optional[int],
    re_cylinder: float = 0.0,
    le_cylinder: float = 0.0,
    threshold: int = 45,
) -> Tuple[bool, Optional[str]]:
    """检测左右眼轴位互换风险
    
    常见错误模式：
    1. 左右眼轴位写反（如右眼180°写成左眼180°）
    2. 轴位相差90°（可能是正负柱镜转换时出错）
    3. 常见轴位（0/90/180）写反
    
    Args:
        re_axis: 右眼轴位
        le_axis: 左眼轴位
        re_cylinder: 右眼柱镜
        le_cylinder: 左眼柱镜
        threshold: 差异阈值
        
    Returns:
        (是否有风险, 风险描述)
    """
    if re_axis is None or le_axis is None:
        return False, None
    
    if abs(re_cylinder) < 0.001 or abs(le_cylinder) < 0.001:
        return False, None
    
    if re_axis == 0:
        re_axis = 180
    if le_axis == 0:
        le_axis = 180
    
    if re_axis == le_axis:
        return False, None
    
    diff = abs(re_axis - le_axis)
    
    if diff == 90 or diff == 270:
        return True, f"左右眼轴位相差90°(右眼{re_axis}°, 左眼{le_axis}°)，可能是正负柱镜格式转换错误"
    
    if (re_axis in [90, 180] and le_axis in [90, 180] and re_axis != le_axis):
        return True, f"左右眼轴位分别为{re_axis}°和{le_axis}°，可能写反了"
    
    common_axes = [0, 10, 20, 30, 45, 60, 70, 80, 90, 100, 110, 120, 135, 150, 160, 170, 180]
    
    if (re_axis in common_axes and le_axis in common_axes and 
        re_axis != le_axis and 
        abs(re_axis - le_axis) < threshold):
        return False, f"轴位差异为{diff}°，在常见轴位范围内，风险较低"
    
    if diff > 135:
        diff = 180 - diff
    
    if diff < threshold:
        return False, None
    
    return True, f"左右眼轴位差异较大({diff}°)，请确认是否正确"


def validate_ph(
    ph_right: Optional[float],
    ph_left: Optional[float],
    lens_height: Optional[float] = None,
    min_ph: float = 18.0,
    max_ph: float = 35.0,
) -> Tuple[bool, list[str]]:
    """验证瞳高
    
    Args:
        ph_right: 右眼瞳高
        ph_left: 左眼瞳高
        lens_height: 镜片高度
        min_ph: 最小瞳高
        max_ph: 最大瞳高
        
    Returns:
        (是否有效, 警告/错误信息列表)
    """
    valid = True
    messages = []
    
    if ph_right is None and ph_left is None:
        messages.append("未提供瞳高数据，渐进/双光镜片需要瞳高")
        return valid, messages
    
    for side, ph in [("右眼", ph_right), ("左眼", ph_left)]:
        if ph is None:
            continue
        
        if ph < min_ph:
            valid = False
            messages.append(f"{side}瞳高 {ph}mm 小于最小值 {min_ph}mm")
        if ph > max_ph:
            valid = False
            messages.append(f"{side}瞳高 {ph}mm 大于最大值 {max_ph}mm")
        
        if lens_height:
            if ph > lens_height:
                valid = False
                messages.append(f"{side}瞳高({ph}mm)大于镜片高度({lens_height}mm)")
            
            if ph < lens_height * 0.4:
                messages.append(f"{side}瞳高({ph}mm)偏低，请确认")
            if ph > lens_height * 0.6:
                messages.append(f"{side}瞳高({ph}mm)偏高，请确认")
    
    if ph_right is not None and ph_left is not None:
        ph_diff = abs(ph_right - ph_left)
        if ph_diff > 2.0:
            messages.append(f"左右眼瞳高差异较大({ph_diff}mm)，请确认")
    
    return valid, messages
