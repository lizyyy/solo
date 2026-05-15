package com.metadata.repair.dto;

import javax.validation.constraints.NotBlank;

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

    public String getFileId() { return fileId; }
    public void setFileId(String fileId) { this.fileId = fileId; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getFileType() { return fileType; }
    public void setFileType(String fileType) { this.fileType = fileType; }
    public Long getFileSize() { return fileSize; }
    public void setFileSize(Long fileSize) { this.fileSize = fileSize; }
    public String getBusinessNo() { return businessNo; }
    public void setBusinessNo(String businessNo) { this.businessNo = businessNo; }
    public String getSourceSystem() { return sourceSystem; }
    public void setSourceSystem(String sourceSystem) { this.sourceSystem = sourceSystem; }
    public String getPermissionLevel() { return permissionLevel; }
    public void setPermissionLevel(String permissionLevel) { this.permissionLevel = permissionLevel; }
    public String getUploader() { return uploader; }
    public void setUploader(String uploader) { this.uploader = uploader; }
    public String getUploadTime() { return uploadTime; }
    public void setUploadTime(String uploadTime) { this.uploadTime = uploadTime; }
}
