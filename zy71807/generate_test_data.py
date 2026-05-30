#!/usr/bin/env python3
import os
import sys
import json
from datetime import datetime

# 清除旧数据
for f in ['risk_review.db']:
    if os.path.exists(f):
        os.remove(f)
import shutil
if os.path.exists('evidence_storage'):
    shutil.rmtree('evidence_storage')
if os.path.exists('test_data'):
    shutil.rmtree('test_data')

os.makedirs('test_data', exist_ok=True)

from models import SourceType, EvidenceType
from service import RiskReviewService
from database import get_review_record

service = RiskReviewService()

# 生成模拟证据文件
def make_screenshot(customer_id):
    content = f"APPROVAL_SCREENSHOT_{customer_id}_{datetime.now().isoformat()}_审批通过截图".encode('utf-8')
    path = f"test_data/{customer_id}_screenshot.png"
    with open(path, 'wb') as f:
        f.write(content)
    return path, content

def make_email(customer_id):
    content = f"SUPPLEMENT_EMAIL_{customer_id}_{datetime.now().isoformat()}_补充说明邮件\n\n尊敬的领导：\n\n关于客户风险问卷的补充说明...".encode('utf-8')
    path = f"test_data/{customer_id}_email.eml"
    with open(path, 'wb') as f:
        f.write(content)
    return path, content

print("="*60)
print("生成客户风险问卷补审测试数据")
print("="*60)
print()

# 场景1: 完全正常流程的记录 - 走完所有流程
print("【场景1】正常流程 - 张三科技有限公司")
result1 = service.import_record(
    customer_id="CUST001",
    customer_name="张三科技有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
    assigned_to="风控经理老李",
)
print(f"  导入记录 #{result1.created_record.id}")
print(f"  当前状态: {result1.created_record.current_status.value}")

# 上传审批截图
screenshot1_path, screenshot1_content = make_screenshot("CUST001")
with open(screenshot1_path, 'rb') as f:
    ev1 = service.add_evidence(
        result1.created_record.id,
        EvidenceType.APPROVAL_SCREENSHOT,
        f.read(),
        "CUST001_审批截图.png",
        "操作员小王",
        "2024年5月1日系统审批截图"
    )
print(f"  上传审批截图，状态变为: {get_review_record(result1.created_record.id, False).current_status.value}")

# 上传补充邮件
email1_path, email1_content = make_email("CUST001")
with open(email1_path, 'rb') as f:
    ev2 = service.add_evidence(
        result1.created_record.id,
        EvidenceType.SUPPLEMENT_EMAIL,
        f.read(),
        "CUST001_补充邮件.eml",
        "操作员小王",
        "客户提供的风险补充说明邮件"
    )
print(f"  上传补充邮件，状态变为: {get_review_record(result1.created_record.id, False).current_status.value}")

# 人工确认
confirm1 = service.manual_confirm(
    result1.created_record.id,
    "复核员小陈",
    "材料齐全，信息一致，确认无误"
)
print(f"  人工确认完成，状态变为: {confirm1.current_status.value}")

# 风控复核通过
review1 = service.risk_review(
    result1.created_record.id,
    "风控经理老李",
    True,
    "风险等级评估为低风险，同意通过"
)
print(f"  风控复核通过，最终状态: {review1.current_status.value}")
print()

# 场景2: 缺少补充邮件 - 卡在等待补充邮件
print("【场景2】缺少补充邮件 - 李四贸易有限公司")
result2 = service.import_record(
    customer_id="CUST002",
    customer_name="李四贸易有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
    assigned_to="风控经理老李",
)
print(f"  导入记录 #{result2.created_record.id}")

# 只上传审批截图，不上传邮件
screenshot2_path, screenshot2_content = make_screenshot("CUST002")
with open(screenshot2_path, 'rb') as f:
    service.add_evidence(
        result2.created_record.id,
        EvidenceType.APPROVAL_SCREENSHOT,
        f.read(),
        "CUST002_审批截图.png",
        "操作员小王",
        "2024年5月2日系统审批截图"
    )
print(f"  只上传审批截图，状态: {get_review_record(result2.created_record.id, False).current_status.value}")
print(f"  待处理原因: {get_review_record(result2.created_record.id, False).pending_reason}")
print()

# 场景3: 重复导入 - 王五实业有限公司导入两次
print("【场景3】重复导入检测 - 王五实业有限公司")
result3a = service.import_record(
    customer_id="CUST003",
    customer_name="王五实业有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
    assigned_to="风控经理老李",
)
print(f"  第一次导入记录 #{result3a.created_record.id}，重复标记: {result3a.is_duplicate}")

# 第二天日报重复导入同一客户
result3b = service.import_record(
    customer_id="CUST003",
    customer_name="王五实业有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.DAILY_REPORT,
    source_batch_id="DAILY_20240502",
    created_by="操作员小张",
    assigned_to="风控经理老李",
)
print(f"  第二次导入记录 #{result3b.created_record.id}，重复标记: {result3b.is_duplicate}")
print(f"  重复原记录ID: {result3b.existing_record_id}")
print(f"  匹配类型: {result3b.match_type}")
print()

# 场景4: 证据文件重复 - 使用相同截图文件导入不同客户
print("【场景4】证据文件重复检测 - 赵六集团")
result4 = service.import_record(
    customer_id="CUST004",
    customer_name="赵六集团股份有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.MANUAL_UPLOAD,
    source_batch_id="MANUAL_20240502",
    created_by="操作员小张",
    assigned_to="风控经理老王",
)
print(f"  导入记录 #{result4.created_record.id}")

# 上传与CUST001相同的截图内容
with open(screenshot1_path, 'rb') as f:
    ev_dup = service.add_evidence(
        result4.created_record.id,
        EvidenceType.APPROVAL_SCREENSHOT,
        f.read(),
        "CUST004_审批截图.png",
        "操作员小张",
        "声称是CUST004的审批截图"
    )
record4 = get_review_record(result4.created_record.id, False)
print(f"  上传了与CUST001相同的截图文件")
print(f"  记录被标记为重复: {record4.is_duplicate}")
print(f"  重复原记录ID: {record4.duplicate_of_id}")
print()

# 场景5: 撤回修正流程 - 钱七公司
print("【场景5】撤回修正流程 - 钱七投资有限公司")
result5 = service.import_record(
    customer_id="CUST005",
    customer_name="钱七投资有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
    assigned_to="风控经理老李",
)
print(f"  导入记录 #{result5.created_record.id}")

# 上传截图和邮件
screenshot5_path, _ = make_screenshot("CUST005")
email5_path, _ = make_email("CUST005")
with open(screenshot5_path, 'rb') as f:
    service.add_evidence(
        result5.created_record.id, EvidenceType.APPROVAL_SCREENSHOT,
        f.read(), "CUST005_审批截图.png", "操作员小王", "上传审批截图"
    )
with open(email5_path, 'rb') as f:
    service.add_evidence(
        result5.created_record.id, EvidenceType.SUPPLEMENT_EMAIL,
        f.read(), "CUST005_补充邮件.eml", "操作员小王", "上传补充邮件"
    )

# 人工确认前发现信息有误，撤回
record5 = get_review_record(result5.created_record.id, False)
print(f"  材料齐全，当前状态: {record5.current_status.value}")
withdrawn5 = service.withdraw_record(
    result5.created_record.id,
    "复核员小陈",
    "发现客户名称有误，应为'钱七投资控股有限公司'，需要修正后重新提交"
)
print(f"  已撤回，状态: {withdrawn5.current_status.value}")

# 标记需要修正并创建新记录
corrected5 = service.correct_record(
    result5.created_record.id,
    "操作员小王",
    "客户名称修正为'钱七投资控股有限公司'",
    reset_to_start=True
)
print(f"  标记修正，原记录状态: {corrected5.current_status.value}")
print(f"  已创建新的修正记录，重新开始流程")
print()

# 场景6: 风控复核驳回 - 孙八金融
print("【场景6】风控复核驳回 - 孙八金融服务有限公司")
result6 = service.import_record(
    customer_id="CUST006",
    customer_name="孙八金融服务有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
    assigned_to="风控经理老李",
)
print(f"  导入记录 #{result6.created_record.id}")

# 完整上传所有材料
screenshot6_path, _ = make_screenshot("CUST006")
email6_path, _ = make_email("CUST006")
with open(screenshot6_path, 'rb') as f:
    service.add_evidence(
        result6.created_record.id, EvidenceType.APPROVAL_SCREENSHOT,
        f.read(), "CUST006_审批截图.png", "操作员小王"
    )
with open(email6_path, 'rb') as f:
    service.add_evidence(
        result6.created_record.id, EvidenceType.SUPPLEMENT_EMAIL,
        f.read(), "CUST006_补充邮件.eml", "操作员小王"
    )
service.manual_confirm(result6.created_record.id, "复核员小陈", "材料齐全")

# 风控驳回
rejected6 = service.risk_review(
    result6.created_record.id,
    "风控经理老李",
    False,
    "客户涉及高风险行业，补充材料不足以覆盖风险，需要重新评估"
)
print(f"  风控复核驳回，最终状态: {rejected6.current_status.value}")
print()

# 场景7: 边界情况 - 问卷版本不同不视为重复
print("【场景7】边界情况 - 问卷版本不同不视为重复")
result7a = service.import_record(
    customer_id="CUST007",
    customer_name="周九科技有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
)
print(f"  导入记录 #{result7a.created_record.id}，问卷版本v1.0")

result7b = service.import_record(
    customer_id="CUST007",
    customer_name="周九科技有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v2.0",
    source_type=SourceType.BATCH_IMPORT,
    source_batch_id="BATCH_20240501",
    created_by="操作员小王",
)
print(f"  导入记录 #{result7b.created_record.id}，问卷版本v2.0")
print(f"  是否被标记重复: {result7b.is_duplicate}")
print(f"  说明: 同一客户不同版本问卷不视为重复")
print()

# 场景8: 边界情况 - 手动上传来源
print("【场景8】边界情况 - 手动上传来源")
result8 = service.import_record(
    customer_id="CUST008",
    customer_name="吴十能源有限公司",
    questionnaire_id="RISK_Q_2024",
    questionnaire_version="v1.0",
    source_type=SourceType.MANUAL_UPLOAD,
    source_batch_id="MANUAL_URGENT_20240503",
    created_by="风控经理老李",
    auto_detect_duplicate=False,
)
print(f"  紧急手动导入记录 #{result8.created_record.id}")
print(f"  来源类型: {result8.created_record.source_type.value}")
print(f"  跳过重复检测: 是")
print()

# 场景9: 批量导入JSON文件
print("【场景9】批量导入JSON文件")
batch_data = [
    {
        "customer_id": "CUST009",
        "customer_name": "郑十一制造有限公司",
        "questionnaire_id": "RISK_Q_2024",
        "questionnaire_version": "v1.0",
        "assigned_to": "风控经理老李",
    },
    {
        "customer_id": "CUST010",
        "customer_name": "王十二物流有限公司",
        "questionnaire_id": "RISK_Q_2024",
        "questionnaire_version": "v1.0",
        "assigned_to": "风控经理老王",
    },
    {
        "customer_id": "CUST001",
        "customer_name": "张三科技有限公司",
        "questionnaire_id": "RISK_Q_2024",
        "questionnaire_version": "v1.0",
        "assigned_to": "风控经理老李",
    },
]
batch_json = "test_data/batch_import.json"
with open(batch_json, 'w', encoding='utf-8') as f:
    json.dump(batch_data, f, ensure_ascii=False, indent=2)

batch_results = service.batch_import(
    batch_data,
    source_batch_id="BATCH_20240503",
    created_by="操作员小张",
    source_type=SourceType.DAILY_REPORT
)
for r in batch_results:
    status = "⚠️ 重复" if r.is_duplicate else "✅ 新建"
    print(f"  {status} #{r.created_record.id}: {r.created_record.customer_name}")
print()

# 场景10: 部分完成流程 - 卡在不同阶段
print("【场景10】混合状态 - 卡在不同阶段的记录")

# CUST011: 只导入，未上传任何材料
r10a = service.import_record(
    "CUST011", "冯十一咨询有限公司", "RISK_Q_2024", "v1.0",
    SourceType.BATCH_IMPORT, "BATCH_20240503", "操作员小王", "风控经理老李"
)
print(f"  #{r10a.created_record.id}: 冯十一咨询有限公司 - 待上传截图")

# CUST012: 截图上传了，邮件上传了，待人工确认
r10b = service.import_record(
    "CUST012", "陈十二建筑有限公司", "RISK_Q_2024", "v1.0",
    SourceType.BATCH_IMPORT, "BATCH_20240503", "操作员小王", "风控经理老李"
)
sc12, _ = make_screenshot("CUST012")
em12, _ = make_email("CUST012")
with open(sc12, 'rb') as f:
    service.add_evidence(r10b.created_record.id, EvidenceType.APPROVAL_SCREENSHOT,
        f.read(), "CUST012截图.png", "操作员小王")
with open(em12, 'rb') as f:
    service.add_evidence(r10b.created_record.id, EvidenceType.SUPPLEMENT_EMAIL,
        f.read(), "CUST012邮件.eml", "操作员小王")
print(f"  #{r10b.created_record.id}: 陈十二建筑有限公司 - 待人工确认")

# CUST013: 已人工确认，待风控复核
r10c = service.import_record(
    "CUST013", "褚十三教育有限公司", "RISK_Q_2024", "v1.0",
    SourceType.BATCH_IMPORT, "BATCH_20240503", "操作员小王", "风控经理老李"
)
sc13, _ = make_screenshot("CUST013")
em13, _ = make_email("CUST013")
with open(sc13, 'rb') as f:
    service.add_evidence(r10c.created_record.id, EvidenceType.APPROVAL_SCREENSHOT,
        f.read(), "CUST013截图.png", "操作员小王")
with open(em13, 'rb') as f:
    service.add_evidence(r10c.created_record.id, EvidenceType.SUPPLEMENT_EMAIL,
        f.read(), "CUST013邮件.eml", "操作员小王")
service.manual_confirm(r10c.created_record.id, "复核员小陈", "材料齐全")
print(f"  #{r10c.created_record.id}: 褚十三教育有限公司 - 待风控复核")

print()

# 输出统计信息
print("="*60)
print("测试数据生成完成！")
print("="*60)
stats = service.get_statistics()
print(f"总记录数: {stats['total']}")
print(f"重复记录: {stats['duplicates']}")
print()
print("按状态分布:")
for s, c in stats['by_status'].items():
    if c > 0:
        label = {
            'pending_approval_screenshot': '等待审批截图',
            'pending_supplement_email': '等待补充邮件',
            'pending_manual_confirm': '等待人工确认',
            'pending_risk_review': '等待风控复核',
            'approved': '已通过',
            'rejected': '已驳回',
            'withdrawn': '已撤回',
            'needs_correction': '需要修正',
        }.get(s, s)
        print(f"  {label}: {c}")
print()
print("接下来可以运行:")
print("  python3 cli.py stats           # 查看统计")
print("  python3 cli.py list            # 查看列表")
print("  python3 cli.py show --record-id 1  # 查看记录1详情")
print("  python3 cli.py export --output export.csv  # 导出CSV")
print("  python3 web.py                 # 启动Web界面")
