/**
 * CueDesk 数据模型和本地存储
 * 负责数据的定义、存储和操作
 */

// 数据常量
const STORAGE_KEYS = {
    PROJECTS: 'cuedesk_projects',
    CURRENT_PROJECT_ID: 'cuedesk_current_project_id'
};

// 流程状态枚举
const CUE_STATUSES = {
    PENDING: 'pending',
    REHEARSED: 'rehearsed',
    CHANGED: 'changed',
    COMPLETED: 'completed'
};

const CUE_STATUS_LABELS = {
    [CUE_STATUSES.PENDING]: '待确认',
    [CUE_STATUSES.REHEARSED]: '已彩排',
    [CUE_STATUSES.CHANGED]: '现场变更',
    [CUE_STATUSES.COMPLETED]: '已完成'
};

// 风险级别枚举
const RISK_LEVELS = {
    HIGH: 'high',
    MEDIUM: 'medium',
    LOW: 'low'
};

const RISK_LEVEL_LABELS = {
    [RISK_LEVELS.HIGH]: '高风险',
    [RISK_LEVELS.MEDIUM]: '中风险',
    [RISK_LEVELS.LOW]: '低风险'
};

/**
 * 生成唯一ID
 * @returns {string} 唯一标识符
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * 项目数据模型
 * @typedef {Object} Project
 * @property {string} id - 项目唯一ID
 * @property {string} name - 项目名称
 * @property {string} description - 项目描述
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 更新时间戳
 * @property {Array<Cue>} cues - 流程列表
 */

/**
 * 流程段落数据模型
 * @typedef {Object} Cue
 * @property {string} id - 流程唯一ID
 * @property {string} name - 流程名称
 * @property {number} order - 显示顺序（从1开始）
 * @property {string} status - 状态（pending/rehearsed/changed/completed）
 * @property {string} responsible - 负责人
 * @property {number} duration - 预估时长（分钟）
 * @property {string} startTime - 开始时间（HH:mm 格式）
 * @property {Array<string>} microphones - 使用的麦克风列表
 * @property {string} audioPath - 音频文件路径
 * @property {string} script - 口播卡内容
 * @property {string} notes - 现场备注
 * @property {number} createdAt - 创建时间戳
 * @property {number} updatedAt - 更新时间戳
 */

/**
 * 风险检查结果模型
 * @typedef {Object} Risk
 * @property {string} id - 风险唯一ID
 * @property {string} level - 风险级别（high/medium/low）
 * @property {string} title - 风险标题
 * @property {string} description - 风险详细描述
 * @property {Array<string>} relatedCueIds - 相关的流程ID列表
 */

/**
 * 数据存储类
 * 负责项目和流程的本地存储管理
 */
class DataStore {
    constructor() {
        this.init();
    }

    /**
     * 初始化数据存储
     */
    init() {
        if (!localStorage.getItem(STORAGE_KEYS.PROJECTS)) {
            localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify([]));
        }
    }

    /**
     * 获取所有项目
     * @returns {Array<Project>} 项目列表
     */
    getProjects() {
        const projectsJson = localStorage.getItem(STORAGE_KEYS.PROJECTS);
        return projectsJson ? JSON.parse(projectsJson) : [];
    }

    /**
     * 保存所有项目
     * @param {Array<Project>} projects - 项目列表
     */
    saveProjects(projects) {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    }

    /**
     * 根据ID获取项目
     * @param {string} projectId - 项目ID
     * @returns {Project|null} 项目对象，如果不存在则返回null
     */
    getProjectById(projectId) {
        const projects = this.getProjects();
        return projects.find(p => p.id === projectId) || null;
    }

    /**
     * 创建新项目
     * @param {Object} projectData - 项目数据
     * @returns {Project} 创建的项目
     */
    createProject(projectData) {
        const now = Date.now();
        const project = {
            id: generateId(),
            name: projectData.name || '未命名项目',
            description: projectData.description || '',
            createdAt: now,
            updatedAt: now,
            cues: []
        };

        const projects = this.getProjects();
        projects.push(project);
        this.saveProjects(projects);

        this.setCurrentProjectId(project.id);
        return project;
    }

    /**
     * 更新项目信息
     * @param {string} projectId - 项目ID
     * @param {Object} updates - 更新的数据
     * @returns {Project|null} 更新后的项目，如果不存在则返回null
     */
    updateProject(projectId, updates) {
        const projects = this.getProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
            return null;
        }

        projects[projectIndex] = {
            ...projects[projectIndex],
            ...updates,
            updatedAt: Date.now()
        };

        this.saveProjects(projects);
        return projects[projectIndex];
    }

    /**
     * 删除项目
     * @param {string} projectId - 项目ID
     * @returns {boolean} 是否删除成功
     */
    deleteProject(projectId) {
        const projects = this.getProjects();
        const projectIndex = projects.findIndex(p => p.id === projectId);
        
        if (projectIndex === -1) {
            return false;
        }

        projects.splice(projectIndex, 1);
        this.saveProjects(projects);

        const currentProjectId = this.getCurrentProjectId();
        if (currentProjectId === projectId) {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        }

        return true;
    }

    /**
     * 获取当前选中的项目ID
     * @returns {string|null} 当前项目ID
     */
    getCurrentProjectId() {
        return localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
    }

    /**
     * 设置当前选中的项目ID
     * @param {string} projectId - 项目ID
     */
    setCurrentProjectId(projectId) {
        if (projectId) {
            localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, projectId);
        } else {
            localStorage.removeItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        }
    }

    /**
     * 获取当前项目
     * @returns {Project|null} 当前项目，如果没有选中则返回null
     */
    getCurrentProject() {
        const projectId = this.getCurrentProjectId();
        return projectId ? this.getProjectById(projectId) : null;
    }

    /**
     * 向项目中添加流程
     * @param {string} projectId - 项目ID
     * @param {Object} cueData - 流程数据
     * @returns {Cue|null} 添加的流程，如果项目不存在则返回null
     */
    addCue(projectId, cueData) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        const now = Date.now();
        const order = project.cues.length + 1;
        
        const cue = {
            id: generateId(),
            name: cueData.name || '未命名流程',
            order: order,
            status: cueData.status || CUE_STATUSES.PENDING,
            responsible: cueData.responsible || '',
            duration: cueData.duration || 0,
            startTime: cueData.startTime || '',
            microphones: cueData.microphones || [],
            audioPath: cueData.audioPath || '',
            script: cueData.script || '',
            notes: cueData.notes || '',
            createdAt: now,
            updatedAt: now
        };

        project.cues.push(cue);
        this.updateProject(projectId, { cues: project.cues });
        return cue;
    }

    /**
     * 更新流程
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 流程ID
     * @param {Object} updates - 更新的数据
     * @returns {Cue|null} 更新后的流程，如果不存在则返回null
     */
    updateCue(projectId, cueId, updates) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        const cueIndex = project.cues.findIndex(c => c.id === cueId);
        if (cueIndex === -1) {
            return null;
        }

        project.cues[cueIndex] = {
            ...project.cues[cueIndex],
            ...updates,
            updatedAt: Date.now()
        };

        this.updateProject(projectId, { cues: project.cues });
        return project.cues[cueIndex];
    }

    /**
     * 删除流程
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 流程ID
     * @returns {boolean} 是否删除成功
     */
    deleteCue(projectId, cueId) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return false;
        }

        const cueIndex = project.cues.findIndex(c => c.id === cueId);
        if (cueIndex === -1) {
            return false;
        }

        project.cues.splice(cueIndex, 1);
        
        project.cues.forEach((cue, index) => {
            cue.order = index + 1;
        });

        this.updateProject(projectId, { cues: project.cues });
        return true;
    }

    /**
     * 根据ID获取流程
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 流程ID
     * @returns {Cue|null} 流程对象，如果不存在则返回null
     */
    getCueById(projectId, cueId) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return null;
        }

        return project.cues.find(c => c.id === cueId) || null;
    }

    /**
     * 获取项目中的所有流程（按顺序排序）
     * @param {string} projectId - 项目ID
     * @returns {Array<Cue>} 流程列表
     */
    getCues(projectId) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return [];
        }

        return [...project.cues].sort((a, b) => a.order - b.order);
    }

    /**
     * 移动流程到新的位置
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 要移动的流程ID
     * @param {number} newOrder - 新的顺序位置（从1开始）
     * @returns {boolean} 是否移动成功
     */
    moveCue(projectId, cueId, newOrder) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return false;
        }

        const cueIndex = project.cues.findIndex(c => c.id === cueId);
        if (cueIndex === -1) {
            return false;
        }

        if (newOrder < 1 || newOrder > project.cues.length) {
            return false;
        }

        const currentOrder = project.cues[cueIndex].order;
        if (currentOrder === newOrder) {
            return true;
        }

        const cues = [...project.cues];
        
        if (newOrder < currentOrder) {
            for (let i = 0; i < cues.length; i++) {
                if (cues[i].order >= newOrder && cues[i].order < currentOrder) {
                    cues[i].order++;
                }
            }
        } else {
            for (let i = 0; i < cues.length; i++) {
                if (cues[i].order > currentOrder && cues[i].order <= newOrder) {
                    cues[i].order--;
                }
            }
        }

        cues[cueIndex].order = newOrder;
        this.updateProject(projectId, { cues });
        return true;
    }

    /**
     * 上移流程
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 流程ID
     * @returns {boolean} 是否移动成功
     */
    moveCueUp(projectId, cueId) {
        const cue = this.getCueById(projectId, cueId);
        if (!cue || cue.order <= 1) {
            return false;
        }
        return this.moveCue(projectId, cueId, cue.order - 1);
    }

    /**
     * 下移流程
     * @param {string} projectId - 项目ID
     * @param {string} cueId - 流程ID
     * @returns {boolean} 是否移动成功
     */
    moveCueDown(projectId, cueId) {
        const project = this.getProjectById(projectId);
        const cue = this.getCueById(projectId, cueId);
        if (!cue || !project) {
            return false;
        }
        return this.moveCue(projectId, cueId, cue.order + 1);
    }

    /**
     * 批量添加多个流程（用于导入）
     * @param {string} projectId - 项目ID
     * @param {Array<Object>} cuesData - 流程数据列表
     * @param {boolean} replaceExisting - 是否替换现有流程
     * @returns {Array<Cue>} 添加的流程列表
     */
    addCuesBatch(projectId, cuesData, replaceExisting = false) {
        const project = this.getProjectById(projectId);
        if (!project) {
            return [];
        }

        const now = Date.now();
        const newCues = [];

        if (replaceExisting) {
            project.cues = [];
        }

        const baseOrder = project.cues.length;

        cuesData.forEach((cueData, index) => {
            const cue = {
                id: generateId(),
                name: cueData.name || '未命名流程',
                order: baseOrder + index + 1,
                status: cueData.status || CUE_STATUSES.PENDING,
                responsible: cueData.responsible || '',
                duration: cueData.duration || 0,
                startTime: cueData.startTime || '',
                microphones: cueData.microphones || [],
                audioPath: cueData.audioPath || '',
                script: cueData.script || '',
                notes: cueData.notes || '',
                createdAt: now,
                updatedAt: now
            };
            newCues.push(cue);
            project.cues.push(cue);
        });

        this.updateProject(projectId, { cues: project.cues });
        return newCues;
    }
}

// 全局数据存储实例
const dataStore = new DataStore();

// 导出数据模型和存储类（供其他脚本使用）
window.DataStore = DataStore;
window.dataStore = dataStore;
window.generateId = generateId;
window.STORAGE_KEYS = STORAGE_KEYS;
window.CUE_STATUSES = CUE_STATUSES;
window.CUE_STATUS_LABELS = CUE_STATUS_LABELS;
window.RISK_LEVELS = RISK_LEVELS;
window.RISK_LEVEL_LABELS = RISK_LEVEL_LABELS;
