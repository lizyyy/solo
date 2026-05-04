import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// 创建 axios 实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 默认用户 ID（简化版本，实际应用中应该从认证系统获取）
const DEFAULT_USER_ID = 1;

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// 题库相关 API
export const questionsApi = {
  // 获取题目列表
  getQuestions: (params = {}) => {
    return api.get('/questions', { params });
  },
  
  // 获取单个题目
  getQuestion: (id) => {
    return api.get(`/questions/${id}`);
  },
  
  // 获取知识点列表
  getKnowledgePoints: () => {
    return api.get('/questions/knowledge-points/list');
  },
  
  // 创建题目
  createQuestion: (data) => {
    return api.post('/questions', data);
  },
  
  // 更新题目
  updateQuestion: (id, data) => {
    return api.put(`/questions/${id}`, data);
  },
  
  // 删除题目
  deleteQuestion: (id) => {
    return api.delete(`/questions/${id}`);
  },
};

// 练习相关 API
export const practiceApi = {
  // 开始练习会话
  startSession: (params = {}) => {
    return api.post('/practice/start', {
      userId: DEFAULT_USER_ID,
      ...params,
    });
  },
  
  // 获取练习题目（隐藏答案）
  getPracticeQuestion: (id) => {
    return api.get(`/practice/question/${id}`);
  },
  
  // 提交答案
  submitAnswer: (data) => {
    return api.post('/practice/submit', {
      userId: DEFAULT_USER_ID,
      ...data,
    });
  },
  
  // 结束练习会话
  endSession: (sessionId) => {
    return api.post(`/practice/end/${sessionId}`);
  },
};

// 错题本相关 API
export const wrongNotesApi = {
  // 获取错题列表
  getWrongNotes: (params = {}) => {
    return api.get('/wrong-notes', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
    });
  },
  
  // 获取单个错题详情
  getWrongNote: (id) => {
    return api.get(`/wrong-notes/${id}`);
  },
  
  // 更新错题状态
  updateStatus: (id, status) => {
    return api.put(`/wrong-notes/${id}/status`, { status });
  },
  
  // 添加教师批注
  addAnnotation: (id, content, teacherId = 2) => {
    return api.post(`/wrong-notes/${id}/annotations`, {
      userId: teacherId,
      content,
    });
  },
  
  // 获取错因统计
  getErrorTagStats: () => {
    return api.get('/wrong-notes/statistics/error-tags', {
      params: { userId: DEFAULT_USER_ID },
    });
  },
};

// 进度相关 API
export const progressApi = {
  // 获取总体进度概览
  getOverview: () => {
    return api.get('/progress/overview', {
      params: { userId: DEFAULT_USER_ID },
    });
  },
  
  // 按知识点统计
  getByKnowledgePoint: () => {
    return api.get('/progress/by-knowledge-point', {
      params: { userId: DEFAULT_USER_ID },
    });
  },
  
  // 按题目类型统计
  getByQuestionType: () => {
    return api.get('/progress/by-question-type', {
      params: { userId: DEFAULT_USER_ID },
    });
  },
  
  // 获取练习历史
  getHistory: (params = {}) => {
    return api.get('/progress/history', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
    });
  },
  
  // 获取薄弱知识点
  getWeakPoints: () => {
    return api.get('/progress/weak-points', {
      params: { userId: DEFAULT_USER_ID },
    });
  },
};

// 报告相关 API
export const reportsApi = {
  // 获取报告数据
  getReportData: (params = {}) => {
    return api.get('/reports/data', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
    });
  },
  
  // 导出 Markdown 报告
  exportMarkdown: (params = {}) => {
    return api.get('/reports/export/markdown', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
      responseType: 'blob',
    });
  },
  
  // 导出 HTML 报告
  exportHTML: (params = {}) => {
    return api.get('/reports/export/html', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
      responseType: 'blob',
    });
  },
  
  // 导出 CSV 报告
  exportCSV: (params = {}) => {
    return api.get('/reports/export/csv', {
      params: {
        userId: DEFAULT_USER_ID,
        ...params,
      },
      responseType: 'blob',
    });
  },
};

// 健康检查
export const healthCheck = () => {
  return api.get('/health');
};

export default api;
