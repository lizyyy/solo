from typing import Optional

from ..models.models import ArtifactGrade


class DiscrepancyAnalyzer:
    GRADE_VALUATION_RULES = {
        ArtifactGrade.FIRST_CLASS: {
            "max_increase_pct": 20,
            "max_decrease_pct": 10,
            "requires_approval": True,
            "approval_level": "馆长审批",
        },
        ArtifactGrade.SECOND_CLASS: {
            "max_increase_pct": 30,
            "max_decrease_pct": 15,
            "requires_approval": True,
            "approval_level": "部门主任审批",
        },
        ArtifactGrade.THIRD_CLASS: {
            "max_increase_pct": 50,
            "max_decrease_pct": 25,
            "requires_approval": False,
            "approval_level": "展陈部确认",
        },
        ArtifactGrade.GENERAL: {
            "max_increase_pct": 100,
            "max_decrease_pct": 50,
            "requires_approval": False,
            "approval_level": "展陈部备案",
        },
    }

    TEMP_IMPACT_LEVELS = {
        "low": "轻微波动，对文物影响有限",
        "medium": "中等偏差，需关注文物状态变化",
        "high": "严重偏差，可能造成不可逆损害",
    }

    HUMIDITY_IMPACT_LEVELS = {
        "low": "轻微波动，对文物影响有限",
        "medium": "中等偏差，需关注防霉防潮措施",
        "high": "严重偏差，可能造成干裂、霉变等损害",
    }

    def explain_valuation_change(
        self,
        previous_value: float,
        current_value: float,
        grade: Optional[ArtifactGrade] = None,
    ) -> str:
        change_pct = ((current_value - previous_value) / previous_value) * 100
        direction = "上涨" if change_pct > 0 else "下降"
        abs_change = abs(change_pct)

        explanation_parts = [
            f"估值从¥{previous_value:,.2f}{direction}至¥{current_value:,.2f}，",
            f"变动幅度为{change_pct:+.2f}%。",
        ]

        if grade and grade in self.GRADE_VALUATION_RULES:
            rules = self.GRADE_VALUATION_RULES[grade]

            if change_pct > 0:
                if abs_change > rules["max_increase_pct"]:
                    explanation_parts.append(
                        f"根据{grade.value}管理规定，估值涨幅上限为{rules['max_increase_pct']}%，"
                        f"当前涨幅已超规，需提交{rules['approval_level']}。"
                    )
                else:
                    explanation_parts.append(
                        f"根据{grade.value}管理规定，涨幅在允许范围内（上限{rules['max_increase_pct']}%）。"
                    )
            else:
                if abs_change > rules["max_decrease_pct"]:
                    explanation_parts.append(
                        f"根据{grade.value}管理规定，估值跌幅上限为{rules['max_decrease_pct']}%，"
                        f"当前跌幅已超规，需提交{rules['approval_level']}并说明原因。"
                    )
                else:
                    explanation_parts.append(
                        f"根据{grade.value}管理规定，跌幅在允许范围内（上限{rules['max_decrease_pct']}%）。"
                    )

            if rules["requires_approval"]:
                explanation_parts.append(f"该等级文物估值变更需经{rules['approval_level']}。")
        else:
            explanation_parts.append("建议核实估值变更的依据，如市场行情、专家评估等。")

        if change_pct > 50:
            explanation_parts.append("⚠ 估值大幅上涨，请重点关注是否存在估值虚高风险。")
        elif change_pct < -30:
            explanation_parts.append("⚠ 估值大幅下跌，请确认文物是否存在损坏或其他价值减损因素。")

        return "".join(explanation_parts)

    def explain_insurance_mismatch(
        self, valuation: float, insured_amount: float
    ) -> str:
        diff = insured_amount - valuation
        diff_pct = (diff / valuation) * 100

        if diff > 0:
            return (
                f"保险金额(¥{insured_amount:,.2f})高于估值(¥{valuation:,.2f})，"
                f"差额¥{diff:,.2f}({diff_pct:+.2f}%)。"
                f"超额投保可能导致保费浪费，但在文物价值被低估时是合理的风险对冲。"
                f"建议确认保险金额的确定依据。"
            )
        elif diff < 0:
            return (
                f"保险金额(¥{insured_amount:,.2f})低于估值(¥{valuation:,.2f})，"
                f"差额¥{abs(diff):,.2f}({diff_pct:+.2f}%)。"
                f"⚠ 不足额投保可能导致损失时无法获得全额赔付，"
                f"建议调整保险金额以匹配估值。"
            )
        else:
            return "保险金额与估值一致，无差异。"

    def explain_transport_delay(self, delay_days: int, transport_method: str) -> str:
        method_map = {
            "航空运输": "航空运输通常对时间要求较高，延误可能影响后续展览安排",
            "铁路运输": "铁路运输延误较为常见，但需确认是否影响展览筹备",
            "公路运输": "公路运输受路况影响较大，延误可能涉及运输安全问题",
            "海运": "海运受天气和港口调度影响较大，延误可能影响后续安排",
        }
        method_note = method_map.get(transport_method, f"{transport_method}运输")

        if delay_days <= 1:
            severity = "轻微延误"
            impact = "对整体进度影响有限"
        elif delay_days <= 3:
            severity = "中等延误"
            impact = "可能需要调整部分筹备工作"
        elif delay_days <= 7:
            severity = "较严重延误"
            impact = "可能影响展览筹备进度，需与承运方协商"
        else:
            severity = "严重延误"
            impact = "可能影响展览开幕，需启动应急预案并与各方沟通"

        return (
            f"{severity}：运输比计划晚到{delay_days}天。{method_note}。"
            f"影响评估：{impact}。建议核查延误原因（天气/交通/承运方调度等），"
            f"评估是否需要调整后续安排或向承运方索赔。"
        )

    def explain_node_delay(self, node_name: str, delay_days: int, notes: str) -> str:
        base = f"运输节点【{node_name}】延误{delay_days}天。"
        if notes:
            base += f"节点备注：{notes}。"
        if delay_days > 2:
            base += "延误时间较长，可能影响后续节点的计划安排。建议确认该节点延误是否会传导至后续环节。"
        else:
            base += "延误时间较短，对整体运输计划影响有限。"
        return base

    def explain_node_missing(self, node_name: str, status: str) -> str:
        return (
            f"运输节点【{node_name}】未按计划到达，当前状态：{status}。"
            f"⚠ 运输节点缺失可能意味着：1)物流信息未更新；2)运输出现异常；"
            f"3)节点信息记录有误。建议立即联系承运方确认实际运输状态，"
            f"并评估是否影响展览筹备进度。"
        )

    def _classify_temp_impact(self, temp: float, temp_min: float, temp_max: float) -> str:
        ideal = (temp_min + temp_max) / 2
        deviation = abs(temp - ideal)
        if deviation <= 3:
            return "low"
        elif deviation <= 6:
            return "medium"
        else:
            return "high"

    def _classify_humidity_impact(self, humidity: float, hum_min: float, hum_max: float) -> str:
        ideal = (hum_min + hum_max) / 2
        deviation = abs(humidity - ideal)
        if deviation <= 5:
            return "low"
        elif deviation <= 10:
            return "medium"
        else:
            return "high"

    def explain_temperature_abnormal(
        self, temperature: float, temp_min: float, temp_max: float, node_name: str
    ) -> str:
        impact_level = self._classify_temp_impact(temperature, temp_min, temp_max)
        impact_desc = self.TEMP_IMPACT_LEVELS[impact_level]

        direction = "过高" if temperature > temp_max else "过低"
        deviation = max(temperature - temp_max, temp_min - temperature)

        explanation = (
            f"运输节点【{node_name}】温度{direction}："
            f"实测{temperature}°C，正常范围{temp_min}°C~{temp_max}°C，"
            f"偏差{deviation:.1f}°C。{impact_desc}。"
        )

        if impact_level == "high":
            explanation += (
                "⚠ 严重偏离正常温度范围，建议立即检查运输设备温控系统，"
                "并在到达后对文物进行详细状态检查。"
            )
        elif impact_level == "medium":
            explanation += "建议关注后续节点温度情况，到达后对文物进行常规检查。"

        return explanation

    def explain_humidity_abnormal(
        self, humidity: float, hum_min: float, hum_max: float, node_name: str
    ) -> str:
        impact_level = self._classify_humidity_impact(humidity, hum_min, hum_max)
        impact_desc = self.HUMIDITY_IMPACT_LEVELS[impact_level]

        direction = "过高" if humidity > hum_max else "过低"
        deviation = max(humidity - hum_max, hum_min - humidity)

        explanation = (
            f"运输节点【{node_name}】湿度{direction}："
            f"实测{humidity}%，正常范围{hum_min}%~{hum_max}%，"
            f"偏差{deviation:.1f}%。{impact_desc}。"
        )

        if impact_level == "high":
            if humidity > hum_max:
                explanation += (
                    "⚠ 严重高湿环境，可能导致金属部件锈蚀、纸质文物霉变、纺织品受潮。"
                    "建议立即检查湿度调节设备，并在到达后对文物进行防霉处理。"
                )
            else:
                explanation += (
                    "⚠ 严重干燥环境，可能导致木器干裂、书画脆化、皮革收缩。"
                    "建议立即检查加湿系统，并在到达后评估文物状况。"
                )
        elif impact_level == "medium":
            explanation += "建议关注后续节点湿度情况，做好到达后的环境适应处理。"

        return explanation

    def explain_condition_change(
        self, previous_condition: str, current_condition: str, grade: Optional[ArtifactGrade] = None
    ) -> str:
        explanation = f"文物状态从「{previous_condition}」变更为「{current_condition}」。"

        if current_condition in ("破损", "严重损坏"):
            explanation += (
                "⚠ 文物状态严重恶化，需立即：1)启动文物保护应急程序；"
                "2)联系文物保护专家进行评估；3)检查保险理赔条件。"
            )
        elif current_condition in ("轻微损坏", "有瑕疵"):
            explanation += "文物状态出现问题，建议安排文物保护人员进行详细检查。"
        elif current_condition == "完好":
            explanation += "文物状态恢复正常，建议记录恢复原因。"

        if grade in (ArtifactGrade.FIRST_CLASS, ArtifactGrade.SECOND_CLASS):
            explanation += f"该{grade.value}状态变更需报上级审批并详细记录。"

        return explanation

    def generate_review_guidance(self, discrepancy_type: str, severity: str) -> str:
        guidance_map = {
            ("估值变更", "critical"): "需提交馆长审批，准备估值依据材料（专家评估报告、市场行情分析）",
            ("估值变更", "normal"): "展陈部确认即可，记录变更原因",
            ("运输延误", "critical"): "需与承运方协商处理，评估是否影响展览进度，必要时启动应急预案",
            ("运输延误", "normal"): "记录延误原因，关注后续节点，评估对整体进度的影响",
            ("温湿度异常", "critical"): "立即检查温控设备，到达后进行文物详细检查，评估损坏程度",
            ("温湿度异常", "normal"): "持续监测后续节点环境，到达后进行常规检查",
            ("保险金额不符", "critical"): "立即与保险公司沟通，调整保险金额或确认保险条款",
            ("保险金额不符", "normal"): "记录差异原因，确认保险是否足额覆盖风险",
            ("运输节点缺失", "critical"): "立即联系承运方确认运输状态，评估运输安全性",
            ("运输节点缺失", "normal"): "核实节点信息，与承运方确认运输进度",
        }

        key = (discrepancy_type, severity)
        return guidance_map.get(key, "请根据具体情况进行评估处理")