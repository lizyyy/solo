import {
  VersionRegressionRule,
  DuplicateCommandRule,
  ExpiredShadowRule,
  MissedAlertRule,
  RuleEngine
} from '../src/rules';
import { MqttMessage, DeviceShadow, Session, AlertRule } from '../src/types';

describe('VersionRegressionRule', () => {
  let rule: VersionRegressionRule;

  beforeEach(() => {
    rule = new VersionRegressionRule();
  });

  describe('check', () => {
    it('should detect version regression', () => {
      const message: MqttMessage = {
        id: 'msg-001',
        timestamp: Date.now(),
        topic: '$aws/things/test-device/shadow/update',
        payload: JSON.stringify({ version: 2, state: { reported: { status: 'online' } } }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      };

      const currentShadow: DeviceShadow = {
        deviceId: 'test-device',
        version: 3,
        state: {
          reported: { status: 'online' },
          desired: {}
        },
        metadata: {
          reported: { status: { timestamp: Date.now() - 1000 } },
          desired: {}
        },
        timestamp: Date.now() - 1000
      };

      const violation = rule.check(message, currentShadow);
      expect(violation).not.toBeNull();
      expect(violation?.type).toBe('version_regression');
      expect(violation?.severity).toBe('critical');
    });

    it('should not detect violation when version is higher', () => {
      const message: MqttMessage = {
        id: 'msg-001',
        timestamp: Date.now(),
        topic: '$aws/things/test-device/shadow/update',
        payload: JSON.stringify({ version: 4, state: { reported: { status: 'online' } } }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      };

      const currentShadow: DeviceShadow = {
        deviceId: 'test-device',
        version: 3,
        state: {
          reported: { status: 'online' },
          desired: {}
        },
        metadata: {
          reported: { status: { timestamp: Date.now() - 1000 } },
          desired: {}
        },
        timestamp: Date.now() - 1000
      };

      const violation = rule.check(message, currentShadow);
      expect(violation).toBeNull();
    });

    it('should accumulate violations', () => {
      const createMessage = (version: number): MqttMessage => ({
        id: `msg-${version}`,
        timestamp: Date.now(),
        topic: '$aws/things/test-device/shadow/update',
        payload: JSON.stringify({ version, state: { reported: { status: 'online' } } }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      });

      const currentShadow: DeviceShadow = {
        deviceId: 'test-device',
        version: 5,
        state: {
          reported: { status: 'online' },
          desired: {}
        },
        metadata: {
          reported: { status: { timestamp: Date.now() - 1000 } },
          desired: {}
        },
        timestamp: Date.now() - 1000
      };

      rule.check(createMessage(3), currentShadow);
      rule.check(createMessage(4), currentShadow);

      const violations = rule.getViolations();
      expect(violations.length).toBe(2);
    });
  });
});

describe('DuplicateCommandRule', () => {
  let rule: DuplicateCommandRule;

  beforeEach(() => {
    rule = new DuplicateCommandRule({ windowMs: 5000 });
  });

  describe('check', () => {
    it('should detect duplicate command', () => {
      const createMessage = (dup: boolean): MqttMessage => ({
        id: `msg-${Date.now()}`,
        timestamp: Date.now(),
        topic: 'gateway/test-device/command/setpoint',
        payload: JSON.stringify({ value: 25 }),
        qos: 1,
        retain: false,
        dup,
        direction: 'out',
        clientId: 'test-server'
      });

      rule.check(createMessage(false));
      const violation = rule.check(createMessage(true));

      expect(violation).not.toBeNull();
      expect(violation?.type).toBe('duplicate_command');
    });

    it('should ignore QoS 0 messages when configured', () => {
      const createMessage = (): MqttMessage => ({
        id: `msg-${Date.now()}`,
        timestamp: Date.now(),
        topic: 'gateway/test-device/telemetry',
        payload: JSON.stringify({ temperature: 25 }),
        qos: 0,
        retain: false,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      });

      rule.check(createMessage());
      const violation = rule.check(createMessage());

      expect(violation).toBeNull();
    });

    it('should not detect duplicate outside window', async () => {
      const createMessage = (): MqttMessage => ({
        id: `msg-${Date.now()}`,
        timestamp: Date.now(),
        topic: 'gateway/test-device/command/setpoint',
        payload: JSON.stringify({ value: 25 }),
        qos: 1,
        retain: false,
        dup: false,
        direction: 'out',
        clientId: 'test-server'
      });

      rule = new DuplicateCommandRule({ windowMs: 100 });

      rule.check(createMessage());
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const violation = rule.check(createMessage());
      expect(violation).toBeNull();
    });
  });
});

describe('ExpiredShadowRule', () => {
  let rule: ExpiredShadowRule;

  beforeEach(() => {
    rule = new ExpiredShadowRule({ maxAgeMs: 24 * 60 * 60 * 1000 });
  });

  describe('check', () => {
    it('should detect expired shadow', () => {
      const currentTimestamp = Date.now();
      const oldTimestamp = currentTimestamp - 48 * 60 * 60 * 1000;

      const violation = rule.check(
        'test-device',
        currentTimestamp,
        undefined,
        {
          deviceId: 'test-device',
          name: 'Test Device',
          type: 'sensor',
          shadowVersion: 1,
          desiredConfig: {},
          lastSeen: oldTimestamp,
          status: 'offline'
        }
      );

      expect(violation).not.toBeNull();
      expect(violation?.type).toBe('expired_shadow');
    });

    it('should not detect fresh shadow', () => {
      const currentTimestamp = Date.now();
      const freshTimestamp = currentTimestamp - 60 * 60 * 1000;

      const violation = rule.check(
        'test-device',
        currentTimestamp,
        undefined,
        {
          deviceId: 'test-device',
          name: 'Test Device',
          type: 'sensor',
          shadowVersion: 1,
          desiredConfig: {},
          lastSeen: freshTimestamp,
          status: 'online'
        }
      );

      expect(violation).toBeNull();
    });
  });

  describe('checkOnConnect', () => {
    it('should detect expired retained shadow on reconnect', () => {
      const currentTimestamp = Date.now();
      const oldTimestamp = currentTimestamp - 48 * 60 * 60 * 1000;

      const retainedShadow: DeviceShadow = {
        deviceId: 'test-device',
        version: 1,
        state: {
          reported: { status: 'online' },
          desired: {}
        },
        metadata: {
          reported: { status: { timestamp: oldTimestamp } },
          desired: {}
        },
        timestamp: oldTimestamp
      };

      const violation = rule.checkOnConnect(
        'test-device',
        currentTimestamp,
        retainedShadow
      );

      expect(violation).not.toBeNull();
      expect(violation?.severity).toBe('critical');
    });
  });
});

describe('MissedAlertRule', () => {
  let rule: MissedAlertRule;

  beforeEach(() => {
    rule = new MissedAlertRule();
  });

  describe('check', () => {
    it('should detect alert during offline period', () => {
      const offlineStart = Date.now() - 60000;
      rule.addOfflinePeriod('test-device', offlineStart, Date.now());

      const message: MqttMessage = {
        id: 'alert-001',
        timestamp: Date.now() - 30000,
        topic: 'alert/critical',
        payload: JSON.stringify({ severity: 'critical', message: 'Device fault' }),
        qos: 2,
        retain: false,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      };

      const session: Session = {
        clientId: 'test-device',
        connected: false,
        connectTime: Date.now() - 120000,
        disconnectTime: Date.now() - 60000,
        subscriptions: [],
        pendingMessages: []
      };

      const violation = rule.check(message, session);
      expect(violation).not.toBeNull();
      expect(violation?.type).toBe('missed_alert');
    });

    it('should flag critical alerts as critical severity', () => {
      const offlineStart = Date.now() - 60000;
      rule.addOfflinePeriod('test-device', offlineStart, Date.now());

      const message: MqttMessage = {
        id: 'alert-001',
        timestamp: Date.now() - 30000,
        topic: 'alert/device-001/fault',
        payload: JSON.stringify({ severity: 'critical', code: 'E1001', message: 'Emergency stop' }),
        qos: 2,
        retain: false,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      };

      const session: Session = {
        clientId: 'test-device',
        connected: false,
        connectTime: Date.now() - 120000,
        disconnectTime: Date.now() - 60000,
        subscriptions: [],
        pendingMessages: []
      };

      const violation = rule.check(message, session);
      expect(violation?.severity).toBe('critical');
    });
  });
});

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('getAllViolations', () => {
    it('should return all violations from all rules', () => {
      const versionMessage: MqttMessage = {
        id: 'version-msg',
        timestamp: Date.now(),
        topic: '$aws/things/test-device/shadow/update',
        payload: JSON.stringify({ version: 2, state: { reported: { status: 'online' } } }),
        qos: 1,
        retain: true,
        dup: false,
        direction: 'in',
        clientId: 'test-device'
      };

      const shadow: DeviceShadow = {
        deviceId: 'test-device',
        version: 3,
        state: {
          reported: { status: 'online' },
          desired: {}
        },
        metadata: {
          reported: { status: { timestamp: Date.now() - 1000 } },
          desired: {}
        },
        timestamp: Date.now() - 1000
      };

      ruleEngine.checkVersionRegression(versionMessage, shadow);

      const duplicateMessage: MqttMessage = {
        id: 'dup-msg-1',
        timestamp: Date.now(),
        topic: 'gateway/test-device/command/setpoint',
        payload: JSON.stringify({ value: 25 }),
        qos: 1,
        retain: false,
        dup: false,
        direction: 'out',
        clientId: 'test-server'
      };

      ruleEngine.checkDuplicateCommand(duplicateMessage);
      ruleEngine.checkDuplicateCommand({
        ...duplicateMessage,
        id: 'dup-msg-2',
        dup: true
      });

      const allViolations = ruleEngine.getAllViolations();
      expect(allViolations.length).toBeGreaterThan(0);
    });
  });

  describe('getSummary', () => {
    it('should provide summary statistics', () => {
      const summary = ruleEngine.getSummary();
      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('byType');
      expect(summary).toHaveProperty('bySeverity');
      expect(summary).toHaveProperty('criticalCount');
      expect(summary).toHaveProperty('devicesWithViolations');
    });
  });
});
