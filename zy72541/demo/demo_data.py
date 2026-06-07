from models import (
    GrayBatch, GrayRecord, AnnotationMessage, DataStore
)
from core import AlertProcessor
from exporter import ExportManager


class DemoDataLoader:
    def __init__(self):
        self.store = DataStore()
        self.processor = AlertProcessor()
        self.exporter = ExportManager()

    def load_full_demo(self):
        print("=" * 60)
        print("  客服知识片段过期预警 - 演示数据加载")
        print("=" * 60)

        self.store.clear_all()
        print("\n[步骤1] 创建灰度批次（第一次导入）")
        batch = self._create_demo_batch()
        self.store.save_batch(batch)
        print(f"  ✓ 批次创建: {batch.batch_id} - {batch.name}")
        print(f"    包含 {len(batch.records)} 条记录")

        print("\n[步骤2] 第一次跑预警（仅灰度批次数据）")
        results = self.processor.process_batch(batch, operator="system")
        print(f"  ✓ 预警完成，生成 {len(results)} 条结果")
        for r in results:
            print(f"    - {r.session_id}: 预警={r.alert_status.value}, 脱敏={r.desensitization_status.value}")

        print("\n[步骤3] 标注负责人周姐补看标注员留言（补录现场说法）")
        annotations = self._create_demo_annotations()
        for ann in annotations:
            self.store.save_annotation(ann)
            print(f"  ✓ 标注员留言: {ann.annotation_id} (标注员: {ann.annotator})")

        print("\n[步骤4] 补录标注员留言后，应用到预警结果")
        result_map = {r.session_id + r.knowledge_id: r for r in results}
        for ann in annotations:
            key = ann.session_id + ann.knowledge_id
            if key in result_map:
                result = self.processor.apply_annotation(
                    result_map[key].result_id,
                    ann,
                    operator="周姐"
                )
                print(f"  ✓ 已更新 {result.session_id}: {result.alert_status.value}")

        print("\n[步骤5] 周姐处理手机号漏遮，交给算法复核（不急于归正常）")
        for r in self.store.get_results_by_batch(batch.batch_id):
            if r.desensitization_status.value == "手机号漏遮":
                print(f"  ⚠  待算法复核: {r.session_id}, 发现手机号: {r.raw_phone_found}")

        print("\n[步骤6] 创建返工场景 - 先给旧结论，后来标注员补现场说法")
        rework_result = self._setup_rework_scenario(batch.batch_id)

        print("\n[步骤7] 重跑批次（模拟一次重跑）")
        rerun_results = self.processor.rerun_batch(batch.batch_id, operator="周姐")
        print(f"  ✓ 批次重跑完成，共 {len(rerun_results)} 条结果")

        print("\n[步骤8] 生成脱敏导出")
        all_results = self.store.get_all_results()
        export_path = self.exporter.export_results_to_excel(all_results, batch_id=batch.batch_id)
        print(f"  ✓ 导出文件: {export_path}")

        print("\n" + "=" * 60)
        print("  演示数据加载完成！")
        print("=" * 60)
        self._print_summary()

        return batch.batch_id

    def _create_demo_batch(self) -> GrayBatch:
        batch = GrayBatch(
            batch_id="GRAY_20260601_001",
            name="2026年6月第1批灰度-客服知识片段",
            created_by="算法平台"
        )

        record1 = GrayRecord(
            session_id="SESS_001",
            knowledge_id="K_001",
            original_question="退款多久到账？",
            current_answer="亲，退款一般3-5个工作日到账哦，请耐心等待~",
            raw_text=""
        )
        batch.add_record(record1)

        record2 = GrayRecord(
            session_id="SESS_002",
            knowledge_id="K_002",
            original_question="怎么联系人工客服？",
            current_answer="您可以拨打我们的客服电话13812345678，工作时间9:00-18:00",
            raw_text=""
        )
        batch.add_record(record2)

        record3 = GrayRecord(
            session_id="SESS_003",
            knowledge_id="K_003",
            original_question="会员有什么权益？",
            current_answer="旧版会员可享受95折优惠，还有积分兑换活动",
            raw_text=""
        )
        batch.add_record(record3)

        record4 = GrayRecord(
            session_id="SESS_004",
            knowledge_id="K_004",
            original_question="物流几天能到？",
            current_answer="一般发货后3-4天送达，偏远地区可能延迟",
            raw_text=""
        )
        batch.add_record(record4)

        return batch

    def _create_demo_annotations(self):
        annotations = []

        ann1 = AnnotationMessage(
            annotation_id="ANN_001",
            session_id="SESS_003",
            knowledge_id="K_003",
            annotator="小李",
            on_site_statement="现场确认：最新口径已经改成会员权益升级了，现在是9折+免运费，之前的旧版规则已变更，这是现场说法哦",
            old_answer="旧版会员可享受95折优惠，还有积分兑换活动",
            remark="5月刚更新的政策，知识库还没同步"
        )
        annotations.append(ann1)

        ann2 = AnnotationMessage(
            annotation_id="ANN_002",
            session_id="SESS_004",
            knowledge_id="K_004",
            annotator="小王",
            on_site_statement="618期间物流调整了，实际操作是发货后5-7天送达，最新口径已调整",
            remark="大促期间物流时效变化，需要临时更新"
        )
        annotations.append(ann2)

        return annotations

    def _setup_rework_scenario(self, batch_id: str):
        print("    → 创建返工记录 SESS_005，初始结论正常，后来补标注员留言")

        record = GrayRecord(
            session_id="SESS_005",
            knowledge_id="K_005",
            original_question="发票怎么开？",
            current_answer="下单后联系客服开票，需要提供开票信息",
            raw_text=""
        )

        batch = self.store.get_batch(batch_id)
        batch.add_record(record)
        batch.processed = False
        self.store.save_batch(batch)

        temp_results = self.processor.process_batch(batch, operator="system")
        target_result = next(r for r in temp_results if r.session_id == "SESS_005")
        print(f"    → 初始状态: {target_result.alert_status.value}")

        ann = AnnotationMessage(
            annotation_id="ANN_003",
            session_id="SESS_005",
            knowledge_id="K_005",
            annotator="小张",
            on_site_statement="现场说法：开票政策改了，现在可以自助开票，不需要联系客服了，最新口径已更新",
            old_answer="下单后联系客服开票，需要提供开票信息",
            remark="开票系统升级后流程变了"
        )
        self.store.save_annotation(ann)

        updated = self.processor.apply_annotation(target_result.result_id, ann, operator="周姐")
        print(f"    → 补录标注员留言后: {updated.alert_status.value} (知识过期)")

        new_answer = "您好，现在可以自助开票啦！进入订单详情，点击'申请开票'按钮即可，电子发票10分钟内发送到您的邮箱~"
        final_result = self.processor.rework_record(updated.result_id, new_answer, ann, operator="周姐")
        print(f"    → 返工处理后: {final_result.alert_status.value}，口径已更新")

        return final_result

    def _print_summary(self):
        all_results = self.store.get_all_results()
        print("\n📊 最终结果统计:")
        print(f"  总记录数: {len(all_results)}")

        status_map = {}
        for r in all_results:
            s = r.alert_status.value
            status_map[s] = status_map.get(s, 0) + 1

        for s, cnt in status_map.items():
            print(f"    {s}: {cnt} 条")

        print("\n📋 三种典型场景:")
        print("  ✅ SESS_001: 顺利记录 - 正常，脱敏通过")
        print("  ⚠  SESS_002: 手机号漏遮 - 待算法复核，别急着归正常")
        print("  🔄 SESS_003/SESS_004: 标注员留言补来的旧口径 - 知识过期")
        print("  🔁 SESS_005: 返工场景 - 先正常，补现场说法后变过期，返工后更新")
