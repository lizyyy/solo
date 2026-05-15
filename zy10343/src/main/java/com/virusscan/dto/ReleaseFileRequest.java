package com.virusscan.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ReleaseFileRequest {
    @NotBlank(message = "文件ID不能为空")
    private String fileId;

    @NotBlank(message = "隔离区ID不能为空")
    private String quarantineId;

    @NotBlank(message = "放行原因不能为空")
    private String releaseReason;

    @NotBlank(message = "操作人不能为空")
    private String releasedBy;

    private String approverSignature;
}