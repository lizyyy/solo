import streamlit as st
import pandas as pd
import os
import sys
from datetime import datetime
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from src.parser import DataParser
from src.analyzer import RiskAnalyzer
from src.storage import ReviewStorage
from src.exporter import DataExporter
from src.utils import format_datetime, format_timedelta


st.set_page_config(
    page_title="咖啡机清洁断点追踪台",
    page_icon="☕",
    layout="wide",
    initial_sidebar_state="expanded"
)


def init_session_state():
    if 'parser' not in st.session_state:
        st.session_state.parser = DataParser()
    if 'analyzer' not in st.session_state:
        st.session_state.analyzer = RiskAnalyzer()
    if 'storage' not in st.session_state:
        st.session_state.storage = ReviewStorage()
    if 'exporter' not in st.session_state:
        st.session_state.exporter = DataExporter()
    if 'risks' not in st.session_state:
        st.session_state.risks = []
    if 'merged_risks' not in st.session_state:
        st.session_state.merged_risks = []
    if 'data_loaded' not in st.session_state:
        st.session_state.data_loaded = False
    if 'session_info' not in st.session_state:
        st.session_state.session_info = None


def load_sample_data():
    parser = st.session_state.parser
    sample_data = parser.load_sample_data()
    
    if sample_data:
        st.session_state.data_loaded = True
        analyze_data()
        return True
    return False


def analyze_data():
    parser = st.session_state.parser
    analyzer = st.session_state.analyzer
    storage = st.session_state.storage
    
    analyzer.set_data(
        cleaning_records=parser.cleaning_records,
        work_orders=parser.work_orders,
        volume_records=parser.volume_records
    )
    
    risks = analyzer.analyze_all()
    st.session_state.risks = risks
    
    merged_risks = storage.merge_risks_with_reviews(risks)
    st.session_state.merged_risks = merged_risks


def get_risk_type_name(risk_type: str) -> str:
    type_map = {
        "late_cleaning": "超时未清洁",
        "unclosed_workorder": "工单未闭环",
        "abnormal_volume": "出杯异常",
        "backfill_suspect": "补填嫌疑"
    }
    return type_map.get(risk_type, risk_type)


def get_risk_level_color(risk_level: str) -> str:
    color_map = {
        "critical": "#FF4B4B",
        "high": "#FF9B4B",
        "medium": "#FFD94B",
        "low": "#4BFF9B"
    }
    return color_map.get(risk_level, "#808080")


def main():
    init_session_state()
    
    st.title("☕ 咖啡机清洁断点追踪台")
    st.markdown("---")
    
    with st.sidebar:
        st.header("📥 数据导入")
        
        data_option = st.radio(
            "选择数据来源",
            ["使用示例数据", "上传数据文件"]
        )
        
        if data_option == "使用示例数据":
            if st.button("加载示例数据", type="primary"):
                with st.spinner("正在加载示例数据..."):
                    if load_sample_data():
                        st.success("示例数据加载成功！")
                    else:
                        st.error("示例数据加载失败")
        
        else:
            col1, col2 = st.columns(2)
            with col1:
                cleaning_file = st.file_uploader("清洁记录 CSV", type=["csv"])
            with col2:
                workorder_file = st.file_uploader("维修工单 JSON", type=["json"])
            
            volume_file = st.file_uploader("出杯量 CSV", type=["csv"])
            
            if st.button("解析并分析", type="primary"):
                parser = st.session_state.parser
                success_count = 0
                
                with st.spinner("正在解析数据..."):
                    if cleaning_file:
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
                            tmp.write(cleaning_file.getvalue())
                            tmp_path = tmp.name
                        parser.parse_cleaning_csv(tmp_path)
                        success_count += 1
                    
                    if workorder_file:
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
                            tmp.write(workorder_file.getvalue())
                            tmp_path = tmp.name
                        parser.parse_workorder_json(tmp_path)
                        success_count += 1
                    
                    if volume_file:
                        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
                            tmp.write(volume_file.getvalue())
                            tmp_path = tmp.name
                        parser.parse_volume_csv(tmp_path)
                        success_count += 1
                
                if success_count > 0:
                    st.session_state.data_loaded = True
                    analyze_data()
                    st.success(f"成功解析 {success_count} 个文件！")
                else:
                    st.warning("请至少上传一个文件")
        
        st.markdown("---")
        st.header("⚙️ 筛选条件")
        
        if st.session_state.merged_risks:
            risks = st.session_state.merged_risks
            
            stores = sorted(list(set([r.get("store_name") for r in risks])))
            selected_store = st.selectbox("选择门店", ["全部"] + stores)
            
            machines = sorted(list(set([r.get("machine_id") for r in risks 
                                       if selected_store == "全部" or r.get("store_name") == selected_store])))
            selected_machine = st.selectbox("选择机器", ["全部"] + machines)
            
            risk_types = sorted(list(set([r.get("risk_type") for r in risks])))
            risk_type_names = [get_risk_type_name(rt) for rt in risk_types]
            selected_risk_type_name = st.selectbox("风险类型", ["全部"] + risk_type_names)
            
            if selected_risk_type_name == "全部":
                selected_risk_type = None
            else:
                selected_risk_type = risk_types[risk_type_names.index(selected_risk_type_name)]
            
            risk_levels = ["全部", "critical", "high", "medium", "low"]
            selected_risk_level = st.selectbox("风险等级", risk_levels, 
                                               format_func=lambda x: config.RISK_LEVELS.get(x, x) if x != "全部" else "全部")
            
            review_statuses = ["全部"] + list(config.REVIEW_STATUS.keys())
            selected_review_status = st.selectbox("复核状态", review_statuses,
                                                  format_func=lambda x: config.REVIEW_STATUS.get(x, x) if x != "全部" else "全部")
            
            st.session_state.filters = {
                "store": selected_store,
                "machine": selected_machine,
                "risk_type": selected_risk_type,
                "risk_level": selected_risk_level,
                "review_status": selected_review_status
            }
        else:
            st.info("请先加载数据")
    
    if not st.session_state.data_loaded:
        st.markdown("""
        <div style="text-align: center; padding: 50px;">
            <h2>欢迎使用咖啡机清洁断点追踪台</h2>
            <p style="color: #666; margin-top: 20px;">
                这是一个专为连锁咖啡店区域督导设计的本地复盘工具。<br>
                帮助您识别咖啡机清洁断点、工单未闭环、出杯异常和补填嫌疑等风险。
            </p>
            <div style="margin-top: 40px; padding: 20px; background-color: #f0f2f6; border-radius: 10px;">
                <h4>🚀 快速开始</h4>
                <p style="text-align: left; margin-top: 10px;">
                    1. 在左侧边栏选择"使用示例数据"并点击加载<br>
                    2. 或上传您自己的 CSV/JSON 数据文件<br>
                    3. 查看风险分析结果并标记复核意见<br>
                    4. 导出复盘报告进行后续跟踪
                </p>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("---")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("🔴 超时未清洁", "识别清洁间隔超过阈值的记录")
        with col2:
            st.metric("📋 工单未闭环", "追踪未完成的维修工单")
        with col3:
            st.metric("📊 出杯异常", "检测出杯量异常波动")
        with col4:
            st.metric("⚠️ 补填嫌疑", "识别可能事后补填的清洁记录")
        
        return
    
    parser = st.session_state.parser
    analyzer = st.session_state.analyzer
    storage = st.session_state.storage
    exporter = st.session_state.exporter
    
    summary = parser.get_summary()
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("清洁记录", summary.get("cleaning_records", 0))
    with col2:
        st.metric("维修工单", summary.get("work_orders", 0))
    with col3:
        st.metric("出杯记录", summary.get("volume_records", 0))
    with col4:
        if summary.get("date_range"):
            min_date = format_datetime(summary["date_range"]["min"], "%Y-%m-%d")
            max_date = format_datetime(summary["date_range"]["max"], "%Y-%m-%d")
            st.metric("数据时间范围", f"{min_date} ~ {max_date}")
        else:
            st.metric("数据时间范围", "未知")
    
    st.markdown("---")
    
    risks = st.session_state.merged_risks
    filtered_risks = risks.copy()
    
    if hasattr(st.session_state, 'filters'):
        filters = st.session_state.filters
        
        if filters["store"] != "全部":
            filtered_risks = [r for r in filtered_risks if r.get("store_name") == filters["store"]]
        
        if filters["machine"] != "全部":
            filtered_risks = [r for r in filtered_risks if r.get("machine_id") == filters["machine"]]
        
        if filters["risk_type"] is not None:
            filtered_risks = [r for r in filtered_risks if r.get("risk_type") == filters["risk_type"]]
        
        if filters["risk_level"] != "全部":
            filtered_risks = [r for r in filtered_risks if r.get("risk_level") == filters["risk_level"]]
        
        if filters["review_status"] != "全部":
            filtered_risks = [r for r in filtered_risks if r.get("review_status") == filters["review_status"]]
    
    stats = analyzer._calculate_statistics(filtered_risks)
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.subheader(f"📊 风险总数: {stats['total_risks']}")
    
    st.markdown("### 按风险类型分布")
    type_cols = st.columns(len(stats["by_type"]) if stats["by_type"] else 1)
    for i, (risk_type, count) in enumerate(stats["by_type"].items()):
        with type_cols[i]:
            st.metric(get_risk_type_name(risk_type), count)
    
    st.markdown("### 按风险等级分布")
    level_cols = st.columns(len(stats["by_level"]) if stats["by_level"] else 1)
    for i, (level, count) in enumerate(stats["by_level"].items()):
        with level_cols[i]:
            color = get_risk_level_color(level)
            st.markdown(f"""
            <div style="text-align: center; padding: 10px; border-radius: 5px; background-color: {color}20;">
                <strong style="color: {color};">{config.RISK_LEVELS.get(level, level)}</strong><br>
                <span style="font-size: 24px; font-weight: bold;">{count}</span>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown("---")
    st.header("🔍 风险详情")
    
    if not filtered_risks:
        st.info("暂无符合条件的风险记录")
    else:
        for idx, risk in enumerate(filtered_risks):
            risk_id = risk.get("risk_id", "")
            risk_type = risk.get("risk_type", "")
            risk_type_name = get_risk_type_name(risk_type)
            risk_level = risk.get("risk_level", "medium")
            store_name = risk.get("store_name", "")
            machine_id = risk.get("machine_id", "")
            description = risk.get("description", "")
            review_status = risk.get("review_status", "pending")
            review_comment = risk.get("review_comment", "")
            
            level_color = get_risk_level_color(risk_level)
            status_color = "#4CAF50" if review_status == "confirmed" else "#FF9800" if review_status == "pending" else "#9E9E9E"
            
            with st.expander(f"[{risk_type_name}] {store_name} - {machine_id} (风险等级: {config.RISK_LEVELS.get(risk_level, risk_level)})", expanded=False):
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    st.markdown(f"""
                    **风险ID**: `{risk_id}` &nbsp;&nbsp; 
                    **风险类型**: <span style="color: {level_color}; font-weight: bold;">{risk_type_name}</span> &nbsp;&nbsp;
                    **风险等级**: <span style="color: {level_color}; font-weight: bold;">{config.RISK_LEVELS.get(risk_level, risk_level)}</span>
                    """, unsafe_allow_html=True)
                    
                    st.markdown(f"**门店**: {store_name} &nbsp;&nbsp; **机器**: {machine_id}")
                    st.markdown(f"**描述**: {description}")
                    
                    if review_status != "pending" or review_comment:
                        st.markdown("---")
                        st.markdown(f"**复核状态**: <span style=\"color: {status_color}; font-weight: bold;\">{config.REVIEW_STATUS.get(review_status, review_status)}</span>", unsafe_allow_html=True)
                        if review_comment:
                            st.markdown(f"**复核意见**: {review_comment}")
                
                with col2:
                    st.markdown("### 标记复核")
                    new_status = st.selectbox(
                        "复核状态",
                        list(config.REVIEW_STATUS.keys()),
                        index=list(config.REVIEW_STATUS.keys()).index(review_status) if review_status in config.REVIEW_STATUS else 0,
                        format_func=lambda x: config.REVIEW_STATUS.get(x, x),
                        key=f"status_{risk_id}"
                    )
                    new_comment = st.text_area(
                        "复核意见",
                        value=review_comment or "",
                        key=f"comment_{risk_id}"
                    )
                    
                    if st.button("保存", key=f"save_{risk_id}", type="primary"):
                        storage.save_review(
                            risk_id=risk_id,
                            review_status=new_status,
                            review_comment=new_comment,
                            reviewer="督导"
                        )
                        st.session_state.merged_risks = storage.merge_risks_with_reviews(st.session_state.risks)
                        st.success("已保存复核意见")
                        st.rerun()
    
    st.markdown("---")
    st.header("📤 导出报告")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("导出 Markdown 复盘报告", type="secondary"):
            if filtered_risks:
                session_info = st.session_state.session_info or {}
                path = exporter.export_markdown_report(
                    risks=filtered_risks,
                    session_info=session_info
                )
                st.success(f"报告已导出到: {path}")
                with open(path, 'r', encoding='utf-8') as f:
                    st.download_button(
                        "下载 Markdown 报告",
                        f.read(),
                        file_name=os.path.basename(path),
                        mime="text/markdown"
                    )
            else:
                st.warning("没有可导出的风险数据")
    
    with col2:
        if st.button("导出 CSV 风险清单", type="secondary"):
            if filtered_risks:
                path = exporter.export_risk_csv(risks=filtered_risks)
                st.success(f"清单已导出到: {path}")
                with open(path, 'r', encoding='utf-8') as f:
                    st.download_button(
                        "下载 CSV 清单",
                        f.read(),
                        file_name=os.path.basename(path),
                        mime="text/csv"
                    )
            else:
                st.warning("没有可导出的风险数据")
    
    with col3:
        if st.button("导出 JSON 审计包", type="secondary"):
            if filtered_risks:
                session_info = st.session_state.session_info or {}
                reviews = storage.get_all_reviews()
                path = exporter.export_audit_json(
                    risks=filtered_risks,
                    cleaning_records=parser.cleaning_records,
                    work_orders=parser.work_orders,
                    volume_records=parser.volume_records,
                    reviews=reviews,
                    session_info=session_info
                )
                st.success(f"审计包已导出到: {path}")
                with open(path, 'r', encoding='utf-8') as f:
                    st.download_button(
                        "下载 JSON 审计包",
                        f.read(),
                        file_name=os.path.basename(path),
                        mime="application/json"
                    )
            else:
                st.warning("没有可导出的风险数据")
    
    st.markdown("---")
    st.header("📋 原始数据查看")
    
    tab1, tab2, tab3 = st.tabs(["清洁记录", "维修工单", "出杯记录"])
    
    with tab1:
        if parser.cleaning_records is not None and len(parser.cleaning_records) > 0:
            display_df = parser.cleaning_records.copy()
            for col in display_df.columns:
                if pd.api.types.is_datetime64_any_dtype(display_df[col]) or "time" in col.lower():
                    display_df[col] = display_df[col].apply(lambda x: format_datetime(x) if pd.notna(x) else "")
            st.dataframe(display_df, use_container_width=True)
        else:
            st.info("暂无清洁记录数据")
    
    with tab2:
        if parser.work_orders is not None and len(parser.work_orders) > 0:
            display_df = parser.work_orders.copy()
            for col in display_df.columns:
                if pd.api.types.is_datetime64_any_dtype(display_df[col]) or "time" in col.lower():
                    display_df[col] = display_df[col].apply(lambda x: format_datetime(x) if pd.notna(x) else "")
            st.dataframe(display_df, use_container_width=True)
        else:
            st.info("暂无维修工单数据")
    
    with tab3:
        if parser.volume_records is not None and len(parser.volume_records) > 0:
            display_df = parser.volume_records.copy()
            for col in display_df.columns:
                if pd.api.types.is_datetime64_any_dtype(display_df[col]) or "time" in col.lower():
                    display_df[col] = display_df[col].apply(lambda x: format_datetime(x) if pd.notna(x) else "")
            st.dataframe(display_df, use_container_width=True)
        else:
            st.info("暂无出杯记录数据")


if __name__ == "__main__":
    main()
