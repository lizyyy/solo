from datetime import datetime
from pathlib import Path
import json
import yaml
import csv


def generate_examples(output_dir: Path) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    count = 0

    rules = {
        "rules": [
            {
                "rule_id": "RULE_SMALL",
                "name": "小批量抽检规则",
                "description": "适用于批量 1-500 的产品，抽样 5 件，合格率需 >= 95%",
                "min_batch_size": 1,
                "max_batch_size": 500,
                "sample_size": 5,
                "pass_threshold": 0.95,
            },
            {
                "rule_id": "RULE_MEDIUM",
                "name": "中批量抽检规则",
                "description": "适用于批量 501-2000 的产品，抽样 13 件，合格率需 >= 95%",
                "min_batch_size": 501,
                "max_batch_size": 2000,
                "sample_size": 13,
                "pass_threshold": 0.95,
            },
            {
                "rule_id": "RULE_LARGE",
                "name": "大批量抽检规则",
                "description": "适用于批量 2001-10000 的产品，抽样 20 件，合格率需 >= 98%",
                "min_batch_size": 2001,
                "max_batch_size": 10000,
                "sample_size": 20,
                "pass_threshold": 0.98,
            },
        ]
    }

    rules_yaml_path = output_dir / "rules.yaml"
    with open(rules_yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(rules, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    count += 1

    rules_json_path = output_dir / "rules.json"
    with open(rules_json_path, "w", encoding="utf-8") as f:
        json.dump(rules, f, indent=2, ensure_ascii=False)
    count += 1

    batches = {
        "batches": [
            {
                "batch_id": "B20260501-001",
                "product": "精密轴承-A型",
                "total_quantity": 1500,
                "sample_quantity": 13,
                "production_date": "2026-05-01",
                "line": "A线-03",
                "samples": [
                    {"sample_id": "S001", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 09:15:00"},
                    {"sample_id": "S002", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 09:18:00"},
                    {"sample_id": "S003", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 09:20:00"},
                    {"sample_id": "S004", "是否不合格": "不合格", "检验员": "张三", "检验时间": "2026-05-01 09:22:00", "备注": "尺寸超差"},
                    {"sample_id": "S005", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 09:25:00"},
                    {"sample_id": "S006", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 09:30:00"},
                    {"sample_id": "S007", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 09:32:00"},
                    {"sample_id": "S008", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 09:35:00"},
                    {"sample_id": "S009", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 09:38:00"},
                    {"sample_id": "S010", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 09:40:00"},
                    {"sample_id": "S011", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 10:00:00"},
                    {"sample_id": "S012", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 10:02:00"},
                    {"sample_id": "S013", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 10:05:00"},
                ],
                "rechecks": [
                    {
                        "sample_id": "S004",
                        "原始结果": "不合格",
                        "复检结果": "合格",
                        "复检时间": "2026-05-01 14:00:00",
                        "复检员": "质检主任",
                        "复检原因": "首次检测设备校准问题"
                    }
                ],
            },
            {
                "batch_id": "B20260501-002",
                "product": "精密轴承-A型",
                "total_quantity": 1200,
                "sample_quantity": 13,
                "production_date": "2026-05-01",
                "line": "A线-03",
                "samples": [
                    {"sample_id": "S101", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 14:15:00"},
                    {"sample_id": "S102", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 14:18:00"},
                    {"sample_id": "S103", "是否不合格": "不合格", "检验员": "张三", "检验时间": "2026-05-01 14:20:00", "备注": "表面划痕"},
                    {"sample_id": "S104", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 14:22:00"},
                    {"sample_id": "S105", "是否不合格": "不合格", "检验员": "张三", "检验时间": "2026-05-01 14:25:00", "备注": "硬度不够"},
                    {"sample_id": "S106", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 14:30:00"},
                    {"sample_id": "S107", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 14:32:00"},
                    {"sample_id": "S108", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 14:35:00"},
                    {"sample_id": "S109", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 14:38:00"},
                    {"sample_id": "S110", "是否不合格": "合格", "检验员": "李四", "检验时间": "2026-05-01 14:40:00"},
                    {"sample_id": "S111", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 15:00:00"},
                    {"sample_id": "S112", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 15:02:00"},
                    {"sample_id": "S113", "是否不合格": "合格", "检验员": "王五", "检验时间": "2026-05-01 15:05:00"},
                ],
                "rechecks": [],
            },
            {
                "batch_id": "B20260502-001",
                "product": "精密轴承-B型",
                "total_quantity": 300,
                "sample_quantity": 5,
                "production_date": "2026-05-02",
                "line": "B线-01",
                "samples": [
                    {"sample_id": "S201", "是否不合格": "合格", "检验员": "赵六", "检验时间": "2026-05-02 09:00:00"},
                    {"sample_id": "S202", "是否不合格": "合格", "检验员": "赵六", "检验时间": "2026-05-02 09:05:00"},
                    {"sample_id": "S203", "是否不合格": "合格", "检验员": "赵六", "检验时间": "2026-05-02 09:10:00"},
                    {"sample_id": "S204", "是否不合格": "合格", "检验员": "赵六", "检验时间": "2026-05-02 09:15:00"},
                    {"sample_id": "S205", "是否不合格": "合格", "检验员": "赵六", "检验时间": "2026-05-02 09:20:00"},
                ],
                "rechecks": [],
            },
        ]
    }

    batches_json_path = output_dir / "batches.json"
    with open(batches_json_path, "w", encoding="utf-8") as f:
        json.dump(batches, f, indent=2, ensure_ascii=False)
    count += 1

    declared = {
        "B20260501-001": {
            "batch_id": "B20260501-001",
            "pass_rate": 1.0,
            "conclusion": "PASS",
        },
        "B20260501-002": {
            "batch_id": "B20260501-002",
            "pass_rate": 0.95,
            "conclusion": "PASS",
        },
        "B20260502-001": {
            "batch_id": "B20260502-001",
            "pass_rate": 1.0,
            "conclusion": "PASS",
        },
    }

    declared_json_path = output_dir / "declared.json"
    with open(declared_json_path, "w", encoding="utf-8") as f:
        json.dump(declared, f, indent=2, ensure_ascii=False)
    count += 1

    merge_spec = {
        "merges": [
            {
                "from": ["B20260501-001", "B20260501-002"],
                "to": "B20260501-MERGED",
                "reason": "同批次同日生产，合并统计",
            }
        ]
    }

    merge_yaml_path = output_dir / "merge_spec.yaml"
    with open(merge_yaml_path, "w", encoding="utf-8") as f:
        yaml.dump(merge_spec, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    count += 1

    csv_output_dir = output_dir / "csv_format"
    csv_output_dir.mkdir(exist_ok=True)

    with open(csv_output_dir / "batches.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["批次号", "产品", "批量", "抽样数量", "生产日期", "生产线"])
        writer.writerow(["B20260501-001", "精密轴承-A型", 1500, 13, "2026-05-01", "A线-03"])
        writer.writerow(["B20260501-002", "精密轴承-A型", 1200, 13, "2026-05-01", "A线-03"])
        writer.writerow(["B20260502-001", "精密轴承-B型", 300, 5, "2026-05-02", "B线-01"])
    count += 1

    with open(csv_output_dir / "samples.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["批次号", "样本编号", "是否不合格", "检验员", "检验时间", "备注"])
        for batch in batches["batches"]:
            for sample in batch["samples"]:
                writer.writerow([
                    batch["batch_id"],
                    sample["sample_id"],
                    sample["是否不合格"],
                    sample["检验员"],
                    sample["检验时间"],
                    sample.get("备注", ""),
                ])
    count += 1

    with open(csv_output_dir / "rechecks.csv", "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["批次号", "样本编号", "原始结果", "复检结果", "复检时间", "复检员", "复检原因"])
        for batch in batches["batches"]:
            for recheck in batch.get("rechecks", []):
                writer.writerow([
                    batch["batch_id"],
                    recheck["sample_id"],
                    recheck["原始结果"],
                    recheck["复检结果"],
                    recheck["复检时间"],
                    recheck["复检员"],
                    recheck["复检原因"],
                ])
    count += 1

    dirty_data_json_path = output_dir / "dirty_data_example.json"
    dirty_data = {
        "batches": [
            {
                "batch_id": "DIRTY-001",
                "product": "测试批次-含脏数据",
                "total_quantity": "abc",
                "sample_quantity": 5,
                "production_date": "无效日期",
                "line": "C线",
                "samples": [
                    {"sample_id": "D001", "是否不合格": "合格", "检验员": "", "检验时间": "2026-05-01 09:00:00"},
                    {"sample_id": "D002", "是否不合格": "UNKNOWN", "检验员": "张三", "检验时间": "2026-05-01 09:05:00"},
                    {"sample_id": "D003", "是否不合格": "合格", "检验员": "张三", "检验时间": "2026-05-01 09:10:00"},
                ],
                "rechecks": [
                    {
                        "sample_id": "NON_EXISTENT",
                        "原始结果": "不合格",
                        "复检结果": "合格",
                        "复检时间": "2026-05-01 10:00:00",
                    }
                ],
            }
        ]
    }
    with open(dirty_data_json_path, "w", encoding="utf-8") as f:
        json.dump(dirty_data, f, indent=2, ensure_ascii=False)
    count += 1

    readme_path = output_dir / "README.txt"
    readme_content = """
质检抽样复核 CLI - 示例文件说明
================================

文件列表:
---------
1. rules.yaml / rules.json - 抽样规则配置
   - 定义了三种批量范围的抽检规则
   - 包含抽样数量和合格阈值

2. batches.json - 批次数据（包含样本和复检）
   - 3个示例批次
   - B20260501-001: 有1个不合格样本，已复检通过
   - B20260501-002: 有2个不合格样本，未复检
   - B20260502-001: 全部合格

3. declared.json - 申报数据
   - 用于对比计算值与申报值的差异

4. merge_spec.yaml - 批次合并配置
   - 演示如何合并 B20260501-001 和 B20260501-002

5. csv_format/ - CSV格式示例数据
   - batches.csv - 批次信息
   - samples.csv - 样本信息
   - rechecks.csv - 复检记录

6. dirty_data_example.json - 脏数据示例
   - 包含各种格式问题的数据
   - 用于测试数据清理功能

快速使用命令:
-------------
# 生成示例文件
qc-audit init-examples

# 执行审计复核（对比申报数据）
qc-audit audit examples/rules.yaml examples/batches.json -d examples/declared.json

# 合并批次后审计
qc-audit merge examples/rules.yaml examples/batches.json examples/merge_spec.yaml

# 查看历史运行
qc-audit list-runs

# 重新计算历史审计
qc-audit recalc <run_id>

# 生成抽样计划
qc-audit plan 1500 examples/rules.yaml

"""
    with open(readme_path, "w", encoding="utf-8") as f:
        f.write(readme_content.strip())
    count += 1

    return count
