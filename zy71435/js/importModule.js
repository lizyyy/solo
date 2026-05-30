const ImportModule = {
    currentBatchId: null,
    data: {
        ships: [],
        bodies: [],
        fuels: []
    },
    validationResults: {
        ships: [],
        bodies: [],
        fuels: []
    },

    init() {
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('loadSampleBtn').addEventListener('click', () => this.loadSampleData());
        document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearData());
    },

    loadSampleData() {
        showToast('正在加载样例数据...', 'info');
        
        const sampleData = SampleData.generate();
        this.processImportData(sampleData, '样例数据');
    },

    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        showToast(`正在导入文件: ${file.name}...`, 'info');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.processImportData(data, file.name);
            } catch (error) {
                showToast(`文件解析失败: ${error.message}`, 'error');
            }
        };
        reader.onerror = () => {
            showToast('文件读取失败', 'error');
        };
        reader.readAsText(file);
        
        event.target.value = '';
    },

    processImportData(data, sourceName) {
        if (!data || typeof data !== 'object') {
            showToast('导入数据格式错误', 'error');
            return;
        }

        const batchId = data.batchId || generateBatchId();
        this.currentBatchId = batchId;

        DataTrace.init();

        this.data = {
            ships: [],
            bodies: [],
            fuels: []
        };
        this.validationResults = {
            ships: [],
            bodies: [],
            fuels: []
        };

        let totalItems = 0;
        let errorItems = 0;
        let warningItems = 0;

        if (data.ships && Array.isArray(data.ships)) {
            for (const ship of data.ships) {
                ship._batchId = batchId;
                const result = this.validateShip(ship);
                this.validationResults.ships.push(result);
                
                if (result.valid) {
                    DataTrace.register(ship, 'ship', batchId, sourceName);
                    this.data.ships.push(ship);
                }
                
                totalItems++;
                if (!result.valid) errorItems++;
            }
        }

        if (data.bodies && Array.isArray(data.bodies)) {
            for (const body of data.bodies) {
                body._batchId = batchId;
                const result = this.validateBody(body);
                this.validationResults.bodies.push(result);
                
                DataTrace.register(body, 'body', batchId, sourceName);
                
                if (result.valid) {
                    this.data.bodies.push(body);
                }
                
                totalItems++;
                if (!result.valid) errorItems++;
                else if (result.warnings && result.warnings.length > 0) warningItems++;
            }
        }

        if (data.fuels && Array.isArray(data.fuels)) {
            for (const fuel of data.fuels) {
                fuel._batchId = batchId;
                const result = this.validateFuel(fuel);
                this.validationResults.fuels.push(result);
                
                DataTrace.register(fuel, 'fuel', batchId, sourceName);
                
                if (result.valid) {
                    this.data.fuels.push(fuel);
                }
                
                totalItems++;
                if (!result.valid) errorItems++;
            }
        }

        const traceData = DataTrace.exportTraceData(batchId);
        const storedData = {
            ...this.data,
            batchId: batchId,
            source: sourceName,
            importTime: Date.now(),
            validationResults: this.validationResults,
            traceData: traceData
        };
        
        localStorage.setItem(GAME_CONFIG.STORAGE_KEYS.gameData, JSON.stringify(storedData));

        document.getElementById('batchId').textContent = batchId;

        let statusClass = 'success';
        let statusMessage = `导入成功！共 ${totalItems} 项数据`;
        
        if (errorItems > 0 && errorItems === totalItems) {
            statusClass = 'error';
            statusMessage = `导入失败！所有 ${totalItems} 项数据均有错误`;
        } else if (errorItems > 0 || warningItems > 0) {
            statusClass = 'warning';
            statusMessage = `导入完成！${totalItems} 项数据，${errorItems} 项错误，${warningItems} 项警告`;
        }

        const statusEl = document.getElementById('importStatus');
        statusEl.className = `import-status ${statusClass}`;
        statusEl.innerHTML = `<span class="status-text">${statusMessage} (批次: ${batchId})</span>`;

        this.updatePreview();

        if (errorItems > 0) {
            showToast(statusMessage, 'warning', 5000);
        } else {
            showToast(statusMessage, 'success');
        }
    },

    validateShip(ship) {
        const result = {
            item: ship,
            valid: true,
            errors: [],
            warnings: []
        };

        if (!ship.id) {
            result.errors.push('缺少ID');
            result.valid = false;
        }

        if (!ship.name) {
            result.errors.push('缺少名称');
            result.valid = false;
        }

        if (!ship.baseVelocity) {
            result.errors.push('缺少基础速度');
            result.valid = false;
        } else {
            const velResult = Physics.parseVelocity(ship.baseVelocity);
            if (!velResult.valid) {
                result.errors.push(`速度单位错误: ${velResult.error}`);
                result.valid = false;
            }
        }

        return result;
    },

    validateBody(body) {
        const result = {
            item: body,
            valid: true,
            errors: [],
            warnings: []
        };

        if (!body.id) {
            result.errors.push('缺少ID');
            result.valid = false;
        }

        if (!body.name) {
            result.errors.push('缺少名称');
            result.valid = false;
        }

        if (!body.type) {
            result.errors.push('缺少天体类型');
            result.valid = false;
        } else if (!GAME_CONFIG.BODY_TYPES[body.type]) {
            result.warnings.push(`未知天体类型: ${body.type}`);
        }

        if (!body.mass) {
            result.errors.push('缺少质量');
            result.valid = false;
        } else {
            const massResult = Physics.parseMass(body.mass);
            if (!massResult.valid) {
                result.errors.push(`质量单位错误: ${massResult.error}`);
                result.valid = false;
            }
        }

        if (!body.radius) {
            result.errors.push('缺少半径');
            result.valid = false;
        } else {
            const radiusResult = Physics.parseRadius(body.radius);
            if (!radiusResult.valid) {
                result.errors.push(`半径单位错误: ${radiusResult.error}`);
                result.valid = false;
            }
        }

        const escapeResult = Physics.calculateEscapeVelocity(body);
        if (!escapeResult.valid) {
            result.warnings.push(`逃逸速度计算警告: ${escapeResult.error}`);
        }

        return result;
    },

    validateFuel(fuel) {
        const result = {
            item: fuel,
            valid: true,
            errors: [],
            warnings: []
        };

        if (!fuel.id) {
            result.errors.push('缺少ID');
            result.valid = false;
        }

        if (!fuel.name) {
            result.errors.push('缺少名称');
            result.valid = false;
        }

        if (!fuel.type) {
            result.errors.push('缺少燃料类型');
            result.valid = false;
        } else if (!GAME_CONFIG.FUEL_TYPES[fuel.type]) {
            result.warnings.push(`未知燃料类型: ${fuel.type}`);
        }

        if (!fuel.velocityBoost) {
            result.errors.push('缺少速度增量');
            result.valid = false;
        } else {
            const velResult = Physics.parseVelocity(fuel.velocityBoost);
            if (!velResult.valid) {
                result.errors.push(`速度增量单位错误: ${velResult.error}`);
                result.valid = false;
            }
        }

        return result;
    },

    updatePreview() {
        this.renderShipPreview();
        this.renderBodyPreview();
        this.renderFuelPreview();
    },

    renderShipPreview() {
        const container = document.getElementById('shipList');
        document.getElementById('shipCount').textContent = this.data.ships.length;

        if (this.validationResults.ships.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无飞船数据</p></div>';
            return;
        }

        container.innerHTML = this.validationResults.ships.map(result => {
            const ship = result.item;
            let itemClass = 'card-item';
            let errorHtml = '';

            if (!result.valid) {
                itemClass += ' error';
                errorHtml = `<div class="card-error">${result.errors.join('；')}</div>`;
            }

            return `
                <div class="${itemClass}" data-type="ship" data-id="${ship.id}">
                    ${DataTrace.createTraceButton(ship.id, 'ship').outerHTML}
                    <div class="card-title">
                        <span>${ship.name || '未命名'}</span>
                        <span class="card-id">${ship.id}</span>
                    </div>
                    <div class="card-props">
                        基础速度: ${ship.baseVelocity || '-'}
                    </div>
                    ${errorHtml}
                </div>
            `;
        }).join('');

        container.querySelectorAll('.card-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('trace-btn')) {
                    const id = el.dataset.id;
                    DataTrace.showTraceModal(id, 'ship');
                }
            });
        });

        container.querySelectorAll('.trace-btn').forEach(btn => {
            btn.outerHTML = btn.outerHTML;
        });
    },

    renderBodyPreview() {
        const container = document.getElementById('bodyList');
        document.getElementById('bodyCount').textContent = this.data.bodies.length;

        if (this.validationResults.bodies.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无天体数据</p></div>';
            return;
        }

        container.innerHTML = this.validationResults.bodies.map(result => {
            const body = result.item;
            let itemClass = 'card-item';
            let errorHtml = '';

            if (!result.valid) {
                itemClass += ' error';
                errorHtml = `<div class="card-error">${result.errors.join('；')}</div>`;
            } else if (result.warnings && result.warnings.length > 0) {
                itemClass += ' warning';
                errorHtml = `<div class="card-error" style="color: var(--accent-warning); border-color: var(--accent-warning);">⚠️ ${result.warnings.join('；')}</div>`;
            }

            const typeInfo = GAME_CONFIG.BODY_TYPES[body.type] || { name: body.type, icon: '❓' };

            return `
                <div class="${itemClass}" data-type="body" data-id="${body.id}">
                    ${DataTrace.createTraceButton(body.id, 'body').outerHTML}
                    <div class="card-title">
                        <span>${typeInfo.icon} ${body.name || '未命名'}</span>
                        <span class="card-id">${body.id}</span>
                    </div>
                    <div class="card-props">
                        ${typeInfo.name} | 质量: ${body.mass || '-'} | 半径: ${body.radius || '-'}
                    </div>
                    ${errorHtml}
                </div>
            `;
        }).join('');

        container.querySelectorAll('.card-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('trace-btn')) {
                    const id = el.dataset.id;
                    DataTrace.showTraceModal(id, 'body');
                }
            });
        });
    },

    renderFuelPreview() {
        const container = document.getElementById('fuelList');
        document.getElementById('fuelCount').textContent = this.data.fuels.length;

        if (this.validationResults.fuels.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>暂无燃料卡数据</p></div>';
            return;
        }

        container.innerHTML = this.validationResults.fuels.map(result => {
            const fuel = result.item;
            let itemClass = 'card-item';
            let errorHtml = '';

            if (!result.valid) {
                itemClass += ' error';
                errorHtml = `<div class="card-error">${result.errors.join('；')}</div>`;
            }

            const typeInfo = GAME_CONFIG.FUEL_TYPES[fuel.type] || { name: fuel.type, color: '#888' };

            return `
                <div class="${itemClass}" data-type="fuel" data-id="${fuel.id}">
                    ${DataTrace.createTraceButton(fuel.id, 'fuel').outerHTML}
                    <div class="card-title">
                        <span style="color: ${typeInfo.color}">${fuel.name || '未命名'}</span>
                        <span class="card-id">${fuel.id}</span>
                    </div>
                    <div class="card-props">
                        ${typeInfo.name} | +${fuel.velocityBoost || '-'}
                    </div>
                    ${errorHtml}
                </div>
            `;
        }).join('');

        container.querySelectorAll('.card-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('trace-btn')) {
                    const id = el.dataset.id;
                    DataTrace.showTraceModal(id, 'fuel');
                }
            });
        });
    },

    clearData() {
        if (!confirm('确定要清空所有导入数据吗？')) return;

        this.data = { ships: [], bodies: [], fuels: [] };
        this.validationResults = { ships: [], bodies: [], fuels: [] };
        this.currentBatchId = null;
        
        DataTrace.init();
        
        localStorage.removeItem(GAME_CONFIG.STORAGE_KEYS.gameData);
        
        document.getElementById('batchId').textContent = '未开始';
        document.getElementById('importStatus').className = 'import-status';
        document.getElementById('importStatus').innerHTML = '<span class="status-text">等待导入数据...</span>';
        
        this.updatePreview();
        showToast('数据已清空', 'success');
    },

    loadStoredData() {
        const stored = localStorage.getItem(GAME_CONFIG.STORAGE_KEYS.gameData);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                this.currentBatchId = data.batchId;
                
                if (data.traceData) {
                    DataTrace.importTraceData(data.traceData);
                }
                
                this.data = {
                    ships: data.ships || [],
                    bodies: data.bodies || [],
                    fuels: data.fuels || []
                };
                this.validationResults = data.validationResults || { ships: [], bodies: [], fuels: [] };
                
                document.getElementById('batchId').textContent = data.batchId || '未开始';
                
                const statusEl = document.getElementById('importStatus');
                statusEl.className = 'import-status success';
                statusEl.innerHTML = `<span class="status-text">已加载上次保存的数据 (批次: ${data.batchId})</span>`;
                
                this.updatePreview();
                return true;
            } catch (e) {
                console.error('加载存储数据失败:', e);
            }
        }
        return false;
    },

    getValidData() {
        return {
            ships: this.data.ships,
            bodies: this.data.bodies,
            fuels: this.data.fuels,
            batchId: this.currentBatchId
        };
    }
};
