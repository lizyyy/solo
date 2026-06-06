#!/usr/bin/env python3
import csv
import json
import os
import sys
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict


@dataclass
class ManualOverride:
    timestamp: str
    operator: str
    field_name: str
    old_value: Any
    new_value: Any
    reason: str


@dataclass
class ClaimRecord:
    claim_id: str
    valuation: Optional[Dict] = None
    transaction: Optional[Dict] = None
    manager_remark: Optional[Dict] = None
    fraud_risk_score: int = 0
    fraud_risk_level: str = "未评估"
    conclusion: str = ""
    conclusion_reason: str = ""
    manual_overrides: List[ManualOverride] = field(default_factory=list)
    data_quality_issues: List[str] = field(default_factory=list)
    needs_reconfirmation: bool = False
    last_updated: str = ""

    def to_dict(self) -> Dict:
        d = asdict(self)
        d["manual_overrides"] = [asdict(o) for o in self.manual_overrides]
        return d


class ClaimReviewEngine:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.claims: Dict[str, ClaimRecord] = {}
        self.audit_log: List[Dict] = []
        self.risk_thresholds = {
            "high": 70,
            "medium": 40,
            "low": 0
        }

    def _log_audit(self, action: str, claim_id: str, details: str):
        self.audit_log.append({
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "claim_id": claim_id,
            "details": details
        })

    def load_valuation_records(self, filepath: Optional[str] = None) -> int:
        if filepath is None:
            filepath = os.path.join(self.data_dir, "valuation_records.csv")
        count = 0
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cid = row["claim_id"]
                if cid not in self.claims:
                    self.claims[cid] = ClaimRecord(claim_id=cid)
                self.claims[cid].valuation = row
                count += 1
        self._log_audit("LOAD", "*", f"加载估值记录 {count} 条")
        return count

    def load_counter_transactions(self, filepath: Optional[str] = None) -> int:
        if filepath is None:
            filepath = os.path.join(self.data_dir, "counter_transactions.csv")
        count = 0
        with open(filepath, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                cid = row["claim_id"]
                if cid not in self.claims:
                    self.claims[cid] = ClaimRecord(claim_id=cid)
                self.claims[cid].transaction = row
                count += 1
        self._log_audit("LOAD", "*", f"加载柜台流水 {count} 条")
        return count

    def load_manager_remarks(self, filepath: Optional[str] = None) -> int:
        if filepath is None:
            filepath = os.path.join(self.data_dir, "manager_remarks.json")
        with open(filepath, "r", encoding="utf-8") as f:
            remarks = json.load(f)
        for r in remarks:
            cid = r["claim_id"]
            if cid not in self.claims:
                self.claims[cid] = ClaimRecord(claim_id=cid)
            self.claims[cid].manager_remark = r
        self._log_audit("LOAD", "*", f"加载客户经理备注 {len(remarks)} 条")
        return len(remarks)

    def load_all(self):
        self.load_valuation_records()
        self.load_counter_transactions()
        self.load_manager_remarks()

    def check_data_quality(self):
        for cid, claim in self.claims.items():
            issues = []
            if claim.valuation is None:
                issues.append("缺少估值版本记录")
            if claim.transaction is None:
                issues.append("缺少柜台流水记录")
            else:
                for k, v in claim.transaction.items():
                    if v == "" or v is None:
                        issues.append(f"柜台流水缺字段: {k}")
            if claim.manager_remark is None:
                issues.append("缺少客户经理备注")
            if claim.valuation and claim.transaction:
                try:
                    est_loss = float(claim.valuation["estimated_loss"])
                    total_amt = float(claim.transaction["total_amount"])
                    if abs(est_loss - total_amt) > 0.01 * est_loss:
                        issues.append(f"估值与流水金额差异: 估{est_loss:.0f} vs 流{total_amt:.0f}")
                except (ValueError, KeyError):
                    pass
            claim.data_quality_issues = issues

    def assess_fraud_risk(self):
        for cid, claim in self.claims.items():
            score = 0
            reasons = []

            if claim.valuation:
                try:
                    damage_ratio = float(claim.valuation["damage_ratio"])
                    if damage_ratio >= 0.25:
                        score += 30
                        reasons.append(f"车损比例高({damage_ratio:.0%})")
                except (ValueError, KeyError):
                    pass
                note = claim.valuation.get("valuation_note", "")
                if "疑似" in note or "待核实" in note or "扩大损失" in note:
                    score += 25
                    reasons.append(f"估值备注存疑: {note}")
                version = claim.valuation.get("valuation_version", "V1")
                if version != "V1":
                    score += 15
                    reasons.append(f"估值版本非初版({version})")

            if claim.manager_remark:
                remark = claim.manager_remark.get("remark", "")
                if "重点核查" in remark or "偏高" in remark or "真实性" in remark:
                    score += 20
                    reasons.append(f"经理备注预警: {remark}")

            if claim.data_quality_issues:
                missing = [i for i in claim.data_quality_issues if "缺少" in i]
                if missing:
                    score += 15
                    reasons.append(f"数据缺失: {len(missing)}项")

            claim.fraud_risk_score = score
            if score >= self.risk_thresholds["high"]:
                claim.fraud_risk_level = "高风险"
            elif score >= self.risk_thresholds["medium"]:
                claim.fraud_risk_level = "中风险"
            else:
                claim.fraud_risk_level = "低风险"

            if claim.fraud_risk_level == "高风险":
                claim.conclusion = "建议复核"
                claim.conclusion_reason = "；".join(reasons) if reasons else "系统判定高风险"
            elif claim.fraud_risk_level == "中风险":
                claim.conclusion = "重点关注"
                claim.conclusion_reason = "；".join(reasons) if reasons else "系统判定中风险"
            else:
                claim.conclusion = "正常通过"
                claim.conclusion_reason = "未发现明显风险特征"

            if claim.manual_overrides:
                claim.needs_reconfirmation = True

    def apply_manual_override(self, claim_id: str, field_name: str,
                               new_value: Any, reason: str, operator: str = "清算专员"):
        if claim_id not in self.claims:
            raise ValueError(f"赔案 {claim_id} 不存在")

        claim = self.claims[claim_id]
        old_value = getattr(claim, field_name, None)

        if hasattr(claim, field_name):
            setattr(claim, field_name, new_value)
        elif field_name in ["conclusion", "conclusion_reason"]:
            setattr(claim, field_name, new_value)
        else:
            raise ValueError(f"字段 {field_name} 不可修改")

        override = ManualOverride(
            timestamp=datetime.now().isoformat(),
            operator=operator,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        claim.manual_overrides.append(override)
        claim.last_updated = datetime.now().isoformat()
        claim.needs_reconfirmation = False

        self._log_audit("OVERRIDE", claim_id,
                        f"修改{field_name}: {old_value} -> {new_value}, 理由: {reason}")

    def supplement_data(self, claim_id: str, data_type: str, data: Dict, operator: str = "清算专员"):
        if claim_id not in self.claims:
            raise ValueError(f"赔案 {claim_id} 不存在")

        claim = self.claims[claim_id]
        if data_type == "transaction":
            if claim.transaction is None:
                claim.transaction = data
                claim.transaction["claim_id"] = claim_id
            else:
                claim.transaction.update(data)
        elif data_type == "valuation":
            if claim.valuation is None:
                claim.valuation = data
                claim.valuation["claim_id"] = claim_id
            else:
                claim.valuation.update(data)
        elif data_type == "manager_remark":
            claim.manager_remark = data
            claim.manager_remark["claim_id"] = claim_id
        else:
            raise ValueError(f"不支持的数据类型: {data_type}")

        claim.last_updated = datetime.now().isoformat()
        claim.needs_reconfirmation = True

        self._log_audit("SUPPLEMENT", claim_id, f"补录{data_type}数据")

    def get_claim(self, claim_id: str) -> Optional[ClaimRecord]:
        return self.claims.get(claim_id)

    def get_all_claims(self) -> List[ClaimRecord]:
        return sorted(self.claims.values(), key=lambda c: c.claim_id)

    def get_high_risk_claims(self) -> List[ClaimRecord]:
        return [c for c in self.claims.values() if c.fraud_risk_level == "高风险"]

    def get_claims_needing_reconfirmation(self) -> List[ClaimRecord]:
        return [c for c in self.claims.values() if c.needs_reconfirmation]

    def export_results(self, filepath: str, fmt: str = "json"):
        results = [c.to_dict() for c in self.get_all_claims()]

        if fmt == "json":
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump({
                    "export_time": datetime.now().isoformat(),
                    "total_claims": len(results),
                    "claims": results,
                    "audit_log": self.audit_log
                }, f, ensure_ascii=False, indent=2)
        elif fmt == "csv":
            fieldnames = [
                "claim_id", "fraud_risk_score", "fraud_risk_level",
                "conclusion", "conclusion_reason", "data_quality_issues",
                "has_manual_override", "needs_reconfirmation"
            ]
            with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for r in results:
                    writer.writerow({
                        "claim_id": r["claim_id"],
                        "fraud_risk_score": r["fraud_risk_score"],
                        "fraud_risk_level": r["fraud_risk_level"],
                        "conclusion": r["conclusion"],
                        "conclusion_reason": r["conclusion_reason"],
                        "data_quality_issues": "；".join(r["data_quality_issues"]),
                        "has_manual_override": len(r["manual_overrides"]) > 0,
                        "needs_reconfirmation": r["needs_reconfirmation"]
                    })
        else:
            raise ValueError(f"不支持的导出格式: {fmt}")

        self._log_audit("EXPORT", "*", f"导出结果到 {filepath}")

    def save_session(self, filepath: str):
        session_data = {
            "save_time": datetime.now().isoformat(),
            "claims": {cid: c.to_dict() for cid, c in self.claims.items()},
            "audit_log": self.audit_log
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(session_data, f, ensure_ascii=False, indent=2)

    def load_session(self, filepath: str):
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.claims = {}
        for cid, cd in data["claims"].items():
            overrides = [ManualOverride(**o) for o in cd.pop("manual_overrides", [])]
            claim = ClaimRecord(**cd)
            claim.manual_overrides = overrides
            self.claims[cid] = claim
        self.audit_log = data.get("audit_log", [])


class ClaimReviewCLI:
    def __init__(self):
        self.engine = ClaimReviewEngine()
        self.running = False

    def _print_header(self):
        print("=" * 70)
        print("          保险理赔反欺诈复核系统 v1.0")
        print("=" * 70)

    def _print_menu(self):
        print("\n" + "-" * 70)
        print("主菜单:")
        print("  1. 加载数据        2. 数据质量检查    3. 风险评估")
        print("  4. 查看赔案列表    5. 查看赔案详情    6. 补录数据")
        print("  7. 人工改判        8. 重跑评估        9. 导出结果")
        print("  10. 保存会话       11. 加载会话       12. 查看审计日志")
        print("  0. 退出")
        print("-" * 70)

    def _input(self, prompt: str, default: Optional[str] = None) -> str:
        if default:
            val = input(f"{prompt} [{default}]: ").strip()
            return val if val else default
        return input(f"{prompt}: ").strip()

    def cmd_load_data(self):
        print("\n--- 加载数据 ---")
        try:
            v = self.engine.load_valuation_records()
            t = self.engine.load_counter_transactions()
            m = self.engine.load_manager_remarks()
            print(f"✓ 估值记录: {v} 条")
            print(f"✓ 柜台流水: {t} 条")
            print(f"✓ 经理备注: {m} 条")
            print(f"合计赔案: {len(self.engine.claims)} 件")
        except Exception as e:
            print(f"✗ 加载失败: {e}")

    def cmd_data_quality(self):
        print("\n--- 数据质量检查 ---")
        self.engine.check_data_quality()
        issues_count = 0
        for c in self.engine.get_all_claims():
            if c.data_quality_issues:
                issues_count += 1
                print(f"\n赔案 {c.claim_id}:")
                for issue in c.data_quality_issues:
                    print(f"  ! {issue}")
        if issues_count == 0:
            print("✓ 所有赔案数据完整")
        else:
            print(f"\n共 {issues_count} 件赔案存在数据质量问题")

    def cmd_risk_assessment(self):
        print("\n--- 风险评估 ---")
        self.engine.check_data_quality()
        self.engine.assess_fraud_risk()
        levels = {"高风险": 0, "中风险": 0, "低风险": 0, "未评估": 0}
        for c in self.engine.get_all_claims():
            levels[c.fraud_risk_level] = levels.get(c.fraud_risk_level, 0) + 1
        for level, count in levels.items():
            if count > 0:
                print(f"  {level}: {count} 件")

        needs_rec = self.engine.get_claims_needing_reconfirmation()
        if needs_rec:
            print(f"\n⚠ 有 {len(needs_rec)} 件赔案需要重新确认:")
            for c in needs_rec:
                print(f"   - {c.claim_id}")

    def cmd_list_claims(self):
        print("\n--- 赔案列表 ---")
        claims = self.engine.get_all_claims()
        if not claims:
            print("暂无赔案数据")
            return
        print(f"{'赔案号':<14} {'风险等级':<8} {'风险分':>5} {'结论':<8} {'数据问题':<10} {'需重确认'}")
        print("-" * 70)
        for c in claims:
            issues = len(c.data_quality_issues)
            rec = "是" if c.needs_reconfirmation else "否"
            print(f"{c.claim_id:<14} {c.fraud_risk_level:<8} {c.fraud_risk_score:>5} "
                  f"{c.conclusion:<8} {issues:>5}项     {rec}")

    def cmd_view_claim(self):
        cid = self._input("请输入赔案号")
        claim = self.engine.get_claim(cid)
        if not claim:
            print(f"✗ 赔案 {cid} 不存在")
            return
        print(f"\n========== 赔案详情: {cid} ==========")
        print(f"风险等级: {claim.fraud_risk_level} (得分: {claim.fraud_risk_score})")
        print(f"结论: {claim.conclusion}")
        print(f"结论理由: {claim.conclusion_reason}")

        print("\n--- 估值记录 ---")
        if claim.valuation:
            for k, v in claim.valuation.items():
                print(f"  {k}: {v}")
        else:
            print("  无数据")

        print("\n--- 柜台流水 ---")
        if claim.transaction:
            for k, v in claim.transaction.items():
                print(f"  {k}: {v}")
        else:
            print("  无数据")

        print("\n--- 客户经理备注 ---")
        if claim.manager_remark:
            for k, v in claim.manager_remark.items():
                print(f"  {k}: {v}")
        else:
            print("  无备注")

        if claim.data_quality_issues:
            print("\n--- 数据质量问题 ---")
            for i in claim.data_quality_issues:
                print(f"  ! {i}")

        if claim.manual_overrides:
            print("\n--- 人工修正记录 ---")
            for o in claim.manual_overrides:
                print(f"  [{o.timestamp}] {o.operator}")
                print(f"    修改 {o.field_name}: {o.old_value} -> {o.new_value}")
                print(f"    理由: {o.reason}")

        if claim.needs_reconfirmation:
            print("\n⚠ 该赔案需要重新确认结论")

    def cmd_supplement_data(self):
        cid = self._input("请输入赔案号")
        claim = self.engine.get_claim(cid)
        if not claim:
            print(f"✗ 赔案 {cid} 不存在")
            return

        print("\n可选补录类型:")
        print("  1. 柜台流水")
        print("  2. 估值记录")
        print("  3. 经理备注")
        choice = self._input("请选择类型", "1")

        data_type_map = {"1": "transaction", "2": "valuation", "3": "manager_remark"}
        data_type = data_type_map.get(choice)
        if not data_type:
            print("✗ 无效选择")
            return

        data = {}
        if data_type == "transaction":
            print("\n请输入柜台流水信息（留空跳过）:")
            data["transaction_id"] = self._input("流水号", f"TX{cid}SUPP")
            data["transaction_date"] = self._input("交易日期", datetime.now().strftime("%Y-%m-%d"))
            data["repair_shop"] = self._input("维修厂")
            data["parts_cost"] = self._input("配件费用", "0")
            data["labor_cost"] = self._input("工时费用", "0")
            data["total_amount"] = self._input("总金额", "0")
            data["operator"] = self._input("柜员", "补录")
        elif data_type == "valuation":
            print("\n请输入估值信息（留空跳过）:")
            data["valuation_version"] = self._input("估值版本", "V1")
            data["valuer"] = self._input("估值员", "补录")
            data["valuation_date"] = self._input("估值日期", datetime.now().strftime("%Y-%m-%d"))
            data["estimated_loss"] = self._input("估损金额", "0")
            data["vehicle_value"] = self._input("车辆价值", "0")
            data["damage_ratio"] = self._input("车损比例", "0")
            data["valuation_note"] = self._input("估值备注", "补录数据")
        else:
            print("\n请输入经理备注:")
            data["manager"] = self._input("经理姓名")
            data["remark_date"] = self._input("备注日期", datetime.now().strftime("%Y-%m-%d"))
            data["remark"] = self._input("备注内容")

        try:
            self.engine.supplement_data(cid, data_type, data)
            print(f"✓ 赔案 {cid} 的{data_type}数据已补录")
            print("⚠ 请重跑评估以更新结论")
        except Exception as e:
            print(f"✗ 补录失败: {e}")

    def cmd_manual_override(self):
        cid = self._input("请输入赔案号")
        claim = self.engine.get_claim(cid)
        if not claim:
            print(f"✗ 赔案 {cid} 不存在")
            return

        print(f"\n当前结论: {claim.conclusion}")
        print(f"当前理由: {claim.conclusion_reason}")

        print("\n可修改字段:")
        print("  1. 结论")
        print("  2. 结论理由")
        choice = self._input("请选择要修改的字段", "1")

        field_map = {"1": "conclusion", "2": "conclusion_reason"}
        field_name = field_map.get(choice)
        if not field_name:
            print("✗ 无效选择")
            return

        if field_name == "conclusion":
            print("\n可选结论:")
            print("  1. 正常通过")
            print("  2. 重点关注")
            print("  3. 建议复核")
            print("  4. 直接拒赔")
            c_choice = self._input("请选择结论", "1")
            c_map = {"1": "正常通过", "2": "重点关注", "3": "建议复核", "4": "直接拒赔"}
            new_value = c_map.get(c_choice, c_choice)
        else:
            new_value = self._input("请输入新的结论理由")

        reason = self._input("请输入改判理由")
        operator = self._input("操作人", "清算专员")

        try:
            self.engine.apply_manual_override(cid, field_name, new_value, reason, operator)
            print(f"✓ 赔案 {cid} 已人工改判")
            print(f"  修改记录已保存，重跑时不会被覆盖")
        except Exception as e:
            print(f"✗ 改判失败: {e}")

    def cmd_rerun_assessment(self):
        print("\n--- 重跑风险评估 ---")
        modified_claims = [c for c in self.engine.claims.values() if c.manual_overrides]

        self.engine.check_data_quality()
        self.engine.assess_fraud_risk()

        for c in modified_claims:
            c.needs_reconfirmation = False

        print("✓ 风险评估已重新执行")

        if modified_claims:
            print(f"\n⚠ 以下赔案含人工修正，修正记录已保留:")
            for c in modified_claims:
                print(f"   - {c.claim_id} ({len(c.manual_overrides)} 条修正)")

        changed = []
        for c in self.engine.get_all_claims():
            if c.data_quality_issues or c.manual_overrides:
                continue
        print("\n请使用菜单5查看各赔案最新结论")

    def cmd_export(self):
        print("\n--- 导出结果 ---")
        filename = self._input("文件名", "review_results")
        fmt = self._input("格式 (json/csv)", "json")
        filepath = f"{filename}.{fmt}"
        try:
            self.engine.export_results(filepath, fmt)
            print(f"✓ 结果已导出到 {filepath}")
        except Exception as e:
            print(f"✗ 导出失败: {e}")

    def cmd_save_session(self):
        filename = self._input("保存文件名", "claim_session")
        filepath = f"{filename}.json"
        try:
            self.engine.save_session(filepath)
            print(f"✓ 会话已保存到 {filepath}")
        except Exception as e:
            print(f"✗ 保存失败: {e}")

    def cmd_load_session(self):
        filename = self._input("会话文件名", "claim_session")
        filepath = f"{filename}.json"
        if not os.path.exists(filepath):
            print(f"✗ 文件 {filepath} 不存在")
            return
        try:
            self.engine.load_session(filepath)
            print(f"✓ 会话已加载，共 {len(self.engine.claims)} 件赔案")
        except Exception as e:
            print(f"✗ 加载失败: {e}")

    def cmd_audit_log(self):
        print("\n--- 审计日志 ---")
        if not self.engine.audit_log:
            print("暂无操作记录")
            return
        for entry in self.engine.audit_log[-20:]:
            print(f"[{entry['timestamp']}] {entry['action']:10} {entry['claim_id']:14} {entry['details']}")

    def run(self):
        self._print_header()
        self.running = True
        while self.running:
            self._print_menu()
            choice = self._input("请选择操作", "0")
            try:
                if choice == "1":
                    self.cmd_load_data()
                elif choice == "2":
                    self.cmd_data_quality()
                elif choice == "3":
                    self.cmd_risk_assessment()
                elif choice == "4":
                    self.cmd_list_claims()
                elif choice == "5":
                    self.cmd_view_claim()
                elif choice == "6":
                    self.cmd_supplement_data()
                elif choice == "7":
                    self.cmd_manual_override()
                elif choice == "8":
                    self.cmd_rerun_assessment()
                elif choice == "9":
                    self.cmd_export()
                elif choice == "10":
                    self.cmd_save_session()
                elif choice == "11":
                    self.cmd_load_session()
                elif choice == "12":
                    self.cmd_audit_log()
                elif choice == "0":
                    print("\n感谢使用，再见！")
                    self.running = False
                else:
                    print("✗ 无效选项，请重新输入")
            except KeyboardInterrupt:
                print("\n\n操作已取消")
            except Exception as e:
                print(f"✗ 操作出错: {e}")


def main():
    cli = ClaimReviewCLI()
    cli.run()


if __name__ == "__main__":
    main()
