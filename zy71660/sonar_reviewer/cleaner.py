"""
数据清洗和异常过滤引擎

检测并标记各类错误，保留处理顺序，说明影响范围。

错误类型定义：
- E001: 缺少必填字段（水温、回波时间、目标距离至少缺一个）
- E002: 目标距离为负
- E003: 回波时间为负或超出合理范围
- E004: 水温超出合理范围
- E005: 声速单位错误（计算值异常偏小，大概率是km/h误写为m/s）
- E006: 回波重复（相同设备+相近时间的重复记录
- E007: 字段填反（水温/回波时间/目标距离三者数值范围异常
- E008: 交叉验证不一致（测量距离与计算距离偏差过大）
- E009: 计算声速超出理论范围
"""

from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from dataclasses import dataclass

from .core import (
    SonarRecord,
    PhysicsBounds,
    calculate_velocity,
    calculate_distance,
    calculate_echo_time,
    kmh_to_ms,
)


@dataclass
class ErrorInfo:
    """错误信息"""
    code: str
    message: str
    affected_records: List[str]
    severity: str = "error"


class DataCleaner:
    """数据清洗和异常检测引擎"""
    
    def __init__(self):
        self.errors: List[ErrorInfo] = []
        self.warnings: List[ErrorInfo] = []
        self.error_counts: Dict[str, int] = defaultdict(int)
        self.processing_order: List[str] = []
    
    def _register_error(self, code: str, message: str, record_id: str, severity: str = "error") -> None:
        """注册错误信息"""
        target_list = self.errors if severity == "error" else self.warnings
        for err in target_list:
            if err.code == code:
                if record_id not in err.affected_records:
                    err.affected_records.append(record_id)
                return
        target_list.append(ErrorInfo(code, message, [record_id], severity))
    
    def check_missing_fields(self, record: SonarRecord) -> bool:
        """检查缺失字段"""
        record.add_step("清洗: 检查缺失字段")
        missing = []
        
        if record.temperature is None:
            missing.append("水温")
        if record.echo_time is None:
            missing.append("回波时间")
        if record.measured_distance is None:
            missing.append("目标距离")
        
        if missing:
            msg = f"缺少必填字段: {', '.join(missing)}"
            record.add_error(f"[E001] {msg}")
            self._register_error("E001", msg, record.record_id)
            return False
        return True
    
    def check_negative_distance(self, record: SonarRecord) -> bool:
        """检查距离为负"""
        record.add_step("清洗: 检查距离非负")
        
        if record.measured_distance is not None and record.measured_distance < 0:
            msg = f"目标距离为负: {record.measured_distance} m"
            record.add_error(f"[E002] {msg}")
            self._register_error("E002", msg, record.record_id)
            return False
        return True
    
    def check_echo_time_bounds(self, record: SonarRecord) -> bool:
        """检查回波时间范围"""
        record.add_step("清洗: 检查回波时间范围")
        
        if record.echo_time is not None:
            if record.echo_time <= 0:
                msg = f"回波时间必须为正值: {record.echo_time} s"
                record.add_error(f"[E003] {msg}")
                self._register_error("E003", msg, record.record_id)
                return False
            if not (PhysicsBounds.TIME_MIN <= record.echo_time <= PhysicsBounds.TIME_MAX):
                msg = (f"回波时间 {record.echo_time}s 超出合理范围 "
                       f"[{PhysicsBounds.TIME_MIN}, {PhysicsBounds.TIME_MAX}]s")
                record.add_warning(f"[W003] {msg}")
                self._register_error("W003", msg, record.record_id, "warning")
        return True
    
    def check_temperature_bounds(self, record: SonarRecord) -> bool:
        """检查水温范围"""
        record.add_step("清洗: 检查水温范围")
        
        if record.temperature is not None:
            if not (PhysicsBounds.TEMP_MIN <= record.temperature <= PhysicsBounds.TEMP_MAX):
                msg = (f"水温 {record.temperature}℃ 超出合理范围 "
                       f"[{PhysicsBounds.TEMP_MIN}, {PhysicsBounds.TEMP_MAX}]℃")
                record.add_error(f"[E004] {msg}")
                self._register_error("E004", msg, record.record_id)
                return False
        return True
    
    def check_velocity_unit(self, record: SonarRecord) -> bool:
        """检查声速单位是否有问题
        原理：如果根据距离和回波时间反推的声速异常偏小（< 200 m/s），
        且距离值不为0，大概率是把 km/h 当成了 m/s，或字段填反
        """
        record.add_step("清洗: 检查声速单位")
        
        if record.echo_time is not None and record.measured_distance is not None:
            if record.echo_time > 0 and record.measured_distance > 0:
                implied_velocity = 2 * record.measured_distance / record.echo_time
                
                if implied_velocity < PhysicsBounds.VELOCITY_UNIT_THRESHOLD:
                    corrected = kmh_to_ms(implied_velocity)
                    if corrected > PhysicsBounds.VELOCITY_MIN * 0.5:
                        unit_hint = (f"若单位实际为 km/h，修正后约为 {corrected:.2f} m/s，"
                                     f"接近理论声速范围，大概率是单位标错。")
                    else:
                        unit_hint = (f"即使换算为 km/h ({corrected:.2f} m/s) 仍远低于理论值，"
                                     f"更可能是回波时间与距离字段填反。")
                    msg = (f"[E005] 疑似声速单位/字段错误："
                           f"根据距离 {record.measured_distance}m 和回波时间 {record.echo_time}s "
                           f"反推声速为 {implied_velocity:.2f} m/s，"
                           f"远小于理论最小值 {PhysicsBounds.VELOCITY_MIN} m/s。"
                           f"{unit_hint}")
                    record.add_error(msg)
                    self._register_error("E005", msg, record.record_id)
                    return False
        return True
    
    def check_field_swap(self, record: SonarRecord) -> bool:
        """检查字段填反
        检测水温、回波时间、目标距离三者是否填反。
        原理：根据物理量级差异：
        - 水温通常在 0-30℃ 左右
        - 回波时间通常在 0.01-2s 左右
        - 目标距离通常在 10-1000m 左右
        三者量级差异明显，若某个字段数值在其他字段的合理范围内，可能填反。
        额外检查：如果声速计算和测距都完成了，但测量距离与计算距离偏差>50%，
        也可能是字段填反。
        """
        record.add_step("清洗: 检查字段填反")
        
        suspect_swap = []
        
        values = {
            'temperature': record.temperature,
            'echo_time': record.echo_time,
            'measured_distance': record.measured_distance,
        }
        
        if None not in values.values():
            # 检查温度值
            if values['temperature'] is not None:
                if values['temperature'] > 100:
                    suspect_swap.append(f"水温={values['temperature']} 数值过大，疑似与距离填反")
                if values['temperature'] < 0 and abs(values['temperature']) > 10:
                    suspect_swap.append(f"水温={values['temperature']} 数值异常，疑似填反")
            
            # 检查回波时间
            if values['echo_time'] is not None:
                if values['echo_time'] > 100:
                    suspect_swap.append(f"回波时间={values['echo_time']} 数值过大，疑似与距离填反")
            
            # 检查距离
            if values['measured_distance'] is not None:
                if 0 < values['measured_distance'] < 0.01:
                    suspect_swap.append(f"距离={values['measured_distance']} 数值过小，疑似与回波时间填反")
                if values['measured_distance'] > 0 and values['echo_time'] is not None:
                    if values['echo_time'] > 0:
                        implied_v = 2 * values['measured_distance'] / values['echo_time']
                        if implied_v < PhysicsBounds.VELOCITY_MIN * 0.5:
                            suspect_swap.append(
                                f"距离={values['measured_distance']}m 与 回波时间={values['echo_time']}s "
                                f"反推声速={implied_v:.1f}m/s 远低于理论值，疑似回波时间与距离填反")
        
        if suspect_swap:
            msg = f"[E007] 疑似字段填反: {'; '.join(suspect_swap)}"
            record.add_error(msg)
            self._register_error("E007", msg, record.record_id)
            return False
        return True
    
    def check_duplicate_echo(self, records: List[SonarRecord]) -> None:
        """检查回波重复
        相同设备 + 相近回波时间（差异<1%）视为重复记录
        """
        self.processing_order.append("全局检查: 回波重复")
        
        groups = defaultdict(list)
        for record in records:
            if record.device_id and record.echo_time is not None:
                groups[record.device_id].append(record)
        
        for device_id, device_records in groups.items():
            n = len(device_records)
            for i in range(n):
                for j in range(i + 1, n):
                    r1 = device_records[i]
                    r2 = device_records[j]
                    if r1.echo_time and r2.echo_time:
                        diff = abs(r1.echo_time - r2.echo_time)
                        avg = (r1.echo_time + r2.echo_time) / 2
                        if avg > 0 and diff / avg < 0.01:  # 差异<1%
                            msg = (f"[E006] 疑似回波重复: 设备 {device_id} "
                                   f"记录 {r1.record_id} 和 {r2.record_id} "
                                   f"回波时间分别为 {r1.echo_time}s 和 {r2.echo_time}s，"
                                   f"差异仅 {diff*1000:.2f}ms")
                            r1.add_error(msg)
                            r2.add_error(msg)
                            self._register_error("E006", msg, r1.record_id)
                            self._register_error("E006", msg, r2.record_id)
    
    def calculate_and_validate(self, record: SonarRecord) -> bool:
        """执行计算并验证结果
        1. 声速修正（水温修正）
        2. 测距计算
        3. 交叉验证
        """
        record.add_step("计算: 声速修正（水温修正）")
        
        velocity_ok = False
        if record.temperature is not None:
            try:
                record.calculated_velocity = calculate_velocity(record.temperature)
                record.add_step(f"计算: 声速={record.calculated_velocity} m/s "
                              f"(水温 {record.temperature}℃)")
                
                # 检查声速范围
                if not (PhysicsBounds.VELOCITY_MIN <= record.calculated_velocity <= PhysicsBounds.VELOCITY_MAX):
                    msg = (f"[E009] 计算声速 {record.calculated_velocity} m/s "
                           f"超出理论范围 [{PhysicsBounds.VELOCITY_MIN}, {PhysicsBounds.VELOCITY_MAX}] m/s")
                    record.add_warning(msg)
                    self._register_error("E009", msg, record.record_id, "warning")
                velocity_ok = True
            except ValueError as e:
                record.add_error(f"[E009] 声速计算失败: {e}")
                self._register_error("E009", str(e), record.record_id)
        
        if not velocity_ok:
            record.add_step("计算: 声速不可用，跳过测距计算和交叉验证")
            return False
        
        record.add_step("计算: 测距计算")
        
        if record.echo_time is not None:
            if record.echo_time <= 0:
                record.add_step("计算: 回波时间无效，跳过测距计算")
                return False
            try:
                record.calculated_distance = calculate_distance(
                    record.calculated_velocity, record.echo_time)
                record.add_step(f"计算: 距离={record.calculated_distance} m")
                
                # 交叉验证
                if record.measured_distance is not None and record.measured_distance > 0:
                    record.add_step("计算: 交叉验证")
                    expected_time = calculate_echo_time(
                        record.calculated_velocity, record.measured_distance)
                    record.expected_echo_time = expected_time
                    
                    diff = abs(record.echo_time - expected_time)
                    if expected_time > 0:
                        rel_diff = diff / expected_time
                        if rel_diff > 0.1:  # 差异>10%
                            msg = (f"[E008] 交叉验证不一致: "
                                   f"测量距离 {record.measured_distance}m "
                                   f"对应理论回波时间应为 {expected_time:.4f}s，"
                                   f"实际回波时间 {record.echo_time}s，"
                                   f"相对偏差 {rel_diff*100:.1f}%")
                            record.add_warning(msg)
                            self._register_error("E008", msg, record.record_id, "warning")
            except ValueError as e:
                record.add_error(f"[E008] 测距计算错误: {e}")
                return False
        
        return True
    
    def process_record(self, record: SonarRecord) -> SonarRecord:
        """处理单条记录"""
        self.processing_order.append(f"处理记录 {record.record_id}")
        
        # 按顺序执行检查
        checks = [
            self.check_missing_fields,
            self.check_negative_distance,
            self.check_echo_time_bounds,
            self.check_temperature_bounds,
            self.check_velocity_unit,
            self.check_field_swap,
        ]
        
        for check in checks:
            if not check(record):
                # 继续处理，即使出错也继续后续步骤，标记
                continue
        
        # 执行计算
        self.calculate_and_validate(record)
        
        # 标记最终状态
        if record.is_valid:
            record.add_step("完成: 记录有效")
        else:
            record.add_step(f"完成: 记录无效，共 {len(record.errors)} 个错误")
        
        return record
    
    def process_all(self, records: List[SonarRecord]) -> Tuple[List[SonarRecord], List[SonarRecord]]:
        """处理所有记录"""
        processed = []
        for record in records:
            processed.append(self.process_record(record))
        
        # 全局检查：回波重复
        self.check_duplicate_echo(processed)
        
        valid = [r for r in processed if r.is_valid]
        invalid = [r for r in processed if not r.is_valid]
        
        return valid, invalid
    
    def get_error_summary(self) -> Dict:
        """获取错误汇总"""
        summary = {
            'errors': [
                {
                    'code': e.code,
                    'message': e.message,
                    'affected_count': len(e.affected_records),
                    'affected_records': e.affected_records,
                }
                for e in self.errors
            ],
            'warnings': [
                {
                    'code': w.code,
                    'message': w.message,
                    'affected_count': len(w.affected_records),
                    'affected_records': w.affected_records,
                }
                for w in self.warnings
            ],
            'processing_order': self.processing_order,
        }
        return summary
