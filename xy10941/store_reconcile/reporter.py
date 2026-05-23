import os
import pandas as pd
from datetime import datetime
import click
from tabulate import tabulate


class Reporter:
    def __init__(self, output_dir="./output", store_id="STORE001"):
        self.output_dir = output_dir
        self.store_id = store_id
        self.timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        os.makedirs(output_dir, exist_ok=True)

    def generate_all(self, result, cash_errors, payment_errors):
        self._print_terminal_summary(result)
        self._save_matched_csv(result["matched"])
        self._save_unmatched_csv(result["unmatched_cash"], result["unmatched_payment"])
        self._save_duplicates_csv(result["duplicates"])
        self._save_errors_csv(cash_errors, payment_errors)
        self._save_markdown_report(result, cash_errors, payment_errors)
        
        click.echo()
        click.echo(click.style(f"📁 输出文件已保存到: {self.output_dir}/", fg="green"))

    def _print_terminal_summary(self, result):
        s = result["summary"]
        
        click.echo()
        click.echo(click.style("━" * 60, fg="cyan"))
        click.echo(click.style(f"  对账汇总报告 - 门店 {s['store_id']}", fg="cyan", bold=True))
        click.echo(click.style("━" * 60, fg="cyan"))
        click.echo()
        
        click.echo(click.style("【记录统计】", fg="white", bold=True))
        record_data = [
            ["收银流水", s["raw_records"]["cashier"], s["after_dedup"]["cashier"], s["duplicates"]["cashier"]],
            ["支付流水", s["raw_records"]["payment"], s["after_dedup"]["payment"], s["duplicates"]["payment"]],
        ]
        click.echo(tabulate(record_data, headers=["类型", "原始数", "去重后", "重复数"], tablefmt="simple"))
        click.echo()
        
        click.echo(click.style("【匹配结果】", fg="white", bold=True))
        match_data = [
            ["成功匹配", s["matched"]["total"], f"¥{s['matched']['amount']:.2f}"],
            ["  - 普通交易", s["matched"]["payments"], f"¥{s['matched']['amount']:.2f}"],
            ["  - 退款交易", s["matched"]["refunds"], f"¥{s['matched']['refund_amount']:.2f}"],
        ]
        click.echo(tabulate(match_data, headers=["类型", "笔数", "金额"], tablefmt="simple"))
        click.echo()
        
        click.echo(click.style("【差异记录】", fg="yellow", bold=True))
        diff_data = [
            ["收银单边", s["unmatched"]["cashier"]["total"], f"¥{s['unmatched']['cashier']['amount'] + s['unmatched']['cashier']['refund_amount']:.2f}"],
            ["  - 普通交易", s["unmatched"]["cashier"]["payments"], f"¥{s['unmatched']['cashier']['amount']:.2f}"],
            ["  - 退款交易", s["unmatched"]["cashier"]["refunds"], f"¥{s['unmatched']['cashier']['refund_amount']:.2f}"],
            ["支付单边", s["unmatched"]["payment"]["total"], f"¥{s['unmatched']['payment']['amount'] + s['unmatched']['payment']['refund_amount']:.2f}"],
            ["  - 普通交易", s["unmatched"]["payment"]["payments"], f"¥{s['unmatched']['payment']['amount']:.2f}"],
            ["  - 退款交易", s["unmatched"]["payment"]["refunds"], f"¥{s['unmatched']['payment']['refund_amount']:.2f}"],
        ]
        click.echo(tabulate(diff_data, headers=["类型", "笔数", "金额"], tablefmt="simple"))
        click.echo()
        
        click.echo(click.style("【金额汇总】", fg="white", bold=True))
        amt = s["amount_summary"]
        amt_data = [
            ["收银总交易", f"¥{amt['cashier_total']:.2f}"],
            ["收银总退款", f"¥{amt['cashier_refund_total']:.2f}"],
            ["收银净额", f"¥{amt['cashier_net']:.2f}"],
            ["支付总交易", f"¥{amt['payment_total']:.2f}"],
            ["支付总退款", f"¥{amt['payment_refund_total']:.2f}"],
            ["支付净额", f"¥{amt['payment_net']:.2f}"],
            [click.style("差异金额", fg="red"), click.style(f"¥{amt['difference']:.2f}", fg="red", bold=True)],
        ]
        click.echo(tabulate(amt_data, tablefmt="simple"))
        click.echo()
        
        if s["reason_stats"]["cashier"] or s["reason_stats"]["payment"]:
            click.echo(click.style("【差异原因统计】", fg="yellow", bold=True))
            reason_data = []
            for reason, count in s["reason_stats"]["cashier"].items():
                reason_data.append([f"收银 - {reason}", count])
            for reason, count in s["reason_stats"]["payment"].items():
                reason_data.append([f"支付 - {reason}", count])
            click.echo(tabulate(reason_data, headers=["原因", "笔数"], tablefmt="simple"))
            click.echo()

    def _save_matched_csv(self, matched):
        if not matched:
            return
        
        df = pd.DataFrame(matched)
        df["cash_time"] = df["cash_time"].dt.strftime("%Y-%m-%d %H:%M:%S")
        df["payment_time"] = df["payment_time"].dt.strftime("%Y-%m-%d %H:%M:%S")
        df["type"] = df["is_refund"].apply(lambda x: "退款" if x else "普通交易")
        
        cols = [
            "type", "amount", "cash_trade_no", "payment_trade_no",
            "cash_time", "payment_time", "time_diff_seconds",
            "platform", "cash_source", "payment_source"
        ]
        df = df[cols]
        df.columns = [
            "交易类型", "金额", "收银订单号", "支付订单号",
            "收银时间", "支付时间", "时间差(秒)",
            "支付平台", "收银来源", "支付来源"
        ]
        
        filepath = os.path.join(self.output_dir, f"{self.store_id}_matched_{self.timestamp}.csv")
        df.to_csv(filepath, index=False, encoding="utf-8-sig")
        click.echo(f"  ✅ 匹配记录: {os.path.basename(filepath)}")

    def _save_unmatched_csv(self, unmatched_cash, unmatched_payment):
        if unmatched_cash:
            df_cash = pd.DataFrame(unmatched_cash)
            df_cash["time"] = df_cash["time"].dt.strftime("%Y-%m-%d %H:%M:%S")
            df_cash["type"] = df_cash["is_refund"].apply(lambda x: "退款" if x else "普通交易")
            df_cash["source_type"] = "收银"
            
            cols = ["source_type", "type", "trade_no", "amount", "time", "store_id", "source", "reason"]
            df_cash = df_cash[cols]
            
        if unmatched_payment:
            df_pay = pd.DataFrame(unmatched_payment)
            df_pay["time"] = df_pay["time"].dt.strftime("%Y-%m-%d %H:%M:%S")
            df_pay["type"] = df_pay["is_refund"].apply(lambda x: "退款" if x else "普通交易")
            df_pay["source_type"] = "支付"
            df_pay["store_id"] = ""
            
            cols = ["source_type", "type", "trade_no", "amount", "time", "store_id", "source", "reason"]
            df_pay = df_pay[cols]
        
        all_unmatched = []
        if unmatched_cash:
            all_unmatched.append(df_cash)
        if unmatched_payment:
            all_unmatched.append(df_pay)
        
        if all_unmatched:
            df = pd.concat(all_unmatched, ignore_index=True)
            df.columns = [
                "来源系统", "交易类型", "订单号", "金额", "交易时间",
                "门店编号", "原始位置", "差异原因"
            ]
            
            filepath = os.path.join(self.output_dir, f"{self.store_id}_unmatched_{self.timestamp}.csv")
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            click.echo(f"  ✅ 差异记录: {os.path.basename(filepath)}")

    def _save_duplicates_csv(self, duplicates):
        if not duplicates:
            return
        
        df = pd.DataFrame(duplicates)
        df["time"] = df["time"].dt.strftime("%Y-%m-%d %H:%M:%S")
        df["source_name"] = df["source"].apply(lambda x: "收银" if x == "cashier" else "支付")
        df["all_rows"] = df["rows"].apply(lambda x: "; ".join(x))
        
        cols = ["source_name", "trade_no", "amount", "time", "count", "all_rows"]
        df = df[cols]
        df.columns = ["来源系统", "订单号", "金额", "交易时间", "重复次数", "所有位置"]
        
        filepath = os.path.join(self.output_dir, f"{self.store_id}_duplicates_{self.timestamp}.csv")
        df.to_csv(filepath, index=False, encoding="utf-8-sig")
        click.echo(f"  ✅ 重复记录: {os.path.basename(filepath)}")

    def _save_errors_csv(self, cash_errors, payment_errors):
        all_errors = []
        
        for e in cash_errors:
            all_errors.append({
                "来源系统": "收银",
                "文件名": e["file"],
                "行号": e["row"] if e["row"] else "N/A",
                "错误信息": e["error"],
                "原始内容": e["raw_content"] if e["raw_content"] else ""
            })
        
        for e in payment_errors:
            all_errors.append({
                "来源系统": "支付",
                "文件名": e["file"],
                "行号": e["row"] if e["row"] else "N/A",
                "错误信息": e["error"],
                "原始内容": e["raw_content"] if e["raw_content"] else ""
            })
        
        if all_errors:
            df = pd.DataFrame(all_errors)
            filepath = os.path.join(self.output_dir, f"{self.store_id}_errors_{self.timestamp}.csv")
            df.to_csv(filepath, index=False, encoding="utf-8-sig")
            click.echo(f"  ✅ 错误记录: {os.path.basename(filepath)}")

    def _save_markdown_report(self, result, cash_errors, payment_errors):
        s = result["summary"]
        amt = s["amount_summary"]
        
        md_lines = []
        md_lines.append(f"# 门店收银差异对账报告")
        md_lines.append("")
        md_lines.append(f"**门店编号**: {s['store_id']}")
        md_lines.append(f"**对账时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append("")
        
        md_lines.append("## 1. 记录统计")
        md_lines.append("")
        md_lines.append("| 类型 | 原始数量 | 去重后数量 | 重复数量 |")
        md_lines.append("|------|---------|-----------|---------|")
        md_lines.append(f"| 收银流水 | {s['raw_records']['cashier']} | {s['after_dedup']['cashier']} | {s['duplicates']['cashier']} |")
        md_lines.append(f"| 支付流水 | {s['raw_records']['payment']} | {s['after_dedup']['payment']} | {s['duplicates']['payment']} |")
        md_lines.append("")
        
        md_lines.append("## 2. 匹配结果")
        md_lines.append("")
        md_lines.append("| 类型 | 笔数 | 金额 |")
        md_lines.append("|------|-----|-----|")
        md_lines.append(f"| 成功匹配 | {s['matched']['total']} | ¥{s['matched']['amount'] + s['matched']['refund_amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;普通交易 | {s['matched']['payments']} | ¥{s['matched']['amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;退款交易 | {s['matched']['refunds']} | ¥{s['matched']['refund_amount']:.2f} |")
        md_lines.append("")
        
        md_lines.append("## 3. 差异记录")
        md_lines.append("")
        md_lines.append("| 类型 | 笔数 | 金额 |")
        md_lines.append("|------|-----|-----|")
        md_lines.append(f"| 收银单边 | {s['unmatched']['cashier']['total']} | ¥{s['unmatched']['cashier']['amount'] + s['unmatched']['cashier']['refund_amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;普通交易 | {s['unmatched']['cashier']['payments']} | ¥{s['unmatched']['cashier']['amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;退款交易 | {s['unmatched']['cashier']['refunds']} | ¥{s['unmatched']['cashier']['refund_amount']:.2f} |")
        md_lines.append(f"| 支付单边 | {s['unmatched']['payment']['total']} | ¥{s['unmatched']['payment']['amount'] + s['unmatched']['payment']['refund_amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;普通交易 | {s['unmatched']['payment']['payments']} | ¥{s['unmatched']['payment']['amount']:.2f} |")
        md_lines.append(f"| &nbsp;&nbsp;退款交易 | {s['unmatched']['payment']['refunds']} | ¥{s['unmatched']['payment']['refund_amount']:.2f} |")
        md_lines.append("")
        
        md_lines.append("## 4. 金额汇总")
        md_lines.append("")
        md_lines.append("| 项目 | 金额 |")
        md_lines.append("|------|-----|")
        md_lines.append(f"| 收银总交易 | ¥{amt['cashier_total']:.2f} |")
        md_lines.append(f"| 收银总退款 | ¥{amt['cashier_refund_total']:.2f} |")
        md_lines.append(f"| **收银净额** | **¥{amt['cashier_net']:.2f}** |")
        md_lines.append(f"| 支付总交易 | ¥{amt['payment_total']:.2f} |")
        md_lines.append(f"| 支付总退款 | ¥{amt['payment_refund_total']:.2f} |")
        md_lines.append(f"| **支付净额** | **¥{amt['payment_net']:.2f}** |")
        diff_str = f"¥{amt['difference']:.2f}"
        if abs(amt['difference']) > 0.01:
            diff_str = f"**{diff_str}**"
        md_lines.append(f"| **差异金额** | {diff_str} |")
        md_lines.append("")
        
        if s["reason_stats"]["cashier"] or s["reason_stats"]["payment"]:
            md_lines.append("## 5. 差异原因统计")
            md_lines.append("")
            md_lines.append("| 原因 | 笔数 |")
            md_lines.append("|------|-----|")
            for reason, count in s["reason_stats"]["cashier"].items():
                md_lines.append(f"| 收银 - {reason} | {count} |")
            for reason, count in s["reason_stats"]["payment"].items():
                md_lines.append(f"| 支付 - {reason} | {count} |")
            md_lines.append("")
        
        if cash_errors or payment_errors:
            md_lines.append("## 6. 数据异常记录")
            md_lines.append("")
            md_lines.append(f"**收银坏记录数**: {len(cash_errors)}")
            md_lines.append(f"**支付坏记录数**: {len(payment_errors)}")
            md_lines.append("")
            md_lines.append("详细记录请查看 `*_errors_*.csv` 文件。")
            md_lines.append("")
        
        md_lines.append("## 7. 输出文件说明")
        md_lines.append("")
        md_lines.append("| 文件名 | 说明 |")
        md_lines.append("|--------|-----|")
        md_lines.append("| `*_matched_*.csv` | 成功匹配的记录 |")
        md_lines.append("| `*_unmatched_*.csv` | 未能匹配的差异记录 |")
        md_lines.append("| `*_duplicates_*.csv` | 重复记录 |")
        md_lines.append("| `*_errors_*.csv` | 数据格式错误或坏记录 |")
        md_lines.append("")
        
        md_lines.append("---")
        md_lines.append("*本报告由门店收银差异对账工具自动生成*")
        
        filepath = os.path.join(self.output_dir, f"{self.store_id}_report_{self.timestamp}.md")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(md_lines))
        
        click.echo(f"  ✅ 对账报告: {os.path.basename(filepath)}")
