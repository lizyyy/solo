// 身体小电量 - 主应用逻辑文件

// 全局状态
let currentState = {
    selectedBodyPart: null,
    selectedSymptoms: [],
    painLevel: 3,
    currentAnalysis: null,
    checkinPainLevel: 3,
    currentGuideTab: 'head',
    currentPostTab: 'all',
    currentCommentPostId: null,
    currentSharePostId: null
};

// ==========================================
// 应用初始化
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    initApp();
});

function initApp() {
    // 初始化首页
    renderBodyParts();
    
    // 显示随机治愈语录
    showRandomQuote();
    
    // 初始化当前电量显示
    updateBatteryDisplay();
    
    // 初始化今日日期
    updateTodayDate();
    
    // 初始化打卡部位选择器
    initCheckinBodyParts();
    
    // 初始化健康指南
    renderHealthGuide(currentState.currentGuideTab);
    
    // 初始化饮食指南
    renderDietGuide();
    
    // 初始化提醒设置
    initReminders();
    
    // 加载用户资料
    loadProfile();
    
    // 加载统计数据
    loadStats();
    
    // 加载日记列表
    renderDiaryList();
    
    // 加载打卡记录
    renderCheckinList();
    
    // 加载帖子列表
    renderPosts(currentState.currentPostTab);
    
    // 设置事件监听器
    setupEventListeners();
}

// ==========================================
// 页面导航
// ==========================================
function showPage(pageName) {
    // 隐藏所有页面
    const allPages = document.querySelectorAll('.page');
    allPages.forEach(page => {
        page.classList.remove('active');
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    // 更新导航栏状态
    updateNavState(pageName);
    
    // 页面切换时的特定逻辑
    switch(pageName) {
        case 'home':
            updateBatteryDisplay();
            showRandomQuote();
            break;
        case 'diary':
            renderDiaryList();
            renderCheckinList();
            break;
        case 'health':
            renderHealthGuide(currentState.currentGuideTab);
            renderDietGuide();
            break;
        case 'profile':
            loadProfile();
            loadStats();
            break;
        case 'social':
            renderPosts(currentState.currentPostTab);
            break;
    }
    
    // 关闭移动端菜单
    closeMobileMenu();
}

function updateNavState(pageName) {
    // 更新桌面端导航
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });
    
    // 更新移动端导航
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) {
            link.classList.add('active');
        }
    });
}

// 移动端菜单
function toggleMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.toggle('hidden');
    mobileMenu.classList.toggle('active');
}

function closeMobileMenu() {
    const mobileMenu = document.getElementById('mobile-menu');
    mobileMenu.classList.add('hidden');
    mobileMenu.classList.remove('active');
}

// ==========================================
// 首页功能
// ==========================================
function renderBodyParts() {
    const bodyGrid = document.getElementById('body-grid');
    if (!bodyGrid) return;
    
    bodyGrid.innerHTML = '';
    
    bodyParts.forEach(part => {
        const btn = document.createElement('div');
        btn.className = 'body-part-btn';
        btn.onclick = () => selectBodyPart(part.id);
        btn.innerHTML = `
            <span class="body-part-icon">${part.icon}</span>
            <span class="body-part-name">${part.name}</span>
        `;
        bodyGrid.appendChild(btn);
    });
}

function selectBodyPart(partId) {
    currentState.selectedBodyPart = partId;
    currentState.selectedSymptoms = [];
    currentState.painLevel = 3;
    
    // 渲染症状页面
    renderSymptomsPage(partId);
    
    // 跳转到症状页面
    showPage('symptoms');
}

function showRandomQuote() {
    const quoteElement = document.getElementById('daily-quote');
    if (quoteElement) {
        quoteElement.textContent = `"${Utils.getRandomQuote()}"`;
    }
}

function updateBatteryDisplay() {
    const battery = DataManager.getCurrentBattery();
    const mainBattery = document.getElementById('main-battery');
    
    if (mainBattery) {
        const level = mainBattery.querySelector('.battery-level');
        const percentage = mainBattery.querySelector('.battery-percentage');
        
        if (level) {
            level.style.width = `${battery}%`;
            // 根据电量设置颜色
            if (battery >= 70) {
                level.style.background = 'linear-gradient(to right, var(--success-color), #34d399)';
            } else if (battery >= 40) {
                level.style.background = 'linear-gradient(to right, var(--warning-color), #fbbf24)';
            } else {
                level.style.background = 'linear-gradient(to right, var(--danger-color), #f87171)';
            }
        }
        if (percentage) {
            percentage.textContent = `${battery}%`;
        }
    }
}

// ==========================================
// 症状选择页面
// ==========================================
function renderSymptomsPage(partId) {
    const part = bodyParts.find(p => p.id === partId);
    if (!part) return;
    
    // 更新页面标题
    const titleElement = document.getElementById('symptom-page-title');
    if (titleElement) {
        titleElement.textContent = `${part.name}症状选择`;
    }
    
    // 渲染症状列表
    const symptomsList = document.getElementById('symptoms-list');
    if (!symptomsList) return;
    
    symptomsList.innerHTML = '';
    
    part.symptoms.forEach((symptom, index) => {
        const option = document.createElement('div');
        option.className = 'symptom-option';
        option.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleSymptom(symptom, option);
        };
        option.innerHTML = `
            <input type="checkbox" id="symptom-${index}" value="${symptom}" onclick="event.stopPropagation()">
            <span class="symptom-label">${symptom}</span>
        `;
        symptomsList.appendChild(option);
    });
    
    // 重置疼痛程度选择
    resetPainLevel();
}

function toggleSymptom(symptom, element) {
    const checkbox = element.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    
    if (checkbox.checked) {
        currentState.selectedSymptoms.push(symptom);
        element.classList.add('selected');
    } else {
        currentState.selectedSymptoms = currentState.selectedSymptoms.filter(s => s !== symptom);
        element.classList.remove('selected');
    }
}

function selectPainLevel(level) {
    currentState.painLevel = level;
    
    // 更新UI
    const painLevels = document.querySelectorAll('#pain-scale .pain-level');
    painLevels.forEach((el, index) => {
        if (index + 1 === level) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function resetPainLevel() {
    currentState.painLevel = 3;
    selectPainLevel(3);
}

// ==========================================
// 提交分析
// ==========================================
function submitSymptoms() {
    // 验证
    if (currentState.selectedSymptoms.length === 0) {
        showToast('请至少选择一个症状');
        return;
    }
    
    const duration = parseInt(document.getElementById('duration-days').value) || 1;
    const description = document.getElementById('symptom-description').value || '';
    
    // 生成分析
    const analysis = healthAnalysis.generateAnalysis(
        currentState.selectedBodyPart,
        currentState.selectedSymptoms,
        currentState.painLevel,
        duration,
        description
    );
    
    currentState.currentAnalysis = {
        ...analysis,
        bodyPart: currentState.selectedBodyPart,
        symptoms: [...currentState.selectedSymptoms],
        painLevel: currentState.painLevel,
        duration: duration,
        description: description
    };
    
    // 更新电量
    DataManager.setCurrentBattery(analysis.battery);
    
    // 渲染结果页面
    renderResultPage(analysis);
    
    // 显示可爱动画
    showCuteAnimation();
    
    // 跳转到结果页面
    setTimeout(() => {
        showPage('result');
    }, 1500);
}

function renderResultPage(analysis) {
    // 更新电量显示
    const resultBattery = document.getElementById('result-battery');
    if (resultBattery) {
        const level = resultBattery.querySelector('.battery-level');
        const percentage = resultBattery.querySelector('.battery-percentage');
        
        if (level) {
            level.style.width = `${analysis.battery}%`;
            if (analysis.battery >= 70) {
                level.style.background = 'linear-gradient(to right, var(--success-color), #34d399)';
            } else if (analysis.battery >= 40) {
                level.style.background = 'linear-gradient(to right, var(--warning-color), #fbbf24)';
            } else {
                level.style.background = 'linear-gradient(to right, var(--danger-color), #f87171)';
            }
        }
        if (percentage) {
            percentage.textContent = `${analysis.battery}%`;
        }
    }
    
    // 更新电量状态
    const batteryStatus = document.getElementById('battery-status');
    if (batteryStatus) {
        if (analysis.battery >= 70) {
            batteryStatus.textContent = '电量充足，继续保持良好的生活习惯！';
        } else if (analysis.battery >= 40) {
            batteryStatus.textContent = '电量偏低，需要注意休息和调理';
        } else {
            batteryStatus.textContent = '电量较低，建议及时就医检查';
        }
    }
    
    // 渲染分析内容
    const analysisContent = document.getElementById('analysis-content');
    if (analysisContent) {
        analysisContent.innerHTML = analysis.content.map(p => `<p>${p}</p>`).join('');
    }
    
    // 渲染轻重判断
    const severityContent = document.getElementById('severity-content');
    if (severityContent) {
        severityContent.innerHTML = `
            <p>您的症状被判断为：<span class="${analysis.severityClass}">${analysis.severity}</span></p>
            <p>疼痛程度：${Utils.getPainLevelLabel(currentState.painLevel)}（${currentState.painLevel}/5级）</p>
            <p>持续时间：${currentState.currentAnalysis.duration}天</p>
            <p>建议：${analysis.severity === '轻度' ? '可以先居家观察，注意休息' : 
                   analysis.severity === '中度' ? '建议密切观察，如加重请就医' : 
                   '建议尽快就医检查'}</p>
        `;
    }
    
    // 渲染缓解办法
    const reliefContent = document.getElementById('relief-content');
    if (reliefContent) {
        let html = '';
        let currentSection = '';
        
        analysis.relief.forEach(tip => {
            if (tip.startsWith('**') && tip.endsWith('**')) {
                // 这是一个标题
                if (currentSection) {
                    html += '</ul>';
                }
                currentSection = tip.replace(/\*\*/g, '');
                html += `<p><strong>${currentSection}</strong></p><ul>`;
            } else {
                // 这是一个列表项
                html += `<li>${tip.replace('• ', '')}</li>`;
            }
        });
        
        if (currentSection) {
            html += '</ul>';
        }
        
        reliefContent.innerHTML = html;
    }
    
    // 渲染饮食建议
    const dietContent = document.getElementById('diet-content');
    if (dietContent) {
        let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">';
        
        // 忌口食物
        html += '<div><h4 style="color: var(--danger-color); margin-bottom: 0.75rem;">🚫 忌口食物</h4><ul style="margin-left: 1.5rem;">';
        analysis.diet.avoid.forEach(food => {
            html += `<li style="margin-bottom: 0.5rem;"><strong>${food.name}</strong> - ${food.desc}</li>`;
        });
        html += '</ul></div>';
        
        // 推荐食物
        html += '<div><h4 style="color: var(--success-color); margin-bottom: 0.75rem;">✅ 推荐食物</h4><ul style="margin-left: 1.5rem;">';
        analysis.diet.recommend.forEach(food => {
            html += `<li style="margin-bottom: 0.5rem;"><strong>${food.name}</strong> - ${food.desc}</li>`;
        });
        html += '</ul></div>';
        
        html += '</div>';
        dietContent.innerHTML = html;
    }
    
    // 渲染就医建议
    const medicalContent = document.getElementById('medical-content');
    if (medicalContent) {
        medicalContent.innerHTML = `
            <p style="margin-bottom: 0.75rem;">
                <strong>${analysis.medical.need ? '⚠️ 建议就医' : '💡 可先观察'}</strong>
            </p>
            ${analysis.medical.advice}
        `;
    }
    
    // 更新结果页语录
    const resultQuote = document.getElementById('result-quote');
    if (resultQuote) {
        resultQuote.textContent = `"${Utils.getRandomQuote()}"`;
    }
}

function showCuteAnimation() {
    const container = document.getElementById('animation-container');
    const text = document.getElementById('animation-text');
    
    const messages = ['病痛退散！', '身体棒棒！', '健康快乐！', '元气满满！'];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    
    if (text) {
        text.textContent = randomMessage;
    }
    
    if (container) {
        container.classList.remove('hidden');
        
        setTimeout(() => {
            container.classList.add('hidden');
        }, 1500);
    }
}

// ==========================================
// 保存到日记
// ==========================================
function saveToDiary() {
    if (!currentState.currentAnalysis) {
        showToast('没有可保存的分析结果');
        return;
    }
    
    const part = bodyParts.find(p => p.id === currentState.selectedBodyPart);
    
    const diaryEntry = {
        bodyPart: currentState.selectedBodyPart,
        bodyPartName: part ? part.name : '未知',
        symptoms: currentState.currentAnalysis.symptoms,
        painLevel: currentState.currentAnalysis.painLevel,
        duration: currentState.currentAnalysis.duration,
        description: currentState.currentAnalysis.description,
        analysis: currentState.currentAnalysis,
        battery: currentState.currentAnalysis.battery
    };
    
    DataManager.saveDiary(diaryEntry);
    
    // 保存日记后，更新综合身体电量
    const newOverallBattery = DataManager.updateOverallBattery();
    
    showToast(`已保存到身体日记！当前电量：${newOverallBattery}%`);
    showPage('diary');
}

// ==========================================
// 身体日记功能
// ==========================================
function renderDiaryList() {
    const diaryList = document.getElementById('diary-list');
    if (!diaryList) return;
    
    const diaries = DataManager.getDiaries();
    
    if (diaries.length === 0) {
        diaryList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p class="empty-text">还没有身体日记记录</p>
                <p class="empty-hint">开始健康自查，记录你的身体状况吧！</p>
            </div>
        `;
        return;
    }
    
    diaryList.innerHTML = '';
    
    diaries.forEach(diary => {
        const item = document.createElement('div');
        item.className = 'diary-item';
        
        const painClass = Utils.getPainLevelClass(diary.painLevel);
        const painLabel = Utils.getPainLevelLabel(diary.painLevel);
        
        item.innerHTML = `
            <div class="diary-item-header">
                <span class="diary-item-title">${diary.bodyPartName}不适</span>
                <span class="diary-item-date">${Utils.formatDate(diary.createdAt)}</span>
            </div>
            <div class="diary-item-content">
                <p>症状：${diary.symptoms.join('、')}</p>
                <p>疼痛程度：${painLabel} | 持续${diary.duration}天</p>
                ${diary.description ? `<p>描述：${diary.description}</p>` : ''}
            </div>
            <div class="diary-item-battery">
                🔋 身体电量：${diary.battery}%
            </div>
        `;
        
        diaryList.appendChild(item);
    });
}

// ==========================================
// 疼痛打卡功能
// ==========================================
function initCheckinBodyParts() {
    const select = document.getElementById('checkin-body-part');
    if (!select) return;
    
    select.innerHTML = '<option value="">请选择部位</option>';
    
    bodyParts.forEach(part => {
        const option = document.createElement('option');
        option.value = part.id;
        option.textContent = part.name;
        select.appendChild(option);
    });
}

function updateTodayDate() {
    const dateElement = document.getElementById('today-date');
    if (dateElement) {
        dateElement.textContent = Utils.getTodayDate();
    }
}

function selectCheckinPain(level) {
    currentState.checkinPainLevel = level;
    
    const painLevels = document.querySelectorAll('#checkin-pain-scale .pain-level');
    painLevels.forEach((el, index) => {
        if (index + 1 === level) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
}

function submitPainCheckin() {
    const bodyPartSelect = document.getElementById('checkin-body-part');
    const durationInput = document.getElementById('checkin-duration');
    
    const bodyPartId = bodyPartSelect.value;
    const duration = parseInt(durationInput.value) || 1;
    
    if (!bodyPartId) {
        showToast('请选择疼痛部位');
        return;
    }
    
    const part = bodyParts.find(p => p.id === bodyPartId);
    
    const checkin = {
        bodyPart: bodyPartId,
        bodyPartName: part ? part.name : '未知',
        painLevel: currentState.checkinPainLevel,
        duration: duration
    };
    
    DataManager.saveCheckin(checkin);
    
    showToast('打卡成功！');
    
    // 刷新打卡记录
    renderCheckinList();
    
    // 重置表单
    bodyPartSelect.value = '';
    durationInput.value = '1';
    selectCheckinPain(3);
}

function renderCheckinList() {
    const checkinList = document.getElementById('checkin-list');
    if (!checkinList) return;
    
    const checkins = DataManager.getCheckins();
    
    if (checkins.length === 0) {
        checkinList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p class="empty-text">还没有疼痛打卡记录</p>
                <p class="empty-hint">开始记录你的疼痛情况吧！</p>
            </div>
        `;
        return;
    }
    
    checkinList.innerHTML = '';
    
    checkins.forEach(checkin => {
        const item = document.createElement('div');
        item.className = 'checkin-item';
        
        const painClass = Utils.getPainLevelClass(checkin.painLevel);
        const painLabel = Utils.getPainLevelLabel(checkin.painLevel);
        
        item.innerHTML = `
            <div class="checkin-item-header">
                <span class="checkin-item-title">${checkin.bodyPartName}疼痛</span>
                <span class="checkin-item-date">${Utils.formatDate(checkin.createdAt)}</span>
            </div>
            <div class="checkin-item-content">
                <p>持续${checkin.duration}天</p>
            </div>
            <div class="checkin-item-pain ${painClass}">
                疼痛程度：${painLabel}
            </div>
        `;
        
        checkinList.appendChild(item);
    });
}

// ==========================================
// 健康指南功能
// ==========================================
function switchGuideTab(tab) {
    currentState.currentGuideTab = tab;
    
    // 更新标签状态
    const tabs = document.querySelectorAll('.guide-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        if (t.textContent.toLowerCase().includes(tab) || 
            (tab === 'head' && t.textContent === '头部') ||
            (tab === 'eye' && t.textContent === '眼部') ||
            (tab === 'stomach' && t.textContent === '肠胃') ||
            (tab === 'muscle' && t.textContent === '肌肉')) {
            t.classList.add('active');
        }
    });
    
    renderHealthGuide(tab);
}

function renderHealthGuide(tab) {
    const content = document.getElementById('guide-content');
    if (!content) return;
    
    const guides = healthGuides[tab] || [];
    
    if (guides.length === 0) {
        content.innerHTML = '<p>暂无相关指南</p>';
        return;
    }
    
    content.innerHTML = guides.map(guide => `
        <div class="guide-item">
            <h4 class="guide-item-title">${guide.title}</h4>
            <p class="guide-item-content">${guide.content}</p>
        </div>
    `).join('');
}

function renderDietGuide() {
    const avoidList = document.getElementById('avoid-foods');
    const recommendList = document.getElementById('recommend-foods');
    
    if (avoidList) {
        avoidList.innerHTML = generalDietGuide.avoid.map(food => `
            <div class="diet-item">
                <span class="diet-item-emoji">${food.emoji}</span>
                <div class="diet-item-info">
                    <div class="diet-item-name">${food.name}</div>
                    <div class="diet-item-desc">${food.desc}</div>
                </div>
            </div>
        `).join('');
    }
    
    if (recommendList) {
        recommendList.innerHTML = generalDietGuide.recommend.map(food => `
            <div class="diet-item">
                <span class="diet-item-emoji">${food.emoji}</span>
                <div class="diet-item-info">
                    <div class="diet-item-name">${food.name}</div>
                    <div class="diet-item-desc">${food.desc}</div>
                </div>
            </div>
        `).join('');
    }
}

// ==========================================
// 提醒功能
// ==========================================
function initReminders() {
    const reminders = DataManager.getReminders();
    
    Object.keys(reminders).forEach(key => {
        const checkbox = document.getElementById(`${key}-reminder`);
        if (checkbox) {
            checkbox.checked = reminders[key];
        }
    });
}

function toggleReminder(type) {
    const checkbox = document.getElementById(`${type}-reminder`);
    if (!checkbox) return;
    
    const reminders = DataManager.getReminders();
    reminders[type] = checkbox.checked;
    DataManager.saveReminders(reminders);
    
    showToast(checkbox.checked ? '已开启提醒' : '已关闭提醒');
}

// ==========================================
// 身体数据功能
// ==========================================
function loadProfile() {
    const profile = DataManager.getProfile();
    
    // 填充表单
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const constitutionSelect = document.getElementById('constitution');
    
    if (heightInput && profile.height) {
        heightInput.value = profile.height;
    }
    
    if (weightInput && profile.weight) {
        weightInput.value = profile.weight;
    }
    
    if (constitutionSelect && profile.constitution) {
        constitutionSelect.value = profile.constitution;
    }
    
    // 性别
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        if (radio.value === profile.gender) {
            radio.checked = true;
        }
    });
    
    // 经期数据
    const lastPeriodInput = document.getElementById('last-period');
    const periodCycleInput = document.getElementById('period-cycle');
    const periodDurationInput = document.getElementById('period-duration');
    
    if (lastPeriodInput && profile.lastPeriod) {
        lastPeriodInput.value = profile.lastPeriod;
    }
    
    if (periodCycleInput && profile.periodCycle) {
        periodCycleInput.value = profile.periodCycle;
    }
    
    if (periodDurationInput && profile.periodDuration) {
        periodDurationInput.value = profile.periodDuration;
    }
    
    // 计算BMI
    calculateAndDisplayBMI();
    
    // 计算经期
    calculateAndDisplayPeriod();
    
    // 根据性别显示/隐藏经期部分
    toggleMenstrualSection(profile.gender === 'female');
}

function saveProfile() {
    const height = parseInt(document.getElementById('height').value) || 170;
    const weight = parseInt(document.getElementById('weight').value) || 65;
    const constitution = document.getElementById('constitution').value;
    
    // 获取选中的性别
    const selectedGender = document.querySelector('input[name="gender"]:checked');
    const gender = selectedGender ? selectedGender.value : 'female';
    
    const lastPeriod = document.getElementById('last-period').value;
    const periodCycle = parseInt(document.getElementById('period-cycle').value) || 28;
    const periodDuration = parseInt(document.getElementById('period-duration').value) || 5;
    
    const profile = {
        height,
        weight,
        constitution,
        gender,
        lastPeriod: lastPeriod || null,
        periodCycle,
        periodDuration
    };
    
    DataManager.saveProfile(profile);
    
    // 重新计算并显示
    calculateAndDisplayBMI();
    calculateAndDisplayPeriod();
    toggleMenstrualSection(gender === 'female');
    
    showToast('档案已保存！');
}

function calculateAndDisplayBMI() {
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    const bmiDisplay = document.getElementById('bmi-display');
    
    if (!heightInput || !weightInput || !bmiDisplay) return;
    
    const height = parseInt(heightInput.value) || 0;
    const weight = parseInt(weightInput.value) || 0;
    
    const bmi = Utils.calculateBMI(height, weight);
    
    bmiDisplay.textContent = `${bmi.value} (${bmi.status})`;
    
    // 移除所有样式类
    bmiDisplay.classList.remove('underweight', 'normal', 'overweight', 'obese');
    
    // 添加对应样式类
    if (bmi.class) {
        bmiDisplay.classList.add(bmi.class);
    }
}

function calculateAndDisplayPeriod() {
    const lastPeriodInput = document.getElementById('last-period');
    const periodCycleInput = document.getElementById('period-cycle');
    const nextPeriodSpan = document.getElementById('next-period');
    const periodStatusSpan = document.getElementById('period-status');
    
    if (!lastPeriodInput || !periodCycleInput || !nextPeriodSpan || !periodStatusSpan) return;
    
    const lastPeriod = lastPeriodInput.value;
    const cycleDays = parseInt(periodCycleInput.value) || 28;
    
    const periodInfo = Utils.calculatePeriod(lastPeriod, cycleDays);
    
    nextPeriodSpan.textContent = periodInfo.nextPeriod;
    periodStatusSpan.textContent = periodInfo.status;
}

function toggleMenstrualSection(show) {
    const section = document.getElementById('menstrual-section');
    if (section) {
        section.style.display = show ? 'block' : 'none';
    }
}

function loadStats() {
    const stats = DataManager.getStats();
    
    const avgBattery = document.getElementById('avg-battery');
    const checkCount = document.getElementById('check-count');
    const checkinDays = document.getElementById('checkin-days');
    const healthyDays = document.getElementById('healthy-days');
    
    if (avgBattery) avgBattery.textContent = `${stats.avgBattery}%`;
    if (checkCount) checkCount.textContent = stats.checkCount;
    if (checkinDays) checkinDays.textContent = stats.checkinDays;
    if (healthyDays) healthyDays.textContent = stats.healthyDays;
}

// ==========================================
// 社交圈功能
// ==========================================
function switchPostTab(tab) {
    currentState.currentPostTab = tab;
    
    // 更新标签状态
    const tabs = document.querySelectorAll('.post-tab');
    tabs.forEach(t => {
        t.classList.remove('active');
        const tabMap = {
            '全部': 'all',
            '养生经验': 'experience',
            '想法分享': 'thought',
            '健康问答': 'question'
        };
        if (tabMap[t.textContent] === tab) {
            t.classList.add('active');
        }
    });
    
    renderPosts(tab);
}

function renderPosts(tab) {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;
    
    let posts = DataManager.getPosts();
    
    // 过滤帖子
    if (tab !== 'all') {
        posts = posts.filter(p => p.type === tab);
    }
    
    if (posts.length === 0) {
        postsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p class="empty-text">暂无帖子</p>
                <p class="empty-hint">快来发布第一篇帖子吧！</p>
            </div>
        `;
        return;
    }
    
    postsContainer.innerHTML = posts.map(post => `
        <div class="post-card" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-avatar">${post.avatar || '用'}</div>
                <div class="post-user-info">
                    <div class="post-username">${post.username}</div>
                    <div class="post-time">${Utils.formatDate(post.createdAt)}</div>
                </div>
                <span class="post-type-tag ${Utils.getPostTypeClass(post.type)}">
                    ${Utils.getPostTypeLabel(post.type)}
                </span>
            </div>
            <div class="post-content">
                <h4 class="post-title">${post.title}</h4>
                <p class="post-text">${post.content.replace(/\n/g, '<br>')}</p>
            </div>
            ${post.tags && post.tags.length > 0 ? `
                <div class="post-tags">
                    ${post.tags.map(tag => `<span class="post-tag">#${tag}</span>`).join('')}
                </div>
            ` : ''}
            <div class="post-actions">
                <div class="post-action ${post.liked ? 'liked' : ''}" onclick="handleLikePost(${post.id})">
                    <span class="post-action-icon">${post.liked ? '❤️' : '🤍'}</span>
                    <span>${post.likes}</span>
                </div>
                <div class="post-action" onclick="handleCommentPost(${post.id})">
                    <span class="post-action-icon">💬</span>
                    <span>${post.comments}</span>
                </div>
                <div class="post-action" onclick="handleSharePost(${post.id})">
                    <span class="post-action-icon">🔗</span>
                    <span>${post.shares}</span>
                </div>
            </div>
        </div>
    `).join('');
}

function showNewPostModal() {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closePostModal() {
    const modal = document.getElementById('post-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    
    // 清空表单
    document.getElementById('post-type').value = 'experience';
    document.getElementById('post-title').value = '';
    document.getElementById('post-content').value = '';
    document.getElementById('post-tags').value = '';
}

function submitPost() {
    const type = document.getElementById('post-type').value;
    const title = document.getElementById('post-title').value.trim();
    const content = document.getElementById('post-content').value.trim();
    const tagsInput = document.getElementById('post-tags').value.trim();
    
    if (!title) {
        showToast('请输入帖子标题');
        return;
    }
    
    if (!content) {
        showToast('请输入帖子内容');
        return;
    }
    
    const tags = tagsInput ? tagsInput.split(/[,，]/).map(t => t.trim()).filter(t => t) : [];
    
    const post = {
        type,
        title,
        content,
        tags,
        username: '用户' + Math.floor(Math.random() * 1000),
        avatar: '我'
    };
    
    DataManager.savePost(post);
    
    showToast('帖子发布成功！');
    closePostModal();
    renderPosts(currentState.currentPostTab);
}

function handleLikePost(postId) {
    DataManager.likePost(postId);
    renderPosts(currentState.currentPostTab);
}

// ==========================================
// 评论功能
// ==========================================
function handleCommentPost(postId) {
    currentState.currentCommentPostId = postId;
    showCommentModal(postId);
}

function showCommentModal(postId) {
    const modal = document.getElementById('comment-modal');
    if (!modal) return;
    
    // 显示帖子预览
    const preview = document.getElementById('comment-post-preview');
    const posts = DataManager.getPosts();
    const post = posts.find(p => p.id === postId);
    
    if (post && preview) {
        preview.innerHTML = `
            <div class="post-header" style="padding: 0; margin-bottom: 0.75rem;">
                <div class="post-avatar" style="width: 36px; height: 36px; font-size: 1rem;">${post.avatar || '用'}</div>
                <div class="post-user-info">
                    <div class="post-username" style="font-size: 0.95rem;">${post.username}</div>
                    <div class="post-time" style="font-size: 0.8rem;">${Utils.formatDate(post.createdAt)}</div>
                </div>
            </div>
            <div class="post-content" style="padding: 0;">
                <h4 class="post-title" style="font-size: 1rem; margin-bottom: 0.5rem;">${post.title}</h4>
                <p class="post-text" style="font-size: 0.9rem;">${post.content.replace(/\n/g, '<br>')}</p>
            </div>
        `;
    }
    
    // 加载评论列表
    renderComments(postId);
    
    // 清空评论输入框
    const input = document.getElementById('comment-input');
    if (input) {
        input.value = '';
    }
    
    modal.classList.remove('hidden');
}

function closeCommentModal() {
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentState.currentCommentPostId = null;
}

function renderComments(postId) {
    const commentsList = document.getElementById('comments-list');
    if (!commentsList) return;
    
    const comments = DataManager.getComments(postId);
    
    if (comments.length === 0) {
        commentsList.innerHTML = `
            <div class="comment-empty">
                <p>暂无评论，快来发表第一条评论吧！</p>
            </div>
        `;
        return;
    }
    
    commentsList.innerHTML = comments.map(comment => `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-avatar">${comment.avatar || '用'}</div>
                <div class="comment-user-info">
                    <div class="comment-username">${comment.username}</div>
                    <div class="comment-time">${Utils.formatDate(comment.createdAt)}</div>
                </div>
            </div>
            <div class="comment-content">${comment.content}</div>
        </div>
    `).join('');
}

function submitComment() {
    const postId = currentState.currentCommentPostId;
    if (!postId) {
        showToast('请先选择要评论的帖子');
        return;
    }
    
    const input = document.getElementById('comment-input');
    if (!input) return;
    
    const content = input.value.trim();
    if (!content) {
        showToast('请输入评论内容');
        return;
    }
    
    const comment = {
        content,
        username: '用户' + Math.floor(Math.random() * 1000),
        avatar: '我'
    };
    
    DataManager.addComment(postId, comment);
    
    showToast('评论发布成功！');
    
    // 刷新评论列表
    renderComments(postId);
    
    // 清空输入框
    input.value = '';
    
    // 刷新帖子列表以更新评论数
    renderPosts(currentState.currentPostTab);
}

// ==========================================
// 分享功能
// ==========================================
function handleSharePost(postId) {
    currentState.currentSharePostId = postId;
    showShareModal(postId);
}

function showShareModal(postId) {
    const modal = document.getElementById('share-modal');
    if (!modal) return;
    
    // 设置分享链接
    const linkInput = document.getElementById('share-link-input');
    if (linkInput) {
        linkInput.value = `${window.location.origin}${window.location.pathname}?post=${postId}`;
    }
    
    modal.classList.remove('hidden');
}

function closeShareModal() {
    const modal = document.getElementById('share-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentState.currentSharePostId = null;
}

function shareToWeChat() {
    showToast('请截图分享到微信');
    updateShareCount();
}

function shareToWeibo() {
    showToast('请截图分享到微博');
    updateShareCount();
}

function shareToQQ() {
    showToast('请截图分享到QQ');
    updateShareCount();
}

function copyLink() {
    const linkInput = document.getElementById('share-link-input');
    if (!linkInput) return;
    
    // 选择文本
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    
    // 尝试复制到剪贴板
    try {
        document.execCommand('copy');
        showToast('链接已复制到剪贴板！');
        updateShareCount();
    } catch (err) {
        // 现代浏览器API
        navigator.clipboard.writeText(linkInput.value).then(() => {
            showToast('链接已复制到剪贴板！');
            updateShareCount();
        }).catch(() => {
            showToast('复制失败，请手动复制');
        });
    }
}

function updateShareCount() {
    const postId = currentState.currentSharePostId;
    if (postId) {
        DataManager.sharePost(postId);
        renderPosts(currentState.currentPostTab);
    }
}

// ==========================================
// 事件监听器
// ==========================================
function setupEventListeners() {
    // 身高体重变化时计算BMI
    const heightInput = document.getElementById('height');
    const weightInput = document.getElementById('weight');
    
    if (heightInput) {
        heightInput.addEventListener('input', calculateAndDisplayBMI);
    }
    
    if (weightInput) {
        weightInput.addEventListener('input', calculateAndDisplayBMI);
    }
    
    // 性别变化时显示/隐藏经期部分
    const genderRadios = document.querySelectorAll('input[name="gender"]');
    genderRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            toggleMenstrualSection(this.value === 'female');
        });
    });
    
    // 经期数据变化时重新计算
    const lastPeriodInput = document.getElementById('last-period');
    const periodCycleInput = document.getElementById('period-cycle');
    
    if (lastPeriodInput) {
        lastPeriodInput.addEventListener('change', calculateAndDisplayPeriod);
    }
    
    if (periodCycleInput) {
        periodCycleInput.addEventListener('change', calculateAndDisplayPeriod);
    }
    
    // 点击弹窗外部关闭 - 发布帖子弹窗
    const postModal = document.getElementById('post-modal');
    if (postModal) {
        postModal.addEventListener('click', function(e) {
            if (e.target === postModal) {
                closePostModal();
            }
        });
    }
    
    // 点击弹窗外部关闭 - 评论弹窗
    const commentModal = document.getElementById('comment-modal');
    if (commentModal) {
        commentModal.addEventListener('click', function(e) {
            if (e.target === commentModal) {
                closeCommentModal();
            }
        });
    }
    
    // 点击弹窗外部关闭 - 分享弹窗
    const shareModal = document.getElementById('share-modal');
    if (shareModal) {
        shareModal.addEventListener('click', function(e) {
            if (e.target === shareModal) {
                closeShareModal();
            }
        });
    }
}

// ==========================================
// 工具函数
// ==========================================
function showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--primary-color);
        color: white;
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        z-index: 9999;
        animation: slideDown 0.3s ease;
        font-weight: 500;
    `;
    toast.textContent = message;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from {
                opacity: 0;
                transform: translateX(-50%) translateY(-20px);
            }
            to {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // 3秒后移除
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease reverse';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 2500);
}

// 导出供全局使用
window.showPage = showPage;
window.selectBodyPart = selectBodyPart;
window.toggleSymptom = toggleSymptom;
window.selectPainLevel = selectPainLevel;
window.submitSymptoms = submitSymptoms;
window.saveToDiary = saveToDiary;
window.selectCheckinPain = selectCheckinPain;
window.submitPainCheckin = submitPainCheckin;
window.switchGuideTab = switchGuideTab;
window.toggleReminder = toggleReminder;
window.saveProfile = saveProfile;
window.switchPostTab = switchPostTab;
window.showNewPostModal = showNewPostModal;
window.closePostModal = closePostModal;
window.submitPost = submitPost;
window.handleLikePost = handleLikePost;
window.handleCommentPost = handleCommentPost;
window.closeCommentModal = closeCommentModal;
window.submitComment = submitComment;
window.handleSharePost = handleSharePost;
window.closeShareModal = closeShareModal;
window.shareToWeChat = shareToWeChat;
window.shareToWeibo = shareToWeibo;
window.shareToQQ = shareToQQ;
window.copyLink = copyLink;
window.toggleMobileMenu = toggleMobileMenu;