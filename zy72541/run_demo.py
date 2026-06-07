#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys
sys.path.insert(0, '.')

from models import DataStore, GrayBatch, GrayRecord, AnnotationMessage
from core import AlertProcessor
from exporter import ExportManager

print("=" * 70)
print("  客服知识片段过期预警 - 演示流程")
print("=" * 70)

store = DataStore()
store.clear_all()
processor = AlertProcessor()
exporter = ExportManager()

print("\n📦 [第一步] 导入灰度批次（第一次导入）")
batch = GrayBatch(
    batch_id="GRAY_20260601_001",
    name="2026年6月第1批灰度-客服知识片段",
    created_by="算法平台"
)
batch.add_record(GrayRecord("SESS_001", "K_001", "退款多久到账？", "亲，退款一般3-5个工作日到账哦，请耐心等待~"))
batch.add_record(GrayRecord("SESS_002", "K_002", "怎么联系人工客服？", "您可以拨打我们的客服电话13812345678，工作时间9:00-18:00"))
batch.add_record(GrayRecord("SESS_003", "K_003", "会员有什么权益？", "旧版会员可享受95折优惠，还有积分兑换活动"))
batch.add_record(GrayRecord("SESS_004", "K_004", "物流几天能到？", "一般发货后3-4天送达，偏远地区可能延迟"))
batch.add_record(GrayRecord("SESS_005", "K_005", "发票怎么开？", "下单后联系客服开票，需要提供开票信息"))
store.save_batch(batch)
print(f"  ✓ 批次创建: {batch.batch_id}，共 {len(batch.records)} 条记录")

print("\n🔍 [第二步] 第一次跑预警（仅灰度批次数据）")
results = processor.process_batch(batch, operator="system")
for r in results:
    print(f"  {r.session_id}: 预警={r.alert_status.value} | 脱敏={r.desensitization_status.value}")

print("\n📝 [第三步] 标注负责人周姐补看标注员留言（补录现场说法）")
annotations = [
    AnnotationMessage("ANN_001", "SESS_003", "K_003", "小李",
                      "现场确认：最新口径已经改成会员权益升级了，现在是9折+免运费，之前的旧版规则已变更，这是现场说法哦",
                      "旧版会员可享受95折优惠", "5月刚更新的政策，知识库还没同步"),
    AnnotationMessage("ANN_002", "SESS_004", "K_004", "小王",
                      "618期间物流调整了，实际操作是发货后5-7天送达，最新口径已调整",
                      None, "大促期间物流时效变化"),
    AnnotationMessage("ANN_003", "SESS_005", "K_005", "小张",
                      "现场说法：开票政策改了，现在可以自助开票，不需要联系客服了，最新口径已更新",
                      "下单后联系客服开票", "开票系统升级后流程变了")
]
for ann in annotations:
    store.save_annotation(ann)
    print(f"  ✓ {ann.annotation_id}: 标注员={ann.annotator}")

print("\n🔄 [第四步] 补录标注员留言后，应用到预警结果")
result_map = {r.session_id + r.knowledge_id: r for r in results}
for ann in annotations:
    key = ann.session_id + ann.knowledge_id
    if key in result_map:
        result = processor.apply_annotation(result_map[key].result_id, ann, operator="周姐")
        print(f"  {result.session_id}: 状态更新为 {result.alert_status.value} (证据={result.evidence_source.value})")

print("\n⚠  [第五步] 手机号漏遮处理：SESS_002 留给算法复核，不急于归正常")
sess002 = next(r for r in store.get_all_results() if r.session_id == "SESS_002")
print(f"  SESS_002: 发现手机号 {sess002.raw_phone_found}")
print(f"  当前状态: 预警={sess002.alert_status.value}, 脱敏={sess002.desensitization_status.value}")
print("  (留给算法同事复核，暂不做自动修复)")

print("\n🔁 [第六步] 返工场景：SESS_005 先给旧结论，补现场说法后重新判定")
sess005 = next(r for r in store.get_all_results() if r.session_id == "SESS_005")
new_answer = "您好，现在可以自助开票啦！进入订单详情，点击'申请开票'按钮即可，电子发票10分钟内发送到您的邮箱~"
final = processor.rework_record(sess005.result_id, new_answer, annotations[2], operator="周姐")
print(f"  返工前状态: 知识过期")
print(f"  返工后状态: {final.alert_status.value}，版本已更新到 v{final.version}")

print("\n📥 [第七步] 生成脱敏导出（自动手机号脱敏）")
all_results = store.get_all_results()
export_path = exporter.export_results_to_excel(all_results, batch_id=batch.batch_id)
print(f"  ✓ 导出文件: {export_path}")
print(f"    包含 {len(all_results)} 条记录，自动脱敏处理")

print("\n" + "=" * 70)
print("  🎉 演示完成！三种典型场景结果对比:")
print("=" * 70)

final_results = store.get_all_results()
for r in final_results:
    icon = "✅" if r.alert_status.value == "正常" else ("⚠" if r.alert_status.value == "待算法复核" else ("🔄" if r.alert_status.value == "知识过期" else "🔁"))
    print(f"  {icon} {r.session_id}: {r.original_question}")
    print(f"     → 预警: {r.alert_status.value} | 脱敏: {r.desensitization_status.value} | 证据: {r.evidence_source.value}")
    if r.raw_phone_found:
        print(f"     → 漏遮手机号: {r.raw_phone_found}")

print("\n📊 统计:")
counts = {}
for r in final_results:
    k = r.alert_status.value
    counts[k] = counts.get(k, 0) + 1
for k, v in counts.items():
    print(f"  {k}: {v} 条")

print("\n💡 提示:")
print("  - 运行 'python3 api_server.py' 启动小看板Web界面")
print("  - 运行 'python3 cli.py --help' 查看命令行用法")
