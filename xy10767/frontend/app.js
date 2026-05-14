const { createApp } = Vue;

const API_BASE = 'http://localhost:8000';

const app = createApp({
    data() {
        return {
            currentView: 'datasets',
            datasets: [],
            failedItems: [],
            selectedDataset: null,
            lineageGraph: null,
            failedItemDetail: null,
            showModal: false,
            selectedMappingId: null,
            correctionForm: {
                mapping_rule: '',
                transformation_logic: '',
                corrected_by: '',
                correction_reason: ''
            },
            message: '',
            messageType: 'success'
        };
    },
    mounted() {
        this.loadDatasets();
        this.loadFailedItems();
    },
    methods: {
        async loadDatasets() {
            try {
                const response = await axios.get(`${API_BASE}/api/datasets/`);
                this.datasets = response.data;
            } catch (error) {
                this.showMessage('加载数据集失败', 'error');
            }
        },
        async loadFailedItems() {
            try {
                const response = await axios.get(`${API_BASE}/api/failed-items/`);
                this.failedItems = response.data;
            } catch (error) {
                this.showMessage('加载失败记录失败', 'error');
            }
        },
        async viewDatasetDetail(datasetId) {
            try {
                const response = await axios.get(`${API_BASE}/api/datasets/${datasetId}`);
                this.selectedDataset = response.data;
                
                const graphResponse = await axios.get(`${API_BASE}/api/lineage-graphs/${datasetId}`);
                this.processLineageGraph(graphResponse.data);
                
                this.currentView = 'datasetDetail';
            } catch (error) {
                this.showMessage('加载数据集详情失败', 'error');
            }
        },
        async viewFailedItemDetail(type, id) {
            try {
                const response = await axios.get(`${API_BASE}/api/failed-items/${type}/${id}`);
                this.failedItemDetail = response.data;
                this.currentView = 'failedItemDetail';
            } catch (error) {
                this.showMessage('加载失败详情失败', 'error');
            }
        },
        processLineageGraph(graphData) {
            if (!graphData || !graphData.nodes) {
                this.lineageGraph = null;
                return;
            }

            const nodes = graphData.nodes.map((node, idx) => {
                const type = node.type;
                let x, y;
                
                if (type === 'dataset') {
                    x = 400;
                    y = 250;
                } else if (type === 'upstream_task') {
                    const taskIdx = graphData.nodes.filter(n => n.type === 'upstream_task').indexOf(node);
                    x = 150;
                    y = 100 + taskIdx * 100;
                } else if (type === 'downstream_report') {
                    const reportIdx = graphData.nodes.filter(n => n.type === 'downstream_report').indexOf(node);
                    x = 650;
                    y = 100 + reportIdx * 100;
                } else if (type === 'field_mapping') {
                    const mappingIdx = graphData.nodes.filter(n => n.type === 'field_mapping').indexOf(node);
                    x = 400;
                    y = 400 + mappingIdx * 60;
                }
                
                return { ...node, x, y };
            });

            const edges = [];
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    const nodeA = nodes[i];
                    const nodeB = nodes[j];
                    
                    if ((nodeA.type === 'upstream_task' && nodeB.type === 'dataset') ||
                        (nodeA.type === 'dataset' && nodeB.type === 'downstream_report') ||
                        (nodeA.type === 'dataset' && nodeB.type === 'field_mapping')) {
                        edges.push({
                            x1: nodeA.x,
                            y1: nodeA.y,
                            x2: nodeB.x,
                            y2: nodeB.y
                        });
                    }
                    
                    if ((nodeB.type === 'upstream_task' && nodeA.type === 'dataset') ||
                        (nodeB.type === 'dataset' && nodeA.type === 'downstream_report') ||
                        (nodeB.type === 'dataset' && nodeA.type === 'field_mapping')) {
                        edges.push({
                            x1: nodeB.x,
                            y1: nodeB.y,
                            x2: nodeA.x,
                            y2: nodeA.y
                        });
                    }
                }
            }

            this.lineageGraph = { nodes, edges };
        },
        async createDemoData() {
            try {
                await axios.post(`${API_BASE}/api/demo/`);
                this.showMessage('演示数据创建成功', 'success');
                this.loadDatasets();
                this.loadFailedItems();
            } catch (error) {
                this.showMessage('创建演示数据失败', 'error');
            }
        },
        async recalculateLineage() {
            if (!this.selectedDataset) return;
            try {
                const response = await axios.post(`${API_BASE}/api/lineage-graphs/${this.selectedDataset.id}/recalculate`);
                this.processLineageGraph(response.data);
                this.showMessage('血缘关系重新计算成功', 'success');
            } catch (error) {
                this.showMessage('重新计算失败', 'error');
            }
        },
        async exportDataset() {
            if (!this.selectedDataset) return;
            try {
                const response = await axios.get(`${API_BASE}/api/export/${this.selectedDataset.id}`);
                const dataStr = JSON.stringify(response.data, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${this.selectedDataset.name}_export.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showMessage('数据导出成功', 'success');
            } catch (error) {
                this.showMessage('导出失败', 'error');
            }
        },
        showCorrectModal(mapping) {
            this.selectedMappingId = mapping.id;
            this.correctionForm = {
                mapping_rule: mapping.mapping_rule || '',
                transformation_logic: mapping.transformation_logic || '',
                corrected_by: '',
                correction_reason: ''
            };
            this.showModal = true;
        },
        async submitCorrection() {
            if (!this.correctionForm.corrected_by || !this.correctionForm.correction_reason) {
                this.showMessage('请填写修正人和修正原因', 'error');
                return;
            }
            try {
                await axios.put(
                    `${API_BASE}/api/field-mappings/${this.selectedMappingId}/correct`,
                    this.correctionForm
                );
                this.showModal = false;
                this.showMessage('修正成功', 'success');
                if (this.currentView === 'datasetDetail') {
                    this.viewDatasetDetail(this.selectedDataset.id);
                } else if (this.currentView === 'failedItemDetail') {
                    this.viewFailedItemDetail(this.failedItemDetail.type, this.failedItemDetail.id);
                }
                this.loadFailedItems();
            } catch (error) {
                this.showMessage('修正失败', 'error');
            }
        },
        handleNodeClick(node) {
            console.log('Node clicked:', node);
        },
        showMessage(msg, type = 'success') {
            this.message = msg;
            this.messageType = type;
            setTimeout(() => {
                this.message = '';
            }, 3000);
        },
        formatDate(dateStr) {
            if (!dateStr) return '';
            return new Date(dateStr).toLocaleString('zh-CN');
        },
        getTypeLabel(type) {
            const labels = {
                'upstream_task': '上游任务',
                'downstream_report': '下游报表',
                'field_mapping': '字段映射',
                'change_impact': '变更影响'
            };
            return labels[type] || type;
        },
        getTypeBadgeClass(type) {
            const classes = {
                'upstream_task': 'bg-green-100 text-green-800',
                'downstream_report': 'bg-purple-100 text-purple-800',
                'field_mapping': 'bg-yellow-100 text-yellow-800',
                'change_impact': 'bg-orange-100 text-orange-800'
            };
            return classes[type] || 'bg-gray-100 text-gray-800';
        },
        getMappingStatusClass(status) {
            const classes = {
                'valid': 'bg-green-100 text-green-800',
                'invalid': 'bg-red-100 text-red-800',
                'corrected': 'bg-blue-100 text-blue-800'
            };
            return classes[status] || 'bg-gray-100 text-gray-800';
        },
        getSeverityClass(severity) {
            const classes = {
                'high': 'bg-red-100 text-red-800',
                'medium': 'bg-yellow-100 text-yellow-800',
                'low': 'bg-green-100 text-green-800'
            };
            return classes[severity] || 'bg-gray-100 text-gray-800';
        }
    }
});

app.mount('#app');
