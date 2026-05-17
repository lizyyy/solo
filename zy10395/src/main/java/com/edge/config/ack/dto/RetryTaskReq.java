package com.edge.config.ack.dto;

import lombok.Data;

@Data
public class RetryTaskReq {
    private String taskNo;
    private String operator;
}
