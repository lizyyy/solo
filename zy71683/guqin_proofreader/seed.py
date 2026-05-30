"""
样例数据：模拟真实谱稿整理中常见的缺项、重复、手工更正、伪装正常数据等场景。

运行方式：python seed.py
会在 SQLite 中写入一份完整的样例数据集。
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine, SessionLocal, Base
from models import (
    Score, ScoreVersion, FingeringAnnotation, Measure,
    StudentAnnotation, VersionStatus, AuditLog,
)
from audit import log_audit

Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    db.query(AuditLog).delete()
    db.query(StudentAnnotation).delete()
    db.query(FingeringAnnotation).delete()
    db.query(Measure).delete()
    db.query(ScoreVersion).delete()
    db.query(Score).delete()
    db.commit()

    # ============================================================
    # 谱稿1：《流水》— 包含指法漏标、小节错位、手工更正
    # ============================================================
    score1 = Score(title="流水", composer="张孔山传谱", tuning="正调", mode="宫调")
    db.add(score1)
    db.flush()

    v1 = ScoreVersion(
        score_id=score1.id,
        version_number=1,
        content_json='{"title":"流水","sections":["引子","滚拂","尾声"]}',
        status=VersionStatus.superseded,
        change_note="初稿，仅录引子部分",
    )
    db.add(v1)
    db.flush()

    v2 = ScoreVersion(
        score_id=score1.id,
        version_number=2,
        content_json='{"title":"流水","sections":["引子","滚拂","连拂","尾声"]}',
        status=VersionStatus.reviewed,
        change_note="补录滚拂段、连拂段",
    )
    db.add(v2)
    db.flush()

    v1.superseded_by = v2.id

    # 小节位置（v2）— 故意制造错位：第3小节跳到第5小节
    measures_v2 = [
        Measure(score_id=score1.id, version_id=v2.id, measure_number=1, start_position=0.0, end_position=4.0, beat_count=4.0, time_signature="4/4"),
        Measure(score_id=score1.id, version_id=v2.id, measure_number=2, start_position=4.0, end_position=8.0, beat_count=4.0, time_signature="4/4"),
        # 第3小节缺失 — 模拟小节编号不连续
        Measure(score_id=score1.id, version_id=v2.id, measure_number=5, start_position=8.0, end_position=12.0, beat_count=4.0, time_signature="4/4"),
        Measure(score_id=score1.id, version_id=v2.id, measure_number=6, start_position=12.0, end_position=16.0, beat_count=3.0, time_signature="4/4", is_manually_adjusted=True),
        # 第6小节拍数异常：拍号4/4但拍数3.0，且已手工调整
        Measure(score_id=score1.id, version_id=v2.id, measure_number=7, start_position=16.0, end_position=20.0, beat_count=4.0, time_signature="4/4"),
        Measure(score_id=score1.id, version_id=v2.id, measure_number=8, start_position=15.5, end_position=20.0, beat_count=4.0, time_signature="4/4"),
        # 第8小节起始位置15.5 < 第7小节结束位置20.0 — 模拟小节位置重叠
    ]
    for m in measures_v2:
        db.add(m)
    db.flush()

    # 指法标注（v2）— 包含漏标、重复、手工更正、弦号越界、未知指法
    fingerings_v2 = [
        # 第1小节正常标注
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=1, position_in_measure=1.0, jianzi_char="𠃋", fingering_type="抹", hand="右", string_number=1),
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=1, position_in_measure=2.0, jianzi_char="𠃌", fingering_type="挑", hand="右", string_number=3),
        # 第2小节正常标注
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=2, position_in_measure=1.0, jianzi_char="丿", fingering_type="勾", hand="右", string_number=4),
        # 第5小节有重复标注（同位置同指法出现两次）
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=5, position_in_measure=1.0, jianzi_char="𠃋", fingering_type="抹", hand="右", string_number=2),
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=5, position_in_measure=1.0, jianzi_char="𠃋", fingering_type="抹", hand="右", string_number=2),
        # 第5小节还有一条手工更正
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=5, position_in_measure=1.0, jianzi_char="𠃋", fingering_type="抹", hand="右", string_number=2, is_manual_correction=True, correction_reason="原标注弦号错误，手工更正为2弦"),
        # 第6小节有未知指法类型和弦号越界
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=6, position_in_measure=1.0, jianzi_char="〇", fingering_type="泛音", hand="左", string_number=5),
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=6, position_in_measure=2.0, jianzi_char="□", fingering_type="自创指法X", hand="右", string_number=9),
        # 弦号9超出1-7范围
        # 第7小节正常
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=7, position_in_measure=1.0, jianzi_char="丿", fingering_type="勾", hand="右", string_number=5),
        # 第8小节正常
        FingeringAnnotation(score_id=score1.id, version_id=v2.id, measure_number=8, position_in_measure=1.0, jianzi_char="𠃌", fingering_type="挑", hand="右", string_number=7),
        # 注意：第3、4小节不存在但也不会有指法（已通过小节编号不连续体现）
    ]
    for f in fingerings_v2:
        db.add(f)
    db.flush()

    # 学生批注
    annotations_s1 = [
        StudentAnnotation(score_id=score1.id, version_id=v2.id, measure_number=5, student_name="学生A", content="这里的抹指法为什么标了两遍？", annotation_type="疑问"),
        StudentAnnotation(score_id=score1.id, version_id=v2.id, measure_number=6, student_name="学生B", content="弦号9是不是写错了？古琴只有7根弦", annotation_type="纠错", is_resolved=True),
        # 下面这条看起来正常，但其实关联的是已被覆盖的v1
        StudentAnnotation(score_id=score1.id, version_id=v1.id, measure_number=1, student_name="学生C", content="引子部分节奏偏慢，建议标注渐快", annotation_type="建议"),
    ]
    for a in annotations_s1:
        db.add(a)
    db.flush()

    # ============================================================
    # 谱稿2：《酒狂》— 伪装正常数据：3/4拍号但拍数标注为4
    # ============================================================
    score2 = Score(title="酒狂", composer="阮籍传谱", tuning="正调", mode="羽调")
    db.add(score2)
    db.flush()

    v3 = ScoreVersion(
        score_id=score2.id,
        version_number=1,
        content_json='{"title":"酒狂","sections":["引","第一段","第二段","尾声"]}',
        status=VersionStatus.approved,
        change_note="定稿",
    )
    db.add(v3)
    db.flush()

    measures_s2 = [
        Measure(score_id=score2.id, version_id=v3.id, measure_number=1, start_position=0.0, end_position=3.0, beat_count=3.0, time_signature="3/4"),
        Measure(score_id=score2.id, version_id=v3.id, measure_number=2, start_position=3.0, end_position=7.0, beat_count=4.0, time_signature="3/4"),
        # 第2小节：拍号3/4但拍数为4 — 伪装正常，古琴酒狂确实有重拍移位，但数据层面不一致
        Measure(score_id=score2.id, version_id=v3.id, measure_number=3, start_position=7.0, end_position=10.0, beat_count=3.0, time_signature="3/4"),
    ]
    for m in measures_s2:
        db.add(m)
    db.flush()

    fingerings_s2 = [
        FingeringAnnotation(score_id=score2.id, version_id=v3.id, measure_number=1, position_in_measure=1.0, jianzi_char="𠃋", fingering_type="抹", hand="右", string_number=3),
        FingeringAnnotation(score_id=score2.id, version_id=v3.id, measure_number=2, position_in_measure=1.0, jianzi_char="𠃌", fingering_type="挑", hand="右", string_number=5),
        FingeringAnnotation(score_id=score2.id, version_id=v3.id, measure_number=3, position_in_measure=1.0, jianzi_char="丿", fingering_type="勾", hand="右", string_number=4),
    ]
    for f in fingerings_s2:
        db.add(f)
    db.flush()

    # ============================================================
    # 谱稿3：《阳关三叠》— 版本号重复、全小节无指法
    # ============================================================
    score3 = Score(title="阳关三叠", composer="古曲", tuning="正调", mode="商调")
    db.add(score3)
    db.flush()

    v4 = ScoreVersion(
        score_id=score3.id,
        version_number=1,
        content_json='{"title":"阳关三叠","sections":["第一叠","第二叠","第三叠"]}',
        status=VersionStatus.draft,
        change_note="初稿",
    )
    db.add(v4)
    db.flush()

    v5 = ScoreVersion(
        score_id=score3.id,
        version_number=1,
        content_json='{"title":"阳关三叠","sections":["第一叠","第二叠","第三叠","尾声"]}',
        status=VersionStatus.draft,
        change_note="补充尾声，但版本号未递增",
    )
    db.add(v5)
    db.flush()

    measures_s3 = [
        Measure(score_id=score3.id, version_id=v5.id, measure_number=1, start_position=0.0, end_position=4.0, beat_count=4.0, time_signature="4/4"),
        Measure(score_id=score3.id, version_id=v5.id, measure_number=2, start_position=4.0, end_position=8.0, beat_count=4.0, time_signature="4/4"),
        Measure(score_id=score3.id, version_id=v5.id, measure_number=3, start_position=8.0, end_position=12.0, beat_count=4.0, time_signature="4/4"),
    ]
    for m in measures_s3:
        db.add(m)
    db.flush()

    # 故意不添加任何指法标注 — 模拟指法漏标

    log_audit(db, "create", "sample_data", note="初始化样例数据：3首谱稿，包含缺项、重复、手工更正、伪装正常数据")
    db.commit()

    print("样例数据初始化完成！")
    print(f"  谱稿1《流水》(id={score1.id}): 包含指法漏标、重复、手工更正、弦号越界、小节错位、版本覆盖")
    print(f"  谱稿2《酒狂》(id={score2.id}): 伪装正常数据——3/4拍号但拍数4")
    print(f"  谱稿3《阳关三叠》(id={score3.id}): 版本号重复、全小节无指法")
    print(f"")
    print(f"可校对的版本：")
    print(f"  流水 v2 (version_id={v2.id})")
    print(f"  酒狂 v1 (version_id={v3.id})")
    print(f"  阳关三叠 v1-第二个 (version_id={v5.id})")
    print(f"")
    print(f"可比对的版本：")
    print(f"  流水 v1(id={v1.id}) vs v2(id={v2.id})")

except Exception as e:
    db.rollback()
    print(f"初始化失败: {e}")
    raise
finally:
    db.close()
