package com.metadata.repair.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AttachmentDTO {
    @NotBlank(message = "文件ID不能为空")
    private String fileId;

    private String fileName;

    private String fileType;

    private Long fileSize;

    private String businessNo;

    private String sourceSystem;

    private String permissionLevel;

    private String uploader;

    private String uploadTime;
}
