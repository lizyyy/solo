const API_BASE = '/api';

const API = {
    // 关卡相关
    levels: {
        // 获取所有关卡
        getAll: async () => {
            const response = await fetch(`${API_BASE}/levels`);
            if (!response.ok) throw new Error('获取关卡列表失败');
            return response.json();
        },
        
        // 获取单个关卡
        get: async (id) => {
            const response = await fetch(`${API_BASE}/levels/${id}`);
            if (!response.ok) throw new Error('获取关卡信息失败');
            return response.json();
        },
        
        // 创建关卡
        create: async (data) => {
            const response = await fetch(`${API_BASE}/levels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || '创建关卡失败');
            }
            return response.json();
        },
        
        // 删除关卡
        delete: async (id) => {
            const response = await fetch(`${API_BASE}/levels/${id}`, {
                method: 'DELETE'
            });
            if (!response.ok) throw new Error('删除关卡失败');
            return response.json();
        }
    },
    
    // 会话相关
    sessions: {
        // 创建新会话
        create: async (levelId, playerName) => {
            const response = await fetch(`${API_BASE}/sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    level_id: levelId,
                    player_name: playerName
                })
            });
            if (!response.ok) throw new Error('创建会话失败');
            return response.json();
        },
        
        // 获取会话
        get: async (id) => {
            const response = await fetch(`${API_BASE}/sessions/${id}`);
            if (!response.ok) throw new Error('获取会话失败');
            return response.json();
        },
        
        // 更新会话
        update: async (id, data) => {
            const response = await fetch(`${API_BASE}/sessions/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!response.ok) throw new Error('更新会话失败');
            return response.json();
        },
        
        // 结束会话
        finish: async (id, replayData) => {
            const response = await fetch(`${API_BASE}/sessions/${id}/finish`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    replay_data: replayData
                })
            });
            if (!response.ok) throw new Error('结束会话失败');
            return response.json();
        },
        
        // 获取所有历史会话
        getAll: async () => {
            const response = await fetch(`${API_BASE}/sessions`);
            if (!response.ok) throw new Error('获取历史记录失败');
            return response.json();
        }
    },
    
    // 导出相关
    exports: {
        // 导出Markdown复盘报告
        markdown: async (sessionId) => {
            const response = await fetch(`${API_BASE}/exports/markdown/${sessionId}`);
            if (!response.ok) throw new Error('导出Markdown失败');
            return response.json();
        },
        
        // 导出JSON审计包
        json: async (sessionId) => {
            const response = await fetch(`${API_BASE}/exports/json/${sessionId}`);
            if (!response.ok) throw new Error('导出JSON失败');
            return response.json();
        }
    }
};

// 下载文件辅助函数
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
