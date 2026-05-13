const { createApp, ref, computed, onMounted } = Vue;

createApp({
    setup() {
        const currentUser = ref('管理员');
        const activeTab = ref('freezers');
        
        const freezers = ref([]);
        const vaccines = ref([]);
        const appointments = ref([]);
        const inventoryRecords = ref([]);
        const damageReports = ref([]);
        const history = ref([]);
        
        const stats = computed(() => ({
            freezers: freezers.value.length,
            vaccines: vaccines.value.length,
            appointments: appointments.value.length,
            pendingInventory: inventoryRecords.value.filter(i => i.status === 'pending' || i.status === 'discrepancy').length,
            pendingDamage: damageReports.value.filter(d => d.status === 'pending').length,
            totalOperations: history.value.length
        }));

        const selectedFreezer = ref(null);
        const newTemperature = ref(null);
        const tempError = ref('');
        
        const selectedInventory = ref(null);
        const reviewStatus = ref('matched');
        const reviewRemarks = ref('');
        
        const selectedDamage = ref(null);
        const approvalStatus = ref('approved');
        const approvalRemarks = ref('');
        
        const exportFilter = ref({
            responsible_person: '',
            batch_number: '',
            start_date: '',
            end_date: ''
        });

        const tempModal = new bootstrap.Modal('#tempModal');
        const reviewModal = new bootstrap.Modal('#reviewModal');
        const approveModal = new bootstrap.Modal('#approveModal');

        function getStatusClass(status) {
            const classMap = {
                'normal': 'status-normal',
                'pending': 'status-pending',
                'discrepancy': 'status-discrepancy',
                'matched': 'status-matched',
                'resolved': 'status-resolved',
                'approved': 'status-approved',
                'rejected': 'status-rejected',
                'confirmed': 'status-confirmed',
                'completed': 'status-completed',
                'cancelled': 'status-cancelled'
            };
            return classMap[status] || 'bg-secondary text-white';
        }

        async function fetchData(endpoint, target) {
            try {
                const response = await fetch(`/api/${endpoint}`);
                const result = await response.json();
                if (result.success) {
                    target.value = result.data;
                }
            } catch (error) {
                console.error(`获取${endpoint}失败:`, error);
            }
        }

        function loadAllData() {
            fetchData('freezer', freezers);
            fetchData('vaccine', vaccines);
            fetchData('appointment', appointments);
            fetchData('inventory', inventoryRecords);
            fetchData('damage', damageReports);
            fetchData('history', history);
        }

        function showTempModal(freezer) {
            selectedFreezer.value = freezer;
            newTemperature.value = freezer.current_temperature;
            tempError.value = '';
            tempModal.show();
        }

        async function updateTemperature() {
            if (newTemperature.value < selectedFreezer.value.min_temperature || 
                newTemperature.value > selectedFreezer.value.max_temperature) {
                tempError.value = `温度必须在 ${selectedFreezer.value.min_temperature}°C 到 ${selectedFreezer.value.max_temperature}°C 之间`;
                return;
            }

            try {
                const response = await fetch(`/api/freezer/${selectedFreezer.value.id}/temperature`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        current_temperature: newTemperature.value,
                        operator: currentUser.value
                    })
                });
                const result = await response.json();
                if (result.success) {
                    tempModal.hide();
                    loadAllData();
                } else {
                    tempError.value = result.error || '更新失败';
                }
            } catch (error) {
                tempError.value = '更新失败';
            }
        }

        function showReviewModal(inventory) {
            selectedInventory.value = inventory;
            reviewStatus.value = inventory.status === 'pending' ? 'matched' : inventory.status;
            reviewRemarks.value = inventory.remarks || '';
            reviewModal.show();
        }

        async function submitReview() {
            try {
                const response = await fetch(`/api/inventory/${selectedInventory.value.id}/review`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        status: reviewStatus.value,
                        reviewer: currentUser.value,
                        remarks: reviewRemarks.value
                    })
                });
                const result = await response.json();
                if (result.success) {
                    reviewModal.hide();
                    loadAllData();
                } else {
                    alert(result.error || '复核失败');
                }
            } catch (error) {
                alert('复核失败');
            }
        }

        function showApproveModal(damage) {
            selectedDamage.value = damage;
            approvalStatus.value = 'approved';
            approvalRemarks.value = '';
            approveModal.show();
        }

        async function submitApproval() {
            try {
                const response = await fetch(`/api/damage/${selectedDamage.value.id}/approve`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        status: approvalStatus.value,
                        approver: currentUser.value,
                        approval_remarks: approvalRemarks.value
                    })
                });
                const result = await response.json();
                if (result.success) {
                    approveModal.hide();
                    loadAllData();
                } else {
                    alert(result.error || '审批失败');
                }
            } catch (error) {
                alert('审批失败');
            }
        }

        async function updateAptStatus(id, status) {
            try {
                const response = await fetch(`/api/appointment/${id}/status`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status, operator: currentUser.value })
                });
                const result = await response.json();
                if (result.success) {
                    loadAllData();
                } else {
                    alert(result.error || '更新失败');
                }
            } catch (error) {
                alert('更新失败');
            }
        }

        function showVaccineModal() {
            alert('功能开发中');
        }

        function showInventoryModal() {
            alert('功能开发中');
        }

        function showDamageModal() {
            alert('功能开发中');
        }

        function exportData(type) {
            const params = new URLSearchParams();
            if (exportFilter.value.responsible_person) {
                params.append('responsible_person', exportFilter.value.responsible_person);
            }
            if (exportFilter.value.batch_number) {
                params.append('batch_number', exportFilter.value.batch_number);
            }
            if (exportFilter.value.start_date) {
                params.append('start_date', exportFilter.value.start_date);
            }
            if (exportFilter.value.end_date) {
                params.append('end_date', exportFilter.value.end_date);
            }
            
            window.open(`/api/export/${type}?${params.toString()}`, '_blank');
        }

        onMounted(() => {
            loadAllData();
        });

        return {
            currentUser,
            activeTab,
            freezers,
            vaccines,
            appointments,
            inventoryRecords,
            damageReports,
            history,
            stats,
            selectedFreezer,
            newTemperature,
            tempError,
            selectedInventory,
            reviewStatus,
            reviewRemarks,
            selectedDamage,
            approvalStatus,
            approvalRemarks,
            exportFilter,
            getStatusClass,
            showTempModal,
            updateTemperature,
            showReviewModal,
            submitReview,
            showApproveModal,
            submitApproval,
            updateAptStatus,
            showVaccineModal,
            showInventoryModal,
            showDamageModal,
            exportData
        };
    }
}).mount('#app');
