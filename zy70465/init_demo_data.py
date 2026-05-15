#!/usr/bin/env python3
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models.ticket import Base, Ticket, TicketStatus, TicketAttachment, ScanRecord, StatusLog, ManualNote

SQLALCHEMY_DATABASE_URL = "sqlite:///./ticket_scan.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        print("开始初始化演示数据...")
        
        ticket1 = Ticket(
            ticket_no="DEL-2024-001",
            title="用户行为分析系统过期数据擦除申请",
            applicant="张三",
            application_type="过期数据擦除申请",
            description="申请擦除2022年1月1日之前的用户行为日志数据，共约5TB",
            status=TicketStatus.REVIEW_REQUIRED,
            current_version=3,
            has_version_conflict=True,
            summary="工单编号: DEL-2024-001\n申请类型: 过期数据擦除申请\n申请人: 张三\n附件数量: 3\n版本信息: 共3个版本\n扫描结果: 通过1项，异常2项",
            conclusion="检测到版本冲突，存在旧版本覆盖新版本的情况，需要人工审核",
            created_at=datetime.utcnow() - timedelta(days=10),
            updated_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(ticket1)
        db.flush()
        
        attachment1_v1 = TicketAttachment(
            ticket_id=ticket1.id,
            file_name="数据擦除申请表_v1.docx",
            file_type="application/docx",
            file_size=15234,
            file_hash="a1b2c3d4e5f6",
            version=1,
            uploaded_by="张三",
            content_preview="申请擦除用户行为分析系统2022年1月1日之前的所有数据",
            created_at=datetime.utcnow() - timedelta(days=10)
        )
        db.add(attachment1_v1)
        
        attachment1_v2 = TicketAttachment(
            ticket_id=ticket1.id,
            file_name="数据擦除申请表_v2.docx",
            file_type="application/docx",
            file_size=16789,
            file_hash="f6e5d4c3b2a1",
            version=2,
            uploaded_by="李四",
            content_preview="补充说明：擦除范围包括用户浏览记录和点击数据，不包括用户基本信息",
            created_at=datetime.utcnow() - timedelta(days=8)
        )
        db.add(attachment1_v2)
        
        attachment1_v3 = TicketAttachment(
            ticket_id=ticket1.id,
            file_name="数据擦除申请表_v1.docx",
            file_type="application/docx",
            file_size=15234,
            file_hash="a1b2c3d4e5f6",
            version=1,
            uploaded_by="张三",
            content_preview="申请擦除用户行为分析系统2022年1月1日之前的所有数据",
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(attachment1_v3)
        
        db.flush()
        
        scan1 = ScanRecord(
            ticket_id=ticket1.id,
            attachment_id=attachment1_v1.id,
            scan_type="content_scan",
            status="suspicious",
            version=1,
            scan_result="检测到高风险关键词: 全部数据",
            risk_level="high",
            scanner="系统自动扫描",
            scanned_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(scan1)
        
        scan2 = ScanRecord(
            ticket_id=ticket1.id,
            attachment_id=attachment1_v2.id,
            scan_type="content_scan",
            status="pass",
            version=2,
            scan_result="附件内容检查通过",
            risk_level="low",
            scanner="系统自动扫描",
            scanned_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(scan2)
        
        scan3 = ScanRecord(
            ticket_id=ticket1.id,
            attachment_id=attachment1_v3.id,
            scan_type="version_check",
            status="conflict",
            version=1,
            scan_result="版本冲突：附件版本1低于当前工单版本3",
            risk_level="high",
            scanner="系统自动扫描",
            scanned_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(scan3)
        
        log1_1 = StatusLog(
            ticket_id=ticket1.id,
            to_status=TicketStatus.PENDING,
            operator="system",
            reason="工单创建",
            duty_record="系统自动创建工单，初始化状态为pending",
            created_at=datetime.utcnow() - timedelta(days=10)
        )
        db.add(log1_1)
        
        log1_2 = StatusLog(
            ticket_id=ticket1.id,
            from_status=TicketStatus.PENDING,
            to_status=TicketStatus.SCANNING,
            operator="王五",
            reason="开始扫描工单附件",
            duty_record="研发值班人员王五启动工单附件扫描流程",
            created_at=datetime.utcnow() - timedelta(days=5, hours=1)
        )
        db.add(log1_2)
        
        log1_3 = StatusLog(
            ticket_id=ticket1.id,
            from_status=TicketStatus.SCANNING,
            to_status=TicketStatus.REVIEW_REQUIRED,
            operator="王五",
            reason="附件扫描完成",
            duty_record="扫描完成，共处理3个附件，最终状态: review_required",
            created_at=datetime.utcnow() - timedelta(days=5)
        )
        db.add(log1_3)
        
        ticket2 = Ticket(
            ticket_no="DEL-2024-002",
            title="订单历史归档数据清理申请",
            applicant="李四",
            application_type="过期数据擦除申请",
            description="申请清理3年以上的订单历史数据，已完成归档备份",
            status=TicketStatus.APPROVED,
            current_version=1,
            has_version_conflict=False,
            summary="工单编号: DEL-2024-002\n申请类型: 过期数据擦除申请\n申请人: 李四\n附件数量: 1\n版本信息: 共1个版本\n扫描结果: 通过1项，异常0项",
            conclusion="所有附件扫描通过，未发现异常",
            created_at=datetime.utcnow() - timedelta(days=30),
            updated_at=datetime.utcnow() - timedelta(days=25)
        )
        db.add(ticket2)
        db.flush()
        
        attachment2 = TicketAttachment(
            ticket_id=ticket2.id,
            file_name="订单数据清理方案.pdf",
            file_type="application/pdf",
            file_size=245678,
            file_hash="1a2b3c4d5e6f",
            version=1,
            uploaded_by="李四",
            content_preview="订单历史数据清理方案：1. 数据范围：2020年1月1日之前的所有订单记录 2. 备份情况：已完成冷备份 3. 影响评估：不影响现有业务",
            created_at=datetime.utcnow() - timedelta(days=30)
        )
        db.add(attachment2)
        db.flush()
        
        scan4 = ScanRecord(
            ticket_id=ticket2.id,
            attachment_id=attachment2.id,
            scan_type="content_scan",
            status="pass",
            version=1,
            scan_result="附件内容检查通过",
            risk_level="low",
            scanner="赵六",
            scanned_at=datetime.utcnow() - timedelta(days=25)
        )
        db.add(scan4)
        
        log2_1 = StatusLog(
            ticket_id=ticket2.id,
            to_status=TicketStatus.PENDING,
            operator="system",
            reason="工单创建",
            duty_record="系统自动创建工单，初始化状态为pending",
            created_at=datetime.utcnow() - timedelta(days=30)
        )
        db.add(log2_1)
        
        log2_2 = StatusLog(
            ticket_id=ticket2.id,
            from_status=TicketStatus.PENDING,
            to_status=TicketStatus.SCANNING,
            operator="赵六",
            reason="开始扫描工单附件",
            duty_record="研发值班人员赵六启动工单附件扫描流程",
            created_at=datetime.utcnow() - timedelta(days=25, hours=1)
        )
        db.add(log2_2)
        
        log2_3 = StatusLog(
            ticket_id=ticket2.id,
            from_status=TicketStatus.SCANNING,
            to_status=TicketStatus.APPROVED,
            operator="赵六",
            reason="附件扫描完成",
            duty_record="扫描完成，共处理1个附件，最终状态: approved",
            created_at=datetime.utcnow() - timedelta(days=25)
        )
        db.add(log2_3)
        
        ticket3 = Ticket(
            ticket_no="DEL-2024-003",
            title="用户隐私数据合规清理申请",
            applicant="王五",
            application_type="过期数据擦除申请",
            description="",
            status=TicketStatus.REJECTED,
            current_version=1,
            has_version_conflict=False,
            summary="工单编号: DEL-2024-003\n申请类型: 过期数据擦除申请\n申请人: 王五\n附件数量: 0\n版本信息: 共0个版本\n扫描结果: 通过0项，异常0项",
            conclusion="扫描失败：未找到任何附件，需要申请人补充材料",
            created_at=datetime.utcnow() - timedelta(days=3),
            updated_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(ticket3)
        db.flush()
        
        scan5 = ScanRecord(
            ticket_id=ticket3.id,
            scan_type="content_scan",
            status="fail",
            scan_result="未找到任何附件",
            risk_level="critical",
            scanner="孙七",
            scanned_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(scan5)
        
        log3_1 = StatusLog(
            ticket_id=ticket3.id,
            to_status=TicketStatus.PENDING,
            operator="system",
            reason="工单创建",
            duty_record="系统自动创建工单，初始化状态为pending",
            created_at=datetime.utcnow() - timedelta(days=3)
        )
        db.add(log3_1)
        
        log3_2 = StatusLog(
            ticket_id=ticket3.id,
            from_status=TicketStatus.PENDING,
            to_status=TicketStatus.SCANNING,
            operator="孙七",
            reason="开始扫描工单附件",
            duty_record="研发值班人员孙七启动工单附件扫描流程",
            created_at=datetime.utcnow() - timedelta(days=2, hours=1)
        )
        db.add(log3_2)
        
        log3_3 = StatusLog(
            ticket_id=ticket3.id,
            from_status=TicketStatus.SCANNING,
            to_status=TicketStatus.REJECTED,
            operator="孙七",
            reason="无附件可扫描",
            duty_record="扫描失败：工单缺少必要附件，状态变更为rejected",
            created_at=datetime.utcnow() - timedelta(days=2)
        )
        db.add(log3_3)
        
        note1 = ManualNote(
            ticket_id=ticket1.id,
            original_conclusion="检测到版本冲突，存在旧版本覆盖新版本的情况，需要人工审核",
            revised_conclusion="经人工核实，v3版本实际上传错误，应以v2版本为准。已确认v2版本包含完整的擦除说明，可进入下一流程",
            operator="审核员_周八",
            remark="版本冲突为操作失误导致，已与上传人确认，无需重新上传",
            created_at=datetime.utcnow() - timedelta(days=3)
        )
        db.add(note1)
        
        db.commit()
        print("演示数据初始化完成！")
        print(f"共创建 {db.query(Ticket).count()} 个工单")
        print(f"- DEL-2024-001: 有版本冲突的脏数据（旧版本覆盖新版本）")
        print(f"- DEL-2024-002: 正常通过的工单")
        print(f"- DEL-2024-003: 无附件被驳回的工单（失败路径示例）")
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    init_demo_data()
