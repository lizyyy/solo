import pandas as pd
import numpy as np
from datetime import datetime, timedelta, time, date
from typing import Dict, List, Tuple, Optional
import json
import random
import os


# 小区列表
COMMUNITIES = [
    "幸福小区", "阳光花园", "绿洲家园", "锦绣华庭", "东方明珠",
    "河畔雅居", "星城国际", "御景湾", "金茂府", "碧桂园",
    "恒大名都", "万科城", "保利花园", "融创文旅城", "中海国际"
]

# 噪声源类型
NOISE_SOURCES = [
    "施工噪声", "装修噪声", "商业噪声", "娱乐场所噪声",
    "交通噪声", "邻里噪声", "空调外机", "广场舞",
    "夜市摊位", "建筑工地", "道路施工", "地铁施工"
]

# 处理结果
ENFORCEMENT_RESULTS = [
    "已劝阻", "已警告", "已处罚", "责令整改", "限期整改",
    "立案调查", "协调解决", "未发现违法", "投诉不实"
]

# 施工单位
CONTRACTORS = [
    "中建一局", "中建二局", "中铁建工", "上海建工", "北京建工",
    "当地建筑公司", "市政工程公司", "道路工程公司", "装修公司"
]

# 投诉人姓名（示例）
REPORTERS = [
    "张三", "李四", "王五", "赵六", "钱七",
    "孙八", "周九", "吴十", "郑某", "王某",
    "李某", "张某", "刘某", "陈某", "杨某"
]


def random_date_range(
    start_date: Optional[date] = None,
    days: int = 7
) -> Tuple[datetime, datetime]:
    """生成随机日期范围"""
    if start_date is None:
        start_date = date.today() - timedelta(days=days)
    
    start_dt = datetime.combine(start_date, time(0, 0))
    end_dt = start_dt + timedelta(days=days)
    
    return start_dt, end_dt


def random_time_in_range(
    start_dt: datetime,
    end_dt: datetime,
    night_probability: float = 0.6
) -> datetime:
    """
    生成随机时间，夜间时段概率较高
    夜间定义: 22:00 - 06:00
    """
    total_seconds = int((end_dt - start_dt).total_seconds())
    
    if random.random() < night_probability:
        # 夜间时段
        day_offset = random.randint(0, int((end_dt - start_dt).total_seconds() // 86400))
        base_date = start_dt + timedelta(days=day_offset)
        
        # 22:00 - 06:00
        if random.random() < 0.5:
            # 22:00 - 24:00
            hour = random.randint(22, 23)
        else:
            # 00:00 - 06:00
            hour = random.randint(0, 5)
        
        minute = random.randint(0, 59)
        return datetime.combine(base_date.date(), time(hour, minute))
    else:
        # 随机时间
        random_seconds = random.randint(0, total_seconds)
        return start_dt + timedelta(seconds=random_seconds)


def generate_sample_complaints(
    start_dt: datetime,
    end_dt: datetime,
    count: int = 50
) -> pd.DataFrame:
    """
    生成示例投诉数据
    
    返回:
    - 投诉DataFrame
    """
    data = []
    
    for i in range(1, count + 1):
        complaint_time = random_time_in_range(start_dt, end_dt)
        community = random.choice(COMMUNITIES)
        noise_source = random.choice(NOISE_SOURCES)
        reporter = random.choice(REPORTERS)
        
        # 生成一些重复投诉（同一小区、同一噪声源、相近时间）
        if random.random() < 0.3 and i > 1:
            # 选择之前的一条投诉作为重复
            prev_idx = random.randint(0, len(data) - 1)
            prev = data[prev_idx]
            community = prev['community']
            noise_source = prev['noise_source']
            # 时间相近（30分钟内）
            time_diff = timedelta(minutes=random.randint(5, 30))
            complaint_time = prev['complaint_time'] + time_diff
        
        data.append({
            'complaint_id': f"C{20260503000 + i:05d}",
            'community': community,
            'noise_source': noise_source,
            'complaint_time': complaint_time,
            'description': f"在{community}附近{noise_source}扰民，影响休息",
            'reporter': reporter,
            'phone': f"138{random.randint(1000, 9999):04d}{random.randint(1000, 9999):04d}"
        })
    
    df = pd.DataFrame(data)
    
    # 添加派生列
    df['date'] = df['complaint_time'].dt.date
    df['hour'] = df['complaint_time'].dt.hour
    df['is_night'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
    
    return df


def generate_sample_decibel_data(
    start_dt: datetime,
    end_dt: datetime,
    interval_minutes: int = 15,
    locations: Optional[List[str]] = None
) -> pd.DataFrame:
    """
    生成示例分贝仪数据
    
    参数:
    - interval_minutes: 测量间隔（分钟）
    - locations: 测量地点列表
    
    返回:
    - 分贝仪DataFrame
    """
    if locations is None:
        locations = random.sample(COMMUNITIES, 5)
    
    data = []
    
    for location in locations:
        current_dt = start_dt
        while current_dt <= end_dt:
            # 基础噪声水平
            hour = current_dt.hour
            minute = current_dt.minute
            
            # 夜间噪声通常较低，但可能有施工噪声
            is_night = 22 <= hour < 24 or 0 <= hour < 6
            
            if is_night:
                # 夜间基础噪声
                base_db = random.uniform(40, 50)
                
                # 随机添加噪声事件
                if random.random() < 0.15:  # 15%概率有噪声事件
                    # 施工或其他噪声
                    noise_type = random.random()
                    if noise_type < 0.6:
                        # 施工噪声
                        db_value = random.uniform(65, 85)
                    else:
                        # 其他噪声
                        db_value = random.uniform(55, 70)
                else:
                    db_value = base_db
            else:
                # 昼间噪声
                base_db = random.uniform(50, 60)
                
                # 昼间交通等噪声
                if 7 <= hour < 9 or 17 <= hour < 19:
                    # 高峰期
                    base_db += random.uniform(5, 15)
                elif random.random() < 0.1:
                    # 随机噪声事件
                    db_value = random.uniform(65, 80)
                else:
                    db_value = base_db
            
            # 添加一些波动
            db_value += random.uniform(-2, 2)
            
            data.append({
                'timestamp': current_dt,
                'location': location,
                'db_value': round(db_value, 1),
                'is_peak': db_value > 70,
                'measurement_type': 'continuous'
            })
            
            current_dt += timedelta(minutes=interval_minutes)
    
    df = pd.DataFrame(data)
    
    # 添加派生列
    df['date'] = df['timestamp'].dt.date
    df['hour'] = df['timestamp'].dt.hour
    df['minute'] = df['timestamp'].dt.minute
    df['is_night'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
    
    # 计算是否超标
    df['exceeds_standard'] = df.apply(
        lambda row: row['db_value'] > (55 if row['is_night'] else 70),
        axis=1
    )
    
    return df


def generate_sample_enforcement_records(
    complaints_df: pd.DataFrame,
    response_rate: float = 0.85
) -> pd.DataFrame:
    """
    生成示例执法记录
    
    参数:
    - complaints_df: 投诉数据
    - response_rate: 响应率
    
    返回:
    - 执法记录DataFrame
    """
    data = []
    
    for idx, complaint in complaints_df.iterrows():
        if random.random() > response_rate:
            continue  # 不响应
        
        complaint_id = complaint['complaint_id']
        complaint_time = complaint['complaint_time']
        
        # 响应时间（10-60分钟）
        response_minutes = random.randint(10, 60)
        arrival_time = complaint_time + timedelta(minutes=response_minutes)
        
        # 执法时长（20-90分钟）
        enforcement_duration = random.randint(20, 90)
        departure_time = arrival_time + timedelta(minutes=enforcement_duration)
        
        # 处理结果
        result = random.choice(ENFORCEMENT_RESULTS)
        
        # 采取措施
        if result in ["已处罚", "责令整改", "限期整改"]:
            action_taken = "开具整改通知书，责令立即停止违规行为"
        elif result == "已劝阻" or result == "已警告":
            action_taken = "现场劝阻，警告施工单位遵守噪声规定"
        elif result == "协调解决":
            action_taken = "协调双方达成和解协议"
        else:
            action_taken = "现场调查取证"
        
        data.append({
            'enforcement_id': f"E{20260503000 + len(data) + 1:05d}",
            'complaint_id': complaint_id,
            'community': complaint['community'],
            'arrival_time': arrival_time,
            'departure_time': departure_time,
            'noise_source': complaint['noise_source'],
            'action_taken': action_taken,
            'result': result,
            'officer_name': f"执法人员{random.randint(1, 20)}"
        })
    
    df = pd.DataFrame(data)
    
    if not df.empty:
        df['date'] = df['arrival_time'].dt.date
        df['hour'] = df['arrival_time'].dt.hour
        df['is_night_enforcement'] = df['hour'].apply(lambda x: 22 <= x < 24 or 0 <= x < 6)
        df['enforcement_duration_minutes'] = (
            df['departure_time'] - df['arrival_time']
        ).dt.total_seconds() / 60
    
    return df


def generate_sample_construction_permits(
    start_dt: datetime,
    end_dt: datetime,
    count: int = 8
) -> pd.DataFrame:
    """
    生成示例施工许可数据
    
    返回:
    - 施工许可DataFrame
    """
    data = []
    
    for i in range(1, count + 1):
        # 许可日期范围
        permit_days = random.randint(7, 30)
        permit_start = start_dt.date() + timedelta(days=random.randint(-3, 3))
        permit_end = permit_start + timedelta(days=permit_days)
        
        # 是否允许夜间施工
        permitted_night_work = random.random() < 0.3
        
        # 影响小区
        affected_communities = random.sample(COMMUNITIES, random.randint(1, 3))
        
        data.append({
            'permit_id': f"P{20260503000 + i:05d}",
            'project_name': f"项目{i} - {'道路改造' if i % 2 == 0 else '住宅建设'}",
            'location': f"{affected_communities[0]}周边",
            'community': ', '.join(affected_communities),
            'permit_start_date': permit_start,
            'permit_end_date': permit_end,
            'permitted_start_time': "08:00",
            'permitted_end_time': "22:00",
            'permitted_night_work': permitted_night_work,
            'night_start_time': "22:00" if permitted_night_work else None,
            'night_end_time': "06:00" if permitted_night_work else None,
            'contractor': random.choice(CONTRACTORS),
            'contact_person': f"负责人{random.randint(1, 10)}",
            'contact_phone': f"010-{random.randint(10000000, 99999999)}"
        })
    
    df = pd.DataFrame(data)
    return df


def generate_sample_data(
    days: int = 7,
    start_date: Optional[date] = None,
    save_to_files: bool = False,
    output_dir: str = "./sample_data"
) -> Dict[str, pd.DataFrame]:
    """
    生成所有示例数据
    
    参数:
    - days: 数据覆盖天数
    - start_date: 开始日期
    - save_to_files: 是否保存到文件
    - output_dir: 输出目录
    
    返回:
    - 包含所有数据的字典
    """
    start_dt, end_dt = random_date_range(start_date, days)
    
    print(f"生成示例数据，时间范围: {start_dt.date()} 至 {end_dt.date()}")
    
    # 生成数据
    print("  - 生成投诉数据...")
    complaints = generate_sample_complaints(start_dt, end_dt, count=50)
    
    print("  - 生成分贝仪数据...")
    decibel = generate_sample_decibel_data(start_dt, end_dt, interval_minutes=15)
    
    print("  - 生成执法记录...")
    enforcement = generate_sample_enforcement_records(complaints)
    
    print("  - 生成施工许可...")
    permits = generate_sample_construction_permits(start_dt, end_dt, count=8)
    
    result = {
        'complaints': complaints,
        'decibel': decibel,
        'enforcement': enforcement,
        'permits': permits
    }
    
    # 保存到文件
    if save_to_files:
        os.makedirs(output_dir, exist_ok=True)
        
        print(f"\n保存数据到 {output_dir}:")
        
        # 保存投诉数据
        complaints_path = os.path.join(output_dir, "complaints.csv")
        complaints.to_csv(complaints_path, index=False, encoding='utf-8-sig')
        print(f"  - 投诉数据: {complaints_path} ({len(complaints)} 条)")
        
        # 保存分贝仪数据 (JSONL格式)
        decibel_path = os.path.join(output_dir, "decibel_meter.jsonl")
        with open(decibel_path, 'w', encoding='utf-8') as f:
            for _, row in decibel.iterrows():
                record = {
                    'timestamp': row['timestamp'].isoformat(),
                    'location': row['location'],
                    'db_value': row['db_value'],
                    'is_peak': bool(row['is_peak']),
                    'measurement_type': row['measurement_type']
                }
                f.write(json.dumps(record, ensure_ascii=False) + '\n')
        print(f"  - 分贝仪数据: {decibel_path} ({len(decibel)} 条)")
        
        # 保存执法记录
        if not enforcement.empty:
            enforcement_path = os.path.join(output_dir, "enforcement_records.csv")
            enforcement.to_csv(enforcement_path, index=False, encoding='utf-8-sig')
            print(f"  - 执法记录: {enforcement_path} ({len(enforcement)} 条)")
        
        # 保存施工许可
        permits_path = os.path.join(output_dir, "construction_permits.csv")
        permits.to_csv(permits_path, index=False, encoding='utf-8-sig')
        print(f"  - 施工许可: {permits_path} ({len(permits)} 条)")
    
    print(f"\n数据统计:")
    print(f"  - 投诉记录: {len(complaints)} 条")
    print(f"  - 分贝测量: {len(decibel)} 条")
    print(f"  - 执法记录: {len(enforcement)} 条")
    print(f"  - 施工许可: {len(permits)} 条")
    
    return result


if __name__ == "__main__":
    # 测试生成
    generate_sample_data(days=7, save_to_files=True)
