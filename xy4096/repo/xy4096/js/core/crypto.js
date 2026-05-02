/**
 * 加密适配模块
 * 使用 WebCrypto API 实现验签功能
 * 支持 RSA-PSS 和 ECDSA 签名算法
 */

const CryptoAdapter = (function() {
    'use strict';

    // 支持的签名算法
    const ALGORITHMS = {
        'RS256': {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        'RS384': {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-384'
        },
        'RS512': {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-512'
        },
        'PS256': {
            name: 'RSA-PSS',
            hash: 'SHA-256',
            saltLength: 32
        },
        'ES256': {
            name: 'ECDSA',
            namedCurve: 'P-256',
            hash: 'SHA-256'
        },
        'ES384': {
            name: 'ECDSA',
            namedCurve: 'P-384',
            hash: 'SHA-384'
        },
        'ES512': {
            name: 'ECDSA',
            namedCurve: 'P-521',
            hash: 'SHA-512'
        }
    };

    // 公钥缓存
    const publicKeyCache = new Map();

    /**
     * 将 Base64 字符串转换为 ArrayBuffer
     * @param {string} base64 - Base64 编码的字符串
     * @returns {ArrayBuffer} 解码后的 ArrayBuffer
     */
    function base64ToArrayBuffer(base64) {
        const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * 将 ArrayBuffer 转换为 Base64 字符串
     * @param {ArrayBuffer} buffer - 要编码的 ArrayBuffer
     * @returns {string} Base64 编码的字符串
     */
    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * 将字符串转换为 ArrayBuffer
     * @param {string} str - 要转换的字符串
     * @returns {ArrayBuffer} 转换后的 ArrayBuffer
     */
    function stringToArrayBuffer(str) {
        const encoder = new TextEncoder();
        return encoder.encode(str);
    }

    /**
     * 解析 PEM 格式的公钥
     * @param {string} pem - PEM 格式的公钥字符串
     * @returns {Object} 包含公钥数据和类型的对象
     */
    function parsePublicKeyPEM(pem) {
        const lines = pem.split('\n');
        let keyType = null;
        let base64 = '';

        for (const line of lines) {
            if (line.includes('BEGIN PUBLIC KEY')) {
                keyType = 'spki';
            } else if (line.includes('BEGIN RSA PUBLIC KEY')) {
                keyType = 'pkcs1';
            } else if (!line.includes('BEGIN') && !line.includes('END') && line.trim()) {
                base64 += line.trim();
            }
        }

        if (!keyType || !base64) {
            throw new Error('无效的 PEM 公钥格式');
        }

        return {
            keyType,
            data: base64ToArrayBuffer(base64)
        };
    }

    /**
     * 解析 JWK (JSON Web Key) 格式的公钥
     * @param {Object} jwk - JWK 格式的公钥对象
     * @returns {Object} 包含公钥数据和类型的对象
     */
    function parsePublicKeyJWK(jwk) {
        return {
            keyType: 'jwk',
            data: jwk
        };
    }

    /**
     * 导入公钥
     * @param {string|Object} keyData - 公钥数据 (PEM字符串、JWK对象或Base64字符串)
     * @param {string} algorithm - 使用的签名算法 (如 'RS256', 'ES256')
     * @param {string} [keyId] - 公钥ID，用于缓存
     * @returns {Promise<CryptoKey>} 导入的 CryptoKey 对象
     */
    async function importPublicKey(keyData, algorithm, keyId = null) {
        const algConfig = ALGORITHMS[algorithm];
        if (!algConfig) {
            throw new Error(`不支持的签名算法: ${algorithm}`);
        }

        // 检查缓存
        if (keyId && publicKeyCache.has(keyId)) {
            return publicKeyCache.get(keyId);
        }

        let keyFormat = 'spki';
        let keyBuffer = null;
        let extractable = true;
        let keyUsages = ['verify'];

        // 解析公钥数据
        if (typeof keyData === 'string') {
            if (keyData.includes('-----BEGIN')) {
                // PEM 格式
                const parsed = parsePublicKeyPEM(keyData);
                keyFormat = parsed.keyType === 'pkcs1' ? 'pkcs1' : 'spki';
                keyBuffer = parsed.data;
            } else {
                // 假设是 Base64 编码的 SPKI 格式
                keyFormat = 'spki';
                keyBuffer = base64ToArrayBuffer(keyData);
            }
        } else if (typeof keyData === 'object' && keyData.kty) {
            // JWK 格式
            keyFormat = 'jwk';
            keyBuffer = keyData;
        } else {
            throw new Error('不支持的公钥格式');
        }

        // 导入公钥
        const cryptoKey = await crypto.subtle.importKey(
            keyFormat,
            keyBuffer,
            algConfig,
            extractable,
            keyUsages
        );

        // 缓存公钥
        if (keyId) {
            publicKeyCache.set(keyId, cryptoKey);
        }

        return cryptoKey;
    }

    /**
     * 验证签名
     * @param {CryptoKey} publicKey - 公钥 CryptoKey 对象
     * @param {string} algorithm - 使用的签名算法
     * @param {string} data - 原始数据字符串
     * @param {string} signature - Base64 编码的签名
     * @returns {Promise<boolean>} 签名是否有效
     */
    async function verifySignature(publicKey, algorithm, data, signature) {
        const algConfig = ALGORITHMS[algorithm];
        if (!algConfig) {
            throw new Error(`不支持的签名算法: ${algorithm}`);
        }

        const dataBuffer = stringToArrayBuffer(data);
        const signatureBuffer = base64ToArrayBuffer(signature);

        let verifyParams = {
            name: algConfig.name
        };

        // 根据算法设置额外参数
        if (algConfig.name === 'RSA-PSS') {
            verifyParams.saltLength = algConfig.saltLength;
        } else if (algConfig.name === 'ECDSA') {
            verifyParams.hash = algConfig.hash;
        }

        try {
            const isValid = await crypto.subtle.verify(
                verifyParams,
                publicKey,
                signatureBuffer,
                dataBuffer
            );
            return isValid;
        } catch (error) {
            console.error('签名验证失败:', error);
            return false;
        }
    }

    /**
     * 验证 JWT 格式的凭证
     * @param {string} token - JWT 格式的凭证字符串
     * @param {Object} publicKeys - 公钥对象集合，格式为 { kid: { key, algorithm } }
     * @returns {Promise<Object>} 验证结果，包含 isValid 和 payload
     */
    async function verifyJWT(token, publicKeys) {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return {
                isValid: false,
                error: '无效的 JWT 格式',
                payload: null
            };
        }

        try {
            // 解析头部
            const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
            const algorithm = header.alg;
            const keyId = header.kid;

            // 检查公钥是否可用
            if (!publicKeys[keyId] && !publicKeys['default']) {
                return {
                    isValid: false,
                    error: `未找到对应的公钥 (kid: ${keyId || 'default'})`,
                    payload: null
                };
            }

            const keyConfig = publicKeys[keyId] || publicKeys['default'];
            const publicKey = await importPublicKey(
                keyConfig.key,
                keyConfig.algorithm || algorithm,
                keyId
            );

            // 验证签名
            const dataToSign = `${parts[0]}.${parts[1]}`;
            const signature = parts[2];

            const isValid = await verifySignature(
                publicKey,
                keyConfig.algorithm || algorithm,
                dataToSign,
                signature
            );

            // 解析 payload
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

            return {
                isValid,
                error: isValid ? null : '签名验证失败',
                payload
            };
        } catch (error) {
            return {
                isValid: false,
                error: `JWT 解析失败: ${error.message}`,
                payload: null
            };
        }
    }

    /**
     * 计算数据的 SHA-256 哈希值
     * @param {string} data - 要哈希的数据
     * @returns {Promise<string>} Base64 编码的哈希值
     */
    async function sha256(data) {
        const buffer = stringToArrayBuffer(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return arrayBufferToBase64(hashBuffer);
    }

    /**
     * 生成随机的凭证ID
     * @param {number} length - ID 长度 (默认 32)
     * @returns {string} 随机生成的凭证ID
     */
    function generateCredentialId(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        return result;
    }

    /**
     * 清除公钥缓存
     */
    function clearCache() {
        publicKeyCache.clear();
    }

    /**
     * 检查 WebCrypto API 是否可用
     * @returns {boolean} WebCrypto API 是否可用
     */
    function isAvailable() {
        return typeof crypto !== 'undefined' && 
               typeof crypto.subtle !== 'undefined' &&
               typeof TextEncoder !== 'undefined';
    }

    // 公开 API
    return {
        // 常量
        ALGORITHMS,

        // 核心功能
        importPublicKey,
        verifySignature,
        verifyJWT,
        sha256,

        // 工具函数
        base64ToArrayBuffer,
        arrayBufferToBase64,
        stringToArrayBuffer,
        generateCredentialId,

        // 缓存管理
        clearCache,

        // 兼容性检查
        isAvailable,

        // 解析函数
        parsePublicKeyPEM,
        parsePublicKeyJWK
    };
})();

// 导出到全局命名空间 (供其他模块使用)
window.CryptoAdapter = CryptoAdapter;
