package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AllocationReceiveRequest {
    @NotNull(message = "签收人不能为空")
    private String receiver;

    private String receiptEvidence;
}
