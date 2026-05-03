import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from data_processor import DataProcessor


st.set_page_config(
    page_title="演唱会场馆安检分析系统",
    page_icon="🎫",
    layout="wide"
)


@st.cache_resource
def load_data_processor(data_dir: str):
    processor = DataProcessor(data_dir=data_dir)
    processor.load_data()
    return processor


def main():
    st.title("🎫 演唱会场馆安检分析系统")
    st.markdown("---")
    
    data_dir = st.sidebar.text_input("数据目录", value="sample")
    
    if not os.path.exists(data_dir):
        st.error(f"数据目录不存在: {data_dir}")
        return
    
    try:
        processor = load_data_processor(data_dir)
    except Exception as e:
        st.error(f"数据加载失败: {str(e)}")
        return
    
    events = processor.get_events()
    event_options = ["全部场次"] + events["event_name"].tolist()
    
    selected_event = st.sidebar.selectbox("选择场次", event_options)
    
    if selected_event != "全部场次":
        event_id = events[events["event_name"] == selected_event]["event_id"].iloc[0]
        zones = processor.get_zones(event_id)
    else:
        zones = processor.get_zones()
    
    zone_options = ["全部票区"] + zones
    selected_zone = st.sidebar.selectbox("选择票区", zone_options)
    
    st.markdown("## 📊 实时概览")
    
    col1, col2, col3, col4 = st.columns(4)
    
    issues_df = processor.get_all_issues()
    
    with col1:
        duplicate_count = len(issues_df[issues_df["issue_type"] == "同票重复入场"])
        st.metric("同票重复入场", duplicate_count, delta="需关注" if duplicate_count > 0 else "正常")
    
    with col2:
        offline_count = len(issues_df[issues_df["issue_type"] == "闸机离线"])
        st.metric("闸机离线", offline_count, delta="严重" if offline_count > 0 else "正常")
    
    with col3:
        overload_count = len(issues_df[issues_df["issue_type"] == "包检通道超载"])
        st.metric("包检通道超载", overload_count, delta="需关注" if overload_count > 0 else "正常")
    
    with col4:
        midnight_count = len(issues_df[issues_df["issue_type"] == "跨午夜场次归属错误"])
        st.metric("跨午夜归属错误", midnight_count, delta="需关注" if midnight_count > 0 else "正常")
    
    st.markdown("---")
    st.markdown("## 📈 入场流量分析")
    
    tab1, tab2, tab3 = st.tabs(["时间分布", "闸口分布", "票区分布"])
    
    with tab1:
        st.subheader("入场流量时间分布")
        
        interval_option = st.selectbox(
            "时间间隔",
            ["1分钟", "5分钟", "15分钟", "30分钟", "1小时"],
            index=1
        )
        
        interval_map = {
            "1分钟": "1min",
            "5分钟": "5min",
            "15分钟": "15min",
            "30分钟": "30min",
            "1小时": "1H"
        }
        
        traffic_by_time = processor.get_traffic_by_time(interval=interval_map[interval_option])
        
        if not traffic_by_time.empty:
            fig = px.line(
                traffic_by_time,
                x="time_bin",
                y="count",
                markers=True,
                title=f"入场流量时间分布 ({interval_option}间隔)",
                labels={"time_bin": "时间", "count": "入场人数"}
            )
            fig.update_layout(xaxis_title="时间", yaxis_title="入场人数")
            st.plotly_chart(fig, use_container_width=True)
            
            peak_time = traffic_by_time.loc[traffic_by_time["count"].idxmax()]
            st.info(f"📌 拥堵峰值: {peak_time['time_bin'].strftime('%Y-%m-%d %H:%M')}，入场人数: {peak_time['count']}")
        else:
            st.info("暂无流量数据")
    
    with tab2:
        st.subheader("各闸口入场流量")
        
        traffic_by_gate = processor.get_traffic_by_gate()
        
        if not traffic_by_gate.empty:
            fig = px.bar(
                traffic_by_gate,
                x="gate_id",
                y="count",
                color="count",
                title="各闸口入场流量统计",
                labels={"gate_id": "闸口ID", "count": "入场人数"},
                color_continuous_scale="Blues"
            )
            st.plotly_chart(fig, use_container_width=True)
            
            st.dataframe(
                traffic_by_gate.sort_values("count", ascending=False),
                use_container_width=True,
                hide_index=True
            )
        else:
            st.info("暂无闸口流量数据")
    
    with tab3:
        st.subheader("各票区入场流量")
        
        traffic_by_zone = processor.get_traffic_by_zone()
        
        if not traffic_by_zone.empty:
            fig = px.pie(
                traffic_by_zone,
                values="count",
                names="zone",
                title="各票区入场流量占比",
                hole=0.4
            )
            st.plotly_chart(fig, use_container_width=True)
            
            st.dataframe(
                traffic_by_zone.sort_values("count", ascending=False),
                use_container_width=True,
                hide_index=True
            )
        else:
            st.info("暂无票区流量数据")
    
    st.markdown("---")
    st.markdown("## ⚠️ 异常明细")
    
    if not issues_df.empty:
        issue_type_filter = st.multiselect(
            "筛选异常类型",
            options=issues_df["issue_type"].unique().tolist(),
            default=issues_df["issue_type"].unique().tolist()
        )
        
        filtered_issues = issues_df[issues_df["issue_type"].isin(issue_type_filter)]
        
        if not filtered_issues.empty:
            for issue_type in filtered_issues["issue_type"].unique():
                type_issues = filtered_issues[filtered_issues["issue_type"] == issue_type]
                
                with st.expander(f"**{issue_type}** ({len(type_issues)} 起)", expanded=True):
                    if issue_type == "同票重复入场":
                        display_cols = ["ticket_id", "event_name", "zone", "gate_id", 
                                        "first_scan_time", "second_scan_time", "time_diff_minutes"]
                        st.dataframe(
                            type_issues[display_cols].rename(columns={
                                "ticket_id": "票号",
                                "event_name": "场次",
                                "zone": "票区",
                                "gate_id": "闸机",
                                "first_scan_time": "首次入场时间",
                                "second_scan_time": "再次入场时间",
                                "time_diff_minutes": "间隔(分钟)"
                            }),
                            use_container_width=True,
                            hide_index=True
                        )
                    
                    elif issue_type == "闸机离线":
                        display_cols = ["ticket_id", "event_name", "zone", "gate_id", "scan_time"]
                        st.dataframe(
                            type_issues[display_cols].rename(columns={
                                "ticket_id": "票号",
                                "event_name": "场次",
                                "zone": "票区",
                                "gate_id": "闸机",
                                "scan_time": "扫描时间"
                            }),
                            use_container_width=True,
                            hide_index=True
                        )
                    
                    elif issue_type == "包检通道超载":
                        display_cols = ["gate_id", "event_name", "zone", "scan_minute", 
                                        "actual_count", "capacity", "overload_ratio"]
                        st.dataframe(
                            type_issues[display_cols].rename(columns={
                                "gate_id": "闸机",
                                "event_name": "场次",
                                "zone": "票区",
                                "scan_minute": "时间",
                                "actual_count": "实际流量",
                                "capacity": "容量",
                                "overload_ratio": "超载率"
                            }),
                            use_container_width=True,
                            hide_index=True
                        )
                    
                    elif issue_type == "跨午夜场次归属错误":
                        display_cols = ["ticket_id", "event_name", "zone", "gate_id", 
                                        "scan_time", "ticket_valid_to", "time_diff_hours"]
                        st.dataframe(
                            type_issues[display_cols].rename(columns={
                                "ticket_id": "票号",
                                "event_name": "场次",
                                "zone": "票区",
                                "gate_id": "闸机",
                                "scan_time": "扫描时间",
                                "ticket_valid_to": "票有效期至",
                                "time_diff_hours": "超时时长(小时)"
                            }),
                            use_container_width=True,
                            hide_index=True
                        )
        else:
            st.info("暂无符合筛选条件的异常记录")
    else:
        st.success("✅ 未检测到任何异常")
    
    st.markdown("---")
    st.markdown("## 📥 导出报告")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("导出 issues.csv", type="primary", use_container_width=True):
            output_path = os.path.join("exports", "issues.csv")
            os.makedirs("exports", exist_ok=True)
            count = processor.export_issues_csv(output_path)
            st.success(f"✅ 成功导出 {count} 条异常记录到 {output_path}")
    
    with col2:
        if st.button("导出 gate_review.md", type="primary", use_container_width=True):
            output_path = os.path.join("exports", "gate_review.md")
            os.makedirs("exports", exist_ok=True)
            count = processor.export_gate_review_md(output_path)
            st.success(f"✅ 成功导出复盘报告到 {output_path}，包含 {count} 个异常")
    
    st.markdown("---")
    st.markdown("### 📖 使用说明")
    st.markdown("""
    1. **数据准备**: 将数据文件放在 `sample` 目录下（或自定义数据目录）
    2. **筛选条件**: 在左侧边栏选择场次和票区进行筛选
    3. **查看分析**:
       - 时间分布: 查看入场流量随时间的变化，识别拥堵峰值
       - 闸口分布: 了解各闸口的使用情况
       - 票区分布: 查看各票区的入场比例
    4. **异常排查**: 在异常明细部分查看具体的异常记录
    5. **导出报告**: 可导出 CSV 格式的异常列表和 Markdown 格式的复盘报告
    """)


if __name__ == "__main__":
    main()
