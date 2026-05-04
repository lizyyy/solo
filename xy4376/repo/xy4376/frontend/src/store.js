import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useStore = create(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      currentSession: null,
      identifiedIssues: [],
      reviewNotes: [],
      summary: null,
      
      geojsonData: null,
      fanWindowData: null,
      sensorData: null,
      
      currentTime: 0,
      isPlaying: false,
      playSpeed: 1,
      
      selectedIssue: null,
      selectedNote: null,
      
      setSessions: (sessions) => set({ sessions }),
      setCurrentSessionId: (id) => set({ currentSessionId: id }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setIdentifiedIssues: (issues) => set({ identifiedIssues: issues }),
      setReviewNotes: (notes) => set({ reviewNotes: notes }),
      setSummary: (summary) => set({ summary: summary }),
      
      setGeojsonData: (data) => set({ geojsonData: data }),
      setFanWindowData: (data) => set({ fanWindowData: data }),
      setSensorData: (data) => set({ sensorData: data }),
      
      setCurrentTime: (time) => set({ currentTime: time }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setPlaySpeed: (speed) => set({ playSpeed: speed }),
      
      setSelectedIssue: (issue) => set({ selectedIssue: issue }),
      setSelectedNote: (note) => set({ selectedNote: note }),
      
      clearImportData: () => set({
        geojsonData: null,
        fanWindowData: null,
        sensorData: null
      }),
      
      loadSession: async (sessionId) => {
        const state = get();
        try {
          const [sessionRes, issuesRes, notesRes, summaryRes] = await Promise.all([
            fetch(`/api/training/${sessionId}`),
            fetch(`/api/review/${sessionId}/issues`),
            fetch(`/api/review/${sessionId}/notes`),
            fetch(`/api/review/${sessionId}/summary`)
          ]);
          
          const session = await sessionRes.json();
          const issues = await issuesRes.json();
          const notes = await notesRes.json();
          const summary = await summaryRes.json();
          
          set({
            currentSessionId: sessionId,
            currentSession: session,
            identifiedIssues: issues,
            reviewNotes: notes,
            summary: summary,
            geojsonData: session.venue_geojson,
            fanWindowData: session.fan_window_data,
            sensorData: session.sensor_data,
            currentTime: 0,
            isPlaying: false
          });
        } catch (error) {
          console.error('加载训练场次失败:', error);
        }
      },
      
      refreshSession: async () => {
        const state = get();
        if (!state.currentSessionId) return;
        await state.loadSession(state.currentSessionId);
      },
      
      addReviewNote: async (sessionId, noteData) => {
        try {
          const response = await fetch(`/api/review/${sessionId}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(noteData)
          });
          
          const newNote = await response.json();
          
          const state = get();
          set({
            reviewNotes: [newNote, ...state.reviewNotes]
          });
          
          return newNote;
        } catch (error) {
          console.error('添加备注失败:', error);
          throw error;
        }
      },
      
      updateReviewNote: async (noteId, updateData) => {
        try {
          const response = await fetch(`/api/review/notes/${noteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          
          const updatedNote = await response.json();
          
          const state = get();
          set({
            reviewNotes: state.reviewNotes.map(n => 
              n.id === noteId ? updatedNote : n
            )
          });
          
          return updatedNote;
        } catch (error) {
          console.error('更新备注失败:', error);
          throw error;
        }
      },
      
      resolveIssue: async (sessionId, issueId, resolution, reviewedBy) => {
        try {
          const response = await fetch(`/api/review/${sessionId}/issues/${issueId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolution, reviewed_by: reviewedBy })
          });
          
          const note = await response.json();
          
          const state = get();
          set({
            reviewNotes: [note, ...state.reviewNotes]
          });
          
          return note;
        } catch (error) {
          console.error('标记问题解决失败:', error);
          throw error;
        }
      },
      
      createSession: async (sessionData) => {
        try {
          const response = await fetch('/api/import/create-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sessionData)
          });
          
          const result = await response.json();
          return result;
        } catch (error) {
          console.error('创建训练场次失败:', error);
          throw error;
        }
      },
      
      fetchSessions: async () => {
        try {
          const response = await fetch('/api/training');
          const sessions = await response.json();
          set({ sessions });
          return sessions;
        } catch (error) {
          console.error('获取训练场次列表失败:', error);
          throw error;
        }
      },
      
      deleteSession: async (sessionId) => {
        try {
          await fetch(`/api/training/${sessionId}`, {
            method: 'DELETE'
          });
          
          const state = get();
          set({
            sessions: state.sessions.filter(s => s.id !== sessionId),
            ...(state.currentSessionId === sessionId ? {
              currentSessionId: null,
              currentSession: null,
              identifiedIssues: [],
              reviewNotes: [],
              summary: null,
              geojsonData: null,
              fanWindowData: null,
              sensorData: null
            } : {})
          });
        } catch (error) {
          console.error('删除训练场次失败:', error);
          throw error;
        }
      }
    }),
    {
      name: 'fire-training-storage',
      partialize: (state) => ({
        currentSessionId: state.currentSessionId
      })
    }
  )
);
