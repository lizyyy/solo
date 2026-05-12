"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSampleData = generateSampleData;
exports.generateFailureScenarioData = generateFailureScenarioData;
function generateSampleData() {
    const now = new Date();
    const addDays = (days) => {
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        return date.toISOString();
    };
    const certificates = [
        {
            name: 'test-api-cert-01',
            serialNumber: 'TEST-SERIAL-001',
            issuer: 'Internal CA',
            subject: 'CN=test-api.internal.com',
            notBefore: addDays(-365),
            notAfter: addDays(3),
            domains: ['test-api.internal.com', 'test-api-v2.internal.com'],
            environment: 'test',
            rollbackPackageId: 'ROLLBACK-TEST-001'
        },
        {
            name: 'test-web-cert-01',
            serialNumber: 'TEST-SERIAL-002',
            issuer: 'Internal CA',
            subject: 'CN=test-web.internal.com',
            notBefore: addDays(-300),
            notAfter: addDays(15),
            domains: ['test-web.internal.com'],
            environment: 'test'
        },
        {
            name: 'preprod-gateway-cert-01',
            serialNumber: 'PREPROD-SERIAL-001',
            issuer: 'Internal CA',
            subject: 'CN=preprod-gateway.internal.com',
            notBefore: addDays(-360),
            notAfter: addDays(5),
            domains: ['preprod-gateway.internal.com', 'preprod-api.internal.com'],
            environment: 'preprod',
            rollbackPackageId: 'ROLLBACK-PREPROD-001'
        },
        {
            name: 'preprod-auth-cert-01',
            serialNumber: 'PREPROD-SERIAL-002',
            issuer: 'Internal CA',
            subject: 'CN=preprod-auth.internal.com',
            notBefore: addDays(-200),
            notAfter: addDays(25),
            domains: ['preprod-auth.internal.com'],
            environment: 'preprod'
        },
        {
            name: 'prod-api-cert-01',
            serialNumber: 'PROD-SERIAL-001',
            issuer: 'Internal CA',
            subject: 'CN=api.example.com',
            notBefore: addDays(-350),
            notAfter: addDays(2),
            domains: ['api.example.com', 'api-v2.example.com', 'api-staging.example.com'],
            environment: 'production',
            rollbackPackageId: 'ROLLBACK-PROD-001'
        },
        {
            name: 'prod-web-cert-01',
            serialNumber: 'PROD-SERIAL-002',
            issuer: 'Internal CA',
            subject: 'CN=www.example.com',
            notBefore: addDays(-180),
            notAfter: addDays(180),
            domains: ['www.example.com', 'example.com'],
            environment: 'production'
        },
        {
            name: 'prod-payment-cert-01',
            serialNumber: 'PROD-SERIAL-003',
            issuer: 'Internal CA',
            subject: 'CN=payment.example.com',
            notBefore: addDays(-340),
            notAfter: addDays(10),
            domains: ['payment.example.com'],
            environment: 'production',
            rollbackPackageId: 'ROLLBACK-PROD-003'
        }
    ];
    const domains = [
        {
            name: 'test-api.internal.com',
            certificateId: '',
            environment: 'test',
            serviceNames: ['test-api-service', 'test-gateway'],
            isPrimary: true
        },
        {
            name: 'test-api-v2.internal.com',
            certificateId: '',
            environment: 'test',
            serviceNames: ['test-api-service-v2'],
            isPrimary: false
        },
        {
            name: 'test-web.internal.com',
            certificateId: '',
            environment: 'test',
            serviceNames: ['test-web-service'],
            isPrimary: true
        },
        {
            name: 'preprod-gateway.internal.com',
            certificateId: '',
            environment: 'preprod',
            serviceNames: ['preprod-gateway', 'preprod-loadbalancer'],
            isPrimary: true
        },
        {
            name: 'preprod-api.internal.com',
            certificateId: '',
            environment: 'preprod',
            serviceNames: ['preprod-api-service'],
            isPrimary: false
        },
        {
            name: 'preprod-auth.internal.com',
            certificateId: '',
            environment: 'preprod',
            serviceNames: ['preprod-auth-service', 'preprod-sso'],
            isPrimary: true
        },
        {
            name: 'api.example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-api-service', 'prod-gateway', 'prod-rate-limiter'],
            isPrimary: true
        },
        {
            name: 'api-v2.example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-api-service-v2'],
            isPrimary: false
        },
        {
            name: 'api-staging.example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-api-staging'],
            isPrimary: false
        },
        {
            name: 'www.example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-web-service', 'prod-cdn'],
            isPrimary: true
        },
        {
            name: 'example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-web-service'],
            isPrimary: false
        },
        {
            name: 'payment.example.com',
            certificateId: '',
            environment: 'production',
            serviceNames: ['prod-payment-service', 'prod-transaction-processor'],
            isPrimary: true
        }
    ];
    const dependencies = [
        {
            serviceName: 'test-api-service',
            dependsOn: ['test-db', 'test-cache'],
            isCritical: false,
            environment: 'test',
            status: 'acknowledged'
        },
        {
            serviceName: 'test-gateway',
            dependsOn: ['test-api-service'],
            isCritical: false,
            environment: 'test',
            status: 'acknowledged'
        },
        {
            serviceName: 'preprod-gateway',
            dependsOn: ['preprod-api-service', 'preprod-auth-service'],
            isCritical: true,
            environment: 'preprod',
            status: 'notified',
            lastNotifiedAt: addDays(-1),
            acknowledgementDeadline: addDays(2)
        },
        {
            serviceName: 'preprod-api-service',
            dependsOn: ['preprod-db', 'preprod-cache'],
            isCritical: true,
            environment: 'preprod',
            status: 'pending_notification'
        },
        {
            serviceName: 'preprod-auth-service',
            dependsOn: ['preprod-ldap'],
            isCritical: true,
            environment: 'preprod',
            status: 'acknowledged'
        },
        {
            serviceName: 'prod-gateway',
            dependsOn: ['prod-api-service', 'prod-auth-service'],
            isCritical: true,
            environment: 'production',
            status: 'pending_notification'
        },
        {
            serviceName: 'prod-api-service',
            dependsOn: ['prod-db', 'prod-cache', 'prod-search'],
            isCritical: true,
            environment: 'production',
            status: 'pending_notification'
        },
        {
            serviceName: 'prod-payment-service',
            dependsOn: ['prod-db', 'prod-bank-gateway'],
            isCritical: true,
            environment: 'production',
            status: 'acknowledged'
        },
        {
            serviceName: 'prod-transaction-processor',
            dependsOn: ['prod-payment-service', 'prod-queue'],
            isCritical: true,
            environment: 'production',
            status: 'pending_notification'
        },
        {
            serviceName: 'prod-web-service',
            dependsOn: ['prod-api-service', 'prod-cdn'],
            isCritical: true,
            environment: 'production',
            status: 'acknowledged'
        }
    ];
    const windows = [
        {
            name: 'test-weekly-maintenance',
            environment: 'test',
            startTime: addDays(1),
            endTime: addDays(1.1),
            affectedServices: ['test-api-service', 'test-gateway'],
            affectedCertificates: []
        },
        {
            name: 'preprod-cert-rotation-2024',
            environment: 'preprod',
            startTime: addDays(3),
            endTime: addDays(3.08),
            affectedServices: ['preprod-gateway', 'preprod-api-service'],
            affectedCertificates: []
        },
        {
            name: 'prod-api-cert-rotation',
            environment: 'production',
            startTime: addDays(1),
            endTime: addDays(1.04),
            affectedServices: ['prod-api-service', 'prod-gateway'],
            affectedCertificates: []
        }
    ];
    return {
        certificates,
        domains,
        dependencies,
        windows
    };
}
function generateFailureScenarioData() {
    const now = new Date();
    const addDays = (days) => {
        const date = new Date(now);
        date.setDate(date.getDate() + days);
        return date.toISOString();
    };
    return {
        certificates: [
            {
                name: 'prod-critical-cert-fail',
                serialNumber: 'PROD-FAIL-SERIAL-001',
                issuer: 'Internal CA',
                subject: 'CN=critical-fail.example.com',
                notBefore: addDays(-365),
                notAfter: addDays(1),
                domains: ['critical-fail.example.com'],
                environment: 'production'
            }
        ],
        domains: [
            {
                name: 'critical-fail.example.com',
                certificateId: '',
                environment: 'production',
                serviceNames: ['prod-critical-service'],
                isPrimary: true
            }
        ],
        dependencies: [
            {
                serviceName: 'prod-critical-service',
                dependsOn: ['prod-core-db', 'prod-core-cache'],
                isCritical: true,
                environment: 'production',
                status: 'pending_notification'
            }
        ],
        windows: []
    };
}
