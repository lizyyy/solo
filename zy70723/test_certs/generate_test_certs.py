#!/usr/bin/env python3
from OpenSSL import crypto
from datetime import datetime, timedelta, timezone
import os

def create_self_signed_cert(cn="Test Root CA", days=3650, key_size=2048, sig_alg="sha256"):
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, key_size)
    
    cert = crypto.X509()
    cert.get_subject().CN = cn
    cert.set_serial_number(int.from_bytes(os.urandom(16), 'big'))
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(days * 86400)
    cert.set_issuer(cert.get_subject())
    cert.set_pubkey(k)
    
    cert.sign(k, sig_alg)
    return cert, k

def create_intermediate_cert(issuer_cert, issuer_key, cn="Test Intermediate CA", days=1825, key_size=2048, sig_alg="sha256"):
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, key_size)
    
    cert = crypto.X509()
    cert.get_subject().CN = cn
    cert.set_serial_number(int.from_bytes(os.urandom(16), 'big'))
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(days * 86400)
    cert.set_issuer(issuer_cert.get_subject())
    cert.set_pubkey(k)
    
    cert.sign(issuer_key, sig_alg)
    return cert, k

def create_leaf_cert(issuer_cert, issuer_key, cn="example.com", days=365, key_size=2048, sig_alg="sha256"):
    k = crypto.PKey()
    k.generate_key(crypto.TYPE_RSA, key_size)
    
    cert = crypto.X509()
    cert.get_subject().CN = cn
    cert.set_serial_number(int.from_bytes(os.urandom(16), 'big'))
    cert.gmtime_adj_notBefore(0)
    cert.gmtime_adj_notAfter(days * 86400)
    cert.set_issuer(issuer_cert.get_subject())
    cert.set_pubkey(k)
    
    cert.sign(issuer_key, sig_alg)
    return cert, k

def save_cert(cert, filename):
    with open(filename, 'wb') as f:
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, cert))

def save_key(key, filename):
    with open(filename, 'wb') as f:
        f.write(crypto.dump_privatekey(crypto.FILETYPE_PEM, key))

def main():
    os.makedirs('normal', exist_ok=True)
    os.makedirs('expired', exist_ok=True)
    os.makedirs('expiring_soon', exist_ok=True)
    os.makedirs('weak_alg', exist_ok=True)
    os.makedirs('small_key', exist_ok=True)
    os.makedirs('dirty', exist_ok=True)
    os.makedirs('chain', exist_ok=True)

    print("生成正常证书...")
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
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, leaf_cert))
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, intermediate_cert))
        f.write(crypto.dump_certificate(crypto.FILETYPE_PEM, root_cert))

    print("生成过期证书...")
    expired_cert, expired_key = create_leaf_cert(root_cert, root_key, "expired.com", days=-30)
    save_cert(expired_cert, 'expired/expired_cert.pem')

    print("生成即将过期证书...")
    expiring_cert, expiring_key = create_leaf_cert(root_cert, root_key, "expiring.com", days=15)
    save_cert(expiring_cert, 'expiring_soon/expiring_cert.pem')

    print("生成弱算法证书（SHA1）...")
    weak_alg_cert, weak_alg_key = create_leaf_cert(root_cert, root_key, "sha1-example.com", days=365, sig_alg="sha1")
    save_cert(weak_alg_cert, 'weak_alg/sha1_cert.pem')

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

    print("创建空结果目录...")
    os.makedirs('empty_dir', exist_ok=True)

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
