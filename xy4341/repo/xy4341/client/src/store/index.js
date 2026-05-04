import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  floorsApi,
  exitsApi,
  personsApi,
  drillsApi,
  exportsApi,
} from '../services/api';

const useStore = create(
  persist(
    (set, get) => ({
      floors: [],
      exits: [],
      persons: [],
      currentDrill: null,
      drillSessions: [],
      simulationState: null,
      riskAssessment: null,
      events: [],
      firePoints: [],
      broadcasts: [],
      selectedFloor: null,
      isAddingFirePoint: false,
      isSimulating: false,
      isPaused: false,
      autoStepInterval: null,
      lastUpdateTime: null,

      loadFloors: async () => {
        try {
          const result = await floorsApi.getAll();
          set({ floors: result.data || [] });
        } catch (error) {
          console.error('Failed to load floors:', error);
        }
      },

      addFloor: async (floorData) => {
        try {
          const result = await floorsApi.create(floorData);
          set((state) => ({
            floors: [...state.floors, result.data],
          }));
          return result.data;
        } catch (error) {
          console.error('Failed to add floor:', error);
          throw error;
        }
      },

      deleteFloor: async (floorId) => {
        try {
          await floorsApi.delete(floorId);
          set((state) => ({
            floors: state.floors.filter((f) => f.id !== floorId),
            selectedFloor: state.selectedFloor?.id === floorId ? null : state.selectedFloor,
          }));
        } catch (error) {
          console.error('Failed to delete floor:', error);
          throw error;
        }
      },

      loadExits: async () => {
        try {
          const result = await exitsApi.getAll();
          set({ exits: result.data || [] });
        } catch (error) {
          console.error('Failed to load exits:', error);
        }
      },

      addExit: async (exitData) => {
        try {
          const result = await exitsApi.create(exitData);
          set((state) => ({
            exits: [...state.exits, result.data],
          }));
          return result.data;
        } catch (error) {
          console.error('Failed to add exit:', error);
          throw error;
        }
      },

      loadPersons: async () => {
        try {
          const result = await personsApi.getAll();
          set({ persons: result.data || [] });
        } catch (error) {
          console.error('Failed to load persons:', error);
        }
      },

      addPersons: async (personsData) => {
        try {
          const result = await personsApi.bulkCreate(personsData);
          await get().loadPersons();
          return result;
        } catch (error) {
          console.error('Failed to add persons:', error);
          throw error;
        }
      },

      importPersonsCsv: async (file) => {
        try {
          const result = await personsApi.importCsv(file);
          await get().loadPersons();
          return result;
        } catch (error) {
          console.error('Failed to import persons:', error);
          throw error;
        }
      },

      clearPersons: async () => {
        try {
          await personsApi.deleteAll();
          set({ persons: [] });
        } catch (error) {
          console.error('Failed to clear persons:', error);
          throw error;
        }
      },

      loadDrillSessions: async () => {
        try {
          const result = await drillsApi.getAll();
          set({ drillSessions: result.data || [] });
        } catch (error) {
          console.error('Failed to load drill sessions:', error);
        }
      },

      createDrill: async (name) => {
        try {
          const result = await drillsApi.create({ name });
          set((state) => ({
            drillSessions: [result.data, ...state.drillSessions],
            currentDrill: result.data,
          }));
          return result.data;
        } catch (error) {
          console.error('Failed to create drill:', error);
          throw error;
        }
      },

      loadCurrentDrill: async () => {
        try {
          const result = await drillsApi.getActive();
          if (result.data) {
            const detailResult = await drillsApi.getById(result.data.id);
            set({
              currentDrill: detailResult.data.session,
              firePoints: detailResult.data.firePoints || [],
              events: detailResult.data.events || [],
              broadcasts: detailResult.data.broadcasts || [],
            });
          }
        } catch (error) {
          console.error('Failed to load current drill:', error);
        }
      },

      startDrill: async (drillId) => {
        try {
          const result = await drillsApi.start(drillId);
          set({
            currentDrill: result.data.session,
            isSimulating: true,
            isPaused: false,
            riskAssessment: result.data.initialRisk,
          });
          return result.data;
        } catch (error) {
          console.error('Failed to start drill:', error);
          throw error;
        }
      },

      pauseDrill: async () => {
        const { currentDrill } = get();
        if (!currentDrill) return;
        
        try {
          const result = await drillsApi.pause(currentDrill.id);
          set({
            currentDrill: result.data,
            isPaused: true,
          });
          return result.data;
        } catch (error) {
          console.error('Failed to pause drill:', error);
          throw error;
        }
      },

      resumeDrill: async () => {
        const { currentDrill } = get();
        if (!currentDrill) return;
        
        try {
          const result = await drillsApi.resume(currentDrill.id);
          set({
            currentDrill: result.data,
            isPaused: false,
          });
          return result.data;
        } catch (error) {
          console.error('Failed to resume drill:', error);
          throw error;
        }
      },

      stepDrill: async () => {
        const { currentDrill } = get();
        if (!currentDrill) return;
        
        try {
          const result = await drillsApi.step(currentDrill.id);
          const { state: simState, riskAssessment } = result.data;
          
          set({
            simulationState: simState,
            riskAssessment,
            persons: simState.persons || [],
            firePoints: simState.firePoints || [],
            currentDrill: {
              ...currentDrill,
              current_time_step: simState.timeStep,
            },
          });
          
          return result.data;
        } catch (error) {
          console.error('Failed to step drill:', error);
          throw error;
        }
      },

      addFirePoint: async (floorId, x, y, intensity = 1.0, radius = 5.0) => {
        const { currentDrill } = get();
        if (!currentDrill) return;
        
        try {
          const result = await drillsApi.addFirePoint(currentDrill.id, {
            floor_id: floorId,
            x,
            y,
            intensity,
            radius,
          });
          
          set((state) => ({
            firePoints: [...state.firePoints, result.data],
            isAddingFirePoint: false,
          }));
          
          return result.data;
        } catch (error) {
          console.error('Failed to add fire point:', error);
          throw error;
        }
      },

      startAutoStep: (intervalMs = 1000) => {
        const { autoStepInterval } = get();
        if (autoStepInterval) {
          clearInterval(autoStepInterval);
        }
        
        const interval = setInterval(async () => {
          const { isPaused, currentDrill } = get();
          if (!isPaused && currentDrill) {
            try {
              await get().stepDrill();
            } catch (error) {
              console.error('Auto step failed:', error);
            }
          }
        }, intervalMs);
        
        set({ autoStepInterval: interval });
      },

      stopAutoStep: () => {
        const { autoStepInterval } = get();
        if (autoStepInterval) {
          clearInterval(autoStepInterval);
          set({ autoStepInterval: null });
        }
      },

      completeDrill: async () => {
        const { currentDrill, autoStepInterval } = get();
        if (!currentDrill) return;
        
        if (autoStepInterval) {
          clearInterval(autoStepInterval);
        }
        
        try {
          const result = await drillsApi.complete(currentDrill.id);
          set({
            currentDrill: result.data,
            isSimulating: false,
            isPaused: false,
            autoStepInterval: null,
          });
          return result.data;
        } catch (error) {
          console.error('Failed to complete drill:', error);
          throw error;
        }
      },

      setAddingFirePoint: (isAdding) => {
        set({ isAddingFirePoint: isAdding });
      },

      setSelectedFloor: (floor) => {
        set({ selectedFloor: floor });
      },

      createFloor: async (floorData) => {
        return await get().addFloor(floorData);
      },

      createExit: async (exitData) => {
        return await get().addExit(exitData);
      },

      loadSampleData: async () => {
        try {
          const sampleFloors = [
            { floor_number: 1, name: '教学楼1层', width: 80, height: 60, description: '一楼大厅' },
            { floor_number: 2, name: '教学楼2层', width: 80, height: 60, description: '二楼教室' },
            { floor_number: 3, name: '教学楼3层', width: 80, height: 60, description: '三楼教室' },
          ];
          
          const createdFloors = [];
          for (const floorData of sampleFloors) {
            const floor = await floorsApi.create(floorData);
            createdFloors.push(floor.data);
          }
          
          if (createdFloors.length > 0) {
            const sampleExits = [
              { floor_id: createdFloors[0].id, name: '东门出口', type: 'main', status: 'available', x: 75, y: 30, width: 3, capacity_per_minute: 15 },
              { floor_id: createdFloors[0].id, name: '西门出口', type: 'main', status: 'available', x: 5, y: 30, width: 3, capacity_per_minute: 15 },
              { floor_id: createdFloors[0].id, name: '楼梯间A', type: 'stairwell', status: 'available', x: 40, y: 5, width: 4, capacity_per_minute: 20 },
              { floor_id: createdFloors[1].id, name: '楼梯间A', type: 'stairwell', status: 'available', x: 40, y: 5, width: 4, capacity_per_minute: 20 },
              { floor_id: createdFloors[1].id, name: '走廊出口', type: 'normal', status: 'available', x: 75, y: 30, width: 2, capacity_per_minute: 10 },
              { floor_id: createdFloors[2].id, name: '楼梯间A', type: 'stairwell', status: 'available', x: 40, y: 5, width: 4, capacity_per_minute: 20 },
              { floor_id: createdFloors[2].id, name: '紧急出口', type: 'emergency', status: 'available', x: 75, y: 55, width: 2, capacity_per_minute: 8 },
            ];
            
            for (const exitData of sampleExits) {
              await exitsApi.create(exitData);
            }
            
            const personData = [];
            const names = ['张', '李', '王', '刘', '陈', '杨', '赵', '黄', '周', '吴'];
            
            for (const floor of createdFloors) {
              const personCount = floor.floor_number === 1 ? 40 : floor.floor_number === 2 ? 50 : 45;
              for (let i = 0; i < personCount; i++) {
                const namePrefix = names[Math.floor(Math.random() * names.length)];
                const x = 10 + Math.random() * 60;
                const y = 10 + Math.random() * 40;
                personData.push({
                  floor_id: floor.id,
                  name: `${namePrefix}${i + 1}`,
                  x,
                  y,
                  status: 'idle',
                  mobility: Math.random() > 0.2 ? 'normal' : 'slow',
                });
              }
            }
            
            await personsApi.bulkCreate(personData);
            set({ selectedFloor: createdFloors[0].id });
          }
          
          await get().loadFloors();
          await get().loadExits();
          await get().loadPersons();
          
          return true;
        } catch (error) {
          console.error('Failed to load sample data:', error);
          throw error;
        }
      },

      clearAllData: async () => {
        try {
          await personsApi.deleteAll();
          
          const exitResult = await exitsApi.getAll();
          for (const exit of exitResult.data || []) {
            await exitsApi.delete(exit.id);
          }
          
          const floorResult = await floorsApi.getAll();
          for (const floor of floorResult.data || []) {
            await floorsApi.delete(floor.id);
          }
          
          get().resetState();
          
          await get().loadFloors();
          await get().loadExits();
          await get().loadPersons();
          
          return true;
        } catch (error) {
          console.error('Failed to clear data:', error);
          throw error;
        }
      },

      exportReport: async (sessionId) => {
        try {
          const blob = await exportsApi.getReport(sessionId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `drill_report_${sessionId}.md`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to export report:', error);
          throw error;
        }
      },

      exportAudit: async (sessionId) => {
        try {
          const blob = await exportsApi.getAudit(sessionId);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `drill_audit_${sessionId}.json`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error('Failed to export audit:', error);
          throw error;
        }
      },

      previewReport: async (sessionId) => {
        try {
          const result = await exportsApi.previewReport(sessionId);
          return result.data;
        } catch (error) {
          console.error('Failed to preview report:', error);
          throw error;
        }
      },

      resetState: () => {
        const { autoStepInterval } = get();
        if (autoStepInterval) {
          clearInterval(autoStepInterval);
        }
        set({
          currentDrill: null,
          simulationState: null,
          riskAssessment: null,
          events: [],
          firePoints: [],
          broadcasts: [],
          isAddingFirePoint: false,
          isSimulating: false,
          isPaused: false,
          autoStepInterval: null,
        });
      },
    }),
    {
      name: 'fire-drill-storage',
      partialize: (state) => ({
        currentDrill: state.currentDrill,
        selectedFloor: state.selectedFloor,
        lastUpdateTime: state.lastUpdateTime,
      }),
    }
  )
);

export default useStore;
