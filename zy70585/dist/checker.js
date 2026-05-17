"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkRequestSample = checkRequestSample;
exports.checkAllSamples = checkAllSamples;
const headerParser_1 = require("./headerParser");
function checkRequestSample(sample, config) {
    const { chain, anomalies: formatAnomalies } = (0, headerParser_1.parseHeaderChain)(sample.headers);
    const anomalies = [...formatAnomalies];
    const { realIp, trustedProxyCount } = calculateRealIp(chain, config);
    const realProtocol = calculateRealProtocol(chain, config);
    if (sample.expectedIp && realIp !== sample.expectedIp) {
        anomalies.push({
            type: 'ip_mismatch',
            header: 'X-Forwarded-For',
            message: `IP不匹配: 期望 ${sample.expectedIp}, 实际 ${realIp}`,
            severity: 'high'
        });
    }
    if (sample.expectedProtocol && realProtocol !== sample.expectedProtocol) {
        anomalies.push({
            type: 'protocol_mismatch',
            header: 'X-Forwarded-Proto',
            message: `协议不匹配: 期望 ${sample.expectedProtocol}, 实际 ${realProtocol}`,
            severity: 'high'
        });
    }
    const suspiciousAnomalies = checkSuspiciousHeaders(sample.headers, config);
    anomalies.push(...suspiciousAnomalies);
    return {
        sample,
        headerChain: chain,
        realIp,
        realProtocol,
        anomalies,
        isNormal: anomalies.length === 0,
        trustedProxyCount
    };
}
function calculateRealIp(chain, config) {
    const ips = [...chain.xForwardedFor].reverse();
    let trustedCount = 0;
    for (let i = 0; i < ips.length; i++) {
        const ip = ips[i];
        if (config.trustedProxies.includes(ip) && trustedCount < config.trustDepth) {
            trustedCount++;
        }
        else {
            return { realIp: ip, trustedProxyCount: trustedCount };
        }
    }
    return { realIp: ips[ips.length - 1] || 'unknown', trustedProxyCount: trustedCount };
}
function calculateRealProtocol(chain, config) {
    const protos = [...chain.xForwardedProto].reverse();
    let trustedCount = 0;
    for (let i = 0; i < protos.length; i++) {
        const proto = protos[i];
        if (trustedCount < config.trustDepth) {
            trustedCount++;
        }
        else {
            return proto;
        }
    }
    return protos[protos.length - 1] || 'http';
}
function checkSuspiciousHeaders(headers, config) {
    const anomalies = [];
    const forwardedHeaders = Object.keys(headers).filter(h => h.toLowerCase().startsWith('x-forwarded-') || h.toLowerCase().startsWith('x-real-'));
    forwardedHeaders.forEach(header => {
        const value = headers[header];
        if (value.includes('"') || value.includes("'")) {
            anomalies.push({
                type: 'suspicious_header',
                header,
                message: `包含可疑字符: ${value.substring(0, 50)}`,
                severity: 'medium'
            });
        }
        if (value.length > 500) {
            anomalies.push({
                type: 'suspicious_header',
                header,
                message: `值过长 (${value.length} 字符)`,
                severity: 'medium'
            });
        }
        if (/<script|javascript:|onerror=/i.test(value)) {
            anomalies.push({
                type: 'suspicious_header',
                header,
                message: '包含潜在的XSS攻击代码',
                severity: 'high'
            });
        }
    });
    return anomalies;
}
function checkAllSamples(samples, config) {
    return samples.map(sample => checkRequestSample(sample, config));
}
