import axios from 'axios';
import {
  GameState,
  ApiResponse,
  CreateGameRequest,
  PerformActionRequest,
  EventChoiceRequest,
  Action,
} from '../types';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const gameApi = {
  createGame: async (name: string): Promise<GameState> => {
    const response = await api.post<ApiResponse<GameState>>('/games', {
      name,
    } as CreateGameRequest);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '创建游戏失败');
    }
    
    return response.data.data!;
  },

  getGame: async (gameId: string): Promise<GameState> => {
    const response = await api.get<ApiResponse<GameState>>(`/games/${gameId}`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取游戏状态失败');
    }
    
    return response.data.data!;
  },

  performAction: async (
    gameId: string,
    actionId: string,
    locationId?: string
  ): Promise<GameState> => {
    const response = await api.post<ApiResponse<GameState>>(`/games/${gameId}/action`, {
      actionId,
      locationId,
    } as PerformActionRequest);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '执行行动失败');
    }
    
    return response.data.data!;
  },

  endTurn: async (gameId: string): Promise<GameState> => {
    const response = await api.post<ApiResponse<GameState>>(`/games/${gameId}/end-turn`);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '结束回合失败');
    }
    
    return response.data.data!;
  },

  handleEventChoice: async (
    gameId: string,
    eventId: string,
    choiceId: string
  ): Promise<GameState> => {
    const response = await api.post<ApiResponse<GameState>>(`/games/${gameId}/event-choice`, {
      eventId,
      choiceId,
    } as EventChoiceRequest);
    
    if (!response.data.success) {
      throw new Error(response.data.error || '处理事件失败');
    }
    
    return response.data.data!;
  },

  getAvailableActions: async (
    gameId: string,
    locationId?: string
  ): Promise<Action[]> => {
    const params = locationId ? { locationId } : {};
    const response = await api.get<ApiResponse<Action[]>>(
      `/games/${gameId}/available-actions`,
      { params }
    );
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取可用行动失败');
    }
    
    return response.data.data!;
  },

  exportGame: async (
    gameId: string,
    format: 'markdown' | 'html' | 'json'
  ): Promise<void> => {
    const response = await api.get(`/games/${gameId}/export/${format}`, {
      responseType: 'blob',
    });
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = '航海日志';
    
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/);
      if (match) {
        filename = match[1];
      }
    }
    
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default api;
