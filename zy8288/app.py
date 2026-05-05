import streamlit as st
import pandas as pd
import io
import json
from datetime import datetime
from typing import Optional, Dict, List, Any
from pathlib import Path
import zipfile

from state_sync import (
    compute_file_fingerprint,
    WorkspaceState,
    StateManager,
    ConflictDetector,
    ConflictType,
)
from state_sync.state_storage import (
    RowAnnotation,
    FieldMapping,
    FilterCondition,
    AnnotationType,
)

st.set_page_config(
    page_title="文件审阅工作台",
    page_icon="📊",
    layout="wide",
)

state_manager = StateManager()
conflict_detector = ConflictDetector()


def load_data_from_upload(uploaded_file) -> Optional[pd.DataFrame]:
    """从上传的文件加载数据"""
    if uploaded_file is None:
        return None
    
    file_content = uploaded_file.getvalue()
    filename = uploaded_file.name
    
    try:
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(file_content))
        elif filename.endswith('.xlsx') or filename.endswith('.xls'):
            df = pd.read_excel(io.BytesIO(file_content))
        else:
            st.error(f"不支持的文件格式: {filename}")
            return None
        return df
    except Exception as e:
        st.error(f"文件读取失败: {e}")
        return None


def initialize_session_state():
    """初始化会话状态"""
    if 'current_df' not in st.session_state:
        st.session_state.current_df = None
    if 'current_file_info' not in st.session_state:
        st.session_state.current_file_info = None
    if 'workspace_state' not in st.session_state:
        st.session_state.workspace_state = None
    if 'conflicts' not in st.session_state:
        st.session_state.conflicts = []
    if 'active_tab' not in st.session_state:
        st.session_state.active_tab = "数据预览"
    if 'selected_row_index' not in st.session_state:
        st.session_state.selected_row_index = None


def display_conflicts(conflicts):
    """显示冲突信息"""
    if not conflicts:
        return
    
    for conflict in conflicts:
        if conflict.severity == "error":
            st.error(f"❌ {conflict.message}")
        elif conflict.severity == "warning":
            st.warning(f"⚠️ {conflict.message}")
        else:
            st.info(f"ℹ️ {conflict.message}")


def handle_file_upload():
    """处理文件上传"""
    st.header("📤 文件上传")
    
    col1, col2 = st.columns([3, 1])
    
    with col1:
        uploaded_file = st.file_uploader(
            "选择 CSV 或 XLSX 文件",
            type=['csv', 'xlsx', 'xls'],
            key="file_uploader"
        )
    
    with col2:
        st.metric("工作区数量", len(state_manager.list_workspaces()))
    
    if uploaded_file is not None:
        file_content = uploaded_file.getvalue()
        filename = uploaded_file.name
        
        file_fingerprint = compute_file_fingerprint(file_content, filename)
        
        df = load_data_from_upload(uploaded_file)
        
        if df is not None:
            st.session_state.current_df = df
            st.session_state.current_file_info = {
                'fingerprint': file_fingerprint,
                'filename': filename,
                'file_type': 'csv' if filename.endswith('.csv') else 'excel',
                'row_count': len(df),
                'column_count': len(df.columns),
            }
            
            saved_state = state_manager.load_state(file_fingerprint)
            
            if saved_state:
                conflicts = conflict_detector.detect_all(
                    original_df=None,
                    current_df=df,
                    saved_state=saved_state,
                    current_fingerprint=file_fingerprint,
                    saved_fingerprint=saved_state.file_fingerprint,
                )
                
                st.session_state.conflicts = conflicts
                st.session_state.workspace_state = saved_state
                
                if conflicts:
                    st.warning(f"检测到 {len(conflicts)} 个潜在冲突，请检查")
                else:
                    st.success(f"✅ 已恢复之前的工作区状态 (版本 v{saved_state.version})")
            else:
                workspace_state = WorkspaceState(
                    file_fingerprint=file_fingerprint,
                    filename=filename,
                    file_type='csv' if filename.endswith('.csv') else 'excel',
                )
                
                default_mappings = [
                    FieldMapping(original_field=col, mapped_field=col, enabled=True)
                    for col in df.columns
                ]
                workspace_state.field_mappings = default_mappings
                
                st.session_state.workspace_state = workspace_state
                st.session_state.conflicts = []
                
                state_manager.save_state(workspace_state)
                st.info("ℹ️ 创建了新的工作区")
            
            st.subheader("文件信息")
            col1, col2, col3, col4 = st.columns(4)
            col1.metric("文件名", filename)
            col2.metric("行数", f"{len(df):,}")
            col3.metric("列数", f"{len(df.columns)}")
            col4.metric("指纹", file_fingerprint[:8] + "...")


def display_data_preview():
    """显示数据预览"""
    if st.session_state.current_df is None:
        st.info("请先上传文件")
        return
    
    df = st.session_state.current_df
    workspace_state = st.session_state.workspace_state
    
    st.header("📊 数据预览")
    
    if workspace_state and workspace_state.filter_conditions:
        active_filters = [f for f in workspace_state.filter_conditions if f.enabled]
        if active_filters:
            filtered_df = apply_filters(df, active_filters)
            st.info(f"应用 {len(active_filters)} 个筛选条件，显示 {len(filtered_df)} 行")
            display_df = filtered_df
        else:
            display_df = df
    else:
        display_df = df
    
    st.subheader("数据表格")
    
    row_annotations = {}
    if workspace_state:
        row_annotations = {
            ann.row_index: ann for ann in workspace_state.row_annotations
        }
    
    display_rows = min(100, len(display_df))
    st.dataframe(display_df.head(display_rows), use_container_width=True)
    
    if workspace_state and workspace_state.row_annotations:
        st.subheader("行标注概览")
        annotations_df = pd.DataFrame([
            {
                "行索引": ann.row_index,
                "标注类型": ann.annotation_type.value,
                "备注": ann.comment[:50] + "..." if len(ann.comment) > 50 else ann.comment,
                "更新时间": ann.updated_at,
            }
            for ann in workspace_state.row_annotations
        ])
        st.dataframe(annotations_df, use_container_width=True)


def apply_filters(df: pd.DataFrame, filters: List[FilterCondition]) -> pd.DataFrame:
    """应用筛选条件"""
    result_df = df.copy()
    
    for filter_condition in filters:
        if not filter_condition.enabled:
            continue
        
        field = filter_condition.field
        operator = filter_condition.operator
        value = filter_condition.value
        
        if field not in result_df.columns:
            continue
        
        try:
            if operator == "等于":
                result_df = result_df[result_df[field] == value]
            elif operator == "不等于":
                result_df = result_df[result_df[field] != value]
            elif operator == "包含":
                result_df = result_df[result_df[field].astype(str).str.contains(str(value), case=False)]
            elif operator == "不包含":
                result_df = result_df[~result_df[field].astype(str).str.contains(str(value), case=False)]
            elif operator == "大于":
                result_df = result_df[pd.to_numeric(result_df[field], errors='coerce') > float(value)]
            elif operator == "小于":
                result_df = result_df[pd.to_numeric(result_df[field], errors='coerce') < float(value)]
            elif operator == "大于等于":
                result_df = result_df[pd.to_numeric(result_df[field], errors='coerce') >= float(value)]
            elif operator == "小于等于":
                result_df = result_df[pd.to_numeric(result_df[field], errors='coerce') <= float(value)]
        except Exception:
            continue
    
    return result_df


def display_field_mapping():
    """显示字段映射"""
    if st.session_state.current_df is None:
        st.info("请先上传文件")
        return
    
    df = st.session_state.current_df
    workspace_state = st.session_state.workspace_state
    
    if workspace_state is None:
        return
    
    st.header("🔄 字段映射")
    
    st.write("配置字段映射，用于数据清洗和导出。")
    
    mapping_changed = False
    
    for i, mapping in enumerate(workspace_state.field_mappings):
        col1, col2, col3 = st.columns([1, 1, 0.3])
        
        with col1:
            st.text_input(
                f"原始字段 [{i}]",
                value=mapping.original_field,
                key=f"original_{i}",
                disabled=True,
                label_visibility="collapsed"
            )
        
        with col2:
            new_mapped = st.text_input(
                f"映射字段 [{i}]",
                value=mapping.mapped_field,
                key=f"mapped_{i}",
                label_visibility="collapsed"
            )
            if new_mapped != mapping.mapped_field:
                mapping.mapped_field = new_mapped
                mapping_changed = True
        
        with col3:
            new_enabled = st.checkbox(
                "启用",
                value=mapping.enabled,
                key=f"enabled_{i}",
                label_visibility="visible"
            )
            if new_enabled != mapping.enabled:
                mapping.enabled = new_enabled
                mapping_changed = True
    
    st.divider()
    
    col1, col2 = st.columns([1, 1])
    with col1:
        if st.button("🔄 重置为原始字段名", use_container_width=True):
            for mapping in workspace_state.field_mappings:
                mapping.mapped_field = mapping.original_field
                mapping.enabled = True
            mapping_changed = True
            st.success("已重置字段映射")
    
    with col2:
        if mapping_changed:
            state_manager.save_state(workspace_state)
            st.success("✅ 字段映射已保存")


def display_filter_conditions():
    """显示筛选条件"""
    if st.session_state.current_df is None:
        st.info("请先上传文件")
        return
    
    df = st.session_state.current_df
    workspace_state = st.session_state.workspace_state
    
    if workspace_state is None:
        return
    
    st.header("🔍 筛选条件")
    
    st.write("设置数据筛选条件，用于预览和导出。")
    
    columns = df.columns.tolist()
    operators = ["等于", "不等于", "包含", "不包含", "大于", "小于", "大于等于", "小于等于"]
    
    filters_changed = False
    
    for i, condition in enumerate(workspace_state.filter_conditions):
        col1, col2, col3, col4, col5 = st.columns([1.5, 1, 2, 0.3, 0.3])
        
        with col1:
            new_field = st.selectbox(
                f"字段 [{i}]",
                options=columns,
                index=columns.index(condition.field) if condition.field in columns else 0,
                key=f"filter_field_{i}",
                label_visibility="collapsed"
            )
            if new_field != condition.field:
                condition.field = new_field
                filters_changed = True
        
        with col2:
            new_operator = st.selectbox(
                f"操作符 [{i}]",
                options=operators,
                index=operators.index(condition.operator) if condition.operator in operators else 0,
                key=f"filter_op_{i}",
                label_visibility="collapsed"
            )
            if new_operator != condition.operator:
                condition.operator = new_operator
                filters_changed = True
        
        with col3:
            new_value = st.text_input(
                f"值 [{i}]",
                value=str(condition.value) if condition.value is not None else "",
                key=f"filter_val_{i}",
                label_visibility="collapsed"
            )
            if new_value != str(condition.value):
                condition.value = new_value
                filters_changed = True
        
        with col4:
            new_enabled = st.checkbox(
                "启用",
                value=condition.enabled,
                key=f"filter_enabled_{i}",
            )
            if new_enabled != condition.enabled:
                condition.enabled = new_enabled
                filters_changed = True
        
        with col5:
            if st.button("🗑️", key=f"delete_filter_{i}"):
                workspace_state.filter_conditions.pop(i)
                filters_changed = True
                st.rerun()
    
    st.divider()
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        if st.button("➕ 添加筛选条件", use_container_width=True):
            workspace_state.filter_conditions.append(FilterCondition(
                field=columns[0] if columns else "",
                operator="等于",
                value="",
                enabled=True
            ))
            filters_changed = True
    
    with col2:
        if st.button("🗑️ 清除所有筛选", use_container_width=True):
            workspace_state.filter_conditions = []
            filters_changed = True
    
    if filters_changed:
        state_manager.save_state(workspace_state)
        st.success("✅ 筛选条件已保存")
    
    if workspace_state.filter_conditions:
        st.subheader("筛选效果预览")
        active_filters = [f for f in workspace_state.filter_conditions if f.enabled]
        if active_filters:
            filtered_df = apply_filters(df, active_filters)
            st.write(f"应用 {len(active_filters)} 个筛选条件后: {len(filtered_df)} 行")
            st.dataframe(filtered_df.head(10), use_container_width=True)


def display_row_annotations():
    """显示行级标注"""
    if st.session_state.current_df is None:
        st.info("请先上传文件")
        return
    
    df = st.session_state.current_df
    workspace_state = st.session_state.workspace_state
    
    if workspace_state is None:
        return
    
    st.header("📝 行级标注")
    
    annotation_types = [
        ("ok", "✅ 正常"),
        ("error", "❌ 错误"),
        ("warning", "⚠️ 警告"),
        ("review", "👀 需复审"),
        ("question", "❓ 疑问"),
    ]
    
    annotation_type_values = [t[0] for t in annotation_types]
    annotation_type_labels = [t[1] for t in annotation_types]
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        max_row = len(df) - 1
        selected_row = st.number_input(
            "选择行索引",
            min_value=0,
            max_value=max_row,
            value=st.session_state.selected_row_index if st.session_state.selected_row_index is not None else 0,
            step=1,
        )
        st.session_state.selected_row_index = int(selected_row)
    
    with col2:
        st.write(f"总行数: {len(df)}")
        existing_ann = next(
            (a for a in workspace_state.row_annotations if a.row_index == selected_row),
            None
        )
        if existing_ann:
            st.info(f"该行已有标注: {existing_ann.annotation_type.value}")
        else:
            st.info("该行暂无标注")
    
    if selected_row is not None and 0 <= selected_row < len(df):
        st.subheader(f"行 {selected_row} 数据详情")
        row_data = df.iloc[selected_row].to_frame().T
        st.dataframe(row_data, use_container_width=True)
        
        st.subheader("添加/编辑标注")
        
        col1, col2 = st.columns([1, 3])
        
        with col1:
            current_type = existing_ann.annotation_type.value if existing_ann else "ok"
            type_index = annotation_type_values.index(current_type) if current_type in annotation_type_values else 0
            
            selected_type_label = st.selectbox(
                "标注类型",
                options=annotation_type_labels,
                index=type_index,
            )
            selected_type = annotation_type_values[annotation_type_labels.index(selected_type_label)]
        
        with col2:
            comment = st.text_area(
                "备注说明",
                value=existing_ann.comment if existing_ann else "",
                placeholder="输入备注说明...",
                height=100,
            )
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            if st.button("💾 保存标注", use_container_width=True):
                annotation_type_enum = AnnotationType(selected_type)
                
                if existing_ann:
                    existing_ann.annotation_type = annotation_type_enum
                    existing_ann.comment = comment
                    existing_ann.updated_at = datetime.now().isoformat()
                else:
                    new_annotation = RowAnnotation(
                        row_index=int(selected_row),
                        annotation_type=annotation_type_enum,
                        comment=comment,
                    )
                    workspace_state.row_annotations.append(new_annotation)
                
                state_manager.save_state(workspace_state)
                st.success("✅ 标注已保存")
        
        with col2:
            if existing_ann:
                if st.button("🗑️ 删除标注", use_container_width=True):
                    workspace_state.row_annotations = [
                        a for a in workspace_state.row_annotations if a.row_index != selected_row
                    ]
                    state_manager.save_state(workspace_state)
                    st.success("✅ 标注已删除")
                    st.rerun()
    
    st.divider()
    
    if workspace_state.row_annotations:
        st.subheader("所有标注统计")
        
        stats = {}
        for ann in workspace_state.row_annotations:
            ann_type = ann.annotation_type.value
            stats[ann_type] = stats.get(ann_type, 0) + 1
        
        cols = st.columns(len(stats) + 1)
        for i, (ann_type, count) in enumerate(stats.items()):
            type_label = next((t[1] for t in annotation_types if t[0] == ann_type), ann_type)
            cols[i].metric(type_label, count)
        cols[-1].metric("总标注数", len(workspace_state.row_annotations))


def display_general_notes():
    """显示全局备注"""
    if st.session_state.workspace_state is None:
        st.info("请先上传文件")
        return
    
    workspace_state = st.session_state.workspace_state
    
    st.header("📋 全局备注")
    
    notes = st.text_area(
        "全局备注说明",
        value=workspace_state.general_notes,
        placeholder="输入全局备注，如审阅说明、待办事项等...",
        height=200,
    )
    
    if notes != workspace_state.general_notes:
        workspace_state.general_notes = notes
        state_manager.save_state(workspace_state)
        st.success("✅ 备注已保存")


def display_export():
    """显示导出功能"""
    if st.session_state.current_df is None or st.session_state.workspace_state is None:
        st.info("请先上传文件")
        return
    
    df = st.session_state.current_df
    workspace_state = st.session_state.workspace_state
    
    st.header("📦 导出数据")
    
    tab1, tab2, tab3 = st.tabs(["清洗后数据", "审阅状态包", "标注报告"])
    
    with tab1:
        st.subheader("导出清洗后的数据")
        
        st.write("配置导出选项:")
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            apply_mapping = st.checkbox("应用字段映射", value=True)
        with col2:
            apply_filters_export = st.checkbox("应用筛选条件", value=True)
        
        export_df = df.copy()
        
        if apply_filters_export and workspace_state.filter_conditions:
            active_filters = [f for f in workspace_state.filter_conditions if f.enabled]
            if active_filters:
                export_df = apply_filters(export_df, active_filters)
                st.info(f"应用筛选后: {len(export_df)} 行")
        
        if apply_mapping and workspace_state.field_mappings:
            enabled_mappings = [m for m in workspace_state.field_mappings if m.enabled]
            if enabled_mappings:
                columns_to_keep = [m.original_field for m in enabled_mappings]
                rename_dict = {m.original_field: m.mapped_field for m in enabled_mappings}
                
                export_df = export_df[columns_to_keep].rename(columns=rename_dict)
                st.info(f"应用字段映射后: {len(export_df.columns)} 列")
        
        st.subheader("预览导出数据")
        st.dataframe(export_df.head(10), use_container_width=True)
        
        export_format = st.radio("导出格式", ["CSV", "XLSX"], horizontal=True)
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            if export_format == "CSV":
                csv_data = export_df.to_csv(index=False).encode('utf-8')
                st.download_button(
                    label="📥 下载 CSV",
                    data=csv_data,
                    file_name=f"cleaned_{workspace_state.filename}",
                    mime="text/csv",
                    use_container_width=True,
                )
            else:
                output = io.BytesIO()
                with pd.ExcelWriter(output, engine='openpyxl') as writer:
                    export_df.to_excel(writer, index=False, sheet_name='Data')
                xlsx_data = output.getvalue()
                
                st.download_button(
                    label="📥 下载 XLSX",
                    data=xlsx_data,
                    file_name=f"cleaned_{Path(workspace_state.filename).stem}.xlsx",
                    mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    use_container_width=True,
                )
        
        with col2:
            st.metric("导出行数", f"{len(export_df):,}")
            st.metric("导出列数", f"{len(export_df.columns)}")
    
    with tab2:
        st.subheader("导出审阅状态包")
        
        st.write("导出完整的审阅状态，包括字段映射、筛选条件、行标注和备注。")
        
        state_json = json.dumps(workspace_state.to_dict(), indent=2, ensure_ascii=False)
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            st.download_button(
                label="📥 下载状态文件 (JSON)",
                data=state_json,
                file_name=f"state_{workspace_state.file_fingerprint[:8]}.json",
                mime="application/json",
                use_container_width=True,
            )
        
        with col2:
            st.metric("状态版本", f"v{workspace_state.version}")
            st.metric("标注数量", len(workspace_state.row_annotations))
        
        st.subheader("状态详情")
        with st.expander("查看完整状态 JSON"):
            st.json(workspace_state.to_dict())
        
        st.divider()
        
        st.subheader("导出完整数据包 (ZIP)")
        st.write("包含原始数据、清洗后数据和状态文件的完整包。")
        
        if st.button("📦 生成完整数据包", use_container_width=True):
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                zf.writestr(
                    f"original_{workspace_state.filename}",
                    df.to_csv(index=False) if workspace_state.file_type == 'csv' else 
                    io.BytesIO().getvalue()
                )
                
                zf.writestr(
                    f"cleaned_{workspace_state.filename}",
                    export_df.to_csv(index=False)
                )
                
                zf.writestr(
                    f"state_{workspace_state.file_fingerprint[:8]}.json",
                    state_json
                )
                
                readme_content = f"""审阅工作报告
==================
生成时间: {datetime.now().isoformat()}
原始文件: {workspace_state.filename}
文件指纹: {workspace_state.file_fingerprint}
状态版本: v{workspace_state.version}

统计信息:
- 总行数: {len(df)}
- 总列数: {len(df.columns)}
- 标注数量: {len(workspace_state.row_annotations)}
- 筛选条件: {len(workspace_state.filter_conditions)}
- 字段映射: {len(workspace_state.field_mappings)}

全局备注:
{workspace_state.general_notes or '(无)'}
"""
                zf.writestr("REPORT.txt", readme_content)
            
            zip_data = zip_buffer.getvalue()
            
            st.download_button(
                label="📥 下载完整数据包 (ZIP)",
                data=zip_data,
                file_name=f"review_package_{workspace_state.file_fingerprint[:8]}.zip",
                mime="application/zip",
                use_container_width=True,
            )
    
    with tab3:
        st.subheader("标注报告")
        
        if not workspace_state.row_annotations:
            st.info("暂无标注数据")
            return
        
        annotations_df = pd.DataFrame([
            {
                "行索引": ann.row_index,
                "标注类型": ann.annotation_type.value,
                "备注": ann.comment,
                "创建时间": ann.created_at,
                "更新时间": ann.updated_at,
            }
            for ann in workspace_state.row_annotations
        ])
        
        st.dataframe(annotations_df, use_container_width=True)
        
        report_csv = annotations_df.to_csv(index=False).encode('utf-8')
        
        st.download_button(
            label="📥 下载标注报告 (CSV)",
            data=report_csv,
            file_name=f"annotations_{workspace_state.file_fingerprint[:8]}.csv",
            mime="text/csv",
            use_container_width=True,
        )


def display_workspaces():
    """显示工作区管理"""
    st.header("🗂️ 工作区管理")
    
    workspaces = state_manager.list_workspaces()
    
    if not workspaces:
        st.info("暂无保存的工作区")
        return
    
    st.write(f"共 {len(workspaces)} 个工作区")
    
    for ws in workspaces:
        with st.expander(f"📁 {ws['filename']} ({ws['fingerprint'][:8]}...)"):
            col1, col2, col3 = st.columns([2, 1, 1])
            
            with col1:
                st.write(f"**文件名:** {ws['filename']}")
                st.write(f"**创建时间:** {ws['created_at']}")
                st.write(f"**更新时间:** {ws['updated_at']}")
            
            with col2:
                st.metric("版本", f"v{ws['version']}")
                st.metric("标注数", ws['annotations_count'])
            
            with col3:
                if st.button(f"🗑️ 删除", key=f"delete_{ws['fingerprint']}"):
                    state_manager.delete_state(ws['fingerprint'])
                    st.success(f"已删除工作区: {ws['filename']}")
                    st.rerun()


def main():
    """主应用"""
    initialize_session_state()
    
    st.title("📊 文件审阅工作台")
    st.markdown("---")
    
    display_conflicts(st.session_state.conflicts)
    
    handle_file_upload()
    
    if st.session_state.current_df is not None:
        st.markdown("---")
        
        tab_names = [
            "数据预览",
            "字段映射",
            "筛选条件",
            "行级标注",
            "全局备注",
            "导出数据",
            "工作区管理",
        ]
        
        tabs = st.tabs(tab_names)
        
        with tabs[0]:
            display_data_preview()
        
        with tabs[1]:
            display_field_mapping()
        
        with tabs[2]:
            display_filter_conditions()
        
        with tabs[3]:
            display_row_annotations()
        
        with tabs[4]:
            display_general_notes()
        
        with tabs[5]:
            display_export()
        
        with tabs[6]:
            display_workspaces()
    
    st.markdown("---")
    st.caption("文件审阅工作台 - 数据清洗与审阅状态持久化")


if __name__ == "__main__":
    main()
