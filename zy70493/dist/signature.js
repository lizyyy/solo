"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateFileChecksum = calculateFileChecksum;
exports.calculateDirectoryChecksum = calculateDirectoryChecksum;
exports.signData = signData;
exports.signArtifact = signArtifact;
exports.verifySignature = verifySignature;
exports.generateKeyPair = generateKeyPair;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
function calculateFileChecksum(filePath, algorithm = 'sha256') {
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
    }
    const fileBuffer = fs_1.default.readFileSync(filePath);
    const hashSum = crypto_1.default.createHash(algorithm);
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
function calculateDirectoryChecksum(dirPath, algorithm = 'sha256') {
    if (!fs_1.default.existsSync(dirPath)) {
        throw new Error(`目录不存在: ${dirPath}`);
    }
    const hashSum = crypto_1.default.createHash(algorithm);
    const files = getAllFiles(dirPath);
    files.sort().forEach(file => {
        const relativePath = path_1.default.relative(dirPath, file);
        hashSum.update(relativePath);
        const fileBuffer = fs_1.default.readFileSync(file);
        hashSum.update(fileBuffer);
    });
    return hashSum.digest('hex');
}
function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs_1.default.readdirSync(dirPath);
    files.forEach(file => {
        const fullPath = path_1.default.join(dirPath, file);
        if (fs_1.default.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        }
        else {
            arrayOfFiles.push(fullPath);
        }
    });
    return arrayOfFiles;
}
function signData(data, privateKey) {
    if (privateKey && fs_1.default.existsSync(privateKey)) {
        const key = fs_1.default.readFileSync(privateKey, 'utf8');
        const sign = crypto_1.default.createSign('RSA-SHA256');
        sign.update(data);
        return sign.sign(key, 'base64');
    }
    else {
        const hmac = crypto_1.default.createHmac('sha256', 'audit-sign-tool-default-secret-key');
        hmac.update(data);
        return hmac.digest('base64');
    }
}
async function signArtifact(artifactPath, options) {
    const isDirectory = fs_1.default.existsSync(artifactPath) && fs_1.default.statSync(artifactPath).isDirectory();
    const checksum = isDirectory
        ? calculateDirectoryChecksum(artifactPath)
        : calculateFileChecksum(artifactPath);
    const artifactName = path_1.default.basename(artifactPath);
    const buildDate = new Date().toISOString();
    const signatureData = `${checksum}:${artifactName}:${options.version}:${options.buildNumber}:${buildDate}`;
    const signature = signData(signatureData, options.privateKey);
    const artifact = {
        artifactName,
        version: options.version,
        buildNumber: options.buildNumber,
        checksum,
        signature,
        signer: options.signer,
        signedAt: new Date().toISOString(),
        buildDate,
        commitHash: options.commitHash,
        branch: options.branch,
        buildAgent: options.buildAgent,
        metadata: options.metadata || {}
    };
    await (0, database_1.insertBuildArtifact)(artifact);
    return {
        ...artifact,
        id: await (0, database_1.insertBuildArtifact)(artifact)
    };
}
function verifySignature(checksum, signature, artifactName, version, buildNumber, buildDate, publicKey) {
    const signatureData = `${checksum}:${artifactName}:${version}:${buildNumber}:${buildDate}`;
    if (publicKey && fs_1.default.existsSync(publicKey)) {
        const key = fs_1.default.readFileSync(publicKey, 'utf8');
        const verify = crypto_1.default.createVerify('RSA-SHA256');
        verify.update(signatureData);
        return verify.verify(key, signature, 'base64');
    }
    else {
        const hmac = crypto_1.default.createHmac('sha256', 'audit-sign-tool-default-secret-key');
        hmac.update(signatureData);
        const expectedSignature = hmac.digest('base64');
        return signature === expectedSignature;
    }
}
function generateKeyPair(outputDir) {
    if (!fs_1.default.existsSync(outputDir)) {
        fs_1.default.mkdirSync(outputDir, { recursive: true });
    }
    const { publicKey, privateKey } = crypto_1.default.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });
    fs_1.default.writeFileSync(path_1.default.join(outputDir, 'public.pem'), publicKey);
    fs_1.default.writeFileSync(path_1.default.join(outputDir, 'private.pem'), privateKey);
}
