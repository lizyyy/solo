import streamlit as st
import pandas as pd
from datetime import datetime, timedelta
import json
import io
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.parser import DataParser
from engine.scheduler import SchedulingEngine

def load_sample_data():
    data_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')
    return {
        'orders': os.path.join(data_dir, 'orders.csv'),
        'calendar': os.path.join(data_dir, 'calendar.json'),
        'materials': os.path.join(data_dir, 'materials.json'),
        'matrix': os.path.join(data_dir, 'changeover_matrix.json')
    }

def main():
    st.set_page_config(page_title='小批量生产换线排程模拟器', layout='wide')
    
    st.title('小批量生产换线排程模拟器')
    
    sample_data = load_sample_data()
    
    with st.sidebar:
        st.header('数据导入')
        
        orders_file = st.file_uploader('订单文件 (CSV)', type='csv', key='orders')
        if st.button('加载样例订单'):
            orders_file = open(sample_data['orders'], 'rb')
        
        calendar_file = st.file_uploader('产线日历 (JSON)', type='json', key='calendar')
        if st.button('加载样例日历'):
            calendar_file = open(sample_data['calendar'], 'rb')
        
        materials_file = st.file_uploader('物料到齐时间 (JSON)', type='json', key='materials')
        if st.button('加载样例物料'):
            materials_file = open(sample_data['materials'], 'rb')
        
        matrix_file = st.file_uploader('换线矩阵 (JSON)', type='json', key='matrix')
        if st.button('加载样例矩阵'):
            matrix_file = open(sample_data['matrix'], 'rb')
        
        run_button = st.button('执行排程')
    
    if run_button:
        all_errors = []
        
        with st.spinner('正在解析数据...'):
            if orders_file:
                orders_df = pd.read_csv(orders_file)
                orders_file.seek(0)
                orders, errors = DataParser.parse_orders(orders_file.name if hasattr(orders_file, 'name') else None)
                if not hasattr(orders_file, 'name'):
                    import tempfile
                    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
                        orders_df.to_csv(f, index=False)
                        orders, errors = DataParser.parse_orders(f.name)
                    os.unlink(f.name)
                all_errors.extend(errors)
            else:
                orders, errors = DataParser.parse_orders(sample_data['orders'])
                all_errors.extend(errors)
            
            if calendar_file:
                calendar_data = json.load(calendar_file)
                calendar_file.seek(0)
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    json.dump(calendar_data, f, ensure_ascii=False)
                    calendar, errors = DataParser.parse_calendar(f.name)
                os.unlink(f.name)
                all_errors.extend(errors)
            else:
                calendar, errors = DataParser.parse_calendar(sample_data['calendar'])
                all_errors.extend(errors)
            
            if materials_file:
                materials_data = json.load(materials_file)
                materials_file.seek(0)
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    json.dump(materials_data, f, ensure_ascii=False)
                    materials, errors = DataParser.parse_materials(f.name)
                os.unlink(f.name)
                all_errors.extend(errors)
            else:
                materials, errors = DataParser.parse_materials(sample_data['materials'])
                all_errors.extend(errors)
            
            if matrix_file:
                matrix_data = json.load(matrix_file)
                matrix_file.seek(0)
                import tempfile
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                    json.dump(matrix_data, f, ensure_ascii=False)
                    matrix, errors = DataParser.parse_changeover_matrix(f.name)
                os.unlink(f.name)
                all_errors.extend(errors)
            else:
                matrix, errors = DataParser.parse_changeover_matrix(sample_data['matrix'])
                all_errors.extend(errors)
        
        if all_errors:
            st.error('数据校验失败：')
            for error in all_errors:
                st.write(f'- {error}')
            return
        
        validation_errors = DataParser.validate_data(orders, materials, matrix)
        if validation_errors:
            st.warning('数据校验警告：')
            for error in validation_errors:
                st.write(f'- {error}')
        
        with st.spinner('正在排程...'):
            engine = SchedulingEngine()
            engine.load_data(orders, calendar, materials, matrix)
            schedule, warnings, stats = engine.run_scheduling()
        
        st.header('排程统计')
        col1, col2, col3, col4 = st.columns(4)
        col1.metric('总订单数', stats['总订单数'])
        col2.metric('延误订单数', f"{stats['延误订单数']} ({stats['延误率']:.1f}%)")
        col3.metric('总加班时间', f"{stats['总加班时间(分钟)']:.0f} 分钟")
        col4.metric('跨天生产', stats['跨天生产订单数'])
        
        if warnings:
            st.subheader('警告信息')
            for warning in warnings:
                st.warning(warning)
        
        st.header('排程结果')
        
        show_gantt = st.checkbox('显示甘特图视图', value=True)
        
        if show_gantt:
            st.subheader('甘特图')
            gantt_html = generate_gantt_chart(schedule)
            st.components.v1.html(gantt_html, height=400)
        
        st.subheader('排程表格')
        schedule_df = pd.DataFrame(schedule)
        schedule_df['排程开始时间'] = schedule_df['排程开始时间'].apply(lambda x: x.strftime('%Y-%m-%d %H:%M'))
        schedule_df['实际结束时间'] = schedule_df['实际结束时间'].apply(lambda x: x.strftime('%Y-%m-%d %H:%M'))
        schedule_df['交货日期'] = schedule_df['交货日期'].apply(lambda x: x.strftime('%Y-%m-%d'))
        schedule_df['排程说明'] = schedule_df['排程说明'].apply(lambda x: '; '.join(x))
        
        st.dataframe(schedule_df[[
            '订单号', '产品型号', '数量', '优先级', '交货日期',
            '排程开始时间', '实际结束时间', '换线时间(分钟)', '工艺时间(分钟)',
            '延误时间(分钟)', '加班时间(分钟)', '跨天', '排程说明'
        ]])
        
        def convert_df(df):
            return df.to_csv(index=False, encoding='utf-8-sig').encode('utf-8-sig')
        
        csv_data = convert_df(schedule_df)
        st.download_button(
            label='导出排程结果',
            data=csv_data,
            file_name='production_schedule.csv',
            mime='text/csv'
        )
        
        st.header('排程说明')
        st.write('**排程规则说明：**')
        st.write('1. 优先级顺序：紧急 > 高 > 中 > 低')
        st.write('2. 订单必须等待物料到齐后才能开始生产')
        st.write('3. 换线时间根据换线矩阵计算')
        st.write('4. 生产时间不能超出工作时段，超出部分计为加班')
        st.write('5. 超过18:00完成且超出交货日期的订单计为延误')

def generate_gantt_chart(schedule):
    if not schedule:
        return '<div>暂无排程数据</div>'
    
    min_time = min(s['排程开始时间'] for s in schedule)
    max_time = max(s['实际结束时间'] for s in schedule)
    
    total_duration = (max_time - min_time).total_seconds() / 60
    scale = 3
    
    def get_position(time_val):
        return ((time_val - min_time).total_seconds() / 60) * scale
    
    def get_color(priority):
        colors = {'紧急': '#e74c3c', '高': '#e67e22', '中': '#f39c12', '低': '#95a5a6'}
        return colors.get(priority, '#3498db')
    
    html = f'''
    <div style="font-family: Arial, sans-serif; margin: 20px;">
        <div style="display: flex; align-items: stretch;">
            <div style="width: 150px; flex-shrink: 0; border-right: 1px solid #ddd; padding-right: 10px;">
                <div style="height: 30px; line-height: 30px; font-weight: bold; padding-left: 5px;">订单</div>
    '''
    
    for entry in schedule:
        html += f'<div style="height: 40px; line-height: 40px; padding-left: 5px; border-bottom: 1px solid #eee;">{entry["订单号"]}</div>'
    
    html += '''
            </div>
            <div style="flex: 1; overflow-x: auto;">
                <div style="position: relative; height: 30px; border-bottom: 1px solid #ddd;">
    '''
    
    current_time = min_time
    while current_time <= max_time:
        pos = get_position(current_time)
        label = current_time.strftime('%m-%d %H:%M')
        html += f'<div style="position: absolute; left: {pos}px; transform: translateX(-50%); font-size: 12px; color: #666;">{label}</div>'
        current_time += timedelta(hours=2)
    
    html += f'''
                </div>
                <div style="position: relative; min-width: {total_duration * scale}px;">
    '''
    
    for entry in schedule:
        start_pos = get_position(entry['排程开始时间'])
        duration = (entry['实际结束时间'] - entry['排程开始时间']).total_seconds() / 60
        width = duration * scale
        color = get_color(entry['优先级'])
        
        html += f'''
            <div style="height: 40px; position: relative; border-bottom: 1px solid #eee;">
                <div style="position: absolute; left: {start_pos}px; width: {width}px; height: 30px; margin-top: 5px; background: {color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; overflow: hidden;">
                    {entry['产品型号']}
                </div>
            </div>
        '''
    
    html += '''
                </div>
            </div>
        </div>
        <div style="margin-top: 20px; display: flex; gap: 20px;">
            <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 20px; height: 20px; background: #e74c3c; border-radius: 4px;"></div><span style="font-size: 14px;">紧急</span></div>
            <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 20px; height: 20px; background: #e67e22; border-radius: 4px;"></div><span style="font-size: 14px;">高</span></div>
            <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 20px; height: 20px; background: #f39c12; border-radius: 4px;"></div><span style="font-size: 14px;">中</span></div>
            <div style="display: flex; align-items: center; gap: 5px;"><div style="width: 20px; height: 20px; background: #95a5a6; border-radius: 4px;"></div><span style="font-size: 14px;">低</span></div>
        </div>
    </div>
    '''
    
    return html

if __name__ == '__main__':
    main()