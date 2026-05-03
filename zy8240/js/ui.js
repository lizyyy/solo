const UI = (function() {
    'use strict';
    
    let timelineChart = null;
    
    function initEventListeners(appState) {
        const fileUploadArea = document.getElementById('fileUploadArea');
        const fileInput = document.getElementById('fileInput');
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        const loadSampleDataBtn = document.getElementById('loadSampleDataBtn');
        const importDataBtn = document.getElementById('importDataBtn');
        const exportReportBtn = document.getElementById('exportReportBtn');
        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        
        selectFilesBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', (e) => {
            handleFileSelection(e.target.files, appState);
        });
        
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });
        
        fileUploadArea.addEventListener('dragleave', () => {
            fileUploadArea.classList.remove('dragover');
        });
        
        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
            handleFileSelection(e.dataTransfer.files, appState);
        });
        
        loadSampleDataBtn.addEventListener('click', () => {
            loadSampleData(appState);
        });
        
        importDataBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        exportReportBtn.addEventListener('click', () => {
            if (appState.dataLoaded) {
                const report = ReportExporter.generateReport(
                    appState.shelters,
                    appState.evacuees,
                    appState.supplyRules,
                    appState.issues,
                    appState.statistics
                );
                downloadFile(report, 'review_report.md', 'text/markdown');
            } else {
                alert('请先加载数据');
            }
        });
        
        applyFiltersBtn.addEventListener('click', () => {
            applyFilters(appState);
        });
        
        ['shelterSelect', 'startTime', 'endTime', 
         'filterOverCapacity', 'filterSupplyShortage', 
         'filterDuplicate', 'filterMidnight'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener('change', () => {
                    updateFilterPreview(appState);
                });
            }
        });
    }
    
    function handleFileSelection(files, appState) {
        const fileList = document.getElementById('fileList');
        const uploadedFiles = document.getElementById('uploadedFiles');
        
        fileList.innerHTML = '';
        
        Array.from(files).forEach(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const content = e.target.result;
                const result = DataParser.parseByExtension(content, extension);
                
                if (result.success) {
                    storeParsedData(result.data, extension, file.name, appState);
                    
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span>${file.name}</span>
                        <span class="file-type ${extension}">.${extension.toUpperCase()}</span>
                    `;
                    fileList.appendChild(li);
                    
                    uploadedFiles.classList.add('visible');
                    checkDataCompleteness(appState);
                } else {
                    alert(`解析文件 ${file.name} 时出错: ${result.error}`);
                }
            };
            
            reader.readAsText(file);
        });
    }
    
    function storeParsedData(data, extension, filename, appState) {
        const filenameLower = filename.toLowerCase();
        
        if (filenameLower.includes('shelter') || extension === 'json') {
            const validation = DataParser.validateSheltersData(data);
            if (validation.valid) {
                appState.shelters = data;
                appState.filesLoaded.shelters = true;
            } else {
                alert(`shelters.json 格式错误: ${validation.error}`);
            }
        } else if (filenameLower.includes('evacuee') || extension === 'csv') {
            const validation = DataParser.validateEvacueesData(data);
            if (validation.valid) {
                appState.evacuees = data;
                appState.filesLoaded.evacuees = true;
            } else {
                alert(`evacuees.csv 格式错误: ${validation.error}`);
            }
        } else if (filenameLower.includes('supply') || extension === 'yaml' || extension === 'yml') {
            const validation = DataParser.validateSupplyRulesData(data);
            if (validation.valid) {
                appState.supplyRules = data;
                appState.filesLoaded.supplyRules = true;
            } else {
                alert(`supply_rules.yaml 格式错误: ${validation.error}`);
            }
        }
    }
    
    function checkDataCompleteness(appState) {
        const { shelters, evacuees, supplyRules } = appState.filesLoaded;
        
        if (shelters && evacuees && supplyRules) {
            processLoadedData(appState);
        }
    }
    
    function loadSampleData(appState) {
        fetch('data/shelters.json')
            .then(response => response.json())
            .then(sheltersData => {
                appState.shelters = sheltersData;
                appState.filesLoaded.shelters = true;
                
                return fetch('data/evacuees.csv');
            })
            .then(response => response.text())
            .then(csvContent => {
                const csvResult = DataParser.parseCSV(csvContent);
                if (csvResult.success) {
                    appState.evacuees = csvResult.data;
                    appState.filesLoaded.evacuees = true;
                }
                
                return fetch('data/supply_rules.yaml');
            })
            .then(response => response.text())
            .then(yamlContent => {
                const yamlResult = DataParser.parseYAML(yamlContent);
                if (yamlResult.success) {
                    appState.supplyRules = yamlResult.data;
                    appState.filesLoaded.supplyRules = true;
                }
                
                processLoadedData(appState);
            })
            .catch(error => {
                console.error('加载示例数据失败:', error);
                alert('加载示例数据失败，请确保data目录下有示例数据文件');
            });
    }
    
    function processLoadedData(appState) {
        appState.issues = RuleEngine.runAllChecks(
            appState.shelters,
            appState.evacuees,
            appState.supplyRules
        );
        
        appState.shelterStates = StateCalculator.calculateShelterStates(
            appState.shelters,
            appState.evacuees,
            appState.supplyRules,
            appState.issues
        );
        
        appState.timelineEvents = StateCalculator.generateTimelineEvents(
            appState.shelters,
            appState.evacuees,
            appState.issues
        );
        
        appState.statistics = StateCalculator.calculateStatistics(
            appState.shelterStates,
            appState.evacuees,
            appState.issues
        );
        
        appState.dataLoaded = true;
        appState.filteredData = {
            evacuees: [...appState.evacuees],
            issues: [...appState.issues],
            timelineEvents: [...appState.timelineEvents]
        };
        
        enableFilters(appState);
        updateDashboard(appState);
        updateTimeline(appState);
        updateTables(appState);
    }
    
    function enableFilters(appState) {
        const shelterSelect = document.getElementById('shelterSelect');
        const startTime = document.getElementById('startTime');
        const endTime = document.getElementById('endTime');
        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        
        shelterSelect.innerHTML = '<option value="all">全部避难点</option>';
        appState.shelters.forEach(shelter => {
            const option = document.createElement('option');
            option.value = shelter.id;
            option.textContent = shelter.name;
            shelterSelect.appendChild(option);
        });
        
        const arrivalTimes = appState.evacuees
            .map(e => e.arrival_time)
            .filter(t => t)
            .map(t => new Date(t))
            .filter(d => !isNaN(d.getTime()))
            .sort((a, b) => a - b);
        
        if (arrivalTimes.length > 0) {
            const earliest = arrivalTimes[0];
            const latest = arrivalTimes[arrivalTimes.length - 1];
            
            startTime.value = formatDateTimeLocal(earliest);
            endTime.value = formatDateTimeLocal(latest);
        }
        
        shelterSelect.disabled = false;
        startTime.disabled = false;
        endTime.disabled = false;
        applyFiltersBtn.disabled = false;
    }
    
    function formatDateTimeLocal(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
    
    function applyFilters(appState) {
        const shelterId = document.getElementById('shelterSelect').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        
        const filterOptions = {
            filterOverCapacity: document.getElementById('filterOverCapacity').checked,
            filterSupplyShortage: document.getElementById('filterSupplyShortage').checked,
            filterDuplicate: document.getElementById('filterDuplicate').checked,
            filterMidnight: document.getElementById('filterMidnight').checked
        };
        
        let filteredData = {
            evacuees: [...appState.evacuees],
            issues: [...appState.issues],
            timelineEvents: [...appState.timelineEvents]
        };
        
        filteredData = StateCalculator.filterByShelter(filteredData, shelterId);
        
        if (startTime || endTime) {
            filteredData = StateCalculator.filterByTimeRange(filteredData, startTime, endTime);
        }
        
        filteredData = StateCalculator.filterByIssueTypes(filteredData, filterOptions);
        
        appState.filteredData = filteredData;
        
        const filteredShelterStates = StateCalculator.calculateShelterStates(
            appState.shelters,
            filteredData.evacuees,
            appState.supplyRules,
            filteredData.issues
        );
        
        const filteredStatistics = StateCalculator.calculateStatistics(
            filteredShelterStates,
            filteredData.evacuees,
            filteredData.issues
        );
        
        updateSummaryCards(filteredStatistics);
        updateTimelineDisplay(filteredData.timelineEvents);
        updateFilteredTables(appState, filteredData);
    }
    
    function updateFilterPreview(appState) {
    }
    
    function updateDashboard(appState) {
        updateSummaryCards(appState.statistics);
    }
    
    function updateSummaryCards(statistics) {
        document.getElementById('shelterCount').textContent = statistics.totalShelters;
        document.getElementById('evacueeCount').textContent = statistics.totalEvacuees;
        document.getElementById('issueCount').textContent = statistics.totalIssues;
        document.getElementById('supplyShortageCount').textContent = statistics.supplyStats.totalShortage;
    }
    
    function updateTimeline(appState) {
        updateTimelineChart(appState);
        updateTimelineDisplay(appState.timelineEvents);
    }
    
    function updateTimelineChart(appState) {
        const ctx = document.getElementById('timelineChart').getContext('2d');
        
        if (timelineChart) {
            timelineChart.destroy();
        }
        
        const eventsByTime = {};
        appState.filteredData.timelineEvents.forEach(event => {
            const timeKey = event.timestamp 
                ? new Date(event.timestamp).toISOString().substring(0, 16)
                : 'unknown';
            
            if (!eventsByTime[timeKey]) {
                eventsByTime[timeKey] = {
                    arrivals: 0,
                    issues: 0,
                    warnings: 0
                };
            }
            
            if (event.type === 'arrival') {
                eventsByTime[timeKey].arrivals++;
            } else if (event.type === 'issue') {
                if (event.severity === 'high') {
                    eventsByTime[timeKey].issues++;
                } else {
                    eventsByTime[timeKey].warnings++;
                }
            }
        });
        
        const labels = Object.keys(eventsByTime).sort();
        const arrivalData = labels.map(label => eventsByTime[label].arrivals);
        const issueData = labels.map(label => eventsByTime[label].issues);
        const warningData = labels.map(label => eventsByTime[label].warnings);
        
        timelineChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '人员到达',
                        data: arrivalData,
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '严重问题',
                        data: issueData,
                        backgroundColor: 'rgba(231, 76, 60, 0.7)',
                        borderColor: 'rgba(231, 76, 60, 1)',
                        borderWidth: 1
                    },
                    {
                        label: '警告/提醒',
                        data: warningData,
                        backgroundColor: 'rgba(243, 156, 18, 0.7)',
                        borderColor: 'rgba(243, 156, 18, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        stacked: true,
                        title: {
                            display: true,
                            text: '时间'
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '数量'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: '事件时间线'
                    },
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }
    
    function updateTimelineDisplay(events) {
        const timelineList = document.getElementById('timelineList');
        
        if (events.length === 0) {
            timelineList.innerHTML = '<p class="empty-state">没有符合条件的事件</p>';
            return;
        }
        
        timelineList.innerHTML = events.map(event => {
            let itemClass = '';
            if (event.type === 'issue') {
                if (event.severity === 'high') {
                    itemClass = 'issue';
                } else if (event.severity === 'medium') {
                    itemClass = 'warning';
                }
            } else if (event.type === 'arrival') {
                itemClass = 'success';
            }
            
            return `
                <div class="timeline-item ${itemClass}">
                    <div class="timeline-item-content">
                        <div class="timeline-item-time">${event.timestamp || '时间未知'}</div>
                        <div class="timeline-item-title">${event.title}</div>
                        <div class="timeline-item-description">${event.description}</div>
                        ${event.shelterName ? `<div class="timeline-item-meta">避难点: ${event.shelterName}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    function updateTables(appState) {
        updateBedAllocationTable(appState);
        updateSupplyTable(appState);
        updateSpecialCareTable(appState);
        updateIssuesTable(appState);
    }
    
    function updateFilteredTables(appState, filteredData) {
        const bedAllocationData = StateCalculator.prepareBedAllocationData(
            appState.shelters,
            filteredData.evacuees,
            appState.shelterStates
        );
        
        const specialCareData = StateCalculator.prepareSpecialCareData(
            filteredData.evacuees,
            filteredData.issues
        );
        
        const issuesData = StateCalculator.prepareIssuesTableData(filteredData.issues);
        
        renderBedAllocationTable(bedAllocationData);
        renderSpecialCareTable(specialCareData);
        renderIssuesTable(issuesData);
    }
    
    function updateBedAllocationTable(appState) {
        const data = StateCalculator.prepareBedAllocationData(
            appState.shelters,
            appState.filteredData.evacuees,
            appState.shelterStates
        );
        renderBedAllocationTable(data);
    }
    
    function renderBedAllocationTable(data) {
        const tbody = document.querySelector('#bedAllocationTable tbody');
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">没有数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.shelterName}</td>
                <td>${row.arrivalTime}</td>
                <td>${row.evacueeId}</td>
                <td>${row.name}</td>
                <td>${row.age}</td>
                <td>${row.specialNeeds}</td>
                <td>${row.bedAssigned}</td>
                <td><span class="status-badge ${row.status}">${row.statusText}</span></td>
            </tr>
        `).join('');
    }
    
    function updateSupplyTable(appState) {
        const data = StateCalculator.prepareSupplyData(appState.shelterStates);
        renderSupplyTable(data);
    }
    
    function renderSupplyTable(data) {
        const tbody = document.querySelector('#supplyTable tbody');
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">没有数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.supplyType}</td>
                <td>${row.shelterName}</td>
                <td>${row.required}</td>
                <td>${row.allocated}</td>
                <td>${row.shortage}</td>
                <td>${row.affectedCount}人</td>
                <td><span class="status-badge ${row.status}">${row.statusText}</span></td>
            </tr>
        `).join('');
    }
    
    function updateSpecialCareTable(appState) {
        const data = StateCalculator.prepareSpecialCareData(
            appState.filteredData.evacuees,
            appState.filteredData.issues
        );
        renderSpecialCareTable(data);
    }
    
    function renderSpecialCareTable(data) {
        const tbody = document.querySelector('#specialCareTable tbody');
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-state">没有特殊人群数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.evacueeId}</td>
                <td>${row.name}</td>
                <td>${row.age}</td>
                <td>${row.specialNeedsType}</td>
                <td>${row.shelterId}</td>
                <td><span class="status-badge ${row.careStatus}">${row.careStatusText}</span></td>
                <td>${row.issues}</td>
            </tr>
        `).join('');
    }
    
    function updateIssuesTable(appState) {
        const data = StateCalculator.prepareIssuesTableData(appState.filteredData.issues);
        renderIssuesTable(data);
    }
    
    function renderIssuesTable(data) {
        const tbody = document.querySelector('#issuesTable tbody');
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-state">没有检测到问题</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${row.issueType}</td>
                <td><span class="severity-${row.severity}">${row.severityLabel}</span></td>
                <td>${row.description}</td>
                <td>${row.affectedObject}</td>
                <td>${row.timestamp}</td>
                <td><span class="status-badge info">${row.statusText}</span></td>
            </tr>
        `).join('');
    }
    
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    return {
        initEventListeners,
        handleFileSelection,
        loadSampleData,
        processLoadedData,
        applyFilters,
        updateDashboard,
        updateTimeline,
        updateTables,
        downloadFile
    };
})();
