from datetime import datetime
from database import SessionLocal, init_db
from services import (
    create_batch,
    add_source_attachment,
    add_policy_record,
)


def load_sample_data():
    init_db()
    db = SessionLocal()

    try:
        email_attachment = add_source_attachment(
            db=db,
            source_type="approval_email",
            reference_no="APPROVAL-2025-0589",
            title="【保单现金价值试算】5月批次审批邮件 - 小孟转发",
            received_date=datetime(2025, 5, 28, 14, 30, 0),
            original_filename="审批邮件_现金价值试算_20250528.eml",
            content="""
            发件人: 财务部 <finance@company.com>
            收件人: 运营部 <operations@company.com>
            日期: 2025-05-28 14:30:00
            主题: 回复: 【保单现金价值试算】5月批次审批

            小孟你好，

            关于保单 P2025003 的现金价值，经财务复核：
            - 原口径计算：¥15,800
            - 经核实投保时间为2020年3月15日，应按旧条款计算
            - 旧口径现金价值：¥18,500
            - 此单需追溯调整，请在本次试算中按旧口径录入

            财务部 - 李总

            ---------- 转发邮件 ----------
            保单号: P2025003
            投保人: 陈美丽
            生效日期: 2020-3-15
            原始现金价值: ¥15,800
            经办人: 阿梅
            """,
            notes="审批邮件补充的旧口径数据，需特殊处理",
        )

        batch = create_batch(
            db=db,
            batch_no="CV-2025-001",
            name="2025年5月第一批保单现金价值试算",
            source="运营系统导出 + 审批邮件补充",
            created_by="小孟(运营主管)",
        )

        add_policy_record(
            db=db,
            batch_id=batch.id,
            policy_no="P2025001",
            policy_holder="张三",
            agent_nickname="阿强",
            raw_effective_date="2021年6月15日",
            raw_cash_value="¥12,500.00",
            source_type="excel_import",
            source_reference="运营系统202505导出表-第3行",
            raw_data={
                "保单号": "P2025001",
                "投保人": "张三",
                "经办人": "阿强",
                "生效日期": "2021年6月15日",
                "现金价值": "¥12,500.00",
                "来源": "202505运营数据表.xlsx",
            },
        )

        add_policy_record(
            db=db,
            batch_id=batch.id,
            policy_no="P2025002",
            policy_holder="李四",
            agent_nickname="小李",
            raw_effective_date="日期待核实",
            raw_cash_value="港币8,600",
            source_type="excel_import",
            source_reference="运营系统202505导出表-第7行",
            raw_data={
                "保单号": "P2025002",
                "投保人": "李四",
                "经办人": "小李",
                "生效日期": "日期待核实",
                "现金价值": "港币8,600",
                "备注": "客户是香港居民，币种为港币，生效日期需与档案室核实",
            },
        )

        add_policy_record(
            db=db,
            batch_id=batch.id,
            policy_no="P2025003",
            policy_holder="陈美丽",
            agent_nickname="阿梅",
            raw_effective_date="2020-3-15",
            raw_cash_value="¥18,500",
            source_type="approval_email",
            source_reference="审批邮件APPROVAL-2025-0589",
            source_attachment_id=email_attachment.id,
            raw_data={
                "保单号": "P2025003",
                "投保人": "陈美丽",
                "经办人": "阿梅",
                "生效日期": "2020-3-15",
                "原始现金价值": "¥15,800",
                "审批邮件调整后": "¥18,500",
                "调整原因": "财务审批邮件指示按旧条款计算",
                "来源": "审批邮件APPROVAL-2025-0589",
            },
        )

        print("=" * 60)
        print("样例数据导入完成")
        print("=" * 60)
        print(f"批次: {batch.batch_no} - {batch.name}")
        print(f"来源附件: {email_attachment.reference_no} - {email_attachment.title}")
        print()
        print("三条样例记录说明:")
        print("  1. P2025001 张三 - 【顺利记录】数据完整，日期格式清晰，金额带¥符号")
        print("     - 经办人外号'阿强'自动映射为'王志强'")
        print("     - 日期'2021年6月15日'自动解析为标准格式")
        print("     - 金额'¥12,500.00'自动解析为12500，币种CNY")
        print()
        print("  2. P2025002 李四 - 【需要人工确认】日期格式异常，币种为港币")
        print("     - 生效日期'日期待核实'无法解析，自动挂起")
        print("     - 金额'港币8,600'解析为8600，币种HKD")
        print("     - 经办人外号'小李'自动映射为'李明华'")
        print("     - 需要人工核实生效日期后确认")
        print()
        print("  3. P2025003 陈美丽 - 【审批邮件旧口径】从审批邮件补充，有完整来源追溯")
        print("     - 关联审批邮件附件APPROVAL-2025-0589")
        print("     - 原始金额¥15,800，经审批邮件调整为¥18,500")
        print("     - 完整记录调整理由和审批来源")
        print("     - 经办人外号'阿梅'自动映射为'刘梅芳'")
        print("=" * 60)

        return batch.id

    finally:
        db.close()


if __name__ == "__main__":
    load_sample_data()
