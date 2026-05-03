"""CLI 主程序 - 镀镍槽补加推演器"""

import argparse
import sys
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List

from nickel_plating_calculator.models.data_models import (
    BatchContext,
    SolutionPlan,
    ApprovalRecord,
    ApprovalStatus,
    RiskLevel,
    ProcessParameters,
)
from nickel_plating_calculator.models.config import ConfigManager
from nickel_plating_calculator.parser.csv_parser import (
    parse_titration_csv,
    parse_tank_record_csv,
    parse_production_csv,
    parse_inventory_csv,
    CSVParseError,
)
from nickel_plating_calculator.parser.validator import (
    validate_titration,
    validate_tank_record,
    validate_production,
    validate_inventory,
    ValidationResult,
)
from nickel_plating_calculator.chemistry.calculator import ChemistryCalculator
from nickel_plating_calculator.rules.engine import RuleEngine
from nickel_plating_calculator.storage.store import DataStore, AuditLogger
from nickel_plating_calculator.reporting.reporter import (
    MarkdownReporter,
    CSVReporter,
    JSONAuditor,
)


class NickelPlatingCalculatorCLI:
    """CLI 应用程序"""
    
    def __init__(self):
        self.config_manager = ConfigManager()
        self.data_store = DataStore()
        self.audit_logger = AuditLogger()
        self.calculator = ChemistryCalculator.from_config(self.config_manager)
        self.rule_engine = RuleEngine.from_config(self.config_manager)
        self.md_reporter = MarkdownReporter()
        self.csv_reporter = CSVReporter()
        self.json_auditor = JSONAuditor()
    
    def run(self):
        """运行CLI"""
        parser = self._create_parser()
        args = parser.parse_args()
        
        if hasattr(args, 'func'):
            try:
                args.func(args)
            except Exception as e:
                print(f"错误: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            parser.print_help()
    
    def _create_parser(self) -> argparse.ArgumentParser:
        """创建参数解析器"""
        parser = argparse.ArgumentParser(
            prog="nickel-plating-calc",
            description="镀镍槽补加推演器 - 给五金电镀小厂化验员用的本地科学计算工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
        )
        
        subparsers = parser.add_subparsers(title="子命令", dest="subcommand")
        
        import_parser = subparsers.add_parser("import", help="导入数据")
        import_parser.add_argument("--titration", "-t", type=str, help="滴定化验CSV文件路径")
        import_parser.add_argument("--tank", "-k", type=str, help="槽液记录CSV文件路径")
        import_parser.add_argument("--production", "-p", type=str, help="生产记录CSV文件路径")
        import_parser.add_argument("--inventory", "-i", type=str, help="库存CSV文件路径")
        import_parser.add_argument("--batch-id", "-b", type=str, help="批次ID（如未提供将从数据中提取）")
        import_parser.add_argument("--operator", "-o", type=str, default="系统", help="操作员名称")
        import_parser.set_defaults(func=self._cmd_import)
        
        calc_parser = subparsers.add_parser("calculate", help="计算补加量")
        calc_parser.add_argument("--batch-id", "-b", type=str, required=True, help="批次ID")
        calc_parser.add_argument("--target-ns", type=float, help="目标硫酸镍浓度 (g/L)")
        calc_parser.add_argument("--target-nc", type=float, help="目标氯化镍浓度 (g/L)")
        calc_parser.add_argument("--target-ba", type=float, help="目标硼酸浓度 (g/L)")
        calc_parser.add_argument("--target-ph", type=float, help="目标pH值")
        calc_parser.add_argument("--plan-name", "-n", type=str, default="标准方案", help="方案名称")
        calc_parser.add_argument("--operator", "-o", type=str, default="系统", help="操作员名称")
        calc_parser.set_defaults(func=self._cmd_calculate)
        
        compare_parser = subparsers.add_parser("compare", help="对比两套方案")
        compare_parser.add_argument("--batch-id", "-b", type=str, required=True, help="批次ID")
        compare_parser.add_argument("--plan-a", "-a", type=str, required=True, help="方案A名称/ID")
        compare_parser.add_argument("--plan-b", "-c", type=str, required=True, help="方案B名称/ID")
        compare_parser.set_defaults(func=self._cmd_compare)
        
        approve_parser = subparsers.add_parser("approve", help="人工放行记录")
        approve_parser.add_argument("--batch-id", "-b", type=str, required=True, help="批次ID")
        approve_parser.add_argument("--plan-id", "-p", type=str, required=True, help="选择的方案ID")
        approve_parser.add_argument("--operator", "-o", type=str, required=True, help="操作员")
        approve_parser.add_argument("--reviewer", "-r", type=str, required=True, help="审核人")
        approve_parser.add_argument("--reject", action="store_true", help="拒绝（默认放行）")
        approve_parser.add_argument("--notes", "-n", type=str, help="备注")
        approve_parser.add_argument(
            "--actual-ns", type=float, help="实际添加硫酸镍量 (kg)"
        )
        approve_parser.add_argument(
            "--actual-nc", type=float, help="实际添加氯化镍量 (kg)"
        )
        approve_parser.add_argument(
            "--actual-ba", type=float, help="实际添加硼酸量 (kg)"
        )
        approve_parser.add_argument(
            "--actual-h2so4", type=float, help="实际添加硫酸量 (mL)"
        )
        approve_parser.add_argument(
            "--actual-naoh", type=float, help="实际添加氢氧化钠量 (mL)"
        )
        approve_parser.set_defaults(func=self._cmd_approve)
        
        export_parser = subparsers.add_parser("export", help="导出报告")
        export_parser.add_argument("--batch-id", "-b", type=str, required=True, help="批次ID")
        export_parser.add_argument("--output-dir", "-o", type=str, default="./output", help="输出目录")
        export_parser.add_argument("--plan-id", "-p", type=str, help="选择的方案ID（用于作业单）")
        export_parser.add_argument(
            "--format", "-f", type=str, choices=["md", "csv", "json", "all"], default="all",
            help="导出格式: md=Markdown作业单, csv=CSV批次表, json=JSON审计包, all=全部"
        )
        export_parser.set_defaults(func=self._cmd_export)
        
        list_parser = subparsers.add_parser("list", help="列出所有批次")
        list_parser.set_defaults(func=self._cmd_list)
        
        show_parser = subparsers.add_parser("show", help="显示批次详情")
        show_parser.add_argument("--batch-id", "-b", type=str, required=True, help="批次ID")
        show_parser.set_defaults(func=self._cmd_show)
        
        config_parser = subparsers.add_parser("config", help="查看/修改配置")
        config_parser.add_argument("--reset", action="store_true", help="重置为默认配置")
        config_parser.add_argument("--show", action="store_true", help="显示当前配置")
        config_parser.set_defaults(func=self._cmd_config)
        
        return parser
    
    def _cmd_import(self, args):
        """导入数据命令"""
        context: Optional[BatchContext] = None
        batch_id = args.batch_id
        
        if batch_id:
            context = self.data_store.load_batch(batch_id)
        
        if context is None:
            if not batch_id:
                batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            context = BatchContext(
                batch_id=batch_id,
                created_at=datetime.now(),
            )
        
        if args.titration:
            print(f"导入滴定数据: {args.titration}")
            try:
                titration = parse_titration_csv(args.titration)
                validation = validate_titration(titration, self.config_manager.get_process_parameters())
                
                if not validation.is_valid:
                    print("滴定数据验证失败:")
                    for err in validation.errors:
                        print(f"  - {err}")
                    return
                
                for warning in validation.warnings:
                    print(f"警告: {warning}")
                
                context.titration = titration
                
                if not args.batch_id:
                    context.batch_id = titration.batch_id
                
                self.audit_logger.log_action(
                    operator=args.operator,
                    action="导入滴定数据",
                    details={"file": args.titration},
                    batch_id=context.batch_id,
                )
                print(f"滴定数据导入成功: {titration.titration_id}")
            except CSVParseError as e:
                print(f"解析滴定数据失败: {e}")
                return
        
        if args.tank:
            print(f"导入槽液记录: {args.tank}")
            try:
                tank_record = parse_tank_record_csv(args.tank)
                validation = validate_tank_record(tank_record, self.config_manager.get_process_parameters())
                
                if not validation.is_valid:
                    print("槽液记录验证失败:")
                    for err in validation.errors:
                        print(f"  - {err}")
                    return
                
                for warning in validation.warnings:
                    print(f"警告: {warning}")
                
                context.tank_record = tank_record
                self.audit_logger.log_action(
                    operator=args.operator,
                    action="导入槽液记录",
                    details={"file": args.tank},
                    batch_id=context.batch_id,
                )
                print(f"槽液记录导入成功: 槽号 {tank_record.tank_id}, 体积 {tank_record.volume_liters}L")
            except CSVParseError as e:
                print(f"解析槽液记录失败: {e}")
                return
        
        if args.production:
            print(f"导入生产记录: {args.production}")
            try:
                production = parse_production_csv(args.production)
                validation = validate_production(production)
                
                if not validation.is_valid:
                    print("生产记录验证失败:")
                    for err in validation.errors:
                        print(f"  - {err}")
                    return
                
                for warning in validation.warnings:
                    print(f"警告: {warning}")
                
                context.production = production
                self.audit_logger.log_action(
                    operator=args.operator,
                    action="导入生产记录",
                    details={"file": args.production},
                    batch_id=context.batch_id,
                )
                print(f"生产记录导入成功: 面积 {production.total_area_dm2} dm², 工件 {production.parts_count} 件")
            except CSVParseError as e:
                print(f"解析生产记录失败: {e}")
                return
        
        if args.inventory:
            print(f"导入库存数据: {args.inventory}")
            try:
                inventories = parse_inventory_csv(args.inventory)
                for inv in inventories:
                    validation = validate_inventory(inv)
                    
                    if not validation.is_valid:
                        print(f"库存数据验证失败 ({inv.chemical_name}):")
                        for err in validation.errors:
                            print(f"  - {err}")
                        continue
                    
                    for warning in validation.warnings:
                        print(f"警告 ({inv.chemical_name}): {warning}")
                    
                    context.inventory[inv.chemical_name] = inv
                
                self.audit_logger.log_action(
                    operator=args.operator,
                    action="导入库存数据",
                    details={"file": args.inventory, "count": len(inventories)},
                    batch_id=context.batch_id,
                )
                print(f"库存数据导入成功: {len(inventories)} 条记录")
            except CSVParseError as e:
                print(f"解析库存数据失败: {e}")
                return
        
        self.data_store.save_batch(context)
        print(f"\n批次数据已保存: {context.batch_id}")
    
    def _cmd_calculate(self, args):
        """计算补加量命令"""
        context = self.data_store.load_batch(args.batch_id)
        if context is None:
            print(f"错误: 未找到批次 {args.batch_id}")
            return
        
        if context.titration is None:
            print("错误: 缺少滴定数据，请先导入滴定数据")
            return
        
        if context.tank_record is None:
            print("错误: 缺少槽液记录，请先导入槽液记录")
            return
        
        context.process_params = self.config_manager.get_process_parameters()
        
        print("计算浓度...")
        concentrations = self.calculator.calculate_concentrations(context.titration)
        context.concentrations = concentrations
        
        print(f"  硫酸镍: {concentrations.nickel_sulfate_g_l:.2f} g/L ({concentrations.nickel_sulfate_status})")
        print(f"  氯化镍: {concentrations.nickel_chloride_g_l:.2f} g/L ({concentrations.nickel_chloride_status})")
        print(f"  硼酸: {concentrations.boric_acid_g_l:.2f} g/L ({concentrations.boric_acid_status})")
        print(f"  pH: {concentrations.ph_value:.2f} ({concentrations.ph_status})")
        
        target_adjustments = {}
        if args.target_ns:
            target_adjustments["nickel_sulfate"] = args.target_ns
        if args.target_nc:
            target_adjustments["nickel_chloride"] = args.target_nc
        if args.target_ba:
            target_adjustments["boric_acid"] = args.target_ba
        if args.target_ph:
            target_adjustments["ph"] = args.target_ph
        
        if target_adjustments:
            print(f"\n使用自定义目标: {target_adjustments}")
        
        print("\n计算补加量...")
        dosage = self.calculator.calculate_dosage(
            concentrations,
            context.tank_record.volume_liters,
            target_adjustments if target_adjustments else None,
        )
        
        print(f"  硫酸镍: {dosage.nickel_sulfate_to_add_kg:.3f} kg")
        print(f"  氯化镍: {dosage.nickel_chloride_to_add_kg:.3f} kg")
        print(f"  硼酸: {dosage.boric_acid_to_add_kg:.3f} kg")
        if dosage.sulfuric_acid_to_add_ml:
            print(f"  硫酸: {dosage.sulfuric_acid_to_add_ml:.2f} mL")
        if dosage.sodium_hydroxide_to_add_ml:
            print(f"  氢氧化钠: {dosage.sodium_hydroxide_to_add_ml:.2f} mL")
        
        print("\n模拟补加结果...")
        simulation = self.calculator.simulate_dosage(concentrations, dosage, args.plan_name)
        
        print(f"  硫酸镍: {simulation.simulated_nickel_sulfate_g_l:.2f} g/L "
              f"({'✓ 范围内' if simulation.nickel_sulfate_in_range else '✗ 超出范围'})")
        print(f"  氯化镍: {simulation.simulated_nickel_chloride_g_l:.2f} g/L "
              f"({'✓ 范围内' if simulation.nickel_chloride_in_range else '✗ 超出范围'})")
        print(f"  硼酸: {simulation.simulated_boric_acid_g_l:.2f} g/L "
              f"({'✓ 范围内' if simulation.boric_acid_in_range else '✗ 超出范围'})")
        print(f"  pH: {simulation.simulated_ph:.2f} "
              f"({'✓ 范围内' if simulation.ph_in_range else '✗ 超出范围'})")
        
        print("\n检查库存...")
        inventory_check = self.rule_engine.check_inventory(dosage, context.inventory)
        
        print(f"  硫酸镍: {'✓ 充足' if inventory_check.nickel_sulfate_available else f'✗ 短缺 {inventory_check.nickel_sulfate_shortage_kg:.3f}kg'}")
        print(f"  氯化镍: {'✓ 充足' if inventory_check.nickel_chloride_available else f'✗ 短缺 {inventory_check.nickel_chloride_shortage_kg:.3f}kg'}")
        print(f"  硼酸: {'✓ 充足' if inventory_check.boric_acid_available else f'✗ 短缺 {inventory_check.boric_acid_shortage_kg:.3f}kg'}")
        
        print("\n风险评估...")
        risk_assessment = self.rule_engine.assess_risk(
            concentrations,
            dosage,
            simulation,
            inventory_check,
            context.titration.ph_value,
        )
        
        print(f"  整体风险等级: {risk_assessment.overall_risk.value}")
        print(f"  是否可执行: {'✓ 是' if risk_assessment.can_proceed else '✗ 否'}")
        
        if risk_assessment.risks:
            print(f"\n  风险详情 ({len(risk_assessment.risks)} 项):")
            for i, risk in enumerate(risk_assessment.risks, 1):
                print(f"    {i}. [{risk.level.value}] {risk.category}: {risk.description}")
                print(f"       建议: {risk.suggestion}")
        
        plan_id = str(uuid.uuid4())[:8]
        plan = SolutionPlan(
            plan_id=plan_id,
            plan_name=args.plan_name,
            batch_id=context.batch_id,
            created_at=datetime.now(),
            operator=args.operator,
            dosage=dosage,
            simulation=simulation,
            risks=risk_assessment,
            inventory=inventory_check,
            is_preferred=len(context.plans) == 0,
        )
        
        context.plans[plan_id] = plan
        
        self.audit_logger.log_action(
            operator=args.operator,
            action="计算补加方案",
            details={
                "plan_name": args.plan_name,
                "plan_id": plan_id,
                "dosage": {
                    "nickel_sulfate_kg": dosage.nickel_sulfate_to_add_kg,
                    "nickel_chloride_kg": dosage.nickel_chloride_to_add_kg,
                    "boric_acid_kg": dosage.boric_acid_to_add_kg,
                },
            },
            batch_id=context.batch_id,
            plan_id=plan_id,
        )
        
        self.data_store.save_batch(context)
        print(f"\n方案已保存: {args.plan_name} (ID: {plan_id})")
    
    def _cmd_compare(self, args):
        """对比方案命令"""
        context = self.data_store.load_batch(args.batch_id)
        if context is None:
            print(f"错误: 未找到批次 {args.batch_id}")
            return
        
        plan_a = self._find_plan(context, args.plan_a)
        plan_b = self._find_plan(context, args.plan_b)
        
        if plan_a is None:
            print(f"错误: 未找到方案A: {args.plan_a}")
            return
        
        if plan_b is None:
            print(f"错误: 未找到方案B: {args.plan_b}")
            return
        
        print("=" * 60)
        print("方案对比")
        print("=" * 60)
        
        print(f"\n{'参数':<25} {'方案A':<20} {'方案B':<20}")
        print("-" * 65)
        
        print(f"{'方案名称':<25} {plan_a.plan_name:<20} {plan_b.plan_name:<20}")
        print(f"{'风险等级':<25} {plan_a.risks.overall_risk.value:<20} {plan_b.risks.overall_risk.value:<20}")
        print(f"{'可执行':<25} {'✓' if plan_a.risks.can_proceed else '✗':<20} {'✓' if plan_b.risks.can_proceed else '✗':<20}")
        print(f"{'库存充足':<25} {'✓' if plan_a.inventory.all_available else '✗':<20} {'✓' if plan_b.inventory.all_available else '✗':<20}")
        
        print("\n补加量对比:")
        print(f"{'  硫酸镍 (kg)':<25} {plan_a.dosage.nickel_sulfate_to_add_kg:<20.3f} {plan_b.dosage.nickel_sulfate_to_add_kg:<20.3f}")
        print(f"{'  氯化镍 (kg)':<25} {plan_a.dosage.nickel_chloride_to_add_kg:<20.3f} {plan_b.dosage.nickel_chloride_to_add_kg:<20.3f}")
        print(f"{'  硼酸 (kg)':<25} {plan_a.dosage.boric_acid_to_add_kg:<20.3f} {plan_b.dosage.boric_acid_to_add_kg:<20.3f}")
        
        print("\n模拟结果对比:")
        print(f"{'  硫酸镍 (g/L)':<25} {plan_a.simulation.simulated_nickel_sulfate_g_l:<20.2f} {plan_b.simulation.simulated_nickel_sulfate_g_l:<20.2f}")
        print(f"{'  氯化镍 (g/L)':<25} {plan_a.simulation.simulated_nickel_chloride_g_l:<20.2f} {plan_b.simulation.simulated_nickel_chloride_g_l:<20.2f}")
        print(f"{'  硼酸 (g/L)':<25} {plan_a.simulation.simulated_boric_acid_g_l:<20.2f} {plan_b.simulation.simulated_boric_acid_g_l:<20.2f}")
        print(f"{'  pH':<25} {plan_a.simulation.simulated_ph:<20.2f} {plan_b.simulation.simulated_ph:<20.2f}")
        
        comparison = self.rule_engine.compare_plans(plan_a, plan_b)
        
        print("\n" + "=" * 60)
        print("推荐结果")
        print("=" * 60)
        
        if comparison["differences"]:
            print("\n差异分析:")
            for diff in comparison["differences"]:
                print(f"  - {diff}")
        
        if comparison["recommendation"]:
            recommended_name = (
                plan_a.plan_name if comparison["recommendation"] == "plan_a" 
                else plan_b.plan_name
            )
            print(f"\n推荐选择: {recommended_name}")
        else:
            print("\n无明确推荐，请根据实际情况选择")
    
    def _find_plan(self, context: BatchContext, identifier: str) -> Optional[SolutionPlan]:
        """通过ID或名称查找方案"""
        for plan_id, plan in context.plans.items():
            if plan_id == identifier or plan.plan_name == identifier:
                return plan
        return None
    
    def _cmd_approve(self, args):
        """放行记录命令"""
        context = self.data_store.load_batch(args.batch_id)
        if context is None:
            print(f"错误: 未找到批次 {args.batch_id}")
            return
        
        plan = self._find_plan(context, args.plan_id)
        if plan is None:
            print(f"错误: 未找到方案: {args.plan_id}")
            return
        
        status = ApprovalStatus.REJECTED if args.reject else ApprovalStatus.APPROVED
        
        approval = ApprovalRecord(
            approval_id=str(uuid.uuid4())[:8],
            batch_id=context.batch_id,
            timestamp=datetime.now(),
            operator=args.operator,
            reviewer=args.reviewer,
            selected_plan_id=plan.plan_id,
            status=status,
            actual_nickel_sulfate_added_kg=args.actual_ns,
            actual_nickel_chloride_added_kg=args.actual_nc,
            actual_boric_acid_added_kg=args.actual_ba,
            actual_sulfuric_acid_added_ml=args.actual_h2so4,
            actual_sodium_hydroxide_added_ml=args.actual_naoh,
            notes=args.notes or "",
        )
        
        context.approval = approval
        
        self.audit_logger.log_action(
            operator=args.operator,
            action="放行记录",
            details={
                "status": status.value,
                "reviewer": args.reviewer,
                "plan_id": plan.plan_id,
                "plan_name": plan.plan_name,
                "notes": args.notes,
            },
            batch_id=context.batch_id,
            plan_id=plan.plan_id,
            approval_id=approval.approval_id,
        )
        
        self.data_store.save_batch(context)
        
        print("=" * 60)
        print("放行记录已保存")
        print("=" * 60)
        print(f"批次ID: {context.batch_id}")
        print(f"放行ID: {approval.approval_id}")
        print(f"操作员: {args.operator}")
        print(f"审核人: {args.reviewer}")
        print(f"选择方案: {plan.plan_name} ({plan.plan_id})")
        print(f"状态: {status.value}")
        
        if args.notes:
            print(f"备注: {args.notes}")
        
        if status == ApprovalStatus.APPROVED:
            print("\n✓ 已放行，可执行补加操作")
        else:
            print("\n✗ 已拒绝，请重新评估方案")
    
    def _cmd_export(self, args):
        """导出报告命令"""
        context = self.data_store.load_batch(args.batch_id)
        if context is None:
            print(f"错误: 未找到批次 {args.batch_id}")
            return
        
        output_dir = Path(args.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        selected_plan: Optional[SolutionPlan] = None
        if args.plan_id:
            selected_plan = self._find_plan(context, args.plan_id)
            if selected_plan is None:
                print(f"警告: 未找到方案 {args.plan_id}，将不指定方案导出")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if args.format in ["md", "all"]:
            md_path = output_dir / f"{context.batch_id}_{timestamp}_作业单.md"
            self.md_reporter.save_work_order(md_path, context, selected_plan, context.approval)
            print(f"✓ Markdown作业单已导出: {md_path}")
        
        if args.format in ["csv", "all"]:
            csv_path = output_dir / f"{context.batch_id}_{timestamp}_批次表.csv"
            self.csv_reporter.save_batch_table(csv_path, context)
            print(f"✓ CSV批次表已导出: {csv_path}")
        
        if args.format in ["json", "all"]:
            json_path = output_dir / f"{context.batch_id}_{timestamp}_审计包.json"
            self.json_auditor.save_audit_package(json_path, context)
            print(f"✓ JSON审计包已导出: {json_path}")
        
        print(f"\n所有报告已导出到: {output_dir}")
    
    def _cmd_list(self, args):
        """列出批次命令"""
        batches = self.data_store.list_batches()
        
        if not batches:
            print("暂无批次数据")
            return
        
        print("=" * 60)
        print(f"批次列表 ({len(batches)} 个)")
        print("=" * 60)
        
        for batch_id in sorted(batches):
            context = self.data_store.load_batch(batch_id)
            if context:
                status = "已放行" if context.approval else "待处理"
                plan_count = len(context.plans)
                print(f"  {batch_id:<20} 方案: {plan_count:<5} 状态: {status}")
    
    def _cmd_show(self, args):
        """显示批次详情命令"""
        context = self.data_store.load_batch(args.batch_id)
        if context is None:
            print(f"错误: 未找到批次 {args.batch_id}")
            return
        
        print("=" * 60)
        print(f"批次详情: {context.batch_id}")
        print("=" * 60)
        
        print("\n【基本信息】")
        print(f"  创建时间: {context.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        
        if context.titration:
            print("\n【滴定数据】")
            print(f"  滴定时间: {context.titration.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  操作员: {context.titration.operator}")
            print(f"  硫酸镍EDTA体积: {context.titration.nickel_sulfate_edta_volume} mL")
            print(f"  氯化镍EDTA体积: {context.titration.nickel_chloride_edta_volume} mL")
            print(f"  硼酸滴定剂体积: {context.titration.boric_titrant_volume} mL")
            print(f"  pH值: {context.titration.ph_value}")
        
        if context.tank_record:
            print("\n【槽液记录】")
            print(f"  槽号: {context.tank_record.tank_id}")
            print(f"  体积: {context.tank_record.volume_liters} L")
            print(f"  温度: {context.tank_record.temperature_celsius} °C")
            print(f"  当前pH: {context.tank_record.current_ph}")
        
        if context.concentrations:
            print("\n【浓度分析】")
            print(f"  硫酸镍: {context.concentrations.nickel_sulfate_g_l:.2f} g/L ({context.concentrations.nickel_sulfate_status})")
            print(f"  氯化镍: {context.concentrations.nickel_chloride_g_l:.2f} g/L ({context.concentrations.nickel_chloride_status})")
            print(f"  硼酸: {context.concentrations.boric_acid_g_l:.2f} g/L ({context.concentrations.boric_acid_status})")
            print(f"  pH: {context.concentrations.ph_value:.2f} ({context.concentrations.ph_status})")
        
        if context.inventory:
            print("\n【库存数据】")
            for name, inv in context.inventory.items():
                print(f"  {name}: {inv.current_quantity_kg:.2f} kg (最低: {inv.minimum_stock_kg:.2f} kg)")
        
        if context.plans:
            print("\n【补加方案】")
            for plan_id, plan in context.plans.items():
                preferred = " ★首选" if plan.is_preferred else ""
                print(f"\n  方案: {plan.plan_name} ({plan_id}){preferred}")
                print(f"    风险等级: {plan.risks.overall_risk.value}")
                print(f"    可执行: {'✓' if plan.risks.can_proceed else '✗'}")
                print(f"    库存充足: {'✓' if plan.inventory.all_available else '✗'}")
                print(f"    硫酸镍: {plan.dosage.nickel_sulfate_to_add_kg:.3f} kg")
                print(f"    氯化镍: {plan.dosage.nickel_chloride_to_add_kg:.3f} kg")
                print(f"    硼酸: {plan.dosage.boric_acid_to_add_kg:.3f} kg")
        
        if context.approval:
            print("\n【放行记录】")
            print(f"  状态: {context.approval.status.value}")
            print(f"  操作员: {context.approval.operator}")
            print(f"  审核人: {context.approval.reviewer}")
            print(f"  选择方案ID: {context.approval.selected_plan_id}")
            if context.approval.notes:
                print(f"  备注: {context.approval.notes}")
    
    def _cmd_config(self, args):
        """配置命令"""
        if args.reset:
            self.config_manager.reset_to_default()
            print("配置已重置为默认值")
            return
        
        if args.show:
            config = self.config_manager.config
            print("=" * 60)
            print("当前配置")
            print("=" * 60)
            
            print("\n【工艺参数】")
            params = config.get("process_parameters", {})
            for key, value in params.items():
                print(f"  {key}: {value}")
            
            print("\n【风险阈值】")
            thresholds = config.get("risk_thresholds", {})
            for key, value in thresholds.items():
                print(f"  {key}: {value}")
            
            print("\n【滴定配置】")
            titration = config.get("titration", {})
            for key, value in titration.items():
                print(f"  {key}: {value}")
            
            print("\n【输出配置】")
            output = config.get("output", {})
            for key, value in output.items():
                print(f"  {key}: {value}")


def main():
    """主入口函数"""
    cli = NickelPlatingCalculatorCLI()
    cli.run()


if __name__ == "__main__":
    main()
