/**
 * 3D渲染模块
 * 使用Three.js渲染仓库货架和数据可视化
 */

const Renderer3D = (function() {
    'use strict';

    let scene, camera, renderer, controls;
    let container;
    let rackMeshes = new Map();
    let slotMeshes = new Map();
    let pathLines = [];
    let forkliftMeshes = [];
    let heatmapPlanes = [];
    let animationId = null;
    let isInitialized = false;

    let currentTimeIndex = 0;
    let showHeatmap = true;
    let showPath = true;
    let opacity = 1.0;

    const COLORS = {
        rack: 0x2c3e50,
        rackHighlight: 0x34495e,
        slotNormal: 0x198754,
        slotWarning: 0xffc107,
        slotDanger: 0xe94560,
        slotCold: 0x0dcaf0,
        slotEmpty: 0x34495e,
        slotSelected: 0xffffff,
        pathForklift: 0xff6b6b,
        grid: 0x1a1a2e,
        gridLine: 0x0f3460,
        ambient: 0xffffff
    };

    /**
     * 初始化3D渲染器
     * @param {string} containerId - 容器元素ID
     */
    function init(containerId) {
        if (isInitialized) {
            console.warn('3D渲染器已初始化');
            return;
        }

        container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`找不到容器元素: ${containerId}`);
        }

        const width = container.clientWidth;
        const height = container.clientHeight;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        camera.position.set(15, 20, 25);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        container.appendChild(renderer.domElement);

        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 5;
        controls.maxDistance = 100;
        controls.maxPolarAngle = Math.PI / 2;

        setupLights();
        createGrid();
        createGround();

        window.addEventListener('resize', onWindowResize);

        isInitialized = true;
        animate();

        console.log('3D渲染器初始化完成');
    }

    /**
     * 设置灯光
     */
    function setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 30, 20);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        scene.add(directionalLight);

        const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x2c3e50, 0.3);
        scene.add(hemisphereLight);
    }

    /**
     * 创建网格
     */
    function createGrid() {
        const gridHelper = new THREE.GridHelper(100, 50, 0x0f3460, 0x0f3460);
        gridHelper.position.y = 0.01;
        gridHelper.material.opacity = 0.3;
        gridHelper.material.transparent = true;
        scene.add(gridHelper);
    }

    /**
     * 创建地面
     */
    function createGround() {
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x16213e,
            roughness: 0.8,
            metalness: 0.2
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
    }

    /**
     * 渲染货架
     * @param {Object} racksData - 货架数据
     */
    function renderRacks(racksData) {
        if (!isInitialized) {
            console.warn('3D渲染器未初始化');
            return;
        }

        clearRacks();

        if (!racksData || !racksData.racks || racksData.racks.length === 0) {
            console.warn('没有货架数据可渲染');
            return;
        }

        racksData.racks.forEach(rack => {
            createRack(rack);
        });

        adjustCameraToFit();

        console.log(`已渲染 ${racksData.racks.length} 个货架`);
    }

    /**
     * 创建单个货架
     */
    function createRack(rack) {
        const rackGroup = new THREE.Group();
        rackGroup.name = `rack-${rack.id}`;

        const pos = rack.position || { x: 0, y: 0, z: 0 };
        const dim = rack.dimensions || { width: 2, height: 4, depth: 1 };

        rackGroup.position.set(pos.x, pos.y, pos.z);

        const uprightGeometry = new THREE.BoxGeometry(0.1, dim.height, 0.1);
        const uprightMaterial = new THREE.MeshStandardMaterial({
            color: COLORS.rack,
            roughness: 0.7,
            metalness: 0.3
        });

        const uprightPositions = [
            { x: -dim.width / 2 + 0.05, z: -dim.depth / 2 + 0.05 },
            { x: dim.width / 2 - 0.05, z: -dim.depth / 2 + 0.05 },
            { x: -dim.width / 2 + 0.05, z: dim.depth / 2 - 0.05 },
            { x: dim.width / 2 - 0.05, z: dim.depth / 2 - 0.05 }
        ];

        uprightPositions.forEach(upos => {
            const upright = new THREE.Mesh(uprightGeometry, uprightMaterial);
            upright.position.set(upos.x, dim.height / 2, upos.z);
            upright.castShadow = true;
            upright.receiveShadow = true;
            rackGroup.add(upright);
        });

        const levels = rack.levels || 4;
        const levelHeight = dim.height / levels;

        for (let level = 1; level <= levels; level++) {
            const shelfGeometry = new THREE.BoxGeometry(dim.width, 0.05, dim.depth);
            const shelfMaterial = new THREE.MeshStandardMaterial({
                color: COLORS.rackHighlight,
                roughness: 0.6,
                metalness: 0.4,
                transparent: true,
                opacity: opacity
            });

            const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
            shelf.position.set(0, level * levelHeight - levelHeight / 2, 0);
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            rackGroup.add(shelf);
        }

        const backPanelGeometry = new THREE.BoxGeometry(dim.width, dim.height, 0.02);
        const backPanelMaterial = new THREE.MeshStandardMaterial({
            color: 0x1a1a2e,
            roughness: 0.8,
            metalness: 0.2,
            transparent: true,
            opacity: 0.3 * opacity
        });

        const backPanel = new THREE.Mesh(backPanelGeometry, backPanelMaterial);
        backPanel.position.set(0, dim.height / 2, -dim.depth / 2 - 0.01);
        rackGroup.add(backPanel);

        createSlots(rackGroup, rack);

        scene.add(rackGroup);
        rackMeshes.set(rack.id, rackGroup);
    }

    /**
     * 创建货位
     */
    function createSlots(rackGroup, rack) {
        const dim = rack.dimensions || { width: 2, height: 4, depth: 1 };
        const levels = rack.levels || 4;
        const slotsPerLevel = rack.slotsPerLevel || 5;
        const levelHeight = dim.height / levels;
        const slotWidth = dim.width / slotsPerLevel;

        rack.slots.forEach(slot => {
            const slotGroup = new THREE.Group();
            slotGroup.name = `slot-${slot.id}`;
            slotGroup.userData = {
                slotId: slot.id,
                rackId: rack.id,
                level: slot.level,
                position: slot.position,
                slotData: slot
            };

            const levelIdx = slot.level - 1;
            const posIdx = slot.position - 1;

            const x = (posIdx - slotsPerLevel / 2 + 0.5) * slotWidth;
            const y = levelIdx * levelHeight + levelHeight / 2 - 0.1;
            const z = 0;

            const slotGeometry = new THREE.BoxGeometry(
                slotWidth * 0.9,
                levelHeight * 0.8,
                dim.depth * 0.8
            );

            const slotMaterial = new THREE.MeshStandardMaterial({
                color: slot.occupied ? COLORS.slotNormal : COLORS.slotEmpty,
                roughness: 0.7,
                metalness: 0.2,
                transparent: true,
                opacity: 0.8 * opacity
            });

            const slotMesh = new THREE.Mesh(slotGeometry, slotMaterial);
            slotMesh.position.set(x, y, z);
            slotMesh.castShadow = true;
            slotMesh.receiveShadow = true;
            slotMesh.userData = slotGroup.userData;

            const edgeGeometry = new THREE.EdgesGeometry(slotGeometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: 0x0f3460,
                transparent: true,
                opacity: 0.5 * opacity
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            edges.position.set(x, y, z);

            slotGroup.add(slotMesh);
            slotGroup.add(edges);

            rackGroup.add(slotGroup);
            slotMeshes.set(slot.id, {
                group: slotGroup,
                mesh: slotMesh,
                edges: edges,
                material: slotMaterial,
                originalColor: slot.occupied ? COLORS.slotNormal : COLORS.slotEmpty
            });
        });
    }

    /**
     * 更新温度热图
     * @param {Object} temperatureData - 温度数据
     * @param {number} timeIndex - 时间索引
     */
    function updateHeatmap(temperatureData, timeIndex = 0) {
        if (!showHeatmap || !temperatureData || !temperatureData.tempMap) {
            return;
        }

        currentTimeIndex = timeIndex;

        temperatureData.tempMap.forEach((records, slotKey) => {
            if (records.length === 0) return;

            let record;
            if (temperatureData.hasTimestamp && temperatureData.timestamps.length > 0) {
                const clampedIndex = Math.min(timeIndex, records.length - 1);
                record = records[clampedIndex];
            } else {
                record = records[records.length - 1];
            }

            if (!record) return;

            const slotEntry = slotMeshes.get(slotKey);
            if (slotEntry) {
                const color = getTemperatureColor(record.temperature);
                slotEntry.material.color.setHex(color.hex);
                slotEntry.material.needsUpdate = true;
            }
        });
    }

    /**
     * 渲染叉车轨迹
     * @param {Object} trajectoryData - 轨迹数据
     */
    function renderTrajectories(trajectoryData) {
        if (!showPath || !trajectoryData) {
            return;
        }

        clearTrajectories();

        if (!trajectoryData.trajectories || trajectoryData.trajectories.size === 0) {
            return;
        }

        trajectoryData.trajectories.forEach((points, forkliftId) => {
            if (points.length < 2) return;

            const geometry = new THREE.BufferGeometry();
            const positions = [];
            const colors = [];

            for (let i = 0; i < points.length; i++) {
                const point = points[i];
                positions.push(
                    point.x ?? 0,
                    (point.y ?? 0) + 0.5,
                    point.z ?? 0
                );

                const t = i / points.length;
                colors.push(1.0, 0.42 + t * 0.2, 0.42 + t * 0.2);
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

            const material = new THREE.LineBasicMaterial({
                vertexColors: true,
                linewidth: 3,
                transparent: true,
                opacity: 0.7 * opacity
            });

            const line = new THREE.Line(geometry, material);
            line.name = `path-${forkliftId}`;
            line.userData = { forkliftId, points };

            scene.add(line);
            pathLines.push(line);

            createForkliftIndicator(points[0], forkliftId);
        });

        console.log(`已渲染 ${pathLines.length} 条叉车轨迹`);
    }

    /**
     * 创建叉车指示器
     */
    function createForkliftIndicator(startPoint, forkliftId) {
        const geometry = new THREE.ConeGeometry(0.5, 1.5, 4);
        const material = new THREE.MeshStandardMaterial({
            color: COLORS.pathForklift,
            roughness: 0.5,
            metalness: 0.5,
            transparent: true,
            opacity: 0.9 * opacity
        });

        const indicator = new THREE.Mesh(geometry, material);
        indicator.position.set(
            startPoint.x ?? 0,
            (startPoint.y ?? 0) + 1.5,
            startPoint.z ?? 0
        );
        indicator.rotation.x = Math.PI;
        indicator.name = `forklift-${forkliftId}`;
        indicator.userData = { forkliftId, currentIndex: 0 };

        scene.add(indicator);
        forkliftMeshes.push(indicator);
    }

    /**
     * 更新叉车位置到指定时间点
     */
    function updateForkliftPosition(timeIndex) {
        if (!showPath) return;

        forkliftMeshes.forEach(indicator => {
            const forkliftId = indicator.userData.forkliftId;
            const trajectoryData = StateManager.getTrajectoryData();
            
            if (trajectoryData && trajectoryData.trajectories) {
                const points = trajectoryData.trajectories.get(forkliftId);
                if (points && points.length > 0) {
                    const clampedIndex = Math.min(timeIndex, points.length - 1);
                    const point = points[clampedIndex];
                    
                    indicator.position.set(
                        point.x ?? 0,
                        (point.y ?? 0) + 1.5,
                        point.z ?? 0
                    );

                    if (clampedIndex > 0) {
                        const prevPoint = points[clampedIndex - 1];
                        const direction = new THREE.Vector3(
                            (point.x ?? 0) - (prevPoint.x ?? 0),
                            0,
                            (point.z ?? 0) - (prevPoint.z ?? 0)
                        );
                        if (direction.length() > 0.01) {
                            direction.normalize();
                            indicator.rotation.y = Math.atan2(direction.x, direction.z);
                        }
                    }

                    indicator.userData.currentIndex = clampedIndex;
                }
            }
        });
    }

    /**
     * 选择货位
     * @param {string} slotId - 货位ID
     */
    function selectSlot(slotId) {
        slotMeshes.forEach((entry, id) => {
            if (id === slotId) {
                entry.material.emissive = new THREE.Color(0xffffff);
                entry.material.emissiveIntensity = 0.3;
                entry.group.scale.set(1.05, 1.05, 1.05);
            } else {
                entry.material.emissive = new THREE.Color(0x000000);
                entry.material.emissiveIntensity = 0;
                entry.group.scale.set(1, 1, 1);
            }
        });
    }

    /**
     * 取消选择所有货位
     */
    function deselectAllSlots() {
        slotMeshes.forEach(entry => {
            entry.material.emissive = new THREE.Color(0x000000);
            entry.material.emissiveIntensity = 0;
            entry.group.scale.set(1, 1, 1);
        });
    }

    /**
     * 根据筛选条件高亮货位
     * @param {Object} filters - 筛选条件
     * @param {Object} riskAnalysis - 风险分析结果
     */
    function applyFilters(filters, riskAnalysis) {
        if (!riskAnalysis) return;

        slotMeshes.forEach((entry, slotId) => {
            let shouldHighlight = true;
            const slotRisks = riskAnalysis.getRisksBySlot(slotId);

            if (filters.riskLevel !== 'all') {
                shouldHighlight = slotRisks.some(r => r.level === filters.riskLevel);
            }

            if (shouldHighlight && filters.riskType !== 'all') {
                shouldHighlight = slotRisks.some(r => r.type === filters.riskType);
            }

            if (shouldHighlight && filters.sku) {
                const expiringData = StateManager.getExpiringData();
                if (expiringData && expiringData.products) {
                    const product = expiringData.products.find(p => 
                        p.slotId === slotId && 
                        (p.sku?.toLowerCase().includes(filters.sku.toLowerCase()) ||
                         p.name?.toLowerCase().includes(filters.sku.toLowerCase()))
                    );
                    shouldHighlight = !!product;
                }
            }

            entry.material.transparent = true;
            if (shouldHighlight) {
                entry.material.opacity = 0.9 * opacity;
            } else {
                entry.material.opacity = 0.15 * opacity;
            }
        });
    }

    /**
     * 重置所有货位的可见性
     */
    function resetSlotVisibility() {
        slotMeshes.forEach(entry => {
            entry.material.opacity = 0.8 * opacity;
        });
    }

    /**
     * 设置显示选项
     */
    function setDisplayOptions(options) {
        if (options.showHeatmap !== undefined) {
            showHeatmap = options.showHeatmap;
            if (!showHeatmap) {
                resetSlotColors();
            } else {
                const tempData = StateManager.getTemperatureData();
                if (tempData) {
                    updateHeatmap(tempData, currentTimeIndex);
                }
            }
        }

        if (options.showPath !== undefined) {
            showPath = options.showPath;
            pathLines.forEach(line => {
                line.visible = showPath;
            });
            forkliftMeshes.forEach(mesh => {
                mesh.visible = showPath;
            });
        }

        if (options.opacity !== undefined) {
            opacity = options.opacity;
            updateOpacity();
        }
    }

    /**
     * 重置货位颜色
     */
    function resetSlotColors() {
        slotMeshes.forEach(entry => {
            entry.material.color.setHex(entry.originalColor);
            entry.material.needsUpdate = true;
        });
    }

    /**
     * 更新透明度
     */
    function updateOpacity() {
        slotMeshes.forEach(entry => {
            entry.material.opacity = 0.8 * opacity;
            entry.edges.material.opacity = 0.5 * opacity;
        });

        pathLines.forEach(line => {
            line.material.opacity = 0.7 * opacity;
        });

        forkliftMeshes.forEach(mesh => {
            mesh.material.opacity = 0.9 * opacity;
        });
    }

    /**
     * 获取温度颜色
     */
    function getTemperatureColor(temperature) {
        if (window.RiskRules) {
            return RiskRules.getTemperatureColor(temperature);
        }

        if (temperature > -12) {
            return { hex: 0xe94560, rgb: 'rgb(233, 69, 96)' };
        } else if (temperature > -15) {
            return { hex: 0xffc107, rgb: 'rgb(255, 193, 7)' };
        } else if (temperature >= -18) {
            return { hex: 0x198754, rgb: 'rgb(25, 135, 84)' };
        } else {
            return { hex: 0x0dcaf0, rgb: 'rgb(13, 202, 240)' };
        }
    }

    /**
     * 调整相机以适应场景
     */
    function adjustCameraToFit() {
        if (rackMeshes.size === 0) return;

        const box = new THREE.Box3();
        rackMeshes.forEach(rackGroup => {
            box.expandByObject(rackGroup);
        });

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 2.5;

        camera.position.set(
            center.x + cameraZ * 0.6,
            center.y + cameraZ * 0.8,
            center.z + cameraZ
        );
        camera.lookAt(center);
        controls.target.copy(center);
        controls.update();
    }

    /**
     * 清除所有货架
     */
    function clearRacks() {
        rackMeshes.forEach(rackGroup => {
            scene.remove(rackGroup);
        });
        rackMeshes.clear();
        slotMeshes.clear();
    }

    /**
     * 清除所有轨迹
     */
    function clearTrajectories() {
        pathLines.forEach(line => {
            scene.remove(line);
        });
        pathLines = [];

        forkliftMeshes.forEach(mesh => {
            scene.remove(mesh);
        });
        forkliftMeshes = [];
    }

    /**
     * 清除所有内容
     */
    function clear() {
        clearRacks();
        clearTrajectories();
    }

    /**
     * 窗口大小改变处理
     */
    function onWindowResize() {
        if (!container) return;

        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    }

    /**
     * 动画循环
     */
    function animate() {
        animationId = requestAnimationFrame(animate);
        controls.update();

        const time = Date.now() * 0.0001;
        forkliftMeshes.forEach((mesh, index) => {
            mesh.rotation.z = Math.sin(time + index) * 0.1;
        });

        renderer.render(scene, camera);
    }

    /**
     * 射线检测
     * @param {number} mouseX - 鼠标X坐标
     * @param {number} mouseY - 鼠标Y坐标
     * @returns {Object|null} 相交的物体
     */
    function raycast(mouseX, mouseY) {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((mouseX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((mouseY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        const slotObjects = [];
        slotMeshes.forEach(entry => {
            slotObjects.push(entry.mesh);
        });

        const intersects = raycaster.intersectObjects(slotObjects);

        if (intersects.length > 0) {
            return intersects[0].object.userData;
        }

        return null;
    }

    /**
     * 获取渲染器DOM元素
     */
    function getRendererElement() {
        return renderer?.domElement;
    }

    /**
     * 销毁渲染器
     */
    function dispose() {
        if (animationId) {
            cancelAnimationFrame(animationId);
        }

        clear();

        if (renderer) {
            renderer.dispose();
            if (container && renderer.domElement) {
                container.removeChild(renderer.domElement);
            }
        }

        window.removeEventListener('resize', onWindowResize);

        isInitialized = false;
        scene = null;
        camera = null;
        renderer = null;
        controls = null;

        console.log('3D渲染器已销毁');
    }

    return {
        init,
        renderRacks,
        updateHeatmap,
        renderTrajectories,
        updateForkliftPosition,
        selectSlot,
        deselectAllSlots,
        applyFilters,
        resetSlotVisibility,
        setDisplayOptions,
        raycast,
        getRendererElement,
        clear,
        dispose,
        adjustCameraToFit
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.Renderer3D = Renderer3D;
}
