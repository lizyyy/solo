#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
示例数据模块
提供演示用的彩排方案数据
"""

from datetime import time
from typing import Dict
from .models import (
    RehearsalPlan, Microphone, ScheduleEntry, 
    ForbiddenBand, ChannelInfo
)


def create_sample_plan() -> RehearsalPlan:
    """创建一个示例彩排方案，包含一些故意设置的问题用于演示"""
    plan = RehearsalPlan()
    plan.name = "《茶馆》小剧场彩排方案 (示例)"
    plan.notes = "这是一个示例彩排方案，包含一些故意设置的频率冲突和问题，用于演示系统的检测功能。"
    
    mics = [
        Microphone(
            device_id="MIC-001",
            actor_name="王利发",
            frequency=640.1,
            channel="CH-01",
            battery_level=85.0,
            backup_frequency=650.5,
            backup_channel="CH-10"
        ),
        Microphone(
            device_id="MIC-002",
            actor_name="秦仲义",
            frequency=640.3,
            channel="CH-02",
            battery_level=92.0,
            backup_frequency=650.8,
            backup_channel="CH-11"
        ),
        Microphone(
            device_id="MIC-003",
            actor_name="常四爷",
            frequency=642.0,
            channel="CH-03",
            battery_level=12.0,
            backup_frequency=None,
            backup_channel=None
        ),
        Microphone(
            device_id="MIC-004",
            actor_name="松二爷",
            frequency=640.2,
            channel="CH-04",
            battery_level=78.0,
            backup_frequency=651.0,
            backup_channel="CH-12"
        ),
        Microphone(
            device_id="MIC-005",
            actor_name="唐铁嘴",
            frequency=643.5,
            channel="CH-05",
            battery_level=45.0,
            backup_frequency=None,
            backup_channel=None
        ),
        Microphone(
            device_id="MIC-006",
            actor_name="刘麻子",
            frequency=643.0,
            channel="CH-06",
            battery_level=95.0,
            backup_frequency=652.0,
            backup_channel="CH-13"
        ),
    ]
    plan.microphones = mics
    
    schedule = [
        ScheduleEntry(
            scene_name="第一幕：开场",
            start_time=time(19, 0, 0),
            end_time=time(19, 20, 0),
            actor_names=["王利发", "秦仲义", "常四爷"],
            notes="茶馆开业，主要人物登场"
        ),
        ScheduleEntry(
            scene_name="第一幕：冲突",
            start_time=time(19, 15, 0),
            end_time=time(19, 35, 0),
            actor_names=["常四爷", "松二爷", "唐铁嘴"],
            notes="与上一场有时间重叠，用于测试重叠场景检测"
        ),
        ScheduleEntry(
            scene_name="第二幕：发展",
            start_time=time(19, 35, 0),
            end_time=time(19, 55, 0),
            actor_names=["王利发", "刘麻子", "唐铁嘴"],
            notes="王利发继续营业"
        ),
        ScheduleEntry(
            scene_name="第三幕：高潮",
            start_time=time(19, 55, 0),
            end_time=time(20, 15, 0),
            actor_names=["秦仲义", "常四爷", "王利发"],
            notes="主要人物重聚"
        ),
    ]
    plan.schedule = schedule
    
    forbidden_bands = [
        ForbiddenBand(
            name="对讲机频段",
            start_freq=640.0,
            end_freq=640.5,
            reason="剧组对讲机使用此频段，会产生严重干扰"
        ),
        ForbiddenBand(
            name="广播电台",
            start_freq=655.0,
            end_freq=656.0,
            reason="本地广播电台信号"
        ),
    ]
    plan.forbidden_bands = forbidden_bands
    
    channels = [
        ChannelInfo(channel_name="CH-01", center_freq=640.1, is_available=False),
        ChannelInfo(channel_name="CH-02", center_freq=640.3, is_available=False),
        ChannelInfo(channel_name="CH-03", center_freq=642.0, is_available=False),
        ChannelInfo(channel_name="CH-04", center_freq=640.2, is_available=False),
        ChannelInfo(channel_name="CH-05", center_freq=643.5, is_available=False),
        ChannelInfo(channel_name="CH-06", center_freq=643.0, is_available=False),
        ChannelInfo(channel_name="CH-07", center_freq=645.0, is_available=True),
        ChannelInfo(channel_name="CH-08", center_freq=645.5, is_available=True),
        ChannelInfo(channel_name="CH-09", center_freq=646.0, is_available=True),
        ChannelInfo(channel_name="CH-10", center_freq=650.5, is_available=False),
        ChannelInfo(channel_name="CH-11", center_freq=650.8, is_available=False),
        ChannelInfo(channel_name="CH-12", center_freq=651.0, is_available=False),
        ChannelInfo(channel_name="CH-13", center_freq=652.0, is_available=False),
        ChannelInfo(channel_name="CH-14", center_freq=653.0, is_available=True),
        ChannelInfo(channel_name="CH-15", center_freq=654.0, is_available=True),
    ]
    plan.channels = channels
    
    return plan


def get_sample_csv_templates() -> Dict[str, str]:
    """获取示例CSV模板内容"""
    mics_csv = """device_id,actor_name,frequency,channel,battery_level,backup_frequency,backup_channel,notes
MIC-001,王利发,640.1,CH-01,85,650.5,CH-10,主角
MIC-002,秦仲义,640.3,CH-02,92,650.8,CH-11,主角
MIC-003,常四爷,642.0,CH-03,12,,,"""
    
    schedule_csv = """scene_name,start_time,end_time,actor_names,notes
第一幕：开场,19:00:00,19:20:00,王利发,秦仲义,常四爷,茶馆开业
第一幕：冲突,19:15:00,19:35:00,常四爷,松二爷,唐铁嘴,与上场重叠"""
    
    forbidden_csv = """name,start_freq,end_freq,reason
对讲机频段,640.0,640.5,剧组对讲机
广播电台,655.0,656.0,本地电台"""
    
    channels_csv = """channel_name,center_freq,bandwidth,is_available
CH-01,640.1,0.2,False
CH-02,640.3,0.2,False
CH-07,645.0,0.2,True"""
    
    return {
        "microphones": mics_csv,
        "schedule": schedule_csv,
        "forbidden_bands": forbidden_csv,
        "channels": channels_csv
    }
