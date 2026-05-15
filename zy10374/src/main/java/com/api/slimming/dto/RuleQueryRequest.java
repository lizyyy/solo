package com.api.slimming.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RuleQueryRequest {

    private String ruleNo;

    private String apiPath;

    private String sceneCode;

    private Integer status;

    private String createdBy;

    private LocalDateTime createTimeStart;

    private LocalDateTime createTimeEnd;

    private Integer pageNum = 1;

    private Integer pageSize = 20;
}
