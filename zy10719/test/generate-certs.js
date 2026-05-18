const forge = require('node-forge');
const fs = require('fs');
const path = require('path');

function generateCertificate(commonName, sans = [], daysValid = 365, isWildcard = false) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Math.random().toString(16).substr(2, 14).toUpperCase();
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + daysValid);
  
  const attrs = [
    {
      name: 'commonName',
      value: isWildcard ? `*.${commonName}` : commonName
    },
    {
      name: 'countryName',
      value: 'CN'
    },
    {
      shortName: 'ST',
      value: 'Beijing'
    },
    {
      name: 'localityName',
      value: 'Beijing'
    },
    {
      name: 'organizationName',
      value: 'Test Org'
    }
  ];
  
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  
  const altNames = sans.map(san => ({
    type: 2,
    value: san
  }));
  
  cert.setExtensions([
    {
      name: 'basicConstraints',
      cA: false
    },
    {
      name: 'keyUsage',
      digitalSignature: true,
      keyEncipherment: true
    },
    {
      name: 'extKeyUsage',
      serverAuth: true
    },
    {
      name: 'subjectAltName',
      altNames: altNames
    }
  ]);
  
  cert.sign(keys.privateKey, forge.md.sha256.create());
  
  return {
    cert: forge.pki.certificateToPem(cert),
    key: forge.pki.privateKeyToPem(keys.privateKey),
    fingerprint: forge.md.sha256.create().update(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes()).digest().toHex().match(/.{2}/g).join(':'),
    serialNumber: cert.serialNumber
  };
}

const certsDir = path.join(__dirname, 'certs');
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

console.log('生成测试证书...\n');

const cert1 = generateCertificate('api.example.com', ['api.example.com', 'app.example.com'], 365);
fs.writeFileSync(path.join(certsDir, 'api-example-com.pem'), cert1.cert);
console.log(`✅ 生成: api-example-com.pem`);
console.log(`   指纹: ${cert1.fingerprint}`);
console.log(`   序列号: ${cert1.serialNumber}`);
console.log('');

const cert2 = generateCertificate('example.com', ['*.example.com'], 180, true);
fs.writeFileSync(path.join(certsDir, 'wildcard-example-com.pem'), cert2.cert);
console.log(`✅ 生成: wildcard-example-com.pem (通配符证书)`);
console.log(`   指纹: ${cert2.fingerprint}`);
console.log(`   序列号: ${cert2.serialNumber}`);
console.log('');

const cert3 = generateCertificate('cdn.example.com', ['cdn.example.com', 'static.example.com'], 10);
fs.writeFileSync(path.join(certsDir, 'cdn-example-com-expiring.pem'), cert3.cert);
console.log(`✅ 生成: cdn-example-com-expiring.pem (即将过期，10天后)`);
console.log(`   指纹: ${cert3.fingerprint}`);
console.log(`   序列号: ${cert3.serialNumber}`);
console.log('');

const cert4 = generateCertificate('legacy.example.com', ['legacy.example.com'], -30);
fs.writeFileSync(path.join(certsDir, 'legacy-example-com-expired.pem'), cert4.cert);
console.log(`✅ 生成: legacy-example-com-expired.pem (已过期)`);
console.log(`   指纹: ${cert4.fingerprint}`);
console.log(`   序列号: ${cert4.serialNumber}`);
console.log('');

const cert5 = generateCertificate('incomplete-chain.com', ['incomplete-chain.com'], 365);
fs.writeFileSync(path.join(certsDir, 'incomplete-chain.pem'), cert5.cert);
console.log(`✅ 生成: incomplete-chain.pem (证书链不完整)`);
console.log('');

console.log('证书生成完成！');
console.log('\n📝 请更新 test/nodes.json 中的指纹和序列号以匹配上述输出');
