package com.account.freeze.dto;

import lombok.Data;

@Data
public class BatchItemPreview {

    private String accountNo;

    private String accountName;

    private String phone;

    private String estimatedResult;

    private String estimatedReason;

    private Boolean alreadyFrozen;

    private Boolean evidenceComplete;
}
