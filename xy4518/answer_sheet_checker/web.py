"""网页界面模块。"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from flask import Flask, jsonify, render_template_string, request, send_from_directory

from .engine import CheckEngine
from .loader import DataLoader


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>答题卡回收核查系统</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #333; line-height: 1.6; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 24px; }
        .header h1 { font-size: 28px; margin-bottom: 10px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .card { background: white; border-radius: 12px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); padding: 24px; margin-bottom: 24px; }
        .card h2 { font-size: 18px; color: #1a1a2e; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 2px solid #f0f0f0; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .stat-card { background: linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 100%); padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.critical { background: linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%); }
        .stat-card.major { background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); }
        .stat-card.minor { background: linear-gradient(135deg, #fff9c4 0%, #fff59d 100%); }
        .stat-value { font-size: 32px; font-weight: bold; margin-bottom: 4px; }
        .stat-label { font-size: 13px; color: #666; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f8f9fa; font-weight: 600; color: #333; }
        tr:hover { background: #fafbfc; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge-critical { background: #ffebee; color: #c62828; }
        .badge-major { background: #fff3e0; color: #e65100; }
        .badge-minor { background: #fff9c4; color: #f57f17; }
        .badge-success { background: #e8f5e9; color: #2e7d32; }
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .btn-secondary:hover { background: #e0e0e0; }
        .btn-sm { padding: 6px 12px; font-size: 12px; }
        .action-bar { display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .form-group { margin-bottom: 16px; }
        .form-group label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 14px; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 14px; font-family: inherit; transition: border-color 0.2s; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { outline: none; border-color: #667eea; }
        .form-group textarea { min-height: 100px; resize: vertical; }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: white; border-radius: 12px; padding: 24px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .modal-header h3 { font-size: 18px; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
        .issue-detail { margin-bottom: 16px; padding: 16px; background: #f8f9fa; border-radius: 8px; }
        .issue-detail .title { font-weight: 600; margin-bottom: 8px; }
        .issue-detail .meta { font-size: 13px; color: #666; margin-bottom: 8px; }
        .issue-detail .description { margin-bottom: 8px; }
        .issue-detail .recommendation { font-size: 13px; color: #e65100; font-style: italic; }
        .hidden { display: none !important; }
        .empty-state { text-align: center; padding: 40px 20px; color: #999; }
        .empty-state svg { width: 64px; height: 64px; margin-bottom: 16px; opacity: 0.5; }
        .tabs { display: flex; gap: 4px; margin-bottom: 20px; background: #f0f0f0; padding: 4px; border-radius: 8px; }
        .tab { padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s; }
        .tab.active { background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .tab:hover:not(.active) { background: rgba(255,255,255,0.5); }
        .progress-bar { height: 8px; background: #e0e0e0; border-radius: 4px; overflow: hidden; margin-top: 10px; }
        .progress-bar .fill { height: 100%; background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); transition: width 0.3s; }
        .run-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .file-input-wrapper { position: relative; }
        .file-input-wrapper input[type="file"] { opacity: 0; position: absolute; left: 0; top: 0; width: 100%; height: 100%; cursor: pointer; }
        .file-input-display { padding: 10px 14px; border: 2px dashed #ccc; border-radius: 8px; text-align: center; color: #666; }
        .file-input-display.has-file { border-color: #667eea; background: #f5f7fa; }
        .folder-input-wrapper { display: flex; gap: 8px; }
        .folder-input-wrapper input { flex: 1; }
        .message { padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; }
        .message-success { background: #e8f5e9; color: #2e7d32; }
        .message-error { background: #ffebee; color: #c62828; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 16px 24px; border-radius: 8px; background: #333; color: white; z-index: 2000; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 答题卡回收核查系统</h1>
            <p>自动检测漏扫、重复条码、考场混放、缺考却有答题卡、页码方向异常等问题</p>
        </div>

        <div class="tabs">
            <div class="tab active" data-tab="run">执行核查</div>
            <div class="tab" data-tab="results">核查结果</div>
            <div class="tab" data-tab="remarks">人工备注</div>
            <div class="tab" data-tab="export">导出</div>
        </div>

        <!-- 执行核查 Tab -->
        <div id="tab-run" class="tab-content">
            <div class="card">
                <h2>配置核查参数</h2>
                <form id="checkForm">
                    <div class="run-form">
                        <div>
                            <div class="form-group">
                                <label>工作目录</label>
                                <input type="text" id="workDir" value="{{ work_dir }}" readonly>
                            </div>
                            <div class="form-group">
                                <label>座位表 CSV</label>
                                <div class="file-input-wrapper">
                                    <input type="file" id="seatTableFile" accept=".csv">
                                    <div class="file-input-display" id="seatTableDisplay">点击选择文件</div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>答题卡文件夹路径</label>
                                <div class="folder-input-wrapper">
                                    <input type="text" id="sheetsFolder" placeholder="输入文件夹路径">
                                </div>
                            </div>
                        </div>
                        <div>
                            <div class="form-group">
                                <label>缺考签名单 CSV</label>
                                <div class="file-input-wrapper">
                                    <input type="file" id="absentListFile" accept=".csv">
                                    <div class="file-input-display" id="absentListDisplay">点击选择文件</div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>阅卷批次 JSON</label>
                                <div class="file-input-wrapper">
                                    <input type="file" id="batchFile" accept=".json">
                                    <div class="file-input-display" id="batchDisplay">点击选择文件</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label style="display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" id="preserveRemarks" checked>
                            保留之前的人工备注
                        </label>
                    </div>
                    <div class="action-bar">
                        <button type="submit" class="btn btn-primary">🚀 开始核查</button>
                        <button type="button" class="btn btn-secondary" onclick="loadLastResult()">加载上次结果</button>
                    </div>
                </form>
                <div id="runProgress" class="hidden">
                    <div class="progress-bar"><div class="fill" style="width: 0%"></div></div>
                    <p id="progressText" style="margin-top: 10px; color: #666; font-size: 14px;">准备中...</p>
                </div>
            </div>
        </div>

        <!-- 核查结果 Tab -->
        <div id="tab-results" class="tab-content hidden">
            <div class="card">
                <h2>批次信息</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-value" id="statBatch">-</div>
                        <div class="stat-label">批次号</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statExam">-</div>
                        <div class="stat-label">考试名称</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statDate">-</div>
                        <div class="stat-label">考试日期</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statTotal">-</div>
                        <div class="stat-label">总人数</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>问题汇总</h2>
                <div class="stats-grid">
                    <div class="stat-card critical">
                        <div class="stat-value" id="statCritical">0</div>
                        <div class="stat-label">严重问题</div>
                    </div>
                    <div class="stat-card major">
                        <div class="stat-value" id="statMajor">0</div>
                        <div class="stat-label">重要问题</div>
                    </div>
                    <div class="stat-card minor">
                        <div class="stat-value" id="statMinor">0</div>
                        <div class="stat-label">轻微问题</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value" id="statTotalIssues">0</div>
                        <div class="stat-label">总计</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h2>按考场统计</h2>
                <div class="table-wrapper">
                    <table id="roomStatsTable">
                        <thead>
                            <tr>
                                <th>考场</th>
                                <th>总人数</th>
                                <th>实考</th>
                                <th>缺考</th>
                                <th>已扫描</th>
                                <th>漏扫</th>
                                <th>重复</th>
                                <th>问题数</th>
                                <th>状态</th>
                            </tr>
                        </thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>

            <div class="card">
                <h2>问题详情</h2>
                <div id="issuesList">
                    <div class="empty-state">
                        <div>暂无问题数据，请先执行核查</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 人工备注 Tab -->
        <div id="tab-remarks" class="tab-content hidden">
            <div class="card">
                <h2>人工备注管理</h2>
                <div class="action-bar">
                    <button type="button" class="btn btn-primary btn-sm" onclick="addRemark()">➕ 添加备注</button>
                </div>
                <div id="remarksList">
                    <div class="empty-state">
                        <div>暂无备注</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 导出 Tab -->
        <div id="tab-export" class="tab-content hidden">
            <div class="card">
                <h2>导出核查结果</h2>
                <div class="form-group">
                    <label>输出目录</label>
                    <input type="text" id="exportDir" value="output" placeholder="输出目录路径">
                </div>
                <div class="form-group">
                    <label>文件名前缀</label>
                    <input type="text" id="exportBaseName" placeholder="留空使用默认">
                </div>
                <div class="action-bar">
                    <button type="button" class="btn btn-primary" onclick="exportResults()">📥 导出</button>
                </div>
            </div>
        </div>
    </div>

    <!-- 备注模态框 -->
    <div id="remarkModal" class="modal-overlay hidden">
        <div class="modal">
            <div class="modal-header">
                <h3 id="remarkModalTitle">添加备注</h3>
                <button class="modal-close" onclick="closeRemarkModal()">&times;</button>
            </div>
            <form id="remarkForm">
                <div class="form-group">
                    <label>备注标题/键名</label>
                    <input type="text" id="remarkKey" placeholder="例如: 关于考场001的说明">
                </div>
                <div class="form-group">
                    <label>备注内容</label>
                    <textarea id="remarkValue" placeholder="输入详细说明..."></textarea>
                </div>
                <div class="action-bar">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn btn-secondary" onclick="closeRemarkModal()">取消</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        let currentResult = null;
        let remarks = {};

        // Tab 切换
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
            });
        });

        // 文件选择显示
        function setupFileInput(inputId, displayId) {
            const input = document.getElementById(inputId);
            const display = document.getElementById(displayId);
            input.addEventListener('change', () => {
                if (input.files.length > 0) {
                    display.textContent = input.files[0].name;
                    display.classList.add('has-file');
                } else {
                    display.textContent = '点击选择文件';
                    display.classList.remove('has-file');
                }
            });
        }
        setupFileInput('seatTableFile', 'seatTableDisplay');
        setupFileInput('absentListFile', 'absentListDisplay');
        setupFileInput('batchFile', 'batchDisplay');

        // 执行核查
        document.getElementById('checkForm').addEventListener('submit', async (e) => {
            e.preventDefault();

            const seatTableFile = document.getElementById('seatTableFile').files[0];
            const absentListFile = document.getElementById('absentListFile').files[0];
            const batchFile = document.getElementById('batchFile').files[0];
            const sheetsFolder = document.getElementById('sheetsFolder').value;
            const preserveRemarks = document.getElementById('preserveRemarks').checked;

            if (!seatTableFile || !absentListFile || !batchFile || !sheetsFolder) {
                showToast('请填写所有必填项', 'error');
                return;
            }

            const progress = document.getElementById('runProgress');
            const progressText = document.getElementById('progressText');
            const progressBar = progress.querySelector('.fill');
            progress.classList.remove('hidden');

            try {
                const formData = new FormData();
                formData.append('seat_table', seatTableFile);
                formData.append('absent_list', absentListFile);
                formData.append('batch_file', batchFile);
                formData.append('sheets_folder', sheetsFolder);
                formData.append('preserve_remarks', preserveRemarks);

                progressText.textContent = '正在上传文件...';
                progressBar.style.width = '20%';

                const response = await fetch('/api/run_check', {
                    method: 'POST',
                    body: formData
                });

                progressText.textContent = '正在执行核查...';
                progressBar.style.width = '60%';

                const result = await response.json();

                if (result.success) {
                    progressText.textContent = '完成!';
                    progressBar.style.width = '100%';
                    currentResult = result.data;
                    remarks = result.data.remarks || {};
                    renderResults();
                    document.querySelector('[data-tab="results"]').click();
                    showToast('核查完成!', 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                showToast('错误: ' + err.message, 'error');
            } finally {
                setTimeout(() => progress.classList.add('hidden'), 1000);
            }
        });

        // 加载上次结果
        async function loadLastResult() {
            try {
                const response = await fetch('/api/last_result');
                const result = await response.json();
                if (result.success && result.data) {
                    currentResult = result.data;
                    remarks = result.data.remarks || {};
                    renderResults();
                    document.querySelector('[data-tab="results"]').click();
                    showToast('加载成功!', 'success');
                } else {
                    showToast('没有找到上次的结果', 'error');
                }
            } catch (err) {
                showToast('加载失败: ' + err.message, 'error');
            }
        }

        // 渲染结果
        function renderResults() {
            if (!currentResult) return;

            const batch = currentResult.batch_info || {};
            const issues = currentResult.issues || {};
            const stats = currentResult.statistics || {};

            document.getElementById('statBatch').textContent = batch.batch_id || '-';
            document.getElementById('statExam').textContent = batch.exam_name || '-';
            document.getElementById('statDate').textContent = batch.exam_date || '-';
            document.getElementById('statTotal').textContent = batch.total_students || '-';

            const critical = (issues.critical || []).length;
            const major = (issues.major || []).length;
            const minor = (issues.minor || []).length;

            document.getElementById('statCritical').textContent = critical;
            document.getElementById('statMajor').textContent = major;
            document.getElementById('statMinor').textContent = minor;
            document.getElementById('statTotalIssues').textContent = critical + major + minor;

            const tableBody = document.getElementById('roomStatsTable').querySelector('tbody');
            tableBody.innerHTML = '';

            for (const [room, s] of Object.entries(stats)) {
                const hasIssues = s.issues_count > 0;
                const status = hasIssues ? 
                    `<span class="badge badge-major">有问题</span>` : 
                    `<span class="badge badge-success">正常</span>`;

                tableBody.innerHTML += `
                    <tr>
                        <td>${room}</td>
                        <td>${s.total_students}</td>
                        <td>${s.present_students}</td>
                        <td>${s.absent_students}</td>
                        <td>${s.scanned_sheets}</td>
                        <td>${s.missing_sheets}</td>
                        <td>${s.duplicate_count}</td>
                        <td>${s.issues_count}</td>
                        <td>${status}</td>
                    </tr>
                `;
            }

            const issuesList = document.getElementById('issuesList');
            const allIssues = [...(issues.critical || []), ...(issues.major || []), ...(issues.minor || [])];

            if (allIssues.length === 0) {
                issuesList.innerHTML = `
                    <div class="empty-state">
                        <div>🎉 没有检测到任何问题!</div>
                    </div>
                `;
            } else {
                issuesList.innerHTML = allIssues.map((issue, idx) => {
                    const severityClass = issue.severity === '严重' ? 'critical' : 
                                          issue.severity === '重要' ? 'major' : 'minor';
                    return `
                        <div class="issue-detail">
                            <div class="title">
                                <span class="badge badge-${severityClass}">${issue.issue_type}</span>
                                [${issue.severity}]
                            </div>
                            <div class="meta">
                                ${issue.room_number ? '考场: ' + issue.room_number + ' | ' : ''}
                                ${issue.affected_barcodes?.length ? '涉及条码: ' + issue.affected_barcodes.join(', ') : ''}
                            </div>
                            <div class="description">${issue.description}</div>
                            ${issue.affected_files?.length ? '<div class="meta">文件: ' + issue.affected_files.join(', ') + '</div>' : ''}
                            ${issue.recommendation ? '<div class="recommendation">💡 建议: ' + issue.recommendation + '</div>' : ''}
                        </div>
                    `;
                }).join('');
            }

            renderRemarks();
        }

        // 渲染备注
        function renderRemarks() {
            const list = document.getElementById('remarksList');
            const keys = Object.keys(remarks);

            if (keys.length === 0) {
                list.innerHTML = `<div class="empty-state"><div>暂无备注</div></div>`;
                return;
            }

            list.innerHTML = keys.map(key => `
                <div class="issue-detail">
                    <div class="title">📝 ${key}</div>
                    <div class="description">${remarks[key]}</div>
                    <div style="margin-top: 8px;">
                        <button class="btn btn-secondary btn-sm" onclick="editRemark('${key}')">编辑</button>
                        <button class="btn btn-secondary btn-sm" onclick="deleteRemark('${key}')">删除</button>
                    </div>
                </div>
            `).join('');
        }

        // 备注管理
        let editingRemarkKey = null;

        function addRemark() {
            editingRemarkKey = null;
            document.getElementById('remarkModalTitle').textContent = '添加备注';
            document.getElementById('remarkKey').value = '';
            document.getElementById('remarkValue').value = '';
            document.getElementById('remarkModal').classList.remove('hidden');
        }

        function editRemark(key) {
            editingRemarkKey = key;
            document.getElementById('remarkModalTitle').textContent = '编辑备注';
            document.getElementById('remarkKey').value = key;
            document.getElementById('remarkValue').value = remarks[key];
            document.getElementById('remarkModal').classList.remove('hidden');
        }

        function deleteRemark(key) {
            if (confirm('确定删除此备注?')) {
                delete remarks[key];
                saveRemarks();
            }
        }

        function closeRemarkModal() {
            document.getElementById('remarkModal').classList.add('hidden');
        }

        document.getElementById('remarkForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('remarkKey').value.trim();
            const value = document.getElementById('remarkValue').value.trim();

            if (!key || !value) {
                showToast('请填写完整', 'error');
                return;
            }

            if (editingRemarkKey && editingRemarkKey !== key) {
                delete remarks[editingRemarkKey];
            }

            remarks[key] = value;
            closeRemarkModal();
            await saveRemarks();
        });

        async function saveRemarks() {
            try {
                const response = await fetch('/api/save_remarks', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ remarks })
                });
                const result = await response.json();
                if (result.success) {
                    renderRemarks();
                    showToast('备注已保存', 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                showToast('保存失败: ' + err.message, 'error');
            }
        }

        // 导出
        async function exportResults() {
            if (!currentResult) {
                showToast('请先执行核查或加载结果', 'error');
                return;
            }

            const exportDir = document.getElementById('exportDir').value;
            const baseName = document.getElementById('exportBaseName').value || null;

            try {
                const response = await fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        export_dir: exportDir,
                        base_name: baseName
                    })
                });
                const result = await response.json();
                if (result.success) {
                    showToast(`导出成功!\\nMarkdown: ${result.md_path}\\nJSON: ${result.json_path}`, 'success');
                } else {
                    throw new Error(result.error);
                }
            } catch (err) {
                showToast('导出失败: ' + err.message, 'error');
            }
        }

        // Toast 提示
        function showToast(message, type = 'info') {
            const existing = document.querySelector('.toast');
            if (existing) existing.remove();

            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.background = type === 'error' ? '#c62828' : type === 'success' ? '#2e7d32' : '#333';
            toast.textContent = message;
            document.body.appendChild(toast);

            setTimeout(() => toast.remove(), 4000);
        }

        // 点击模态框外部关闭
        document.getElementById('remarkModal').addEventListener('click', (e) => {
            if (e.target.id === 'remarkModal') {
                closeRemarkModal();
            }
        });
    </script>
</body>
</html>
"""


def create_app(work_dir: str = "."):
    """创建 Flask 应用。"""
    from flask import Flask, jsonify, request

    app = Flask(__name__)
    app.config["WORK_DIR"] = Path(work_dir).absolute()
    app.config["LAST_RESULT"] = None

    @app.route("/")
    def index():
        return render_template_string(HTML_TEMPLATE, work_dir=str(app.config["WORK_DIR"]))

    @app.route("/api/run_check", methods=["POST"])
    def api_run_check():
        """执行核查 API。"""
        try:
            work_dir = app.config["WORK_DIR"]
            upload_dir = work_dir / "_uploads"
            upload_dir.mkdir(exist_ok=True)

            seat_table_file = request.files.get("seat_table")
            absent_list_file = request.files.get("absent_list")
            batch_file = request.files.get("batch_file")
            sheets_folder = request.form.get("sheets_folder")
            preserve_remarks = request.form.get("preserve_remarks") == "true"

            if not all([seat_table_file, absent_list_file, batch_file, sheets_folder]):
                return jsonify({"success": False, "error": "缺少必填参数"})

            seat_table_path = str(upload_dir / seat_table_file.filename)
            seat_table_file.save(seat_table_path)

            absent_list_path = str(upload_dir / absent_list_file.filename)
            absent_list_file.save(absent_list_path)

            batch_path = str(upload_dir / batch_file.filename)
            batch_file.save(batch_path)

            engine = CheckEngine(work_dir=str(work_dir))
            result = engine.run_check(
                seat_table_path=seat_table_path,
                sheets_folder=sheets_folder,
                absent_list_path=absent_list_path,
                grading_batch_path=batch_path,
                preserve_remarks=preserve_remarks,
            )

            output_dir = work_dir / "output"
            md_path, json_path = engine.export_result(result, str(output_dir))

            result_json = engine.load_check_result(json_path)
            app.config["LAST_RESULT"] = result_json

            return jsonify({"success": True, "data": result_json})

        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    @app.route("/api/last_result", methods=["GET"])
    def api_last_result():
        """获取上次结果。"""
        work_dir = app.config["WORK_DIR"]
        output_dir = work_dir / "output"

        if app.config.get("LAST_RESULT"):
            return jsonify({"success": True, "data": app.config["LAST_RESULT"]})

        if output_dir.exists():
            json_files = list(output_dir.glob("*.json"))
            if json_files:
                latest = max(json_files, key=lambda p: p.stat().st_mtime)
                try:
                    with open(latest, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        app.config["LAST_RESULT"] = data
                        return jsonify({"success": True, "data": data})
                except Exception:
                    pass

        return jsonify({"success": False, "error": "没有找到上次的结果"})

    @app.route("/api/save_remarks", methods=["POST"])
    def api_save_remarks():
        """保存备注。"""
        try:
            work_dir = app.config["WORK_DIR"]
            remarks = request.json.get("remarks", {})

            engine = CheckEngine(work_dir=str(work_dir))
            engine.save_remarks(remarks)

            if app.config.get("LAST_RESULT"):
                app.config["LAST_RESULT"]["remarks"] = remarks

            return jsonify({"success": True})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    @app.route("/api/export", methods=["POST"])
    def api_export():
        """导出结果。"""
        try:
            work_dir = app.config["WORK_DIR"]
            export_dir = request.json.get("export_dir", "output")
            base_name = request.json.get("base_name")

            if not app.config.get("LAST_RESULT"):
                return jsonify({"success": False, "error": "没有可导出的结果"})

            result_data = app.config["LAST_RESULT"]
            engine = CheckEngine(work_dir=str(work_dir))

            from .exporter import Exporter
            from .models import (
                GradingBatch,
                CheckResult,
                Issue,
                IssueSeverity,
                IssueType,
                RoomStatistics,
            )

            batch_info = result_data.get("batch_info", {})
            grading_batch = GradingBatch(
                batch_id=batch_info.get("batch_id", ""),
                exam_name=batch_info.get("exam_name", ""),
                exam_date=batch_info.get("exam_date", ""),
                course_code=batch_info.get("course_code", ""),
                course_name=batch_info.get("course_name", ""),
                total_students=batch_info.get("total_students", 0),
                rooms=batch_info.get("rooms", []),
            )

            result = CheckResult(
                batch_id=grading_batch.batch_id,
                generated_at=datetime.now(),
                statistics={},
                all_issues=[],
                scanned_sheets={},
                student_roster={},
                absent_records={},
                grading_batch=grading_batch,
                remark_store=result_data.get("remarks", {}),
            )

            issues_data = result_data.get("issues", {})
            all_issues = []

            severity_map = {
                "critical": IssueSeverity.CRITICAL,
                "major": IssueSeverity.MAJOR,
                "minor": IssueSeverity.MINOR,
            }

            for severity_str, issues_list in issues_data.items():
                severity = severity_map.get(severity_str, IssueSeverity.MAJOR)
                for issue_data in issues_list:
                    issue_type_str = issue_data.get("issue_type", "")
                    try:
                        issue_type = IssueType(issue_type_str)
                    except ValueError:
                        continue

                    issue = Issue(
                        issue_type=issue_type,
                        severity=severity,
                        description=issue_data.get("description", ""),
                        affected_barcodes=issue_data.get("affected_barcodes", []),
                        affected_files=issue_data.get("affected_files", []),
                        room_number=issue_data.get("room_number"),
                        recommendation=issue_data.get("recommendation"),
                        notes=issue_data.get("notes"),
                    )
                    all_issues.append(issue)

            result.all_issues = all_issues

            stats_data = result_data.get("statistics", {})
            statistics = {}
            for room, stat_dict in stats_data.items():
                stats = RoomStatistics(
                    room_number=room,
                    total_students=stat_dict.get("total_students", 0),
                    present_students=stat_dict.get("present_students", 0),
                    absent_students=stat_dict.get("absent_students", 0),
                    scanned_sheets=stat_dict.get("scanned_sheets", 0),
                    missing_sheets=stat_dict.get("missing_sheets", 0),
                    duplicate_count=stat_dict.get("duplicate_count", 0),
                    issues=[],
                )
                statistics[room] = stats
            result.statistics = statistics

            output_path = work_dir / export_dir
            md_path, json_path = Exporter.export_result(
                result=result,
                output_dir=str(output_path),
                base_name=base_name,
            )

            return jsonify({
                "success": True,
                "md_path": md_path,
                "json_path": json_path,
            })

        except Exception as e:
            return jsonify({"success": False, "error": str(e)})

    return app
