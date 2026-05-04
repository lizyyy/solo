from typing import List, Optional
from datetime import datetime
import json
import os

from src.experiments.experiment_manager import Experiment


class ReportExporter:
    
    @staticmethod
    def generate_markdown_report(
        experiment: Experiment,
        include_layers: bool = True,
        include_results: bool = True
    ) -> str:
        lines = []
        
        lines.append(f"# CNN 可视化实验报告\n")
        lines.append(f"**实验名称**: {experiment.name}")
        lines.append(f"**实验ID**: {experiment.experiment_id}")
        lines.append(f"**创建时间**: {experiment.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**工作流类型**: {experiment.config.workflow_type}\n")
        
        lines.append("## 1. 实验配置\n")
        lines.append(f"- **输入尺寸**: {experiment.config.input_size}")
        lines.append(f"- **类别标签**: {', '.join(experiment.config.class_labels)}")
        lines.append(f"\n")
        
        if include_layers:
            lines.append("## 2. 网络层配置\n")
            lines.append("| 层名称 | 类型 | 卷积核 | stride | padding | 输入尺寸 | 输出尺寸 | 感受野 |")
            lines.append("|--------|------|--------|--------|---------|----------|----------|--------|")
            
            if experiment.result:
                for li in experiment.result.layer_infos:
                    lines.append(
                        f"| {li.name} | {li.layer_type} | {li.config.kernel_size}x{li.config.kernel_size} | "
                        f"{li.config.stride} | {li.config.padding} | "
                        f"{li.input_size[0]}x{li.input_size[1]}x{li.input_size[2]} | "
                        f"{li.output_size[0]}x{li.output_size[1]}x{li.output_size[2]} | "
                        f"{li.receptive_field[0]}x{li.receptive_field[1]} |"
                    )
            lines.append("\n")
        
        if include_results and experiment.result:
            lines.append("## 3. 实验结果\n")
            
            if experiment.config.workflow_type == "classification" and experiment.result.classification_result:
                cr = experiment.result.classification_result
                lines.append("### 3.1 分类结果\n")
                lines.append(f"- **预测类别**: {cr.class_name} (置信度: {cr.confidence:.2%})")
                lines.append(f"\n**Top-K 预测**:")
                lines.append("| 排名 | 类别 | 置信度 |")
                lines.append("|------|------|--------|")
                for i, (name, idx, conf) in enumerate(cr.top_k, 1):
                    lines.append(f"| {i} | {name} | {conf:.2%} |")
                lines.append("\n")
            
            if experiment.config.workflow_type == "detection":
                lines.append("### 3.2 检测结果\n")
                
                if experiment.result.detection_raw_boxes:
                    lines.append(f"- **原始检测框数量**: {len(experiment.result.detection_raw_boxes)}")
                
                if experiment.result.nms_result:
                    nms = experiment.result.nms_result
                    lines.append(f"- **NMS IoU 阈值**: {nms.iou_threshold}")
                    lines.append(f"- **置信度阈值**: {nms.confidence_threshold}")
                    lines.append(f"- **保留的检测框数量**: {len(nms.kept_boxes)}")
                    lines.append(f"- **被过滤的检测框数量**: {len(nms.suppressed_boxes)}")
                    
                    if nms.kept_boxes:
                        lines.append(f"\n**保留的检测框**:")
                        lines.append("| 类别 | 置信度 | 位置 (x1,y1,x2,y2) |")
                        lines.append("|------|--------|---------------------|")
                        for box in nms.kept_boxes:
                            lines.append(f"| {box.class_name} | {box.confidence:.2%} | ({box.x1},{box.y1},{box.x2},{box.y2}) |")
                    
                    lines.append("\n")
        
        lines.append("---\n")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    @staticmethod
    def generate_comparison_report(
        experiments: List[Experiment]
    ) -> str:
        lines = []
        
        lines.append(f"# 多实验对比报告\n")
        lines.append(f"**对比实验数量**: {len(experiments)}")
        lines.append(f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        lines.append("## 1. 实验概览\n")
        lines.append("| 实验ID | 名称 | 工作流类型 | 输入尺寸 | 创建时间 |")
        lines.append("|--------|------|------------|----------|----------|")
        
        for exp in experiments:
            lines.append(
                f"| {exp.experiment_id} | {exp.name} | {exp.config.workflow_type} | "
                f"{exp.config.input_size} | {exp.created_at.strftime('%Y-%m-%d %H:%M')} |"
            )
        lines.append("\n")
        
        lines.append("## 2. 网络层对比\n")
        
        max_layers = max(len(exp.config.layers) for exp in experiments) if experiments else 0
        
        lines.append("| 层索引 | " + " | ".join([exp.name for exp in experiments]) + " |")
        lines.append("|--------|" + "|".join(["-" * (len(exp.name) + 2) for exp in experiments]) + "|")
        
        for i in range(max_layers):
            row = [f"Layer {i+1}"]
            for exp in experiments:
                if i < len(exp.config.layers):
                    layer = exp.config.layers[i]
                    row.append(f"{layer.name} (s={layer.stride}, k={layer.kernel_size})")
                else:
                    row.append("-")
            lines.append("| " + " | ".join(row) + " |")
        
        lines.append("\n")
        
        lines.append("## 3. 输出尺寸对比\n")
        
        for exp in experiments:
            lines.append(f"### {exp.name}\n")
            if exp.result:
                lines.append(f"**最终输出尺寸**: {exp.result.layer_infos[-1].output_size if exp.result.layer_infos else 'N/A'}")
                lines.append(f"**最终感受野**: {exp.result.layer_infos[-1].receptive_field if exp.result.layer_infos else 'N/A'}")
            lines.append("\n")
        
        lines.append("---\n")
        lines.append(f"*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*")
        
        return "\n".join(lines)
    
    @staticmethod
    def export_json(experiment: Experiment, file_path: Optional[str] = None) -> str:
        data = experiment.to_dict()
        json_str = json.dumps(data, indent=2, ensure_ascii=False)
        
        if file_path:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        
        return json_str
    
    @staticmethod
    def export_markdown(
        experiment: Experiment,
        file_path: Optional[str] = None,
        include_layers: bool = True,
        include_results: bool = True
    ) -> str:
        md_content = ReportExporter.generate_markdown_report(
            experiment, include_layers, include_results
        )
        
        if file_path:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(md_content)
        
        return md_content
    
    @staticmethod
    def export_comparison_markdown(
        experiments: List[Experiment],
        file_path: Optional[str] = None
    ) -> str:
        md_content = ReportExporter.generate_comparison_report(experiments)
        
        if file_path:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(md_content)
        
        return md_content
