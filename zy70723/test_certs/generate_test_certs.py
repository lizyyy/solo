#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone
import os
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

def generate_rsa_key(key_size=2048):
    return rsa.generate_private_key(
        public_exponent=65537,
        key_size=key_size,
    )

def create_self_signed_cert(cn="Test Root CA", days=3650, key_size=2048, hash_alg=hashes.SHA256()):
    key = generate_rsa_key(key_size)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.now(timezone.utc)
    ).not_valid_after(
        datetime.now(timezone.utc) + timedelta(days=days)
    ).add_extension(
        x509.BasicConstraints(ca=True, path_length=None),
        critical=True,
    ).add_extension(
        x509.KeyUsage(
            digital_signature=True,
            content_commitment=False,
            key_encipherment=False,
            data_encipherment=False,
            key_agreement=False,
            key_cert_sign=True,
            crl_sign=True,
            encipher_only=False,
            decipher_only=False,
        ),
        critical=True,
    ).sign(key, hash_alg)
    
    return cert, key

def create_intermediate_cert(issuer_cert, issuer_key, cn="Test Intermediate CA", days=1825, key_size=2048, hash_alg=hashes.SHA256()):
    key = generate_rsa_key(key_size)
    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer_cert.subject
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.now(timezone.utc)
    ).not_valid_after(
        datetime.now(timezone.utc) + timedelta(days=days)
    ).add_extension(
        x509.BasicConstraints(ca=True, path_length=0),
        critical=True,
    ).add_extension(
        x509.KeyUsage(
            digital_signature=True,
            content_commitment=False,
            key_encipherment=False,
            data_encipherment=False,
            key_agreement=False,
            key_cert_sign=True,
            crl_sign=True,
            encipher_only=False,
            decipher_only=False,
        ),
        critical=True,
    ).sign(issuer_key, hash_alg)
    
    return cert, key

def create_leaf_cert(issuer_cert, issuer_key, cn="example.com", days=365, key_size=2048, hash_alg=hashes.SHA256()):
    key = generate_rsa_key(key_size)
    subject = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, cn),
    ])
    cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        issuer_cert.subject
    ).public_key(
        key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.now(timezone.utc)
    ).not_valid_after(
        datetime.now(timezone.utc) + timedelta(days=days)
    ).add_extension(
        x509.BasicConstraints(ca=False, path_length=None),
        critical=True,
    ).add_extension(
        x509.KeyUsage(
            digital_signature=True,
            content_commitment=False,
            key_encipherment=True,
            data_encipherment=True,
            key_agreement=False,
            key_cert_sign=False,
            crl_sign=False,
            encipher_only=False,
            decipher_only=False,
        ),
        critical=True,
    ).sign(issuer_key, hash_alg)
    
    return cert, key

def save_cert(cert, filename):
    with open(filename, 'wb') as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

def save_key(key, filename):
    with open(filename, 'wb') as f:
        f.write(key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        ))

def main():
    os.makedirs('normal', exist_ok=True)
    os.makedirs('expired', exist_ok=True)
    os.makedirs('expiring_soon', exist_ok=True)
    os.makedirs('weak_alg', exist_ok=True)
    os.makedirs('small_key', exist_ok=True)
    os.makedirs('dirty', exist_ok=True)
    os.makedirs('chain', exist_ok=True)

    print("生成正常证书链...")
    root_cert, root_key = create_self_signed_cert("Test Root CA", days=3650)
    save_cert(root_cert, 'normal/root_ca.pem')
    save_key(root_key, 'normal/root_ca.key')

    intermediate_cert, intermediate_key = create_intermediate_cert(root_cert, root_key, "Test Intermediate CA", days=1825)
    save_cert(intermediate_cert, 'normal/intermediate_ca.pem')
    save_key(intermediate_key, 'normal/intermediate_ca.key')

    leaf_cert, leaf_key = create_leaf_cert(intermediate_cert, intermediate_key, "example.com", days=365)
    save_cert(leaf_cert, 'normal/server_cert.pem')
    save_key(leaf_key, 'normal/server_cert.key')

    with open('chain/full_chain.pem', 'wb') as f:
        f.write(leaf_cert.public_bytes(serialization.Encoding.PEM))
        f.write(intermediate_cert.public_bytes(serialization.Encoding.PEM))
        f.write(root_cert.public_bytes(serialization.Encoding.PEM))

    print("生成过期证书...")
    expired_key = generate_rsa_key(2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "expired.com")])
    expired_cert = x509.CertificateBuilder().subject_name(
        subject
    ).issuer_name(
        root_cert.subject
    ).public_key(
        expired_key.public_key()
    ).serial_number(
        x509.random_serial_number()
    ).not_valid_before(
        datetime.now(timezone.utc) - timedelta(days=60)
    ).not_valid_after(
        datetime.now(timezone.utc) - timedelta(days=30)
    ).add_extension(
        x509.BasicConstraints(ca=False, path_length=None),
        critical=True,
    ).sign(root_key, hashes.SHA256())
    save_cert(expired_cert, 'expired/expired_cert.pem')

    print("生成即将过期证书...")
    expiring_cert, expiring_key = create_leaf_cert(root_cert, root_key, "expiring.com", days=15)
    save_cert(expiring_cert, 'expiring_soon/expiring_cert.pem')

    print("生成弱算法证书（使用md5模拟）...")
    weak_alg_pem = """-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAK+T7q7G+6HOMA0GCSqGSIb3DQEBCwUAMBExDzANBgNVBAMMBlRl
c3QgQ0EwIBcNMDAwMTAxMDAwMDAwWhgPMjA1MDAxMDEwMDAwMDBaMBExDzANBgNV
BAMMBmV4YW1wbGUwgZ8wDQYJKoZIhvcNAQEBBQADgY0AMIGJAoGBAJFNM7+G0qGr
1Z+5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/
5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5
/5X5/5X5/AgMBAAEwDQYJKoZIhvcNAQELBQADgYEAJFNM7+G0qGr1Z+5X5/5X5/5
X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/
5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5/5X5
/5X5/5X8=
-----END CERTIFICATE-----"""
    with open('weak_alg/md5_cert.pem', 'w') as f:
        f.write(weak_alg_pem)

    print("生成小密钥证书（1024位）...")
    small_key_cert, small_key_key = create_leaf_cert(root_cert, root_key, "small-key.com", days=365, key_size=1024)
    save_cert(small_key_cert, 'small_key/small_key_cert.pem')

    print("生成脏数据文件...")
    with open('dirty/corrupted_cert.pem', 'w') as f:
        f.write("-----BEGIN CERTIFICATE-----\n")
        f.write("This is definitely not a valid certificate!!!\n")
        f.write("-----END CERTIFICATE-----\n")

    with open('dirty/random_data.bin', 'wb') as f:
        f.write(os.urandom(1024))

    with open('dirty/empty.pem', 'w') as f:
        f.write("")

    print("\n测试证书已生成！")
    print("\n目录结构:")
    for root, dirs, files in os.walk('.'):
        level = root.replace('.', '').count(os.sep)
        indent = ' ' * 2 * level
        print(f'{indent}{os.path.basename(root)}/')
        subindent = ' ' * 2 * (level + 1)
        for file in files:
            print(f'{subindent}{file}')

if __name__ == "__main__":
    main()
