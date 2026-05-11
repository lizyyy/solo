from typing import List
from models.data_models import CheckSession, CheckResult


class DisplayFormatter:
    @staticmethod
    def print_header(title: str):
        print("=" * 80)
        print(f"{title:^80}")
        print("=" * 80)
        print()

    @staticmethod
    def print_summary(session: CheckSession):
        total = len(session.results)
        print(f"📊 核对会话 ID: {session.session_id}")
        print(f"🕐 生成时间: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"📋 会话状态: {session.status}")
        print()
        print("-" * 80)
        print(f"{'状态':<15} {'数量':<10} {'说明':<50}")
        print("-" * 80)
        print(f"{'✓ 正常':<15} {session.total_normal:<10} {'加项收费匹配无误'}")
        print(f"{'📋 待处理':<15} {session.total_pending:<10} {'有加项无收费记录'}")
        print(f"{'⚠️ 异常':<15} {session.total_issues:<10} {'存在异常需要核查'}")
        print("-" * 80)
        print(f"{'总计':<15} {total:<10}")
        print()

    @staticmethod
    def print_result(result: CheckResult, index: int = None):
        status_symbol = {
            "normal": "✓",
            "pending": "📋",
            "issue": "⚠️"
        }.get(result.status, "?")

        status_color = {
            "normal": "32",
            "pending": "33",
            "issue": "31"
        }.get(result.status, "37")

        if index is not None:
            print(f"[{index:3d}] ", end="")
        
        print(f"\033[{status_color}m{status_symbol} {result.employee_name} ({result.employee_id})\033[0m")
        print(f"     企业: {result.company_name}")
        print(f"     项目: {result.item_code} - {result.item_name}")
        print(f"     数量: {result.quantity}  单价: ¥{result.unit_price:.2f}")
        print(f"     折扣: {result.discount_rate*100:.0f}%  应收: ¥{result.expected_amount:.2f}")
        print(f"     已收: ¥{result.paid_amount:.2f}  退费: ¥{result.refund_amount:.2f}")
        
        if result.issue_description:
            print(f"     \033[{status_color}m{result.issue_description}\033[0m")
        print()

    @staticmethod
    def print_pending(results: List[CheckResult]):
        DisplayFormatter.print_header("📋 待收费清单（需立即处理）")
        pending = [r for r in results if r.status == 'pending']
        
        if not pending:
            print("✅ 没有待收费项目")
            print()
            return

        print(f"共 {len(pending)} 项待收费:\n")
        for i, r in enumerate(pending, 1):
            DisplayFormatter.print_result(r, i)

    @staticmethod
    def print_issues(results: List[CheckResult]):
        DisplayFormatter.print_header("⚠️ 异常清单（需重点核查）")
        issues = [r for r in results if r.status == 'issue']
        
        if not issues:
            print("✅ 没有异常项目")
            print()
            return

        issue_types = {}
        for r in issues:
            itype = r.issue_type or "UNKNOWN"
            if itype not in issue_types:
                issue_types[itype] = []
            issue_types[itype].append(r)

        type_names = {
            "DUPLICATE_ADD_ON": "🔁 加项重复录入",
            "FORBIDDEN_ITEM": "🚫 企业套餐不允许",
            "AMOUNT_MISMATCH": "💵 收费金额不符",
            "DUPLICATE_PAYMENT": "💳 重复收费",
            "PARTIAL_REFUND": "💰 部分退费未清"
        }

        for itype, items in issue_types.items():
            print(f"\n{type_names.get(itype, itype)} ({len(items)} 项):\n")
            for i, r in enumerate(items, 1):
                DisplayFormatter.print_result(r, i)

    @staticmethod
    def print_normal(results: List[CheckResult]):
        DisplayFormatter.print_header("✓ 正常清单（已核对无误）")
        normal = [r for r in results if r.status == 'normal']
        
        if not normal:
            print("没有正常项目")
            print()
            return

        print(f"共 {len(normal)} 项正常:\n")
        for i, r in enumerate(normal, 1):
            DisplayFormatter.print_result(r, i)

    @staticmethod
    def print_quick_summary(session: CheckSession):
        print()
        print("═" * 80)
        print("📋 快速复核指引")
        print("═" * 80)
        
        if session.total_pending == 0 and session.total_issues == 0:
            print("\n🎉 所有加项收费核对无误！")
        else:
            if session.total_pending > 0:
                print(f"\n📋 优先处理: 有 {session.total_pending} 人加项后未收费")
            if session.total_issues > 0:
                print(f"\n⚠️ 需要核查: 有 {session.total_issues} 项异常")
        
        print()
        print("建议操作:")
        print("  1. 查看 '待收费清单' 联系对应员工补费")
        print("  2. 查看 '异常清单' 逐项核查问题原因")
        print("  3. 确认无误后使用 'confirm' 命令确认本次核对")
        print("  4. 使用 'export' 导出核对结果存档")
        print()
        print("═" * 80)
        print()

    @staticmethod
    def print_session_list(sessions: List[CheckSession]):
        DisplayFormatter.print_header("📜 历史核对会话")
        
        if not sessions:
            print("暂无历史记录")
            print()
            return

        print(f"{'ID':<12} {'创建时间':<20} {'状态':<10} {'待处理':<8} {'异常':<8} {'正常':<8}")
        print("-" * 70)
        
        for s in sessions:
            status_text = {
                "checked": "已检查",
                "confirmed": "已确认"
            }.get(s.status, s.status)
            
            print(f"{s.session_id:<12} {s.created_at.strftime('%Y-%m-%d %H:%M'):<20} "
                  f"{status_text:<10} {s.total_pending:<8} {s.total_issues:<8} {s.total_normal:<8}")
        print()

    @staticmethod
    def print_import_summary(summary: dict):
        DisplayFormatter.print_header("📥 数据导入汇总")
        for key, value in summary.items():
            print(f"  {key}: {value}")
        print()
