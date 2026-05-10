import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';

type AppStoreType = ReturnType<typeof useAppStore>;

const AppContext = createContext<AppStoreType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const store = useAppStore();
  return (
    <AppContext.Provider value={store}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
