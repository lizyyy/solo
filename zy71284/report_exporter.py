import csv
import json
import os
from datetime import datetime, date
from typing import List, Dict, Any
from dataclasses import asdict

from models import (
    Application, ApplicationStatus, SimulationResult,
    FundPool, CustomerLevel, RejectReason
)


class ExplanationGenerator:
    @staticmethod
    def generate_customer_friendly_explanation(app: Application) -> Dict[str, Any]:
        status_map = {
            ApplicationStatus.CONFIRMED: "确认成功",
            ApplicationStatus.PARTIAL_CONFIRMED: "部分确认",
            ApplicationStatus.REJECTED: "申请被拒",
            ApplicationStatus.QUEUED: "排队中",
            ApplicationStatus.PENDING: "待处理"
        }

        level_map = {
            CustomerLevel.NORMAL: "普通客户",
            CustomerLevel.VIP: "VIP客户",
            CustomerLevel.SVIP: "SVIP客户",
            CustomerLevel.INSTITUTION: "机构客户"
        }

        reject_reason_map = {
            RejectReason.INSUFFICIENT_FUND: "当日赎回额度已用尽",
            RejectReason.EXCEED_DAILY_LIMIT: "超出单日限额",
            RejectReason.HOLIDAY: "非交易日申请",
            RejectReason.CUSTOMER_LEVEL_MISMATCH: "客户等级不匹配",
            RejectReason.SYSTEM_ERROR: "系统处理异常",
            RejectReason.MASS_REDEMPTION: "巨额赎回按比例确认"
        }

        explanation = {
            "app_id": app.app_id,
            "customer_name": app.customer_name,
            "customer_level": level_map.get(app.customer_level, "未知"),
            "status": status_map.get(app.status, "未知状态"),
            "app_type": "赎回" if app.app_type.value == "REDEEM" else "申购",
            "app_amount": app.amount,
            "confirmed_amount": app.confirmed_amount,
            "confirm_ratio": f"{app.confirm_ratio * 100:.2f}%",
            "queue_position": app.queue_position,
            "summary": ExplanationGenerator._generate_summary(app, reject_reason_map),
            "detailed_explanations": app.explanation,
            "next_steps": ExplanationGenerator._generate_next_steps(app),
            "cs_call_script": ExplanationGenerator._generate_cs_script(app, level_map)
        }

        return explanation

    @staticmethod
    def _generate_summary(app: Application, reject_reason_map: Dict) -> str:
        if app.status == ApplicationStatus.CONFIRMED:
            return f"您的赎回申请{app.app_id}已全额确认，确认金额{app.confirmed_amount:.2f}元。"
        elif app.status == ApplicationStatus.PARTIAL_CONFIRMED:
            return (f"因触发巨额赎回机制，您的赎回申请{app.app_id}按比例确认。"
                    f"申请金额{app.amount:.2f}元，确认金额{app.confirmed_amount:.2f}元，"
                    f"确认比例{app.confirm_ratio*100:.2f}%。")
        elif app.status == ApplicationStatus.REJECTED:
            reason = reject_reason_map.get(app.reject_reason, "未知原因")
            return f"您的赎回申请{app.app_id}未能确认，原因：{reason}。"
        elif app.status == ApplicationStatus.QUEUED:
            return f"您的赎回申请{app.app_id}正在排队中，当前排队位置{app.queue_position}。"
        else:
            return f"您的赎回申请{app.app_id}正在处理中。"

    @staticmethod
    def _generate_next_steps(app: Application) -> List[str]:
        steps = []
        if app.status == ApplicationStatus.PARTIAL_CONFIRMED:
            unconfirmed = app.amount - app.confirmed_amount
            steps.append(f"未确认金额{unconfirmed:.2f}元将顺延至下一交易日处理，或您可选择撤销申请。")
            steps.append("如急需资金，可考虑其他基金或理财产品的赎回。")
        elif app.status == ApplicationStatus.REJECTED:
            steps.append("建议在下一交易日早些时候重新提交赎回申请。")
            steps.append("如有紧急资金需求，请联系您的专属客户经理。")
        elif app.status == ApplicationStatus.QUEUED:
            steps.append("请耐心等待，系统将按规则自动处理。")
        steps.append("如有疑问，请拨打客服热线：400-XXX-XXXX")
        return steps

    @staticmethod
    def _generate_cs_script(app: Application, level_map: Dict) -> str:
        greeting = f"您好，{app.customer_name}！"
        if app.customer_level in [CustomerLevel.VIP, CustomerLevel.SVIP, CustomerLevel.INSTITUTION]:
            greeting = f"尊敬的{level_map[app.customer_level]}{app.customer_name}，您好！"

        if app.status == ApplicationStatus.PARTIAL_CONFIRMED:
            return (f"{greeting}关于您的赎回申请（单号：{app.app_id}），"
                    f"由于今日触发巨额赎回机制，我们按照监管要求进行了比例确认。"
                    f"您的申请金额是{app.amount:.2f}元，实际确认{app.confirmed_amount:.2f}元，"
                    f"确认比例为{app.confirm_ratio*100:.2f}%。"
                    f"未确认的部分将自动顺延至下一交易日处理。给您带来不便，我们深表歉意！")
        elif app.status == ApplicationStatus.REJECTED:
            return (f"{greeting}关于您的赎回申请（单号：{app.app_id}），"
                    f"由于当日赎回额度已用尽，本次申请未能确认。"
                    f"建议您在明日交易时间早些时候重新申请。如有紧急需求，"
                    f"我可以帮您转接专属客户经理协助处理。")
        else:
            return (f"{greeting}您的赎回申请（单号：{app.app_id}）已确认，"
                    f"确认金额{app.confirmed_amount:.2f}元，资金将在T+1日到账。")


class ReportExporter:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_to_json(self, result: SimulationResult, filename: str = None) -> str:
        if not filename:
            filename = f"simulation_{result.simulation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        filepath = os.path.join(self.output_dir, filename)
        
        data = {
            "simulation_info": {
                "simulation_id": result.simulation_id,
                "simulation_name": result.simulation_name,
                "start_time": result.start_time.isoformat() if result.start_time else None,
                "end_time": result.end_time.isoformat() if result.end_time else None,
                "total_applications": result.total_applications,
                "confirmed_count": result.confirmed_count,
                "partial_confirmed_count": result.partial_confirmed_count,
                "rejected_count": result.rejected_count,
                "queued_count": result.queued_count
            },
            "applications": [self._app_to_dict(app) for app in result.applications],
            "fund_pool_snapshots": result.fund_pool_snapshots,
            "exceptions": result.exceptions,
            "warnings": result.warnings,
            "export_time": datetime.now().isoformat()
        }

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath

    def export_to_csv(self, result: SimulationResult, filename: str = None) -> str:
        if not filename:
            filename = f"simulation_{result.simulation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        filepath = os.path.join(self.output_dir, filename)

        fieldnames = [
            '申请单号', '客户名称', '客户等级', '申请类型', '申请金额',
            '确认金额', '确认比例', '排队位置', '状态', '申请时间',
            '拒绝原因', '解释说明', '客服话术'
        ]

        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for app in result.applications:
                explanation = ExplanationGenerator.generate_customer_friendly_explanation(app)
                writer.writerow({
                    '申请单号': app.app_id,
                    '客户名称': app.customer_name,
                    '客户等级': explanation['customer_level'],
                    '申请类型': explanation['app_type'],
                    '申请金额': f"{app.amount:.2f}",
                    '确认金额': f"{app.confirmed_amount:.2f}",
                    '确认比例': explanation['confirm_ratio'],
                    '排队位置': app.queue_position,
                    '状态': explanation['status'],
                    '申请时间': app.app_time.strftime('%Y-%m-%d %H:%M:%S'),
                    '拒绝原因': app.reject_reason.value if app.reject_reason else '',
                    '解释说明': '; '.join(app.explanation),
                    '客服话术': explanation['cs_call_script']
                })

        return filepath

    def export_explanation_report(self, result: SimulationResult, filename: str = None) -> str:
        if not filename:
            filename = f"explanation_{result.simulation_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"# 基金申赎模拟报告 - {result.simulation_name}\n\n")
            f.write(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 一、模拟概览\n\n")
            f.write(f"- 模拟ID：{result.simulation_id}\n")
            f.write(f"- 总申请数：{result.total_applications}\n")
            f.write(f"- 全额确认：{result.confirmed_count}\n")
            f.write(f"- 部分确认：{result.partial_confirmed_count}\n")
            f.write(f"- 申请被拒：{result.rejected_count}\n")
            f.write(f"- 排队中：{result.queued_count}\n\n")

            f.write("## 二、各申请处理明细\n\n")
            for idx, app in enumerate(result.applications, 1):
                exp = ExplanationGenerator.generate_customer_friendly_explanation(app)
                f.write(f"### {idx}. 申请单号：{app.app_id}\n\n")
                f.write(f"- **客户**：{app.customer_name}（{exp['customer_level']}）\n")
                f.write(f"- **申请类型**：{exp['app_type']}\n")
                f.write(f"- **申请金额**：{app.amount:.2f} 元\n")
                f.write(f"- **确认金额**：{app.confirmed_amount:.2f} 元\n")
                f.write(f"- **确认比例**：{exp['confirm_ratio']}\n")
                f.write(f"- **处理状态**：{exp['status']}\n")
                f.write(f"- **排队位置**：{app.queue_position}\n\n")
                
                f.write("#### 处理说明\n\n")
                for explanation in app.explanation:
                    f.write(f"- {explanation}\n")
                f.write("\n")

                f.write("#### 客服口径\n\n")
                f.write(f"> {exp['cs_call_script']}\n\n")

                f.write("#### 后续建议\n\n")
                for step in exp['next_steps']:
                    f.write(f"- {step}\n")
                f.write("\n")

            if result.warnings:
                f.write("## 三、系统提示\n\n")
                for warning in result.warnings:
                    f.write(f"- **{warning['step']}**：{warning['message']}\n")
                f.write("\n")

            if result.exceptions:
                f.write("## 四、异常记录\n\n")
                for exc in result.exceptions:
                    f.write(f"- **{exc['step']}**：{exc['message']}\n")
                    if exc.get('details'):
                        f.write(f"  - 详情：{exc['details']}\n")
                f.write("\n")

            f.write("## 五、复核说明\n\n")
            f.write("本报告所有数据均由系统自动计算生成，建议复核以下内容：\n")
            f.write("- 节假日设置是否正确\n")
            f.write("- 客户等级优先级设置是否合理\n")
            f.write("- 巨额赎回阈值设置是否符合基金合同\n")
            f.write("- 比例确认计算是否准确\n")
            f.write("- 每笔申请的解释说明是否清晰可解释\n\n")

        return filepath

    def _app_to_dict(self, app: Application) -> Dict[str, Any]:
        return {
            "app_id": app.app_id,
            "customer_id": app.customer_id,
            "customer_name": app.customer_name,
            "customer_level": app.customer_level.value,
            "app_type": app.app_type.value,
            "amount": app.amount,
            "shares": app.shares,
            "app_time": app.app_time.isoformat(),
            "trading_day": app.trading_day.isoformat(),
            "status": app.status.value,
            "confirmed_amount": app.confirmed_amount,
            "confirmed_shares": app.confirmed_shares,
            "confirm_ratio": app.confirm_ratio,
            "queue_position": app.queue_position,
            "reject_reason": app.reject_reason.value if app.reject_reason else None,
            "explanation": app.explanation,
            "metadata": app.metadata
        }
