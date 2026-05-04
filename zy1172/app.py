import streamlit as st
import numpy as np
from PIL import Image
import pandas as pd
from typing import List, Tuple, Optional
import io
import base64

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.core.feature_map_calculator import (
    LayerConfig, LayerInfo, FeatureMapCalculator
)
from src.classification.classifier import ClassificationSimulator, ClassificationResult
from src.detection.detector import (
    Detector, AnchorConfig, BoundingBox, NMSResult
)
from src.experiments.experiment_manager import (
    ExperimentManager, Experiment, ExperimentConfig, ExperimentResult
)
from src.export.report_exporter import ReportExporter
from src.utils.visualization import Visualizer
from src.utils.validation import ParameterValidator, ValidationMessage


st.set_page_config(
    page_title="CNN 可视化实验台",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)


SAMPLE_IMAGES = {
    "棋盘格": ("checkerboard", (224, 224)),
    "渐变色": ("gradient", (224, 224)),
    "形状图案": ("shapes", (224, 224))
}

PRESET_NETWORKS = {
    "简易 CNN (分类)": {
        "workflow": "classification",
        "layers": [
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=32, name="Conv1"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool1"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=64, name="Conv2"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool2"),
            LayerConfig(layer_type="fc", out_channels=10, name="FC")
        ],
        "input_size": (224, 224, 3)
    },
    "简易目标检测": {
        "workflow": "detection",
        "layers": [
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=64, name="Conv1"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool1"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=128, name="Conv2"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool2"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=256, name="Conv3"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool3")
        ],
        "input_size": (416, 416, 3)
    },
    "VGG风格": {
        "workflow": "classification",
        "layers": [
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=64, name="Conv1_1"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=64, name="Conv1_2"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool1"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=128, name="Conv2_1"),
            LayerConfig(layer_type="conv", kernel_size=3, stride=1, padding=1, out_channels=128, name="Conv2_2"),
            LayerConfig(layer_type="pool", kernel_size=2, stride=2, padding=0, name="Pool2"),
            LayerConfig(layer_type="fc", out_channels=10, name="FC")
        ],
        "input_size": (224, 224, 3)
    }
}


def show_validation_messages(messages: List[ValidationMessage]):
    formatted = ParameterValidator.format_messages(messages)
    
    for error in formatted["errors"]:
        st.error(f"**错误**: {error['message']}\n\n{error['suggestion']}")
    
    for warning in formatted["warnings"]:
        st.warning(f"**警告**: {warning['message']}\n\n{warning['suggestion']}")


def load_image() -> Tuple[Optional[np.ndarray], Optional[str]]:
    st.subheader("📷 图像选择")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        image_source = st.radio(
            "图像来源",
            ["内置样例", "上传图像"],
            horizontal=True
        )
    
    if image_source == "内置样例":
        sample_name = st.selectbox(
            "选择样例",
            list(SAMPLE_IMAGES.keys())
        )
        pattern, size = SAMPLE_IMAGES[sample_name]
        img = Visualizer.create_sample_image(size, pattern)
        return img, sample_name
    
    else:
        uploaded_file = st.file_uploader(
            "上传图像",
            type=["png", "jpg", "jpeg", "bmp"]
        )
        if uploaded_file is not None:
            img = Image.open(uploaded_file)
            img = np.array(img.convert("RGB"))
            return img, uploaded_file.name
        return None, None


def configure_network(workflow_type: str) -> Tuple[List[LayerConfig], Tuple[int, int, int]]:
    st.subheader("🧠 网络配置")
    
    preset = st.selectbox(
        "加载预设网络",
        ["自定义"] + list(PRESET_NETWORKS.keys())
    )
    
    if preset != "自定义" and preset in PRESET_NETWORKS:
        preset_data = PRESET_NETWORKS[preset]
        layers = preset_data["layers"]
        input_size = preset_data["input_size"]
    else:
        layers = []
        input_size = (224, 224, 3)
    
    col1, col2, col3 = st.columns(3)
    with col1:
        input_h = st.number_input("输入高度", min_value=32, max_value=2048, value=input_size[0], step=32)
    with col2:
        input_w = st.number_input("输入宽度", min_value=32, max_value=2048, value=input_size[1], step=32)
    with col3:
        input_c = st.selectbox("通道数", [1, 3, 4], index=1 if input_size[2] == 3 else 0)
    
    input_size = (int(input_h), int(input_w), input_c)
    
    input_validation = ParameterValidator.validate_input_size(input_size)
    show_validation_messages(input_validation)
    
    st.markdown("---")
    st.subheader("层配置")
    
    layer_count = st.number_input(
        "网络层数",
        min_value=1,
        max_value=20,
        value=len(layers) if layers else 5,
        key="layer_count"
    )
    
    layers = []
    all_validation_messages = []
    current_size = input_size
    
    for i in range(int(layer_count)):
        st.markdown(f"**层 {i+1}**")
        col1, col2, col3, col4, col5 = st.columns([2, 1, 1, 1, 1])
        
        with col1:
            layer_type = st.selectbox(
                "类型",
                ["conv", "pool", "fc"],
                key=f"layer_type_{i}"
            )
        
        if layer_type in ["conv", "pool"]:
            with col2:
                kernel_size = st.number_input(
                    "卷积核",
                    min_value=1,
                    max_value=15,
                    value=3,
                    step=2,
                    key=f"kernel_{i}"
                )
            with col3:
                stride = st.number_input(
                    "Stride",
                    min_value=1,
                    max_value=8,
                    value=1 if layer_type == "conv" else 2,
                    key=f"stride_{i}"
                )
            with col4:
                padding = st.number_input(
                    "Padding",
                    min_value=0,
                    max_value=10,
                    value=1 if layer_type == "conv" else 0,
                    key=f"padding_{i}"
                )
            
            if layer_type == "conv":
                with col5:
                    out_channels = st.number_input(
                        "输出通道",
                        min_value=1,
                        max_value=2048,
                        value=32 * (2 ** (i // 2)) if i < 10 else 512,
                        step=16,
                        key=f"channels_{i}"
                    )
            else:
                out_channels = None
            
            layer = LayerConfig(
                layer_type=layer_type,
                kernel_size=int(kernel_size),
                stride=int(stride),
                padding=int(padding),
                out_channels=out_channels,
                name=f"{layer_type.capitalize()}_{i+1}"
            )
        else:
            with col2:
                out_channels = st.number_input(
                    "输出维度",
                    min_value=2,
                    max_value=10000,
                    value=10,
                    step=1,
                    key=f"fc_out_{i}"
                )
            
            layer = LayerConfig(
                layer_type="fc",
                out_channels=int(out_channels),
                name=f"FC_{i+1}"
            )
        
        layer_validation = ParameterValidator.validate_layer(layer, current_size, i)
        all_validation_messages.extend(layer_validation)
        
        layers.append(layer)
        
        has_error = any(m.level == "error" for m in layer_validation)
        if not has_error and layer.layer_type in ["conv", "pool"]:
            output_h = FeatureMapCalculator.calculate_output_size(
                current_size[0], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            output_w = FeatureMapCalculator.calculate_output_size(
                current_size[1], layer.kernel_size, layer.stride, layer.padding, layer.dilation
            )
            output_c = layer.out_channels if layer.out_channels is not None else current_size[2]
            current_size = (output_h, output_w, output_c)
        
        st.markdown("---")
    
    show_validation_messages(all_validation_messages)
    
    return layers, input_size


def configure_class_labels(workflow_type: str) -> List[str]:
    st.subheader("🏷️ 类别标签配置")
    
    if workflow_type == "classification":
        default_labels = ParameterValidator.DEFAULT_CLASS_LABELS
    else:
        default_labels = ParameterValidator.DEFAULT_DETECTION_LABELS
    
    label_mode = st.radio(
        "标签来源",
        ["使用默认", "自定义标签"],
        horizontal=True
    )
    
    if label_mode == "使用默认":
        st.write(f"使用默认类别: {', '.join(default_labels)}")
        return default_labels
    else:
        labels_input = st.text_area(
            "输入类别标签（每行一个）",
            value="\n".join(default_labels),
            height=200
        )
        labels = [label.strip() for label in labels_input.split("\n") if label.strip()]
        
        label_validation = ParameterValidator.validate_class_labels(labels, workflow_type)
        show_validation_messages(label_validation)
        
        return labels


def configure_detection_params() -> Tuple[AnchorConfig, float, float]:
    st.subheader("🎯 目标检测配置")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("**Anchor 配置**")
        
        ratios_input = st.text_input(
            "Anchor 宽高比 (逗号分隔)",
            value="0.5, 1.0, 2.0"
        )
        scales_input = st.text_input(
            "Anchor 尺度 (逗号分隔)",
            value="8.0, 16.0, 32.0"
        )
        base_size = st.number_input("Anchor 基础尺寸", min_value=4, max_value=64, value=16)
    
    with col2:
        st.markdown("**NMS 配置**")
        
        iou_threshold = st.slider(
            "IoU 阈值",
            min_value=0.0,
            max_value=1.0,
            value=0.5,
            step=0.05
        )
        confidence_threshold = st.slider(
            "置信度阈值",
            min_value=0.0,
            max_value=1.0,
            value=0.5,
            step=0.05
        )
    
    try:
        ratios = [float(r.strip()) for r in ratios_input.split(",")]
        scales = [float(s.strip()) for s in scales_input.split(",")]
    except ValueError:
        st.error("请输入有效的数值（使用逗号分隔）")
        ratios = [0.5, 1.0, 2.0]
        scales = [8.0, 16.0, 32.0]
    
    anchor_validation = ParameterValidator.validate_anchor_config(ratios, scales, int(base_size))
    nms_validation = ParameterValidator.validate_nms_params(iou_threshold, confidence_threshold)
    
    show_validation_messages(anchor_validation + nms_validation)
    
    anchor_config = AnchorConfig(
        ratios=ratios,
        scales=scales,
        base_size=int(base_size)
    )
    
    return anchor_config, iou_threshold, confidence_threshold


def run_experiment(
    workflow_type: str,
    layers: List[LayerConfig],
    input_size: Tuple[int, int, int],
    class_labels: List[str],
    image: np.ndarray,
    anchor_config: Optional[AnchorConfig] = None,
    iou_threshold: float = 0.5,
    confidence_threshold: float = 0.5
) -> Optional[Tuple[List[LayerInfo], Optional[ClassificationResult], Optional[List[BoundingBox]], Optional[NMSResult]]]:
    
    with st.spinner("正在计算特征图和感受野..."):
        try:
            layer_infos = FeatureMapCalculator.calculate_receptive_field(layers, input_size)
        except Exception as e:
            st.error(f"特征图计算错误: {e}")
            return None
    
    classification_result = None
    raw_boxes = None
    nms_result = None
    
    if workflow_type == "classification":
        with st.spinner("正在模拟分类推理..."):
            try:
                classifier = ClassificationSimulator(class_labels)
                final_size = layer_infos[-1].output_size
                feature_size = final_size[0] * final_size[1] * final_size[2]
                classification_result = classifier.simulate_inference(feature_size)
            except Exception as e:
                st.error(f"分类推理错误: {e}")
    
    elif workflow_type == "detection":
        with st.spinner("正在模拟检测推理..."):
            try:
                detector = Detector(class_labels)
                
                final_layer = layer_infos[-1]
                fm_size = (final_layer.output_size[0], final_layer.output_size[1])
                stride = final_layer.config.stride if final_layer.config.stride > 1 else 16
                
                img_h, img_w = image.shape[:2]
                
                raw_boxes = detector.simulate_detections(
                    fm_size, anchor_config, stride, (img_h, img_w), num_detections=15
                )
                
                nms_result = detector.nms(
                    raw_boxes, iou_threshold, confidence_threshold
                )
                
            except Exception as e:
                st.error(f"检测推理错误: {e}")
    
    return layer_infos, classification_result, raw_boxes, nms_result


def display_layer_info(layer_infos: List[LayerInfo]):
    st.subheader("📊 层信息概览")
    
    df_data = []
    for li in layer_infos:
        df_data.append({
            "层名称": li.name,
            "类型": li.layer_type,
            "卷积核": f"{li.config.kernel_size}x{li.config.kernel_size}",
            "Stride": li.config.stride,
            "Padding": li.config.padding,
            "输入尺寸": f"{li.input_size[0]}x{li.input_size[1]}x{li.input_size[2]}",
            "输出尺寸": f"{li.output_size[0]}x{li.output_size[1]}x{li.output_size[2]}",
            "感受野": f"{li.receptive_field[0]}x{li.receptive_field[1]}"
        })
    
    df = pd.DataFrame(df_data)
    st.dataframe(df, use_container_width=True)
    
    st.subheader("📈 特征图与感受野变化图")
    chart_img = Visualizer.plot_layer_info_chart(layer_infos)
    st.image(chart_img, use_container_width=True)


def display_classification_result(result: ClassificationResult):
    st.subheader("🗂️ 分类结果")
    
    col1, col2 = st.columns([1, 2])
    
    with col1:
        st.metric(
            "预测类别",
            result.class_name,
            f"置信度: {result.confidence:.2%}"
        )
    
    with col2:
        st.markdown("**Top-K 预测**")
        top_k_data = []
        for i, (name, idx, conf) in enumerate(result.top_k, 1):
            top_k_data.append({
                "排名": i,
                "类别": name,
                "置信度": f"{conf:.2%}"
            })
        df = pd.DataFrame(top_k_data)
        st.dataframe(df, use_container_width=True)


def display_detection_result(
    image: np.ndarray,
    raw_boxes: List[BoundingBox],
    nms_result: NMSResult,
    layer_infos: List[LayerInfo]
):
    st.subheader("🎯 检测结果")
    
    tab1, tab2, tab3, tab4 = st.tabs(["原始检测框", "NMS 后结果", "被过滤的框", "特征图网格"])
    
    with tab1:
        st.markdown(f"**原始检测框数量**: {len(raw_boxes)}")
        raw_img = Visualizer.draw_bounding_boxes(
            image.copy(), raw_boxes, color=(0, 0, 255)
        )
        st.image(raw_img, caption="原始检测框（蓝色）", use_container_width=True)
        
        if raw_boxes:
            df_data = []
            for i, box in enumerate(raw_boxes):
                df_data.append({
                    "ID": i,
                    "类别": box.class_name,
                    "置信度": f"{box.confidence:.2%}",
                    "位置": f"({box.x1},{box.y1})-({box.x2},{box.y2})",
                    "特征图位置": f"({box.feature_map_y},{box.feature_map_x})"
                })
            st.dataframe(pd.DataFrame(df_data), use_container_width=True)
    
    with tab2:
        st.markdown(f"**NMS 后保留的检测框数量**: {len(nms_result.kept_boxes)}")
        st.markdown(f"- **IoU 阈值**: {nms_result.iou_threshold}")
        st.markdown(f"- **置信度阈值**: {nms_result.confidence_threshold}")
        
        nms_img = Visualizer.draw_bounding_boxes(
            image.copy(), nms_result.kept_boxes, color=(0, 255, 0)
        )
        st.image(nms_img, caption="NMS 后保留的检测框（绿色）", use_container_width=True)
        
        if nms_result.kept_boxes:
            df_data = []
            for i, box in enumerate(nms_result.kept_boxes):
                df_data.append({
                    "ID": i,
                    "类别": box.class_name,
                    "置信度": f"{box.confidence:.2%}",
                    "位置": f"({box.x1},{box.y1})-({box.x2},{box.y2})"
                })
            st.dataframe(pd.DataFrame(df_data), use_container_width=True)
    
    with tab3:
        st.markdown(f"**被过滤的检测框数量**: {len(nms_result.suppressed_boxes)}")
        
        if nms_result.suppressed_boxes:
            suppressed_boxes = [box for box, _ in nms_result.suppressed_boxes]
            suppressed_img = Visualizer.draw_bounding_boxes(
                image.copy(), suppressed_boxes, color=(255, 165, 0)
            )
            st.image(suppressed_img, caption="被过滤的检测框（橙色）", use_container_width=True)
            
            df_data = []
            for i, (box, reason) in enumerate(nms_result.suppressed_boxes):
                df_data.append({
                    "ID": i,
                    "类别": box.class_name,
                    "置信度": f"{box.confidence:.2%}",
                    "过滤原因": reason
                })
            st.dataframe(pd.DataFrame(df_data), use_container_width=True)
    
    with tab4:
        final_layer = layer_infos[-1]
        fm_size = (final_layer.output_size[0], final_layer.output_size[1])
        stride = final_layer.config.stride if final_layer.config.stride > 1 else 16
        img_h, img_w = image.shape[:2]
        
        st.markdown(f"**特征图尺寸**: {fm_size[1]}x{fm_size[0]}")
        st.markdown(f"**Stride**: {stride}")
        
        highlight_positions = []
        if nms_result.kept_boxes:
            highlight_positions = [
                (box.feature_map_y, box.feature_map_x)
                for box in nms_result.kept_boxes
            ]
        
        grid_img = Visualizer.draw_feature_map_grid(
            fm_size, stride, (img_h, img_w),
            highlight_positions=highlight_positions if highlight_positions else None
        )
        st.image(grid_img, caption="特征图网格（红色点为检测框对应的特征图位置）", use_container_width=True)


def display_receptive_field_visualizer(image: np.ndarray, layer_infos: List[LayerInfo]):
    st.subheader("👁️ 感受野可视化")
    
    layer_names = [li.name for li in layer_infos]
    selected_layer_idx = st.selectbox(
        "选择层",
        range(len(layer_names)),
        format_func=lambda i: f"{layer_names[i]} (感受野: {layer_infos[i].receptive_field[0]}x{layer_infos[i].receptive_field[1]})"
    )
    
    selected_layer = layer_infos[selected_layer_idx]
    fm_h, fm_w = selected_layer.output_size[0], selected_layer.output_size[1]
    
    col1, col2 = st.columns(2)
    with col1:
        feature_y = st.number_input(
            "特征图 Y 坐标",
            min_value=0,
            max_value=fm_h - 1,
            value=fm_h // 2
        )
    with col2:
        feature_x = st.number_input(
            "特征图 X 坐标",
            min_value=0,
            max_value=fm_w - 1,
            value=fm_w // 2
        )
    
    top_left, bottom_right = FeatureMapCalculator.get_feature_map_position(
        selected_layer, int(feature_y), int(feature_x)
    )
    
    rf_img = Visualizer.draw_receptive_field(
        image.copy(),
        top_left, bottom_right,
        color=(255, 0, 0)
    )
    
    st.image(rf_img, caption=f"感受野位置: ({top_left[0]},{top_left[1]}) - ({bottom_right[0]},{bottom_right[1]})", use_container_width=True)
    
    st.info(f"""
    **层信息**: {selected_layer.name}
    - **感受野大小**: {selected_layer.receptive_field[0]}x{selected_layer.receptive_field[1]}
    - **特征图尺寸**: {fm_w}x{fm_h}
    - **当前特征点位置**: ({feature_y}, {feature_x})
    - **对应原图区域**: 行 {top_left[0]} 到 {bottom_right[0]}, 列 {top_left[1]} 到 {bottom_right[1]}
    """)


def manage_experiments(
    experiment_manager: ExperimentManager,
    exp_config: Optional[ExperimentConfig] = None,
    exp_result: Optional[ExperimentResult] = None
):
    st.sidebar.subheader("📁 实验管理")
    
    action = st.sidebar.radio(
        "操作",
        ["保存当前实验", "查看历史实验", "对比实验"],
        horizontal=True
    )
    
    if action == "保存当前实验":
        if exp_config is None:
            st.sidebar.warning("请先运行实验后再保存")
        else:
            exp_name = st.sidebar.text_input("实验名称", value=exp_config.experiment_name)
            
            if st.sidebar.button("保存实验"):
                experiment = experiment_manager.create_experiment(exp_config, exp_name)
                if exp_result:
                    experiment_manager.save_result(experiment.experiment_id, exp_result)
                st.sidebar.success(f"实验已保存: {experiment.experiment_id}")
    
    elif action == "查看历史实验":
        experiments = experiment_manager.list_experiments()
        
        if not experiments:
            st.sidebar.info("暂无保存的实验")
        else:
            selected_exp = st.sidebar.selectbox(
                "选择实验",
                experiments,
                format_func=lambda e: f"{e.name} ({e.experiment_id})"
            )
            
            if selected_exp:
                st.sidebar.write(f"**创建时间**: {selected_exp.created_at.strftime('%Y-%m-%d %H:%M')}")
                st.sidebar.write(f"**工作流**: {selected_exp.config.workflow_type}")
                st.sidebar.write(f"**层数**: {len(selected_exp.config.layers)}")
                
                if st.sidebar.button("删除此实验"):
                    experiment_manager.delete_experiment(selected_exp.experiment_id)
                    st.sidebar.success("实验已删除")
                    st.rerun()
    
    elif action == "对比实验":
        experiments = experiment_manager.list_experiments()
        
        if len(experiments) < 2:
            st.sidebar.info("需要至少 2 个保存的实验才能对比")
        else:
            selected_ids = st.sidebar.multiselect(
                "选择要对比的实验",
                [e.experiment_id for e in experiments],
                format_func=lambda eid: next((e.name for e in experiments if e.experiment_id == eid), eid),
                max_selections=5
            )
            
            if len(selected_ids) >= 2:
                comparison_experiments = experiment_manager.compare_experiments(selected_ids)
                
                st.subheader("📊 实验对比")
                
                df_data = []
                for exp in comparison_experiments:
                    df_data.append({
                        "实验名称": exp.name,
                        "ID": exp.experiment_id,
                        "工作流": exp.config.workflow_type,
                        "层数": len(exp.config.layers),
                        "输入尺寸": f"{exp.config.input_size[0]}x{exp.config.input_size[1]}",
                        "创建时间": exp.created_at.strftime('%Y-%m-%d %H:%M')
                    })
                st.dataframe(pd.DataFrame(df_data), use_container_width=True)
                
                if st.button("导出对比报告 (Markdown)"):
                    md_report = ReportExporter.export_comparison_markdown(comparison_experiments)
                    st.download_button(
                        "下载对比报告",
                        md_report,
                        file_name=f"comparison_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                        mime="text/markdown"
                    )


def export_reports(experiment: Optional[Experiment] = None, exp_result: Optional[ExperimentResult] = None):
    st.sidebar.subheader("📤 导出报告")
    
    if experiment is None and exp_result is None:
        st.sidebar.warning("请先运行实验")
        return
    
    report_type = st.sidebar.radio("报告格式", ["Markdown", "JSON"], horizontal=True)
    
    col1, col2 = st.sidebar.columns(2)
    with col1:
        include_layers = st.checkbox("包含层信息", value=True)
    with col2:
        include_results = st.checkbox("包含结果", value=True)
    
    if st.sidebar.button("生成报告"):
        if report_type == "Markdown":
            if experiment:
                md_report = ReportExporter.export_markdown(
                    experiment, include_layers=include_layers, include_results=include_results
                )
            else:
                st.sidebar.warning("需要保存的实验才能生成完整报告")
                return
            
            st.download_button(
                "下载 Markdown 报告",
                md_report,
                file_name=f"cnn_experiment_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md",
                mime="text/markdown"
            )
        else:
            if experiment:
                json_report = ReportExporter.export_json(experiment)
            else:
                st.sidebar.warning("需要保存的实验才能导出 JSON")
                return
            
            st.download_button(
                "下载 JSON 报告",
                json_report,
                file_name=f"cnn_experiment_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )


def main():
    st.title("🧠 CNN 可视化实验台")
    st.markdown("""
    这是一个用于学习计算机视觉的交互式 CNN 可视化工具。你可以：
    - 上传图片或使用内置样例
    - 配置卷积层、池化层等网络结构
    - 查看特征图尺寸和感受野变化
    - 在图像分类和目标检测两种工作流之间切换
    - 保存和对比多次实验
    """)
    
    if 'experiment_manager' not in st.session_state:
        st.session_state.experiment_manager = ExperimentManager()
    
    experiment_manager = st.session_state.experiment_manager
    
    with st.sidebar:
        st.header("⚙️ 主配置")
        
        workflow_type = st.radio(
            "工作流类型",
            ["classification", "detection"],
            format_func=lambda x: "图像分类" if x == "classification" else "目标检测",
            horizontal=True
        )
    
    tab1, tab2, tab3 = st.tabs(["📐 配置", "🔬 实验", "📊 结果"])
    
    with tab1:
        col1, col2 = st.columns([1, 1])
        
        with col1:
            image, image_name = load_image()
            if image is not None:
                st.image(image, caption=f"当前图像: {image_name}", use_container_width=True)
        
        with col2:
            layers, input_size = configure_network(workflow_type)
        
        st.markdown("---")
        
        col3, col4 = st.columns([1, 1])
        
        with col3:
            class_labels = configure_class_labels(workflow_type)
        
        with col4:
            if workflow_type == "detection":
                anchor_config, iou_threshold, confidence_threshold = configure_detection_params()
            else:
                anchor_config = None
                iou_threshold = 0.5
                confidence_threshold = 0.5
    
    with tab2:
        if image is None:
            st.warning("请先选择或上传图像")
        else:
            run_button = st.button("▶️ 运行实验", type="primary", use_container_width=True)
            
            if run_button or 'last_result' in st.session_state:
                if run_button:
                    result = run_experiment(
                        workflow_type, layers, input_size, class_labels,
                        image, anchor_config, iou_threshold, confidence_threshold
                    )
                    
                    if result:
                        layer_infos, classification_result, raw_boxes, nms_result = result
                        st.session_state.last_result = {
                            'layer_infos': layer_infos,
                            'classification_result': classification_result,
                            'raw_boxes': raw_boxes,
                            'nms_result': nms_result,
                            'workflow_type': workflow_type,
                            'layers': layers,
                            'input_size': input_size,
                            'class_labels': class_labels,
                            'image': image,
                            'anchor_config': anchor_config,
                            'iou_threshold': iou_threshold,
                            'confidence_threshold': confidence_threshold
                        }
                        st.success("实验运行完成！")
                
                if 'last_result' in st.session_state:
                    res = st.session_state.last_result
                    
                    st.subheader("✅ 实验已运行")
                    
                    col_info1, col_info2, col_info3 = st.columns(3)
                    with col_info1:
                        st.metric("工作流", "分类" if res['workflow_type'] == "classification" else "检测")
                    with col_info2:
                        st.metric("网络层数", len(res['layers']))
                    with col_info3:
                        st.metric("最终感受野", f"{res['layer_infos'][-1].receptive_field[0]}x{res['layer_infos'][-1].receptive_field[1]}")
                    
                    exp_config = ExperimentConfig(
                        experiment_name=f"Experiment_{datetime.now().strftime('%Y%m%d_%H%M')}",
                        workflow_type=res['workflow_type'],
                        input_size=res['input_size'],
                        class_labels=res['class_labels'],
                        layers=res['layers'],
                        anchor_config=res['anchor_config'],
                        nms_iou_threshold=res['iou_threshold'],
                        nms_confidence_threshold=res['confidence_threshold']
                    )
                    
                    exp_result = ExperimentResult(
                        layer_infos=res['layer_infos'],
                        classification_result=res['classification_result'],
                        detection_raw_boxes=res['raw_boxes'],
                        nms_result=res['nms_result']
                    )
                    
                    experiment = experiment_manager.create_experiment(exp_config)
                    experiment_manager.save_result(experiment.experiment_id, exp_result)
                    
                    manage_experiments(experiment_manager, exp_config, exp_result)
                    export_reports(experiment, exp_result)
    
    with tab3:
        if 'last_result' not in st.session_state:
            st.info("请先在「实验」标签页运行实验")
        else:
            res = st.session_state.last_result
            
            display_layer_info(res['layer_infos'])
            
            st.markdown("---")
            
            if res['workflow_type'] == "classification" and res['classification_result']:
                display_classification_result(res['classification_result'])
            elif res['workflow_type'] == "detection":
                if res['raw_boxes'] and res['nms_result']:
                    display_detection_result(
                        res['image'], res['raw_boxes'], res['nms_result'], res['layer_infos']
                    )
            
            st.markdown("---")
            display_receptive_field_visualizer(res['image'], res['layer_infos'])


if __name__ == "__main__":
    main()
