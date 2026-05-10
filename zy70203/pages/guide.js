window.GuidePage = {};

window.GuidePage.render = function() {
    const container = document.getElementById('page-guide');

    container.innerHTML = `
        <div class="page-header">
            <h2 class="page-title">使用说明</h2>
        </div>

        <div class="guide-content">
            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">1</span>
                    <h3>建立居民档案</h3>
                </div>
                <div class="guide-steps">
                    <div class="guide-step-item">
                        <span class="guide-step-number">1.1</span>
                        <div class="guide-step-content">
                            <h4>新建居民档案</h4>
                            <p>点击"居民档案"页面的 新建居民 按钮</p>
                            <p>填写 <strong>姓名、身份证号、性别、出生日期、联系电话</strong> 等基本信息</p>
                            <p>勾选 <strong>高血压病史、糖尿病史</strong> 等慢性病信息（会影响风险评估）</p>
                        </div>
                    </div>
                    <div class="guide-step-item">
                        <span class="guide-step-number">1.2</span>
                        <div class="guide-step-content">
                            <h4>批量导入居民档案</h4>
                            <p>点击 导入 按钮，上传 CSV 文件</p>
                            <p>CSV 格式：姓名,身份证号,性别,出生日期,联系电话,家庭住址,社区,高血压病史,糖尿病史</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">2</span>
                    <h3>血压筛查与风险分层</h3>
                </div>
                <div class="guide-steps">
                    <div class="guide-step-item">
                        <span class="guide-step-number">2.1</span>
                        <div class="guide-step-content">
                            <h4>录入筛查数据</h4>
                            <p>点击"筛查记录"页面的 录入血压 按钮</p>
                            <p>选择居民，输入 <strong>收缩压、舒张压</strong>，实时显示风险预估</p>
                        </div>
                    </div>
                    <div class="guide-step-item">
                        <span class="guide-step-number">2.2</span>
                        <div class="guide-step-content">
                            <h4>风险复核</h4>
                            <p>在"筛查记录"页面筛选 <strong>待复核</strong> 状态的记录</p>
                            <p>点击 复核 按钮</p>
                            <p>有两种复核结果：</p>
                            <ul>
                                <li><strong>确认风险</strong>：标记为"需复测"，转入复测流程</li>
                                <li><strong>标记正常</strong>：直接结案</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">3</span>
                    <h3>复测闭环管理</h3>
                </div>
                <div class="guide-steps">
                    <div class="guide-step-item">
                        <span class="guide-step-number">3.1</span>
                        <div class="guide-step-content">
                            <h4>创建复测任务</h4>
                            <p>在"筛查记录"页面，对"需复测"状态的记录点击 创建复测 按钮</p>
                            <p>设置 <strong>复测日期、时间、地点、负责人</strong></p>
                        </div>
                    </div>
                    <div class="guide-step-item">
                        <span class="guide-step-number">3.2</span>
                        <div class="guide-step-content">
                            <h4>执行复测</h4>
                            <p>在"复测管理"页面查看待复测任务</p>
                            <p>点击 录入结果 按钮</p>
                            <p>输入复测血压值，系统实时预估风险</p>
                            <p>两种复测结果：</p>
                            <ul>
                                <li><strong>复测正常</strong>：筛查记录自动结案</li>
                                <li><strong>仍异常</strong>：需转入随访管理</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">4</span>
                    <h3>随访责任分配</h3>
                </div>
                <div class="guide-steps">
                    <div class="guide-step-item">
                        <span class="guide-step-number">4.1</span>
                        <div class="guide-step-content">
                            <h4>创建随访任务</h4>
                            <p>在"复测管理"页面，对"仍异常"的复测记录点击 创建随访 按钮</p>
                            <p>选择 <strong>随访责任人</strong>，设置优先级和计划随访日期</p>
                        </div>
                    </div>
                    <div class="guide-step-item">
                        <span class="guide-step-number">4.2</span>
                        <div class="guide-step-content">
                            <h4>随访进展记录</h4>
                            <p>在"随访管理"页面查看随访任务</p>
                            <p>点击 添加随访 按钮</p>
                            <p>完成或转诊后，筛查记录自动结案</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">5</span>
                    <h3>数据看板与报表导出</h3>
                </div>
                <div class="guide-steps">
                    <div class="guide-step-item">
                        <span class="guide-step-number">5.1</span>
                        <div class="guide-step-content">
                            <h4>查看数据看板</h4>
                            <p>"数据看板"页面展示核心指标：</p>
                            <ul>
                                <li><strong>流程进度指示器</strong>：筛查 → 复核 → 复测 → 随访 → 结案</li>
                                <li><strong>统计卡片</strong>：居民数、筛查数、待复核、待复测、待随访</li>
                                <li><strong>风险分布图</strong>：高危/中危/低危/正常比例</li>
                                <li><strong>最近活动时间线</strong>：最新操作记录</li>
                            </ul>
                        </div>
                    </div>
                    <div class="guide-step-item">
                        <span class="guide-step-number">5.2</span>
                        <div class="guide-step-content">
                            <h4>导出数据报表</h4>
                            <p>各页面右上角的 导出 按钮可导出 CSV 文件</p>
                            <p>可导出：居民档案、筛查记录、复测记录、随访记录、汇总统计报表</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="guide-section">
                <div class="guide-section-header">
                    <span class="guide-step">6</span>
                    <h3>快速上手示例</h3>
                </div>
                <div class="quick-start">
                    <div class="quick-start-card">
                        <h4>📋 完整流程演练</h4>
                        <ol>
                            <li><strong>新建居民</strong>：张三，身份证 110101198001011234，勾选高血压病史</li>
                            <li><strong>录入筛查</strong>：选择张三，血压 165/95（自动判定中危 → 待复核）</li>
                            <li><strong>风险复核</strong>：点击"确认风险" → 状态变为"需复测"</li>
                            <li><strong>创建复测</strong>：设置明天上午 9:00 复测</li>
                            <li><strong>录入复测结果</strong>：血压 150/90（仍异常）</li>
                            <li><strong>创建随访</strong>：分配给张医生，高优先级</li>
                            <li><strong>添加随访记录</strong>：记录血压 145/85，服药依从性良好</li>
                            <li><strong>完成随访</strong>：设置状态为"已完成"</li>
                            <li><strong>查看数据看板</strong>：观察流程进度和风险分布</li>
                            <li><strong>导出报表</strong>：导出各类型数据用于汇报</li>
                        </ol>
                    </div>
                    <div class="quick-start-card">
                        <h4>💡 数据持久化说明</h4>
                        <p>所有数据存储在浏览器的 <strong>localStorage</strong> 中</p>
                        <ul>
                            <li>刷新页面数据不会丢失</li>
                            <li>关闭浏览器后再次打开，数据仍然存在</li>
                            <li>清除浏览器缓存会清空数据（建议定期导出备份）</li>
                            <li>数据仅存储在当前浏览器，不会同步到其他设备</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    `;
};
