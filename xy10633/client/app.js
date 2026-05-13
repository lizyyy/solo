new Vue({
    el: '#app',
    data: {
        currentUser: '管理员',
        activeMenu: 'dashboard',
        stats: {
            pendingExceptions: 0,
            monthTotal: 0,
            unpaidTotal: 0,
            activeTenants: 0
        },
        exceptionBills: [],
        unpaidSummary: [],
        bills: [],
        tenants: [],
        contracts: [],
        meterReadings: [],
        devices: [],
        auditLogs: [],
        reportSummary: [],
        operators: [],
        billFilters: {
            status: '',
            has_exception: '',
            bill_month: ''
        },
        reportFilters: {
            start_month: '',
            end_month: '',
            handled_by: '',
            status: ''
        },
        auditFilters: {
            table_name: '',
            start_date: '',
            end_date: ''
        },
        activeImportTab: 'meter',
        importResults: [],
        importSuccessCount: 0,
        importErrorCount: 0,
        
        showGenerateBill: false,
        generateBillTitle: '生成账单',
        generateBillForm: {
            contract_id: '',
            bill_month: ''
        },
        
        showHandleException: false,
        currentExceptionBill: {},
        handleExceptionForm: {
            handled_by: '',
            remarks: ''
        },
        
        showPayDialog: false,
        currentPayBill: {},
        payForm: {
            paid_amount: 0
        },
        
        showAdjustDialog: false,
        currentAdjustBill: {},
        adjustForm: {
            adjust_type: 'increase',
            adjust_amount: 0,
            adjust_reason: '',
            adjusted_by: '',
            remarks: ''
        },
        
        showAdjustmentsDialog: false,
        currentBillAdjustments: [],
        
        showTenantDialog: false,
        tenantDialogTitle: '新增租户',
        editingTenantId: null,
        tenantForm: {
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: ''
        },
        
        showContractDialog: false,
        contractDialogTitle: '新增合同',
        editingContractId: null,
        contractForm: {
            tenant_id: '',
            contract_no: '',
            room_no: '',
            start_date: '',
            end_date: '',
            monthly_rent: 0,
            area: 0,
            share_ratio: 1
        },
        
        showMeterDialog: false,
        meterForm: {
            contract_id: '',
            reading_date: '',
            water_prev: 0,
            water_curr: 0,
            water_usage: 0,
            electric_prev: 0,
            electric_curr: 0,
            electric_usage: 0,
            reader: ''
        },
        
        showDeviceDialog: false,
        deviceDialogTitle: '新增设备',
        editingDeviceId: null,
        deviceForm: {
            contract_id: '',
            device_name: '',
            device_type: '空调',
            power: 0,
            hours_per_day: 0,
            days_per_month: 0
        }
    },
    mounted() {
        this.loadDashboardData();
        this.loadTenants();
        this.loadContracts();
        this.loadMeterReadings();
        this.loadDevices();
        this.loadOperators();
    },
    methods: {
        handleMenuSelect(index) {
            this.activeMenu = index;
            if (index === 'dashboard') {
                this.loadDashboardData();
            } else if (index === 'bills') {
                this.loadBills();
            } else if (index === 'reports') {
                this.loadReportSummary();
            } else if (index === 'audit') {
                this.loadAuditLogs();
            }
        },
        
        async loadDashboardData() {
            await this.loadExceptionBills();
            await this.loadUnpaidSummary();
            this.stats.pendingExceptions = this.exceptionBills.length;
            this.stats.activeTenants = this.tenants.length;
        },
        
        async loadExceptionBills() {
            try {
                const res = await fetch('/api/bills/exceptions');
                this.exceptionBills = await res.json();
                this.stats.pendingExceptions = this.exceptionBills.length;
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadUnpaidSummary() {
            try {
                const res = await fetch('/api/reports/unpaid-summary');
                this.unpaidSummary = await res.json();
                this.stats.unpaidTotal = this.unpaidSummary.reduce((sum, item) => sum + item.total_unpaid, 0);
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadBills() {
            try {
                let url = '/api/bills?';
                const params = [];
                if (this.billFilters.status) params.push(`status=${this.billFilters.status}`);
                if (this.billFilters.has_exception) params.push(`has_exception=${this.billFilters.has_exception}`);
                if (this.billFilters.bill_month) params.push(`bill_month=${this.billFilters.bill_month}`);
                url += params.join('&');
                
                const res = await fetch(url);
                this.bills = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadTenants() {
            try {
                const res = await fetch('/api/tenants');
                this.tenants = await res.json();
                this.stats.activeTenants = this.tenants.filter(t => t.status === 'active').length;
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadContracts() {
            try {
                const res = await fetch('/api/contracts');
                this.contracts = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadMeterReadings() {
            try {
                const res = await fetch('/api/meter-readings');
                this.meterReadings = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadDevices() {
            try {
                const res = await fetch('/api/devices');
                this.devices = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadAuditLogs() {
            try {
                let url = '/api/audit?';
                const params = [];
                if (this.auditFilters.table_name) params.push(`table_name=${this.auditFilters.table_name}`);
                if (this.auditFilters.start_date) params.push(`start_date=${this.auditFilters.start_date}`);
                if (this.auditFilters.end_date) params.push(`end_date=${this.auditFilters.end_date}`);
                url += params.join('&');
                
                const res = await fetch(url);
                this.auditLogs = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadReportSummary() {
            try {
                let url = '/api/reports/summary?';
                const params = [];
                if (this.reportFilters.start_month) params.push(`start_month=${this.reportFilters.start_month}`);
                if (this.reportFilters.end_month) params.push(`end_month=${this.reportFilters.end_month}`);
                url += params.join('&');
                
                const res = await fetch(url);
                this.reportSummary = await res.json();
                this.stats.monthTotal = this.reportSummary.length > 0 ? this.reportSummary[0].total_amount : 0;
            } catch (e) {
                console.error(e);
            }
        },
        
        async loadOperators() {
            try {
                const res = await fetch('/api/reports/operators');
                this.operators = await res.json();
            } catch (e) {
                console.error(e);
            }
        },
        
        refreshExceptions() {
            this.loadExceptionBills();
        },
        
        getExceptionTypeText(type) {
            const types = {
                'early_termination': '提前退租',
                'abnormal_water': '水量异常',
                'abnormal_electric': '电量异常'
            };
            return types[type] || type;
        },
        
        showGenerateBillDialog() {
            this.generateBillForm = {
                contract_id: '',
                bill_month: ''
            };
            this.showGenerateBill = true;
        },
        
        async calculateBill() {
            try {
                const res = await fetch('/api/bills/calculate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.generateBillForm)
                });
                const data = await res.json();
                this.$message.success(`计算完成：水费${data.water_amount}元，电费${data.electric_amount}元，设备费${data.device_amount}元`);
            } catch (e) {
                this.$message.error('计算失败');
            }
        },
        
        async generateBill() {
            try {
                const res = await fetch('/api/bills/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...this.generateBillForm, operator: this.currentUser })
                });
                const data = await res.json();
                this.$message.success('账单生成成功');
                this.showGenerateBill = false;
                this.loadBills();
            } catch (e) {
                this.$message.error('账单生成失败');
            }
        },
        
        handleException(row) {
            this.currentExceptionBill = row;
            this.handleExceptionForm = {
                handled_by: this.currentUser,
                remarks: ''
            };
            this.showHandleException = true;
        },
        
        async submitHandleException() {
            try {
                const res = await fetch(`/api/bills/${this.currentExceptionBill.id}/handle`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.handleExceptionForm)
                });
                await res.json();
                this.$message.success('异常处理完成');
                this.showHandleException = false;
                this.loadExceptionBills();
                this.loadBills();
            } catch (e) {
                this.$message.error('处理失败');
            }
        },
        
        viewBillDetail(row) {
            this.$message.info('查看账单详情功能');
        },
        
        payDialog(row) {
            this.currentPayBill = row;
            this.payForm.paid_amount = row.unpaid_amount;
            this.showPayDialog = true;
        },
        
        async submitPayment() {
            try {
                const res = await fetch(`/api/bills/${this.currentPayBill.id}/pay`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paid_amount: this.payForm.paid_amount, operator: this.currentUser })
                });
                await res.json();
                this.$message.success('收款成功');
                this.showPayDialog = false;
                this.loadBills();
                this.loadUnpaidSummary();
            } catch (e) {
                this.$message.error('收款失败');
            }
        },
        
        adjustDialog(row) {
            this.currentAdjustBill = row;
            this.adjustForm = {
                adjust_type: 'increase',
                adjust_amount: 0,
                adjust_reason: '',
                adjusted_by: this.currentUser,
                remarks: ''
            };
            this.showAdjustDialog = true;
        },
        
        async submitAdjustment() {
            try {
                const amount = this.adjustForm.adjust_type === 'decrease' ? -this.adjustForm.adjust_amount : this.adjustForm.adjust_amount;
                const res = await fetch('/api/adjustments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bill_id: this.currentAdjustBill.id,
                        adjust_type: this.adjustForm.adjust_type,
                        adjust_amount: amount,
                        adjust_reason: this.adjustForm.adjust_reason,
                        adjusted_by: this.adjustForm.adjusted_by,
                        remarks: this.adjustForm.remarks
                    })
                });
                await res.json();
                this.$message.success('调整成功');
                this.showAdjustDialog = false;
                this.loadBills();
            } catch (e) {
                this.$message.error('调整失败');
            }
        },
        
        async viewAdjustments(row) {
            try {
                const res = await fetch(`/api/adjustments/bill/${row.id}`);
                this.currentBillAdjustments = await res.json();
                this.showAdjustmentsDialog = true;
            } catch (e) {
                console.error(e);
            }
        },
        
        showTenantDialog() {
            this.editingTenantId = null;
            this.tenantDialogTitle = '新增租户';
            this.tenantForm = {
                name: '',
                contact_person: '',
                phone: '',
                email: '',
                address: ''
            };
            this.showTenantDialog = true;
        },
        
        editTenant(row) {
            this.editingTenantId = row.id;
            this.tenantDialogTitle = '编辑租户';
            this.tenantForm = {
                name: row.name,
                contact_person: row.contact_person,
                phone: row.phone,
                email: row.email,
                address: row.address
            };
            this.showTenantDialog = true;
        },
        
        async saveTenant() {
            try {
                let url, method;
                if (this.editingTenantId) {
                    url = `/api/tenants/${this.editingTenantId}`;
                    method = 'PUT';
                } else {
                    url = '/api/tenants';
                    method = 'POST';
                }
                
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...this.tenantForm, status: 'active' })
                });
                await res.json();
                this.$message.success('保存成功');
                this.showTenantDialog = false;
                this.loadTenants();
            } catch (e) {
                this.$message.error('保存失败');
            }
        },
        
        showContractDialog() {
            this.editingContractId = null;
            this.contractDialogTitle = '新增合同';
            this.contractForm = {
                tenant_id: '',
                contract_no: '',
                room_no: '',
                start_date: '',
                end_date: '',
                monthly_rent: 0,
                area: 0,
                share_ratio: 1
            };
            this.showContractDialog = true;
        },
        
        editContract(row) {
            this.editingContractId = row.id;
            this.contractDialogTitle = '编辑合同';
            this.contractForm = {
                tenant_id: row.tenant_id,
                contract_no: row.contract_no,
                room_no: row.room_no,
                start_date: row.start_date,
                end_date: row.end_date,
                monthly_rent: row.monthly_rent,
                area: row.area,
                share_ratio: row.share_ratio
            };
            this.showContractDialog = true;
        },
        
        async saveContract() {
            try {
                let url, method;
                if (this.editingContractId) {
                    url = `/api/contracts/${this.editingContractId}`;
                    method = 'PUT';
                } else {
                    url = '/api/contracts';
                    method = 'POST';
                }
                
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...this.contractForm, status: 'active' })
                });
                await res.json();
                this.$message.success('保存成功');
                this.showContractDialog = false;
                this.loadContracts();
            } catch (e) {
                this.$message.error('保存失败');
            }
        },
        
        showMeterDialog() {
            this.meterForm = {
                contract_id: '',
                reading_date: '',
                water_prev: 0,
                water_curr: 0,
                water_usage: 0,
                electric_prev: 0,
                electric_curr: 0,
                electric_usage: 0,
                reader: this.currentUser
            };
            this.showMeterDialog = true;
        },
        
        async saveMeterReading() {
            try {
                this.meterForm.water_usage = this.meterForm.water_curr - this.meterForm.water_prev;
                this.meterForm.electric_usage = this.meterForm.electric_curr - this.meterForm.electric_prev;
                
                const res = await fetch('/api/meter-readings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(this.meterForm)
                });
                await res.json();
                this.$message.success('保存成功');
                this.showMeterDialog = false;
                this.loadMeterReadings();
            } catch (e) {
                this.$message.error('保存失败');
            }
        },
        
        showDeviceDialog() {
            this.editingDeviceId = null;
            this.deviceDialogTitle = '新增设备';
            this.deviceForm = {
                contract_id: '',
                device_name: '',
                device_type: '空调',
                power: 0,
                hours_per_day: 0,
                days_per_month: 0
            };
            this.showDeviceDialog = true;
        },
        
        editDevice(row) {
            this.editingDeviceId = row.id;
            this.deviceDialogTitle = '编辑设备';
            this.deviceForm = {
                contract_id: row.contract_id,
                device_name: row.device_name,
                device_type: row.device_type,
                power: row.power,
                hours_per_day: row.hours_per_day,
                days_per_month: row.days_per_month
            };
            this.showDeviceDialog = true;
        },
        
        async saveDevice() {
            try {
                let url, method;
                if (this.editingDeviceId) {
                    url = `/api/devices/${this.editingDeviceId}`;
                    method = 'PUT';
                } else {
                    url = '/api/devices';
                    method = 'POST';
                }
                
                const res = await fetch(url, {
                    method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...this.deviceForm, status: 'active' })
                });
                await res.json();
                this.$message.success('保存成功');
                this.showDeviceDialog = false;
                this.loadDevices();
            } catch (e) {
                this.$message.error('保存失败');
            }
        },
        
        triggerUpload(type) {
            if (type === 'meter') {
                this.$refs.meterFileInput.click();
            } else {
                this.$refs.tenantFileInput.click();
            }
        },
        
        async handleFileUpload(type, event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const url = type === 'meter' ? '/api/import/meter-readings' : '/api/import/tenants';
                const res = await fetch(url, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                this.importResults = data.results || [];
                this.importSuccessCount = data.success || 0;
                this.importErrorCount = data.errors || 0;
                
                if (type === 'meter') {
                    this.loadMeterReadings();
                } else {
                    this.loadTenants();
                }
                
                this.$message.success(`导入完成：成功${data.success}条，失败${data.errors}条`);
            } catch (e) {
                this.$message.error('导入失败');
            }
            
            event.target.value = '';
        },
        
        async exportBills() {
            this.exportReport();
        },
        
        async exportReport() {
            try {
                let url = '/api/reports/export?';
                const params = [];
                if (this.reportFilters.start_month) params.push(`start_month=${this.reportFilters.start_month}`);
                if (this.reportFilters.end_month) params.push(`end_month=${this.reportFilters.end_month}`);
                if (this.reportFilters.handled_by) params.push(`handled_by=${this.reportFilters.handled_by}`);
                if (this.reportFilters.status) params.push(`status=${this.reportFilters.status}`);
                url += params.join('&');
                
                const res = await fetch(url);
                const blob = await res.blob();
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = `bills_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
                link.click();
                this.$message.success('导出成功');
            } catch (e) {
                this.$message.error('导出失败');
            }
        },
        
        formatMoney(row, col, value) {
            return value ? '¥' + value.toFixed(2) : '¥0.00';
        }
    }
});
