package com.privacy.replay.dto;

import com.privacy.replay.model.MaskingLevel;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class CreateReplayRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "申请人ID不能为空")
    private String requesterId;

    @NotBlank(message = "用途不能为空")
    private String purpose;

    private String description;

    @NotEmpty(message = "样本ID列表不能为空")
    private List<String> sampleIds;

    @NotNull(message = "脱敏级别不能为空")
    private MaskingLevel maskingLevel;
}
