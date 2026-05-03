import pandas as pd
from datetime import datetime, time
from typing import List, Tuple, Optional

def parse_construction_permits_csv(file_path: str) -> pd.DataFrame:
    """
    解析施工许可表CSV文件
    
    期望的CSV字段:
    - permit_id: 许可证ID
    - project_name: 项目名称
    - location: 施工地点
    - community: 影响小区
    - permit_start_date: 许可开始日期
    - permit_end_date: 许可结束日期
    - permitted_start_time: 许可开始时间 (如 "08:00")
    - permitted_end_time: 许可结束时间 (如 "22:00")
    - permitted_night_work: 是否允许夜间施工
    - night_start_time: 夜间施工开始时间 (如 "22:00")
    - night_end_time: 夜间施工结束时间 (如 "06:00")
    - contractor: 施工单位
    - contact_person: 联系人
    - contact_phone: 联系电话
    """
    df = pd.read_csv(file_path)
    
    # 标准化列名
    column_mapping = {
        'permit_id': 'permit_id',
        'id': 'permit_id',
        '许可证编号': 'permit_id',
        'project_name': 'project_name',
        '项目名称': 'project_name',
        '工程名称': 'project_name',
        'location': 'location',
        '施工地点': 'location',
        '地点': 'location',
        'community': 'community',
        '影响小区': 'community',
        '周边小区': 'community',
        '小区': 'community',
        'permit_start_date': 'permit_start_date',
        '许可开始日期': 'permit_start_date',
        '开始日期': 'permit_start_date',
        'permit_end_date': 'permit_end_date',
        '许可结束日期': 'permit_end_date',
        '结束日期': 'permit_end_date',
        'permitted_start_time': 'permitted_start_time',
        '许可开始时间': 'permitted_start_time',
        '开始时间': 'permitted_start_time',
        'permitted_end_time': 'permitted_end_time',
        '许可结束时间': 'permitted_end_time',
        '结束时间': 'permitted_end_time',
        'permitted_night_work': 'permitted_night_work',
        '允许夜间施工': 'permitted_night_work',
        '夜间施工许可': 'permitted_night_work',
        'night_start_time': 'night_start_time',
        '夜间开始时间': 'night_start_time',
        'night_end_time': 'night_end_time',
        '夜间结束时间': 'night_end_time',
        'contractor': 'contractor',
        '施工单位': 'contractor',
        '单位': 'contractor',
        'contact_person': 'contact_person',
        '联系人': 'contact_person',
        'contact_phone': 'contact_phone',
        '联系电话': 'contact_phone',
        '电话': 'contact_phone'
    }
    
    # 重命名列
    for old_col, new_col in column_mapping.items():
        if old_col in df.columns and new_col not in df.columns:
            df = df.rename(columns={old_col: new_col})
    
    # 确保必要的列存在
    required_columns = ['permit_id', 'project_name', 'location']
    for col in required_columns:
        if col not in df.columns:
            df[col] = None
    
    # 处理日期列
    date_columns = ['permit_start_date', 'permit_end_date']
    for col in date_columns:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.date
    
    # 处理布尔列
    if 'permitted_night_work' in df.columns:
        df['permitted_night_work'] = df['permitted_night_work'].apply(
            lambda x: str(x).lower() in ['true', '1', 'yes', '是', '允许']
            if pd.notna(x) else False
        )
    
    # 设置默认时间
    if 'permitted_start_time' not in df.columns:
        df['permitted_start_time'] = '08:00'
    if 'permitted_end_time' not in df.columns:
        df['permitted_end_time'] = '22:00'
    
    return df

def parse_time_string(time_str: str) -> Optional[time]:
    """
    解析时间字符串为time对象
    支持格式: "HH:MM", "HH:MM:SS", "H:M"
    """
    if pd.isna(time_str) or not time_str:
        return None
    
    time_str = str(time_str).strip()
    
    try:
        # 尝试多种格式
        for fmt in ['%H:%M', '%H:%M:%S', '%H:%M', '%H']:
            try:
                dt = datetime.strptime(time_str, fmt)
                return dt.time()
            except ValueError:
                continue
    except:
        pass
    
    return None

def is_time_in_permitted_window(
    check_time: datetime,
    permit_start_time: str,
    permit_end_time: str,
    permitted_night_work: bool = False,
    night_start_time: str = "22:00",
    night_end_time: str = "06:00"
) -> Tuple[bool, str]:
    """
    检查时间是否在许可窗口内
    
    返回: (是否在许可时间内, 原因说明)
    """
    check_hour = check_time.hour
    check_minute = check_time.minute
    
    # 解析许可时间
    start_time = parse_time_string(permit_start_time)
    end_time = parse_time_string(permit_end_time)
    
    if not start_time or not end_time:
        return False, "无法解析许可时间"
    
    # 转换为分钟数便于比较
    check_total = check_hour * 60 + check_minute
    start_total = start_time.hour * 60 + start_time.minute
    end_total = end_time.hour * 60 + end_time.minute
    
    # 夜间时间段
    night_start = parse_time_string(night_start_time) or time(22, 0)
    night_end = parse_time_string(night_end_time) or time(6, 0)
    night_start_total = night_start.hour * 60 + night_start.minute
    night_end_total = night_end.hour * 60 + night_end.minute
    
    # 检查是否是夜间
    is_night_time = (check_total >= night_start_total) or (check_total < night_end_total)
    
    if is_night_time:
        if permitted_night_work:
            # 有夜间施工许可，检查夜间时间段
            if night_start_total <= check_total or check_total < night_end_total:
                return True, "在夜间施工许可时间内"
            else:
                return False, "不在夜间施工许可时间内"
        else:
            return False, "夜间施工无许可"
    else:
        # 昼间检查
        if start_total <= check_total < end_total:
            return True, "在昼间施工许可时间内"
        else:
            return False, f"不在昼间施工许可时间内 ({permit_start_time}-{permit_end_time})"
