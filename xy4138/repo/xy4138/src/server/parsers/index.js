const JSONLParser = require('./jsonl-parser');
const CSVParser = require('./csv-parser');
const { YAMLParser, CheckpointType } = require('./yaml-parser');

class DataParser {
  constructor(options = {}) {
    this.options = options;
    this.jsonlParser = new JSONLParser(options);
    this.csvParser = new CSVParser(options);
    this.yamlParser = new YAMLParser(options);
  }

  async parseJSONL(filePath) {
    return this.jsonlParser.parseFile(filePath);
  }

  parseJSONLString(content) {
    return this.jsonlParser.parseString(content);
  }

  async parseCSV(filePath) {
    return this.csvParser.parseFile(filePath);
  }

  parseCSVString(content) {
    return this.csvParser.parseString(content);
  }

  async parseYAML(filePath) {
    return this.yamlParser.parseFile(filePath);
  }

  parseYAMLString(content) {
    return this.yamlParser.parseString(content);
  }

  async autoDetectAndParse(filePath) {
    const ext = filePath.toLowerCase().split('.').pop();
    
    switch (ext) {
      case 'jsonl':
      case 'json':
        return { type: 'jsonl', ...await this.parseJSONL(filePath) };
      case 'csv':
        return { type: 'csv', ...await this.parseCSV(filePath) };
      case 'yaml':
      case 'yml':
        return { type: 'yaml', ...await this.parseYAML(filePath) };
      default:
        throw new Error(`Unknown file type: ${ext}`);
    }
  }

  mergeTelemetryAndCommands(telemetryRecords, commandRecords) {
    const merged = [];
    let cmdIdx = 0;

    const sortedTelemetry = this.jsonlParser.sortByTimestamp(telemetryRecords);
    const sortedCommands = this.csvParser.sortByTimestamp(commandRecords);

    for (const telemetry of sortedTelemetry) {
      const entry = {
        timestamp: telemetry.timestamp,
        type: 'telemetry',
        telemetry,
        commands: []
      };

      while (cmdIdx < sortedCommands.length && 
             sortedCommands[cmdIdx].timestamp <= telemetry.timestamp) {
        entry.commands.push(sortedCommands[cmdIdx]);
        cmdIdx++;
      }

      merged.push(entry);
    }

    while (cmdIdx < sortedCommands.length) {
      merged.push({
        timestamp: sortedCommands[cmdIdx].timestamp,
        type: 'command',
        telemetry: null,
        commands: [sortedCommands[cmdIdx]]
      });
      cmdIdx++;
    }

    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }

  calculateLatency(commandRecords, telemetryRecords) {
    const latencyStats = {
      command_ack: [],
      sensor_update: [],
      total: [],
      summary: {
        avg_command_ack: 0,
        avg_sensor_update: 0,
        max_command_ack: 0,
        max_sensor_update: 0,
        min_command_ack: Infinity,
        min_sensor_update: Infinity,
        warnings: []
      }
    };

    const sortedTelemetry = this.jsonlParser.sortByTimestamp(telemetryRecords);
    
    for (const cmd of commandRecords) {
      if (cmd.status === 'ACKNOWLEDGED' || cmd.status === 'COMPLETED') {
        const nextTelemetry = sortedTelemetry.find(t => t.timestamp >= cmd.timestamp);
        
        if (nextTelemetry) {
          const ackLatency = nextTelemetry.timestamp - cmd.timestamp;
          latencyStats.command_ack.push({
            command_timestamp: cmd.timestamp,
            telemetry_timestamp: nextTelemetry.timestamp,
            latency: ackLatency,
            command: cmd
          });

          latencyStats.summary.avg_command_ack += ackLatency;
          latencyStats.summary.max_command_ack = Math.max(latencyStats.summary.max_command_ack, ackLatency);
          latencyStats.summary.min_command_ack = Math.min(latencyStats.summary.min_command_ack, ackLatency);

          if (ackLatency > 100) {
            latencyStats.summary.warnings.push({
              type: 'HIGH_LATENCY',
              message: `Command ${cmd.sequence} had high latency: ${ackLatency}ms`,
              timestamp: cmd.timestamp,
              latency: ackLatency
            });
          }
        }
      }
    }

    if (latencyStats.command_ack.length > 0) {
      latencyStats.summary.avg_command_ack /= latencyStats.command_ack.length;
    }

    for (let i = 1; i < sortedTelemetry.length; i++) {
      const updateLatency = sortedTelemetry[i].timestamp - sortedTelemetry[i - 1].timestamp;
      latencyStats.sensor_update.push({
        from: sortedTelemetry[i - 1].timestamp,
        to: sortedTelemetry[i].timestamp,
        latency: updateLatency
      });

      latencyStats.summary.avg_sensor_update += updateLatency;
      latencyStats.summary.max_sensor_update = Math.max(latencyStats.summary.max_sensor_update, updateLatency);
      latencyStats.summary.min_sensor_update = Math.min(latencyStats.summary.min_sensor_update, updateLatency);

      if (updateLatency > 50) {
        latencyStats.summary.warnings.push({
          type: 'SENSOR_GAP',
          message: `Large gap between telemetry frames: ${updateLatency}ms`,
          timestamp: sortedTelemetry[i].timestamp,
          latency: updateLatency
        });
      }
    }

    if (latencyStats.sensor_update.length > 0) {
      latencyStats.summary.avg_sensor_update /= latencyStats.sensor_update.length;
    }

    return latencyStats;
  }

  detectStateChanges(telemetryRecords) {
    const changes = [];
    const sorted = this.jsonlParser.sortByTimestamp(telemetryRecords);
    
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      
      if (prev.state !== curr.state) {
        changes.push({
          timestamp: curr.timestamp,
          from_state: prev.state,
          to_state: curr.state,
          sequence: curr.sequence,
          duration: curr.timestamp - prev.timestamp
        });
      }
    }

    return changes;
  }

  detectEmergencyStops(telemetryRecords) {
    return telemetryRecords
      .filter(t => t.emergency_stop === true)
      .map(t => ({
        timestamp: t.timestamp,
        sequence: t.sequence,
        state: t.state,
        position: t.position
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
}

module.exports = {
  DataParser,
  JSONLParser,
  CSVParser,
  YAMLParser,
  CheckpointType
};
