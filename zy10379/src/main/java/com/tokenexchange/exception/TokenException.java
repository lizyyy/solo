package com.tokenexchange.exception;

public class TokenException extends RuntimeException {
    private int code;
    private String requestId;

    public TokenException(String message) {
        super(message);
        this.code = 400;
    }

    public TokenException(int code, String message) {
        super(message);
        this.code = code;
    }

    public TokenException(int code, String message, String requestId) {
        super(message);
        this.code = code;
        this.requestId = requestId;
    }

    public int getCode() {
        return code;
    }

    public String getRequestId() {
        return requestId;
    }

    public static TokenException invalidToken(String requestId) {
        return new TokenException(401, "无效的令牌", requestId);
    }

    public static TokenException expiredToken(String requestId) {
        return new TokenException(401, "令牌已过期", requestId);
    }

    public static TokenException revokedToken(String requestId) {
        return new TokenException(401, "令牌已撤销", requestId);
    }

    public static TokenException exhaustedToken(String requestId) {
        return new TokenException(401, "令牌使用次数已耗尽", requestId);
    }

    public static TokenException insufficientScope(String requestId) {
        return new TokenException(403, "权限范围不足", requestId);
    }

    public static TokenException serviceNotFound(String serviceId, String requestId) {
        return new TokenException(404, "服务不存在: " + serviceId, requestId);
    }

    public static TokenException scenarioNotFound(String scenarioCode, String requestId) {
        return new TokenException(404, "交换场景不存在: " + scenarioCode, requestId);
    }

    public static TokenException serviceDisabled(String serviceId, String requestId) {
        return new TokenException(403, "服务已禁用: " + serviceId, requestId);
    }
}
