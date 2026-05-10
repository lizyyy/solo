"""
短信签名审核队列服务 - 样例数据脚本

包含三个完整场景：
1. 正常流程（审核通过）
2. 异常拦截（资质被拒）
3. 重复操作（幂等性验证）

运行方式：python3 examples/sample_data.py
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import SignStatus
from app.services import (
    create_sign_application, submit_for_qualification,
    upload_qualification, approve_qualification, reject_qualification,
    submit_to_channel, receive_channel_receipt, parse_channel_receipt,
    generate_audit_report, get_application_history, trace_application_by_request_id
)
from app.schemas import (
    CreateSignApplicationRequest, UploadQualificationRequest,
    ChannelSubmitRequest, ChannelReceiptRequest
)

TEST_DATABASE_URL = "sqlite:///./sample_sms_audit.db"


def setup_database():
    if os.path.exists("./sample_sms_audit.db"):
        os.remove("./sample_sms_audit.db")
    
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


def print_separator(title: str):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def scenario_1_normal_flow(session_factory):
    """场景1：正常流程 - 签名审核通过"""
    print_separator("场景1：正常流程（审核通过）")
    
    db = session_factory()
    try:
        print("\n[步骤1] 创建签名申请")
        app, msg = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_001",
            sign_name="天猫超市",
            sign_type="BRAND",
            description="天猫超市官方短信签名",
            request_id="REQ_CREATE_001"
        ))
        print(f"  申请ID: {app.id}, 状态: {app.status.value}")
        
        print("\n[步骤2] 提交资质审核")
        app, msg = submit_for_qualification(db, app.id, "REQ_SUBMIT_QUAL_001")
        print(f"  状态更新: {app.status.value}")
        
        print("\n[步骤3] 上传资质附件（营业执照）")
        qual1, msg = upload_qualification(db, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="business_license_tmall.pdf",
            file_url="/files/merchant_001/business_license.pdf",
            file_hash="a1b2c3d4e5f6_tmall_license",
            request_id="REQ_UPLOAD_001"
        ))
        print(f"  资质ID: {qual1.id}, 类型: {qual1.qualification_type}")
        
        print("\n[步骤4] 上传资质附件（品牌授权书）")
        qual2, msg = upload_qualification(db, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="品牌授权书",
            file_name="brand_authorization_tmall.pdf",
            file_url="/files/merchant_001/brand_auth.pdf",
            file_hash="f6e5d4c3b2a1_tmall_auth",
            request_id="REQ_UPLOAD_002"
        ))
        print(f"  资质ID: {qual2.id}, 类型: {qual2.qualification_type}")
        
        print("\n[步骤5] 审批通过营业执照")
        qual1, msg = approve_qualification(
            db, qual1.id, "REVIEWER_A", "REQ_APPROVE_001", "营业执照真实有效"
        )
        print(f"  资质ID {qual1.id}: {qual1.status.value}")
        
        print("\n[步骤6] 审批通过品牌授权书")
        qual2, msg = approve_qualification(
            db, qual2.id, "REVIEWER_B", "REQ_APPROVE_002", "品牌授权清晰完整"
        )
        print(f"  资质ID {qual2.id}: {qual2.status.value}")
        
        print("\n[步骤7] 提交到阿里云渠道")
        app, msg = submit_to_channel(db, ChannelSubmitRequest(
            application_id=app.id,
            channel="alicloud",
            request_id="REQ_CHANNEL_SUBMIT_001"
        ))
        print(f"  渠道签名ID: {app.channel_sign_id}, 状态: {app.status.value}")
        
        print("\n[步骤8] 接收渠道回执（审核通过）")
        receipt, msg = receive_channel_receipt(db, ChannelReceiptRequest(
            application_id=app.id,
            channel="alicloud",
            channel_receipt_id="ALI_RECEIPT_001_APPROVED",
            raw_payload='{"status": "approved", "message": "签名审核通过", "signId": "SIGN_20240101_001"}',
            request_id="REQ_RECEIVE_RECEIPT_001"
        ))
        print(f"  回执ID: {receipt.id}, 渠道回执ID: {receipt.channel_receipt_id}")
        
        print("\n[步骤9] 解析回执")
        receipt, msg = parse_channel_receipt(db, receipt.id)
        print(f"  解析状态: {receipt.status.value}")
        
        print("\n[步骤10] 查看最终状态")
        from app.services import get_application_by_id
        app_final = get_application_by_id(db, app.id)
        print(f"  最终状态: {app_final.status.value}")
        print(f"  审核备注: {app_final.audit_comment}")
        
        print("\n[步骤11] 生成审核报告")
        report, msg = generate_audit_report(db, app.id)
        print(f"  报告ID: {report.report_id}")
        print(f"  最终状态: {report.final_status}")
        
        print("\n[步骤12] 追溯请求（通过 request_id）")
        trace = trace_application_by_request_id(db, "REQ_CREATE_001")
        print(f"  找到申请ID: {trace['application_id']}")
        print(f"  追溯提示: {trace['trace_hint']}")
        
        print("\n[步骤13] 查看完整历史")
        history = get_application_history(db, app.id)
        print(f"  操作日志数量: {len(history['operation_logs'])}")
        for log in history['operation_logs']:
            print(f"    - {log['operation_type']}: {log['from_status']} -> {log['to_status']}")
        
        print("\n✅ 场景1 完成：签名审核通过")
        
    finally:
        db.close()


def scenario_2_exception_flow(session_factory):
    """场景2：异常拦截 - 资质被拒"""
    print_separator("场景2：异常拦截（资质被拒）")
    
    db = session_factory()
    try:
        print("\n[步骤1] 创建签名申请")
        app, msg = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_002",
            sign_name="测试违规签名",
            sign_type="NORMAL",
            description="测试资质审核失败场景",
            request_id="REQ_CREATE_002"
        ))
        print(f"  申请ID: {app.id}")
        
        print("\n[步骤2] 提交资质审核")
        submit_for_qualification(db, app.id, "REQ_SUBMIT_QUAL_002")
        
        print("\n[步骤3] 上传过期营业执照")
        qual, msg = upload_qualification(db, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="expired_license.pdf",
            file_url="/files/merchant_002/expired.pdf",
            file_hash="expired_hash_002",
            request_id="REQ_UPLOAD_003"
        ))
        print(f"  资质ID: {qual.id}")
        
        print("\n[步骤4] 拒绝资质（营业执照过期）")
        qual, msg = reject_qualification(
            db, qual.id, "REVIEWER_C", "REQ_REJECT_001", 
            "营业执照已过期，请提供最新年检的营业执照"
        )
        print(f"  资质状态: {qual.status.value}")
        print(f"  拒绝原因: {qual.review_comment}")
        
        print("\n[步骤5] 查看申请状态")
        from app.services import get_application_by_id
        app_final = get_application_by_id(db, app.id)
        print(f"  申请状态: {app_final.status.value}")
        print(f"  审核备注: {app_final.audit_comment}")
        
        print("\n[步骤6] 生成审核报告")
        report, msg = generate_audit_report(db, app.id)
        print(f"  报告ID: {report.report_id}")
        print(f"  最终状态: {report.final_status}")
        
        print("\n[步骤7] 尝试重复拒绝（幂等性测试）")
        qual2, msg = reject_qualification(
            db, qual.id, "REVIEWER_C", "REQ_REJECT_001", 
            "营业执照已过期"
        )
        print(f"  结果: {msg}")
        
        print("\n✅ 场景2 完成：资质审核被拒，状态正确流转")
        
    finally:
        db.close()


def scenario_3_idempotency_flow(session_factory):
    """场景3：重复操作 - 幂等性验证"""
    print_separator("场景3：重复操作（幂等性验证）")
    
    db = session_factory()
    try:
        print("\n[步骤1] 首次创建签名申请")
        app1, msg = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_003",
            sign_name="幂等测试签名",
            sign_type="NORMAL",
            request_id="REQ_CREATE_003"
        ))
        print(f"  首次申请ID: {app1.id}")
        
        print("\n[步骤2] 重复创建（相同 request_id）")
        app2, msg = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_003",
            sign_name="幂等测试签名",
            sign_type="NORMAL",
            request_id="REQ_CREATE_003"
        ))
        print(f"  重复申请返回ID: {app2.id}")
        print(f"  验证幂等: {'✓' if app1.id == app2.id else '✗'} (应该相同)")
        
        print("\n[步骤3] 第三次重复创建")
        app3, msg = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_003",
            sign_name="幂等测试签名",
            sign_type="NORMAL",
            request_id="REQ_CREATE_003"
        ))
        print(f"  三次申请返回ID: {app3.id}")
        print(f"  验证幂等: {'✓' if app1.id == app3.id else '✗'}")
        
        print("\n[步骤4] 提交资质审核")
        app, msg = submit_for_qualification(db, app1.id, "REQ_SUBMIT_QUAL_003")
        print(f"  提交后状态: {app.status.value}")
        
        print("\n[步骤5] 重复提交资质审核")
        app_retry, msg = submit_for_qualification(db, app1.id, "REQ_SUBMIT_QUAL_003")
        print(f"  结果: {msg}")
        print(f"  状态: {app_retry.status.value}")
        
        print("\n[步骤6] 上传资质")
        qual1, msg = upload_qualification(db, UploadQualificationRequest(
            application_id=app1.id,
            qualification_type="营业执照",
            file_name="license.pdf",
            file_url="/files/license.pdf",
            file_hash="idempotency_hash_001",
            request_id="REQ_UPLOAD_004"
        ))
        print(f"  首次上传资质ID: {qual1.id}")
        
        print("\n[步骤7] 重复上传相同文件（相同 file_hash）")
        qual2, msg = upload_qualification(db, UploadQualificationRequest(
            application_id=app1.id,
            qualification_type="营业执照",
            file_name="license_copy.pdf",
            file_url="/files/license_copy.pdf",
            file_hash="idempotency_hash_001",
            request_id="REQ_UPLOAD_005"
        ))
        print(f"  重复上传返回资质ID: {qual2.id}")
        print(f"  相同文件去重: {'✓' if qual1.id == qual2.id else '✗'}")
        
        print("\n[步骤8] 审批通过")
        qual1, msg = approve_qualification(
            db, qual1.id, "REVIEWER_D", "REQ_APPROVE_003", "资质符合要求"
        )
        
        print("\n[步骤9] 重复审批")
        qual_retry, msg = approve_qualification(
            db, qual1.id, "REVIEWER_D", "REQ_APPROVE_003", "资质符合要求"
        )
        print(f"  重复审批结果: {msg}")
        
        print("\n[步骤10] 验证最终状态一致性")
        from app.services import get_application_by_id
        app_final = get_application_by_id(db, app1.id)
        print(f"  最终状态: {app_final.status.value}")
        
        print("\n✅ 场景3 完成：所有重复操作均保持幂等，状态一致")
        
    finally:
        db.close()


def scenario_4_receipt_parse_failure(session_factory):
    """场景4：回执解析失败 - 重试机制"""
    print_separator("场景4：回执解析失败（重试队列）")
    
    db = session_factory()
    try:
        print("\n[步骤1] 完整流程到渠道提交")
        app, _ = create_sign_application(db, CreateSignApplicationRequest(
            merchant_id="MERCHANT_004",
            sign_name="重试测试签名",
            sign_type="NORMAL",
            request_id="REQ_CREATE_004"
        ))
        
        submit_for_qualification(db, app.id, "REQ_SUBMIT_QUAL_004")
        
        qual, _ = upload_qualification(db, UploadQualificationRequest(
            application_id=app.id,
            qualification_type="营业执照",
            file_name="license.pdf",
            file_url="/files/license.pdf",
            file_hash="retry_test_hash",
            request_id="REQ_UPLOAD_006"
        ))
        
        approve_qualification(db, qual.id, "REVIEWER_E", "REQ_APPROVE_004")
        
        app, _ = submit_to_channel(db, ChannelSubmitRequest(
            application_id=app.id,
            channel="tencent",
            request_id="REQ_CHANNEL_SUBMIT_002"
        ))
        print(f"  渠道提交成功, channel_sign_id={app.channel_sign_id}")
        
        print("\n[步骤2] 接收格式错误的回执")
        receipt, msg = receive_channel_receipt(db, ChannelReceiptRequest(
            application_id=app.id,
            channel="tencent",
            channel_receipt_id="TENCENT_RECEIPT_002_INVALID",
            raw_payload="这不是有效的JSON格式回执",
            request_id="REQ_RECEIVE_RECEIPT_002"
        ))
        print(f"  回执ID: {receipt.id}")
        
        print("\n[步骤3] 解析回执（预期失败）")
        receipt, msg = parse_channel_receipt(db, receipt.id)
        print(f"  解析结果: {receipt.status.value}")
        print(f"  错误信息: {receipt.error_message}")
        
        print("\n[步骤4] 加入重试队列")
        from app.services import add_to_retry_queue
        from app.models import RetryType
        retry, msg = add_to_retry_queue(
            db, RetryType.RECEIPT_PARSE, str(receipt.id),
            last_error=receipt.error_message
        )
        print(f"  重试任务ID: {retry.id}")
        print(f"  重试次数: {retry.retry_count}/{retry.max_retry_count}")
        
        print("\n[步骤5] 查看待处理的重试任务")
        from datetime import datetime
        from app.models import RetryQueue
        retry_record = db.query(RetryQueue).filter(RetryQueue.id == retry.id).first()
        retry_record.next_retry_at = datetime.utcnow()
        db.commit()
        
        from app.services import get_pending_retries
        pending = get_pending_retries(db)
        print(f"  待处理重试任务数: {len(pending)}")
        
        print("\n[步骤6] 假设渠道补发了正确格式的回执")
        receipt2, msg = receive_channel_receipt(db, ChannelReceiptRequest(
            application_id=app.id,
            channel="tencent",
            channel_receipt_id="TENCENT_RECEIPT_002_CORRECTED",
            raw_payload='{"status": "approved", "message": "签名审核通过", "signId": "SIGN_RETRY_001"}',
            request_id="REQ_RECEIVE_RECEIPT_003"
        ))
        
        print("\n[步骤7] 解析正确格式的回执")
        receipt2, msg = parse_channel_receipt(db, receipt2.id)
        print(f"  解析结果: {receipt2.status.value}")
        
        from app.services import get_application_by_id
        app_final = get_application_by_id(db, app.id)
        print(f"  申请最终状态: {app_final.status.value}")
        
        print("\n✅ 场景4 完成：失败可追溯，正确回执可重试解析")
        
    finally:
        db.close()


def main():
    print("\n" + "#" * 80)
    print("#  短信签名审核队列服务 - 样例数据演示")
    print("#  包含：正常流程、异常拦截、重复操作、重试机制")
    print("#" * 80)
    
    session_factory = setup_database()
    
    scenario_1_normal_flow(session_factory)
    scenario_2_exception_flow(session_factory)
    scenario_3_idempotency_flow(session_factory)
    scenario_4_receipt_parse_failure(session_factory)
    
    print("\n" + "=" * 80)
    print("  所有样例场景执行完成！")
    print("  数据库文件: ./sample_sms_audit.db")
    print("=" * 80)


if __name__ == "__main__":
    main()
