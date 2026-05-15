package com.approval.coordinator.model.dto;

import lombok.Data;

import java.util.List;

@Data
public class ReplayRequest {

    private String batchId;

    private String operator;

    private List<String> itemIds;

    private List<Integer> chunkNumbers;

    private boolean replayAllFailed;

    private String remark;
}
