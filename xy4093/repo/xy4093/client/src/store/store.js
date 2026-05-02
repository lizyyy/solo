import { create } from 'zustand';
import { 
  statusApi, roomsApi, guestsApi, shipsApi, suppliesApi, batchesApi 
} from '../services/api';

export const useAppStore = create((set, get) => ({
  status: null,
  rooms: [],
  guests: [],
  ships: [],
  supplies: [],
  sandbags: [],
  batches: [],
  generatedPlan: null,
  
  loading: {
    status: false,
    rooms: false,
    guests: false,
    ships: false,
    supplies: false,
    batches: false,
  },
  
  errors: {},
  
  fetchStatus: async () => {
    set({ loading: { ...get().loading, status: true } });
    try {
      const response = await statusApi.getStatus();
      set({ status: response.data.data, errors: { ...get().errors, status: null } });
    } catch (error) {
      set({ errors: { ...get().errors, status: error.message } });
    } finally {
      set({ loading: { ...get().loading, status: false } });
    }
  },
  
  fetchRooms: async () => {
    set({ loading: { ...get().loading, rooms: true } });
    try {
      const response = await roomsApi.getAll();
      set({ rooms: response.data.data, errors: { ...get().errors, rooms: null } });
    } catch (error) {
      set({ errors: { ...get().errors, rooms: error.message } });
    } finally {
      set({ loading: { ...get().loading, rooms: false } });
    }
  },
  
  fetchGuests: async (params = {}) => {
    set({ loading: { ...get().loading, guests: true } });
    try {
      const response = await guestsApi.getAll(params);
      set({ guests: response.data.data, errors: { ...get().errors, guests: null } });
    } catch (error) {
      set({ errors: { ...get().errors, guests: error.message } });
    } finally {
      set({ loading: { ...get().loading, guests: false } });
    }
  },
  
  fetchShips: async () => {
    set({ loading: { ...get().loading, ships: true } });
    try {
      const response = await shipsApi.getAll();
      set({ ships: response.data.data, errors: { ...get().errors, ships: null } });
    } catch (error) {
      set({ errors: { ...get().errors, ships: error.message } });
    } finally {
      set({ loading: { ...get().loading, ships: false } });
    }
  },
  
  fetchSupplies: async () => {
    set({ loading: { ...get().loading, supplies: true } });
    try {
      const [suppliesRes, sandbagsRes] = await Promise.all([
        suppliesApi.getAll(),
        suppliesApi.getSandbags(),
      ]);
      set({ 
        supplies: suppliesRes.data.data,
        sandbags: sandbagsRes.data.data,
        errors: { ...get().errors, supplies: null } 
      });
    } catch (error) {
      set({ errors: { ...get().errors, supplies: error.message } });
    } finally {
      set({ loading: { ...get().loading, supplies: false } });
    }
  },
  
  fetchBatches: async (params = {}) => {
    set({ loading: { ...get().loading, batches: true } });
    try {
      const response = await batchesApi.getAll(params);
      set({ batches: response.data.data, errors: { ...get().errors, batches: null } });
    } catch (error) {
      set({ errors: { ...get().errors, batches: error.message } });
    } finally {
      set({ loading: { ...get().loading, batches: false } });
    }
  },
  
  fetchAll: async () => {
    await Promise.all([
      get().fetchStatus(),
      get().fetchRooms(),
      get().fetchGuests(),
      get().fetchShips(),
      get().fetchSupplies(),
      get().fetchBatches(),
    ]);
  },
  
  setGeneratedPlan: (plan) => set({ generatedPlan: plan }),
  
  addRoom: async (room) => {
    const response = await roomsApi.create(room);
    set({ rooms: [...get().rooms, response.data.data] });
    return response.data;
  },
  
  updateRoom: async (id, data) => {
    const response = await roomsApi.update(id, data);
    set({ 
      rooms: get().rooms.map(r => r.id === id ? response.data.data : r) 
    });
    return response.data;
  },
  
  deleteRoom: async (id) => {
    await roomsApi.delete(id);
    set({ rooms: get().rooms.filter(r => r.id !== id) });
  },
  
  sealRoomWindow: async (id) => {
    const response = await roomsApi.sealWindow(id);
    set({ 
      rooms: get().rooms.map(r => r.id === id ? response.data.data : r) 
    });
    return response.data;
  },
  
  addGuest: async (guest) => {
    const response = await guestsApi.create(guest);
    set({ guests: [...get().guests, response.data.data] });
    return response.data;
  },
  
  updateGuest: async (id, data) => {
    const response = await guestsApi.update(id, data);
    set({ 
      guests: get().guests.map(g => g.id === id ? response.data.data : g) 
    });
    return response.data;
  },
  
  deleteGuest: async (id) => {
    await guestsApi.delete(id);
    set({ guests: get().guests.filter(g => g.id !== id) });
  },
  
  evacuateGuest: async (id) => {
    const response = await guestsApi.evacuate(id);
    const updatedGuests = get().guests.map(g => 
      g.id === id ? { ...g, is_evacuated: 1 } : g
    );
    set({ guests: updatedGuests });
    return response.data;
  },
  
  assignGuestToBatch: async (guestId, batchId) => {
    const response = await guestsApi.assignBatch(guestId, batchId);
    const updatedGuests = get().guests.map(g => 
      g.id === guestId ? { ...g, evacuation_batch_id: batchId } : g
    );
    set({ guests: updatedGuests });
    return response.data;
  },
  
  removeGuestFromBatch: async (guestId) => {
    await guestsApi.removeBatch(guestId);
    const updatedGuests = get().guests.map(g => 
      g.id === guestId ? { ...g, evacuation_batch_id: null } : g
    );
    set({ guests: updatedGuests });
  },
  
  addShip: async (ship) => {
    const response = await shipsApi.create(ship);
    set({ ships: [...get().ships, response.data.data] });
    return response.data;
  },
  
  updateShip: async (id, data) => {
    const response = await shipsApi.update(id, data);
    set({ 
      ships: get().ships.map(s => s.id === id ? response.data.data : s) 
    });
    return response.data;
  },
  
  deleteShip: async (id) => {
    await shipsApi.delete(id);
    set({ ships: get().ships.filter(s => s.id !== id) });
  },
  
  addSupply: async (supply) => {
    const response = await suppliesApi.create(supply);
    set({ supplies: [...get().supplies, response.data.data] });
    return response.data;
  },
  
  updateSupply: async (id, data) => {
    const response = await suppliesApi.update(id, data);
    set({ 
      supplies: get().supplies.map(s => s.id === id ? response.data.data : s) 
    });
    return response.data;
  },
  
  addBatch: async (batch) => {
    const response = await batchesApi.create(batch);
    set({ batches: [...get().batches, response.data.data] });
    return response.data;
  },
  
  updateBatch: async (id, data) => {
    const response = await batchesApi.update(id, data);
    set({ 
      batches: get().batches.map(b => b.id === id ? response.data.data : b) 
    });
    return response.data;
  },
  
  deleteBatch: async (id) => {
    await batchesApi.delete(id);
    set({ batches: get().batches.filter(b => b.id !== id) });
  },
  
  startBatch: async (id) => {
    const response = await batchesApi.start(id);
    set({ 
      batches: get().batches.map(b => b.id === id ? response.data.data : b) 
    });
    return response.data;
  },
  
  completeBatch: async (id) => {
    const response = await batchesApi.complete(id);
    const updatedBatch = response.data.data;
    set({ 
      batches: get().batches.map(b => b.id === id ? updatedBatch : b),
      guests: get().guests.map(g => 
        g.evacuation_batch_id === id ? { ...g, is_evacuated: 1 } : g
      )
    });
    return response.data;
  },
}));

export default useAppStore;
