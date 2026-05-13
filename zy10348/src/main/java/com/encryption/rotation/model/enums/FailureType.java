package com.encryption.rotation.model.enums;

public enum FailureType {
    ENCRYPTION_ERROR,
    DECRYPTION_ERROR,
    KEY_NOT_FOUND,
    DATA_CORRUPTION,
    TIMEOUT,
    NETWORK_ERROR,
    PERMISSION_DENIED,
    UNKNOWN_ERROR
}
