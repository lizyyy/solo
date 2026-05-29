const Interaction = {
    tankObjects: [],
    currentLiquidDensity: 1.0,
    initialWaterLevel: 50,
    currentWaterLevel: 50,
    tankBaseArea: 500,
    draggedMaterial: null,

    init() {
        this.setupDragAndDrop();
        this.setupTank();
    },

    setupDragAndDrop() {
        const materialLibrary = document.getElementById('material-library');
        const tank = document.getElementById('tank');

        materialLibrary.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('material-item')) {
                e.target.classList.add('dragging');
                this.draggedMaterial = JSON.parse(e.target.dataset.material);
                e.dataTransfer.effectAllowed = 'copy';
            }
        });

        materialLibrary.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('material-item')) {
                e.target.classList.remove('dragging');
                this.draggedMaterial = null;
            }
        });

        tank.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            tank.classList.add('drag-over');
        });

        tank.addEventListener('dragleave', (e) => {
            if (!tank.contains(e.relatedTarget)) {
                tank.classList.remove('drag-over');
            }
        });

        tank.addEventListener('drop', (e) => {
            e.preventDefault();
            tank.classList.remove('drag-over');
            
            if (this.draggedMaterial) {
                this.addObjectToTank(this.draggedMaterial, e);
            }
        });
    },

    setupTank() {
        this.updateWaterLevel();
    },

    addObjectToTank(material, dropEvent) {
        const tank = document.getElementById('tank');
        const tankObjects = document.getElementById('tank-objects');
        const tankRect = tank.getBoundingClientRect();

        const objectDensity = material.density || Physics.calculateDensity(material.mass, material.volume);
        const stateInfo = Physics.predictState(objectDensity, this.currentLiquidDensity);
        
        const displacement = Physics.calculateDisplacement(
            material.volume, 
            objectDensity, 
            this.currentLiquidDensity
        );
        
        const waterRise = Physics.calculateWaterLevelRise(displacement, this.tankBaseArea);
        
        const tankWidth = tankRect.width - 30;
        const objSize = Math.min(60, Math.max(40, tankWidth / 8));
        
        let offsetX, offsetY;
        if (dropEvent) {
            offsetX = dropEvent.clientX - tankRect.left - objSize / 2;
            offsetX = Math.max(10, Math.min(tankWidth - objSize - 10, offsetX));
            offsetY = dropEvent.clientY - tankRect.top - objSize / 2;
        } else {
            offsetX = 20 + (this.tankObjects.length % 5) * 70;
            offsetY = 20;
        }

        const objElement = document.createElement('div');
        objElement.className = `tank-object ${stateInfo.state === 'floating' ? 'floating' : ''}`;
        objElement.style.width = `${objSize}px`;
        objElement.style.height = `${objSize}px`;
        objElement.style.left = `${offsetX}px`;
        objElement.style.top = `${offsetY}px`;
        objElement.style.background = material.color || '#667eea';
        objElement.style.fontSize = `${objSize * 0.5}px`;
        objElement.innerHTML = material.icon || '📦';
        objElement.dataset.objectId = `obj_${Date.now()}`;
        
        const objData = {
            id: objElement.dataset.objectId,
            material: material,
            density: objectDensity,
            displacement: displacement,
            state: stateInfo.state,
            stateLabel: stateInfo.label,
            stateIcon: stateInfo.icon,
            element: objElement
        };

        this.tankObjects.push(objData);
        tankObjects.appendChild(objElement);

        this.createSplashEffect(offsetX + objSize / 2, offsetY + objSize / 2);

        setTimeout(() => {
            const tankHeight = tankRect.height;
            const waterHeight = tankHeight * (this.currentWaterLevel / 100);
            
            let finalY;
            if (stateInfo.state === 'floating') {
                const submergedRatio = objectDensity / this.currentLiquidDensity;
                const objSubmerged = objSize * submergedRatio;
                finalY = waterHeight - objSubmerged;
            } else if (stateInfo.state === 'suspended') {
                finalY = waterHeight - objSize / 2 - 20;
            } else {
                finalY = waterHeight - objSize;
            }
            
            finalY = Math.max(10, Math.min(tankHeight - objSize - 10, finalY));
            objElement.style.top = `${finalY}px`;
        }, 50);

        this.currentWaterLevel += waterRise;
        this.updateWaterLevel();

        this.showObjectInfo(objData);

        App.updateCurrentObject({
            ...material,
            density: objectDensity,
            displacement: displacement,
            state: stateInfo.state,
            stateLabel: stateInfo.stateLabel,
            stateIcon: stateInfo.icon,
            buoyancy: Physics.calculateBuoyancy(this.currentLiquidDensity, displacement),
            gravity: material.mass * Physics.STANDARD_GRAVITY / 1000
        });
    },

    createSplashEffect(x, y) {
        const tank = document.getElementById('tank');
        
        for (let i = 0; i < 3; i++) {
            setTimeout(() => {
                const splash = document.createElement('div');
                splash.className = 'splash-effect';
                splash.style.left = `${x - 10}px`;
                splash.style.top = `${y - 10}px`;
                splash.style.width = '20px';
                splash.style.height = '20px';
                splash.style.animationDelay = `${i * 0.1}s`;
                
                tank.appendChild(splash);
                
                setTimeout(() => {
                    splash.remove();
                }, 600);
            }, i * 100);
        }
    },

    updateWaterLevel() {
        const waterElement = document.getElementById('tank-water');
        const levelElement = document.getElementById('info-water-level');
        
        waterElement.style.height = `${this.currentWaterLevel}%`;
        levelElement.textContent = `${this.currentWaterLevel.toFixed(1)} cm`;
    },

    showObjectInfo(objData) {
        const infoElement = document.getElementById('current-object-info');
        
        const buoyancy = Physics.calculateBuoyancy(this.currentLiquidDensity, objData.displacement);
        const gravity = objData.material.mass * Physics.STANDARD_GRAVITY / 1000;
        
        const stateClass = objData.state === 'floating' ? 'floating-state' : 
                          objData.state === 'sinking' ? 'sinking-state' : '';

        infoElement.innerHTML = `
            <div class="object-detail-grid">
                <div class="object-detail-item">
                    <span class="label">物体</span>
                    <span class="value">${objData.material.icon || '📦'} ${objData.material.name}</span>
                </div>
                <div class="object-detail-item highlight">
                    <span class="label">状态</span>
                    <span class="value">${objData.stateIcon} ${objData.stateLabel}</span>
                </div>
                <div class="object-detail-item">
                    <span class="label">体积</span>
                    <span class="value">${objData.material.volume} cm³</span>
                </div>
                <div class="object-detail-item">
                    <span class="label">质量</span>
                    <span class="value">${objData.material.mass} g</span>
                </div>
                <div class="object-detail-item highlight">
                    <span class="label">物体密度</span>
                    <span class="value">${objData.density.toFixed(3)} g/cm³</span>
                </div>
                <div class="object-detail-item highlight">
                    <span class="label">液体密度</span>
                    <span class="value">${this.currentLiquidDensity.toFixed(3)} g/cm³</span>
                </div>
                <div class="object-detail-item">
                    <span class="label">排水量</span>
                    <span class="value">${objData.displacement.toFixed(2)} cm³</span>
                </div>
                <div class="object-detail-item">
                    <span class="label">水位上升</span>
                    <span class="value">${Physics.calculateWaterLevelRise(objData.displacement, this.tankBaseArea).toFixed(2)} cm</span>
                </div>
                <div class="object-detail-item ${stateClass}">
                    <span class="label">浮力</span>
                    <span class="value">${buoyancy.toFixed(3)} N</span>
                </div>
                <div class="object-detail-item">
                    <span class="label">重力</span>
                    <span class="value">${gravity.toFixed(3)} N</span>
                </div>
            </div>
            <div style="margin-top: 12px; padding: 8px; background: #f7fafc; border-radius: 6px; font-size: 12px;">
                <strong>原理分析：</strong>
                ${objData.state === 'floating' 
                    ? `ρ<sub>物</sub>(${objData.density.toFixed(3)}) &lt; ρ<sub>液</sub>(${this.currentLiquidDensity.toFixed(3)})，F<sub>浮</sub>(${buoyancy.toFixed(3)}N) = G(${gravity.toFixed(3)}N)，二力平衡`
                    : objData.state === 'suspended'
                    ? `ρ<sub>物</sub>(${objData.density.toFixed(3)}) ≈ ρ<sub>液</sub>(${this.currentLiquidDensity.toFixed(3)})，F<sub>浮</sub>(${buoyancy.toFixed(3)}N) = G(${gravity.toFixed(3)}N)，可停留在任意深度`
                    : `ρ<sub>物</sub>(${objData.density.toFixed(3)}) &gt; ρ<sub>液</sub>(${this.currentLiquidDensity.toFixed(3)})，F<sub>浮</sub>(${buoyancy.toFixed(3)}N) &lt; G(${gravity.toFixed(3)}N)，物体下沉`
                }
            </div>
        `;
    },

    setLiquidDensity(density) {
        this.currentLiquidDensity = Number(density);
        document.getElementById('info-liquid-density').textContent = `${density} g/cm³`;
        
        for (const objData of this.tankObjects) {
            const newState = Physics.predictState(objData.density, this.currentLiquidDensity);
            objData.state = newState.state;
            objData.stateLabel = newState.label;
            objData.stateIcon = newState.icon;
            
            const displacement = Physics.calculateDisplacement(
                objData.material.volume,
                objData.density,
                this.currentLiquidDensity
            );
            objData.displacement = displacement;
            
            const element = objData.element;
            element.classList.remove('floating');
            if (newState.state === 'floating') {
                element.classList.add('floating');
            }
            
            this.animateObjectToState(objData);
        }
        
        this.recalculateWaterLevel();
        ChartManager.updateChart(this.currentLiquidDensity);
    },

    animateObjectToState(objData) {
        const tank = document.getElementById('tank');
        const tankRect = tank.getBoundingClientRect();
        const tankHeight = tankRect.height;
        const waterHeight = tankHeight * (this.currentWaterLevel / 100);
        const objSize = parseInt(objData.element.style.width);
        
        let finalY;
        if (objData.state === 'floating') {
            const submergedRatio = objData.density / this.currentLiquidDensity;
            const objSubmerged = objSize * submergedRatio;
            finalY = waterHeight - objSubmerged;
        } else if (objData.state === 'suspended') {
            finalY = waterHeight - objSize / 2 - 20;
        } else {
            finalY = waterHeight - objSize;
        }
        
        finalY = Math.max(10, Math.min(tankHeight - objSize - 10, finalY));
        objData.element.style.top = `${finalY}px`;
        
        this.showObjectInfo(objData);
    },

    recalculateWaterLevel() {
        let totalDisplacement = 0;
        for (const objData of this.tankObjects) {
            totalDisplacement += objData.displacement;
        }
        this.currentWaterLevel = this.initialWaterLevel + 
            Physics.calculateWaterLevelRise(totalDisplacement, this.tankBaseArea);
        this.updateWaterLevel();
    },

    clearTank() {
        this.tankObjects = [];
        this.currentWaterLevel = this.initialWaterLevel;
        document.getElementById('tank-objects').innerHTML = '';
        this.updateWaterLevel();
        
        document.getElementById('current-object-info').innerHTML = 
            '<p class="hint">将物体拖入水槽查看详细数据</p>';
        
        App.clearCurrentObject();
    },

    getTankDataForSubmission() {
        return this.tankObjects.map(obj => ({
            name: obj.material.name,
            volume: obj.material.volume,
            mass: obj.material.mass,
            liquidDensity: this.currentLiquidDensity,
            displacement: obj.displacement,
            density: obj.density,
            state: obj.state
        }));
    },

    removeObject(objectId) {
        const index = this.tankObjects.findIndex(o => o.id === objectId);
        if (index !== -1) {
            const obj = this.tankObjects[index];
            obj.element.remove();
            this.tankObjects.splice(index, 1);
            this.recalculateWaterLevel();
            
            if (this.tankObjects.length === 0) {
                document.getElementById('current-object-info').innerHTML = 
                    '<p class="hint">将物体拖入水槽查看详细数据</p>';
            }
        }
    }
};
