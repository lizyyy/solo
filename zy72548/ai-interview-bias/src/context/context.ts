import { createContext } from 'react';
import type { AppState } from '../types';
import type { Action } from '../types/context';

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | null>(null);
