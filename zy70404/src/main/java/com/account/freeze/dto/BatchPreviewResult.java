package com.account.freeze.dto;

import lombok.Data;

import java.util.List;

@Data
public class BatchPreviewResult {

    private String batchNo;

    private String batchName;

    private Integer totalCount;

    private Integer estimatedSuccess;

    private Integer estimatedFail;

    private Integer ruleVersion;

    private String ruleDesc;

    private List<BatchItemPreview> items;

    private String duplicateTip;

    private Long existingBatchId;

    private String existingBatchNo;
}
