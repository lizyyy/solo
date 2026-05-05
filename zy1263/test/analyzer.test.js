const { expect } = require('chai');
const fs = require('fs-extra');
const path = require('path');
const { initDb, createTables, closeDb, getDb, prepare } = require('../src/database');
const { 
  detectCrossServiceTableAccess,
  detectUnclearTableOwner,
  detectCircularCalls,
  detectLongSyncChains,
  detectMissingDomainEvents,
  detectOverlappingResponsibilities,
  runAllAnalyses,
  ISSUE_TYPES,
  SEVERITY
} = require('../src/analyzer');

const TEST_DB_PATH = './test-msa-db.sqlite';

describe('Analyzer', function() {
  
  beforeEach(async function() {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.removeSync(TEST_DB_PATH);
    }
    await initDb(TEST_DB_PATH);
    createTables();
  });
  
  afterEach(function() {
    closeDb();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.removeSync(TEST_DB_PATH);
    }
  });
  
  describe('detectCrossServiceTableAccess', function() {
    
    it('应该检测到跨服务直接查表问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('user-service', '用户服务', '用户域'),
               ('order-service', '订单服务', '订单域')
      `);
      
      db.run(`
        INSERT INTO database_tables (name, owner_service, description)
        VALUES ('users', 'user-service', '用户表'),
               ('orders', 'order-service', '订单表')
      `);
      
      db.run(`
        INSERT INTO table_owners (table_name, service_name, is_owner, confidence, source)
        VALUES ('users', 'user-service', 1, 1.0, 'import'),
               ('orders', 'order-service', 1, 1.0, 'import')
      `);
      
      db.run(`
        INSERT INTO service_table_access (service_name, table_name, access_type, access_count)
        VALUES ('user-service', 'users', 'OWNER', 1),
               ('order-service', 'orders', 'OWNER', 1),
               ('order-service', 'users', 'DIRECT_READ', 100)
      `);
      
      const issues = detectCrossServiceTableAccess();
      
      expect(issues).to.have.lengthOf(1);
      expect(issues[0].issue_type).to.equal(ISSUE_TYPES.CROSS_SERVICE_TABLE_ACCESS);
      expect(issues[0].title).to.include('users');
    });
    
    it('没有跨服务访问时应该不返回问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('user-service', '用户服务', '用户域')
      `);
      
      db.run(`
        INSERT INTO database_tables (name, owner_service, description)
        VALUES ('users', 'user-service', '用户表')
      `);
      
      db.run(`
        INSERT INTO service_table_access (service_name, table_name, access_type, access_count)
        VALUES ('user-service', 'users', 'OWNER', 1)
      `);
      
      const issues = detectCrossServiceTableAccess();
      expect(issues).to.have.lengthOf(0);
    });
  });
  
  describe('detectUnclearTableOwner', function() {
    
    it('应该检测到无主表问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO database_tables (name, description)
        VALUES ('shared_config', '共享配置表')
      `);
      
      const issues = detectUnclearTableOwner();
      
      expect(issues).to.have.lengthOf(1);
      expect(issues[0].issue_type).to.equal(ISSUE_TYPES.UNCLEAR_TABLE_OWNER);
      expect(issues[0].severity).to.equal(SEVERITY.HIGH);
    });
    
    it('应该检测到多服务声明拥有同一表的问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('service-a', '服务A', '域A'),
               ('service-b', '服务B', '域B')
      `);
      
      db.run(`
        INSERT INTO database_tables (name, description)
        VALUES ('disputed_table', '有争议的表')
      `);
      
      db.run(`
        INSERT INTO table_owners (table_name, service_name, is_owner, confidence, source)
        VALUES ('disputed_table', 'service-a', 1, 0.8, 'claim'),
               ('disputed_table', 'service-b', 1, 0.7, 'claim')
      `);
      
      const issues = detectUnclearTableOwner();
      
      const criticalIssues = issues.filter(i => i.severity === SEVERITY.CRITICAL);
      expect(criticalIssues).to.have.length.above(0);
    });
  });
  
  describe('detectCircularCalls', function() {
    
    it('应该检测到简单的循环调用', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('service-a', '服务A', '域A'),
               ('service-b', '服务B', '域B')
      `);
      
      db.run(`
        INSERT INTO call_edges (source_service, target_service, call_type, call_count)
        VALUES ('service-a', 'service-b', 'SYNC', 100),
               ('service-b', 'service-a', 'SYNC', 50)
      `);
      
      const issues = detectCircularCalls();
      
      expect(issues).to.have.length.above(0);
      expect(issues[0].issue_type).to.equal(ISSUE_TYPES.CIRCULAR_CALL);
    });
    
    it('没有循环时应该不返回问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('service-a', '服务A', '域A'),
               ('service-b', '服务B', '域B'),
               ('service-c', '服务C', '域C')
      `);
      
      db.run(`
        INSERT INTO call_edges (source_service, target_service, call_type, call_count)
        VALUES ('service-a', 'service-b', 'SYNC', 100),
               ('service-b', 'service-c', 'SYNC', 50)
      `);
      
      const issues = detectCircularCalls();
      expect(issues).to.have.lengthOf(0);
    });
  });
  
  describe('detectLongSyncChains', function() {
    
    it('应该检测到过长的同步链', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('s1', '服务1', '域'),
               ('s2', '服务2', '域'),
               ('s3', '服务3', '域'),
               ('s4', '服务4', '域'),
               ('s5', '服务5', '域')
      `);
      
      db.run(`
        INSERT INTO call_edges (source_service, target_service, call_type, call_count)
        VALUES ('s1', 's2', 'SYNC', 100),
               ('s2', 's3', 'SYNC', 100),
               ('s3', 's4', 'SYNC', 100),
               ('s4', 's5', 'SYNC', 100)
      `);
      
      const issues = detectLongSyncChains(3);
      
      expect(issues).to.have.length.above(0);
      expect(issues[0].issue_type).to.equal(ISSUE_TYPES.LONG_SYNC_CHAIN);
    });
  });
  
  describe('detectMissingDomainEvents', function() {
    
    it('应该检测到只用同步调用不发布事件的问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('sync-only-service', '只用同步的服务', '域')
      `);
      
      db.run(`
        INSERT INTO call_edges (source_service, target_service, call_type, call_count)
        VALUES ('sync-only-service', 'other-service', 'SYNC', 100)
      `);
      
      const issues = detectMissingDomainEvents();
      
      expect(issues).to.have.length.above(0);
    });
  });
  
  describe('detectOverlappingResponsibilities', function() {
    
    it('应该检测到同领域多服务的问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('user-profile', '用户资料', '用户域'),
               ('user-auth', '用户认证', '用户域'),
               ('user-preference', '用户偏好', '用户域')
      `);
      
      const issues = detectOverlappingResponsibilities();
      
      const overlapIssues = issues.filter(i => i.issue_type === ISSUE_TYPES.OVERLAPPING_RESPONSIBILITY);
      expect(overlapIssues).to.have.length.above(0);
    });
    
    it('应该检测到同前缀表跨服务的问题', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('order-service', '订单服务', '订单域'),
               ('payment-service', '支付服务', '支付域')
      `);
      
      db.run(`
        INSERT INTO database_tables (name, owner_service, description)
        VALUES ('order_main', 'order-service', '订单主表'),
               ('order_payment', 'payment-service', '订单支付表')
      `);
      
      const issues = detectOverlappingResponsibilities();
      
      const highIssues = issues.filter(i => i.severity === SEVERITY.HIGH);
      expect(highIssues).to.have.length.above(0);
    });
  });
  
  describe('runAllAnalyses', function() {
    
    it('应该运行所有分析并创建报告', function() {
      const db = getDb();
      
      db.run(`
        INSERT INTO services (name, description, domain)
        VALUES ('user-service', '用户服务', '用户域'),
               ('order-service', '订单服务', '订单域')
      `);
      
      db.run(`
        INSERT INTO database_tables (name, owner_service, description)
        VALUES ('users', 'user-service', '用户表'),
               ('orders', 'order-service', '订单表'),
               ('orphan_table', NULL, '无主表')
      `);
      
      db.run(`
        INSERT INTO service_table_access (service_name, table_name, access_type, access_count)
        VALUES ('user-service', 'users', 'OWNER', 1),
               ('order-service', 'orders', 'OWNER', 1),
               ('order-service', 'users', 'DIRECT_READ', 100)
      `);
      
      const result = runAllAnalyses();
      
      expect(result).to.have.property('reportId');
      expect(result).to.have.property('issues');
      expect(result.stats.total).to.be.above(0);
    });
  });
});
