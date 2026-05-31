#!/usr/bin/env python3
"""
空压机能耗诊断系统 - 示例数据生成脚本
生成模拟的能耗和振动数据用于测试
"""

import os
import sys
import random
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app import models

Base.metadata.create_all(bind=engine)


def generate_energy_data(compressor_id: int, start_date: datetime, days: int = 7) -> pd.DataFrame:
    """生成能耗数据"""
    records = []
    current_time = start_date
    end_time = start_date + timedelta(days=days)

    while current_time < end_time:
        hour = current_time.hour

        if 8 <= hour < 18:
            base_power = 85 + random.gauss(0, 5)
            load_factor = 0.85 + random.gauss(0, 0.05)
        elif 18 <= hour < 22:
            base_power = 65 + random.gauss(0, 8)
            load_factor = 0.65 + random.gauss(0, 0.08)
        else:
            base_power = 45 + random.gauss(0, 10)
            load_factor = 0.45 + random.gauss(0, 0.1)

        if random.random() < 0.05:
            base_power += random.uniform(20, 40)

        if random.random() < 0.02:
            base_power -= random.uniform(15, 25)

        power = max(20, min(120, base_power))
        load_rate = max(20, min(100, load_factor * 100))
        current = power / 0.38 / 1.732 / 0.85 if power > 0 else 0
        voltage = 380 + random.gauss(0, 5)
        pressure = 0.7 + random.gauss(0, 0.03)
        temperature = 75 + random.gauss(0, 5) + (power - 70) * 0.1
        flow_rate = 10 + load_rate * 0.15 + random.gauss(0, 0.5)

        records.append({
            "时间": current_time,
            "功率(kW)": round(power, 2),
            "电流(A)": round(current, 2),
            "电压(V)": round(voltage, 1),
            "压力(MPa)": round(max(0.5, min(0.95, pressure)), 3),
            "流量(m³/min)": round(max(5, flow_rate), 2),
            "温度(℃)": round(max(50, min(110, temperature)), 1),
            "负载率(%)": round(load_rate, 1),
        })

        current_time += timedelta(minutes=15)

    return pd.DataFrame(records)


def generate_vibration_data(compressor_id: int, start_date: datetime, days: int = 7) -> pd.DataFrame:
    """生成振动数据"""
    records = []
    current_time = start_date
    end_time = start_date + timedelta(days=days)

    base_overall = 2.0
    base_x = 1.5
    base_y = 1.2
    base_z = 1.0

    while current_time < end_time:
        hour = current_time.hour
        day_factor = 1.0 if 8 <= hour < 22 else 0.7

        overall = base_overall * day_factor + random.gauss(0, 0.3)
        x_vib = base_x * day_factor + random.gauss(0, 0.2)
        y_vib = base_y * day_factor + random.gauss(0, 0.2)
        z_vib = base_z * day_factor + random.gauss(0, 0.2)

        if random.random() < 0.03:
            overall += random.uniform(1.5, 3.0)
            x_vib += random.uniform(1.0, 2.0)
            y_vib += random.uniform(0.8, 1.5)
            z_vib += random.uniform(0.5, 1.2)

        if random.random() < 0.01:
            overall += random.uniform(3.0, 5.0)
            x_vib += random.uniform(2.0, 3.5)
            y_vib += random.uniform(1.5, 2.5)
            z_vib += random.uniform(1.0, 2.0)

        records.append({
            "时间": current_time,
            "X向振动(mm/s)": round(max(0.1, x_vib), 3),
            "Y向振动(mm/s)": round(max(0.1, y_vib), 3),
            "Z向振动(mm/s)": round(max(0.1, z_vib), 3),
            "总振动(mm/s)": round(max(0.1, overall), 3),
        })

        current_time += timedelta(minutes=30)

    return pd.DataFrame(records)


def save_sample_data():
    """生成并保存示例数据"""
    db = SessionLocal()

    try:
        print("创建示例空压机设备...")
        compressor1 = models.Compressor(
            equipment_no="AC-001",
            name="1号空压机",
            model="GA-110",
            rated_power=110.0,
            rated_pressure=0.85,
            location="空压机房A区",
        )
        compressor2 = models.Compressor(
            equipment_no="AC-002",
            name="2号空压机",
            model="GA-90",
            rated_power=90.0,
            rated_pressure=0.85,
            location="空压机房A区",
        )
        db.add(compressor1)
        db.add(compressor2)
        db.flush()

        print(f"设备ID: AC-001={compressor1.id}, AC-002={compressor2.id}")

        start_date = datetime.now() - timedelta(days=7)
        start_date = start_date.replace(hour=0, minute=0, second=0, microsecond=0)

        print("生成1号空压机能耗数据...")
        energy_df1 = generate_energy_data(compressor1.id, start_date, days=7)

        print("生成1号空压机振动数据...")
        vibration_df1 = generate_vibration_data(compressor1.id, start_date, days=7)

        print("生成2号空压机能耗数据...")
        energy_df2 = generate_energy_data(compressor2.id, start_date, days=7)

        print("生成2号空压机振动数据...")
        vibration_df2 = generate_vibration_data(compressor2.id, start_date, days=7)

        print("保存能耗数据到数据库...")
        batch_id1 = f"sample_energy_{datetime.now().strftime('%Y%m%d')}_001"
        batch_id2 = f"sample_energy_{datetime.now().strftime('%Y%m%d')}_002"

        for _, row in energy_df1.iterrows():
            record = models.EnergyRecord(
                compressor_id=compressor1.id,
                record_time=row["时间"],
                power=row["功率(kW)"],
                current=row["电流(A)"],
                voltage=row["电压(V)"],
                pressure=row["压力(MPa)"],
                flow_rate=row["流量(m³/min)"],
                temperature=row["温度(℃)"],
                load_rate=row["负载率(%)"],
                batch_id=batch_id1,
                source_file="sample_data",
            )
            db.add(record)

        for _, row in energy_df2.iterrows():
            record = models.EnergyRecord(
                compressor_id=compressor2.id,
                record_time=row["时间"],
                power=row["功率(kW)"],
                current=row["电流(A)"],
                voltage=row["电压(V)"],
                pressure=row["压力(MPa)"],
                flow_rate=row["流量(m³/min)"],
                temperature=row["温度(℃)"],
                load_rate=row["负载率(%)"],
                batch_id=batch_id2,
                source_file="sample_data",
            )
            db.add(record)

        print("保存振动数据到数据库...")
        vib_batch_id1 = f"sample_vib_{datetime.now().strftime('%Y%m%d')}_001"
        vib_batch_id2 = f"sample_vib_{datetime.now().strftime('%Y%m%d')}_002"

        for _, row in vibration_df1.iterrows():
            record = models.VibrationRecord(
                compressor_id=compressor1.id,
                record_time=row["时间"],
                x_vibration=row["X向振动(mm/s)"],
                y_vibration=row["Y向振动(mm/s)"],
                z_vibration=row["Z向振动(mm/s)"],
                overall_vibration=row["总振动(mm/s)"],
                batch_id=vib_batch_id1,
                source_file="sample_data",
            )
            db.add(record)

        for _, row in vibration_df2.iterrows():
            record = models.VibrationRecord(
                compressor_id=compressor2.id,
                record_time=row["时间"],
                x_vibration=row["X向振动(mm/s)"],
                y_vibration=row["Y向振动(mm/s)"],
                z_vibration=row["Z向振动(mm/s)"],
                overall_vibration=row["总振动(mm/s)"],
                batch_id=vib_batch_id2,
                source_file="sample_data",
            )
            db.add(record)

        print("保存Excel示例文件...")
        sample_dir = os.path.join(os.path.dirname(__file__), "data", "sample")
        os.makedirs(sample_dir, exist_ok=True)

        energy_df1.to_excel(os.path.join(sample_dir, "AC-001_能耗数据.xlsx"), index=False)
        vibration_df1.to_excel(os.path.join(sample_dir, "AC-001_振动数据.xlsx"), index=False)
        energy_df2.to_excel(os.path.join(sample_dir, "AC-002_能耗数据.xlsx"), index=False)
        vibration_df2.to_excel(os.path.join(sample_dir, "AC-002_振动数据.xlsx"), index=False)

        db.commit()

        print("")
        print("==========================================")
        print("示例数据生成完成！")
        print(f"  - 能耗记录: {len(energy_df1) + len(energy_df2)} 条")
        print(f"  - 振动记录: {len(vibration_df1) + len(vibration_df2)} 条")
        print(f"  - 设备数量: 2台 (AC-001, AC-002)")
        print(f"  - 时间范围: {start_date.strftime('%Y-%m-%d')} ~ {(start_date + timedelta(days=7)).strftime('%Y-%m-%d')}")
        print("")
        print("示例Excel文件已保存到 data/sample/ 目录")
        print("可用于测试数据导入功能")
        print("==========================================")

    except Exception as e:
        db.rollback()
        print(f"生成示例数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    random.seed(42)
    np.random.seed(42)
    save_sample_data()
