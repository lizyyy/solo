const DataTrace = {
    registry: new Map(),
    traceLinks: new Map(),

    init() {
        this.registry.clear();
        this.traceLinks.clear();
    },

    register(item, type, batchId, source = 'import') {
        if (!item || !item.id) {
            console.error('无法注册无ID的数据项');
            return null;
        }

        const traceInfo = {
            id: item.id,
            type: type,
            batchId: batchId,
            source: source,
            importTime: Date.now(),
            rawData: JSON.parse(JSON.stringify(item)),
            links: [],
            usedIn: []
        };

        this.registry.set(item.id, traceInfo);
        return traceInfo;
    },

    getTraceInfo(id) {
        return this.registry.get(id) || null;
    },

    addLink(fromId, toId, relation) {
        const fromInfo = this.registry.get(fromId);
        const toInfo = this.registry.get(toId);

        if (fromInfo && toInfo) {
            fromInfo.links.push({
                toId: toId,
                relation: relation,
                time: Date.now()
            });
            toInfo.usedIn.push({
                fromId: fromId,
                relation: relation,
                time: Date.now()
            });

            const linkKey = `${fromId}-${toId}-${relation}`;
            this.traceLinks.set(linkKey, { fromId, toId, relation, time: Date.now() });
        }
    },

    getFullTrace(id) {
        const traceInfo = this.getTraceInfo(id);
        if (!traceInfo) return null;

        return {
            info: traceInfo,
            upstream: this.getUpstreamTrace(id),
            downstream: this.getDownstreamTrace(id)
        };
    },

    getUpstreamTrace(id, depth = 0, maxDepth = 5) {
        if (depth >= maxDepth) return [];

        const traceInfo = this.getTraceInfo(id);
        if (!traceInfo) return [];

        const upstream = [];
        for (const link of traceInfo.usedIn) {
            const parentInfo = this.getTraceInfo(link.fromId);
            if (parentInfo) {
                upstream.push({
                    id: link.fromId,
                    type: parentInfo.type,
                    name: parentInfo.rawData.name || parentInfo.id,
                    relation: link.relation,
                    time: link.time,
                    children: this.getUpstreamTrace(link.fromId, depth + 1, maxDepth)
                });
            }
        }
        return upstream;
    },

    getDownstreamTrace(id, depth = 0, maxDepth = 5) {
        if (depth >= maxDepth) return [];

        const traceInfo = this.getTraceInfo(id);
        if (!traceInfo) return [];

        const downstream = [];
        for (const link of traceInfo.links) {
            const childInfo = this.getTraceInfo(link.toId);
            if (childInfo) {
                downstream.push({
                    id: link.toId,
                    type: childInfo.type,
                    name: childInfo.rawData.name || childInfo.id,
                    relation: link.relation,
                    time: link.time,
                    children: this.getDownstreamTrace(link.toId, depth + 1, maxDepth)
                });
            }
        }
        return downstream;
    },

    createTraceButton(itemId, itemType) {
        const btn = document.createElement('button');
        btn.className = 'trace-btn';
        btn.innerHTML = '🔗';
        btn.title = '查看数据溯源';
        btn.onclick = (e) => {
            e.stopPropagation();
            this.showTraceModal(itemId, itemType);
        };
        return btn;
    },

    createTraceableElement(text, itemId, itemType, className = '') {
        const span = document.createElement('span');
        span.className = `traceable ${className}`;
        span.textContent = text;
        span.title = '点击追溯来源';
        span.onclick = (e) => {
            e.stopPropagation();
            this.showTraceModal(itemId, itemType);
        };
        return span;
    },

    showTraceModal(itemId, itemType) {
        const trace = this.getFullTrace(itemId);
        if (!trace) {
            showToast('未找到溯源信息', 'warning');
            return;
        }

        const modal = document.getElementById('traceModal');
        const body = document.getElementById('traceModalBody');
        
        const typeNames = {
            'ship': '飞船',
            'body': '天体',
            'fuel': '燃料卡',
            'round': '回合记录',
            'game': '游戏记录'
        };

        const typeName = typeNames[itemType] || itemType;
        const item = trace.info.rawData;

        let html = `
            <div class="trace-section">
                <h4>📋 基本信息</h4>
                <div class="trace-item">
                    <span class="trace-label">类型</span>
                    <span class="trace-value">${typeName}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">ID</span>
                    <span class="trace-value">${item.id}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">名称</span>
                    <span class="trace-value">${item.name || '-'}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">来源批次</span>
                    <span class="trace-value">${trace.info.batchId}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">导入时间</span>
                    <span class="trace-value">${formatDisplayTime(new Date(trace.info.importTime))}</span>
                </div>
                <div class="trace-item">
                    <span class="trace-label">数据来源</span>
                    <span class="trace-value">${trace.info.source}</span>
                </div>
            </div>
        `;

        if (itemType === 'body') {
            html += `
                <div class="trace-section">
                    <h4>🌍 天体参数</h4>
                    <div class="trace-item">
                        <span class="trace-label">类型</span>
                        <span class="trace-value">${GAME_CONFIG.BODY_TYPES[item.type]?.name || item.type}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">质量</span>
                        <span class="trace-value">${item.mass}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">半径</span>
                        <span class="trace-value">${item.radius}</span>
                    </div>
                </div>
            `;
        } else if (itemType === 'ship') {
            html += `
                <div class="trace-section">
                    <h4>🚀 飞船参数</h4>
                    <div class="trace-item">
                        <span class="trace-label">基础速度</span>
                        <span class="trace-value">${item.baseVelocity}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">描述</span>
                        <span class="trace-value">${item.description || '-'}</span>
                    </div>
                </div>
            `;
        } else if (itemType === 'fuel') {
            html += `
                <div class="trace-section">
                    <h4>⛽ 燃料卡参数</h4>
                    <div class="trace-item">
                        <span class="trace-label">类型</span>
                        <span class="trace-value">${GAME_CONFIG.FUEL_TYPES[item.type]?.name || item.type}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">速度增量</span>
                        <span class="trace-value">${item.velocityBoost}</span>
                    </div>
                    <div class="trace-item">
                        <span class="trace-label">描述</span>
                        <span class="trace-value">${item.description || '-'}</span>
                    </div>
                </div>
            `;
        }

        html += `
            <div class="trace-section">
                <h4>🔄 数据溯源链路</h4>
                <div class="trace-timeline">
                    <div class="trace-step">
                        <div class="trace-step-icon">📥</div>
                        <div class="trace-step-content">
                            <div class="trace-step-title">数据导入</div>
                            <div class="trace-step-desc">从${trace.info.source}导入原始数据</div>
                            <div class="trace-step-time">${formatDisplayTime(new Date(trace.info.importTime))}</div>
                        </div>
                    </div>
        `;

        if (trace.downstream && trace.downstream.length > 0) {
            for (const link of trace.downstream) {
                const linkTypeNames = {
                    'used_in_game': '用于游戏',
                    'used_in_round': '用于回合',
                    'selected_fuel': '被选为燃料'
                };
                html += `
                    <div class="trace-step">
                        <div class="trace-step-icon">🔗</div>
                        <div class="trace-step-content">
                            <div class="trace-step-title">${linkTypeNames[link.relation] || link.relation}</div>
                            <div class="trace-step-desc">${typeNames[link.type] || link.type}: ${link.name}</div>
                            <div class="trace-step-time">${formatDisplayTime(new Date(link.time))}</div>
                        </div>
                    </div>
                `;
            }
        }

        if (trace.upstream && trace.upstream.length > 0) {
            for (const link of trace.upstream) {
                const linkTypeNames = {
                    'used_in_game': '来自游戏',
                    'used_in_round': '来自回合',
                    'selected_fuel': '选择了燃料'
                };
                html += `
                    <div class="trace-step">
                        <div class="trace-step-icon">📌</div>
                        <div class="trace-step-content">
                            <div class="trace-step-title">${linkTypeNames[link.relation] || link.relation}</div>
                            <div class="trace-step-desc">${typeNames[link.type] || link.type}: ${link.name}</div>
                            <div class="trace-step-time">${formatDisplayTime(new Date(link.time))}</div>
                        </div>
                    </div>
                `;
            }
        }

        html += `
                </div>
            </div>
        `;

        body.innerHTML = html;
        modal.classList.add('active');
    },

    closeTraceModal() {
        const modal = document.getElementById('traceModal');
        modal.classList.remove('active');
    },

    exportTraceData(batchId) {
        const batchData = {
            batchId: batchId,
            exportTime: Date.now(),
            registry: {},
            links: []
        };

        for (const [id, info] of this.registry.entries()) {
            if (info.batchId === batchId) {
                batchData.registry[id] = info;
            }
        }

        for (const [key, link] of this.traceLinks.entries()) {
            const fromInfo = this.registry.get(link.fromId);
            if (fromInfo && fromInfo.batchId === batchId) {
                batchData.links.push(link);
            }
        }

        return batchData;
    },

    importTraceData(traceData) {
        if (!traceData || !traceData.registry) return;

        for (const [id, info] of Object.entries(traceData.registry)) {
            this.registry.set(id, info);
        }

        if (traceData.links) {
            for (const link of traceData.links) {
                const linkKey = `${link.fromId}-${link.toId}-${link.relation}`;
                this.traceLinks.set(linkKey, link);
            }
        }
    }
};
