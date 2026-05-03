import { v4 as uuidv4 } from 'uuid';
import { DeviceShadow, MqttMessage } from '../types';

export class DeviceShadowManager {
  private shadows: Map<string, DeviceShadow> = new Map();
  private versionHistory: Map<string, Array<{ version: number; timestamp: number }>> = new Map();

  createOrUpdateShadow(
    deviceId: string,
    state: {
      reported?: Record<string, unknown>;
      desired?: Record<string, unknown>;
    },
    timestamp: number
  ): DeviceShadow {
    let shadow = this.shadows.get(deviceId);

    if (!shadow) {
      shadow = {
        deviceId,
        version: 1,
        state: {
          reported: {},
          desired: {}
        },
        metadata: {
          reported: {},
          desired: {}
        },
        timestamp
      };

      this.shadows.set(deviceId, shadow);
      this.versionHistory.set(deviceId, [{ version: 1, timestamp }]);
    } else {
      shadow.version++;
      shadow.timestamp = timestamp;

      const history = this.versionHistory.get(deviceId) || [];
      history.push({ version: shadow.version, timestamp });
      this.versionHistory.set(deviceId, history);
    }

    if (state.reported) {
      shadow.state.reported = { ...shadow.state.reported, ...state.reported };
      for (const key of Object.keys(state.reported)) {
        shadow.metadata.reported[key] = { timestamp };
      }
    }

    if (state.desired) {
      shadow.state.desired = { ...shadow.state.desired, ...state.desired };
      for (const key of Object.keys(state.desired)) {
        shadow.metadata.desired[key] = { timestamp };
      }
    }

    return { ...shadow };
  }

  getShadow(deviceId: string): DeviceShadow | undefined {
    const shadow = this.shadows.get(deviceId);
    return shadow ? { ...shadow } : undefined;
  }

  getVersionHistory(deviceId: string): Array<{ version: number; timestamp: number }> {
    return [...(this.versionHistory.get(deviceId) || [])];
  }

  checkVersionRegression(
    deviceId: string,
    incomingVersion: number,
    timestamp: number
  ): {
    isRegression: boolean;
    currentVersion: number;
    history: Array<{ version: number; timestamp: number }>;
  } {
    const shadow = this.shadows.get(deviceId);
    const history = this.getVersionHistory(deviceId);

    if (!shadow) {
      return {
        isRegression: false,
        currentVersion: 0,
        history: []
      };
    }

    const laterVersions = history.filter(h => 
      h.version > incomingVersion && h.timestamp < timestamp
    );

    return {
      isRegression: laterVersions.length > 0,
      currentVersion: shadow.version,
      history
    };
  }

  parseShadowMessage(message: MqttMessage): {
    deviceId: string;
    operation: 'update' | 'get' | 'delete' | 'delta' | 'accepted' | 'rejected';
    state?: {
      reported?: Record<string, unknown>;
      desired?: Record<string, unknown>;
    };
    version?: number;
  } | null {
    try {
      const topicParts = message.topic.split('/');
      
      let deviceId: string | undefined;
      let operation: string | undefined;

      if (topicParts[0] === '$aws' && topicParts[1] === 'things') {
        deviceId = topicParts[2];
        operation = topicParts[3];
      } else if (topicParts[0] === 'shadow') {
        deviceId = topicParts[1];
        operation = topicParts[2];
      } else {
        deviceId = message.clientId;
        operation = 'update';
      }

      const validOperations = ['update', 'get', 'delete', 'delta', 'accepted', 'rejected'];
      if (!validOperations.includes(operation)) {
        operation = 'update';
      }

      let payload: Record<string, unknown> = {};
      if (message.payload) {
        try {
          payload = JSON.parse(message.payload);
        } catch {
          payload = { raw: message.payload };
        }
      }

      const state = payload.state as {
        reported?: Record<string, unknown>;
        desired?: Record<string, unknown>;
      } | undefined;

      const version = typeof payload.version === 'number' ? payload.version : undefined;

      return {
        deviceId,
        operation: operation as 'update' | 'get' | 'delete' | 'delta' | 'accepted' | 'rejected',
        state,
        version
      };
    } catch {
      return null;
    }
  }

  getAllShadows(): Map<string, DeviceShadow> {
    const result = new Map<string, DeviceShadow>();
    for (const [key, value] of this.shadows) {
      result.set(key, { ...value });
    }
    return result;
  }

  getDelta(deviceId: string): Record<string, unknown> {
    const shadow = this.shadows.get(deviceId);
    if (!shadow) {
      return {};
    }

    const delta: Record<string, unknown> = {};
    const desired = shadow.state.desired;
    const reported = shadow.state.reported;

    for (const key of Object.keys(desired)) {
      if (!(key in reported) || JSON.stringify(desired[key]) !== JSON.stringify(reported[key])) {
        delta[key] = desired[key];
      }
    }

    return delta;
  }

  isShadowExpired(
    deviceId: string,
    currentTimestamp: number,
    maxAge: number
  ): boolean {
    const shadow = this.shadows.get(deviceId);
    if (!shadow) {
      return true;
    }

    return currentTimestamp - shadow.timestamp > maxAge;
  }
}
