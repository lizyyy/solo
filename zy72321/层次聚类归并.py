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
        self.results = []
        self.error_log = []
        self.history = []
        self.manual_corrections = []
        
        os.makedirs(output_dir, exist_ok=True)
        
    def load_data(self):
        print("=" * 60)
        print("【步骤1】导入抽样名单")
        print("=" * 60)
        
        with open(self.sample_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            self.records = list(reader)
        
        print(f"✓ 成功导入 {len(self.records)} 条抽样记录")
        for rec in self.records:
            print(f"  → {rec['学号']} {rec['姓名']} ({rec['答案版本']})")
        
        self.history.append({
            "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "操作": "导入抽样名单",
            "记录数": len(self.records),
            "说明": f"从{os.path.basename(self.sample_file)}导入数据"
        })
        
    def load_params(self):
        print("\n" + "=" * 60)
        print("【步骤2】实验助理小穆查看参数调试表")
        print("=" * 60)
        
        with open(self.param_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                self.params[row['参数名称']] = row
        
        print("✓ 参数配置加载完成，关键参数如下：")
        for name, p in self.params.items():
            print(f"  → {name}: {p['当前口径']} (旧口径: {p['旧口径'] or '无'})")
        
        self.history.append({
            "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "操作": "查看参数调试表",
            "参数数量": len(self.params),
            "说明": "确认当前口径与旧口径差异"
        })
        
    def cluster_and_merge(self, run_type="normal"):
        print("\n" + "=" * 60)
        print(f"【步骤3】层次聚类归并处理 ({run_type})")
        print("=" * 60)
        
        grouped = defaultdict(list)
        for rec in self.records:
            grouped[rec['学号']].append(rec)
        
        self.results = []
        self.error_log = []
        
        for student_id, records in grouped.items():
            result = self._process_student(student_id, records, run_type)
            self.results.append(result)
        
        self._save_results(run_type)
        self._save_errors(run_type)
        
        self.history.append({
            "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "操作": f"聚类归并[{run_type}]",
            "处理学生数": len(grouped),
            "异常数": len(self.error_log)
        })
        
    def _process_student(self, student_id, records, run_type):
        student_name = records[0]['姓名']
        result = {
            "学号": student_id,
            "姓名": student_name,
            "班级": records[0]['班级'],
            "提交记录数": len(records),
            "处理结果": "",
            "误差说明": "",
            "处理方式": "",
            "口径版本": "",
            "需要复核": False,
            "原始记录": [r['原始记录ID'] for r in records]
        }
        
        if len(records) == 1:
            rec = records[0]
            if self._needs_old_caliber(student_id, run_type):
                result["处理结果"] = "旧口径补录"
                result["处理方式"] = "追溯历史参数"
                result["口径版本"] = "旧口径"
                result["误差说明"] = f"该学生({student_name})数据需使用旧口径统计，请参考参数调试表中'旧口径补录标记'"
                print(f"⚠ {student_id} {student_name}: 旧口径补录 → 请追溯历史参数")
            else:
                result["处理结果"] = "正常归并"
                result["处理方式"] = "自动处理"
                result["口径版本"] = "当前口径"
                print(f"✓ {student_id} {student_name}: 正常归并 → 自动处理完成")
        
        elif len(records) >= 2:
            result["需要复核"] = True
            result["处理结果"] = "待业务运营复核"
            result["处理方式"] = "暂停自动归并"
            result["口径版本"] = "当前口径(待确认)"
            versions = [r['答案版本'] for r in records]
            result["误差说明"] = f"同一学生({student_name})提交了{len(records)}版答案({', '.join(versions)})，请勿自动归并，需人工确认以哪版为准"
            print(f"⚠ {student_id} {student_name}: 提交了{len(records)}版答案 → 转业务运营复核")
        
        return result
    
    def _needs_old_caliber(self, student_id, run_type):
        for name, p in self.params.items():
            if p.get('关联学号') == student_id:
                if '旧口径' in name or '补录' in name or p.get('旧口径') == '需补录':
                    if run_type == "补录材料" or run_type == "normal":
                        return True
        return False
    
    def apply_manual_correction(self, student_id, decision):
        print("\n" + "=" * 60)
        print("【步骤4】人工修正记录")
        print("=" * 60)
        
        for result in self.results:
            if result['学号'] == student_id:
                old_result = result['处理结果']
                result['处理结果'] = decision['处理结果']
                result['处理方式'] = decision['处理方式']
                result['口径版本'] = decision.get('口径版本', result['口径版本'])
                result['需要复核'] = False
                result['误差说明'] = decision.get('说明', result['误差说明'])
                
                correction = {
                    "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "学号": student_id,
                    "姓名": result['姓名'],
                    "原处理结果": old_result,
                    "新处理结果": decision['处理结果'],
                    "操作人": decision.get('操作人', '实验助理小穆'),
                    "说明": decision.get('说明', '')
                }
                self.manual_corrections.append(correction)
                
                print(f"✓ {student_id} {result['姓名']}: 已修正 → {decision['处理结果']}")
                
                self.history.append({
                    "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "操作": "人工修正",
                    "学号": student_id,
                    "变更": f"{old_result} → {decision['处理结果']}"
                })
                return
        
        print(f"✗ 未找到学号 {student_id} 的记录")
    
    def rerun_after_correction(self):
        print("\n" + "=" * 60)
        print("【步骤5】修正后重跑")
        print("=" * 60)
        
        self._save_results("修正后")
        self._save_errors("修正后")
        
        print("✓ 重跑完成，已更新输出结果")
        self.history.append({
            "时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "操作": "修正后重跑",
            "说明": "应用人工修正后重新生成结果"
        })
    
    def _save_results(self, run_type):
        filename = f"{self.output_dir}/归并结果_{run_type}.csv"
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '学号', '姓名', '班级', '提交记录数', '处理结果', 
                '处理方式', '口径版本', '需要复核', '误差说明', '原始记录'
            ])
            writer.writeheader()
            for r in self.results:
                row = {k: v for k, v in r.items() if k != '原始记录'}
                row['原始记录'] = ','.join(r['原始记录'])
                writer.writerow(row)
        print(f"✓ 归并结果已保存: {filename}")
    
    def _save_errors(self, run_type):
        filename = f"{self.output_dir}/误差说明_{run_type}.csv"
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '学号', '姓名', '误差说明', '处理建议', '优先级'
            ])
            writer.writeheader()
            for r in self.results:
                if r['误差说明']:
                    priority = '高' if r['需要复核'] else ('中' if '旧口径' in r['处理结果'] else '低')
                    suggestion = "请业务运营确认最终答案版本" if r['需要复核'] else ("请检查参数调试表确认历史口径" if '旧口径' in r['处理结果'] else "无")
                    writer.writerow({
                        '学号': r['学号'],
                        '姓名': r['姓名'],
                        '误差说明': r['误差说明'],
                        '处理建议': suggestion,
                        '优先级': priority
                    })
        print(f"✓ 误差说明已保存: {filename}")
    
    def save_manual_corrections(self):
        filename = f"{self.output_dir}/人工修正记录.csv"
        with open(filename, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=[
                '时间', '学号', '姓名', '原处理结果', '新处理结果', '操作人', '说明'
            ])
            writer.writeheader()
            writer.writerows(self.manual_corrections)
        print(f"✓ 人工修正记录已保存: {filename}")
    
    def save_history(self):
        filename = f"{self.output_dir}/操作历史记录.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.history, f, ensure_ascii=False, indent=2)
        print(f"✓ 操作历史记录已保存: {filename}")
    
    def print_summary(self):
        print("\n" + "=" * 60)
        print("【处理结果汇总】")
        print("=" * 60)
        
        summary = defaultdict(int)
        for r in self.results:
            summary[r['处理结果']] += 1
        
        for status, count in summary.items():
            print(f"  {status}: {count} 人")
        
        need_review = [r for r in self.results if r['需要复核']]
        if need_review:
            print(f"\n⚠ 需要业务运营复核的学生 ({len(need_review)}人):")
            for r in need_review:
                print(f"  → {r['学号']} {r['姓名']}: {r['误差说明'][:30]}...")

def main():
    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " " * 15 + "层次聚类名单归并系统" + " " * 25 + "║")
    print("╚" + "═" * 58 + "╝")
    
    merger = HierarchicalClusterMerger(
        sample_file="抽样名单.csv",
        param_file="参数调试表.csv"
    )
    
    merger.load_data()
    merger.load_params()
    
    print("\n" + "─" * 60)
    print("▶ 第一轮：正常材料跑一遍")
    print("─" * 60)
    merger.cluster_and_merge("正常材料")
    
    print("\n" + "─" * 60)
    print("▶ 第二轮：错口径材料跑一遍")
    print("─" * 60)
    merger.cluster_and_merge("错口径材料")
    
    print("\n" + "─" * 60)
    print("▶ 第三轮：补录材料跑一遍")
    print("─" * 60)
    merger.cluster_and_merge("补录材料")
    
    print("\n" + "─" * 60)
    print("▶ 模拟人工修正操作")
    print("─" * 60)
    merger.apply_manual_correction("2023002", {
        "处理结果": "正常归并(以v2版为准)",
        "处理方式": "人工确认后归并",
        "口径版本": "当前口径",
        "操作人": "业务运营",
        "说明": "经复核，确认以v2版答案为准，两版差异为补充说明内容"
    })
    
    merger.rerun_after_correction()
    merger.save_manual_corrections()
    merger.save_history()
    
    merger.print_summary()
    
    print("\n" + "=" * 60)
    print("✓ 演示流程完成！请查看'输出结果'文件夹")
    print("=" * 60)

if __name__ == "__main__":
    main()
