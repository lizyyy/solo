import streamlit as st
import pandas as pd
import os
import tempfile
from datetime import datetime
from typing import Optional, List

from src.data_parser import DataParser
from src.text_features import TextFeatures, ClusterManager
from src.risk_detector import RiskDetector
from src.storage import StorageManager, ReportExporter


st.set_page_config(
    page_title="客服话术质检工作台",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded"
)


RISK_TYPE_NAMES = {
    'OLD_POLICY': '旧政策话术',
    'IRRELEVANT_ANSWER': '答非所问',
    'FABRICATED_CLAUSE': '疑似编造条款引用',
    'VERSION_CONFLICT': '政策版本冲突'
}

RISK_LEVEL_COLORS = {
    'high': '#ff4b4b',
    'medium': '#ffaa00',
    'low': '#00aa00'
}

RISK_LEVEL_NAMES = {
    'high': '高风险',
    'medium': '中风险',
    'low': '低风险'
}


def init_session_state():
    if 'data_parser' not in st.session_state:
        st.session_state.data_parser = DataParser()
    if 'text_features' not in st.session_state:
        st.session_state.text_features = TextFeatures()
    if 'cluster_manager' not in st.session_state:
        st.session_state.cluster_manager = ClusterManager(st.session_state.text_features)
    if 'risk_detector' not in st.session_state:
        st.session_state.risk_detector = RiskDetector()
    if 'storage_manager' not in st.session_state:
        st.session_state.storage_manager = StorageManager()
    if 'clusters' not in st.session_state:
        st.session_state.clusters = []
    if 'short_texts' not in st.session_state:
        st.session_state.short_texts = []
    if 'findings' not in st.session_state:
        st.session_state.findings = []
    if 'cluster_stats' not in st.session_state:
        st.session_state.cluster_stats = {}
    if 'risk_stats' not in st.session_state:
        st.session_state.risk_stats = {}
    if 'conversations_loaded' not in st.session_state:
        st.session_state.conversations_loaded = False
    if 'policy_loaded' not in st.session_state:
        st.session_state.policy_loaded = False
    if 'analysis_done' not in st.session_state:
        st.session_state.analysis_done = False


def save_uploaded_file(uploaded_file) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix='.' + uploaded_file.name.split('.')[-1]) as tmp:
        tmp.write(uploaded_file.getvalue())
        return tmp.name


def load_conversations():
    st.markdown("### 📁 导入客服对话数据 (JSONL)")

    col1, col2 = st.columns([3, 1])
    with col1:
        uploaded_file = st.file_uploader(
            "选择JSONL格式的对话文件",
            type=['jsonl', 'json'],
            key="conv_uploader"
        )

    with col2:
        st.markdown("#### 文件格式说明")
        st.code("""
{
  "session_id": "s001",
  "messages": [
    {"role": "user", "content": "退款政策是什么？"},
    {"role": "assistant", "content": "7天内可退款"}
  ]
}
        """, language="json")

    if uploaded_file is not None:
        try:
            file_path = save_uploaded_file(uploaded_file)
            conversations = st.session_state.data_parser.parse_conversations_jsonl(file_path)
            os.unlink(file_path)

            st.session_state.conversations_loaded = True
            st.success(f"✅ 成功加载 {len(conversations)} 条对话数据")

            with st.expander("查看数据预览"):
                for i, conv in enumerate(conversations[:5]):
                    st.markdown(f"**会话 {i+1}: {conv.session_id}**")
                    for msg in conv.messages:
                        role_emoji = "👤" if msg.role.lower() in ['user', 'customer'] else "🤖"
                        st.markdown(f"{role_emoji} **{msg.role}**: {msg.content}")
                    st.markdown("---")

        except Exception as e:
            st.error(f"❌ 加载失败: {e}")


def load_policy():
    st.markdown("### 📚 导入政策知识库 (YAML)")

    col1, col2 = st.columns([3, 1])
    with col1:
        uploaded_file = st.file_uploader(
            "选择YAML格式的政策文件",
            type=['yaml', 'yml'],
            key="policy_uploader"
        )

    with col2:
        st.markdown("#### 文件格式说明")
        st.code("""
policies:
  - clause_id: REFUND_001
    version: "2.0"
    category: 退款
    content: 7天内无理由退款
    keywords: [退款,7天,无理由]
    effective_date: 2024-01-01
        """, language="yaml")

    if uploaded_file is not None:
        try:
            file_path = save_uploaded_file(uploaded_file)
            kb = st.session_state.data_parser.parse_policy_yaml(file_path)
            os.unlink(file_path)

            st.session_state.policy_loaded = True
            st.success(f"✅ 成功加载 {len(kb.policies)} 条政策条款")

            if kb.version_conflicts:
                st.warning(f"⚠️ 检测到 {len(kb.version_conflicts)} 个政策版本冲突")
                for conflict in kb.version_conflicts:
                    st.info(f"""
                    **冲突条款**: {conflict['base_id']}
                    - 现有版本: {conflict['existing_version']} (生效: {conflict['existing_effective']})
                    - 新添版本: {conflict['new_version']} (生效: {conflict['new_effective']})
                    - 冲突类型: {conflict['conflict_type']}
                    """)

            with st.expander("查看政策预览"):
                for clause_id, policy in kb.policies.items():
                    st.markdown(f"**{clause_id}** (版本: {policy.version})")
                    st.markdown(f"- 分类: {policy.category or '未分类'}")
                    st.markdown(f"- 关键词: {', '.join(policy.keywords)}")
                    st.markdown(f"- 内容: {policy.content[:100]}...")
                    st.markdown("---")

        except Exception as e:
            st.error(f"❌ 加载失败: {e}")


def load_inspection_records():
    st.markdown("### 📋 导入历史抽检记录 (CSV)")

    col1, col2 = st.columns([3, 1])
    with col1:
        uploaded_file = st.file_uploader(
            "选择CSV格式的抽检记录",
            type=['csv'],
            key="inspect_uploader"
        )

    with col2:
        st.markdown("#### 文件格式说明")
        st.code("""
record_id,session_id,risk_types,risk_level,confirmed
r001,s001,OLD_POLICY,high,True
r002,s002,IRRELEVANT_ANSWER,medium,False
        """, language="csv")

    if uploaded_file is not None:
        try:
            file_path = save_uploaded_file(uploaded_file)
            records = st.session_state.data_parser.parse_inspection_csv(file_path)
            os.unlink(file_path)

            st.success(f"✅ 成功加载 {len(records)} 条历史抽检记录")

            with st.expander("查看历史记录预览"):
                df = pd.DataFrame([{
                    'record_id': r.record_id,
                    'session_id': r.session_id,
                    'risk_types': ', '.join(r.risk_types),
                    'risk_level': r.risk_level,
                    'confirmed': '是' if r.confirmed else '否'
                } for r in records[:10]])
                st.dataframe(df, use_container_width=True)

        except Exception as e:
            st.error(f"❌ 加载失败: {e}")


def run_analysis():
    st.markdown("### 🔬 运行质检分析")

    if not st.session_state.conversations_loaded:
        st.warning("⚠️ 请先导入对话数据")
        return

    col1, col2, col3 = st.columns(3)

    with col1:
        n_clusters = st.slider("聚类数量 (0=自动)", 0, 20, 0)
        use_dbscan = st.checkbox("使用DBSCAN自动聚类", value=False)

    with col2:
        similarity_threshold = st.slider("相似度阈值", 0.1, 0.9, 0.3, 0.05)
        min_word_count = st.slider("短句阈值 (词数)", 2, 20, 5)

    with col3:
        analyze_button = st.button("🚀 开始分析", type="primary", use_container_width=True)
        st.info(f"""
        **当前状态**:
        - 对话数: {len(st.session_state.data_parser.conversations)}
        - 政策数: {len(st.session_state.data_parser.knowledge_base.policies)}
        """)

    if analyze_button:
        with st.spinner("正在分析中..."):
            st.session_state.text_features.min_word_count = min_word_count
            st.session_state.risk_detector.similarity_threshold = similarity_threshold

            session_texts = st.session_state.data_parser.get_all_conversation_texts()

            progress_bar = st.progress(0)
            status_text = st.empty()

            status_text.text("步骤 1/4: 文本特征提取和聚类...")
            clusters, short_texts = st.session_state.cluster_manager.cluster_conversations(
                session_texts,
                n_clusters=n_clusters if n_clusters > 0 else None,
                use_dbscan=use_dbscan
            )

            st.session_state.clusters = clusters
            st.session_state.short_texts = short_texts
            st.session_state.cluster_stats = st.session_state.cluster_manager.get_cluster_statistics()
            progress_bar.progress(25)

            status_text.text("步骤 2/4: 风险检测...")
            findings = st.session_state.risk_detector.detect_all_risks(
                st.session_state.data_parser.conversations,
                st.session_state.data_parser.knowledge_base
            )

            st.session_state.findings = findings
            st.session_state.risk_stats = st.session_state.risk_detector.get_statistics()
            progress_bar.progress(50)

            status_text.text("步骤 3/4: 分析完成...")
            st.session_state.analysis_done = True
            progress_bar.progress(100)
            status_text.text("✅ 分析完成!")

        st.rerun()


def show_clusters():
    st.markdown("### 📊 意图聚类分析")

    if not st.session_state.clusters:
        st.info("暂无聚类数据，请先运行分析")
        return

    stats = st.session_state.cluster_stats

    col1, col2, col3, col4 = st.columns(4)
    with col1:
        st.metric("总聚类数", stats.get('number_of_clusters', 0))
    with col2:
        st.metric("聚类会话数", stats.get('valid_clustered', 0))
    with col3:
        st.metric("平均大小", f"{stats.get('avg_cluster_size', 0):.1f}")
    with col4:
        st.metric("短句数", len(st.session_state.short_texts))

    st.markdown("#### 各聚类详情")
    for i, cluster in enumerate(st.session_state.clusters):
        with st.expander(f"聚类 {i+1}: {cluster.intent_label} ({cluster.size} 条)"):
            col1, col2 = st.columns([1, 3])

            with col1:
                st.markdown("**基本信息**")
                st.markdown(f"- 会话数: {cluster.size}")
                st.markdown(f"- 关键词: {', '.join(cluster.keywords[:5])}")

            with col2:
                st.markdown("**代表性文本**")
                for j, text in enumerate(cluster.representative_texts):
                    st.markdown(f"{j+1}. {text}")

            with st.expander("查看所有会话ID"):
                st.write(', '.join(cluster.session_ids))

    if st.session_state.short_texts:
        st.markdown("#### ⚠️ 短句/无法聚类会话 (需人工复核)")
        st.warning(f"共 {len(st.session_state.short_texts)} 条会话文本过短，无法有效聚类")

        short_df = pd.DataFrame([{
            '会话ID': st.session_id,
            '文本预览': st.text[:50] + '...' if len(st.text) > 50 else st.text,
            '词数': st.word_count,
            '原因': st.reason
        } for st in st.session_state.short_texts])

        st.dataframe(short_df, use_container_width=True)


def show_risks():
    st.markdown("### ⚠️ 风险检测结果")

    if not st.session_state.findings:
        st.success("🎉 未检测到风险")
        return

    stats = st.session_state.risk_stats

    col1, col2, col3 = st.columns(3)
    with col1:
        st.metric("总风险数", stats.get('total_findings', 0))
    with col2:
        st.metric("已确认", stats.get('confirmed_count', 0))
    with col3:
        st.metric("高置信度", stats.get('high_confidence_count', 0))

    by_type = stats.get('by_type', {})
    if by_type:
        st.markdown("#### 按风险类型分布")
        type_df = pd.DataFrame([{
            '风险类型': RISK_TYPE_NAMES.get(rt, rt),
            '数量': cnt
        } for rt, cnt in by_type.items()])
        st.bar_chart(type_df.set_index('风险类型'))

    st.markdown("#### 风险详情")

    filter_col1, filter_col2, filter_col3 = st.columns(3)
    with filter_col1:
        filter_type = st.selectbox(
            "筛选风险类型",
            ["全部"] + list(RISK_TYPE_NAMES.keys()),
            format_func=lambda x: RISK_TYPE_NAMES.get(x, x)
        )
    with filter_col2:
        filter_level = st.selectbox(
            "筛选风险等级",
            ["全部", "high", "medium", "low"],
            format_func=lambda x: RISK_LEVEL_NAMES.get(x, x)
        )
    with filter_col3:
        filter_confirmed = st.selectbox(
            "确认状态",
            ["全部", "已确认", "待确认"]
        )

    filtered_findings = st.session_state.findings

    if filter_type != "全部":
        filtered_findings = [f for f in filtered_findings if f.risk_type == filter_type]
    if filter_level != "全部":
        filtered_findings = [f for f in filtered_findings if f.risk_level == filter_level]
    if filter_confirmed == "已确认":
        filtered_findings = [f for f in filtered_findings if f.confirmed]
    elif filter_confirmed == "待确认":
        filtered_findings = [f for f in filtered_findings if not f.confirmed]

    st.markdown(f"**显示 {len(filtered_findings)} 条风险**")

    for i, finding in enumerate(filtered_findings):
        level_color = RISK_LEVEL_COLORS.get(finding.risk_level, '#888888')
        status_icon = "✅" if finding.confirmed else "⏳"

        with st.expander(
            f"{status_icon} [{RISK_TYPE_NAMES.get(finding.risk_type, finding.risk_type)}] "
            f"会话: {finding.session_id} "
            f"(置信度: {finding.confidence:.0%})"
        ):
            col1, col2 = st.columns([3, 1])

            with col1:
                st.markdown(f"**描述**: {finding.description}")
                st.markdown("**证据**:")
                st.code(finding.evidence, language=None)

                if finding.inspector_notes:
                    st.markdown(f"**质检员备注**: {finding.inspector_notes}")

            with col2:
                st.markdown(f"**风险等级**: <span style='color:{level_color}'>**{RISK_LEVEL_NAMES.get(finding.risk_level, finding.risk_level)}**</span>", unsafe_allow_html=True)
                st.markdown(f"**置信度**: {finding.confidence:.1%}")
                st.markdown(f"**状态**: {'已确认' if finding.confirmed else '待确认'}")

                if not finding.confirmed:
                    with st.form(f"confirm_form_{finding.risk_id}"):
                        notes = st.text_area("质检员备注", value=finding.inspector_notes)
                        col_a, col_b = st.columns(2)
                        with col_a:
                            confirm_btn = st.form_submit_button("✅ 确认风险")
                        with col_b:
                            dismiss_btn = st.form_submit_button("❌ 忽略风险")

                        if confirm_btn:
                            st.session_state.risk_detector.confirm_finding(finding.risk_id, notes)
                            st.success("已确认风险")
                            st.rerun()
                        if dismiss_btn:
                            st.session_state.risk_detector.dismiss_finding(finding.risk_id, notes)
                            st.warning("已标记忽略")
                            st.rerun()


def show_conversations():
    st.markdown("### 💬 对话详情查询")

    if not st.session_state.data_parser.conversations:
        st.info("暂无对话数据")
        return

    search_col1, search_col2 = st.columns([3, 1])
    with search_col1:
        search_text = st.text_input("搜索会话ID或内容关键词", "")
    with search_col2:
        session_select = st.selectbox(
            "或选择会话",
            ["全部"] + [c.session_id for c in st.session_state.data_parser.conversations]
        )

    conversations = st.session_state.data_parser.conversations

    if session_select != "全部":
        conversations = [c for c in conversations if c.session_id == session_select]

    if search_text:
        conversations = [
            c for c in conversations
            if search_text.lower() in c.session_id.lower() or
               any(search_text.lower() in m.content.lower() for m in c.messages)
        ]

    st.markdown(f"**显示 {len(conversations)} 条对话**")

    for conv in conversations:
        with st.expander(f"会话: {conv.session_id}"):
            col_info, col_risks = st.columns([3, 1])

            with col_info:
                st.markdown("**对话内容**:")
                for msg in conv.messages:
                    role = msg.role.lower()
                    if role in ['user', 'customer']:
                        st.markdown(f"👤 **用户**: {msg.content}")
                    elif role in ['assistant', 'agent']:
                        st.markdown(f"🤖 **客服**: {msg.content}")
                    else:
                        st.markdown(f"💬 **{msg.role}**: {msg.content}")

            with col_risks:
                conv_risks = st.session_state.risk_detector.get_findings_by_session(conv.session_id)
                if conv_risks:
                    st.markdown("**关联风险**:")
                    for r in conv_risks:
                        status = "✅" if r.confirmed else "⏳"
                        st.markdown(f"{status} {RISK_TYPE_NAMES.get(r.risk_type, r.risk_type)}")
                        st.markdown(f"&nbsp;&nbsp;置信度: {r.confidence:.0%}")
                else:
                    st.markdown("**关联风险**: 无")


def export_results():
    st.markdown("### 📤 导出结果")

    if not st.session_state.analysis_done:
        st.warning("请先运行分析")
        return

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### 导出风险清单 (CSV)")
        if st.button("生成 risks.csv", type="primary"):
            try:
                filepath = st.session_state.storage_manager.save_findings_to_csv(
                    st.session_state.findings,
                    filename="risks.csv"
                )
                st.success(f"✅ 已保存到: {filepath}")

                with open(filepath, 'r', encoding='utf-8-sig') as f:
                    st.download_button(
                        "下载 risks.csv",
                        f.read(),
                        file_name="risks.csv",
                        mime="text/csv"
                    )
            except Exception as e:
                st.error(f"导出失败: {e}")

    with col2:
        st.markdown("#### 导出质检报告 (Markdown)")
        if st.button("生成 report.md", type="primary"):
            try:
                exporter = ReportExporter()
                filepath = exporter.generate_report(
                    findings=st.session_state.findings,
                    clusters=st.session_state.clusters,
                    short_texts=st.session_state.short_texts,
                    cluster_stats=st.session_state.cluster_stats,
                    risk_stats=st.session_state.risk_stats,
                    conversations_count=len(st.session_state.data_parser.conversations),
                    output_path="report.md"
                )
                st.success(f"✅ 已保存到: {filepath}")

                with open(filepath, 'r', encoding='utf-8') as f:
                    st.download_button(
                        "下载 report.md",
                        f.read(),
                        file_name="report.md",
                        mime="text/markdown"
                    )
            except Exception as e:
                st.error(f"导出失败: {e}")

    st.markdown("---")
    st.markdown("#### 数据摘要")

    summary = {
        "总对话数": len(st.session_state.data_parser.conversations),
        "政策条款数": len(st.session_state.data_parser.knowledge_base.policies),
        "聚类数量": len(st.session_state.clusters),
        "短句数量": len(st.session_state.short_texts),
        "检测风险数": len(st.session_state.findings),
        "已确认风险数": sum(1 for f in st.session_state.findings if f.confirmed),
    }

    st.json(summary, expanded=True)


def main():
    init_session_state()

    st.title("🔍 客服话术质检工作台")
    st.markdown("> 基于TF-IDF相似度和规则引擎的客服对话智能质检系统")

    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "📁 数据导入",
        "🔬 运行分析",
        "📊 聚类分析",
        "⚠️ 风险检测",
        "💬 对话查询",
        "📤 导出结果"
    ])

    with tab1:
        st.markdown("## 数据导入")
        st.markdown("请依次导入对话数据、政策知识库和历史抽检记录（可选）")

        load_conversations()
        st.markdown("---")
        load_policy()
        st.markdown("---")
        load_inspection_records()

    with tab2:
        st.markdown("## 质检分析")
        run_analysis()

        if st.session_state.analysis_done:
            st.markdown("---")
            st.markdown("### 📈 分析概览")

            col1, col2, col3 = st.columns(3)
            with col1:
                st.metric("对话数", len(st.session_state.data_parser.conversations))
            with col2:
                st.metric("聚类数", len(st.session_state.clusters))
            with col3:
                st.metric("风险数", len(st.session_state.findings))

            if st.session_state.risk_stats.get('by_type'):
                st.markdown("#### 风险类型分布")
                risk_df = pd.DataFrame([{
                    '类型': RISK_TYPE_NAMES.get(rt, rt),
                    '数量': cnt
                } for rt, cnt in st.session_state.risk_stats['by_type'].items()])
                st.bar_chart(risk_df.set_index('类型'))

    with tab3:
        show_clusters()

    with tab4:
        show_risks()

    with tab5:
        show_conversations()

    with tab6:
        export_results()

    st.markdown("---")
    st.markdown(
        "<div style='text-align: center; color: #888;'>"
        "客服话术质检工作台 | 基于TF-IDF + 规则引擎 | 数据仅在本地处理"
        "</div>",
        unsafe_allow_html=True
    )


if __name__ == "__main__":
    main()
