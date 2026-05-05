// 矿山巷道避险演练工具 - 主应用脚本

// 数据存储
const AppData = {
    nodes: [],
    connections: [],
    sensors: [],
    people: [],
    blastingPlans: [],
    blockedNodes: new Set(),
    overrides: {},
    notes: '',
    evacuationRoutes: {}
};

// 本地存储键名
const STORAGE_KEYS = {
    ALL_DATA: 'mine_evacuation_data',
    OVERRIDES: 'mine_evacuation_overrides',
    NOTES: 'mine_evacuation_notes',
    BLOCKED_NODES: 'mine_evacuation_blocked_nodes'
};

// Three.js 场景相关变量
let scene, camera, renderer, controls;
let nodeMeshMap = new Map();
let personMeshMap = new Map();
let routeLines = [];

// 示例数据
const SAMPLE_DATA = {
    nodes: [
        { id: 'N1', name: '主井口', x: 0, y: 0, z: 0, type: 'normal' },
        { id: 'N2', name: '一号石门', x: 100, y: 0, z: 0, type: 'normal' },
        { id: 'N3', name: '东翼运输巷', x: 200, y: 0, z: 0, type: 'normal' },
        { id: 'N4', name: '东翼工作面', x: 300, y: 0, z: 0, type: 'normal' },
        { id: 'N5', name: '西翼运输巷', x: 100, y: 0, z: 100, type: 'normal' },
        { id: 'N6', name: '西翼工作面', x: 100, y: 0, z: 200, type: 'normal' },
        { id: 'N7', name: '中央避难硐室', x: 150, y: 0, z: 50, type: 'shelter' },
        { id: 'N8', name: '二号避难硐室', x: 250, y: 0, z: 100, type: 'shelter' }
    ],
    connections: [
        { from: 'N1', to: 'N2', length: 100 },
        { from: 'N2', to: 'N3', length: 100 },
        { from: 'N3', to: 'N4', length: 100 },
        { from: 'N2', to: 'N5', length: 100 },
        { from: 'N5', to: 'N6', length: 100 },
        { from: 'N2', to: 'N7', length: 70 },
        { from: 'N3', to: 'N8', length: 120 },
        { from: 'N5', to: 'N7', length: 80 },
        { from: 'N7', to: 'N8', length: 150 }
    ],
    sensors: [
        { id: 'S1', nodeId: 'N1', type: 'gas', value: 0.01, unit: '%CH4', status: 'safe' },
        { id: 'S2', nodeId: 'N3', type: 'gas', value: 0.02, unit: '%CH4', status: 'safe' },
        { id: 'S3', nodeId: 'N4', type: 'gas', value: 0.08, unit: '%CH4', status: 'warning' },
        { id: 'S4', nodeId: 'N2', type: 'co', value: 15, unit: 'ppm', status: 'safe' },
        { id: 'S5', nodeId: 'N6', type: 'co', value: 25, unit: 'ppm', status: 'warning' },
        { id: 'S6', nodeId: 'N4', type: 'co', value: 35, unit: 'ppm', status: 'danger' }
    ],
    people: [
        { id: 'P1', name: '张三', nodeId: 'N4', role: '矿工' },
        { id: 'P2', name: '李四', nodeId: 'N4', role: '矿工' },
        { id: 'P3', name: '王五', nodeId: 'N3', role: '班组长' },
        { id: 'P4', name: '赵六', nodeId: 'N6', role: '矿工' },
        { id: 'P5', name: '钱七', nodeId: 'N5', role: '安全员' }
    ],
    blastingPlans: [
        { id: 'B1', name: '东翼工作面爆破', nodeIds: ['N4'], startTime: '2026-05-05T14:00:00', endTime: '2026-05-05T16:00:00', status: 'active' },
        { id: 'B2', name: '西翼巷道检修', nodeIds: ['N5', 'N6'], startTime: '2026-05-05T09:00:00', endTime: '2026-05-05T12:00:00', status: 'completed' }
    ]
};

// 初始化应用
function init() {
    initThreeJS();
    loadFromLocalStorage();
    setupEventListeners();
    updateUI();
    animate();
}

// 初始化 Three.js 场景
function initThreeJS() {
    const container = document.getElementById('canvas-container');
    
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    
    // 创建相机
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(200, 200, 200);
    camera.lookAt(150, 0, 100);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    
    // 添加灯光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, 300, 200);
    scene.add(directionalLight);
    
    // 简单的轨道控制器
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationSpeed = 0.005;
    
    container.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        spherical.theta -= deltaX * rotationSpeed;
        spherical.phi += deltaY * rotationSpeed;
        spherical.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, spherical.phi));
        
        const newPos = new THREE.Vector3().setFromSpherical(spherical);
        newPos.add(new THREE.Vector3(150, 0, 100));
        camera.position.copy(newPos);
        camera.lookAt(150, 0, 100);
        
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    container.addEventListener('mouseleave', () => {
        isDragging = false;
    });
    
    // 缩放控制
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 0.9;
        const direction = camera.position.clone().sub(new THREE.Vector3(150, 0, 100));
        const distance = direction.length();
        
        if (e.deltaY > 0) {
            direction.multiplyScalar(zoomFactor);
        } else {
            direction.multiplyScalar(1 / zoomFactor);
        }
        
        const newDistance = direction.length();
        if (newDistance > 50 && newDistance < 500) {
            camera.position.copy(direction.add(new THREE.Vector3(150, 0, 100)));
            camera.lookAt(150, 0, 100);
        }
    });
    
    // 窗口大小调整
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
    
    // 点击检测
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    container.addEventListener('click', (e) => {
        const rect = container.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(mouse, camera);
        
        // 检测节点
        const nodeMeshes = Array.from(nodeMeshMap.values());
        const intersects = raycaster.intersectObjects(nodeMeshes);
        
        if (intersects.length > 0) {
            const clickedMesh = intersects[0].object;
            const nodeId = clickedMesh.userData.nodeId;
            showNodeDetails(nodeId);
        }
    });
}

// 清空3D场景
function clearScene() {
    // 移除节点
    nodeMeshMap.forEach(mesh => {
        scene.remove(mesh);
    });
    nodeMeshMap.clear();
    
    // 移除人员
    personMeshMap.forEach(mesh => {
        scene.remove(mesh);
    });
    personMeshMap.clear();
    
    // 移除路线
    routeLines.forEach(line => {
        scene.remove(line);
    });
    routeLines = [];
    
    // 重新渲染
    render();
}

// 渲染3D场景
function renderScene() {
    clearScene();
    
    if (AppData.nodes.length === 0) return;
    
    // 创建缩放比例（让场景更适合显示）
    const scale = 1;
    
    // 绘制节点
    AppData.nodes.forEach(node => {
        const isBlocked = AppData.blockedNodes.has(node.id);
        const isShelter = node.type === 'shelter';
        
        let color = 0x3b82f6; // 蓝色 - 正常
        if (isBlocked) color = 0xef4444; // 红色 - 封锁
        if (isShelter) color = 0x10b981; // 绿色 - 避难硐室
        
        const geometry = new THREE.BoxGeometry(10, 5, 10);
        const material = new THREE.MeshPhongMaterial({ 
            color: color,
            shininess: 30
        });
        const cube = new THREE.Mesh(geometry, material);
        
        cube.position.set(node.x * scale, node.y * scale, node.z * scale);
        cube.userData = { nodeId: node.id };
        
        scene.add(cube);
        nodeMeshMap.set(node.id, cube);
    });
    
    // 绘制连接
    AppData.connections.forEach(conn => {
        const fromNode = AppData.nodes.find(n => n.id === conn.from);
        const toNode = AppData.nodes.find(n => n.id === conn.to);
        
        if (fromNode && toNode) {
            const material = new THREE.LineBasicMaterial({ color: 0x93c5fd, linewidth: 2 });
            const points = [
                new THREE.Vector3(fromNode.x * scale, fromNode.y * scale, fromNode.z * scale),
                new THREE.Vector3(toNode.x * scale, toNode.y * scale, toNode.z * scale)
            ];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    });
    
    // 绘制人员
    AppData.people.forEach(person => {
        const node = AppData.nodes.find(n => n.id === person.nodeId);
        if (node) {
            const geometry = new THREE.ConeGeometry(3, 8, 4);
            const material = new THREE.MeshPhongMaterial({ color: 0xf59e0b }); // 黄色
            const cone = new THREE.Mesh(geometry, material);
            
            cone.position.set(node.x * scale, node.y * scale + 8, node.z * scale);
            cone.userData = { personId: person.id };
            
            scene.add(cone);
            personMeshMap.set(person.id, cone);
        }
    });
    
    // 绘制撤离路线
    renderEvacuationRoutes();
    
    render();
}

// 渲染撤离路线
function renderEvacuationRoutes() {
    // 先清除旧的路线
    routeLines.forEach(line => {
        scene.remove(line);
    });
    routeLines = [];
    
    const scale = 1;
    
    Object.entries(AppData.evacuationRoutes).forEach(([personId, route]) => {
        if (!route.path || route.path.length < 2) return;
        
        const points = [];
        for (let i = 0; i < route.path.length; i++) {
            const node = AppData.nodes.find(n => n.id === route.path[i]);
            if (node) {
                points.push(new THREE.Vector3(node.x * scale, node.y * scale + 2, node.z * scale));
            }
        }
        
        if (points.length >= 2) {
            const material = new THREE.LineBasicMaterial({ color: 0xfbbf24, linewidth: 3 });
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
            routeLines.push(line);
        }
    });
}

// 动画循环
function animate() {
    requestAnimationFrame(animate);
    render();
}

function render() {
    renderer.render(scene, camera);
}

// 设置事件监听器
function setupEventListeners() {
    // 导入按钮
    document.getElementById('btn-import').addEventListener('click', () => {
        document.getElementById('import-modal').classList.remove('hidden');
    });
    
    // 取消导入
    document.getElementById('btn-cancel-import').addEventListener('click', () => {
        document.getElementById('import-modal').classList.add('hidden');
    });
    
    // 加载示例数据
    document.getElementById('btn-load-nodes').addEventListener('click', () => {
        document.getElementById('import-nodes').value = JSON.stringify(SAMPLE_DATA.nodes, null, 2);
    });
    
    document.getElementById('btn-load-connections').addEventListener('click', () => {
        document.getElementById('import-connections').value = JSON.stringify(SAMPLE_DATA.connections, null, 2);
    });
    
    document.getElementById('btn-load-sensors').addEventListener('click', () => {
        document.getElementById('import-sensors').value = JSON.stringify(SAMPLE_DATA.sensors, null, 2);
    });
    
    document.getElementById('btn-load-people').addEventListener('click', () => {
        document.getElementById('import-people').value = JSON.stringify(SAMPLE_DATA.people, null, 2);
    });
    
    document.getElementById('btn-load-blasting').addEventListener('click', () => {
        document.getElementById('import-blasting').value = JSON.stringify(SAMPLE_DATA.blastingPlans, null, 2);
    });
    
    // 确认导入
    document.getElementById('btn-confirm-import').addEventListener('click', importData);
    
    // 保存状态
    document.getElementById('btn-save').addEventListener('click', saveToLocalStorage);
    
    // 保存备注
    document.getElementById('btn-save-notes').addEventListener('click', () => {
        AppData.notes = document.getElementById('notes-textarea').value;
        saveToLocalStorage();
        alert('备注已保存');
    });
    
    // 导出功能
    document.getElementById('btn-export-md').addEventListener('click', exportMarkdown);
    document.getElementById('btn-export-json').addEventListener('click', exportJSON);
}

// 导入数据
function importData() {
    try {
        const nodesText = document.getElementById('import-nodes').value.trim();
        const connectionsText = document.getElementById('import-connections').value.trim();
        const sensorsText = document.getElementById('import-sensors').value.trim();
        const peopleText = document.getElementById('import-people').value.trim();
        const blastingText = document.getElementById('import-blasting').value.trim();
        
        if (nodesText) AppData.nodes = JSON.parse(nodesText);
        if (connectionsText) AppData.connections = JSON.parse(connectionsText);
        if (sensorsText) AppData.sensors = JSON.parse(sensorsText);
        if (peopleText) AppData.people = JSON.parse(peopleText);
        if (blastingText) AppData.blastingPlans = JSON.parse(blastingText);
        
        // 根据爆破计划设置封锁节点
        AppData.blockedNodes = new Set();
        AppData.blastingPlans.forEach(plan => {
            if (plan.status === 'active') {
                plan.nodeIds.forEach(nodeId => {
                    AppData.blockedNodes.add(nodeId);
                });
            }
        });
        
        // 计算撤离路线
        calculateEvacuationRoutes();
        
        // 隐藏模态框
        document.getElementById('import-modal').classList.add('hidden');
        
        // 更新UI
        updateUI();
        renderScene();
        
        // 保存到本地存储
        saveToLocalStorage();
        
        alert('数据导入成功！');
    } catch (error) {
        console.error('导入数据失败:', error);
        alert('数据格式错误，请检查JSON格式: ' + error.message);
    }
}

// 图结构构建
function buildGraph() {
    const graph = {};
    
    // 初始化所有节点
    AppData.nodes.forEach(node => {
        graph[node.id] = {};
    });
    
    // 添加连接（双向）
    AppData.connections.forEach(conn => {
        const fromBlocked = AppData.blockedNodes.has(conn.from);
        const toBlocked = AppData.blockedNodes.has(conn.to);
        
        // 不允许进入封锁节点，但允许从封锁节点出来
        if (!toBlocked) {
            graph[conn.from][conn.to] = conn.length;
        }
        if (!fromBlocked) {
            graph[conn.to][conn.from] = conn.length;
        }
    });
    
    return graph;
}

// Dijkstra 最短路径算法
function dijkstra(graph, startNode) {
    const distances = {};
    const previous = {};
    const unvisited = new Set();
    
    // 初始化
    Object.keys(graph).forEach(node => {
        distances[node] = node === startNode ? 0 : Infinity;
        previous[node] = null;
        unvisited.add(node);
    });
    
    while (unvisited.size > 0) {
        // 找到距离最小的节点
        let current = null;
        let minDist = Infinity;
        unvisited.forEach(node => {
            if (distances[node] < minDist) {
                minDist = distances[node];
                current = node;
            }
        });
        
        // 没有可达节点了
        if (current === null || distances[current] === Infinity) break;
        
        unvisited.delete(current);
        
        // 更新邻居
        Object.entries(graph[current] || {}).forEach(([neighbor, weight]) => {
            const alt = distances[current] + weight;
            if (alt < distances[neighbor]) {
                distances[neighbor] = alt;
                previous[neighbor] = current;
            }
        });
    }
    
    return { distances, previous };
}

// 重建路径
function reconstructPath(previous, startNode, endNode) {
    const path = [];
    let current = endNode;
    
    while (current !== null) {
        path.unshift(current);
        current = previous[current];
    }
    
    if (path[0] !== startNode) {
        return []; // 没有路径
    }
    
    return path;
}

// 计算撤离路线
function calculateEvacuationRoutes() {
    AppData.evacuationRoutes = {};
    
    const graph = buildGraph();
    const shelterNodes = AppData.nodes.filter(n => n.type === 'shelter').map(n => n.id);
    
    if (shelterNodes.length === 0) {
        console.warn('没有找到避难硐室节点');
        return;
    }
    
    AppData.people.forEach(person => {
        const startNode = person.nodeId;
        
        // 计算到所有避难硐室的最短路径
        let bestRoute = null;
        let minDistance = Infinity;
        
        const { distances, previous } = dijkstra(graph, startNode);
        
        shelterNodes.forEach(shelterId => {
            if (distances[shelterId] < minDistance) {
                minDistance = distances[shelterId];
                const path = reconstructPath(previous, startNode, shelterId);
                if (path.length > 0) {
                    bestRoute = {
                        personId: person.id,
                        personName: person.name,
                        path: path,
                        distance: minDistance,
                        shelterId: shelterId,
                        shelterName: AppData.nodes.find(n => n.id === shelterId)?.name || shelterId
                    };
                }
            }
        });
        
        if (bestRoute) {
            AppData.evacuationRoutes[person.id] = bestRoute;
        }
    });
}

// 显示节点详情
function showNodeDetails(nodeId) {
    const node = AppData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const nodeSensors = AppData.sensors.filter(s => s.nodeId === nodeId);
    const nodePeople = AppData.people.filter(p => p.nodeId === nodeId);
    const isBlocked = AppData.blockedNodes.has(nodeId);
    
    const detailsHtml = `
        <div class="space-y-2">
            <div class="font-bold text-lg">${node.name} (${node.id})</div>
            <div><strong>类型:</strong> ${node.type === 'shelter' ? '避难硐室' : '普通节点'}</div>
            <div><strong>坐标:</strong> (${node.x}, ${node.y}, ${node.z})</div>
            <div><strong>状态:</strong> <span class="${isBlocked ? 'status-danger' : 'status-safe'}">${isBlocked ? '已封锁' : '正常'}</span></div>
            
            <div class="mt-3">
                <button onclick="toggleNodeBlocked('${nodeId}')" 
                    class="w-full py-2 rounded ${isBlocked ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white">
                    ${isBlocked ? '解除封锁' : '封锁节点'}
                </button>
            </div>
            
            ${nodeSensors.length > 0 ? `
                <div class="mt-3">
                    <div class="font-bold mb-1">传感器:</div>
                    ${nodeSensors.map(s => `
                        <div class="p-2 bg-gray-50 rounded mb-1">
                            <div>${s.type === 'gas' ? '瓦斯' : '一氧化碳'}: <span class="status-${s.status}">${s.value} ${s.unit}</span></div>
                            <div class="text-sm text-gray-500">状态: ${getStatusText(s.status)}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            ${nodePeople.length > 0 ? `
                <div class="mt-3">
                    <div class="font-bold mb-1">当前人员:</div>
                    ${nodePeople.map(p => `
                        <div class="p-2 bg-gray-50 rounded mb-1">
                            ${p.name} (${p.role})
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('node-details').innerHTML = detailsHtml;
    
    // 更新人工改判面板
    updateOverridePanel(nodeId);
}

// 更新人工改判面板
function updateOverridePanel(nodeId) {
    const node = AppData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const currentOverride = AppData.overrides[nodeId] || {};
    
    const overrideHtml = `
        <div class="space-y-3">
            <div class="font-bold">节点: ${node.name}</div>
            
            <div>
                <label class="block text-sm font-medium mb-1">改判状态:</label>
                <select id="override-status-${nodeId}" class="w-full p-2 border rounded">
                    <option value="normal" ${currentOverride.status === 'normal' ? 'selected' : ''}>正常</option>
                    <option value="warning" ${currentOverride.status === 'warning' ? 'selected' : ''}>警告</option>
                    <option value="danger" ${currentOverride.status === 'danger' ? 'selected' : ''}>危险</option>
                </select>
            </div>
            
            <div>
                <label class="block text-sm font-medium mb-1">改判备注:</label>
                <textarea id="override-note-${nodeId}" class="w-full p-2 border rounded" rows="2" placeholder="输入改判原因...">${currentOverride.note || ''}</textarea>
            </div>
            
            <button onclick="applyOverride('${nodeId}')" class="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded">
                应用改判
            </button>
            
            ${currentOverride.status ? `
                <button onclick="clearOverride('${nodeId}')" class="w-full bg-gray-500 hover:bg-gray-600 text-white py-2 rounded">
                    清除改判
                </button>
            ` : ''}
        </div>
    `;
    
    document.getElementById('override-panel').innerHTML = overrideHtml;
}

// 切换节点封锁状态
function toggleNodeBlocked(nodeId) {
    if (AppData.blockedNodes.has(nodeId)) {
        AppData.blockedNodes.delete(nodeId);
    } else {
        AppData.blockedNodes.add(nodeId);
    }
    
    // 重新计算撤离路线
    calculateEvacuationRoutes();
    
    // 更新UI
    updateUI();
    renderScene();
    showNodeDetails(nodeId);
    saveToLocalStorage();
}

// 应用改判
function applyOverride(nodeId) {
    const status = document.getElementById(`override-status-${nodeId}`).value;
    const note = document.getElementById(`override-note-${nodeId}`).value;
    
    AppData.overrides[nodeId] = {
        status: status,
        note: note,
        timestamp: new Date().toISOString()
    };
    
    saveToLocalStorage();
    updateOverridePanel(nodeId);
    updateUI();
    alert('改判已保存');
}

// 清除改判
function clearOverride(nodeId) {
    delete AppData.overrides[nodeId];
    saveToLocalStorage();
    updateOverridePanel(nodeId);
    updateUI();
}

// 获取状态文本
function getStatusText(status) {
    switch (status) {
        case 'safe': return '正常';
        case 'warning': return '警告';
        case 'danger': return '危险';
        default: return status;
    }
}

// 更新UI
function updateUI() {
    // 更新统计
    document.getElementById('stat-nodes').textContent = AppData.nodes.length;
    document.getElementById('stat-sensors').textContent = AppData.sensors.length;
    document.getElementById('stat-people').textContent = AppData.people.length;
    document.getElementById('stat-blocked').textContent = AppData.blockedNodes.size;
    
    // 更新人员列表
    updatePeopleList();
    
    // 更新传感器列表
    updateSensorList();
    
    // 更新撤离路线
    updateEvacuationRoutes();
    
    // 更新备注
    document.getElementById('notes-textarea').value = AppData.notes;
}

// 更新人员列表
function updatePeopleList() {
    const container = document.getElementById('people-list');
    
    if (AppData.people.length === 0) {
        container.innerHTML = '<p class="text-gray-500">暂无人员数据</p>';
        return;
    }
    
    const html = AppData.people.map(person => {
        const node = AppData.nodes.find(n => n.id === person.nodeId);
        const route = AppData.evacuationRoutes[person.id];
        
        // 计算预计时间（假设步行速度为 1.5m/s）
        const walkingSpeed = 1.5; // m/s
        let eteText = '未知';
        if (route) {
            const eteSeconds = Math.round(route.distance / walkingSpeed);
            const eteMinutes = Math.floor(eteSeconds / 60);
            const eteRemainingSeconds = eteSeconds % 60;
            eteText = `${eteMinutes}分${eteRemainingSeconds}秒`;
        }
        
        return `
            <div class="p-2 bg-gray-50 rounded mb-2 cursor-pointer hover:bg-gray-100" onclick="showPersonDetails('${person.id}')">
                <div class="font-medium">${person.name}</div>
                <div class="text-sm text-gray-600">
                    位置: ${node ? node.name : person.nodeId} | 角色: ${person.role}
                </div>
                ${route ? `
                    <div class="text-sm mt-1">
                        <div>目标: ${route.shelterName}</div>
                        <div>距离: ${route.distance}米</div>
                        <div class="font-medium text-blue-600">预计到达: ${eteText}</div>
                    </div>
                ` : '<div class="text-sm text-red-500 mt-1">未找到撤离路线</div>'}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 显示人员详情
function showPersonDetails(personId) {
    const person = AppData.people.find(p => p.id === personId);
    if (!person) return;
    
    showNodeDetails(person.nodeId);
}

// 更新传感器列表
function updateSensorList() {
    const container = document.getElementById('sensor-list');
    
    if (AppData.sensors.length === 0) {
        container.innerHTML = '<p class="text-gray-500">暂无传感器数据</p>';
        return;
    }
    
    const html = AppData.sensors.map(sensor => {
        const node = AppData.nodes.find(n => n.id === sensor.nodeId);
        return `
            <div class="p-2 ${sensor.status === 'danger' ? 'bg-red-50 border-l-4 border-red-500' : sensor.status === 'warning' ? 'bg-yellow-50 border-l-4 border-yellow-500' : 'bg-green-50 border-l-4 border-green-500'} rounded mb-2">
                <div class="font-medium">${sensor.type === 'gas' ? '瓦斯' : '一氧化碳'} - ${node ? node.name : sensor.nodeId}</div>
                <div class="text-sm">
                    <span class="status-${sensor.status} font-medium">${sensor.value} ${sensor.unit}</span>
                    <span class="text-gray-500 ml-2">(${getStatusText(sensor.status)})</span>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 更新撤离路线显示
function updateEvacuationRoutes() {
    const container = document.getElementById('evacuation-routes');
    
    if (Object.keys(AppData.evacuationRoutes).length === 0) {
        container.innerHTML = '<p class="text-gray-500">暂无撤离路线数据</p>';
        return;
    }
    
    const walkingSpeed = 1.5; // m/s
    
    const html = Object.entries(AppData.evacuationRoutes).map(([personId, route]) => {
        const eteSeconds = Math.round(route.distance / walkingSpeed);
        const eteMinutes = Math.floor(eteSeconds / 60);
        const eteRemainingSeconds = eteSeconds % 60;
        
        return `
            <div class="p-3 bg-blue-50 rounded mb-3 border-l-4 border-blue-500">
                <div class="font-bold">${route.personName}</div>
                <div class="text-sm mt-1">
                    <div><strong>目标:</strong> ${route.shelterName}</div>
                    <div><strong>距离:</strong> ${route.distance} 米</div>
                    <div><strong>预计到达:</strong> ${eteMinutes}分${eteRemainingSeconds}秒</div>
                    <div class="mt-2">
                        <strong>路线:</strong><br>
                        <span class="text-xs">${route.path.map(nodeId => {
                            const node = AppData.nodes.find(n => n.id === nodeId);
                            return node ? node.name : nodeId;
                        }).join(' → ')}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 保存到本地存储
function saveToLocalStorage() {
    try {
        const saveData = {
            nodes: AppData.nodes,
            connections: AppData.connections,
            sensors: AppData.sensors,
            people: AppData.people,
            blastingPlans: AppData.blastingPlans,
            blockedNodes: Array.from(AppData.blockedNodes),
            overrides: AppData.overrides,
            notes: AppData.notes,
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(STORAGE_KEYS.ALL_DATA, JSON.stringify(saveData));
        console.log('数据已保存到本地存储');
    } catch (error) {
        console.error('保存到本地存储失败:', error);
    }
}

// 从本地存储加载
function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem(STORAGE_KEYS.ALL_DATA);
        
        if (savedData) {
            const data = JSON.parse(savedData);
            
            AppData.nodes = data.nodes || [];
            AppData.connections = data.connections || [];
            AppData.sensors = data.sensors || [];
            AppData.people = data.people || [];
            AppData.blastingPlans = data.blastingPlans || [];
            AppData.blockedNodes = new Set(data.blockedNodes || []);
            AppData.overrides = data.overrides || {};
            AppData.notes = data.notes || '';
            
            // 计算撤离路线
            if (AppData.nodes.length > 0) {
                calculateEvacuationRoutes();
            }
            
            console.log('从本地存储加载数据成功');
        }
    } catch (error) {
        console.error('从本地存储加载失败:', error);
    }
}

// 导出 Markdown 演练单
function exportMarkdown() {
    const now = new Date().toLocaleString('zh-CN');
    const walkingSpeed = 1.5; // m/s
    
    let md = `# 矿山巷道避险演练单\n\n`;
    md += `**生成时间**: ${now}\n\n`;
    md += `---\n\n`;
    
    // 数据概览
    md += `## 1. 数据概览\n\n`;
    md += `- 巷道节点: ${AppData.nodes.length} 个\n`;
    md += `- 传感器: ${AppData.sensors.length} 个\n`;
    md += `- 当班人员: ${AppData.people.length} 人\n`;
    md += `- 封锁节点: ${AppData.blockedNodes.size} 个\n\n`;
    
    // 封锁节点列表
    if (AppData.blockedNodes.size > 0) {
        md += `**封锁节点**: ${Array.from(AppData.blockedNodes).join(', ')}\n\n`;
    }
    
    md += `---\n\n`;
    
    // 传感器状态
    md += `## 2. 传感器状态\n\n`;
    
    if (AppData.sensors.length > 0) {
        md += `| 位置 | 类型 | 数值 | 状态 |\n`;
        md += `|------|------|------|------|\n`;
        
        AppData.sensors.forEach(sensor => {
            const node = AppData.nodes.find(n => n.id === sensor.nodeId);
            const typeName = sensor.type === 'gas' ? '瓦斯' : '一氧化碳';
            const statusName = getStatusText(sensor.status);
            
            md += `| ${node ? node.name : sensor.nodeId} | ${typeName} | ${sensor.value} ${sensor.unit} | ${statusName} |\n`;
        });
        md += `\n`;
    } else {
        md += `暂无传感器数据\n\n`;
    }
    
    md += `---\n\n`;
    
    // 人员撤离路线
    md += `## 3. 人员撤离路线\n\n`;
    
    if (AppData.people.length > 0) {
        AppData.people.forEach(person => {
            const node = AppData.nodes.find(n => n.id === person.nodeId);
            const route = AppData.evacuationRoutes[person.id];
            
            md += `### ${person.name} (${person.role})\n\n`;
            md += `- 当前位置: ${node ? node.name : person.nodeId}\n`;
            
            if (route) {
                const eteSeconds = Math.round(route.distance / walkingSpeed);
                const eteMinutes = Math.floor(eteSeconds / 60);
                const eteRemainingSeconds = eteSeconds % 60;
                
                md += `- 目标避难硐室: ${route.shelterName}\n`;
                md += `- 撤离距离: ${route.distance} 米\n`;
                md += `- 预计到达时间: ${eteMinutes}分${eteRemainingSeconds}秒\n`;
                md += `- 撤离路线: `;
                md += route.path.map(nodeId => {
                    const n = AppData.nodes.find(n => n.id === nodeId);
                    return n ? n.name : nodeId;
                }).join(' → ');
                md += `\n\n`;
            } else {
                md += `- **警告**: 未找到可用的撤离路线\n\n`;
            }
        });
    } else {
        md += `暂无人员数据\n\n`;
    }
    
    md += `---\n\n`;
    
    // 人工改判
    if (Object.keys(AppData.overrides).length > 0) {
        md += `## 4. 人工改判记录\n\n`;
        
        Object.entries(AppData.overrides).forEach(([nodeId, override]) => {
            const node = AppData.nodes.find(n => n.id === nodeId);
            const timestamp = new Date(override.timestamp).toLocaleString('zh-CN');
            
            md += `### ${node ? node.name : nodeId}\n\n`;
            md += `- 改判状态: ${getStatusText(override.status)}\n`;
            md += `- 改判时间: ${timestamp}\n`;
            if (override.note) {
                md += `- 改判备注: ${override.note}\n`;
            }
            md += `\n`;
        });
        
        md += `---\n\n`;
    }
    
    // 备注
    if (AppData.notes) {
        md += `## 5. 备注\n\n`;
        md += `${AppData.notes}\n\n`;
        md += `---\n\n`;
    }
    
    // 下载文件
    downloadFile(md, `避险演练单_${Date.now()}.md`, 'text/markdown');
}

// 导出 JSON 明细
function exportJSON() {
    const exportData = {
        exportTime: new Date().toISOString(),
        nodes: AppData.nodes,
        connections: AppData.connections,
        sensors: AppData.sensors,
        people: AppData.people,
        blastingPlans: AppData.blastingPlans,
        blockedNodes: Array.from(AppData.blockedNodes),
        overrides: AppData.overrides,
        notes: AppData.notes,
        evacuationRoutes: AppData.evacuationRoutes
    };
    
    const jsonString = JSON.stringify(exportData, null, 2);
    downloadFile(jsonString, `演练数据明细_${Date.now()}.json`, 'application/json');
}

// 下载文件
function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 启动应用
window.addEventListener('DOMContentLoaded', init);
