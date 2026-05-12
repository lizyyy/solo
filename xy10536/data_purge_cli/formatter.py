import json
from typing import Any, Dict, List, Optional
from tabulate import tabulate


class Formatter:
    """输出格式化器"""
    
    @staticmethod
    def success(message: str, data: Dict[str, Any] = None) -> str:
        """格式化成功消息"""
        output = [f"✓ {message}"]
        if data:
            output.append("")
            output.append(Formatter.dict_to_table(data))
        return "\n".join(output)
    
    @staticmethod
    def error(message: str, error: str = None) -> str:
        """格式化错误消息"""
        output = [f"✗ {message}"]
        if error:
            output.append(f"  错误详情: {error}")
        return "\n".join(output)
    
    @staticmethod
    def info(message: str) -> str:
        """格式化信息消息"""
        return f"ℹ {message}"
    
    @staticmethod
    def dict_to_table(data: Dict[str, Any]) -> str:
        """将字典转换为表格"""
        rows = []
        for key, value in data.items():
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, indent=2)
            rows.append([key, str(value)])
        
        if rows:
            return tabulate(rows, headers=["字段", "值"], tablefmt="grid")
        return ""
    
    @staticmethod
    def list_to_table(items: List[Dict[str, Any]], keys: List[str] = None) -> str:
        """将列表转换为表格"""
        if not items:
            return "无数据"
        
        if keys is None:
            keys = list(items[0].keys())
        
        rows = []
        for item in items:
            row = []
            for key in keys:
                value = item.get(key, "")
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, indent=2)
                row.append(str(value))
            rows.append(row)
        
        return tabulate(rows, headers=keys, tablefmt="grid")
    
    @staticmethod
    def format_check_result(result: Dict[str, Any]) -> str:
        """格式化检查结果"""
        output = []
        
        output.append("=== 检查结果 ===")
        output.append(f"敏感样本数量: {result.get('sensitive_sample_count', 0)}")
        output.append(f"检查时间: {result.get('check_time', '')}")
        output.append(f"检查人: {result.get('checked_by', '')}")
        output.append("")
        
        affected = result.get("affected_datasets", {})
        if not affected:
            output.append("✓ 未发现受影响的数据集")
            return "\n".join(output)
        
        output.append(f"✗ 发现 {len(affected)} 个受影响的数据集:")
        output.append("")
        
        for ds_name, ds_info in affected.items():
            output.append(f"📦 数据集: {ds_name}")
            output.append(f"   已发布: {'是' if ds_info.get('is_published') else '否'}")
            output.append("")
            
            for v_info in ds_info.get("versions", []):
                output.append(f"   版本: {v_info.get('version')}")
                output.append(f"   状态: {'已发布' if v_info.get('is_published') else '未发布'}")
                output.append(f"   匹配样本数: {v_info.get('matched_count')}")
                output.append(f"   受影响标签数: {len(v_info.get('affected_labels', []))}")
                output.append(f"   匹配样本ID: {list(v_info.get('matched_samples', []))}")
                output.append("")
        
        return "\n".join(output)
    
    @staticmethod
    def format_detail(detail: Dict[str, Any]) -> str:
        """格式化详情输出"""
        if "operation" in detail:
            op = detail["operation"]
            output = ["=== 操作详情 ==="]
            output.append(f"操作ID: {op.get('id')}")
            output.append(f"类型: {op.get('type')}")
            output.append(f"状态: {op.get('status')}")
            output.append(f"创建时间: {op.get('created_at')}")
            if op.get('updated_at'):
                output.append(f"更新时间: {op.get('updated_at')}")
            output.append(f"操作人: {op.get('operator')}")
            if op.get('error'):
                output.append(f"错误: {op.get('error')}")
            return "\n".join(output)
        
        if "sensitive_samples" in detail:
            ss = detail["sensitive_samples"]
            output = ["=== 敏感样本详情 ==="]
            output.append(f"清单ID: {ss.get('id')}")
            output.append(f"导入时间: {ss.get('imported_at')}")
            output.append(f"导入人: {ss.get('imported_by')}")
            output.append(f"状态: {ss.get('status')}")
            output.append(f"原因: {ss.get('reason', 'N/A')}")
            output.append(f"样本数量: {len(ss.get('samples', []))}")
            output.append("")
            output.append("样本列表:")
            for sample in ss.get("samples", []):
                output.append(f"  - {sample.get('id') or sample.get('original_id')}")
                if sample.get("reason"):
                    output.append(f"    原因: {sample.get('reason')}")
            return "\n".join(output)
        
        if "dataset" in detail:
            ds = detail["dataset"]
            versions = detail.get("versions", {})
            
            output = ["=== 数据集详情 ==="]
            output.append(f"名称: {ds.get('name')}")
            output.append(f"描述: {ds.get('description', 'N/A')}")
            output.append(f"来源: {ds.get('source', 'N/A')}")
            output.append(f"已发布: {'是' if ds.get('is_published') else '否'}")
            output.append(f"创建时间: {ds.get('created_at', 'N/A')}")
            output.append("")
            output.append("版本列表:")
            
            for v, v_info in versions.items():
                output.append(f"  版本: {v}")
                output.append(f"    样本数: {v_info.get('sample_count', 0)}")
                output.append(f"    状态: {'已发布' if v_info.get('is_published') else '未发布'}")
                output.append(f"    导入时间: {v_info.get('imported_at', 'N/A')}")
                output.append("")
            
            return "\n".join(output)
        
        return "未找到详情"
    
    @staticmethod
    def format_report(report: Dict[str, Any]) -> str:
        """格式化报告"""
        output = []
        
        output.append("=" * 60)
        output.append("              数据剔除报告")
        output.append("=" * 60)
        output.append(f"报告ID: {report.get('report_id')}")
        output.append(f"生成时间: {report.get('generated_at')}")
        output.append(f"生成人: {report.get('generated_by')}")
        output.append("")
        
        report_type = report.get("type")
        
        if report_type == "check_report":
            output.append("类型: 检查报告")
            output.append("")
            check_op = report.get("check_operation", {})
            output.append(f"关联检查操作: {check_op.get('id')}")
            output.append(f"状态: {check_op.get('status')}")
            output.append("")
            
            affected = report.get("affected_versions", [])
            if affected:
                output.append(f"已执行剔除的版本: {len(affected)}")
                for item in affected:
                    output.append(f"  - {item['dataset']} / {item['version']}")
            else:
                output.append("尚未执行剔除操作")
        
        elif report_type == "purge_report":
            output.append("类型: 剔除报告")
            output.append("")
            details = report.get("details", {})
            
            output.append("📋 剔除详情:")
            output.append(f"  - 移除样本数: {details.get('removed_count')}")
            output.append(f"  - 操作人: {details.get('purged_by')}")
            output.append(f"  - 时间: {details.get('purged_at')}")
            output.append("")
            
            output.append("📊 受影响数据集:")
            for ds in report.get("affected_datasets", []):
                output.append(f"  数据集: {ds['name']}")
                output.append(f"  版本: {ds['version']}")
                output.append(f"  样本变化: {ds['sample_count_before']} → {ds['sample_count_after']}")
                output.append(f"  标签变化: {'是' if ds['labels_changed'] else '否'}")
                output.append(f"  需要重训: {'✓ 是' if ds['requires_retraining'] else '否'}")
                output.append("")
            
            output.append("⚠️ 业务影响:")
            output.append("  - 所有使用该数据集训练的模型需要评估")
            output.append("  - 建议重新训练以排除敏感数据影响")
            output.append("  - 请联系模型负责人安排重训计划")
        
        else:
            output.append("类型: 汇总报告")
            output.append("")
            
            output.append("📁 数据集汇总:")
            for ds in report.get("datasets", []):
                output.append(f"  数据集: {ds['name']}")
                for v in ds.get("versions", []):
                    purge_status = "✓ 已剔除" if v.get("purged") else "未剔除"
                    output.append(f"    版本 {v['version']}: {v['sample_count']} 样本, {purge_status}")
                output.append("")
            
            output.append("📜 最近操作:")
            for op in report.get("recent_operations", []):
                status_icon = "✓" if op.get("status") == "completed" else "⏳" if op.get("status") == "running" else "✗"
                output.append(f"  {status_icon} {op.get('type')} - {op.get('id')[:8]}... - {op.get('status')}")
        
        return "\n".join(output)
    
    @staticmethod
    def format_operations(operations: List[Dict[str, Any]]) -> str:
        """格式化操作列表"""
        if not operations:
            return "无操作记录"
        
        rows = []
        for op in operations:
            status = op.get("status", "")
            status_display = {
                "completed": "✓ 完成",
                "running": "⏳ 进行中",
                "failed": "✗ 失败"
            }.get(status, status)
            
            rows.append([
                op.get("id", "")[:12] + "...",
                op.get("type", ""),
                status_display,
                op.get("operator", ""),
                op.get("created_at", "")
            ])
        
        return tabulate(rows, headers=["ID", "类型", "状态", "操作人", "时间"], tablefmt="grid")
    
    @staticmethod
    def format_json(data: Any) -> str:
        """格式化为 JSON"""
        return json.dumps(data, ensure_ascii=False, indent=2)
