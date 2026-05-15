package com.api.slimming.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class HistoryQueryRequest {

    private Long ruleId;

    private String ruleNo;

    private Integer operationType;

    private String operator;

    private LocalDateTime createTimeStart;

    private LocalDateTime createTimeEnd;

    private Integer pageNum = 1;

    private Integer pageSize = 20;
}
