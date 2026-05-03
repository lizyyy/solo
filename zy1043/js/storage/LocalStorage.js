/**
 * 本地存储管理器
 * 使用 localStorage 保存项目数据
 */

const LocalStorageManager = {
    saveCurrentProject(projectData) {
        try {
            const data = JSON.stringify(projectData);
            localStorage.setItem(Constants.STORAGE_KEYS.CURRENT_PROJECT, data);
            return true;
        } catch (e) {
            console.error('保存项目失败:', e);
            return false;
        }
    },
    
    loadCurrentProject() {
        try {
            const data = localStorage.getItem(Constants.STORAGE_KEYS.CURRENT_PROJECT);
            if (data) {
                return JSON.parse(data);
            }
            return null;
        } catch (e) {
            console.error('加载项目失败:', e);
            return null;
        }
    },
    
    clearCurrentProject() {
        localStorage.removeItem(Constants.STORAGE_KEYS.CURRENT_PROJECT);
    },
    
    saveProject(projectId, projectData) {
        try {
            const projects = this.getAllProjects();
            projects[projectId] = {
                ...projectData,
                savedAt: Date.now()
            };
            
            const data = JSON.stringify(projects);
            localStorage.setItem(Constants.STORAGE_KEYS.PROJECTS, data);
            
            return true;
        } catch (e) {
            console.error('保存项目失败:', e);
            return false;
        }
    },
    
    loadProject(projectId) {
        try {
            const projects = this.getAllProjects();
            return projects[projectId] || null;
        } catch (e) {
            console.error('加载项目失败:', e);
            return null;
        }
    },
    
    deleteProject(projectId) {
        try {
            const projects = this.getAllProjects();
            delete projects[projectId];
            
            const data = JSON.stringify(projects);
            localStorage.setItem(Constants.STORAGE_KEYS.PROJECTS, data);
            
            return true;
        } catch (e) {
            console.error('删除项目失败:', e);
            return false;
        }
    },
    
    getAllProjects() {
        try {
            const data = localStorage.getItem(Constants.STORAGE_KEYS.PROJECTS);
            if (data) {
                return JSON.parse(data);
            }
            return {};
        } catch (e) {
            console.error('加载项目列表失败:', e);
            return {};
        }
    },
    
    getProjectList() {
        const projects = this.getAllProjects();
        const list = Object.entries(projects).map(([id, project]) => ({
            id: id,
            name: project.warehouse?.name || project.name || '未命名项目',
            savedAt: project.savedAt,
            objectCount: project.objects?.length || 0
        }));
        
        list.sort((a, b) => b.savedAt - a.savedAt);
        return list;
    },
    
    saveSettings(settings) {
        try {
            const data = JSON.stringify(settings);
            localStorage.setItem(Constants.STORAGE_KEYS.SETTINGS, data);
            return true;
        } catch (e) {
            console.error('保存设置失败:', e);
            return false;
        }
    },
    
    loadSettings() {
        try {
            const data = localStorage.getItem(Constants.STORAGE_KEYS.SETTINGS);
            if (data) {
                return JSON.parse(data);
            }
            return {};
        } catch (e) {
            console.error('加载设置失败:', e);
            return {};
        }
    },
    
    getStorageInfo() {
        let usedBytes = 0;
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                const value = localStorage.getItem(key);
                usedBytes += (key.length + value.length) * 2;
            }
        }
        
        return {
            usedBytes: usedBytes,
            usedKB: Math.round(usedBytes / 1024),
            usedMB: Math.round(usedBytes / 1024 / 1024 * 100) / 100
        };
    }
};
