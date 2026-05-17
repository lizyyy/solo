"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseHeaderChain = parseHeaderChain;
exports.parseRequestSamples = parseRequestSamples;
function parseHeaderChain(headers) {
    const anomalies = [];
    const chain = {
        xForwardedFor: [],
        xForwardedProto: [],
        xForwardedHost: [],
        xForwardedPort: []
    };
    const xff = headers['x-forwarded-for'] || headers['X-Forwarded-For'];
    if (xff) {
        chain.xForwardedFor = xff.split(',').map(ip => ip.trim()).filter(ip => ip);
        chain.xForwardedFor.forEach((ip, index) => {
            if (!isValidIp(ip)) {
                anomalies.push({
                    type: 'invalid_format',
                    header: 'X-Forwarded-For',
                    message: `第 ${index + 1} 个IP格式无效: ${ip}`,
                    severity: 'high'
                });
            }
        });
    }
    const xfp = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'];
    if (xfp) {
        chain.xForwardedProto = xfp.split(',').map(p => p.trim()).filter(p => p);
        chain.xForwardedProto.forEach((proto, index) => {
            if (!isValidProtocol(proto)) {
                anomalies.push({
                    type: 'invalid_format',
                    header: 'X-Forwarded-Proto',
                    message: `第 ${index + 1} 个协议无效: ${proto}`,
                    severity: 'medium'
                });
            }
        });
    }
    const xfh = headers['x-forwarded-host'] || headers['X-Forwarded-Host'];
    if (xfh) {
        chain.xForwardedHost = xfh.split(',').map(h => h.trim()).filter(h => h);
    }
    const xfport = headers['x-forwarded-port'] || headers['X-Forwarded-Port'];
    if (xfport) {
        chain.xForwardedPort = xfport.split(',').map(p => p.trim()).filter(p => p);
        chain.xForwardedPort.forEach((port, index) => {
            if (!isValidPort(port)) {
                anomalies.push({
                    type: 'invalid_format',
                    header: 'X-Forwarded-Port',
                    message: `第 ${index + 1} 个端口无效: ${port}`,
                    severity: 'medium'
                });
            }
        });
    }
    return { chain, anomalies };
}
function isValidIp(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^[0-9a-fA-F:]+$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'unknown';
}
function isValidProtocol(proto) {
    const validProtos = ['http', 'https', 'ws', 'wss'];
    return validProtos.includes(proto.toLowerCase());
}
function isValidPort(port) {
    const num = parseInt(port, 10);
    return !isNaN(num) && num >= 1 && num <= 65535;
}
function parseRequestSamples(input) {
    const lines = input.split('\n');
    const samples = [];
    const badLines = [];
    lines.forEach((line, index) => {
        const lineNumber = index + 1;
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        try {
            const data = JSON.parse(trimmed);
            if (!data.headers || typeof data.headers !== 'object') {
                badLines.push({ line: trimmed, lineNumber, reason: '缺少 headers 字段或格式错误' });
                return;
            }
            samples.push({
                id: `sample-${lineNumber}`,
                lineNumber,
                raw: trimmed,
                headers: data.headers,
                expectedProtocol: data.expectedProtocol,
                expectedIp: data.expectedIp
            });
        }
        catch (e) {
            badLines.push({ line: trimmed, lineNumber, reason: 'JSON 解析失败' });
        }
    });
    return { samples, badLines };
}
