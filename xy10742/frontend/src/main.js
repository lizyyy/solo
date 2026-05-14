const { createApp, ref, computed, onMounted } = Vue

createApp({
    setup() {
        const API_BASE = 'http://localhost:8001/api'
        
        const statistics = ref({})
        const records = ref([])
        const sliceRules = ref([])
        const currentFilter = ref(null)
        const showAddRecord = ref(false)
        const showAddRule = ref(false)
        const selectedRecord = ref(null)
        const editingRule = ref(null)
        
        const newRecord = ref({
            document_name: '',
            document_id: '',
            original_content: '',
            slice_rule_id: null
        })
        
        const ruleForm = ref({
            name: '',
            description: '',
            min_length: 50,
            max_length: 500,
            overlap: 50,
            separator: '\n\n',
            is_active: true
        })
        
        const approvalForm = ref({
            operator: '',
            comment: ''
        })

        const filteredRecords = computed(() => {
            if (!currentFilter.value) {
                return records.value
            }
            return records.value.filter(r => r.status === currentFilter.value)
        })

        const getStatusText = (status) => {
            const statusMap = {
                'success': '成功',
                'blocked': '拦截',
                'compensated': '补偿',
                'pending_review': '待复核',
                'pending': '待处理',
                'error': '错误'
            }
            return statusMap[status] || status
        }

        const getApprovalActionText = (action) => {
            const actionMap = {
                'approve': '通过',
                'reject': '拒绝',
                'compensate': '标记补偿'
            }
            return actionMap[action] || action
        }

        const formatDate = (dateStr) => {
            if (!dateStr) return ''
            const date = new Date(dateStr)
            return date.toLocaleString('zh-CN')
        }

        const loadStatistics = async () => {
            try {
                const res = await fetch(`${API_BASE}/statistics`)
                statistics.value = await res.json()
            } catch (e) {
                console.error('Failed to load statistics:', e)
            }
        }

        const loadRecords = async () => {
            try {
                const res = await fetch(`${API_BASE}/records`)
                records.value = await res.json()
            } catch (e) {
                console.error('Failed to load records:', e)
            }
        }

        const loadSliceRules = async () => {
            try {
                const res = await fetch(`${API_BASE}/rules`)
                sliceRules.value = await res.json()
            } catch (e) {
                console.error('Failed to load rules:', e)
            }
        }

        const addRecord = async () => {
            try {
                const res = await fetch(`${API_BASE}/records`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newRecord.value)
                })
                if (res.ok) {
                    showAddRecord.value = false
                    newRecord.value = {
                        document_name: '',
                        document_id: '',
                        original_content: '',
                        slice_rule_id: null
                    }
                    await loadRecords()
                    await loadStatistics()
                }
            } catch (e) {
                console.error('Failed to add record:', e)
            }
        }

        const saveRule = async () => {
            try {
                const method = editingRule.value ? 'PUT' : 'POST'
                const url = editingRule.value 
                    ? `${API_BASE}/rules/${editingRule.value.id}`
                    : `${API_BASE}/rules`
                
                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ruleForm.value)
                })
                
                if (res.ok) {
                    await loadSliceRules()
                    await loadRecords()
                    await loadStatistics()
                    
                    ruleForm.value = {
                        name: '',
                        description: '',
                        min_length: 50,
                        max_length: 500,
                        overlap: 50,
                        separator: '\n\n',
                        is_active: true
                    }
                    editingRule.value = null
                }
            } catch (e) {
                console.error('Failed to save rule:', e)
            }
        }

        const editRule = (rule) => {
            editingRule.value = rule
            ruleForm.value = { ...rule }
        }

        const viewDetail = async (record) => {
            try {
                const res = await fetch(`${API_BASE}/records/${record.id}`)
                selectedRecord.value = await res.json()
            } catch (e) {
                console.error('Failed to load record detail:', e)
            }
        }

        const recalculateRecord = async (record) => {
            try {
                const res = await fetch(`${API_BASE}/records/${record.id}/recalculate`, {
                    method: 'POST'
                })
                if (res.ok) {
                    await loadRecords()
                    await loadStatistics()
                }
            } catch (e) {
                console.error('Failed to recalculate:', e)
            }
        }

        const submitApproval = async (action) => {
            try {
                const res = await fetch(`${API_BASE}/approvals`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        quality_record_id: selectedRecord.value.id,
                        action: action,
                        comment: approvalForm.value.comment,
                        operator: approvalForm.value.operator
                    })
                })
                if (res.ok) {
                    selectedRecord.value = null
                    approvalForm.value = { operator: '', comment: '' }
                    await loadRecords()
                    await loadStatistics()
                }
            } catch (e) {
                console.error('Failed to submit approval:', e)
            }
        }

        const exportExcel = async () => {
            try {
                const res = await fetch(`${API_BASE}/export`)
                const blob = await res.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'quality_check_list.xlsx'
                a.click()
                window.URL.revokeObjectURL(url)
            } catch (e) {
                console.error('Failed to export:', e)
            }
        }

        onMounted(() => {
            loadStatistics()
            loadRecords()
            loadSliceRules()
        })

        return {
            statistics,
            records,
            sliceRules,
            currentFilter,
            showAddRecord,
            showAddRule,
            selectedRecord,
            editingRule,
            newRecord,
            ruleForm,
            approvalForm,
            filteredRecords,
            getStatusText,
            getApprovalActionText,
            formatDate,
            loadStatistics,
            addRecord,
            saveRule,
            editRule,
            viewDetail,
            recalculateRecord,
            submitApproval,
            exportExcel
        }
    }
}).mount('#app')
