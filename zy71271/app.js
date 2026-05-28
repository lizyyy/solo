class GalaxyWallApp {
    constructor() {
        this.galaxies = [];
        this.filteredGalaxies = [];
        this.batches = new Set();
        this.activeBatch = null;
        this.spectrumTypes = new Map();
        this.markerObjects = [];
        this.labelObjects = [];
        
        this.initSpectrumColors();
        this.initThreeJS();
        this.initEventListeners();
        this.loadSampleData();
    }

    initSpectrumColors() {
        this.spectrumColorMap = {
            'O': '#5a9fff',
            'B': '#99bbff',
            'A': '#ffffff',
            'F': '#ffffcc',
            'G': '#ffcc66',
            'K': '#ff9933',
            'M': '#ff6644',
            'L': '#cc3333',
            'T': '#9933cc',
            '未知': '#888888'
        };
    }

    initThreeJS() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0a1a);
        this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 200);

        this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
        this.camera.position.set(0, 30, 60);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);

        this.labelRenderer = new THREE.CSS2DRenderer();
        this.labelRenderer.setSize(width, height);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        container.appendChild(this.labelRenderer.domElement);

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 10;
        this.controls.maxDistance = 150;

        this.createStarfield();
        this.createGrid();
        this.createAxes();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        window.addEventListener('resize', () => this.onWindowResize());
        
        this.animate();
    }

    createStarfield() {
        const starsGeometry = new THREE.BufferGeometry();
        const starCount = 5000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 400;
            positions[i + 1] = (Math.random() - 0.5) * 400;
            positions[i + 2] = (Math.random() - 0.5) * 400;

            const brightness = 0.5 + Math.random() * 0.5;
            colors[i] = brightness;
            colors[i + 1] = brightness;
            colors[i + 2] = brightness * (0.8 + Math.random() * 0.4);
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const starsMaterial = new THREE.PointsMaterial({
            size: 0.3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8
        });

        this.starfield = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.starfield);
    }

    createGrid() {
        const gridHelper = new THREE.GridHelper(100, 20, 0x333366, 0x222244);
        gridHelper.position.y = -20;
        this.scene.add(gridHelper);
        this.gridHelper = gridHelper;
    }

    createAxes() {
        const axesGroup = new THREE.Group();
        
        const xArrow = new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0),
            new THREE.Vector3(-50, -18, -50),
            10,
            0xff4444,
            2,
            1
        );
        axesGroup.add(xArrow);

        const yArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(-50, -18, -50),
            10,
            0x44ff44,
            2,
            1
        );
        axesGroup.add(yArrow);

        const zArrow = new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(-50, -18, -50),
            10,
            0x4444ff,
            2,
            1
        );
        axesGroup.add(zArrow);

        this.scene.add(axesGroup);
        this.axesGroup = axesGroup;
    }

    initEventListeners() {
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileUpload(e));
        
        document.getElementById('redshiftRange').addEventListener('input', (e) => {
            document.getElementById('redshiftValue').textContent = parseFloat(e.target.value).toFixed(3);
            document.getElementById('redshiftMax').value = e.target.value;
            this.applyFilters();
        });

        document.getElementById('redshiftMin').addEventListener('change', () => this.applyFilters());
        document.getElementById('redshiftMax').addEventListener('change', () => this.applyFilters());
        document.getElementById('brightnessMin').addEventListener('change', () => this.applyFilters());
        document.getElementById('brightnessMax').addEventListener('change', () => this.applyFilters());
        
        document.getElementById('showMissingRedshift').addEventListener('change', () => this.applyFilters());
        document.getElementById('showExtremeBrightness').addEventListener('change', () => this.applyFilters());
        
        document.getElementById('showLabels').addEventListener('change', (e) => {
            this.labelObjects.forEach(label => {
                label.element.style.display = e.target.checked ? 'block' : 'none';
            });
        });
        
        document.getElementById('autoRotate').addEventListener('change', (e) => {
            this.controls.autoRotate = e.target.checked;
            this.controls.autoRotateSpeed = 0.5;
        });
        
        document.getElementById('showGrid').addEventListener('change', (e) => {
            this.gridHelper.visible = e.target.checked;
            this.axesGroup.visible = e.target.checked;
        });
        
        document.getElementById('highlightPending').addEventListener('change', () => {
            this.updateMarkerVisuals();
        });
        
        document.getElementById('exportScreenshot').addEventListener('click', () => this.exportScreenshot());
        document.getElementById('exportFiltered').addEventListener('click', () => this.exportFilteredData());

        this.renderer.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.renderer.domElement.addEventListener('click', (e) => this.onClick(e));
    }

    handleFileUpload(event) {
        const files = event.target.files;
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = '';

        Array.from(files).forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `<span>${file.name}</span><span>${(file.size / 1024).toFixed(1)} KB</span>`;
            fileList.appendChild(fileItem);

            if (file.name.endsWith('.csv')) {
                this.parseCSV(file);
            } else if (file.name.endsWith('.json')) {
                this.parseJSON(file);
            }
        });
    }

    parseCSV(file) {
        Papa.parse(file, {
            header: true,
            complete: (results) => {
                this.processData(results.data);
            },
            error: (error) => {
                console.error('CSV解析错误:', error);
            }
        });
    }

    parseJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.processData(Array.isArray(data) ? data : [data]);
            } catch (error) {
                console.error('JSON解析错误:', error);
            }
        };
        reader.readAsText(file);
    }

    processData(data) {
        const processedGalaxies = data.map((row, index) => {
            const galaxy = {
                id: this.galaxies.length + index + 1,
                name: this.safeGetValue(row, ['名称', 'name', 'galaxy_name', 'id'], `Galaxy-${this.galaxies.length + index + 1}`),
                x: this.safeParseFloat(row, ['x', 'X', '坐标x', 'ra']),
                y: this.safeParseFloat(row, ['y', 'Y', '坐标y', 'dec']),
                z: this.safeParseFloat(row, ['z', 'Z', '坐标z', '距离', 'distance']),
                redshift: this.safeParseFloat(row, ['红移', 'redshift', 'z_value', '红移值']),
                brightness: this.safeParseFloat(row, ['亮度', 'brightness', 'mag', 'magnitude', '视星等']),
                spectrumType: this.safeGetValue(row, ['光谱类型', 'spectrum', 'type', 'spectral_type'], '未知'),
                batch: this.safeGetValue(row, ['批次', 'batch', '观测批次', 'survey'], '默认批次'),
                report: this.safeGetValue(row, ['报告', 'report', '探索报告', 'notes'], ''),
                isPending: false,
                pendingReasons: []
            };

            this.validateGalaxy(galaxy);

            return galaxy;
        });

        this.galaxies = [...this.galaxies, ...processedGalaxies];
        this.updateBatches();
        this.updateSpectrumTypes();
        this.applyFilters();
        this.updateStatus();
    }

    safeGetValue(row, keys, defaultValue = '') {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                return String(row[key]).trim();
            }
        }
        return defaultValue;
    }

    safeParseFloat(row, keys) {
        for (const key of keys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
                const value = parseFloat(row[key]);
                if (!isNaN(value)) {
                    return value;
                }
            }
        }
        return null;
    }

    validateGalaxy(galaxy) {
        if (galaxy.redshift === null || galaxy.redshift < 0) {
            galaxy.isPending = true;
            galaxy.pendingReasons.push('红移值缺失或无效');
            galaxy.displayRedshift = 0;
        } else {
            galaxy.displayRedshift = galaxy.redshift;
        }

        if (galaxy.brightness === null) {
            galaxy.isPending = true;
            galaxy.pendingReasons.push('亮度值缺失');
            galaxy.displayBrightness = 0;
        } else if (galaxy.brightness < -25 || galaxy.brightness > 20) {
            galaxy.isPending = true;
            galaxy.pendingReasons.push('亮度值超出正常范围');
            galaxy.displayBrightness = galaxy.brightness;
        } else {
            galaxy.displayBrightness = galaxy.brightness;
        }

        if (!this.spectrumColorMap[galaxy.spectrumType]) {
            galaxy.spectrumType = '未知';
        }

        if (galaxy.x === null) {
            galaxy.displayX = (Math.random() - 0.5) * 80;
            galaxy.isPending = true;
            galaxy.pendingReasons.push('X坐标缺失');
        } else {
            galaxy.displayX = galaxy.x;
        }
        if (galaxy.y === null) {
            galaxy.displayY = (Math.random() - 0.5) * 40;
            galaxy.isPending = true;
            galaxy.pendingReasons.push('Y坐标缺失');
        } else {
            galaxy.displayY = galaxy.y;
        }
        if (galaxy.z === null) {
            galaxy.displayZ = galaxy.displayRedshift * 30 + (Math.random() - 0.5) * 10;
            galaxy.isPending = true;
            galaxy.pendingReasons.push('Z坐标缺失');
        } else {
            galaxy.displayZ = galaxy.z;
        }
    }

    updateBatches() {
        this.batches = new Set(this.galaxies.map(g => g.batch));
        const batchSelector = document.getElementById('batchSelector');
        batchSelector.innerHTML = '';

        const allBtn = document.createElement('button');
        allBtn.className = 'batch-btn active';
        allBtn.textContent = '全部批次';
        allBtn.addEventListener('click', () => {
            this.activeBatch = null;
            document.querySelectorAll('.batch-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            this.applyFilters();
        });
        batchSelector.appendChild(allBtn);

        this.batches.forEach(batch => {
            const btn = document.createElement('button');
            btn.className = 'batch-btn';
            btn.textContent = batch;
            btn.addEventListener('click', () => {
                this.activeBatch = batch;
                document.querySelectorAll('.batch-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.applyFilters();
            });
            batchSelector.appendChild(btn);
        });
    }

    updateSpectrumTypes() {
        this.spectrumTypes = new Map();
        this.galaxies.forEach(g => {
            const count = this.spectrumTypes.get(g.spectrumType) || 0;
            this.spectrumTypes.set(g.spectrumType, count + 1);
        });

        const filtersContainer = document.getElementById('spectrumFilters');
        filtersContainer.innerHTML = '';

        this.spectrumTypes.forEach((count, type) => {
            const filter = document.createElement('label');
            filter.className = 'spectrum-filter';
            const color = this.spectrumColorMap[type] || '#888888';
            filter.innerHTML = `
                <input type="checkbox" value="${type}" checked>
                <span class="spectrum-color" style="background: ${color}; color: ${color};"></span>
                <span>${type} (${count})</span>
            `;
            filter.querySelector('input').addEventListener('change', () => this.applyFilters());
            filtersContainer.appendChild(filter);
        });

        this.updateLegend();
    }

    updateLegend() {
        const legendItems = document.getElementById('legendItems');
        legendItems.innerHTML = '';

        this.spectrumTypes.forEach((count, type) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const color = this.spectrumColorMap[type] || '#888888';
            item.innerHTML = `
                <span class="legend-color" style="background: ${color}; color: ${color};"></span>
                <span>${type} 型</span>
            `;
            legendItems.appendChild(item);
        });
    }

    applyFilters() {
        const redshiftMin = parseFloat(document.getElementById('redshiftMin').value) || 0;
        const redshiftMax = parseFloat(document.getElementById('redshiftMax').value) || 10;
        const brightnessMin = parseFloat(document.getElementById('brightnessMin').value) || -30;
        const brightnessMax = parseFloat(document.getElementById('brightnessMax').value) || 30;
        const showMissingRedshift = document.getElementById('showMissingRedshift').checked;
        const showExtremeBrightness = document.getElementById('showExtremeBrightness').checked;

        const selectedSpectrums = Array.from(document.querySelectorAll('.spectrum-filter input:checked'))
            .map(input => input.value);

        this.filteredGalaxies = this.galaxies.filter(galaxy => {
            if (this.activeBatch && galaxy.batch !== this.activeBatch) return false;

            if (!selectedSpectrums.includes(galaxy.spectrumType)) return false;

            const hasMissingRedshift = galaxy.pendingReasons.includes('红移值缺失或无效');
            if (hasMissingRedshift && !showMissingRedshift) return false;

            const hasExtremeBrightness = galaxy.pendingReasons.includes('亮度值超出正常范围');
            if (hasExtremeBrightness && !showExtremeBrightness) return false;

            if (!hasMissingRedshift && (galaxy.redshift < redshiftMin || galaxy.redshift > redshiftMax)) {
                return false;
            }

            if (galaxy.brightness !== null && (galaxy.brightness < brightnessMin || galaxy.brightness > brightnessMax)) {
                if (!hasExtremeBrightness) return false;
            }

            return true;
        });

        this.renderGalaxies();
        this.updateStatus();
    }

    renderGalaxies() {
        this.markerObjects.forEach(obj => this.scene.remove(obj));
        this.labelObjects.forEach(obj => this.scene.remove(obj));
        this.markerObjects = [];
        this.labelObjects = [];

        const showLabels = document.getElementById('showLabels').checked;

        this.filteredGalaxies.forEach((galaxy, index) => {
            const marker = this.createGalaxyMarker(galaxy, index);
            this.scene.add(marker);
            this.markerObjects.push(marker);

            if (showLabels) {
                const label = this.createGalaxyLabel(galaxy);
                this.scene.add(label);
                this.labelObjects.push(label);
            }
        });

        this.performLabelAvoidance();
    }

    createGalaxyMarker(galaxy, index) {
        const color = new THREE.Color(this.spectrumColorMap[galaxy.spectrumType] || '#888888');
        const size = this.calculateMarkerSize(galaxy);
        
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: galaxy.isPending && document.getElementById('highlightPending').checked ? 0.5 : 0.9
        });

        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.set(
            this.normalizeCoordinate(galaxy.displayX, -50, 50, -40, 40),
            this.normalizeCoordinate(galaxy.displayY, -30, 30, -20, 20),
            this.normalizeCoordinate(galaxy.displayZ, 0, 100, -30, 30)
        );

        const glowGeometry = new THREE.SphereGeometry(size * 1.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: galaxy.isPending && document.getElementById('highlightPending').checked ? 0.3 : 0.15
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        sphere.add(glow);

        if (galaxy.isPending && document.getElementById('highlightPending').checked) {
            const ringGeometry = new THREE.RingGeometry(size * 1.8, size * 2.2, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: 0xfbbf24,
                transparent: true,
                opacity: 0.6,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            sphere.add(ring);
        }

        sphere.userData = { galaxy, index };

        return sphere;
    }

    calculateMarkerSize(galaxy) {
        let size = 0.3 + (1 - (galaxy.displayBrightness + 20) / 40) * 0.8;
        size = Math.max(0.2, Math.min(1.5, size));
        
        if (galaxy.isPending && document.getElementById('highlightPending').checked) {
            size *= 1.3;
        }
        
        return size;
    }

    normalizeCoordinate(value, inMin, inMax, outMin, outMax) {
        const normalized = (value - inMin) / (inMax - inMin);
        return outMin + normalized * (outMax - outMin);
    }

    createGalaxyLabel(galaxy) {
        const div = document.createElement('div');
        div.className = 'galaxy-label';
        if (galaxy.isPending) {
            div.classList.add('pending-label');
        }
        div.textContent = galaxy.name;

        const label = new THREE.CSS2DObject(div);
        label.position.set(
            this.normalizeCoordinate(galaxy.displayX, -50, 50, -40, 40),
            this.normalizeCoordinate(galaxy.displayY, -30, 30, -20, 20) + 1,
            this.normalizeCoordinate(galaxy.displayZ, 0, 100, -30, 30)
        );
        label.userData = { galaxy };

        return label;
    }

    performLabelAvoidance() {
        const labelPositions = this.labelObjects.map(label => ({
            label,
            pos: label.position.clone().project(this.camera)
        }));

        labelPositions.sort((a, b) => b.pos.z - a.pos.z);

        for (let i = 0; i < labelPositions.length; i++) {
            for (let j = i + 1; j < labelPositions.length; j++) {
                const a = labelPositions[i];
                const b = labelPositions[j];
                
                const distance = Math.sqrt(
                    Math.pow(a.pos.x - b.pos.x, 2) +
                    Math.pow(a.pos.y - b.pos.y, 2)
                );

                if (distance < 0.05) {
                    b.label.element.style.opacity = '0';
                }
            }
        }
    }

    updateMarkerVisuals() {
        this.markerObjects.forEach((marker, index) => {
            const galaxy = marker.userData.galaxy;
            const color = new THREE.Color(this.spectrumColorMap[galaxy.spectrumType] || '#888888');
            
            marker.material.color = color;
            marker.material.opacity = galaxy.isPending && document.getElementById('highlightPending').checked ? 0.5 : 0.9;
            
            if (marker.children.length > 1) {
                marker.children[1].visible = galaxy.isPending && document.getElementById('highlightPending').checked;
            }
        });
    }

    updateStatus() {
        document.getElementById('totalCount').textContent = this.galaxies.length;
        document.getElementById('visibleCount').textContent = this.filteredGalaxies.length;
        document.getElementById('pendingCount').textContent = 
            this.filteredGalaxies.filter(g => g.isPending).length;
    }

    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.markerObjects);

        const tooltip = document.getElementById('tooltip');
        
        if (intersects.length > 0) {
            const galaxy = intersects[0].object.userData.galaxy;
            this.showTooltip(galaxy, event.clientX, event.clientY);
            document.body.style.cursor = 'pointer';
        } else {
            tooltip.classList.remove('visible');
            document.body.style.cursor = 'default';
        }
    }

    onClick(event) {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.markerObjects);

        if (intersects.length > 0) {
            const galaxy = intersects[0].object.userData.galaxy;
            console.log('选中星系:', galaxy);
        }
    }

    showTooltip(galaxy, x, y) {
        const tooltip = document.getElementById('tooltip');
        const container = document.querySelector('.main-content');
        const rect = container.getBoundingClientRect();

        let content = `
            <div class="tooltip-title">${galaxy.name}</div>
            <div class="tooltip-row"><span class="tooltip-label">光谱类型:</span><span class="tooltip-value">${galaxy.spectrumType}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">红移 z:</span><span class="tooltip-value">${galaxy.redshift !== null ? galaxy.redshift.toFixed(4) : '缺失'}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">亮度:</span><span class="tooltip-value">${galaxy.brightness !== null ? galaxy.brightness.toFixed(2) + ' mag' : '缺失'}</span></div>
            <div class="tooltip-row"><span class="tooltip-label">观测批次:</span><span class="tooltip-value">${galaxy.batch}</span></div>
        `;

        if (galaxy.isPending) {
            content += `<div class="tooltip-pending">⚠️ 待复核: ${galaxy.pendingReasons.join('; ')}</div>`;
        }

        if (galaxy.report) {
            content += `<div class="tooltip-row"><span class="tooltip-label">报告:</span><span class="tooltip-value">${galaxy.report.substring(0, 50)}${galaxy.report.length > 50 ? '...' : ''}</span></div>`;
        }

        tooltip.innerHTML = content;
        tooltip.classList.add('visible');

        let left = x - rect.left + 15;
        let top = y - rect.top + 15;

        if (left + 280 > rect.width) {
            left = x - rect.left - 295;
        }
        if (top + 200 > rect.height) {
            top = y - rect.top - 215;
        }

        tooltip.style.left = left + 'px';
        tooltip.style.top = top + 'px';
    }

    exportScreenshot() {
        this.renderer.render(this.scene, this.camera);
        const dataURL = this.renderer.domElement.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = `星系墙_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataURL;
        link.click();
    }

    exportFilteredData() {
        const exportData = this.filteredGalaxies.map(g => ({
            名称: g.name,
            光谱类型: g.spectrumType,
            红移: g.redshift !== null ? g.redshift : '',
            亮度: g.brightness !== null ? g.brightness : '',
            坐标X: g.x !== null ? g.x : '',
            坐标Y: g.y !== null ? g.y : '',
            坐标Z: g.z !== null ? g.z : '',
            观测批次: g.batch,
            状态: g.isPending ? '待复核' : '正常',
            备注: g.pendingReasons.join('; '),
            探索报告: g.report
        }));

        const csv = Papa.unparse(exportData);
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.download = `筛选星系数据_${new Date().toISOString().slice(0, 10)}.csv`;
        link.href = url;
        link.click();
        
        URL.revokeObjectURL(url);
    }

    loadSampleData() {
        const sampleGalaxies = [];
        const spectrumTypes = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
        const batches = ['SDSS DR16', 'JWST 首批', 'Gaia DR3', '本地观测'];

        for (let i = 0; i < 150; i++) {
            const galaxy = {
                name: `NGC-${1000 + i}`,
                x: (Math.random() - 0.5) * 80,
                y: (Math.random() - 0.5) * 50,
                z: Math.random() * 80,
                redshift: Math.random() * 5,
                brightness: -20 + Math.random() * 35,
                spectrumType: spectrumTypes[Math.floor(Math.random() * spectrumTypes.length)],
                batch: batches[Math.floor(Math.random() * batches.length)],
                report: ''
            };

            if (Math.random() < 0.1) {
                galaxy.redshift = -1;
            }
            if (Math.random() < 0.05) {
                galaxy.brightness = Math.random() < 0.5 ? -30 : 25;
            }
            if (Math.random() < 0.15) {
                galaxy.report = '该星系存在强发射线特征，建议进一步观测分析。';
            }

            sampleGalaxies.push(galaxy);
        }

        this.processData(sampleGalaxies);
    }

    onWindowResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(width, height);
        this.labelRenderer.setSize(width, height);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);

        if (this.starfield) {
            this.starfield.rotation.y += 0.0001;
        }

        this.markerObjects.forEach((marker, index) => {
            if (marker.userData.galaxy.isPending && document.getElementById('highlightPending').checked) {
                marker.rotation.y += 0.01;
                if (marker.children.length > 1) {
                    marker.children[1].rotation.z -= 0.02;
                }
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GalaxyWallApp();
});