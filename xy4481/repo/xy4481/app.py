import os
import json
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, make_response
from io import StringIO

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['DATA_FOLDER'] = 'data'
app.config['REMARKS_FILE'] = 'remarks.json'

# 确保目录存在
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['DATA_FOLDER'], exist_ok=True)

# 示例数据
SAMPLE_TEMPERATURE_DATA = """批次,日期,温度探针1,温度探针2,温度探针3,环境温度
A001,2026-05-01,55,58,53,25
A001,2026-05-02,62,65,60,26
A001,2026-05-03,68,70,66,27
A001,2026-05-04,72,74,70,26
A001,2026-05-05,68,70,65,25
A002,2026-05-01,45,48,43,25
A002,2026-05-02,50,52,48,26
A002,2026-05-03,52,55,50,27
A002,2026-05-04,55,58,53,26
A002,2026-05-05,53,56,51,25
A003,2026-05-03,75,78,72,27
A003,2026-05-04,70,72,68,26
A003,2026-05-05,65,67,63,25
"""

SAMPLE_TURNING_DATA = """批次,日期,翻堆时间,翻堆人员,备注
A001,2026-05-02,14:30,张三,正常翻堆
A001,2026-05-04,15:00,李四,正常翻堆
A002,2026-05-03,10:00,王五,正常翻堆
"""

SAMPLE_WEIGHING_DATA = """批次,日期,来料重量(kg),含水率(%预估),物料来源
A001,2026-05-01,1200,65,居民小区A
A001,2026-05-03,800,62,居民小区B
A002,2026-05-01,1500,70,居民小区C
A002,2026-05-04,500,65,居民小区A
A003,2026-05-02,2000,75,居民小区D
"""

SAMPLE_COMPLAINT_DATA = """日期,投诉内容,投诉来源,处理状态
2026-05-03,气味浓烈,小区A,已处理
2026-05-04,有异味,小区B,待处理
2026-05-05,气味较重,小区C,待处理
"""

class CompostCalculator:
    """堆肥科学计算类"""
    
    def __init__(self):
        # 计算阈值
        self.TEMPERATURE_RATE_HIGH = 5.0  # 高温日升温速率阈值 (°C/天)
        self.TEMPERATURE_RATE_LOW = 3.0   # 低温日升温速率阈值 (°C/天)
        self.HYPOXIA_TEMP = 55.0           # 缺氧温度阈值 (°C)
        self.HYPOXIA_RATE = -2.0           # 缺氧降温速率阈值 (°C/天)
        self.HUMIDITY_HIGH = 70.0          # 高湿度阈值 (%)
        self.HUMIDITY_LOW = 50.0           # 低湿度阈值 (%)
        self.TURNING_INTERVAL_DAYS = 2     # 翻堆间隔天数
    
    def calculate_temperature_rates(self, temp_df):
        """计算温度变化速率"""
        result = []
        
        for batch in temp_df['批次'].unique():
            batch_data = temp_df[temp_df['批次'] == batch].sort_values('日期')
            batch_data = batch_data.reset_index(drop=True)
            
            for i in range(1, len(batch_data)):
                prev_row = batch_data.iloc[i-1]
                curr_row = batch_data.iloc[i]
                
                # 计算平均温度
                prev_avg_temp = (prev_row['温度探针1'] + prev_row['温度探针2'] + prev_row['温度探针3']) / 3
                curr_avg_temp = (curr_row['温度探针1'] + curr_row['温度探针2'] + curr_row['温度探针3']) / 3
                
                # 计算温度变化速率
                days_diff = (curr_row['日期'] - prev_row['日期']).days
                if days_diff > 0:
                    temp_rate = (curr_avg_temp - prev_avg_temp) / days_diff
                    
                    result.append({
                        '批次': batch,
                        '日期': curr_row['日期'].strftime('%Y-%m-%d'),
                        '前日期': prev_row['日期'].strftime('%Y-%m-%d'),
                        '前平均温度': float(round(prev_avg_temp, 2)),
                        '当前平均温度': float(round(curr_avg_temp, 2)),
                        '温度变化率': float(round(temp_rate, 2)),
                        '环境温度': int(curr_row['环境温度']) if pd.notna(curr_row['环境温度']) else None
                    })
        
        return result
    
    def estimate_humidity(self, temp_rates, weighing_data=None):
        """估算含水率"""
        humidity_estimates = []
        
        for rate in temp_rates:
            # 基础估算：基于温度变化速率和环境温度
            # 温度快速上升通常意味着湿度适中，微生物活动活跃
            # 温度停滞或下降可能意味着湿度过高或过低
            
            base_humidity = 60.0
            
            if rate['温度变化率'] > self.TEMPERATURE_RATE_HIGH:
                # 快速升温 - 湿度可能适中偏高
                estimated_humidity = 65.0
            elif rate['温度变化率'] > self.TEMPERATURE_RATE_LOW:
                # 中等升温 - 湿度可能适中
                estimated_humidity = 60.0
            elif rate['温度变化率'] > 0:
                # 缓慢升温 - 湿度可能偏低
                estimated_humidity = 55.0
            else:
                # 降温 - 湿度可能过高或活动减弱
                estimated_humidity = 68.0
            
            # 如果有称重数据，结合来料含水率
            if weighing_data is not None:
                batch_weighing = weighing_data[weighing_data['批次'] == rate['批次']]
                if not batch_weighing.empty:
                    # 取最近的来料含水率
                    latest_weighing = batch_weighing.sort_values('日期', ascending=False).iloc[0]
                    if '含水率(%预估)' in latest_weighing:
                        # 综合估算
                        estimated_humidity = (estimated_humidity + latest_weighing['含水率(%预估)']) / 2
            
            # 标记湿度风险
            humidity_risk = []
            if estimated_humidity > self.HUMIDITY_HIGH:
                humidity_risk.append('过湿风险')
            elif estimated_humidity < self.HUMIDITY_LOW:
                humidity_risk.append('过干风险')
            
            humidity_estimates.append({
                **rate,
                '估算含水率': float(round(estimated_humidity, 2)),
                '湿度风险': humidity_risk
            })
        
        return humidity_estimates
    
    def check_hypoxia_risk(self, humidity_estimates):
        """检查缺氧风险"""
        for item in humidity_estimates:
            hypoxia_risk = []
            
            # 高温后快速降温可能是缺氧
            if (item['前平均温度'] > self.HYPOXIA_TEMP and 
                item['温度变化率'] < self.HYPOXIA_RATE):
                hypoxia_risk.append('缺氧风险')
            
            # 温度停滞在高温但不继续上升
            if (item['前平均温度'] > self.HYPOXIA_TEMP and 
                abs(item['温度变化率']) < 1.0):
                hypoxia_risk.append('潜在缺氧风险')
            
            item['缺氧风险'] = hypoxia_risk
        
        return humidity_estimates
    
    def check_turning_compliance(self, temp_rates, turning_data):
        """检查翻堆合规性"""
        turning_issues = []
        
        for batch in set([r['批次'] for r in temp_rates]):
            batch_temp = [r for r in temp_rates if r['批次'] == batch]
            batch_turning = turning_data[turning_data['批次'] == batch].sort_values('日期')
            
            # 获取批次的所有日期
            all_dates = sorted(set([r['日期'] for r in batch_temp]))
            if not all_dates:
                continue
            
            start_date = datetime.strptime(all_dates[0], '%Y-%m-%d')
            end_date = datetime.strptime(all_dates[-1], '%Y-%m-%d')
            
            # 检查翻堆间隔
            current_date = start_date
            last_turning_date = None
            
            while current_date <= end_date:
                date_str = current_date.strftime('%Y-%m-%d')
                
                # 检查当天是否有翻堆
                day_turning = batch_turning[batch_turning['日期'].dt.strftime('%Y-%m-%d') == date_str]
                
                if not day_turning.empty:
                    last_turning_date = current_date
                else:
                    # 检查是否超过翻堆间隔
                    if last_turning_date:
                        days_since_turning = (current_date - last_turning_date).days
                        if days_since_turning > self.TURNING_INTERVAL_DAYS:
                            # 检查当天是否有温度数据
                            day_temp = [r for r in batch_temp if r['日期'] == date_str]
                            if day_temp:
                                turning_issues.append({
                                    '批次': batch,
                                    '日期': date_str,
                                    '问题': f'未按时翻堆(已{days_since_turning}天)',
                                    '最后翻堆日期': last_turning_date.strftime('%Y-%m-%d')
                                })
                
                current_date += timedelta(days=1)
        
        return turning_issues
    
    def match_complaints_to_batches(self, temp_rates, complaint_data):
        """将投诉匹配到对应批次"""
        matched_complaints = []
        
        for _, complaint in complaint_data.iterrows():
            complaint_date = complaint['日期'].strftime('%Y-%m-%d')
            
            # 找到投诉日期当天或前一天有活动的批次
            related_batches = []
            
            for rate in temp_rates:
                rate_date = rate['日期']
                
                # 投诉可能与当天或前一天的批次活动相关
                if rate_date == complaint_date:
                    related_batches.append({
                        '批次': rate['批次'],
                        '关联日期': rate_date,
                        '平均温度': float(rate['当前平均温度'])
                    })
            
            matched_complaints.append({
                '日期': complaint_date,
                '投诉内容': str(complaint['投诉内容']) if pd.notna(complaint['投诉内容']) else '',
                '投诉来源': str(complaint['投诉来源']) if pd.notna(complaint['投诉来源']) else '',
                '处理状态': str(complaint['处理状态']) if pd.notna(complaint['处理状态']) else '',
                '关联批次': related_batches
            })
        
        return matched_complaints
    
    def calculate_maturity_risk(self, humidity_estimates, turning_issues, matched_complaints):
        """计算腐熟风险"""
        maturity_risks = []
        
        # 按批次汇总风险
        batches = set([item['批次'] for item in humidity_estimates])
        
        for batch in batches:
            batch_data = [item for item in humidity_estimates if item['批次'] == batch]
            
            # 统计各种风险
            hypoxia_count = sum(1 for item in batch_data if item['缺氧风险'])
            humidity_risk_count = sum(1 for item in batch_data if item['湿度风险'])
            turning_issues_count = sum(1 for issue in turning_issues if issue['批次'] == batch)
            
            # 计算相关投诉
            related_complaints = []
            for complaint in matched_complaints:
                for related in complaint['关联批次']:
                    if related['批次'] == batch:
                        related_complaints.append({
                            '日期': complaint['日期'],
                            '内容': complaint['投诉内容']
                        })
            
            # 综合风险评估
            risk_score = 0
            risk_factors = []
            
            if hypoxia_count > 0:
                risk_score += 3
                risk_factors.append(f'缺氧风险({hypoxia_count}次)')
            
            if humidity_risk_count > 0:
                risk_score += 2
                risk_factors.append(f'湿度异常({humidity_risk_count}次)')
            
            if turning_issues_count > 0:
                risk_score += 2
                risk_factors.append(f'翻堆不及时({turning_issues_count}次)')
            
            if related_complaints:
                risk_score += 1
                risk_factors.append(f'关联投诉({len(related_complaints)}次)')
            
            # 风险等级
            if risk_score >= 5:
                risk_level = '高风险'
            elif risk_score >= 3:
                risk_level = '中风险'
            elif risk_score >= 1:
                risk_level = '低风险'
            else:
                risk_level = '正常'
            
            maturity_risks.append({
                '批次': batch,
                '风险评分': risk_score,
                '风险等级': risk_level,
                '风险因素': risk_factors,
                '缺氧次数': hypoxia_count,
                '湿度异常次数': humidity_risk_count,
                '翻堆问题次数': turning_issues_count,
                '关联投诉': related_complaints
            })
        
        return maturity_risks

# 数据存储函数
def load_remarks():
    """加载备注数据"""
    remarks_file = os.path.join(app.config['DATA_FOLDER'], app.config['REMARKS_FILE'])
    if os.path.exists(remarks_file):
        with open(remarks_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_remarks(remarks):
    """保存备注数据"""
    remarks_file = os.path.join(app.config['DATA_FOLDER'], app.config['REMARKS_FILE'])
    with open(remarks_file, 'w', encoding='utf-8') as f:
        json.dump(remarks, f, ensure_ascii=False, indent=2)

def parse_csv_data(csv_content):
    """解析CSV数据"""
    try:
        df = pd.read_csv(StringIO(csv_content))
        
        # 尝试解析日期列
        date_columns = ['日期', '翻堆时间']
        for col in date_columns:
            if col in df.columns:
                try:
                    df[col] = pd.to_datetime(df[col])
                except:
                    pass
        
        return df, None
    except Exception as e:
        return None, str(e)

def get_sample_data():
    """获取示例数据"""
    temp_df, _ = parse_csv_data(SAMPLE_TEMPERATURE_DATA)
    turning_df, _ = parse_csv_data(SAMPLE_TURNING_DATA)
    weighing_df, _ = parse_csv_data(SAMPLE_WEIGHING_DATA)
    complaint_df, _ = parse_csv_data(SAMPLE_COMPLAINT_DATA)
    
    return {
        'temperature': temp_df,
        'turning': turning_df,
        'weighing': weighing_df,
        'complaint': complaint_df
    }

@app.route('/')
def index():
    """主页"""
    return render_template('index.html')

@app.route('/api/load_sample', methods=['POST'])
def load_sample():
    """加载示例数据"""
    try:
        sample_data = get_sample_data()
        calculator = CompostCalculator()
        
        # 执行计算
        temp_rates = calculator.calculate_temperature_rates(sample_data['temperature'])
        humidity_estimates = calculator.estimate_humidity(temp_rates, sample_data['weighing'])
        humidity_estimates = calculator.check_hypoxia_risk(humidity_estimates)
        turning_issues = calculator.check_turning_compliance(temp_rates, sample_data['turning'])
        matched_complaints = calculator.match_complaints_to_batches(temp_rates, sample_data['complaint'])
        maturity_risks = calculator.calculate_maturity_risk(humidity_estimates, turning_issues, matched_complaints)
        
        # 加载备注
        remarks = load_remarks()
        
        result = {
            'success': True,
            'data': {
                'temperature_rates': temp_rates,
                'humidity_estimates': humidity_estimates,
                'turning_issues': turning_issues,
                'matched_complaints': matched_complaints,
                'maturity_risks': maturity_risks,
                'remarks': remarks
            }
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_data():
    """上传数据文件"""
    try:
        # 获取上传的文件
        temp_file = request.files.get('temperature')
        turning_file = request.files.get('turning')
        weighing_file = request.files.get('weighing')
        complaint_file = request.files.get('complaint')
        
        # 解析数据
        data = {}
        
        if temp_file:
            temp_content = temp_file.read().decode('utf-8')
            temp_df, error = parse_csv_data(temp_content)
            if error:
                return jsonify({'success': False, 'error': f'温度数据解析错误: {error}'}), 400
            data['temperature'] = temp_df
        
        if turning_file:
            turning_content = turning_file.read().decode('utf-8')
            turning_df, error = parse_csv_data(turning_content)
            if error:
                return jsonify({'success': False, 'error': f'翻堆数据解析错误: {error}'}), 400
            data['turning'] = turning_df
        
        if weighing_file:
            weighing_content = weighing_file.read().decode('utf-8')
            weighing_df, error = parse_csv_data(weighing_content)
            if error:
                return jsonify({'success': False, 'error': f'称重数据解析错误: {error}'}), 400
            data['weighing'] = weighing_df
        
        if complaint_file:
            complaint_content = complaint_file.read().decode('utf-8')
            complaint_df, error = parse_csv_data(complaint_content)
            if error:
                return jsonify({'success': False, 'error': f'投诉数据解析错误: {error}'}), 400
            data['complaint'] = complaint_df
        
        # 检查是否有数据
        if 'temperature' not in data or data['temperature'].empty:
            return jsonify({'success': False, 'error': '必须提供温度探针数据'}), 400
        
        # 补充缺失的数据为空DataFrame
        if 'turning' not in data:
            data['turning'] = pd.DataFrame()
        if 'weighing' not in data:
            data['weighing'] = pd.DataFrame()
        if 'complaint' not in data:
            data['complaint'] = pd.DataFrame()
        
        # 执行计算
        calculator = CompostCalculator()
        temp_rates = calculator.calculate_temperature_rates(data['temperature'])
        
        if not temp_rates:
            return jsonify({'success': False, 'error': '温度数据不足以计算变化率，需要至少两天的数据'}), 400
        
        humidity_estimates = calculator.estimate_humidity(temp_rates, data['weighing'])
        humidity_estimates = calculator.check_hypoxia_risk(humidity_estimates)
        turning_issues = calculator.check_turning_compliance(temp_rates, data['turning'])
        matched_complaints = calculator.match_complaints_to_batches(temp_rates, data['complaint'])
        maturity_risks = calculator.calculate_maturity_risk(humidity_estimates, turning_issues, matched_complaints)
        
        # 加载备注
        remarks = load_remarks()
        
        result = {
            'success': True,
            'data': {
                'temperature_rates': temp_rates,
                'humidity_estimates': humidity_estimates,
                'turning_issues': turning_issues,
                'matched_complaints': matched_complaints,
                'maturity_risks': maturity_risks,
                'remarks': remarks
            }
        }
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/save_remarks', methods=['POST'])
def save_remarks_api():
    """保存备注"""
    try:
        remarks = request.json
        save_remarks(remarks)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/markdown', methods=['POST'])
def export_markdown():
    """导出Markdown巡检单"""
    try:
        data = request.json
        
        # 生成Markdown内容
        markdown = f"""# 社区厨余堆肥站巡检报告

**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、温度变化分析

| 批次 | 日期 | 前平均温度(°C) | 当前平均温度(°C) | 变化率(°C/天) | 环境温度(°C) |
|------|------|---------------|-----------------|---------------|-------------|
"""
        
        for item in data.get('temperature_rates', []):
            markdown += f"| {item['批次']} | {item['日期']} | {item['前平均温度']} | {item['当前平均温度']} | {item['温度变化率']} | {item['环境温度']} |\n"
        
        markdown += """
---

## 二、含水率估算与风险分析

| 批次 | 日期 | 估算含水率(%) | 湿度风险 | 缺氧风险 |
|------|------|--------------|---------|---------|
"""
        
        for item in data.get('humidity_estimates', []):
            humidity_risk = ', '.join(item['湿度风险']) if item['湿度风险'] else '无'
            hypoxia_risk = ', '.join(item['缺氧风险']) if item['缺氧风险'] else '无'
            markdown += f"| {item['批次']} | {item['日期']} | {item['估算含水率']} | {humidity_risk} | {hypoxia_risk} |\n"
        
        markdown += """
---

## 三、翻堆合规性检查

"""
        
        turning_issues = data.get('turning_issues', [])
        if turning_issues:
            markdown += "### 翻堆问题\n\n"
            markdown += "| 批次 | 日期 | 问题描述 | 最后翻堆日期 |\n"
            markdown += "|------|------|---------|-------------|\n"
            for issue in turning_issues:
                markdown += f"| {issue['批次']} | {issue['日期']} | {issue['问题']} | {issue['最后翻堆日期']} |\n"
        else:
            markdown += "所有批次翻堆合规，无逾期未翻堆情况。\n"
        
        markdown += """
---

## 四、投诉关联分析

"""
        
        complaints = data.get('matched_complaints', [])
        if complaints:
            for complaint in complaints:
                markdown += f"### {complaint['日期']} - {complaint['投诉内容']}\n\n"
                markdown += f"- **投诉来源**: {complaint['投诉来源']}\n"
                markdown += f"- **处理状态**: {complaint['处理状态']}\n"
                
                if complaint['关联批次']:
                    markdown += f"- **关联批次**:\n"
                    for related in complaint['关联批次']:
                        markdown += f"  - {related['批次']} (平均温度: {related['平均温度']}°C)\n"
                else:
                    markdown += f"- **关联批次**: 无明确关联批次\n"
                
                markdown += "\n"
        else:
            markdown += "无投诉记录。\n"
        
        markdown += """
---

## 五、腐熟风险评估

| 批次 | 风险评分 | 风险等级 | 风险因素 |
|------|---------|---------|---------|
"""
        
        for risk in data.get('maturity_risks', []):
            risk_factors = ', '.join(risk['风险因素']) if risk['风险因素'] else '无'
            markdown += f"| {risk['批次']} | {risk['风险评分']} | {risk['风险等级']} | {risk_factors} |\n"
        
        markdown += """
---

## 六、人工复核备注

"""
        
        remarks = data.get('remarks', {})
        if remarks:
            for batch, batch_remarks in remarks.items():
                markdown += f"### 批次 {batch}\n\n"
                for date, remark in batch_remarks.items():
                    if remark.strip():
                        markdown += f"**{date}**: {remark}\n\n"
        else:
            markdown += "无人工复核备注。\n"
        
        # 创建响应
        response = make_response(markdown)
        response.headers['Content-Type'] = 'text/markdown; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=compost_inspection_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
        
        return response
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/export/json', methods=['POST'])
def export_json():
    """导出JSON明细"""
    try:
        data = request.json
        
        # 添加导出时间
        export_data = {
            'export_time': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'data': data
        }
        
        # 创建响应
        response = make_response(json.dumps(export_data, ensure_ascii=False, indent=2))
        response.headers['Content-Type'] = 'application/json; charset=utf-8'
        response.headers['Content-Disposition'] = f'attachment; filename=compost_data_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
        
        return response
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
