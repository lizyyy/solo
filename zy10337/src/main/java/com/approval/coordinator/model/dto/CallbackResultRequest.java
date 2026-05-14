package com.approval.coordinator.model.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class CallbackResultRequest {

    @NotBlank(message = "批次ID不能为空")
    private String batchId;

    private Integer chunkNumber;

    private String operator;

    @NotEmpty(message = "回调结果不能为空")
    private List<ItemCallbackResult> results;
}
