import { create } from 'zustand';
import type { RoyaltyRecord, TrackAlias, Track, EvidenceNode, RehearsalChange, RecordStatus } from '../types';
import { demoRecords, demoAliases } from '../data/demoData';

interface RoyaltyState {
  records: RoyaltyRecord[];
  aliases: TrackAlias[];
  currentOperator: string;
  
  initData: () => void;
  getRecordById: (id: string) => RoyaltyRecord | undefined;
  addRecord: (record: RoyaltyRecord) => void;
  updateTrackAlias: (recordId: string, trackId: string, alias: string, oldAlias?: string) => void;
  reviewRecord: (recordId: string, action: 'approve' | 'reject', note: string) => void;
  addAlias: (alias: TrackAlias) => void;
  updateAlias: (id: string, updates: Partial<TrackAlias>) => void;
  addEvidenceNode: (recordId: string, node: Omit<EvidenceNode, 'id' | 'timestamp'>) => void;
  addRehearsalChange: (recordId: string, change: Omit<RehearsalChange, 'id' | 'changedAt'>) => void;
  resetDemoData: () => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
};

export const useRoyaltyStore = create<RoyaltyState>((set, get) => ({
  records: [],
  aliases: [],
  currentOperator: '小段',

  initData: () => {
    const storedRecords = localStorage.getItem('royalty_records');
    const storedAliases = localStorage.getItem('track_aliases');
    
    if (storedRecords && storedAliases) {
      set({
        records: JSON.parse(storedRecords),
        aliases: JSON.parse(storedAliases)
      });
    } else {
      set({
        records: demoRecords,
        aliases: demoAliases
      });
      localStorage.setItem('royalty_records', JSON.stringify(demoRecords));
      localStorage.setItem('track_aliases', JSON.stringify(demoAliases));
    }
  },

  getRecordById: (id: string) => {
    return get().records.find(r => r.id === id);
  },

  addRecord: (record: RoyaltyRecord) => {
    set(state => {
      const newRecords = [...state.records, record];
      localStorage.setItem('royalty_records', JSON.stringify(newRecords));
      return { records: newRecords };
    });
  },

  updateTrackAlias: (recordId: string, trackId: string, alias: string, oldAlias?: string) => {
    set(state => {
      const newRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        
        const newTracks = record.tracks.map(track => {
          if (track.id !== trackId) return track;
          return { ...track, alias, oldAlias };
        });
        
        return { ...record, tracks: newTracks };
      });
      
      localStorage.setItem('royalty_records', JSON.stringify(newRecords));
      return { records: newRecords };
    });
  },

  reviewRecord: (recordId: string, action: 'approve' | 'reject', note: string) => {
    set(state => {
      const newRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        
        const newStatus: RecordStatus = action === 'approve' ? 'completed' : 'pending';
        const evidenceNode: EvidenceNode = {
          id: generateId(),
          type: 'review',
          title: action === 'approve' ? '复核通过' : '复核驳回',
          description: note,
          operator: '版权运营',
          timestamp: getTimestamp()
        };
        
        return {
          ...record,
          status: newStatus,
          reviewNote: note,
          reviewedBy: '版权运营',
          reviewedAt: getTimestamp(),
          evidenceChain: [...record.evidenceChain, evidenceNode]
        };
      });
      
      localStorage.setItem('royalty_records', JSON.stringify(newRecords));
      return { records: newRecords };
    });
  },

  addAlias: (alias: TrackAlias) => {
    set(state => {
      const newAliases = [...state.aliases, alias];
      localStorage.setItem('track_aliases', JSON.stringify(newAliases));
      return { aliases: newAliases };
    });
  },

  updateAlias: (id: string, updates: Partial<TrackAlias>) => {
    set(state => {
      const newAliases = state.aliases.map(alias => 
        alias.id === id ? { ...alias, ...updates, updatedAt: getTimestamp().substring(0, 10) } : alias
      );
      localStorage.setItem('track_aliases', JSON.stringify(newAliases));
      return { aliases: newAliases };
    });
  },

  addEvidenceNode: (recordId: string, node: Omit<EvidenceNode, 'id' | 'timestamp'>) => {
    set(state => {
      const newRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        
        const newNode: EvidenceNode = {
          ...node,
          id: generateId(),
          timestamp: getTimestamp()
        };
        
        return {
          ...record,
          evidenceChain: [...record.evidenceChain, newNode]
        };
      });
      
      localStorage.setItem('royalty_records', JSON.stringify(newRecords));
      return { records: newRecords };
    });
  },

  addRehearsalChange: (recordId: string, change: Omit<RehearsalChange, 'id' | 'changedAt'>) => {
    set(state => {
      const newRecords = state.records.map(record => {
        if (record.id !== recordId) return record;
        
        const newChange: RehearsalChange = {
          ...change,
          id: generateId(),
          changedAt: getTimestamp()
        };
        
        return {
          ...record,
          rehearsalChanges: [...record.rehearsalChanges, newChange]
        };
      });
      
      localStorage.setItem('royalty_records', JSON.stringify(newRecords));
      return { records: newRecords };
    });
  },

  resetDemoData: () => {
    localStorage.removeItem('royalty_records');
    localStorage.removeItem('track_aliases');
    set({
      records: demoRecords,
      aliases: demoAliases
    });
    localStorage.setItem('royalty_records', JSON.stringify(demoRecords));
    localStorage.setItem('track_aliases', JSON.stringify(demoAliases));
  }
}));
