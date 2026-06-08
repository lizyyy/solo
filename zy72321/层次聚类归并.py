#!/usr/bin/env python3
import csv
import json
import os
from datetime import datetime
from collections import defaultdict

class HierarchicalClusterMerger:
    def __init__(self, sample_file, param_file, output_dir="输出结果"):
        self.sample_file = sample_file
        self.param_file = param_file
        self.output_dir = output_dir

        self.records = []
        self.params = {}

        self.student_registry = {}

        self.history = []
        self.manual_corrections = []
        self.error_log = []

        os.makedirs(output_dir, exist_ok=True)

    # ============================================================
    #  步骤1：导入抽样名单
    # ============================================================
    def load_data(self):
        print("=" * 60)
        print("【步骤1】导入抽样名单")
        print("=" * 60)

        with open(self.sample_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            self.records = list(reader)

        grouped = defaultdict(list)
        for rec in self.records:
            grouped[rec['学号']].append(rec)

        for student_id, recs in grouped.items():
            self.student_registry[student_id] = {
                "学号": student_id,
                "姓名": recs[0]['姓名'],
                "班级": recs[0]['班级'],
                "原始提交": recs,
                "提交记录数": len(recs),
                "原始记录ID": [r['原始记录ID'] for r in recs],
                "答案版本": [r['答案版本'] for r in recs],
                "导入时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "各轮快照": {},
                "最新状态": {
                    "处理结果": "待归并",
                    "处理方式": "",
                    "口径版本": "",
                    "需要复核": False,
                    "误差说明": "",
                    "处理建议": "",
                    "优先级": "",
                    "运行标签": "未运行"
                },
                "复核留痕": {
                    "原始说法": "",
                    "改后值": "",
                    "处理原因": "",
                    "下一步找谁": "",
                    "复核状态": "未进入复核"
                }
            }

        print(f"✓ 成功导入 {len(self.records)} 条抽样记录，归并为 {len(self.student_registry)} 名学生")
        for sid, info in self.student_registry.items():
            print(f"  → {sid} {info['姓名']} ({' / '.join(info['答案版本'])})")

        self._append_history({
            "操作": "导入抽样名单",
            "记录数": len(self.records),
            "学生数": len(self.student_registry),
            "说明": f"从{os.path.basename(self.sample_file)}导入数据"
        })

    # ============================================================
    #  步骤2：实验助理小穆查看参数调试表
    # ============================================================
    def load_params(self):
        print("\n" + "=" * 60)
        print("【步骤2】实验助理小穆查看参数调试表")
        print("=" * 60)

        with open(self.param_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.params[row['参数名称']] = row

        linked_students = defaultdict(list)
        for name, p in self.params.items():
            if p.get('关联学号'):
                linked_students[p['关联学号']].append(name)

        for sid, param_names in linked_students.items():
            if sid in self.student_registry:
                self.student_registry[sid]["关联参数"] = param_names

        print("✓ 参数配置加载完成：")
        for name, p in self.params.items():
            linked = f" → 关联学号 {p.get('关联学号', '无')}" if p.get('关联学号') else ""
            print(f"  → {name}: {p['当前口径']} (旧口径: {p['旧口径'] or '无'}){linked}")

        self._append_history({
            "操作": "查看参数调试表",
            "参数数量": len(self.params),
            "关联学号数": len(linked_students),
            "说明": "确认当前口径与旧口径差异，标出参数关联的学生"
        })

    # ============================================================
    #  步骤3：层次聚类归并（可重复调用，每次存入各轮快照 + 更新最新状态）
    # ============================================================
    def cluster_and_merge(self, run_type="正常材料"):
        print("\n" + "=" * 60)
        print(f"【步骤3】层次聚类归并处理 ({run_type})")
        print("=" * 60)

        self.error_log = []

        for student_id, info in self.student_registry.items():
            recs = info["原始提交"]
            result = self._process_student(student_id, recs, run_type)

            info["各轮快照"][run_type] = dict(result)

            info["最新状态"].update({
                "处理结果": result["处理结果"],
                "处理方式": result["处理方式"],
                "口径版本": result["口径版本"],
                "需要复核": result["需要复核"],
                "误差说明": result["误差说明"],
                "处理建议": result["处理建议"],
                "优先级": result["优先级"],
                "运行标签": run_type
            })

            if result["需要复核"]:
                info["复核留痕"].update({
                    "原始说法": result["误差说明"],
                    "改后值": "",
                    "处理原因": "",
                    "下一步找谁": result["处理建议"],
                    "复核状态": "待业务运营复核"
                })
            elif result["误差说明"]:
                info["复核留痕"].update({
                    "复核状态": "系统提示(非复核)"
                })

        abnormal_ids = [sid for sid, info in self.student_registry.items()
                        if info["各轮快照"].get(run_type, {}).get("误差说明")]

        print(f"┌─ 本轮汇总 ──────────────────────────────────────────────┐")
        print(f"│  处理学生数: {len(self.student_registry):<36}│")
        print(f"│  异常数:    {len(abnormal_ids):<36}│")
        for sid in abnormal_ids:
            st = self.student_registry[sid]["最新状态"]
            tag = "需复核" if st["需要复核"] else "系统提示"
            print(f"│   · {sid} {self.student_registry[sid]['姓名']} [{tag}] │")
        print(f"└─────────────────────────────────────────────────────────┘")

        self._sync_all_exports(run_type)

        self._append_history({
            "操作": f"聚类归并[{run_type}]",
            "处理学生数": len(self.student_registry),
            "异常数": len(abnormal_ids),
            "异常学生": abnormal_ids,
            "说明": "完成本轮聚类归并，误差说明已与最新状态、历史记录同步"
        })

    def _process_student(self, student_id, records, run_type):
        info = self.student_registry[student_id]
        student_name = info["姓名"]

        result = {
            "学号": student_id,
            "姓名": student_name,
            "班级": info["班级"],
            "提交记录数": len(records),
            "处理结果": "",
            "处理方式": "",
            "口径版本": "",
            "需要复核": False,
            "误差说明": "",
            "处理建议": "",
            "优先级": "",
            "原始记录": ','.join(info["原始记录ID"])
        }

        if len(records) == 1:
            if self._needs_old_caliber(student_id, run_type):
                result["处理结果"] = "旧口径补录"
                result["处理方式"] = "追溯历史参数"
                result["口径版本"] = "旧口径"
                result["误差说明"] = (f"该学生({student_name})在参数调试表中存在旧口径标记"
                                      f"（{info.get('关联参数', [])}），需使用旧口径统计，"
                                      f"请勿直接按当前口径归并")
                result["处理建议"] = "请实验助理查阅参数调试表，确认历史口径后再执行"
                result["优先级"] = "中"
                print(f"⚠ {student_id} {student_name}: 旧口径补录 → 请追溯历史参数")
                self.error_log.append({
                    "学号": student_id, "姓名": student_name,
                    "类型": "旧口径补录", "误差说明": result["误差说明"],
                    "处理建议": result["处理建议"], "优先级": "中"
                })
            else:
                result["处理结果"] = "正常归并"
                result["处理方式"] = "自动处理"
                result["口径版本"] = "当前口径"
                print(f"✓ {student_id} {student_name}: 正常归并 → 自动处理完成")

        elif len(records) >= 2:
            versions = [r['答案版本'] for r in records]
            result["需要复核"] = True
            result["处理结果"] = "待业务运营复核"
            result["处理方式"] = "暂停自动归并"
            result["口径版本"] = "当前口径(待确认)"
            result["误差说明"] = (f"同一学生({student_name})提交了{len(records)}版答案"
                                  f"({', '.join(versions)})，系统不敢擅自归并，"
                                  f"必须人工确认以哪版为准")
            result["处理建议"] = "请业务运营阅读两版答案差异，确认最终采用版本后回传"
            result["优先级"] = "高"
            print(f"⚠ {student_id} {student_name}: 提交了{len(records)}版答案 → 转业务运营复核")
            self.error_log.append({
                "学号": student_id, "姓名": student_name,
                "类型": "同一学生多版答案", "误差说明": result["误差说明"],
                "处理建议": result["处理建议"], "优先级": "高"
            })

        return result

    def _needs_old_caliber(self, student_id, run_type):
        for name, p in self.params.items():
            if p.get('关联学号') == student_id:
                if '旧口径' in name or '补录' in name or p.get('旧口径') == '需补录':
                    if run_type == "补录材料" or run_type == "正常材料":
                        return True
        return False

    # ============================================================
    #  步骤4：人工修正（完整保留复核留痕）
    # ============================================================
    def apply_manual_correction(self, student_id, decision):
        print("\n" + "=" * 60)
        print("【步骤4】人工修正记录（完整保留复核留痕）")
        print("=" * 60)

        if student_id not in self.student_registry:
            print(f"✗ 未找到学号 {student_id} 的学生记录")
            return

        info = self.student_registry[student_id]
        latest = info["最新状态"]
        trace = info["复核留痕"]

        before = dict(latest)

        trace["改后值"] = decision["处理结果"]
        trace["处理原因"] = decision.get("说明", decision.get("处理原因", ""))
        if decision.get("操作人"):
            trace["下一步找谁"] = f"已由 {decision['操作人']} 确认，下一步交实验助理小穆重跑同步"
        trace["复核状态"] = "已复核"

        latest["处理结果"] = decision["处理结果"]
        latest["处理方式"] = decision["处理方式"]
        latest["口径版本"] = decision.get("口径版本", latest["口径版本"])
        latest["需要复核"] = False
        latest["误差说明"] = decision.get("说明", latest["误差说明"])
        latest["处理建议"] = "已人工复核完成，结果已同步"
        latest["优先级"] = "已处理"
        latest["运行标签"] = latest["运行标签"] + "+人工修正"

        correction = {
            "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "学号": student_id,
            "姓名": info["姓名"],
            "原始说法": trace["原始说法"],
            "改后值": trace["改后值"],
            "处理原因": trace["处理原因"],
            "下一步找谁": trace["下一步找谁"],
            "原处理结果": before["处理结果"],
            "新处理结果": decision["处理结果"],
            "操作人": decision.get('操作人', '实验助理小穆'),
        }
        self.manual_corrections.append(correction)

        print(f"✓ {student_id} {info['姓名']}:")
        print(f"    原始说法: {trace['原始说法'][:40]}...")
        print(f"    改后值  : {trace['改后值']}")
        print(f"    处理原因: {trace['处理原因']}")
        print(f"    下一步  : {trace['下一步找谁']}")

        self._append_history({
            "操作": "人工修正",
            "学号": student_id,
            "姓名": info["姓名"],
            "原始说法": trace["原始说法"],
            "改后值": trace["改后值"],
            "处理原因": trace["处理原因"],
            "下一步找谁": trace["下一步找谁"],
            "变更": f"{before['处理结果']} → {decision['处理结果']}"
        })

    # ============================================================
    #  步骤5：修正后重跑（基于同一份 registry，只同步导出）
    # ============================================================
    def rerun_after_correction(self):
        print("\n" + "=" * 60)
        print("【步骤5】修正后重跑（同一份数据，全链路同步）")
        print("=" * 60)

        self._sync_all_exports("修正后")

        print("✓ 重跑完成：列表/详情/摘要/历史/导出 已全部基于最新 registry 同步")

        self._append_history({
            "操作": "修正后重跑",
            "说明": "应用人工修正后，全链路同一份数据同步导出"
        })

    # ============================================================
    #  统一导出入口：列表、详情、摘要、误差、修正、历史 全部从 registry 取数
    # ============================================================
    def _sync_all_exports(self, run_tag):
        self._save_results(run_tag)
        self._save_errors(run_tag)
        self._save_student_details()
        self._save_summary()
        self.save_manual_corrections()
        self.save_history()

    def _save_results(self, run_tag):
        filename = f"{self.output_dir}/归并结果_{run_tag}.csv"
        fieldnames = [
            '学号', '姓名', '班级', '提交记录数', '处理结果',
            '处理方式', '口径版本', '需要复核', '误差说明',
            '处理建议', '优先级', '原始记录ID', '运行标签'
        ]
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for sid in sorted(self.student_registry.keys()):
                info = self.student_registry[sid]
                snap = info["各轮快照"].get(run_tag, info["最新状态"])
                writer.writerow({
                    '学号': sid,
                    '姓名': info["姓名"],
                    '班级': info["班级"],
                    '提交记录数': info["提交记录数"],
                    '处理结果': snap.get("处理结果", info["最新状态"]["处理结果"]),
                    '处理方式': snap.get("处理方式", info["最新状态"]["处理方式"]),
                    '口径版本': snap.get("口径版本", info["最新状态"]["口径版本"]),
                    '需要复核': snap.get("需要复核", info["最新状态"]["需要复核"]),
                    '误差说明': snap.get("误差说明", info["最新状态"]["误差说明"]),
                    '处理建议': snap.get("处理建议", info["最新状态"]["处理建议"]),
                    '优先级': snap.get("优先级", info["最新状态"]["优先级"]),
                    '原始记录ID': ','.join(info["原始记录ID"]),
                    '运行标签': run_tag
                })
        print(f"✓ 归并列表    : {filename}")

    def _save_errors(self, run_tag):
        filename = f"{self.output_dir}/误差说明_{run_tag}.csv"
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '学号', '姓名', '误差类型', '误差说明', '处理建议', '优先级', '需要复核'
            ])
            writer.writeheader()
            for sid in sorted(self.student_registry.keys()):
                info = self.student_registry[sid]
                snap = info["各轮快照"].get(run_tag, info["最新状态"])
                if snap.get("误差说明"):
                    err_type = ("同一学生多版答案" if info["提交记录数"] >= 2
                                else "旧口径补录" if "旧口径" in snap.get("处理结果", "")
                                else "其他提示")
                    writer.writerow({
                        '学号': sid,
                        '姓名': info["姓名"],
                        '误差类型': err_type,
                        '误差说明': snap["误差说明"],
                        '处理建议': snap.get("处理建议", ""),
                        '优先级': snap.get("优先级", ""),
                        '需要复核': snap.get("需要复核", False)
                    })
        print(f"✓ 误差说明    : {filename}")

    def _save_student_details(self):
        filename = f"{self.output_dir}/学生详情_最新.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.student_registry, f, ensure_ascii=False, indent=2, default=str)
        print(f"✓ 学生详情    : {filename}")

    def _save_summary(self):
        filename = f"{self.output_dir}/处理摘要.csv"
        summary = defaultdict(int)
        review_count = 0
        for info in self.student_registry.values():
            summary[info["最新状态"]["处理结果"]] += 1
            if info["最新状态"]["需要复核"]:
                review_count += 1

        fieldnames = ['指标', '数值', '说明']
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerow({'指标': '总学生数', '数值': len(self.student_registry), '说明': '按学号去重后'})
            writer.writerow({'指标': '总原始记录', '数值': len(self.records), '说明': '抽样名单原始条目'})
            writer.writerow({'指标': '待复核数', '数值': review_count, '说明': '需要业务运营介入'})
            writer.writerow({'指标': '人工修正数', '数值': len(self.manual_corrections), '说明': '累计修正次数'})
            for status, cnt in summary.items():
                writer.writerow({'指标': f'处理结果/{status}', '数值': cnt, '说明': '按最新状态统计'})
        print(f"✓ 处理摘要    : {filename}")

    def save_manual_corrections(self):
        filename = f"{self.output_dir}/人工修正记录.csv"
        fieldnames = [
            '时间', '学号', '姓名', '复核状态',
            '原始说法', '改后值', '处理原因', '下一步找谁',
            '原处理结果', '新处理结果', '操作人'
        ]
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for c in self.manual_corrections:
                writer.writerow({**c, '复核状态': '已复核'})
            for sid, info in self.student_registry.items():
                if info["最新状态"]["需要复核"]:
                    trace = info["复核留痕"]
                    writer.writerow({
                        '时间': info["导入时间"],
                        '学号': sid,
                        '姓名': info["姓名"],
                        '复核状态': '待业务运营复核',
                        '原始说法': trace["原始说法"],
                        '改后值': '',
                        '处理原因': '',
                        '下一步找谁': trace["下一步找谁"],
                        '原处理结果': info["最新状态"]["处理结果"],
                        '新处理结果': '',
                        '操作人': ''
                    })
        print(f"✓ 人工修正记录: {filename}  (含待复核的学生)")

    def save_history(self):
        filename = f"{self.output_dir}/操作历史记录.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
        print(f"✓ 操作历史记录: {filename}")

    def _append_history(self, entry):
        entry["时间"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.history.append(entry)

    # ============================================================
    #  最终一致性校验 & 展示
    # ============================================================
    def print_summary(self):
        print("\n" + "=" * 60)
        print("【最终一致性校验】误差说明 ⇄ 历史记录 ⇄ 最新状态")
        print("=" * 60)

        latest_errors = [(sid, info) for sid, info in self.student_registry.items()
                         if info["最新状态"]["误差说明"]]
        hist_clusters = [h for h in self.history if h["操作"].startswith("聚类归并")]

        print(f"  当前最新状态含误差说明的学生数: {len(latest_errors)}")
        for sid, info in latest_errors:
            st = info["最新状态"]
            tag = "★需复核" if st["需要复核"] else "○系统提示"
            print(f"    {tag} {sid} {info['姓名']}: {st['处理结果']}")

        print(f"\n  历史记录中的各轮异常数:")
        for h in hist_clusters:
            print(f"    {h['操作']}: 异常数={h.get('异常数', '?')}  学生={h.get('异常学生', [])}")

        print("\n【处理结果汇总（基于最新 registry）】")
        summary = defaultdict(int)
        for info in self.student_registry.values():
            summary[info["最新状态"]["处理结果"]] += 1
        for status, count in summary.items():
            print(f"  {status}: {count} 人")

        need_review = [(sid, info) for sid, info in self.student_registry.items()
                       if info["最新状态"]["需要复核"]]
        if need_review:
            print(f"\n⚠ 需要业务运营复核的学生 ({len(need_review)}人，不会提前归到正常)：")
            for sid, info in need_review:
                trace = info["复核留痕"]
                print(f"  → {sid} {info['姓名']}")
                print(f"      原始说法: {trace['原始说法'][:35]}...")
                print(f"      下一步  : {trace['下一步找谁']}")

def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 10 + "层次聚类名单归并系统（全链路数据一致版）" + " " * 10 + "║")
    print("╚" + "═" * 58 + "╝")

    merger = HierarchicalClusterMerger(
        sample_file="抽样名单.csv",
        param_file="参数调试表.csv"
    )

    merger.load_data()
    merger.load_params()

    print("\n" + "─" * 60)
    print("▶ 第一轮：正常材料")
    print("─" * 60)
    merger.cluster_and_merge("正常材料")

    print("\n" + "─" * 60)
    print("▶ 第二轮：错口径材料")
    print("─" * 60)
    merger.cluster_and_merge("错口径材料")

    print("\n" + "─" * 60)
    print("▶ 第三轮：补录材料")
    print("─" * 60)
    merger.cluster_and_merge("补录材料")

    print("\n" + "─" * 60)
    print("▶ 人工修正：李四 两版答案 → 业务运营确认 v2")
    print("─" * 60)
    merger.apply_manual_correction("2023002", {
        "处理结果": "正常归并(以v2版为准)",
        "处理方式": "人工确认后归并",
        "口径版本": "当前口径",
        "操作人": "业务运营-王经理",
        "说明": "经业务运营逐字比对两版答案：v1为初稿，v2补充了第3题第(2)问，确认以v2版为准"
    })

    merger.rerun_after_correction()

    merger.print_summary()

    print("\n" + "=" * 60)
    print("✓ 演示流程完成！所有输出基于同一份 student_registry 同步")
    print("=" * 60)

if __name__ == "__main__":
    main()
