import axios from 'axios';
import dayjs from 'dayjs';

const API_BASE = '/api';

export const getRooms = async () => {
  const response = await axios.get(`${API_BASE}/rooms`);
  return response.data.rooms;
};

export const getTimeline = async (room, date) => {
  const response = await axios.get(`${API_BASE}/timeline`, {
    params: { room, date: dayjs(date).format('YYYY-MM-DD') }
  });
  return response.data;
};

export const assessAllCourses = async (room, date) => {
  const response = await axios.post(`${API_BASE}/assess`, {
    room,
    date: dayjs(date).format('YYYY-MM-DD')
  });
  return response.data.assessments;
};

export const updateAssessmentOverride = async (assessmentId, canProceed, overrideReason, notes) => {
  const response = await axios.put(`${API_BASE}/assessment/${assessmentId}/override`, {
    can_proceed: canProceed,
    override_reason: overrideReason,
    notes
  });
  return response.data.assessment;
};

export const importSensorData = async (file, room) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('room', room);
  const response = await axios.post(`${API_BASE}/import/sensor`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const importVentilationData = async (file, room) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('room', room);
  const response = await axios.post(`${API_BASE}/import/ventilation`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const importCourseData = async (file, room) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('room', room);
  const response = await axios.post(`${API_BASE}/import/course`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const importCleaningData = async (file, room) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('room', room);
  const response = await axios.post(`${API_BASE}/import/cleaning`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const clearRoomData = async (room) => {
  const response = await axios.delete(`${API_BASE}/clear/${room}`);
  return response.data;
};

export const getThresholds = async () => {
  const response = await axios.get(`${API_BASE}/thresholds`);
  return response.data.thresholds;
};

export const exportJSON = async (room, date) => {
  window.open(`${API_BASE}/export/json?room=${encodeURIComponent(room)}&date=${dayjs(date).format('YYYY-MM-DD')}`, '_blank');
};

export const exportMarkdown = async (room, date) => {
  window.open(`${API_BASE}/export/markdown?room=${encodeURIComponent(room)}&date=${dayjs(date).format('YYYY-MM-DD')}`, '_blank');
};