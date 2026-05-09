from typing import Any, Dict, List

from config import config
from utils import colorize, format_table


class FailureSamples:
    def __init__(self):
        self.samples = {
            "missing_critical_table": {
                "id": "missing_critical_table",
                "name": "关键表缺失",
                "description": "备份显示成功，但实际缺少关键业务表",
                "scenario": "每日备份脚本由于配置错误，只备份了部分表。备份日志显示成功，但 transactions 表未被备份。",
                "impact": "恢复后无法查询交易记录，影响财务对账和业务分析",
                "root_cause": [
                    "备份脚本的表列表配置不完整",
                    "备份成功判断只检查了备份文件是否生成，未检查表完整性",
                    "没有在备份后执行表清单校验",
                ],
                "detection_method": "演练时检查表清单与配置的关键表对比",
                "recovery_tables": ["users", "orders", "products", "audit_logs"],
                "missing_tables": ["transactions"],
            },
            "insufficient_permissions": {
                "id": "insufficient_permissions",
                "name": "恢复权限不足",
                "description": "备份用户有读取权限，但恢复用户缺少必要的写入权限",
                "scenario": "备份使用具有只读权限的用户执行，备份成功。但恢复时使用的用户缺少 CREATE TABLE 和 INSERT 权限，导致恢复失败。",
                "impact": "无法完成数据恢复，业务中断时间延长",
                "root_cause": [
                    "备份和恢复使用不同的数据库用户",
                    "恢复用户的权限未定期验证",
                    "环境变更后未重新测试恢复流程",
                ],
                "detection_method": "演练前执行权限检查，恢复过程中捕获权限异常",
                "missing_permissions": ["CREATE", "INSERT", "CREATE INDEX"],
            },
            "data_corruption": {
                "id": "data_corruption",
                "name": "数据损坏",
                "description": "备份文件生成但部分数据已损坏，恢复时才发现",
                "scenario": "备份过程中磁盘IO异常，导致部分数据块写入错误。备份文件可以正常解压，但恢复到数据库时报数据校验错误。",
                "impact": "部分表数据不可用，需要追溯到更早的备份点",
                "root_cause": [
                    "备份过程中硬件故障",
                    "备份校验只检查文件完整性，未做数据级校验",
                    "备份存储介质存在坏道",
                ],
                "detection_method": "恢复后执行数据校验查询，比对行数和关键指标",
                "corrupted_tables": ["users", "orders"],
            },
            "schema_mismatch": {
                "id": "schema_mismatch",
                "name": "结构不匹配",
                "description": "备份时的表结构与恢复时的目标库结构不兼容",
                "scenario": "备份后生产库进行了表结构变更（添加了新列）。恢复到旧版本备份时，外键约束和列定义不匹配导致恢复失败。",
                "impact": "需要先降级表结构才能恢复，增加恢复复杂度",
                "root_cause": [
                    "备份未包含完整的DDL语句",
                    "表结构变更流程未考虑备份恢复兼容性",
                    "未保存结构变更历史",
                ],
                "detection_method": "检查备份元数据中的schema版本与目标库对比",
            },
            "incomplete_restore": {
                "id": "incomplete_restore",
                "name": "恢复不完整",
                "description": "恢复脚本中途退出，部分表已恢复部分未恢复",
                "scenario": "恢复脚本执行时遇到网络超时或资源限制，脚本异常退出。此时已恢复了部分表，但没有事务回滚机制，导致状态不一致。",
                "impact": "数据状态不一致，需要清理后重新恢复",
                "root_cause": [
                    "恢复过程没有使用事务保护",
                    "脚本缺少错误处理和回滚机制",
                    "超时配置不合理",
                ],
                "detection_method": "恢复后检查表数量和完整性，确认全部恢复成功",
                "partially_restored": ["users", "products"],
                "not_restored": ["orders", "transactions", "audit_logs"],
            },
        }

    def get_sample(self, sample_id: str) -> Dict[str, Any]:
        return self.samples.get(sample_id, {})

    def list_samples(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": s["id"],
                "name": s["name"],
                "description": s["description"],
            }
            for s in self.samples.values()
        ]

    def display_samples(self) -> None:
        print(colorize("\n可用的失败样本场景", "blue"))
        print(colorize("=" * 60, "blue"))

        table_data = []
        for sample in self.samples.values():
            table_data.append({
                "ID": sample["id"],
                "名称": sample["name"],
                "描述": sample["description"],
            })
        print(format_table(table_data))

    def display_sample_detail(self, sample_id: str) -> None:
        sample = self.get_sample(sample_id)
        if not sample:
            print(colorize(f"未找到样本: {sample_id}", "red"))
            return

        print(colorize(f"\n失败样本详情: {sample['name']}", "blue"))
        print(colorize("=" * 60, "blue"))

        print(colorize("\n场景描述:", "green"))
        print(f"  {sample['scenario']}")

        print(colorize("\n影响:", "yellow"))
        print(f"  {sample['impact']}")

        print(colorize("\n根本原因:", "red"))
        for i, cause in enumerate(sample["root_cause"], 1):
            print(f"  {i}. {cause}")

        print(colorize("\n检测方法:", "green"))
        print(f"  {sample['detection_method']}")

        if "missing_tables" in sample:
            print(colorize("\n缺失的表:", "red"))
            for t in sample["missing_tables"]:
                print(f"  ✗ {t}")

        if "missing_permissions" in sample:
            print(colorize("\n缺失的权限:", "red"))
            for p in sample["missing_permissions"]:
                print(f"  ✗ {p}")

        if "corrupted_tables" in sample:
            print(colorize("\n损坏的表:", "red"))
            for t in sample["corrupted_tables"]:
                print(f"  ✗ {t}")

    def get_inject_params(self, sample_id: str) -> Dict[str, Any]:
        sample = self.get_sample(sample_id)
        if not sample:
            return {}

        params = {}

        if sample_id == "missing_critical_table":
            params["inject_failure"] = "missing_table"
            params["backup_tables"] = sample["recovery_tables"]
        elif sample_id == "insufficient_permissions":
            params["inject_permissions_missing"] = sample["missing_permissions"]
        elif sample_id == "data_corruption":
            params["inject_failure"] = "corrupted_data"

        return params


failure_samples = FailureSamples()
