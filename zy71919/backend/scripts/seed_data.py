#!/usr/bin/env python3
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.models import (
    AudioTrack,
    AdScript,
    SoundMaterial,
    MatchRelation,
)
from app.utils.common import (
    generate_trace_id,
    generate_track_no,
    generate_script_no,
    generate_material_no,
    calculate_file_hash,
)


def seed_test_data():
    db = SessionLocal()

    try:
        print("正在插入测试数据...")

        track1 = AudioTrack(
            track_no=generate_track_no(),
            title="播客节目第1期-开场音乐",
            duration=180.5,
            file_path="/audio/tracks/episode1_opening.mp3",
            file_hash=calculate_file_hash(b"track1_content"),
            recorded_at=datetime.now() - timedelta(days=30),
            trace_id=generate_trace_id(),
        )
        track2 = AudioTrack(
            track_no=generate_track_no(),
            title="播客节目第1期-采访片段",
            duration=450.0,
            file_path="/audio/tracks/episode1_interview.mp3",
            file_hash=calculate_file_hash(b"track2_content"),
            recorded_at=datetime.now() - timedelta(days=29),
            trace_id=generate_trace_id(),
        )
        track3 = AudioTrack(
            track_no=generate_track_no(),
            title="播客节目第2期-主题讨论",
            duration=600.0,
            file_path="/audio/tracks/episode2_discussion.mp3",
            file_hash=calculate_file_hash(b"track3_content"),
            recorded_at=datetime.now() - timedelta(days=15),
            trace_id=generate_trace_id(),
        )

        db.add_all([track1, track2, track3])
        db.flush()

        script1 = AdScript(
            script_no=generate_script_no(),
            track_id=track1.id,
            track_no=track1.track_no,
            content="欢迎收听本期播客，今天我们来聊聊环境音在播客中的应用。首先为您带来一段舒缓的背景音乐。",
            start_time=0.0,
            end_time=15.0,
            batch_no="BATCH_202401",
            version=1,
            trace_id=generate_trace_id(),
        )
        script2 = AdScript(
            script_no=generate_script_no(),
            track_id=track1.id,
            track_no=track1.track_no,
            content="在今天的节目中，我们特别添加了雨声和咖啡馆背景音，营造沉浸式收听体验。",
            start_time=15.0,
            end_time=35.0,
            batch_no="BATCH_202401",
            version=1,
            trace_id=generate_trace_id(),
        )
        script3 = AdScript(
            script_no=generate_script_no(),
            track_id=track2.id,
            track_no=track2.track_no,
            content="接下来是采访环节，背景使用了轻柔的钢琴音乐过渡。",
            start_time=0.0,
            end_time=20.0,
            batch_no="BATCH_202401",
            version=1,
            trace_id=generate_trace_id(),
        )
        script4 = AdScript(
            script_no=generate_script_no(),
            track_id=track3.id,
            track_no=track3.track_no,
            content="本期主题讨论使用了自然鸟鸣声作为开场，营造轻松的讨论氛围。",
            start_time=0.0,
            end_time=25.0,
            batch_no="BATCH_202402",
            version=1,
            trace_id=generate_trace_id(),
        )

        db.add_all([script1, script2, script3, script4])
        db.flush()

        mat1 = SoundMaterial(
            material_no=generate_material_no(),
            name="舒缓钢琴曲",
            type="背景音乐",
            duration=120.0,
            file_path="/audio/materials/piano_soft.mp3",
            file_hash=calculate_file_hash(b"material1_content"),
            tags="钢琴,舒缓,轻音乐,开场",
            description="轻柔的钢琴曲，适合节目开场",
            status="confirmed",
            confidence=0.85,
            trace_id=generate_trace_id(),
        )
        mat2 = SoundMaterial(
            material_no=generate_material_no(),
            name="雨天环境音",
            type="环境音",
            duration=180.0,
            file_path="/audio/materials/rain_ambient.mp3",
            file_hash=calculate_file_hash(b"material2_content"),
            tags="雨声,自然,白噪音,氛围",
            description="淅淅沥沥的雨声，适合营造沉浸式体验",
            status="confirmed",
            confidence=0.92,
            trace_id=generate_trace_id(),
        )
        mat3 = SoundMaterial(
            material_no=generate_material_no(),
            name="咖啡馆背景音",
            type="环境音",
            duration=240.0,
            file_path="/audio/materials/cafe_ambient.mp3",
            file_hash=calculate_file_hash(b"material3_content"),
            tags="咖啡馆,人声,氛围,背景",
            description="咖啡馆背景人声和咖啡杯碰撞声",
            status="confirmed",
            confidence=0.78,
            trace_id=generate_trace_id(),
        )
        mat4 = SoundMaterial(
            material_no=generate_material_no(),
            name="鸟鸣声",
            type="自然音",
            duration=60.0,
            file_path="/audio/materials/birds_singing.mp3",
            file_hash=calculate_file_hash(b"material4_content"),
            tags="鸟叫,自然,清晨,轻松",
            description="清晨林间鸟鸣声",
            status="pending",
            confidence=0.65,
            trace_id=generate_trace_id(),
        )
        mat5 = SoundMaterial(
            material_no=generate_material_no(),
            name="过渡音效-钢琴",
            type="转场音",
            duration=5.0,
            file_path="/audio/materials/transition_piano.mp3",
            file_hash=calculate_file_hash(b"material5_content"),
            tags="钢琴,过渡,转场,采访",
            description="简短的钢琴过渡音，适合采访环节转场",
            status="matched",
            confidence=0.72,
            trace_id=generate_trace_id(),
        )
        mat6 = SoundMaterial(
            material_no=generate_material_no(),
            name="海浪声",
            type="自然音",
            duration=300.0,
            file_path="/audio/materials/ocean_waves.mp3",
            file_hash=calculate_file_hash(b"material6_content"),
            tags="海浪,大海,自然,放松",
            description="舒缓的海浪拍岸声",
            status="pending",
            confidence=None,
            trace_id=generate_trace_id(),
        )

        db.add_all([mat1, mat2, mat3, mat4, mat5, mat6])
        db.flush()

        match1 = MatchRelation(
            material_id=mat1.id,
            ad_script_id=script1.id,
            audio_track_id=track1.id,
            match_type="auto",
            confidence=0.85,
            status="confirmed",
            remark="自动匹配，与开场钢琴曲高度相关",
            created_by="system",
            trace_id=generate_trace_id(),
        )
        match2 = MatchRelation(
            material_id=mat2.id,
            ad_script_id=script2.id,
            audio_track_id=track1.id,
            match_type="auto",
            confidence=0.92,
            status="confirmed",
            remark="自动匹配，雨声环境音与口播内容高度契合",
            created_by="system",
            trace_id=generate_trace_id(),
        )
        match3 = MatchRelation(
            material_id=mat3.id,
            ad_script_id=script2.id,
            audio_track_id=track1.id,
            match_type="manual",
            confidence=0.78,
            status="confirmed",
            remark="人工确认，咖啡馆背景音作为辅助环境音",
            created_by="admin",
            trace_id=generate_trace_id(),
        )
        match4 = MatchRelation(
            material_id=mat5.id,
            ad_script_id=script3.id,
            audio_track_id=track2.id,
            match_type="auto",
            confidence=0.72,
            status="pending",
            remark="自动匹配待确认",
            created_by="system",
            trace_id=generate_trace_id(),
        )

        db.add_all([match1, match2, match3, match4])

        db.commit()

        print("测试数据插入完成!")
        print(f"  - 原始音轨: 3条")
        print(f"  - 广告口播: 4条")
        print(f"  - 环境音素材: 6条")
        print(f"  - 匹配关系: 4条")

    except Exception as e:
        db.rollback()
        print(f"插入测试数据失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_test_data()
