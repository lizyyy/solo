"""
导出器模块
- 导出 Markdown 选题看板
- 导出 JSON 明细
- 包含重复簇、主题组、素材状态、来源路径
"""

from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

from .reader import MaterialItem
from .clusterer import (
    ProcessingResult,
    TopicGroup,
    DuplicateCluster
)
from .state_manager import (
    StateManager,
    MaterialStatus,
    MaterialStateRecord
)


class JSONExporter:
    """
    JSON 明细导出器
    """
    
    def __init__(
        self,
        processing_result: ProcessingResult,
        state_manager: StateManager,
        source_dir: str = "",
        output_dir: str = ""
    ):
        """
        初始化 JSON 导出器
        
        Args:
            processing_result: 处理结果
            state_manager: 状态管理器
            source_dir: 源目录
            output_dir: 输出目录
        """
        self.result = processing_result
        self.state_manager = state_manager
        self.source_dir = source_dir
        self.output_dir = output_dir
    
    def export(self) -> Dict[str, Any]:
        """
        导出完整的 JSON 数据
        
        Returns:
            Dict[str, Any]: 完整的数据结构
        """
        now = datetime.now().isoformat()
        
        return {
            "metadata": {
                "generated_at": now,
                "source_directory": self.source_dir,
                "output_directory": self.output_dir,
                "version": "1.0"
            },
            "statistics": self._get_statistics(),
            "topics": self._get_topics(),
            "duplicate_clusters": self._get_duplicate_clusters(),
            "materials": self._get_materials(),
            "state_summary": self.state_manager.get_statistics()
        }
    
    def _get_statistics(self) -> Dict[str, Any]:
        """
        获取统计信息
        """
        total_items = len(self.result.all_items)
        total_topics = len(self.result.topic_groups)
        total_duplicate_clusters = len(self.result.duplicate_clusters)
        
        items_in_duplicates = set()
        for cluster in self.result.duplicate_clusters:
            items_in_duplicates.update(cluster.item_ids)
        
        return {
            "total_materials": total_items,
            "total_topics": total_topics,
            "total_duplicate_clusters": total_duplicate_clusters,
            "materials_in_duplicates": len(items_in_duplicates),
            "ungrouped_materials": len(self.result.ungrouped_item_ids)
        }
    
    def _get_topics(self) -> List[Dict[str, Any]]:
        """
        获取主题组数据
        """
        topics = []
        
        for topic in self.result.topic_groups:
            representative = self.result.get_item(topic.representative_id)
            
            topic_data = {
                "topic_id": topic.topic_id,
                "topic_name": topic.topic_name,
                "keywords": topic.keywords,
                "size": topic.size,
                "representative": {
                    "id": topic.representative_id,
                    "text": representative.text if representative else "",
                    "source_file": representative.source_file if representative else "",
                    "line_number": representative.line_number if representative else 0,
                },
                "materials": topic.item_ids,
                "duplicate_clusters": [
                    {
                        "cluster_id": cluster.cluster_id,
                        "keywords": cluster.keywords,
                        "size": cluster.size,
                        "materials": cluster.item_ids
                    }
                    for cluster in topic.duplicate_clusters
                ]
            }
            
            topics.append(topic_data)
        
        return topics
    
    def _get_duplicate_clusters(self) -> List[Dict[str, Any]]:
        """
        获取重复簇数据（全局）
        """
        clusters = []
        
        for cluster in self.result.duplicate_clusters:
            representative = self.result.get_item(cluster.representative_id)
            
            cluster_data = {
                "cluster_id": cluster.cluster_id,
                "keywords": cluster.keywords,
                "size": cluster.size,
                "representative": {
                    "id": cluster.representative_id,
                    "text": representative.text if representative else "",
                    "source_file": representative.source_file if representative else "",
                    "line_number": representative.line_number if representative else 0,
                },
                "materials": cluster.item_ids
            }
            
            clusters.append(cluster_data)
        
        return clusters
    
    def _get_materials(self) -> Dict[str, Any]:
        """
        获取所有素材的详细数据
        """
        materials = {}
        
        for item_id, item in self.result.all_items.items():
            state_record = self.state_manager.get_record(item_id)
            status = self.state_manager.get_status(item_id)
            
            topic = self.result.get_topic_for_item(item_id)
            dup_cluster = self.result.get_duplicate_cluster_for_item(item_id)
            
            material_data = {
                "id": item_id,
                "text": item.text,
                "clean_text": item.clean_text,
                "source_file": item.source_file,
                "line_number": item.line_number,
                "status": status.value,
                "status_display": MaterialStatus.get_display_name(status),
                "topic": {
                    "topic_id": topic.topic_id if topic else None,
                    "topic_name": topic.topic_name if topic else None,
                },
                "duplicate_cluster": {
                    "cluster_id": dup_cluster.cluster_id if dup_cluster else None,
                    "keywords": dup_cluster.keywords if dup_cluster else [],
                },
                "record": {
                    "created_at": state_record.created_at if state_record else "",
                    "updated_at": state_record.updated_at if state_record else "",
                    "notes": state_record.notes if state_record else "",
                }
            }
            
            materials[item_id] = material_data
        
        return materials
    
    def save_to_file(self, file_path: str) -> str:
        """
        保存到 JSON 文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: 保存的文件路径
        """
        import json
        
        path = Path(file_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        
        data = self.export()
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(path)


class MarkdownExporter:
    """
    Markdown 选题看板导出器
    """
    
    def __init__(
        self,
        processing_result: ProcessingResult,
        state_manager: StateManager,
        source_dir: str = "",
        output_dir: str = ""
    ):
        """
        初始化 Markdown 导出器
        
        Args:
            processing_result: 处理结果
            state_manager: 状态管理器
            source_dir: 源目录
            output_dir: 输出目录
        """
        self.result = processing_result
        self.state_manager = state_manager
        self.source_dir = source_dir
        self.output_dir = output_dir
    
    def _get_status_badge(self, status: MaterialStatus) -> str:
        """
        获取状态徽章样式
        """
        badges = {
            MaterialStatus.PENDING: "📌 待写",
            MaterialStatus.USED: "✅ 已用",
            MaterialStatus.SHELVED: "⏸️ 先搁置",
            MaterialStatus.UNSET: "❓ 未设置",
        }
        return badges.get(status, "❓ 未设置")
    
    def _truncate_text(self, text: str, max_length: int = 80) -> str:
        """
        截断文本
        """
        if len(text) <= max_length:
            return text
        return text[:max_length] + "..."
    
    def export(self) -> str:
        """
        导出 Markdown 内容
        
        Returns:
            str: Markdown 内容
        """
        lines = []
        
        lines.append("# 选题素材看板")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"> 素材来源: {self.source_dir or '未知'}")
        lines.append("")
        
        lines.append("## 📊 概览统计")
        lines.append("")
        
        stats = self._get_overview_stats()
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总素材数 | {stats['total']} |")
        lines.append(f"| 主题组数 | {stats['topics']} |")
        lines.append(f"| 重复簇数 | {stats['duplicates']} |")
        lines.append(f"| 待写 | {stats['pending']} |")
        lines.append(f"| 已用 | {stats['used']} |")
        lines.append(f"| 先搁置 | {stats['shelved']} |")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 📝 按主题分组")
        lines.append("")
        
        for topic_idx, topic in enumerate(self.result.topic_groups):
            lines.append(f"### 主题 {topic_idx + 1}: {topic.topic_name}")
            lines.append("")
            
            lines.append(f"**关键词**: {', '.join(topic.keywords) if topic.keywords else '无'}")
            lines.append(f"**素材数量**: {topic.size}")
            lines.append("")
            
            if topic.duplicate_clusters:
                lines.append("#### 🔄 重复簇")
                lines.append("")
                
                for dup_idx, dup_cluster in enumerate(topic.duplicate_clusters):
                    lines.append(f"##### 重复簇 {dup_idx + 1}")
                    lines.append("")
                    lines.append(f"**关键词**: {', '.join(dup_cluster.keywords) if dup_cluster.keywords else '无'}")
                    lines.append(f"**数量**: {dup_cluster.size}")
                    lines.append("")
                    
                    rep_item = self.result.get_item(dup_cluster.representative_id)
                    if rep_item:
                        status = self.state_manager.get_status(dup_cluster.representative_id)
                        lines.append(f"**代表素材** [{self._get_status_badge(status)}]:")
                        lines.append(f"> {rep_item.text}")
                        lines.append(f"> 来源: `{rep_item.source_file}:{rep_item.line_number}`")
                        lines.append("")
                    
                    lines.append("| 状态 | 素材内容 | 来源 |")
                    lines.append("|------|----------|------|")
                    
                    for item_id in dup_cluster.item_ids:
                        item = self.result.get_item(item_id)
                        if item:
                            status = self.state_manager.get_status(item_id)
                            truncated = self._truncate_text(item.text, 50)
                            lines.append(f"| {self._get_status_badge(status)} | {truncated} | `{item.source_file}:{item.line_number}` |")
                    
                    lines.append("")
            
            non_dup_item_ids = [
                item_id for item_id in topic.item_ids
                if item_id not in self.result.item_to_duplicate
            ]
            
            if non_dup_item_ids:
                lines.append("#### 📋 独立素材")
                lines.append("")
                lines.append("| 状态 | 素材内容 | 来源 |")
                lines.append("|------|----------|------|")
                
                for item_id in non_dup_item_ids:
                    item = self.result.get_item(item_id)
                    if item:
                        status = self.state_manager.get_status(item_id)
                        truncated = self._truncate_text(item.text, 50)
                        lines.append(f"| {self._get_status_badge(status)} | {truncated} | `{item.source_file}:{item.line_number}` |")
                
                lines.append("")
        
        if self.result.ungrouped_item_ids:
            lines.append("---")
            lines.append("")
            lines.append("## 🔮 未分组素材")
            lines.append("")
            lines.append("| 状态 | 素材内容 | 来源 |")
            lines.append("|------|----------|------|")
            
            for item_id in self.result.ungrouped_item_ids:
                item = self.result.get_item(item_id)
                if item:
                    status = self.state_manager.get_status(item_id)
                    truncated = self._truncate_text(item.text, 50)
                    lines.append(f"| {self._get_status_badge(status)} | {truncated} | `{item.source_file}:{item.line_number}` |")
            
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📌 按状态分类")
        lines.append("")
        
        for status in [MaterialStatus.PENDING, MaterialStatus.USED, MaterialStatus.SHELVED, MaterialStatus.UNSET]:
            item_ids = self.state_manager.get_items_by_status(status)
            
            current_item_ids = [
                iid for iid in item_ids
                if iid in self.result.all_items
            ]
            
            if current_item_ids:
                lines.append(f"### {self._get_status_badge(status)} ({len(current_item_ids)}个)")
                lines.append("")
                
                lines.append("| 素材内容 | 主题 | 来源 |")
                lines.append("|----------|------|------|")
                
                for item_id in current_item_ids:
                    item = self.result.get_item(item_id)
                    if item:
                        topic = self.result.get_topic_for_item(item_id)
                        topic_name = topic.topic_name if topic else "未分组"
                        truncated = self._truncate_text(item.text, 50)
                        lines.append(f"| {truncated} | {topic_name} | `{item.source_file}:{item.line_number}` |")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📖 使用说明")
        lines.append("")
        lines.append("### 状态标记")
        lines.append("")
        lines.append("- `📌 待写`: 准备撰写的选题")
        lines.append("- `✅ 已用`: 已经使用过的选题")
        lines.append("- `⏸️ 先搁置`: 暂时搁置的选题")
        lines.append("- `❓ 未设置`: 还没有标记状态")
        lines.append("")
        lines.append("### 如何更新状态")
        lines.append("")
        lines.append("使用命令行工具更新素材状态:")
        lines.append("```bash")
        lines.append("# 标记为待写")
        lines.append("content-dedup status --id <素材ID> --status pending")
        lines.append("")
        lines.append("# 标记为已用")
        lines.append("content-dedup status --id <素材ID> --status used")
        lines.append("")
        lines.append("# 标记为先搁置")
        lines.append("content-dedup status --id <素材ID> --status shelved")
        lines.append("```")
        lines.append("")
        
        return "\n".join(lines)
    
    def _get_overview_stats(self) -> Dict[str, int]:
        """
        获取概览统计
        """
        state_stats = self.state_manager.get_statistics()
        
        return {
            "total": len(self.result.all_items),
            "topics": len(self.result.topic_groups),
            "duplicates": len(self.result.duplicate_clusters),
            "pending": state_stats["by_status"].get("pending", 0),
            "used": state_stats["by_status"].get("used", 0),
            "shelved": state_stats["by_status"].get("shelved", 0),
            "unset": state_stats["by_status"].get("unset", 0),
        }
    
    def save_to_file(self, file_path: str) -> str:
        """
        保存到 Markdown 文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            str: 保存的文件路径
        """
        path = Path(file_path).resolve()
        path.parent.mkdir(parents=True, exist_ok=True)
        
        content = self.export()
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return str(path)


def export_all(
    processing_result: ProcessingResult,
    state_manager: StateManager,
    output_dir: str,
    source_dir: str = "",
    json_filename: str = "materials_detail.json",
    md_filename: str = "topics_board.md"
) -> Dict[str, str]:
    """
    便捷函数：导出所有格式
    
    Args:
        processing_result: 处理结果
        state_manager: 状态管理器
        output_dir: 输出目录
        source_dir: 源目录
        json_filename: JSON 文件名
        md_filename: Markdown 文件名
        
    Returns:
        Dict[str, str]: 导出的文件路径映射
    """
    output_path = Path(output_dir).resolve()
    
    json_path = output_path / json_filename
    md_path = output_path / md_filename
    
    json_exporter = JSONExporter(
        processing_result=processing_result,
        state_manager=state_manager,
        source_dir=source_dir,
        output_dir=str(output_path)
    )
    
    md_exporter = MarkdownExporter(
        processing_result=processing_result,
        state_manager=state_manager,
        source_dir=source_dir,
        output_dir=str(output_path)
    )
    
    json_file = json_exporter.save_to_file(str(json_path))
    md_file = md_exporter.save_to_file(str(md_path))
    
    return {
        "json": json_file,
        "markdown": md_file
    }
