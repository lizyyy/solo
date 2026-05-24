package com.hotel.lostfound.exception;

import lombok.Getter;

@Getter
public class DuplicateRequestException extends RuntimeException {

    private final String requestId;
    private final Object existingData;

    public DuplicateRequestException(String requestId, Object existingData) {
        super("重复请求: " + requestId);
        this.requestId = requestId;
        this.existingData = existingData;
    }
}
