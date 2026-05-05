const fs = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const csv = require('csv-parser');
const jsonlines = require('jsonlines');
const { getDb } = require('../database');

function importServices(filePath) {
  const db = getDb();
  const content = fs.readFileSync(filePath, 'utf8');
  const services = yaml.load(content);
  
  if (!Array.isArray(services)) {
    throw new Error('services.yaml 格式错误，应为数组');
  }
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO services (name, description, domain, owner_team)
    VALUES (@name, @description, @domain, @owner_team)
  `);
  
  const transaction = db.transaction((svcs) => {
    for (const svc of svcs) {
      insertStmt.run({
        name: svc.name,
        description: svc.description || null,
        domain: svc.domain || null,
        owner_team: svc.owner_team || svc.owner || null
      });
    }
  });
  
  transaction(services);
  console.log(`✓ 已导入 ${services.length} 个服务`);
  return services.length;
}

function importEndpoints(filePath) {
  const db = getDb();
  const content = fs.readFileSync(filePath, 'utf8');
  const endpoints = yaml.load(content);
  
  if (!Array.isArray(endpoints)) {
    throw new Error('endpoints.yaml 格式错误，应为数组');
  }
  
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO endpoints (service_name, method, path, description, tags)
    VALUES (@service_name, @method, @path, @description, @tags)
  `);
  
  const transaction = db.transaction((eps) => {
    for (const ep of eps) {
      insertStmt.run({
        service_name: ep.service || ep.service_name,
        method: ep.method || 'GET',
        path: ep.path,
        description: ep.description || null,
        tags: ep.tags ? JSON.stringify(ep.tags) : null
      });
    }
  });
  
  transaction(endpoints);
  console.log(`✓ 已导入 ${endpoints.length} 个端点`);
  return endpoints.length;
}

function importTables(filePath) {
  const db = getDb();
  const tables = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        tables.push(row);
      })
      .on('end', () => {
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO database_tables (name, schema_name, owner_service, description, row_count, size_mb)
          VALUES (@name, @schema_name, @owner_service, @description, @row_count, @size_mb)
        `);
        
        const ownerStmt = db.prepare(`
          INSERT OR REPLACE INTO table_owners (table_name, service_name, is_owner, confidence, source)
          VALUES (@table_name, @service_name, 1, 1.0, 'import')
        `);
        
        const accessStmt = db.prepare(`
          INSERT OR REPLACE INTO service_table_access (service_name, table_name, access_type, access_count)
          VALUES (@service_name, @table_name, @access_type, @access_count)
        `);
        
        const transaction = db.transaction((tbls) => {
          for (const tbl of tbls) {
            const ownerService = tbl.owner_service || tbl.owner || null;
            
            insertStmt.run({
              name: tbl.name,
              schema_name: tbl.schema_name || tbl.schema || null,
              owner_service: ownerService,
              description: tbl.description || null,
              row_count: tbl.row_count ? parseInt(tbl.row_count) : null,
              size_mb: tbl.size_mb ? parseFloat(tbl.size_mb) : null
            });
            
            if (ownerService) {
              ownerStmt.run({
                table_name: tbl.name,
                service_name: ownerService
              });
              
              accessStmt.run({
                service_name: ownerService,
                table_name: tbl.name,
                access_type: 'OWNER',
                access_count: 1
              });
            }
            
            if (tbl.access_services) {
              const accessServices = tbl.access_services.split(',').map(s => s.trim());
              for (const svc of accessServices) {
                if (svc && svc !== ownerService) {
                  accessStmt.run({
                    service_name: svc,
                    table_name: tbl.name,
                    access_type: 'DIRECT_READ',
                    access_count: 1
                  });
                }
              }
            }
          }
        });
        
        transaction(tables);
        console.log(`✓ 已导入 ${tables.length} 个数据库表`);
        resolve(tables.length);
      })
      .on('error', reject);
  });
}

function importEvents(filePath) {
  const db = getDb();
  const events = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(jsonlines.parse())
      .on('data', (event) => {
        events.push(event);
      })
      .on('end', () => {
        const eventStmt = db.prepare(`
          INSERT OR REPLACE INTO domain_events (name, source_service, event_type, description, payload_schema)
          VALUES (@name, @source_service, @event_type, @description, @payload_schema)
        `);
        
        const publishStmt = db.prepare(`
          INSERT OR REPLACE INTO service_event_publish (service_name, event_name, publish_count)
          VALUES (@service_name, @event_name, @publish_count)
        `);
        
        const subscribeStmt = db.prepare(`
          INSERT OR REPLACE INTO service_event_subscribe (service_name, event_name, subscribe_count)
          VALUES (@service_name, @event_name, @subscribe_count)
        `);
        
        const transaction = db.transaction((evts) => {
          for (const evt of evts) {
            eventStmt.run({
              name: evt.name,
              source_service: evt.source_service || evt.source || null,
              event_type: evt.event_type || evt.type || 'DOMAIN_EVENT',
              description: evt.description || null,
              payload_schema: evt.payload_schema ? JSON.stringify(evt.payload_schema) : null
            });
            
            if (evt.publishers) {
              for (const publisher of evt.publishers) {
                publishStmt.run({
                  service_name: publisher.service || publisher,
                  event_name: evt.name,
                  publish_count: publisher.count || 1
                });
              }
            } else if (evt.source_service) {
              publishStmt.run({
                service_name: evt.source_service,
                event_name: evt.name,
                publish_count: 1
              });
            }
            
            if (evt.subscribers) {
              for (const subscriber of evt.subscribers) {
                subscribeStmt.run({
                  service_name: subscriber.service || subscriber,
                  event_name: evt.name,
                  subscribe_count: subscriber.count || 1
                });
              }
            }
          }
        });
        
        transaction(events);
        console.log(`✓ 已导入 ${events.length} 个领域事件`);
        resolve(events.length);
      })
      .on('error', reject);
  });
}

function importCallEdges(filePath) {
  const db = getDb();
  const edges = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(jsonlines.parse())
      .on('data', (edge) => {
        edges.push(edge);
      })
      .on('end', () => {
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO call_edges (source_service, target_service, call_type, call_count, avg_latency_ms)
          VALUES (@source_service, @target_service, @call_type, @call_count, @avg_latency_ms)
        `);
        
        const transaction = db.transaction((edgs) => {
          for (const edge of edgs) {
            insertStmt.run({
              source_service: edge.source || edge.source_service,
              target_service: edge.target || edge.target_service,
              call_type: edge.type || edge.call_type || 'SYNC',
              call_count: edge.count || edge.call_count || 1,
              avg_latency_ms: edge.latency_ms || edge.avg_latency_ms || null
            });
          }
        });
        
        transaction(edges);
        console.log(`✓ 已导入 ${edges.length} 条调用边`);
        resolve(edges.length);
      })
      .on('error', reject);
  });
}

async function importAll(config) {
  const { dataDir = './data' } = config;
  
  const servicesPath = path.join(dataDir, 'services.yaml');
  if (fs.existsSync(servicesPath)) {
    importServices(servicesPath);
  } else {
    console.log('⚠ services.yaml 不存在，跳过');
  }
  
  const endpointsPath = path.join(dataDir, 'endpoints.yaml');
  if (fs.existsSync(endpointsPath)) {
    importEndpoints(endpointsPath);
  } else {
    console.log('⚠ endpoints.yaml 不存在，跳过');
  }
  
  const tablesPath = path.join(dataDir, 'tables.csv');
  if (fs.existsSync(tablesPath)) {
    await importTables(tablesPath);
  } else {
    console.log('⚠ tables.csv 不存在，跳过');
  }
  
  const eventsPath = path.join(dataDir, 'events.jsonl');
  if (fs.existsSync(eventsPath)) {
    await importEvents(eventsPath);
  } else {
    console.log('⚠ events.jsonl 不存在，跳过');
  }
  
  const callEdgesPath = path.join(dataDir, 'call-edges.jsonl');
  if (fs.existsSync(callEdgesPath)) {
    await importCallEdges(callEdgesPath);
  } else {
    console.log('⚠ call-edges.jsonl 不存在，跳过');
  }
  
  console.log('✓ 数据导入完成');
}

module.exports = {
  importServices,
  importEndpoints,
  importTables,
  importEvents,
  importCallEdges,
  importAll
};
