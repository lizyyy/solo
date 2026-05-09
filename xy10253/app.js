class App {
    constructor() {
        this.state = {
            members: [],
            sections: [],
            attendance: {},
            lastAllocation: null,
            rehearsalDate: new Date().toISOString().split('T')[0]
        };
        
        this.init();
    }
    
    init() {
        this.loadData();
        this.initUI();
    }
    
    loadData() {
        const savedData = Storage.getData();
        
        if (savedData) {
            this.state.members = savedData.members.map(m => Member.fromJSON(m));
            this.state.sections = savedData.sections.map(s => Section.fromJSON(s));
            this.state.attendance = savedData.attendance || {};
            this.state.lastAllocation = savedData.lastAllocation ? 
                AllocationResult.fromJSON(savedData.lastAllocation) : null;
            this.state.rehearsalDate = savedData.rehearsalDate || this.state.rehearsalDate;
        } else {
            this.initDefaultData();
        }
    }
    
    initDefaultData() {
        this.state.members = DEFAULT_DATA.members.map(m => Member.fromJSON(m));
        this.state.sections = DEFAULT_DATA.sections.map(s => Section.fromJSON(s));
        this.state.attendance = {};
        this.state.rehearsalDate = DEFAULT_DATA.rehearsalDate;
        this.saveData();
    }
    
    initUI() {
        TabManager.init();
        
        MemberUI.init(this);
        SectionUI.init(this);
        AttendanceUI.init(this);
        AllocationUI.init(this);
        VerificationUI.init(this);
        
        this.renderAll();
    }
    
    renderAll() {
        MemberUI.render();
        SectionUI.render();
        AttendanceUI.render();
        
        if (this.state.lastAllocation) {
            AllocationUI.render(this.state.lastAllocation);
        }
    }
    
    onTabChange(tabName) {
        switch (tabName) {
            case 'members':
                MemberUI.render();
                break;
            case 'sections':
                SectionUI.render();
                break;
            case 'attendance':
                AttendanceUI.render();
                break;
            case 'allocation':
                if (this.state.lastAllocation) {
                    AllocationUI.render(this.state.lastAllocation);
                }
                break;
        }
    }
    
    saveData() {
        const dataToSave = {
            members: this.state.members.map(m => m.toJSON()),
            sections: this.state.sections.map(s => s.toJSON()),
            attendance: this.state.attendance,
            lastAllocation: this.state.lastAllocation ? 
                this.state.lastAllocation.toJSON() : null,
            rehearsalDate: this.state.rehearsalDate
        };
        Storage.saveData(dataToSave);
    }
    
    addMember(member) {
        this.state.members.push(member);
        this.saveData();
    }
    
    updateMember(member) {
        const index = this.state.members.findIndex(m => m.id === member.id);
        if (index !== -1) {
            member.updatedAt = Date.now();
            this.state.members[index] = member;
            this.saveData();
        }
    }
    
    deleteMember(memberId) {
        this.state.members = this.state.members.filter(m => m.id !== memberId);
        delete this.state.attendance[memberId];
        
        if (this.state.lastAllocation) {
            this.state.lastAllocation.unallocated = 
                this.state.lastAllocation.unallocated.filter(u => u.memberId !== memberId);
            
            for (const sectionId in this.state.lastAllocation.allocations) {
                this.state.lastAllocation.allocations[sectionId] = 
                    this.state.lastAllocation.allocations[sectionId].filter(
                        a => a.memberId !== memberId
                    );
            }
        }
        
        this.saveData();
    }
    
    addSection(section) {
        this.state.sections.push(section);
        this.saveData();
    }
    
    updateSection(section) {
        const index = this.state.sections.findIndex(s => s.id === section.id);
        if (index !== -1) {
            section.updatedAt = Date.now();
            this.state.sections[index] = section;
            this.saveData();
        }
    }
    
    deleteSection(sectionId) {
        this.state.sections = this.state.sections.filter(s => s.id !== sectionId);
        
        this.state.members.forEach(m => {
            if (m.preferredSection === sectionId) {
                m.preferredSection = null;
            }
        });
        
        this.saveData();
    }
    
    setAttendance(memberId, isPresent) {
        this.state.attendance[memberId] = isPresent;
        this.saveData();
    }
    
    setRehearsalDate(date) {
        this.state.rehearsalDate = date;
        this.saveData();
    }
    
    importSampleData() {
        this.state.members = DEFAULT_DATA.members.map(m => Member.fromJSON(m));
        this.state.sections = DEFAULT_DATA.sections.map(s => Section.fromJSON(s));
        this.state.attendance = {};
        this.state.lastAllocation = null;
        this.state.rehearsalDate = DEFAULT_DATA.rehearsalDate;
        this.saveData();
    }
    
    runAllocation(settings) {
        const result = AllocationService.allocate(
            this.state.members,
            this.state.sections,
            this.state.attendance,
            settings
        );
        this.state.lastAllocation = result;
        this.saveData();
        return result;
    }
    
    resetAllocation() {
        this.state.lastAllocation = null;
        this.saveData();
    }
    
    manualAllocate(memberId, sectionId) {
        if (!this.state.lastAllocation) {
            this.state.lastAllocation = new AllocationResult();
        }
        
        const result = AllocationService.manualAllocate(
            memberId,
            sectionId,
            this.state.lastAllocation,
            this.state.members,
            this.state.sections
        );
        this.state.lastAllocation = result;
        this.saveData();
        return result;
    }
    
    runVerification() {
        return VerificationService.runCompleteVerification(
            this.state.members,
            this.state.sections,
            this.state.attendance,
            this.state.lastAllocation
        );
    }
    
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
