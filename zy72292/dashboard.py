DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>大型会展摊位视线图 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            color: white; 
            text-align: center; 
            padding: 30px 0;
        }
        .header h1 { font-size: 2em; margin-bottom: 10px; }
        .header p { opacity: 0.9; }
        
        .card { 
            background: white; 
            border-radius: 12px; 
            padding: 20px; 
            margin: 15px 0;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        }
        .card h2 { 
            color: #333; 
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.3s;
            margin: 5px;
        }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        .btn-success { background: #10b981; color: white; }
        .btn-warning { background: #f59e0b; color: white; }
        
        .step-indicator {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
        }
        .step {
            text-align: center;
            flex: 1;
            position: relative;
        }
        .step-number {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: #e5e7eb;
            color: #9ca3af;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 10px;
            font-weight: bold;
            transition: all 0.3s;
        }
        .step.active .step-number { background: #667eea; color: white; }
        .step.completed .step-number { background: #10b981; color: white; }
        .step-label { font-size: 12px; color: #666; }
        .step.active .step-label { color: #667eea; font-weight: bold; }
        
        .issue-card {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            border-radius: 0 8px 8px 0;
            margin: 10px 0;
        }
        .issue-card.pending { background: #fee2e2; border-left-color: #ef4444; }
        .issue-card.resolved { background: #d1fae5; border-left-color: #10b981; }
        
        .detail-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
        }
        .detail-label { 
            font-weight: 500; 
            color: #666; 
            width: 120px; 
            flex-shrink: 0;
        }
        .detail-value { color: #333; }
        
        .badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-pending { background: #fee2e2; color: #dc2626; }
        .badge-warning { background: #fef3c7; color: #d97706; }
        .badge-success { background: #d1fae5; color: #059669; }
        
        .timeline { position: relative; padding-left: 30px; }
        .timeline::before {
            content: '';
            position: absolute;
            left: 10px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e5e7eb;
        }
        .timeline-item {
            position: relative;
            padding: 10px 0;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -24px;
            top: 14px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #667eea;
            border: 3px solid white;
            box-shadow: 0 0 0 2px #667eea;
        }
        
        .grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        @media (max-width: 768px) {
            .grid-2 { grid-template-columns: 1fr; }
        }
        
        #report-output {
            background: #1f2937;
            color: #e5e7eb;
            padding: 20px;
            border-radius: 8px;
            font-family: monospace;
            font-size: 12px;
            white-space: pre-wrap;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
            color: #666;
        }
        .loading.active { display: block; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏢 大型会展摊位视线图</h1>
            <p>路径回放 · 问题追踪 · 班组复核</p>
        </div>

        <div class="card">
            <h2>🎮 操作面板</h2>
            <button class="btn btn-primary" onclick="loadDemo()">📊 加载演示数据</button>
            <button class="btn btn-warning" onclick="runTeaching()">📚 教学三步演示</button>
            <button class="btn btn-success" onclick="generateReport()">📄 生成完整报告</button>
        </div>

        <div class="card">
            <h2>👣 处理流程</h2>
            <div class="step-indicator">
                <div class="step" id="step1">
                    <div class="step-number">1</div>
                    <div class="step-label">导入楼层剖面草图</div>
                </div>
                <div class="step" id="step2">
                    <div class="step-number">2</div>
                    <div class="step-label">补看点云抽稀日志</div>
                </div>
                <div class="step" id="step3">
                    <div class="step-number">3</div>
                    <div class="step-label">路径回放更新</div>
                </div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <h2>📋 基本信息</h2>
                <div class="detail-row">
                    <span class="detail-label">项目名称</span>
                    <span class="detail-value" id="project-name">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">回放ID</span>
                    <span class="detail-value" id="playback-id">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">草图名称</span>
                    <span class="detail-value" id="sketch-name">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">导入人</span>
                    <span class="detail-value" id="importer">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Z轴方向</span>
                    <span class="detail-value" id="z-axis">-</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">摊位数量</span>
                    <span class="detail-value" id="stall-count">-</span>
                </div>
            </div>

            <div class="card">
                <h2>⚠️ 待复核问题</h2>
                <div id="issues-container">
                    <p style="color: #999; text-align: center; padding: 20px;">暂无问题</p>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>📝 操作轨迹</h2>
            <div class="timeline" id="timeline">
                <p style="color: #999; text-align: center; padding: 20px;">暂无操作记录</p>
            </div>
        </div>

        <div class="card">
            <h2>📄 路径回放报告</h2>
            <div class="loading" id="loading">正在生成报告...</div>
            <div id="report-output">点击上方"生成完整报告"按钮查看报告</div>
        </div>
    </div>

    <script>
        let currentData = null;

        async function loadDemo() {
            const response = await fetch('/api/playback/demo');
            const data = await response.json();
            currentData = data;
            updateDashboard(data);
            markStepCompleted(1);
            markStepCompleted(2);
            markStepCompleted(3);
        }

        async function runTeaching() {
            for (let step = 1; step <= 3; step++) {
                const response = await fetch(`/api/teaching/step/${step}`);
                const data = await response.json();
                currentData = data.playback;
                updateDashboard(data.playback);
                markStepCompleted(step);
                if (step < 3) {
                    await new Promise(r => setTimeout(r, 1500));
                }
            }
        }

        async function generateReport() {
            document.getElementById('loading').classList.add('active');
            const response = await fetch('/api/playback/demo/text');
            const text = await response.text();
            document.getElementById('report-output').textContent = text;
            document.getElementById('loading').classList.remove('active');
        }

        function updateDashboard(data) {
            document.getElementById('project-name').textContent = data.project_name || '-';
            document.getElementById('playback-id').textContent = data.playback_id || '-';
            
            if (data.sketch) {
                document.getElementById('sketch-name').textContent = data.sketch.name || '-';
                document.getElementById('importer').textContent = data.sketch.importer || '-';
                document.getElementById('z-axis').textContent = data.sketch.z_axis_direction || '-';
                document.getElementById('stall-count').textContent = data.sketch.stall_count || '-';
            }

            const issuesContainer = document.getElementById('issues-container');
            if (data.issues && data.issues.length > 0) {
                issuesContainer.innerHTML = data.issues.map(issue => `
                    <div class="issue-card ${issue.status === '待复核' ? 'pending' : 'resolved'}">
                        <div style="font-weight: bold; margin-bottom: 8px;">
                            ${issue.issue_id} - ${issue.type}
                            <span class="badge ${issue.status === '待复核' ? 'badge-pending' : 'badge-success'}">${issue.status}</span>
                        </div>
                        <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${issue.description}</div>
                        <div style="font-size: 13px; margin-top: 8px;">
                            <div><strong>📌 为什么留下:</strong> ${issue.why_kept}</div>
                            <div style="margin-top: 5px;"><strong>📋 缺料:</strong> ${issue.missing_materials.join(', ') || '无'}</div>
                            <div style="margin-top: 5px;"><strong>🚩 下一步:</strong> ${issue.next_action}</div>
                        </div>
                    </div>
                `).join('');
            } else {
                issuesContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">暂无问题</p>';
            }

            const timeline = document.getElementById('timeline');
            let timelineItems = [];
            
            if (data.sketch) {
                timelineItems.push(`
                    <div class="timeline-item">
                        <div style="font-weight: 500;">导入楼层剖面草图</div>
                        <div style="font-size: 13px; color: #666;">${data.sketch.importer} 导入了 ${data.sketch.name}</div>
                    </div>
                `);
            }
            
            if (data.point_cloud_logs) {
                data.point_cloud_logs.forEach(log => {
                    timelineItems.push(`
                        <div class="timeline-item">
                            <div style="font-weight: 500;">${log.action}</div>
                            <div style="font-size: 13px; color: #666;">${log.operator} · 抽稀 ${(log.thinning_ratio * 100).toFixed(0)}%</div>
                            ${log.notes ? `<div style="font-size: 12px; color: #888; margin-top: 4px;">${log.notes}</div>` : ''}
                        </div>
                    `);
                });
            }
            
            if (data.corrections) {
                data.corrections.forEach(corr => {
                    timelineItems.push(`
                        <div class="timeline-item">
                            <div style="font-weight: 500;">人工修正</div>
                            <div style="font-size: 13px; color: #666;">${corr.operator} 修改了 ${corr.field_name}</div>
                            <div style="font-size: 12px; color: #888; margin-top: 4px;">原因: ${corr.reason}</div>
                        </div>
                    `);
                });
            }
            
            if (data.re_runs) {
                data.re_runs.forEach(run => {
                    timelineItems.push(`
                        <div class="timeline-item">
                            <div style="font-weight: 500;">重跑分析</div>
                            <div style="font-size: 13px; color: #666;">${run.operator}: ${run.reason}</div>
                        </div>
                    `);
                });
            }

            timeline.innerHTML = timelineItems.length > 0 
                ? timelineItems.join('') 
                : '<p style="color: #999; text-align: center; padding: 20px;">暂无操作记录</p>';
        }

        function markStepCompleted(stepNum) {
            for (let i = 1; i <= stepNum; i++) {
                const step = document.getElementById(`step${i}`);
                step.classList.add('completed');
                step.classList.remove('active');
            }
            if (stepNum < 3) {
                document.getElementById(`step${stepNum + 1}`).classList.add('active');
            }
        }

        document.getElementById('step1').classList.add('active');
    </script>
</body>
</html>
"""
