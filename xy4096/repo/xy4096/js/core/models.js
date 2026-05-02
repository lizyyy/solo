/**
 * 数据模型模块
 * 定义凭证、公钥、吊销名单、入场记录等数据结构
 */

const DataModels = (function() {
    'use strict';

    // 凭证状态枚举
    const CREDENTIAL_STATUS = {
        UNVERIFIED: 'unverified',      // 未验证
        VALID: 'valid',                  // 有效
        INVALID: 'invalid',              // 无效
        REVOKED: 'revoked',              // 已吊销
        EXPIRED: 'expired',              // 已过期
        DUPLICATE: 'duplicate',          // 重复使用
        ISOLATED: 'isolated',            // 已隔离
        SIGNATURE_INVALID: 'signature_invalid'  // 签名无效
    };

    // 验签结果状态
    const VERIFICATION_STATUS = {
        SUCCESS: 'success',              // 验签通过
        FAILED: 'failed',                // 验签失败
        WARNING: 'warning',              // 有警告
        ERROR: 'error'                   // 错误
    };

    // 票种类型
    const TICKET_TYPES = {
        ADULT: 'adult',                  // 成人票
        CHILD: 'child',                  // 儿童票
        SENIOR: 'senior',                // 老人票
        VIP: 'vip',                      // VIP票
        FREE: 'free',                    // 免费票
        GROUP: 'group'                   // 团体票
    };

    /**
     * 凭证数据模型
     * @param {Object} data - 凭证原始数据
     * @returns {Object} 标准化的凭证对象
     */
    function createCredential(data) {
        const now = Date.now();
        
        return {
            // 基础信息
            id: data.id || data.credentialId || CryptoAdapter.generateCredentialId(),
            ticketType: data.ticketType || data.type || TICKET_TYPES.ADULT,
            session: data.session || data.eventSession || 'default',
            
            // 时间相关
            issuedAt: data.issuedAt || data.createdAt || now,
            validFrom: data.validFrom || data.startTime || now,
            validTo: data.validTo || data.endTime || (now + 24 * 60 * 60 * 1000),
            
            // 签名相关
            signature: data.signature || data.sig || null,
            algorithm: data.algorithm || data.alg || 'RS256',
            keyId: data.keyId || data.kid || 'default',
            
            // 数据负载
            payload: data.payload || data.data || {},
            rawData: typeof data === 'string' ? data : JSON.stringify(data),
            
            // 状态信息
            status: data.status || CREDENTIAL_STATUS.UNVERIFIED,
            verificationResult: data.verificationResult || null,
            verificationTime: data.verificationTime || null,
            
            // 入场信息
            entryTime: data.entryTime || null,
            entryCount: data.entryCount || 0,
            
            // 隔离信息
            isIsolated: data.isIsolated || false,
            isolationReason: data.isolationReason || null,
            
            // 元数据
            createdAt: now,
            updatedAt: now,
            
            // 原始JWT（如果适用）
            jwt: data.jwt || data.token || null
        };
    }

    /**
     * 公钥数据模型
     * @param {Object} data - 公钥原始数据
     * @returns {Object} 标准化的公钥对象
     */
    function createPublicKey(data) {
        return {
            id: data.id || data.kid || data.keyId || 'default',
            key: data.key || data.publicKey || data.value || null,
            algorithm: data.algorithm || data.alg || 'RS256',
            format: data.format || 'pem',  // pem, jwk, spki
            version: data.version || 1,
            issuedAt: data.issuedAt || Date.now(),
            expiresAt: data.expiresAt || null,
            isActive: data.isActive !== false,
            
            // 密钥轮换相关
            isDeprecated: data.isDeprecated || false,
            deprecationReason: data.deprecationReason || null,
            
            // 元数据
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    /**
     * 吊销名单数据模型
     * @param {Object} data - 吊销记录原始数据
     * @returns {Object} 标准化的吊销对象
     */
    function createRevocation(data) {
        return {
            credentialId: data.credentialId || data.id || null,
            reason: data.reason || 'unknown',  // fraud, duplicate, refund, etc.
            revokedAt: data.revokedAt || data.timestamp || Date.now(),
            revokedBy: data.revokedBy || 'system',
            
            // 可选的附加信息
            notes: data.notes || null,
            evidence: data.evidence || null,
            
            // 元数据
            createdAt: Date.now()
        };
    }

    /**
     * 入场记录数据模型
     * @param {Object} data - 入场记录原始数据
     * @returns {Object} 标准化的入场记录对象
     */
    function createEntryRecord(data) {
        const now = Date.now();
        
        return {
            id: data.id || CryptoAdapter.generateCredentialId(16),
            
            // 关联凭证
            credentialId: data.credentialId || null,
            ticketType: data.ticketType || null,
            session: data.session || null,
            
            // 验签结果
            verificationStatus: data.verificationStatus || VERIFICATION_STATUS.FAILED,
            verificationDetails: data.verificationDetails || {},
            
            // 状态
            isAllowed: data.isAllowed || false,
            denyReason: data.denyReason || null,
            
            // 时间
            timestamp: data.timestamp || now,
            date: data.date || new Date(now).toISOString().split('T')[0],
            
            // 操作人信息
            operator: data.operator || 'anonymous',
            deviceId: data.deviceId || null,
            
            // 设备和位置信息（可选）
            location: data.location || null,
            ipAddress: data.ipAddress || null,
            
            // 元数据
            createdAt: now
        };
    }

    /**
     * 验签结果数据模型
     * @param {Object} data - 验签结果原始数据
     * @returns {Object} 标准化的验签结果对象
     */
    function createVerificationResult(data) {
        const now = Date.now();
        
        return {
            credentialId: data.credentialId || null,
            status: data.status || VERIFICATION_STATUS.FAILED,
            
            // 各项检查结果
            checks: {
                signature: data.checks?.signature || false,
                expiration: data.checks?.expiration || false,
                session: data.checks?.session || false,
                ticketType: data.checks?.ticketType || false,
                revocation: data.checks?.revocation || false,
                duplicate: data.checks?.duplicate || false
            },
            
            // 详细信息
            details: data.details || {},
            errors: data.errors || [],
            warnings: data.warnings || [],
            
            // 时间
            timestamp: now,
            
            // 最终判断
            isAllowed: data.isAllowed || false,
            denyReason: data.denyReason || null
        };
    }

    /**
     * 公钥包数据模型
     * 用于导入/导出公钥集合
     * @param {Object} data - 公钥包原始数据
     * @returns {Object} 标准化的公钥包对象
     */
    function createPublicKeyPackage(data) {
        return {
            version: data.version || '1.0.0',
            issuer: data.issuer || 'unknown',
            issuedAt: data.issuedAt || Date.now(),
            expiresAt: data.expiresAt || null,
            
            // 公钥列表
            keys: (data.keys || []).map(key => createPublicKey(key)),
            
            // 签名（用于验证公钥包本身）
            signature: data.signature || null,
            algorithm: data.algorithm || 'RS256',
            
            // 元数据
            createdAt: Date.now()
        };
    }

    /**
     * 验证数据模型的有效性
     * @param {string} modelType - 模型类型
     * @param {Object} data - 要验证的数据
     * @returns {Object} 验证结果 { isValid: boolean, errors: string[] }
     */
    function validateModel(modelType, data) {
        const errors = [];
        
        switch (modelType) {
            case 'credential':
                if (!data.id) errors.push('缺少凭证ID');
                if (!data.ticketType) errors.push('缺少票种信息');
                if (data.validFrom > data.validTo) {
                    errors.push('有效期开始时间不能晚于结束时间');
                }
                break;
                
            case 'publicKey':
                if (!data.key) errors.push('缺少公钥数据');
                if (!data.algorithm) errors.push('缺少算法信息');
                break;
                
            case 'revocation':
                if (!data.credentialId) errors.push('缺少凭证ID');
                break;
                
            case 'entryRecord':
                if (!data.credentialId) errors.push('缺少凭证ID');
                if (!data.timestamp) errors.push('缺少时间戳');
                break;
                
            default:
                errors.push(`未知的模型类型: ${modelType}`);
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 解析 CSV 格式的凭证数据
     * @param {string} csvContent - CSV 内容
     * @returns {Array} 凭证对象数组
     */
    function parseCredentialsFromCSV(csvContent) {
        const lines = csvContent.trim().split('\n');
        if (lines.length < 2) return [];
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const credentials = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const data = {};
            
            headers.forEach((header, index) => {
                if (values[index]) {
                    // 尝试解析日期
                    if (header.includes('time') || header.includes('date') || header.includes('at')) {
                        const dateVal = Date.parse(values[index]);
                        if (!isNaN(dateVal)) {
                            data[header] = dateVal;
                        } else {
                            data[header] = values[index];
                        }
                    } else if (values[index].toLowerCase() === 'true' || values[index].toLowerCase() === 'false') {
                        data[header] = values[index].toLowerCase() === 'true';
                    } else {
                        data[header] = values[index];
                    }
                }
            });
            
            // 映射常见的CSV字段名
            if (data['凭证id'] || data['id']) {
                data.id = data['凭证id'] || data.id;
            }
            if (data['票种'] || data['type']) {
                data.ticketType = data['票种'] || data.type;
            }
            if (data['场次'] || data['session']) {
                data.session = data['场次'] || data.session;
            }
            
            credentials.push(createCredential(data));
        }
        
        return credentials;
    }

    /**
     * 解析 JSON 格式的数据
     * @param {string} jsonContent - JSON 内容
     * @param {string} type - 数据类型
     * @returns {Array|Object} 解析后的数据
     */
    function parseFromJSON(jsonContent, type) {
        try {
            const data = JSON.parse(jsonContent);
            
            if (Array.isArray(data)) {
                switch (type) {
                    case 'credentials':
                        return data.map(item => createCredential(item));
                    case 'publicKeys':
                        return data.map(item => createPublicKey(item));
                    case 'revocations':
                        return data.map(item => createRevocation(item));
                    default:
                        return data;
                }
            }
            
            // 处理单个对象
            if (type === 'publicKeyPackage') {
                return createPublicKeyPackage(data);
            }
            
            return data;
        } catch (error) {
            throw new Error(`JSON 解析失败: ${error.message}`);
        }
    }

    // 公开 API
    return {
        // 枚举
        CREDENTIAL_STATUS,
        VERIFICATION_STATUS,
        TICKET_TYPES,

        // 创建函数
        createCredential,
        createPublicKey,
        createRevocation,
        createEntryRecord,
        createVerificationResult,
        createPublicKeyPackage,

        // 验证函数
        validateModel,

        // 解析函数
        parseCredentialsFromCSV,
        parseFromJSON
    };
})();

// 导出到全局命名空间
window.DataModels = DataModels;
