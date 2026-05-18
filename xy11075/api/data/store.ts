import { type DeductionRecord, type StatusHistory } from '../../shared/types';
import { mockRecords, mockStatusHistory } from '../mock/data';

export let records: DeductionRecord[] = [...mockRecords];
export let statusHistory: StatusHistory[] = [...mockStatusHistory];

export const setRecords = (newRecords: DeductionRecord[]) => {
  records = newRecords;
};

export const setStatusHistory = (newHistory: StatusHistory[]) => {
  statusHistory = newHistory;
};
