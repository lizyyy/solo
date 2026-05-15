package com.api.slimming.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RecordQueryRequest {

    private String requestId;

    private String ruleNo;

    private String apiPath;

    private String sceneCode;

    private Boolean success;

    private LocalDateTime requestTimeStart;

    private LocalDateTime requestTimeEnd;

    private Integer pageNum = 1;

    private Integer pageSize = 20;
}
