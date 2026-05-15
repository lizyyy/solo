package com.edge.config.ack.dto;

import lombok.Data;

@Data
public class ReconciliationResult {
    private String nodeCode;

    private String versionNo;

    private Integer expectedStatus;

    private Integer actualStatus;

    private Boolean isMatch;

    private String remark;
}
