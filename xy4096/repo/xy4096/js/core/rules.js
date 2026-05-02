/**
 * 校验规则模块
 * 实现凭证验签的各种校验规则：
 * - 签名验证
 * - 有效期校验
 * - 场次校验
 * - 票种校验
 * - 吊销状态校验
 * - 重复使用校验
 */

const ValidationRules = (function() {
    'use strict';

    // 错误类型
    const ERROR_TYPES = {
        SIGNATURE_INVALID: 'signature_invalid',
        EXPIRED: 'expired',
        NOT_YET_VALID: 'not_yet_valid',
        INVALID_SESSION: 'invalid_session',
        INVALID_TICKET_TYPE: 'invalid_ticket_type',
        REVOKED: 'revoked',
        DUPLICATE_ENTRY: 'duplicate_entry',
        MISSING_DATA: 'missing_data',
        INVALID_FORMAT: 'invalid_format',
        PUBLIC_KEY_NOT_FOUND: 'public_key_not_found',
        VERIFICATION_ERROR: 'verification_error'
    };

    /**
     * 基础校验规则接口
     * @typedef {Object} ValidationRule
     * @property {string} name - 规则名称
     * @property {string} description - 规则描述
     * @property {Function} validate - 验证函数
     */

    /**
     * 签名验证规则
     * 验证凭证的数字签名是否有效
     */
    const signatureRule = {
        name: 'signature',
        description: '验证凭证的数字签名',
        
        /**
         * 验证签名
         * @param {Object} credential - 凭证对象
         * @param {Object} context - 上下文对象，包含公钥等信息
         * @returns {Promise<Object>} 验证结果
         */
        async validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            try {
                // 检查公钥是否可用
                if (!context.publicKeys || Object.keys(context.publicKeys).length === 0) {
                    result.error = {
                        type: ERROR_TYPES.PUBLIC_KEY_NOT_FOUND,
                        message: '未导入公钥，无法验证签名'
                    };
                    return result;
                }

                // 处理JWT格式的凭证
                if (credential.jwt) {
                    const jwtResult = await CryptoAdapter.verifyJWT(
                        credential.jwt,
                        context.publicKeys
                    );
                    
                    result.valid = jwtResult.isValid;
                    result.details.jwt = jwtResult;
                    
                    if (!jwtResult.isValid) {
                        result.error = {
                            type: ERROR_TYPES.SIGNATURE_INVALID,
                            message: jwtResult.error || 'JWT签名验证失败'
                        };
                    }
                    
                    return result;
                }

                // 处理带签名的普通凭证
                if (!credential.signature) {
                    // 没有签名的凭证，如果配置了允许无签名则通过，否则失败
                    if (context.allowUnsignedCredentials) {
                        result.valid = true;
                        result.details.warning = '凭证无签名，配置允许无签名凭证';
                        return result;
                    }
                    
                    result.error = {
                        type: ERROR_TYPES.SIGNATURE_INVALID,
                        message: '凭证缺少签名'
                    };
                    return result;
                }

                // 获取对应的公钥
                const keyId = credential.keyId || 'default';
                const keyConfig = context.publicKeys[keyId] || context.publicKeys['default'];
                
                if (!keyConfig) {
                    result.error = {
                        type: ERROR_TYPES.PUBLIC_KEY_NOT_FOUND,
                        message: `未找到对应公钥 (keyId: ${keyId})`
                    };
                    return result;
                }

                // 准备要验证的数据
                const dataToVerify = credential.rawData || JSON.stringify({
                    id: credential.id,
                    ticketType: credential.ticketType,
                    session: credential.session,
                    validFrom: credential.validFrom,
                    validTo: credential.validTo,
                    payload: credential.payload
                });

                // 验证签名
                const publicKey = await CryptoAdapter.importPublicKey(
                    keyConfig.key,
                    keyConfig.algorithm || credential.algorithm || 'RS256',
                    keyId
                );

                const isValid = await CryptoAdapter.verifySignature(
                    publicKey,
                    keyConfig.algorithm || credential.algorithm || 'RS256',
                    dataToVerify,
                    credential.signature
                );

                result.valid = isValid;
                result.details.keyId = keyId;
                result.details.algorithm = keyConfig.algorithm || credential.algorithm;

                if (!isValid) {
                    result.error = {
                        type: ERROR_TYPES.SIGNATURE_INVALID,
                        message: '签名验证失败，凭证可能被伪造'
                    };
                }

            } catch (error) {
                result.error = {
                    type: ERROR_TYPES.VERIFICATION_ERROR,
                    message: `签名验证过程出错: ${error.message}`
                };
            }

            return result;
        }
    };

    /**
     * 有效期校验规则
     * 验证凭证是否在有效期内
     */
    const expirationRule = {
        name: 'expiration',
        description: '验证凭证是否在有效期内',
        
        validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            const now = context.currentTime || Date.now();
            const validFrom = credential.validFrom || credential.issuedAt || 0;
            const validTo = credential.validTo || Infinity;

            result.details.now = new Date(now).toISOString();
            result.details.validFrom = new Date(validFrom).toISOString();
            result.details.validTo = validTo === Infinity ? '永久有效' : new Date(validTo).toISOString();

            // 检查是否还未生效
            if (now < validFrom) {
                result.error = {
                    type: ERROR_TYPES.NOT_YET_VALID,
                    message: `凭证尚未生效，生效时间: ${new Date(validFrom).toLocaleString()}`
                };
                return result;
            }

            // 检查是否已过期
            if (now > validTo) {
                result.error = {
                    type: ERROR_TYPES.EXPIRED,
                    message: `凭证已过期，过期时间: ${new Date(validTo).toLocaleString()}`
                };
                return result;
            }

            result.valid = true;
            return result;
        }
    };

    /**
     * 场次校验规则
     * 验证凭证对应的场次是否有效
     */
    const sessionRule = {
        name: 'session',
        description: '验证凭证对应的场次',
        
        validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            const allowedSessions = context.allowedSessions || [];
            const credentialSession = credential.session || 'default';

            result.details.credentialSession = credentialSession;
            result.details.allowedSessions = allowedSessions;

            // 如果没有配置允许的场次，则所有场次都允许
            if (allowedSessions.length === 0) {
                result.valid = true;
                result.details.warning = '未配置场次限制，所有场次均允许';
                return result;
            }

            // 检查凭证场次是否在允许列表中
            if (allowedSessions.includes(credentialSession)) {
                result.valid = true;
                return result;
            }

            result.error = {
                type: ERROR_TYPES.INVALID_SESSION,
                message: `凭证场次无效，当前场次: ${credentialSession}，允许的场次: ${allowedSessions.join(', ')}`
            };

            return result;
        }
    };

    /**
     * 票种校验规则
     * 验证凭证的票种是否有效
     */
    const ticketTypeRule = {
        name: 'ticketType',
        description: '验证凭证的票种',
        
        validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            const allowedTicketTypes = context.allowedTicketTypes || [];
            const credentialType = credential.ticketType || DataModels.TICKET_TYPES.ADULT;

            result.details.credentialType = credentialType;
            result.details.allowedTypes = allowedTicketTypes;

            // 如果没有配置允许的票种，则所有票种都允许
            if (allowedTicketTypes.length === 0) {
                result.valid = true;
                result.details.warning = '未配置票种限制，所有票种均允许';
                return result;
            }

            // 检查票种是否在允许列表中
            if (allowedTicketTypes.includes(credentialType)) {
                result.valid = true;
                return result;
            }

            result.error = {
                type: ERROR_TYPES.INVALID_TICKET_TYPE,
                message: `凭证票种无效，当前票种: ${credentialType}，允许的票种: ${allowedTicketTypes.join(', ')}`
            };

            return result;
        }
    };

    /**
     * 吊销状态校验规则
     * 验证凭证是否已被吊销
     */
    const revocationRule = {
        name: 'revocation',
        description: '验证凭证是否已被吊销',
        
        validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            const revocationList = context.revocationList || [];
            const credentialId = credential.id;

            result.details.credentialId = credentialId;

            // 检查凭证是否在吊销名单中
            const revokedItem = revocationList.find(item => 
                item.credentialId === credentialId
            );

            if (revokedItem) {
                result.error = {
                    type: ERROR_TYPES.REVOKED,
                    message: `凭证已被吊销，原因: ${revokedItem.reason || '未知原因'}，吊销时间: ${new Date(revokedItem.revokedAt).toLocaleString()}`
                };
                result.details.revocation = revokedItem;
                return result;
            }

            result.valid = true;
            return result;
        }
    };

    /**
     * 重复使用校验规则
     * 验证凭证是否已被使用过
     */
    const duplicateRule = {
        name: 'duplicate',
        description: '验证凭证是否已被使用',
        
        validate(credential, context) {
            const result = {
                valid: false,
                error: null,
                details: {}
            };

            const usedCredentials = context.usedCredentials || new Set();
            const allowMultipleEntries = context.allowMultipleEntries || false;
            const credentialId = credential.id;

            result.details.credentialId = credentialId;
            result.details.allowMultipleEntries = allowMultipleEntries;

            // 如果允许多次入场，则跳过重复检查
            if (allowMultipleEntries) {
                result.valid = true;
                result.details.warning = '配置允许多次入场';
                return result;
            }

            // 检查凭证是否已被使用
            if (usedCredentials.has(credentialId)) {
                result.error = {
                    type: ERROR_TYPES.DUPLICATE_ENTRY,
                    message: `凭证已被使用，请勿重复入场`
                };
                result.details.usedAt = '已记录';
                return result;
            }

            result.valid = true;
            return result;
        }
    };

    // 所有校验规则
    const allRules = [
        signatureRule,
        expirationRule,
        sessionRule,
        ticketTypeRule,
        revocationRule,
        duplicateRule
    ];

    /**
     * 执行完整的凭证验证
     * @param {Object} credential - 凭证对象
     * @param {Object} context - 验证上下文
     * @param {Array<string>} [ruleNames] - 要执行的规则名称，不指定则执行所有规则
     * @returns {Promise<Object>} 完整的验证结果
     */
    async function validateCredential(credential, context, ruleNames = null) {
        const result = {
            credentialId: credential.id,
            isValid: false,
            status: DataModels.VERIFICATION_STATUS.FAILED,
            checks: {},
            errors: [],
            warnings: [],
            details: {},
            isAllowed: false,
            denyReason: null
        };

        try {
            // 确定要执行的规则
            let rulesToExecute = allRules;
            if (ruleNames) {
                rulesToExecute = allRules.filter(rule => ruleNames.includes(rule.name));
            }

            // 执行每个规则
            for (const rule of rulesToExecute) {
                let ruleResult;
                
                if (rule.name === 'signature') {
                    ruleResult = await rule.validate(credential, context);
                } else {
                    ruleResult = rule.validate(credential, context);
                }

                result.checks[rule.name] = ruleResult.valid;

                if (ruleResult.details) {
                    result.details[rule.name] = ruleResult.details;
                    
                    if (ruleResult.details.warning) {
                        result.warnings.push({
                            rule: rule.name,
                            message: ruleResult.details.warning
                        });
                    }
                }

                if (ruleResult.error) {
                    result.errors.push({
                        rule: rule.name,
                        type: ruleResult.error.type,
                        message: ruleResult.error.message
                    });
                }
            }

            // 汇总结果
            const failedRules = Object.entries(result.checks)
                .filter(([_, valid]) => !valid)
                .map(([ruleName]) => ruleName);

            if (failedRules.length === 0) {
                result.isValid = true;
                result.status = DataModels.VERIFICATION_STATUS.SUCCESS;
                result.isAllowed = true;
            } else if (result.errors.length > 0) {
                // 有错误
                const criticalErrors = result.errors.filter(e => 
                    e.type !== ERROR_TYPES.NOT_YET_VALID &&
                    e.type !== ERROR_TYPES.INVALID_SESSION &&
                    e.type !== ERROR_TYPES.INVALID_TICKET_TYPE
                );

                if (criticalErrors.length > 0) {
                    result.status = DataModels.VERIFICATION_STATUS.FAILED;
                    result.isAllowed = false;
                    result.denyReason = criticalErrors[0].message;
                } else {
                    result.status = DataModels.VERIFICATION_STATUS.WARNING;
                    result.isAllowed = context.allowWithWarnings || false;
                    result.denyReason = result.errors[0]?.message;
                }
            }

        } catch (error) {
            result.errors.push({
                rule: 'system',
                type: ERROR_TYPES.VERIFICATION_ERROR,
                message: `验证过程出错: ${error.message}`
            });
            result.status = DataModels.VERIFICATION_STATUS.ERROR;
        }

        return result;
    }

    /**
     * 批量验证凭证
     * @param {Array<Object>} credentials - 凭证数组
     * @param {Object} context - 验证上下文
     * @param {Function} [progressCallback] - 进度回调函数
     * @returns {Promise<Array<Object>>} 验证结果数组
     */
    async function validateBatch(credentials, context, progressCallback = null) {
        const results = [];
        const total = credentials.length;

        for (let i = 0; i < total; i++) {
            const credential = credentials[i];
            const result = await validateCredential(credential, context);
            results.push(result);

            if (progressCallback) {
                progressCallback(i + 1, total, credential.id);
            }
        }

        return results;
    }

    /**
     * 生成验证结果的状态描述
     * @param {Object} validationResult - 验证结果
     * @returns {string} 状态描述
     */
    function getStatusDescription(validationResult) {
        if (validationResult.isValid && validationResult.isAllowed) {
            return '验签通过，允许入场';
        }

        if (validationResult.errors.length > 0) {
            const error = validationResult.errors[0];
            switch (error.type) {
                case ERROR_TYPES.SIGNATURE_INVALID:
                    return '签名无效，凭证可能被伪造';
                case ERROR_TYPES.EXPIRED:
                    return '凭证已过期';
                case ERROR_TYPES.NOT_YET_VALID:
                    return '凭证尚未生效';
                case ERROR_TYPES.REVOKED:
                    return '凭证已被吊销';
                case ERROR_TYPES.DUPLICATE_ENTRY:
                    return '凭证已被使用，重复入场';
                case ERROR_TYPES.INVALID_SESSION:
                    return '场次不匹配';
                case ERROR_TYPES.INVALID_TICKET_TYPE:
                    return '票种无效';
                case ERROR_TYPES.PUBLIC_KEY_NOT_FOUND:
                    return '缺少公钥，无法验证';
                default:
                    return error.message || '验签失败';
            }
        }

        if (validationResult.warnings.length > 0) {
            return '验签通过，但存在警告';
        }

        return '验签失败';
    }

    // 公开 API
    return {
        // 常量
        ERROR_TYPES,

        // 规则对象
        signatureRule,
        expirationRule,
        sessionRule,
        ticketTypeRule,
        revocationRule,
        duplicateRule,

        // 核心函数
        validateCredential,
        validateBatch,
        getStatusDescription,

        // 所有规则列表
        allRules
    };
})();

// 导出到全局命名空间
window.ValidationRules = ValidationRules;
