"""CSV 数据解析器模块"""

import csv
import uuid
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

from .models import (
    Participant,
    ChipBinding,
    Wave,
    WaveType,
    Checkpoint,
    CheckpointType,
    CheckpointLog,
    DNFRecord,
    RaceData,
)


class ParseError(Exception):
    """解析错误异常"""
    pass


def _strip_headers(headers: List[str]) -> List[str]:
    """清理CSV表头中的空格和特殊字符"""
    return [h.strip().lower().replace(" ", "_").replace("-", "_") for h in headers]


def _map_column(headers: List[str], possible_names: List[str]) -> Optional[str]:
    """查找匹配的列名"""
    headers_lower = [h.lower() for h in headers]
    for name in possible_names:
        if name.lower() in headers_lower:
            return headers[headers_lower.index(name.lower())]
    return None


def _safe_get(row: Dict[str, Any], key: str, default: Any = None) -> Any:
    """安全获取字典值，处理大小写和空格"""
    keys_lower = {k.lower().strip(): k for k in row.keys()}
    search_key = key.lower().strip()
    if search_key in keys_lower:
        value = row[keys_lower[search_key]]
        if isinstance(value, str):
            return value.strip()
        return value
    return default


def parse_participants_csv(file_path: Path) -> Dict[str, Participant]:
    """解析选手报名表 CSV
    
    支持的列名变体:
    - bib_number, bib, 号码布, 参赛号
    - name, 姓名, 选手名
    - gender, sex, 性别
    - age, 年龄
    - category, group, 组别, 参赛组别
    - phone, mobile, 电话, 手机
    - emergency_contact, emergency, 紧急联系人
    - wave_id, wave, 波次, 起跑波次
    """
    participants: Dict[str, Participant] = {}
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            bib_number = _safe_get(row, "bib_number") or _safe_get(row, "bib") or _safe_get(row, "号码布") or _safe_get(row, "参赛号")
            
            if not bib_number:
                raise ParseError(f"第 {row_num} 行: 缺少号码布号码")
            
            bib_number = str(bib_number).strip()
            
            name = _safe_get(row, "name") or _safe_get(row, "姓名") or ""
            gender_str = _safe_get(row, "gender") or _safe_get(row, "sex") or _safe_get(row, "性别")
            age_str = _safe_get(row, "age") or _safe_get(row, "年龄")
            category = _safe_get(row, "category") or _safe_get(row, "group") or _safe_get(row, "组别") or _safe_get(row, "参赛组别")
            phone = _safe_get(row, "phone") or _safe_get(row, "mobile") or _safe_get(row, "电话") or _safe_get(row, "手机")
            emergency_contact = _safe_get(row, "emergency_contact") or _safe_get(row, "emergency") or _safe_get(row, "紧急联系人")
            wave_id = _safe_get(row, "wave_id") or _safe_get(row, "wave") or _safe_get(row, "波次") or _safe_get(row, "起跑波次")
            
            gender = None
            if gender_str:
                gender_str = gender_str.upper().strip()
                if gender_str in ["M", "男", "MALE"]:
                    gender = "M"
                elif gender_str in ["F", "女", "FEMALE"]:
                    gender = "F"
            
            age = None
            if age_str:
                try:
                    age = int(age_str)
                except ValueError:
                    pass
            
            participant = Participant(
                bib_number=bib_number,
                name=name,
                gender=gender,
                age=age,
                category=category,
                phone=phone,
                emergency_contact=emergency_contact,
                wave_id=wave_id,
            )
            participants[bib_number] = participant
    
    return participants


def parse_chip_bindings_csv(file_path: Path) -> Tuple[Dict[str, ChipBinding], Dict[str, List[str]]]:
    """解析芯片绑定表 CSV
    
    支持的列名变体:
    - chip_id, chip, rfid, tag, 芯片号, 芯片ID
    - bib_number, bib, 号码布, 参赛号
    - bind_time, time, 绑定时间
    - device_id, device, 设备ID
    """
    chip_bindings: Dict[str, ChipBinding] = {}
    bib_to_chip: Dict[str, List[str]] = {}
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            chip_id = _safe_get(row, "chip_id") or _safe_get(row, "chip") or _safe_get(row, "rfid") or _safe_get(row, "tag") or _safe_get(row, "芯片号") or _safe_get(row, "芯片ID")
            
            bib_number = _safe_get(row, "bib_number") or _safe_get(row, "bib") or _safe_get(row, "号码布") or _safe_get(row, "参赛号")
            
            if not chip_id:
                raise ParseError(f"第 {row_num} 行: 缺少芯片ID")
            if not bib_number:
                raise ParseError(f"第 {row_num} 行: 缺少号码布")
            
            chip_id = str(chip_id).strip()
            bib_number = str(bib_number).strip()
            
            bind_time = _safe_get(row, "bind_time") or _safe_get(row, "time") or _safe_get(row, "绑定时间")
            device_id = _safe_get(row, "device_id") or _safe_get(row, "device") or _safe_get(row, "设备ID")
            
            binding = ChipBinding(
                chip_id=chip_id,
                bib_number=bib_number,
                bind_time=bind_time,
                device_id=device_id,
            )
            chip_bindings[chip_id] = binding
            
            if bib_number not in bib_to_chip:
                bib_to_chip[bib_number] = []
            bib_to_chip[bib_number].append(chip_id)
    
    return chip_bindings, bib_to_chip


def parse_waves_csv(file_path: Path) -> Dict[str, Wave]:
    """解析波次表 CSV
    
    支持的列名变体:
    - wave_id, wave, 波次ID
    - wave_name, name, 波次名称
    - start_time, time, 起跑时间, 发枪时间
    - max_participants, max, 最大人数
    """
    waves: Dict[str, Wave] = {}
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            wave_id = _safe_get(row, "wave_id") or _safe_get(row, "wave") or _safe_get(row, "波次ID")
            wave_name_str = _safe_get(row, "wave_name") or _safe_get(row, "name") or _safe_get(row, "波次名称")
            start_time = _safe_get(row, "start_time") or _safe_get(row, "time") or _safe_get(row, "起跑时间") or _safe_get(row, "发枪时间")
            max_str = _safe_get(row, "max_participants") or _safe_get(row, "max") or _safe_get(row, "最大人数")
            
            if not wave_id:
                wave_id = f"W{row_num - 1}"
            
            wave_name = WaveType.A
            if wave_name_str:
                wave_name_str = wave_name_str.strip().upper()
                for wt in WaveType:
                    if wt.value == wave_name_str or wt.name == wave_name_str:
                        wave_name = wt
                        break
            
            if not start_time:
                raise ParseError(f"第 {row_num} 行: 缺少起跑时间")
            
            max_participants = None
            if max_str:
                try:
                    max_participants = int(max_str)
                except ValueError:
                    pass
            
            wave = Wave(
                wave_id=str(wave_id).strip(),
                wave_name=wave_name,
                start_time=start_time,
                max_participants=max_participants,
            )
            waves[wave.wave_id] = wave
    
    return waves


def parse_checkpoints_csv(file_path: Path) -> Dict[str, Checkpoint]:
    """解析检查点配置 CSV
    
    支持的列名变体:
    - checkpoint_id, cp_id, id, 检查点ID
    - name, checkpoint_name, cp_name, 检查点名称
    - type, cp_type, checkpoint_type, 类型
    - distance_from_start, distance, km, 距离起点, 距离
    - order, sequence, 顺序, 序号
    """
    checkpoints: Dict[str, Checkpoint] = {}
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            checkpoint_id = _safe_get(row, "checkpoint_id") or _safe_get(row, "cp_id") or _safe_get(row, "id") or _safe_get(row, "检查点ID")
            name = _safe_get(row, "name") or _safe_get(row, "checkpoint_name") or _safe_get(row, "cp_name") or _safe_get(row, "检查点名称")
            cp_type_str = _safe_get(row, "type") or _safe_get(row, "cp_type") or _safe_get(row, "checkpoint_type") or _safe_get(row, "类型")
            distance_str = _safe_get(row, "distance_from_start") or _safe_get(row, "distance") or _safe_get(row, "km") or _safe_get(row, "距离起点") or _safe_get(row, "距离")
            order_str = _safe_get(row, "order") or _safe_get(row, "sequence") or _safe_get(row, "顺序") or _safe_get(row, "序号")
            
            if not checkpoint_id:
                checkpoint_id = f"CP{row_num - 1}"
            
            if not name:
                raise ParseError(f"第 {row_num} 行: 缺少检查点名称")
            
            cp_type = CheckpointType.CP
            if cp_type_str:
                cp_type_str = cp_type_str.strip().upper()
                for cpt in CheckpointType:
                    if cpt.value == cp_type_str or cpt.name == cp_type_str:
                        cp_type = cpt
                        break
            
            if not distance_str:
                raise ParseError(f"第 {row_num} 行: 缺少距离数据")
            
            try:
                distance = float(distance_str)
            except ValueError:
                raise ParseError(f"第 {row_num} 行: 距离格式错误: {distance_str}")
            
            order = row_num - 1
            if order_str:
                try:
                    order = int(order_str)
                except ValueError:
                    pass
            
            checkpoint = Checkpoint(
                checkpoint_id=str(checkpoint_id).strip(),
                name=name.strip(),
                cp_type=cp_type,
                distance_from_start=distance,
                order=order,
            )
            checkpoints[checkpoint.checkpoint_id] = checkpoint
    
    return checkpoints


def parse_checkpoint_logs_csv(file_path: Path) -> List[CheckpointLog]:
    """解析检查点设备日志 CSV
    
    支持的列名变体:
    - log_id, id, 日志ID
    - chip_id, chip, tag, 芯片ID, 芯片号
    - checkpoint_id, cp_id, checkpoint, 检查点ID
    - read_time, time, timestamp, 读取时间, 时间
    - device_id, device, reader, 设备ID, 读取设备
    - signal_strength, rssi, signal, 信号强度
    - antenna_port, antenna, port, 天线端口
    """
    logs: List[CheckpointLog] = []
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            log_id = _safe_get(row, "log_id") or _safe_get(row, "id") or _safe_get(row, "日志ID") or str(uuid.uuid4())
            chip_id = _safe_get(row, "chip_id") or _safe_get(row, "chip") or _safe_get(row, "tag") or _safe_get(row, "芯片ID") or _safe_get(row, "芯片号")
            checkpoint_id = _safe_get(row, "checkpoint_id") or _safe_get(row, "cp_id") or _safe_get(row, "checkpoint") or _safe_get(row, "检查点ID")
            read_time = _safe_get(row, "read_time") or _safe_get(row, "time") or _safe_get(row, "timestamp") or _safe_get(row, "读取时间") or _safe_get(row, "时间")
            device_id = _safe_get(row, "device_id") or _safe_get(row, "device") or _safe_get(row, "reader") or _safe_get(row, "设备ID") or _safe_get(row, "读取设备")
            signal_str = _safe_get(row, "signal_strength") or _safe_get(row, "rssi") or _safe_get(row, "signal") or _safe_get(row, "信号强度")
            antenna_str = _safe_get(row, "antenna_port") or _safe_get(row, "antenna") or _safe_get(row, "port") or _safe_get(row, "天线端口")
            
            if not chip_id:
                raise ParseError(f"第 {row_num} 行: 缺少芯片ID")
            if not checkpoint_id:
                raise ParseError(f"第 {row_num} 行: 缺少检查点ID")
            if not read_time:
                raise ParseError(f"第 {row_num} 行: 缺少读取时间")
            
            signal_strength = None
            if signal_str:
                try:
                    signal_strength = float(signal_str)
                except ValueError:
                    pass
            
            antenna_port = None
            if antenna_str:
                try:
                    antenna_port = int(antenna_str)
                except ValueError:
                    pass
            
            log = CheckpointLog(
                log_id=str(log_id).strip(),
                chip_id=str(chip_id).strip(),
                checkpoint_id=str(checkpoint_id).strip(),
                read_time=read_time,
                device_id=device_id,
                signal_strength=signal_strength,
                antenna_port=antenna_port,
            )
            logs.append(log)
    
    return logs


def parse_dnf_csv(file_path: Path) -> Dict[str, DNFRecord]:
    """解析退赛名单 CSV
    
    支持的列名变体:
    - bib_number, bib, 号码布, 参赛号
    - dnf_time, time, 退赛时间
    - last_checkpoint, last_cp, 最后检查点, 退赛点
    - reason, 退赛原因, 原因
    - reported_by, reporter, 上报人
    """
    dnf_records: Dict[str, DNFRecord] = {}
    
    if not file_path.exists():
        raise ParseError(f"文件不存在: {file_path}")
    
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            raise ParseError(f"CSV文件无表头: {file_path}")
        
        for row_num, row in enumerate(reader, start=2):
            bib_number = _safe_get(row, "bib_number") or _safe_get(row, "bib") or _safe_get(row, "号码布") or _safe_get(row, "参赛号")
            
            if not bib_number:
                raise ParseError(f"第 {row_num} 行: 缺少号码布")
            
            bib_number = str(bib_number).strip()
            
            dnf_time = _safe_get(row, "dnf_time") or _safe_get(row, "time") or _safe_get(row, "退赛时间")
            last_checkpoint = _safe_get(row, "last_checkpoint") or _safe_get(row, "last_cp") or _safe_get(row, "最后检查点") or _safe_get(row, "退赛点")
            reason = _safe_get(row, "reason") or _safe_get(row, "退赛原因") or _safe_get(row, "原因")
            reported_by = _safe_get(row, "reported_by") or _safe_get(row, "reporter") or _safe_get(row, "上报人")
            
            dnf_record = DNFRecord(
                bib_number=bib_number,
                dnf_time=dnf_time,
                last_checkpoint=last_checkpoint,
                reason=reason,
                reported_by=reported_by,
            )
            dnf_records[bib_number] = dnf_record
    
    return dnf_records


def load_all_data(
    participants_file: Optional[Path] = None,
    chip_bindings_file: Optional[Path] = None,
    waves_file: Optional[Path] = None,
    checkpoints_file: Optional[Path] = None,
    logs_file: Optional[Path] = None,
    dnf_file: Optional[Path] = None,
    race_name: str = "未命名赛事",
) -> RaceData:
    """加载所有数据源并创建 RaceData 对象"""
    race_data = RaceData(race_name=race_name)
    
    if participants_file:
        race_data.participants = parse_participants_csv(participants_file)
    
    if chip_bindings_file:
        race_data.chip_bindings, race_data.bib_to_chip = parse_chip_bindings_csv(chip_bindings_file)
    
    if waves_file:
        race_data.waves = parse_waves_csv(waves_file)
    
    if checkpoints_file:
        race_data.checkpoints = parse_checkpoints_csv(checkpoints_file)
    
    if logs_file:
        race_data.checkpoint_logs = parse_checkpoint_logs_csv(logs_file)
    
    if dnf_file:
        race_data.dnf_records = parse_dnf_csv(dnf_file)
    
    return race_data
