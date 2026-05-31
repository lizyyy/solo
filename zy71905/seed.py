import os
import sys
import sqlite3
import hashlib

BASE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(BASE, 'sight_singing.db')
SCORES_DIR = os.path.join(BASE, 'app', 'uploads', 'scores')
RECORDINGS_DIR = os.path.join(BASE, 'app', 'uploads', 'recordings')


def make_pdf(name, content=b'%PDF-1.4 fake score'):
    path = os.path.join(SCORES_DIR, name)
    with open(path, 'wb') as f:
        f.write(content)
    return name, hashlib.sha256(content).hexdigest()


def make_recording(name, content=b'fake audio data'):
    path = os.path.join(RECORDINGS_DIR, name)
    with open(path, 'wb') as f:
        f.write(content)
    return name


def seed():
    if os.path.exists(DB):
        os.remove(DB)

    from app.db import init_db, get_db
    init_db()
    conn = get_db()

    s1_name, s1_hash = make_pdf('score_molihua.pdf', b'%PDF-1.4 molihua score')
    s2_name, s2_hash = make_pdf('score_chunjiang.pdf', b'%PDF-1.4 chunjiang score')
    s3_name, s3_hash = make_pdf('score_caiyun.pdf', b'%PDF-1.4 caiyun score')

    conn.executescript(f"""
    INSERT INTO scores (title, voice_part, pdf_path, pdf_hash, uploaded_by) VALUES
        ('茉莉花', '女高音', '{s1_name}', '{s1_hash}', '王老师'),
        ('春江花月夜', '男低音', '{s2_name}', '{s2_hash}', '王老师'),
        ('彩云追月', '女中音', '{s3_name}', '{s3_hash}', '李老师');
    """)

    rec1 = make_recording('zhangsan_molihua.mp3', b'fake mp3 zhangsan')
    rec2 = make_recording('lisi_chunjiang.wav', b'fake wav lisi')
    rec4 = make_recording('wangwu_caiyun.mp3', b'fake mp3 wangwu')

    long_remark = '今日排练发现女高音声部在第12-16小节音准偏差较大，特别是#F音的进入时机偏晚约半拍，需要单独抽出这一段落做视唱练习。建议下次排练前各声部长先自行确认该段落的节奏型。另外第24小节的渐强记号容易被忽略，需要在总谱上做标记。'

    conn.executescript(f"""
    INSERT INTO checkins (score_id, student_name, voice_part, checkin_date, recording_path, recording_exists, manual_confirmed, confirmed_by, confirmed_at, remark, status) VALUES
        (1, '张三', '女高音', '2026-05-20', '{rec1}', 1, 1, '王老师', '2026-05-21 10:00:00', '', 'confirmed'),
        (1, '李四', '女高音', '2026-05-20', '', 0, 0, '', '', '', 'pending'),
        (1, '张三', '女高音', '2026-05-20', '{rec1}', 1, 0, '', '', '', 'pending'),
        (2, '李四', '男低音', '2026-05-21', '{rec2}', 1, 1, '王老师', '2026-05-22 09:00:00', '', 'confirmed'),
        (2, '王五', '男低音', '2026-05-21', '', 0, 0, '', '', '请假缺勤', 'pending'),
        (2, '赵六', '男低音', '2026-05-21', 'missing_file.ogg', 0, 0, '', '', '', 'pending'),
        (2, '赵六', '男低音', '2026-05-21', 'missing_file2.ogg', 0, 1, '王老师', '2026-05-22 10:00:00', '', 'confirmed'),
        (3, '王五', '女中音', '2026-05-22', '{rec4}', 1, 0, '', '', '{long_remark}', 'pending'),
        (3, '孙七', '女中音', '2026-05-22', '', 0, 0, '', '', '正常', 'pending'),
        (3, '周八', '女高音', '2026-05-22', '', 0, 0, '', '', '', 'pending');
    """)

    conn.executescript("""
    INSERT INTO rehearsal_summaries (score_id, summary_date, content, author) VALUES
        (1, '2026-05-20', '女高音声部整体音准较好，但#F音进入时机需注意。部分同学节奏偏快。', '王老师'),
        (2, '2026-05-21', '男低音声部需要加强第8-16小节的低音区支撑，赵六需补交录音。', '王老师'),
        (3, '2026-05-22', '女中音声部首次排练该曲目，整体完成度约60%，下次需重点练习第二段。', '李老师');

    INSERT INTO modification_log (target_type, target_id, field_name, old_value, new_value, reason, operator) VALUES
        ('checkin', 7, 'manual_confirmed', '0', '1', '学生补交了录音后确认', '王老师'),
        ('checkin', 7, 'status', 'pending', 'confirmed', '学生补交了录音后确认', '王老师');
    """)

    conn.commit()
    conn.close()
    print('种子数据已写入，包含以下场景：')
    print('  1. 正常打卡（张三-茉莉花-有录音-已确认）')
    print('  2. 缺排练录音（李四-茉莉花-无录音-待确认）')
    print('  3. 重复打卡（张三-茉莉花-同日同曲同声部重复）')
    print('  4. 正常打卡（李四-春江花月夜-有录音-已确认）')
    print('  5. 请假缺勤（王五-春江花月夜-无录音-备注请假）')
    print('  6. 录音文件丢失（赵六-春江花月夜-登记了录音但文件不存在）')
    print('  7. 无录音但已确认（赵六-春江花月夜-边界情况）')
    print('  8. 长备注（王五-彩云追月-备注超过200字）')
    print('  9. 声部人数不均衡（彩云追月：2女中音+1女高音）')
    print(' 10. 排练小结关联曲谱（3条小结分别对应3首曲）')


if __name__ == '__main__':
    seed()
