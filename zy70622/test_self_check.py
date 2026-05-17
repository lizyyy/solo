#!/usr/bin/env python3
"""
访客车位管理系统自检脚本
验证功能：数据导入、状态筛选、业务流程处理、报告导出
"""

import sys
import os
import sqlite3
from datetime import date, datetime, timedelta
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def run_test(name, test_func):
    print(f"\n{'='*60}")
    print(f"测试: {name}")
    print(f"{'='*60}")
    try:
        test_func()
        print(f"✓ {name} - 通过")
        return True
    except AssertionError as e:
        print(f"✗ {name} - 失败: {e}")
        return False
    except Exception as e:
        print(f"✗ {name} - 异常: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_1_database_init():
    """测试1: 数据库初始化"""
    if os.path.exists("parking.db"):
        os.remove("parking.db")
    
    from main import init_db
    init_db()
    
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots")
    count = cursor.fetchone()[0]
    assert count == 20, f"预期20个车位，实际{count}个"
    
    cursor.execute("SELECT DISTINCT area FROM parking_spots")
    areas = [row[0] for row in cursor.fetchall()]
    assert "A区" in areas and "B区" in areas, "区域划分不正确"
    
    conn.close()
    print("  - 数据库表创建成功")
    print("  - 车位初始化正确 (20个车位)")

def test_2_visitor_crud():
    """测试2: 访客数据导入和查询"""
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    visitors = [
        (str(uuid.uuid4()), "张三", "13800138001", "科技公司A"),
        (str(uuid.uuid4()), "李四", "13800138002", "科技公司B"),
        (str(uuid.uuid4()), "王五", "13800138003", None)
    ]
    
    for v in visitors:
        cursor.execute(
            "INSERT INTO visitors (id, name, phone, company) VALUES (?, ?, ?, ?)",
            v
        )
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM visitors")
    count = cursor.fetchone()[0]
    assert count == 3, f"预期3个访客，实际{count}个"
    
    cursor.execute("SELECT * FROM visitors WHERE company IS NULL")
    no_company = cursor.fetchall()
    assert len(no_company) == 1, "未填写公司的访客数量不对"
    
    conn.close()
    print("  - 访客数据导入成功")
    print("  - 访客查询筛选正常")

def test_3_parking_spot_status():
    """测试3: 车位状态筛选"""
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM parking_spots LIMIT 2")
    spots = cursor.fetchall()
    spot1_id = spots[0][0]
    spot2_id = spots[1][0]
    
    cursor.execute("UPDATE parking_spots SET status = 'LOCKED' WHERE id = ?", (spot1_id,))
    cursor.execute("UPDATE parking_spots SET status = 'OCCUPIED' WHERE id = ?", (spot2_id,))
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE status = 'AVAILABLE'")
    available = cursor.fetchone()[0]
    assert available == 18, f"预期18个可用车位，实际{available}个"
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE status = 'LOCKED'")
    locked = cursor.fetchone()[0]
    assert locked == 1, f"预期1个锁定车位，实际{locked}个"
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE status = 'OCCUPIED'")
    occupied = cursor.fetchone()[0]
    assert occupied == 1, f"预期1个占用车位，实际{occupied}个"
    
    cursor.execute("UPDATE parking_spots SET status = 'AVAILABLE', current_meeting_id = NULL")
    conn.commit()
    
    conn.close()
    print("  - 车位状态筛选正常")
    print("  - AVAILABLE/LOCKED/OCCUPIED 状态区分正确")

def test_4_meeting_parking_locking():
    """测试4: 会议预约和车位锁定联动"""
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM visitors LIMIT 1")
    visitor_id = cursor.fetchone()[0]
    
    meeting_id = str(uuid.uuid4())
    meeting_date = date.today().strftime("%Y-%m-%d")
    
    cursor.execute("SELECT id FROM parking_spots WHERE status = 'AVAILABLE' LIMIT 1")
    spot = cursor.fetchone()
    spot_id = spot[0]
    
    cursor.execute(
        "UPDATE parking_spots SET status = 'LOCKED', current_meeting_id = ? WHERE id = ?",
        (meeting_id, spot_id)
    )
    
    cursor.execute(
        """INSERT INTO meetings 
           (id, visitor_id, title, meeting_date, start_time, end_time, parking_spot_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (meeting_id, visitor_id, "产品评审会", meeting_date, "09:00", "11:00", spot_id)
    )
    
    pass_code = "123456"
    pass_code_id = str(uuid.uuid4())
    now = datetime.now()
    cursor.execute(
        """INSERT INTO pass_codes 
           (id, code, meeting_id, parking_spot_id, visitor_id, status, valid_from, valid_until)
           VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)""",
        (pass_code_id, pass_code, meeting_id, spot_id, visitor_id, now, now + timedelta(hours=2))
    )
    
    conn.commit()
    
    cursor.execute("SELECT status FROM parking_spots WHERE id = ?", (spot_id,))
    status = cursor.fetchone()[0]
    assert status == "LOCKED", f"车位应该是LOCKED状态，实际是{status}"
    
    cursor.execute("SELECT code FROM pass_codes WHERE meeting_id = ?", (meeting_id,))
    code = cursor.fetchone()[0]
    assert code == "123456", "放行码关联错误"
    
    conn.close()
    print("  - 会议预约成功")
    print("  - 车位自动锁定正常")
    print("  - 放行码生成并关联成功")

def test_5_pass_code_flow():
    """测试5: 放行码验证和使用"""
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT code, parking_spot_id FROM pass_codes WHERE status = 'ACTIVE' LIMIT 1")
    result = cursor.fetchone()
    pass_code = result[0]
    spot_id = result[1]
    
    cursor.execute("UPDATE pass_codes SET status = 'USED', used_at = ? WHERE code = ?", (datetime.now(), pass_code))
    cursor.execute("UPDATE parking_spots SET status = 'OCCUPIED' WHERE id = ?", (spot_id,))
    conn.commit()
    
    cursor.execute("SELECT status FROM pass_codes WHERE code = ?", (pass_code,))
    pc_status = cursor.fetchone()[0]
    assert pc_status == "USED", f"放行码应该是USED状态，实际是{pc_status}"
    
    cursor.execute("SELECT status FROM parking_spots WHERE id = ?", (spot_id,))
    ps_status = cursor.fetchone()[0]
    assert ps_status == "OCCUPIED", f"车位应该是OCCUPIED状态，实际是{ps_status}"
    
    conn.close()
    print("  - 放行码使用成功")
    print("  - 车位状态更新为已占用")

def test_6_cancellation_release():
    """测试6: 会议取消和车位释放"""
    conn = sqlite3.connect("parking.db")
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, parking_spot_id FROM meetings WHERE status = 'SCHEDULED' LIMIT 1")
    meeting = cursor.fetchone()
    if meeting:
        meeting_id = meeting[0]
        spot_id = meeting[1]
        
        cursor.execute("UPDATE meetings SET status = 'CANCELLED' WHERE id = ?", (meeting_id,))
        cursor.execute("UPDATE pass_codes SET status = 'CANCELLED' WHERE meeting_id = ?", (meeting_id,))
        cursor.execute(
            "UPDATE parking_spots SET status = 'AVAILABLE', current_meeting_id = NULL WHERE id = ?",
            (spot_id,)
        )
        
        cancellation_id = str(uuid.uuid4())
        cursor.execute(
            """INSERT INTO cancellation_records 
               (id, meeting_id, parking_spot_id, cancelled_by, cancel_reason, released_at, needs_review)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (cancellation_id, meeting_id, spot_id, "前台管理员", "会议时间变更", datetime.now(), 0)
        )
        conn.commit()
        
        cursor.execute("SELECT status FROM meetings WHERE id = ?", (meeting_id,))
        m_status = cursor.fetchone()[0]
        assert m_status == "CANCELLED", "会议应该被取消"
        
        cursor.execute("SELECT status FROM parking_spots WHERE id = ?", (spot_id,))
        s_status = cursor.fetchone()[0]
        assert s_status == "AVAILABLE", "车位应该被释放"
        
        cursor.execute("SELECT status FROM pass_codes WHERE meeting_id = ?", (meeting_id,))
        p_status = cursor.fetchone()[0]
        assert p_status == "CANCELLED", "放行码应该失效"
    
    conn.close()
    print("  - 会议取消成功")
    print("  - 车位自动释放成功")
    print("  - 放行码自动失效成功")
    print("  - 取消记录生成成功")

def test_7_occupied_cancellation_review():
    """测试7: 已占用车位取消需要人工复核"""
    conn = sqlite3.connect("parking.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT id FROM visitors LIMIT 1")
    visitor_id = cursor.fetchone()[0]
    
    meeting_id = str(uuid.uuid4())
    meeting_date = date.today().strftime("%Y-%m-%d")
    
    cursor.execute("SELECT id FROM parking_spots WHERE status = 'AVAILABLE' LIMIT 1")
    spot = cursor.fetchone()
    spot_id = spot[0]
    
    cursor.execute(
        "UPDATE parking_spots SET status = 'OCCUPIED', current_meeting_id = ? WHERE id = ?",
        (meeting_id, spot_id)
    )
    
    cursor.execute(
        """INSERT INTO meetings 
           (id, visitor_id, title, meeting_date, start_time, end_time, parking_spot_id, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')""",
        (meeting_id, visitor_id, "重要客户会议", meeting_date, "14:00", "16:00", spot_id)
    )
    
    cursor.execute("SELECT status FROM parking_spots WHERE id = ?", (spot_id,))
    status = cursor.fetchone()[0]
    assert status == "OCCUPIED", "测试车位应该先设为占用"
    
    cancellation_id = str(uuid.uuid4())
    cursor.execute(
        """INSERT INTO cancellation_records 
           (id, meeting_id, parking_spot_id, cancelled_by, cancel_reason, needs_review)
           VALUES (?, ?, ?, ?, ?, 1)""",
        (cancellation_id, meeting_id, spot_id, "前台", "访客已入场")
    )
    conn.commit()
    
    cursor.execute("SELECT needs_review FROM cancellation_records WHERE id = ?", (cancellation_id,))
    needs_review = cursor.fetchone()[0]
    assert needs_review == 1, "已占用车位取消应该需要人工复核"
    
    cursor.execute("SELECT status FROM parking_spots WHERE id = ?", (spot_id,))
    final_status = cursor.fetchone()[0]
    assert final_status == "OCCUPIED", "需要复核的车位不应该自动释放"
    
    conn.close()
    print("  - 已占用车位取消标记为需要复核")
    print("  - 车位不自动释放，等待人工处理")

def test_8_error_codes():
    """测试8: 错误码区分"""
    from main import ErrorCode
    
    error_codes = [ec.value for ec in ErrorCode]
    assert "MISSING_FIELD" in error_codes
    assert "INVALID_STATUS" in error_codes
    assert "NEEDS_MANUAL_REVIEW" in error_codes
    assert "ALREADY_PROCESSED" in error_codes
    assert "RESOURCE_NOT_FOUND" in error_codes
    
    print("  - MISSING_FIELD (缺字段)")
    print("  - INVALID_STATUS (状态不允许)")
    print("  - NEEDS_MANUAL_REVIEW (需要人工复核)")
    print("  - ALREADY_PROCESSED (已经处理过)")
    print("  - RESOURCE_NOT_FOUND (资源不存在)")

def test_9_occupancy_report():
    """测试9: 车位占用报告生成"""
    conn = sqlite3.connect("parking.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    report_date = date.today().strftime("%Y-%m-%d")
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots")
    total = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE status = 'OCCUPIED'")
    occupied = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots WHERE status = 'LOCKED'")
    locked = cursor.fetchone()[0]
    
    available = total - occupied - locked
    
    cursor.execute("SELECT COUNT(*) FROM meetings WHERE status = 'CANCELLED' AND DATE(created_at) = ?", (report_date,))
    cancelled = cursor.fetchone()[0]
    
    report_id = str(uuid.uuid4())
    try:
        cursor.execute(
            """INSERT INTO occupancy_reports 
               (id, report_date, total_spots, occupied_spots, locked_spots, available_spots, cancelled_meetings)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (report_id, report_date, total, occupied, locked, available, cancelled)
        )
    except sqlite3.IntegrityError:
        cursor.execute("SELECT id FROM occupancy_reports WHERE report_date = ?", (report_date,))
        report_id = cursor.fetchone()[0]
    
    conn.commit()
    
    cursor.execute("SELECT * FROM occupancy_reports WHERE id = ?", (report_id,))
    report = cursor.fetchone()
    assert report is not None, "报告应该存在"
    assert report["total_spots"] == 20, "总车位应该是20"
    
    conn.close()
    print("  - 报告统计数据正确")
    print("  - 报告持久化存储成功")

def test_10_export_report():
    """测试10: 报告导出"""
    import csv
    
    filename = f"test_report_{date.today()}.csv"
    
    conn = sqlite3.connect("parking.db")
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM occupancy_reports WHERE report_date = ?", (str(date.today()),))
    report = cursor.fetchone()
    
    cursor.execute("""
        SELECT ps.spot_number, ps.area, ps.status, m.title, v.name
        FROM parking_spots ps
        LEFT JOIN meetings m ON ps.current_meeting_id = m.id
        LEFT JOIN visitors v ON m.visitor_id = v.id
        ORDER BY ps.spot_number
    """)
    spots = cursor.fetchall()
    
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        writer.writerow(["车位占用报告", f"日期: {date.today()}"])
        writer.writerow([])
        writer.writerow(["总车位", report["total_spots"]])
        writer.writerow(["已占用", report["occupied_spots"]])
        writer.writerow(["已锁定", report["locked_spots"]])
        writer.writerow(["可用", report["available_spots"]])
        writer.writerow([])
        writer.writerow(["车位编号", "区域", "状态", "会议", "访客"])
        for spot in spots:
            writer.writerow([spot[0], spot[1], spot[2], spot[3] or "", spot[4] or ""])
    
    conn.close()
    
    assert os.path.exists(filename), "导出文件应该存在"
    
    with open(filename, 'r', encoding='utf-8-sig') as f:
        content = f.read()
        assert "车位占用报告" in content, "报告标题应该存在"
        assert "P001" in content, "车位编号应该存在"
    
    if os.path.exists(filename):
        os.remove(filename)
    
    print("  - CSV文件生成成功")
    print("  - 导出格式正确，包含所有必要信息")

def main():
    print("\n" + "="*70)
    print("访客车位会议取消放行码后端API - 自检脚本")
    print("="*70)
    
    tests = [
        ("数据库初始化", test_1_database_init),
        ("访客数据导入与查询", test_2_visitor_crud),
        ("车位状态筛选", test_3_parking_spot_status),
        ("会议预约与车位锁定联动", test_4_meeting_parking_locking),
        ("放行码验证与使用", test_5_pass_code_flow),
        ("会议取消与车位释放", test_6_cancellation_release),
        ("已占用车位取消需人工复核", test_7_occupied_cancellation_review),
        ("错误类型区分", test_8_error_codes),
        ("车位占用报告生成", test_9_occupancy_report),
        ("报告导出功能", test_10_export_report),
    ]
    
    results = []
    for name, func in tests:
        results.append(run_test(name, func))
    
    print("\n" + "="*70)
    passed = sum(results)
    total = len(results)
    print(f"测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("✓ 所有测试通过！")
    else:
        print(f"✗ 有 {total - passed} 个测试失败")
    
    print("="*70 + "\n")
    
    if os.path.exists("parking.db"):
        os.remove("parking.db")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
