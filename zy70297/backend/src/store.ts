import { Merchant, Inspection, RectificationTask, StatusChange } from './types';

export interface DataStore {
  merchants: Merchant[];
  inspections: Inspection[];
  rectificationTasks: RectificationTask[];
  statusChanges: StatusChange[];
}

export const store: DataStore = {
  merchants: [],
  inspections: [],
  rectificationTasks: [],
  statusChanges: [],
};

export function resetStore() {
  store.merchants = [];
  store.inspections = [];
  store.rectificationTasks = [];
  store.statusChanges = [];
}
