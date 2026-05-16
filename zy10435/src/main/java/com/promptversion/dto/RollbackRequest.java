package com.promptversion.dto;

import com.promptversion.enums.RollbackType;
import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class RollbackRequest {
    @NotNull(message = "版本ID不能为空")
    private Long versionId;
    @NotNull(message = "回滚类型不能为空")
    private RollbackType rollbackType;
    @NotBlank(message = "操作人不能为空")
    private String operator;
    private String reason;
    private Long targetVersionId;
}