package com.approval.coordinator.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ReplayRequest {

    @NotBlank(message = "批次ID不能为空")
    private String batchId;

    private String operator;

    private List<String> itemIds;

    private List<Integer> chunkNumbers;

    private boolean replayAllFailed;

    private String remark;
}
