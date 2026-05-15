package com.identity.verification.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.util.List;

@Data
public class AdvanceRequest {

    @NotNull(message = "操作人ID不能为空")
    private String operatorId;

    private String operatorName;

    private String comments;

    @NotEmpty(message = "冲突解决方案不能为空")
    private List<ConflictResolution> resolutions;

    @Data
    public static class ConflictResolution {
        @NotNull(message = "冲突字段ID不能为空")
        private Long conflictFieldId;

        @NotNull(message = "最终值不能为空")
        private String finalValue;
    }
}
