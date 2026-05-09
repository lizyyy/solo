package com.paymentguard.idempotency.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class IdempotencyRecord implements Serializable {
    private String idempotencyKey;
    private String status;
    private String traceId;
    private String result;
    private String errorMessage;
    private Long createdAt;
    private Long completedAt;
}
