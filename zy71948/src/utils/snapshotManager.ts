import { PayloadPlan, FaultRecord, OrbitElement, StateSnapshot } from '../types';
import { generateId, calculateSHA256 } from './hash';

export interface SnapshotData {
  payloadPlans: PayloadPlan[];
  faultRecords: FaultRecord[];
  orbitElements: OrbitElement[];
}

export async function createSnapshot(
  payloadPlans: PayloadPlan[],
  faultRecords: FaultRecord[],
  orbitElements: OrbitElement[],
  operator: string,
  description: string
): Promise<StateSnapshot> {
  const payloadData = JSON.stringify(payloadPlans);
  const faultData = JSON.stringify(faultRecords);
  const orbitData = JSON.stringify(orbitElements);
  
  const combinedData = payloadData + faultData + orbitData + Date.now();
  const hash = await calculateSHA256(combinedData);
  
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    hash,
    payloadData,
    faultData,
    orbitData,
    operator,
    description
  };
}

export function loadSnapshot(snapshot: StateSnapshot): SnapshotData {
  return {
    payloadPlans: JSON.parse(snapshot.payloadData),
    faultRecords: JSON.parse(snapshot.faultData),
    orbitElements: JSON.parse(snapshot.orbitData)
  };
}

export async function verifySnapshot(snapshot: StateSnapshot): Promise<boolean> {
  const combinedData = snapshot.payloadData + snapshot.faultData + snapshot.orbitData + new Date(snapshot.timestamp).getTime();
  const calculatedHash = await calculateSHA256(combinedData);
  return calculatedHash === snapshot.hash;
}

export function getSnapshotLabel(snapshot: StateSnapshot): string {
  const date = new Date(snapshot.timestamp);
  const dateStr = date.toISOString().replace('T', ' ').substring(0, 19);
  return `[${dateStr}] ${snapshot.operator} - ${snapshot.description}`;
}
