import { generateKeyPairSync, createSign } from 'crypto';
import { contractService } from '../services/contractService';
import { verifyService } from '../services/verifyService';
import { ContractStatus, VerifyResult } from '../types';
import { runQuery } from '../database';

describe('回调契约验签API测试', () => {
  let keyPair: any;
  let supplierId: string;
  let contractId: string;

  beforeAll(async () => {
    keyPair = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
  });

  async function safeDelete(table: string) {
    try {
      await runQuery(`DELETE FROM ${table}`);
    } catch (e) {
      // 表不存在时忽略错误
    }
  }

  beforeEach(async () => {
    await safeDelete('field_diffs');
    await safeDelete('audit_logs');
    await safeDelete('verification_conclusions');
    await safeDelete('callback_samples');
    await safeDelete('contract_versions');
    await safeDelete('suppliers');
    // 等待表初始化完成
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  test('创建供应商', async () => {
    const result = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    expect(result).toHaveProperty('id');
    expect(result.name).toBe('测试供应商');
    supplierId = result.id;
  });

  test('创建契约版本', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const result = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status', 'timestamp'],
      'X-Signature'
    );
    expect(result).toHaveProperty('id');
    expect(result.version).toBe('v1.0.0');
    contractId = result.id;
  });

  test('验签成功 + 字段校验通过', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status', 'timestamp'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = {
      orderId: 'ORD123456',
      amount: 999.99,
      status: 'success',
      timestamp: Date.now()
    };

    const signer = createSign('RSA-SHA256');
    signer.update(JSON.stringify(body));
    const signature = signer.sign(keyPair.privateKey, 'base64');

    const headers = {
      'X-Signature': signature,
      'Content-Type': 'application/json'
    };

    const sample = await contractService.createCallbackSample(
      supplierId,
      contractId,
      headers,
      body
    );

    const conclusion = await contractService.processSample(sample.sampleId);
    
    expect(conclusion).toBeDefined();
    expect(conclusion?.sign_result).toBe(VerifyResult.SUCCESS);
    expect(conclusion?.field_result).toBe(VerifyResult.SUCCESS);
    expect(conclusion?.overall_result).toBe(VerifyResult.SUCCESS);
    expect(conclusion?.status).toBe(ContractStatus.PENDING);
  });

  test('验签失败 - 签名错误', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = {
      orderId: 'ORD123456',
      amount: 999.99,
      status: 'success'
    };

    const headers = {
      'X-Signature': 'invalid_signature_123456',
      'Content-Type': 'application/json'
    };

    const sample = await contractService.createCallbackSample(
      supplierId,
      contractId,
      headers,
      body
    );

    const conclusion = await contractService.processSample(sample.sampleId);
    
    expect(conclusion).toBeDefined();
    expect(conclusion?.sign_result).toBe(VerifyResult.FAILED);
    expect(conclusion?.overall_result).toBe(VerifyResult.FAILED);
    expect(conclusion?.status).toBe(ContractStatus.BLOCKED);
  });

  test('字段校验失败 - 缺少必填字段', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status', 'timestamp'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = {
      orderId: 'ORD123456',
      amount: 999.99,
      status: 'success'
    };

    const signer = createSign('RSA-SHA256');
    signer.update(JSON.stringify(body));
    const signature = signer.sign(keyPair.privateKey, 'base64');

    const headers = {
      'X-Signature': signature,
      'Content-Type': 'application/json'
    };

    const sample = await contractService.createCallbackSample(
      supplierId,
      contractId,
      headers,
      body
    );

    const conclusion = await contractService.processSample(sample.sampleId);
    
    expect(conclusion).toBeDefined();
    expect(conclusion?.sign_result).toBe(VerifyResult.SUCCESS);
    expect(conclusion?.field_result).toBe(VerifyResult.FAILED);
    expect(conclusion?.overall_result).toBe(VerifyResult.FAILED);
    expect(conclusion?.status).toBe(ContractStatus.BLOCKED);
  });

  test('字段校验部分通过 - 有额外字段', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = {
      orderId: 'ORD123456',
      amount: 999.99,
      status: 'success',
      extraField: '额外字段',
      anotherExtra: true
    };

    const signer = createSign('RSA-SHA256');
    signer.update(JSON.stringify(body));
    const signature = signer.sign(keyPair.privateKey, 'base64');

    const headers = {
      'X-Signature': signature,
      'Content-Type': 'application/json'
    };

    const sample = await contractService.createCallbackSample(
      supplierId,
      contractId,
      headers,
      body
    );

    const conclusion = await contractService.processSample(sample.sampleId);
    
    expect(conclusion).toBeDefined();
    expect(conclusion?.sign_result).toBe(VerifyResult.SUCCESS);
    expect(conclusion?.field_result).toBe(VerifyResult.PARTIAL);
    expect(conclusion?.overall_result).toBe(VerifyResult.PARTIAL);
  });

  test('状态推进 - 从待处理到已确认', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = { orderId: 'ORD123456', amount: 999.99, status: 'success' };
    const signer = createSign('RSA-SHA256');
    signer.update(JSON.stringify(body));
    const signature = signer.sign(keyPair.privateKey, 'base64');
    const headers = { 'X-Signature': signature };

    const sample = await contractService.createCallbackSample(supplierId, contractId, headers, body);
    const conclusion = await contractService.processSample(sample.sampleId);
    const conclusionId = conclusion!.id;

    const result = await contractService.updateStatus(
      conclusionId,
      ContractStatus.CONFIRMED,
      'operator_001',
      '验签和字段校验全部通过，确认通过'
    );

    expect(result.oldStatus).toBe(ContractStatus.PENDING);
    expect(result.newStatus).toBe(ContractStatus.CONFIRMED);
    expect(result.operator).toBe('operator_001');
  });

  test('人工修正功能', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = { orderId: 'ORD123456', amount: 999.99, status: 'success' };
    const headers = { 'X-Signature': 'invalid_signature' };

    const sample = await contractService.createCallbackSample(supplierId, contractId, headers, body);
    const conclusion = await contractService.processSample(sample.sampleId);
    const conclusionId = conclusion!.id;

    const result = await contractService.manualCorrect(
      conclusionId,
      VerifyResult.SUCCESS,
      'admin_001',
      '确认该回调为可信，签名错误为供应商测试环境问题'
    );

    expect(result.oldResult).toBe(VerifyResult.FAILED);
    expect(result.correctedResult).toBe(VerifyResult.SUCCESS);
  });

  test('异常追溯信息完整', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status', 'timestamp'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = { orderId: 'ORD123456', amount: 999.99, status: 'success' };
    const headers = { 'X-Signature': 'invalid_signature' };

    const sample = await contractService.createCallbackSample(supplierId, contractId, headers, body);
    const conclusion = await contractService.processSample(sample.sampleId);
    const conclusionId = conclusion!.id;

    await contractService.updateStatus(
      conclusionId,
      ContractStatus.COMPENSATED,
      'operator_001',
      '已完成补偿处理'
    );

    const trace = await contractService.getExceptionTrace(conclusionId);
    
    expect(trace).toHaveProperty('conclusion');
    expect(trace).toHaveProperty('rawInput');
    expect(trace).toHaveProperty('processingBasis');
    expect(trace).toHaveProperty('fieldDiffs');
    expect(trace).toHaveProperty('auditLogs');
    expect(trace.auditLogs.length).toBeGreaterThan(0);
    expect(trace.rawInput).toBeDefined();
    expect(trace.processingBasis).toBeDefined();
  });

  test('查询验收结论列表', async () => {
    const supplier = await contractService.createSupplier(
      '测试供应商',
      keyPair.publicKey,
      'RSA256'
    );
    supplierId = supplier.id;

    const contract = await contractService.createContractVersion(
      supplierId,
      'v1.0.0',
      'https://example.com/callback',
      ['orderId', 'amount', 'status'],
      'X-Signature'
    );
    contractId = contract.id;

    const body = { orderId: 'ORD123456', amount: 999.99, status: 'success' };
    const signer = createSign('RSA-SHA256');
    signer.update(JSON.stringify(body));
    const signature = signer.sign(keyPair.privateKey, 'base64');
    const headers = { 'X-Signature': signature };

    await contractService.createCallbackSample(supplierId, contractId, headers, body);
    await contractService.processSample((await contractService.createCallbackSample(supplierId, contractId, headers, body)).sampleId);
    await contractService.processSample((await contractService.createCallbackSample(supplierId, contractId, headers, body)).sampleId);

    const results = await contractService.queryConclusions({ supplierId });
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
