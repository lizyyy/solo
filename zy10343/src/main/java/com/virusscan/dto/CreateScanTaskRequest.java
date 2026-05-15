package com.virusscan.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Size;
import lombok.Data;
import org.hibernate.validator.constraints.Range;

@Data
public class CreateScanTaskRequest {
    @NotBlank(message = "文件ID不能为空")
    @Size(max = 64, message = "文件ID长度不能超过64")
    private String fileId;

    @NotBlank(message = "文件名不能为空")
    @Size(max = 255, message = "文件名长度不能超过255")
    private String fileName;

    private Long fileSize;

    @NotBlank(message = "文件哈希不能为空")
    @Size(max = 64, message = "文件哈希长度不能超过64")
    private String fileHash;

    private String contentType;

    private String filePath;

    private String uploadedBy;

    private String sourceSystem;

    @Size(max = 64, message = "请求ID长度不能超过64")
    private String requestId;

    private String requestedBy;

    private String callbackUrl;

    @Range(min = 1, max = 10, message = "最大重试次数在1-10之间")
    private Integer maxRetry = 3;
}