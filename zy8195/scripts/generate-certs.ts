import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

const pki = forge.pki;

interface CertInfo {
  name: string;
  sans: string[];
  days: number;
  isCa: boolean;
}

function createCertificate(
  subject: { cn: string; o: string },
  issuerPrivateKey: forge.pki.rsa.PrivateKey,
  issuerCert?: forge.pki.Certificate,
  isCa: boolean = false,
  sanDnsNames: string[] = [],
  validDays: number = 365
): { cert: forge.pki.Certificate; privateKey: forge.pki.rsa.PrivateKey } {
  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Math.floor(Math.random() * 1000000000000).toString(16).padStart(12, '0');
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validDays);

  const attrs = [
    { name: 'countryName', value: 'CN' },
    { name: 'organizationName', value: subject.o },
    { name: 'commonName', value: subject.cn },
  ];

  cert.setSubject(attrs);
  
  if (issuerCert) {
    cert.setIssuer(issuerCert.subject.attributes);
  } else {
    cert.setIssuer(attrs);
  }

  const extensions: Array<Record<string, unknown>> = [
    {
      name: 'basicConstraints',
      cA: isCa,
      critical: isCa,
    },
    {
      name: 'keyUsage',
      keyCertSign: isCa,
      digitalSignature: true,
      nonRepudiation: false,
      keyEncipherment: !isCa,
      dataEncipherment: false,
    },
  ];

  if (!isCa) {
    extensions.push({
      name: 'extKeyUsage',
      serverAuth: true,
      clientAuth: true,
    });
  }

  if (sanDnsNames.length > 0) {
    extensions.push({
      name: 'subjectAltName',
      altNames: sanDnsNames.map((name) => ({
        type: 2,
        value: name,
      })),
    });
  }

  cert.setExtensions(extensions);

  const signingKey = issuerPrivateKey || keys.privateKey;
  cert.sign(signingKey, forge.md.sha256.create());

  return { cert, privateKey: keys.privateKey };
}

async function main() {
  const certsDir = path.join(__dirname, '..', 'samples', 'certs');
  
  try {
    await fs.promises.mkdir(certsDir, { recursive: true });
  } catch {
    // 目录已存在
  }

  console.log('生成示例证书...');

  console.log('  1. 生成 Root CA (Internal CA)');
  const { cert: rootCa, privateKey: rootCaKey } = createCertificate(
    { cn: 'Example Internal Root CA', o: 'Example Inc' },
    null as unknown as forge.pki.rsa.PrivateKey,
    undefined,
    true,
    [],
    3650
  );

  await fs.promises.writeFile(
    path.join(certsDir, 'root-ca.pem'),
    pki.certificateToPem(rootCa)
  );

  console.log('  2. 生成 Intermediate CA');
  const { cert: intermediateCa, privateKey: intermediateCaKey } = createCertificate(
    { cn: 'Example Internal Intermediate CA', o: 'Example Inc' },
    rootCaKey,
    rootCa,
    true,
    [],
    1825
  );

  await fs.promises.writeFile(
    path.join(certsDir, 'intermediate-ca.pem'),
    pki.certificateToPem(intermediateCa)
  );

  console.log('  3. 生成服务证书');

  const services: CertInfo[] = [
    { name: 'api-gateway', sans: ['api.example.com', 'gateway.example.com'], days: 30, isCa: false },
    { name: 'user-service', sans: ['user.example.com'], days: 365, isCa: false },
    { name: 'order-service', sans: ['order.example.com', 'orders.example.com'], days: 60, isCa: false },
    { name: 'payment-service', sans: ['payment.example.com'], days: 400, isCa: false },
    { name: 'notification-service', sans: ['notify.example.com'], days: 20, isCa: false },
  ];

  for (const service of services) {
    console.log(`     - ${service.name}`);
    const { cert, privateKey } = createCertificate(
      { cn: service.sans[0], o: 'Example Inc' },
      intermediateCaKey,
      intermediateCa,
      service.isCa,
      service.sans,
      service.days
    );

    await fs.promises.writeFile(
      path.join(certsDir, `${service.name}.pem`),
      pki.certificateToPem(cert)
    );
    await fs.promises.writeFile(
      path.join(certsDir, `${service.name}-key.pem`),
      pki.privateKeyToPem(privateKey)
    );
  }

  console.log('  4. 生成 External Root CA (用于测试信任不匹配)');
  const { cert: extRootCa } = createCertificate(
    { cn: 'Example External Root CA', o: 'External Inc' },
    null as unknown as forge.pki.rsa.PrivateKey,
    undefined,
    true,
    [],
    3650
  );

  await fs.promises.writeFile(
    path.join(certsDir, 'external-root-ca.pem'),
    pki.certificateToPem(extRootCa)
  );

  console.log('\n✅ 证书生成完成！');
  console.log(`   证书目录: ${certsDir}`);
}

main().catch(console.error);
