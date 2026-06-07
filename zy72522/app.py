import streamlit as st
import pandas as pd
from core import ColumnAmbiguityAnalyzer
from pathlib import Path

st.set_page_config(page_title="表格问答列名歧义分析", layout="wide")

analyzer = ColumnAmbiguityAnalyzer()

SAMPLE_DIR = Path(__file__).parent / "sample_data"

st.title("📊 表格问答列名歧义分析")
st.markdown("---")

st.sidebar.header("操作流程")
step = st.sidebar.radio(
    "选择步骤",
    ["1️⃣ 导入人工改判表", "2️⃣ 补录提示词版本号", "3️⃣ 模型版本对比"],
    index=0
)

st.sidebar.markdown("---")
st.sidebar.info("💡 关键：标出**低置信度样本被平均指标盖住**，留给知识库编辑复核，不急着归正常")

if step == "1️⃣ 导入人工改判表":
    st.header("步骤一：导入人工改判表")
    
    col1, col2 = st.columns([1, 1])
    with col1:
        use_sample = st.checkbox("使用演示数据", value=True)
    with col2:
        uploaded_file = st.file_uploader("或上传 CSV/Excel", type=["csv", "xlsx"])
    
    if use_sample:
        df = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_initial.csv"))
        st.success("✅ 已加载演示数据（初始版，含缺失 prompt_version）")
    elif uploaded_file is not None:
        temp_path = Path("/tmp") / uploaded_file.name
        temp_path.write_bytes(uploaded_file.getvalue())
        df = analyzer.load_manual_review(str(temp_path))
        st.success(f"✅ 已加载 {uploaded_file.name}")
    else:
        st.info("👆 请勾选演示数据或上传文件")
        st.stop()
    
    result = analyzer.analyze(df)
    
    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("总样本数", result.metrics['total_samples'])
    with col2:
        st.metric("低置信度样本", result.metrics['low_confidence_count'])
    with col3:
        st.metric("⚠️ 被平均掩盖", result.metrics['masked_count'])
    with col4:
        st.metric("整体准确率", f"{result.metrics['accuracy']:.1%}" if result.metrics['accuracy'] else "-")
    
    st.subheader("📋 原始数据（标记低置信度和被掩盖样本）")
    
    def highlight_rows(row):
        styles = ['' for _ in row]
        if row.get('_is_masked', False):
            styles = ['background-color: #fff3cd' for _ in row]
        elif row.get('_is_low_confidence', False):
            styles = ['background-color: #ffebee' for _ in row]
        return styles
    
    display_cols = [c for c in result.data.columns if not c.startswith('_')]
    display_df = result.data[display_cols + ['_is_low_confidence', '_is_masked', '_mask_reason']]
    st.dataframe(display_df.style.apply(highlight_rows, axis=1), use_container_width=True)
    
    if len(result.masked_low_conf) > 0:
        st.subheader("🚨 低置信度样本被平均指标盖住（需知识库编辑复核）")
        st.warning("这些样本置信度低于阈值，但所在组整体准确率高，容易被忽略。请知识库编辑逐一复核，不要直接归为正常。")
        masked_display = result.masked_low_conf[['sample_id', 'question', 'column_name', 'confidence', 'accuracy', 'model_version', 'remark', '_mask_reason']]
        st.dataframe(masked_display, use_container_width=True)
    
    st.subheader("📈 版本概览（补录 prompt 前）")
    st.dataframe(result.version_summary, use_container_width=True)

elif step == "2️⃣ 补录提示词版本号":
    st.header("步骤二：补录提示词版本号")
    
    df = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_initial.csv"))
    
    col1, col2 = st.columns(2)
    with col1:
        model_ver = st.selectbox("选择模型版本", df['model_version'].unique())
    with col2:
        prompt_ver = st.text_input("补录提示词版本号", value="p-v1")
    
    if st.button("补录并重跑分析", type="primary"):
        df_filled = analyzer.fill_prompt_version(df, model_ver, prompt_ver)
        result = analyzer.analyze(df_filled)
        
        st.success(f"✅ 已为模型 {model_ver} 补录 prompt 版本 {prompt_ver}")
        
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("总样本数", result.metrics['total_samples'])
        with col2:
            st.metric("低置信度样本", result.metrics['low_confidence_count'])
        with col3:
            st.metric("⚠️ 被平均掩盖", result.metrics['masked_count'])
        with col4:
            st.metric("整体准确率", f"{result.metrics['accuracy']:.1%}" if result.metrics['accuracy'] else "-")
        
        st.subheader("📈 更新后版本对比")
        st.dataframe(result.version_summary, use_container_width=True)
        
        st.session_state['filled_df'] = df_filled
        st.session_state['filled_result'] = result

elif step == "3️⃣ 模型版本对比":
    st.header("步骤三：模型版本对比（补录后 + 人工修正重跑）")
    
    tab1, tab2 = st.tabs(["补录 prompt 后对比", "人工修正重跑后对比"])
    
    with tab1:
        df_initial = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_initial.csv"))
        result_initial = analyzer.analyze(df_initial)
        
        df_filled = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_after_fix.csv"))
        df_filled_v1 = df_filled[df_filled['sample_id'].isin(df_initial['sample_id'])].copy()
        result_filled = analyzer.analyze(df_filled_v1)
        
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("补录前（按 model 聚合）")
            st.dataframe(result_initial.version_summary, use_container_width=True)
        with col2:
            st.subheader("补录后（按 model+prompt 聚合）")
            st.dataframe(result_filled.version_summary, use_container_width=True)
        
        st.info("📌 补录 prompt_version 后，聚合粒度从 model 细化为 model+prompt，对比更精准")
    
    with tab2:
        df_final = analyzer.load_manual_review(str(SAMPLE_DIR / "manual_review_after_fix.csv"))
        result_final = analyzer.analyze(df_final)
        
        st.subheader("人工修正重跑后完整版本对比")
        st.dataframe(result_final.version_summary, use_container_width=True)
        
        st.subheader("🔍 三种处理结果对比")
        
        cases = [
            {"id": "S001", "name": "✅ 顺利通过", "desc": "高置信度 + 正确，无问题"},
            {"id": "S006", "name": "⚠️ 被平均掩盖", "desc": "组准确率高掩盖了低置信度，需知识库编辑复核"},
            {"id": "S016", "name": "🔧 人工修正重跑", "desc": "原列名歧义，修正后重跑，从旧口径补来"}
        ]
        
        for i, case in enumerate(cases):
            with st.expander(f"{case['name']} - 样本 {case['id']}"):
                row = result_final.data[result_final.data['sample_id'] == case['id']].iloc[0]
                st.write(f"**说明**: {case['desc']}")
                st.write(f"**问题**: {row['question']}")
                st.write(f"**列名**: {row['column_name']}")
                st.write(f"**置信度**: {row['confidence']:.2f}")
                st.write(f"**准确率**: {row['accuracy']}")
                st.write(f"**备注**: {row['remark']}")
                if row.get('_is_masked', False):
                    st.warning(f"掩盖原因: {row['_mask_reason']}")

st.markdown("---")
st.caption("🔗 数据溯源：每条样本可追溯 → 人工改判表 → 提示词版本 → 模型版本对比 → 处理结果")
