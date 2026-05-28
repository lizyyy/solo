import axios from 'axios';
import { 参保记录, 补缴单, 领取地信息, 年龄信息, 参保人信息, 试算方案 } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const pensionApi = {
  getSampleCases: () => api.get('/sample-cases'),
  
  calculate: (data: {
    参保人信息: 参保人信息;
    参保记录: 参保记录[];
    补缴单: 补缴单[];
    领取地信息: 领取地信息;
    年龄信息: 年龄信息;
  }) => api.post('/calculate', data),
  
  compare: (方案列表: 试算方案[]) => api.post('/compare', { 方案列表 }),
  
  validatePaymentMonths: (参保记录: 参保记录[], 补缴单: 补缴单[]) => 
    api.post('/validate/payment-months', { 参保记录, 补缴单 }),
  
  validateAge: (data: {
    出生日期: string;
    退休年月: string;
    性别: '男' | '女';
    工种: '普通' | '特殊工种';
  }) => api.post('/validate/age', data),
  
  determineLocation: (参保记录: 参保记录[], 户籍地: string) =>
    api.post('/determine-location', { 参保记录, 户籍地 }),
  
  exportPDF: (data: { 试算结果: any; 参保人信息: 参保人信息 }) =>
    api.post('/export-pdf', data, { responseType: 'blob' })
};
