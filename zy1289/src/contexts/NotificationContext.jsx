import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { getNotifications, saveNotifications, initializeMockData, getStoreList } from '../services/storage';

const NotificationContext = createContext();

const notificationReducer = (state, action) => {
  switch (action.type) {
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'UPDATE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.map(n =>
          n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
        ),
      };
    case 'SET_LOADING_IDS':
      return { ...state, loadingIds: action.payload };
    case 'ADD_LOADING_ID':
      return { ...state, loadingIds: [...state.loadingIds, action.payload] };
    case 'REMOVE_LOADING_ID':
      return { ...state, loadingIds: state.loadingIds.filter(id => id !== action.payload) };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload };
    case 'SET_STORES':
      return { ...state, stores: action.payload };
    default:
      return state;
  }
};

const initialState = {
  notifications: [],
  loadingIds: [],
  filters: {
    storeName: '',
    status: '',
  },
  stores: [],
};

export const NotificationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  const loadNotifications = useCallback(() => {
    const notifications = initializeMockData();
    dispatch({ type: 'SET_NOTIFICATIONS', payload: notifications });
    
    const stores = getStoreList();
    dispatch({ type: 'SET_STORES', payload: stores });
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const updateNotificationState = useCallback((id, updates) => {
    dispatch({ type: 'UPDATE_NOTIFICATION', payload: { id, updates } });
    
    const notifications = getNotifications();
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index] = { ...notifications[index], ...updates };
      saveNotifications(notifications);
    }
  }, []);

  const addLoadingId = useCallback((id) => {
    dispatch({ type: 'ADD_LOADING_ID', payload: id });
  }, []);

  const removeLoadingId = useCallback((id) => {
    dispatch({ type: 'REMOVE_LOADING_ID', payload: id });
  }, []);

  const setFilters = useCallback((filters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters });
  }, []);

  const refreshStores = useCallback(() => {
    const stores = getStoreList();
    dispatch({ type: 'SET_STORES', payload: stores });
  }, []);

  const value = {
    ...state,
    loadNotifications,
    updateNotificationState,
    addLoadingId,
    removeLoadingId,
    setFilters,
    refreshStores,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
