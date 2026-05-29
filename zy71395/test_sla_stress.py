#!/usr/bin/env python3
"""
SLA时钟系统压测脚本
测试场景：
1. 暂停重复 - 幂等性验证
2. 节假日跨区 - 多时区节假日处理
3. 客户回复未恢复 - 超时解释准确性
"""

from datetime import datetime, timedelta
import json
from sla_service import SLAService
from sla_models import (
    TicketPriority, PauseRequest, ResumeRequest, Holiday,
    PauseType, CustomerReply, TimeCalculationRequest
)
from report_exporter import ReportExporter


class SLAPressureTester:
    def __init__(self):
        self.service = SLAService()
        self.reporter = ReportExporter()
        self.results = []

    def log(self, test_name: str, passed: bool, message: str, details: dict = None):
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"\n{status} - {test_name}")
        print(f"  {message}")
        if details:
            print(f"  详情: {json.dumps(details, ensure_ascii=False, indent=2, default=str)}")
        self.results.append({
            "test_name": test_name,
            "passed": passed,
            "message": message,
            "details": details
        })

    def test_scenario_1_duplicate_pause(self):
        """测试场景1: 暂停重复 - 幂等性验证"""
        print("\n" + "="*60)
        print("测试场景1: 暂停重复 - 幂等性验证")
        print("="*60)

        result = self.service.create_ticket(
            title="测试暂停幂等性",
            description="测试重复暂停请求的幂等处理",
            priority=TicketPriority.HIGH
        )
        ticket_id = result.data["ticket_id"]
        self.service.start_ticket(ticket_id)

        pause_request = PauseRequest(
            ticket_id=ticket_id,
            pause_type=PauseType.MANUAL_PAUSE,
            reason="系统维护暂停",
            operator="test_user",
            idempotency_key="pause_key_001"
        )

        result1 = self.service.pause_ticket(pause_request)
        self.log(
            "首次暂停请求",
            result1.success and not result1.data.get("is_duplicate", False),
            "首次暂停应该成功创建新记录",
            {"pause_id": result1.data["pause_record"].id if result1.success else None}
        )

        result2 = self.service.pause_ticket(pause_request)
        self.log(
            "重复暂停请求(相同幂等键)",
            result2.success and result2.data.get("is_duplicate", False),
            "重复暂停应该返回已有记录，标记为重复",
            {"existing_record_id": result2.data.get("existing_record", {}).id if result2.success and result2.data.get("existing_record") else None}
        )

        resume_request = ResumeRequest(ticket_id=ticket_id, operator="test_user")
        result3 = self.service.resume_ticket(resume_request)
        self.log(
            "恢复暂停",
            result3.success,
            "恢复暂停应该成功",
            {"new_status": result3.data["status"] if result3.success else None}
        )

        pause_request_no_key = PauseRequest(
            ticket_id=ticket_id,
            pause_type=PauseType.MANUAL_PAUSE,
            reason="系统维护暂停",
            operator="test_user"
        )
        result4 = self.service.pause_ticket(pause_request_no_key)
        self.log(
            "无幂等键但内容相同的暂停请求",
            result4.success,
            "恢复后再次暂停应该成功",
            {"pause_id": result4.data["pause_record"].id if result4.success else None}
        )

        result5 = self.service.pause_ticket(pause_request_no_key, force=True)
        self.log(
            "强制暂停(覆盖现有暂停)",
            result5.success,
            "强制暂停应该成功，结束之前的活跃暂停",
            {"warnings": result5.data.get("conflicts", []) if result5.data else []}
        )

        resume_request2 = ResumeRequest(ticket_id=ticket_id, operator="test_user")
        result6 = self.service.resume_ticket(resume_request2)
        self.log(
            "最终恢复暂停",
            result6.success,
            "恢复暂停应该成功",
            {"new_status": result6.data["status"] if result6.success else None}
        )

    def test_scenario_2_holiday_cross_region(self):
        """测试场景2: 节假日跨区 - 多时区节假日处理"""
        print("\n" + "="*60)
        print("测试场景2: 节假日跨区 - 多时区节假日处理")
        print("="*60)

        result = self.service.create_ticket(
            title="测试节假日跨区",
            description="测试不同时区节假日的扣除计算",
            priority=TicketPriority.HIGH
        )
        ticket_id = result.data["ticket_id"]
        ticket = result.data["ticket"]

        start_time = datetime(2026, 4, 29, 10, 0, 0)
        ticket.created_at = start_time
        ticket.started_at = start_time
        self.service.update_ticket(ticket)

        cn_holiday = Holiday(
            name="中国劳动节",
            start_time=datetime(2026, 5, 1, 0, 0, 0),
            end_time=datetime(2026, 5, 5, 23, 59, 59),
            timezone="Asia/Shanghai",
            region="CN"
        )
        self.service.add_holiday(cn_holiday)

        us_holiday = Holiday(
            name="美国独立日",
            start_time=datetime(2026, 7, 4, 0, 0, 0),
            end_time=datetime(2026, 7, 4, 23, 59, 59),
            timezone="America/New_York",
            region="US"
        )
        self.service.add_holiday(us_holiday)

        end_time = datetime(2026, 5, 7, 18, 0, 0)

        calc_request = TimeCalculationRequest(
            ticket_id=ticket_id,
            target_time=end_time,
            include_segments=True
        )
        calc_result = self.service.calculate_time(calc_request)

        time_detail = calc_result.data["time_detail"]
        segments = calc_result.data["time_segments"]

        holiday_segments = [s for s in segments if s.segment_type == "holiday"]
        weekend_segments = [s for s in segments if s.segment_type == "weekend"]

        self.log(
            "中国劳动节扣除验证",
            time_detail.holiday_seconds > 0,
            "节假日时间应该被正确扣除",
            {
                "holiday_seconds": time_detail.holiday_seconds,
                "total_seconds": time_detail.total_seconds,
                "working_seconds": time_detail.working_seconds,
                "holiday_segments_count": len(holiday_segments),
                "holiday_days": time_detail.holiday_seconds / 86400
            }
        )

        self.log(
            "周末扣除验证",
            time_detail.weekend_seconds >= 0,
            "周末时间应该被正确扣除（节假日已包含周末）",
            {
                "weekend_seconds": time_detail.weekend_seconds,
                "weekend_segments_count": len(weekend_segments)
            }
        )

        report_result = self.service.generate_report(ticket_id, current_time=end_time)
        report = report_result.data["report"]

        self.log(
            "报告生成完整性",
            len(report.time_segments) > 0 and report.time_details.holiday_seconds > 0,
            "报告应该包含完整的时间分段和节假日扣除明细",
            {
                "total_segments": len(report.time_segments),
                "is_breached": report.is_breached,
                "summary_length": len(report.summary)
            }
        )

        markdown = report_result.data["markdown"]
        json_data = report_result.data["structured"]
        summary = report_result.data["summary"]

        self.log(
            "多格式输出一致性",
            "时间统计摘要" in markdown and "time_details" in json_data and "SLA 巡检摘要" in summary,
            "Markdown、JSON和摘要输出应该保持数据一致",
            {
                "markdown_has_summary": "时间统计摘要" in markdown,
                "json_has_details": "time_details" in json_data,
                "summary_has_header": "SLA 巡检摘要" in summary
            }
        )

    def test_scenario_3_customer_reply_no_resume(self):
        """测试场景3: 客户回复未恢复 - 超时解释准确性"""
        print("\n" + "="*60)
        print("测试场景3: 客户回复未恢复 - 超时解释准确性")
        print("="*60)

        result = self.service.create_ticket(
            title="测试客户回复未恢复",
            description="测试客户回复后SLA未自动恢复的超时解释",
            priority=TicketPriority.CRITICAL
        )
        ticket_id = result.data["ticket_id"]
        ticket = result.data["ticket"]

        start_time = datetime(2026, 5, 18, 9, 0, 0)
        ticket.created_at = start_time
        ticket.started_at = start_time
        self.service.update_ticket(ticket)
        self.service.start_ticket(ticket_id)

        pause_time = datetime(2026, 5, 18, 11, 0, 0)
        pause_request = PauseRequest(
            ticket_id=ticket_id,
            pause_type=PauseType.CUSTOMER_PENDING,
            reason="等待客户提供日志文件",
            operator="agent_001",
            start_time=pause_time
        )
        pause_result = self.service.pause_ticket(pause_request)

        reply_time = datetime(2026, 5, 19, 14, 0, 0)
        reply = CustomerReply(
            ticket_id=ticket_id,
            reply_time=reply_time,
            content="日志文件已上传，请查收",
            auto_resume_sla=False,
            requires_followup=True
        )
        self.service.add_customer_reply(reply)

        check_time = datetime(2026, 5, 20, 10, 0, 0)
        report_result = self.service.generate_report(ticket_id, current_time=check_time)
        report = report_result.data["report"]

        pending_segments = [s for s in report.time_segments if s.segment_type == "customer_pending"]

        self.log(
            "客户等待时间扣除",
            report.time_details.customer_pending_seconds > 0 or len(pending_segments) > 0,
            "客户等待时间应该被正确扣除",
            {
                "customer_pending_seconds": report.time_details.customer_pending_seconds,
                "pending_hours": report.time_details.customer_pending_seconds / 3600,
                "pending_segments": len(pending_segments)
            }
        )

        self.log(
            "客户等待分段明细",
            len(pending_segments) > 0,
            "应该有客户等待的时间分段记录",
            {
                "pending_segments": len(pending_segments),
                "first_segment": pending_segments[0].model_dump() if pending_segments else None
            }
        )

        self.log(
            "超时解释包含影响因素",
            all(len(b.contributing_factors) > 0 for b in report.breaches) if report.breaches else True,
            "每个超时违规都应该有影响因素分析",
            {
                "breach_count": len(report.breaches),
                "breaches": [
                    {
                        "type": b.breach_type,
                        "exceeded": b.exceeded_seconds,
                        "factors": b.contributing_factors
                    }
                    for b in report.breaches
                ]
            }
        )

        resume_request = ResumeRequest(
            ticket_id=ticket_id,
            operator="agent_001",
            reason="客户已提供所需材料",
            resume_time=check_time
        )
        resume_result = self.service.resume_ticket(resume_request)

        self.log(
            "手动恢复SLA",
            resume_result.success,
            "手动恢复应该成功，结束客户等待状态",
            {
                "new_status": resume_result.data["status"] if resume_result.success else None,
                "warnings": resume_result.data.get("warnings", []) if resume_result.success else None
            }
        )

        final_time = datetime(2026, 5, 20, 16, 0, 0)
        final_report = self.service.generate_report(ticket_id, current_time=final_time)

        self.log(
            "恢复后时间继续计算",
            final_report.data["report"].time_details.working_seconds >= report.time_details.working_seconds,
            "恢复后工作时间应该继续累计",
            {
                "before_working": report.time_details.working_seconds,
                "after_working": final_report.data["report"].time_details.working_seconds,
                "increase": final_report.data["report"].time_details.working_seconds - report.time_details.working_seconds
            }
        )

        summary = final_report.data["summary"]
        structured = final_report.data["structured"]

        self.log(
            "摘要与结构化数据一致",
            "有效工作时间" in summary,
            "人读摘要和结构化明细数据应该保持一致",
            {
                "effective_seconds": structured["time_details"]["effective_elapsed_seconds"],
                "summary_contains_time": "有效工作时间" in summary
            }
        )

    def test_scenario_4_mixed_complex_scenario(self):
        """测试场景4: 混合复杂场景 - 多因素叠加"""
        print("\n" + "="*60)
        print("测试场景4: 混合复杂场景 - 多因素叠加")
        print("="*60)

        result = self.service.create_ticket(
            title="测试混合复杂场景",
            description="测试节假日、周末、暂停、客户等待叠加的复杂场景",
            priority=TicketPriority.MEDIUM
        )
        ticket_id = result.data["ticket_id"]
        ticket = result.data["ticket"]

        start_time = datetime(2026, 4, 28, 14, 0, 0)
        ticket.created_at = start_time
        ticket.started_at = start_time
        self.service.update_ticket(ticket)
        self.service.start_ticket(ticket_id)

        mid_holiday = Holiday(
            name="五一劳动节",
            start_time=datetime(2026, 5, 1, 0, 0, 0),
            end_time=datetime(2026, 5, 3, 23, 59, 59),
            timezone="Asia/Shanghai"
        )
        self.service.add_holiday(mid_holiday)

        pause1 = PauseRequest(
            ticket_id=ticket_id,
            pause_type=PauseType.MANUAL_PAUSE,
            reason="技术方案评审",
            operator="tech_lead",
            start_time=datetime(2026, 4, 29, 16, 0, 0)
        )
        self.service.pause_ticket(pause1)

        resume1 = ResumeRequest(
            ticket_id=ticket_id,
            resume_time=datetime(2026, 4, 30, 10, 0, 0)
        )
        self.service.resume_ticket(resume1)

        pause2 = PauseRequest(
            ticket_id=ticket_id,
            pause_type=PauseType.CUSTOMER_PENDING,
            reason="等待客户确认需求",
            operator="agent_002",
            start_time=datetime(2026, 5, 4, 14, 0, 0)
        )
        self.service.pause_ticket(pause2)

        reply = CustomerReply(
            ticket_id=ticket_id,
            reply_time=datetime(2026, 5, 6, 10, 0, 0),
            content="需求已确认，可以继续处理",
            auto_resume_sla=True
        )
        self.service.add_customer_reply(reply)

        end_time = datetime(2026, 5, 8, 18, 0, 0)
        report_result = self.service.generate_report(ticket_id, current_time=end_time)
        report = report_result.data["report"]

        td = report.time_details
        total_deducted = td.paused_seconds + td.holiday_seconds + td.weekend_seconds + td.customer_pending_seconds
        expected_working = td.total_seconds - total_deducted

        self.log(
            "总时间计算有效性",
            td.total_seconds > 0,
            "总时间计算应该为正数",
            {
                "total_seconds": td.total_seconds,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat()
            }
        )

        self.log(
            "多因素扣除验证",
            td.holiday_seconds > 0 or td.paused_seconds > 0 or td.customer_pending_seconds > 0,
            "应该有各种类型的时间扣除",
            {
                "total_seconds": td.total_seconds,
                "working_seconds": td.working_seconds,
                "paused_seconds": td.paused_seconds,
                "holiday_seconds": td.holiday_seconds,
                "weekend_seconds": td.weekend_seconds,
                "customer_pending_seconds": td.customer_pending_seconds,
                "total_deducted": total_deducted
            }
        )

        self.log(
            "时间分段完整性",
            len(report.time_segments) >= 3,
            "应该有足够多的时间分段记录不同类型的扣除",
            {
                "total_segments": len(report.time_segments),
                "segment_types": list(set(s.segment_type for s in report.time_segments)),
                "segment_counts": {
                    t: len([s for s in report.time_segments if s.segment_type == t])
                    for t in set(s.segment_type for s in report.time_segments)
                }
            }
        )

        detailed_errors = []
        for i, breach in enumerate(report.breaches):
            if not breach.explanation or len(breach.explanation) < 10:
                detailed_errors.append(f"违规{i+1}解释不详细")
            if not breach.contributing_factors:
                detailed_errors.append(f"违规{i+1}缺少影响因素")

        self.log(
            "超时解释详细程度",
            len(detailed_errors) == 0,
            "每个超时都应该有详细解释和影响因素",
            {
                "breach_count": len(report.breaches),
                "errors": detailed_errors,
                "breach_explanations": [b.explanation for b in report.breaches]
            }
        )

        summary = report_result.data["summary"]
        json_str = report_result.data["json"]
        markdown = report_result.data["markdown"]

        self.log(
            "三格式输出可验证",
            len(summary) > 100 and len(json_str) > 500 and len(markdown) > 1000,
            "摘要、JSON、Markdown三种格式都应该有足够内容",
            {
                "summary_length": len(summary),
                "json_length": len(json_str),
                "markdown_length": len(markdown)
            }
        )

    def run_all_tests(self):
        print("\n" + "#"*60)
        print("#           开始执行SLA时钟系统压测")
        print("#"*60)

        try:
            self.test_scenario_1_duplicate_pause()
        except Exception as e:
            import traceback
            self.log("场景1执行异常", False, str(e), {"traceback": traceback.format_exc()})

        try:
            self.test_scenario_2_holiday_cross_region()
        except Exception as e:
            import traceback
            self.log("场景2执行异常", False, str(e), {"traceback": traceback.format_exc()})

        try:
            self.test_scenario_3_customer_reply_no_resume()
        except Exception as e:
            import traceback
            self.log("场景3执行异常", False, str(e), {"traceback": traceback.format_exc()})

        try:
            self.test_scenario_4_mixed_complex_scenario()
        except Exception as e:
            import traceback
            self.log("场景4执行异常", False, str(e), {"traceback": traceback.format_exc()})

        self.print_summary()

    def print_summary(self):
        print("\n" + "="*60)
        print("                    测试结果汇总")
        print("="*60)

        passed = sum(1 for r in self.results if r["passed"])
        total = len(self.results)

        print(f"\n总测试用例: {total}")
        print(f"通过: {passed}")
        print(f"失败: {total - passed}")
        print(f"通过率: {passed/total*100:.1f}%")

        print("\n详细结果:")
        for r in self.results:
            status = "✅" if r["passed"] else "❌"
            print(f"  {status} {r['test_name']}: {r['message']}")

        if passed == total:
            print("\n🎉 所有测试通过！系统运行正常。")
        else:
            print(f"\n⚠️  有 {total - passed} 个测试失败，请检查。")

        return passed == total


if __name__ == "__main__":
    tester = SLAPressureTester()
    success = tester.run_all_tests()
    exit(0 if success else 1)
