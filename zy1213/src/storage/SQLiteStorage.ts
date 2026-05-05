import initSqlJs, { Database } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { SimulationResult, Node, Event } from '../types';

export class SQLiteStorage {
  private dbPath: string;
  private db: Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = path.resolve(dbPath);
  }

  async initialize(): Promise<void> {
    const SQL = await initSqlJs();
    
    // 确保目录存在
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 加载现有数据库或创建新的
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.createTables();
  }

  private createTables(): void {
    if (!this.db) throw new Error('数据库未初始化');

    // 创建模拟运行表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY,
        seed INTEGER NOT NULL,
        consistency_model TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建节点表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        simulation_id TEXT NOT NULL,
        node_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL,
        role TEXT,
        term INTEGER,
        data_store TEXT,
        last_heartbeat INTEGER,
        partition_group TEXT,
        FOREIGN KEY (simulation_id) REFERENCES simulation_runs(id)
      )
    `);

    // 创建事件表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        simulation_id TEXT NOT NULL,
        event_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        node_id TEXT NOT NULL,
        target_node_id TEXT,
        data TEXT,
        result TEXT,
        description TEXT NOT NULL,
        FOREIGN KEY (simulation_id) REFERENCES simulation_runs(id)
      )
    `);

    // 创建指标表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        simulation_id TEXT NOT NULL,
        commit_path TEXT NOT NULL,
        unavailable_window TEXT,
        conflicts TEXT,
        risks TEXT,
        latency TEXT,
        throughput TEXT,
        FOREIGN KEY (simulation_id) REFERENCES simulation_runs(id)
      )
    `);

    // 创建索引
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_simulation_runs_created_at ON simulation_runs(created_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_nodes_simulation_id ON nodes(simulation_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_simulation_id ON events(simulation_id)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_metrics_simulation_id ON metrics(simulation_id)`);

    this.saveDatabase();
  }

  saveSimulationResult(result: SimulationResult): void {
    if (!this.db) throw new Error('数据库未初始化');

    // 插入模拟运行记录
    this.db.run(
      `INSERT INTO simulation_runs (id, seed, consistency_model, start_time, end_time) VALUES (?, ?, ?, ?, ?)`,
      [result.id, result.seed, result.consistencyModel, result.startTime, result.endTime]
    );

    // 插入节点数据
    result.nodes.forEach(node => {
      this.db!.run(
        `INSERT INTO nodes (id, simulation_id, node_id, name, status, role, term, data_store, last_heartbeat, partition_group) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${result.id}-${node.id}`,
          result.id,
          node.id,
          node.name,
          node.status,
          node.role || null,
          node.term || null,
          JSON.stringify(node.dataStore),
          node.lastHeartbeat || null,
          node.partitionGroup || null
        ]
      );
    });

    // 插入事件数据
    result.events.forEach((event, index) => {
      this.db!.run(
        `INSERT INTO events (id, simulation_id, event_id, timestamp, type, node_id, target_node_id, data, result, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `${result.id}-event-${index}`,
          result.id,
          event.id,
          event.timestamp,
          event.type,
          event.nodeId,
          event.targetNodeId || null,
          event.data ? JSON.stringify(event.data) : null,
          event.result || null,
          event.description
        ]
      );
    });

    // 插入指标数据
    this.db.run(
      `INSERT INTO metrics (id, simulation_id, commit_path, unavailable_window, conflicts, risks, latency, throughput) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `${result.id}-metrics`,
        result.id,
        JSON.stringify(result.metrics.commitPath),
        JSON.stringify(result.metrics.unavailableWindow),
        JSON.stringify(result.metrics.conflicts),
        JSON.stringify(result.metrics.risks),
        JSON.stringify(result.metrics.latency),
        JSON.stringify(result.metrics.throughput)
      ]
    );

    this.saveDatabase();
  }

  getSimulationResult(id: string): SimulationResult | null {
    if (!this.db) throw new Error('数据库未初始化');

    // 获取模拟运行基本信息
    const runResult = this.db.exec(
      `SELECT * FROM simulation_runs WHERE id = ?`,
      [id]
    );

    if (runResult.length === 0 || runResult[0].values.length === 0) {
      return null;
    }

    const runRow = runResult[0].values[0];
    
    // 获取节点数据
    const nodesResult = this.db.exec(
      `SELECT * FROM nodes WHERE simulation_id = ?`,
      [id]
    );

    const nodes: Node[] = [];
    if (nodesResult.length > 0) {
      nodesResult[0].values.forEach((row: any[]) => {
        nodes.push({
          id: row[2] as string,
          name: row[3] as string,
          status: row[4] as 'up' | 'down' | 'partitioned',
          role: row[5] as 'leader' | 'follower' | 'candidate' | undefined,
          term: row[6] as number | undefined,
          dataStore: JSON.parse(row[7] as string),
          lastHeartbeat: row[8] as number | undefined,
          partitionGroup: row[9] as string | undefined
        });
      });
    }

    // 获取事件数据
    const eventsResult = this.db.exec(
      `SELECT * FROM events WHERE simulation_id = ? ORDER BY timestamp ASC`,
      [id]
    );

    const events: Event[] = [];
    if (eventsResult.length > 0) {
      eventsResult[0].values.forEach((row: any[]) => {
        events.push({
          id: row[2] as string,
          timestamp: row[3] as number,
          type: row[4] as Event['type'],
          nodeId: row[5] as string,
          targetNodeId: row[6] as string | undefined,
          data: row[7] ? JSON.parse(row[7] as string) : undefined,
          result: row[8] as Event['result'] | undefined,
          description: row[9] as string
        });
      });
    }

    // 获取指标数据
    const metricsResult = this.db.exec(
      `SELECT * FROM metrics WHERE simulation_id = ?`,
      [id]
    );

    let metrics: SimulationResult['metrics'] = {
      commitPath: [],
      unavailableWindow: [],
      conflicts: [],
      risks: [],
      latency: { average: 0, p95: 0, p99: 0 },
      throughput: { readsPerSecond: 0, writesPerSecond: 0 }
    };

    if (metricsResult.length > 0 && metricsResult[0].values.length > 0) {
      const metricsRow = metricsResult[0].values[0];
      metrics = {
        commitPath: JSON.parse(metricsRow[2] as string),
        unavailableWindow: JSON.parse(metricsRow[3] as string || '[]'),
        conflicts: JSON.parse(metricsRow[4] as string || '[]'),
        risks: JSON.parse(metricsRow[5] as string || '[]'),
        latency: JSON.parse(metricsRow[6] as string || '{"average":0,"p95":0,"p99":0}'),
        throughput: JSON.parse(metricsRow[7] as string || '{"readsPerSecond":0,"writesPerSecond":0}')
      };
    }

    return {
      id: runRow[0] as string,
      seed: runRow[1] as number,
      startTime: runRow[3] as number,
      endTime: runRow[4] as number,
      consistencyModel: runRow[2] as string,
      events,
      nodes,
      metrics
    };
  }

  getAllSimulationResults(): SimulationResult[] {
    if (!this.db) throw new Error('数据库未初始化');

    // 获取所有模拟运行ID
    const runsResult = this.db.exec(
      `SELECT id FROM simulation_runs ORDER BY created_at ASC`
    );

    const results: SimulationResult[] = [];
    if (runsResult.length > 0) {
      runsResult[0].values.forEach((row: any[]) => {
        const result = this.getSimulationResult(row[0] as string);
        if (result) {
          results.push(result);
        }
      });
    }

    return results;
  }

  private saveDatabase(): void {
    if (!this.db) throw new Error('数据库未初始化');
    
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  close(): void {
    if (this.db) {
      this.saveDatabase();
      this.db.close();
      this.db = null;
    }
  }
}
