export interface Node {
  id: string;
  name: string;
  status: 'up' | 'down' | 'partitioned';
  role?: 'leader' | 'follower' | 'candidate';
  term?: number;
  dataStore: Record<string, any>;
  lastHeartbeat?: number;
  partitionGroup?: string;
}

export interface ClusterConfig {
  name: string;
  nodes: NodeConfig[];
  consistencyModel: 'raft' | 'paxos' | 'eventual' | 'strong';
  replicationFactor: number;
  timeout: number;
  heartbeatInterval: number;
}

export interface NodeConfig {
  id: string;
  name: string;
  weight: number;
}

export interface Event {
  id: string;
  timestamp: number;
  type: 'propose' | 'commit' | 'read' | 'write' | 'timeout' | 'heartbeat' | 'partition' | 'recover' | 'leaderFail' | 'leaseExpire' | 'conflict' | 'retry';
  nodeId: string;
  targetNodeId?: string;
  data?: any;
  result?: 'success' | 'failure' | 'timeout' | 'conflict';
  description: string;
}

export interface Policy {
  name: string;
  consistencyLevel: 'strong' | 'eventual' | 'linearizable' | 'sequential';
  readRepair: boolean;
  hintedHandoff: boolean;
  readQuorum: number;
  writeQuorum: number;
  retryPolicy: {
    maxRetries: number;
    baseDelay: number;
    backoffMultiplier: number;
  };
  lockLease: {
    duration: number;
    autoRenew: boolean;
  };
  failureDetection: {
    interval: number;
    timeout: number;
  };
}

export interface SimulationResult {
  id: string;
  seed: number;
  startTime: number;
  endTime: number;
  consistencyModel: string;
  events: Event[];
  nodes: Node[];
  metrics: {
    commitPath: string[];
    unavailableWindow: {
      startTime: number;
      endTime: number;
      duration: number;
      cause: string;
    }[];
    conflicts: {
      eventId: string;
      nodeId: string;
      reason: string;
      timestamp: number;
    }[];
    risks: {
      type: 'dataLoss' | 'splitBrain' | 'staleRead' | 'lockExpiration' | 'inconsistency';
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      timestamp: number;
    }[];
    latency: {
      average: number;
      p95: number;
      p99: number;
    };
    throughput: {
      readsPerSecond: number;
      writesPerSecond: number;
    };
  };
}

export interface SimulationState {
  nodes: Map<string, Node>;
  currentTerm: number;
  leaderId?: string;
  events: Event[];
  startTime: number;
  currentTime: number;
  locks: Map<string, Lock>;
  proposals: Proposal[];
}

export interface Lock {
  key: string;
  holderId: string;
  acquireTime: number;
  leaseExpireTime: number;
  isAutoRenew: boolean;
}

export interface Proposal {
  id: string;
  proposerId: string;
  key: string;
  value: any;
  term: number;
  status: 'pending' | 'accepted' | 'committed' | 'rejected';
  acceptors: string[];
  timestamp: number;
}
