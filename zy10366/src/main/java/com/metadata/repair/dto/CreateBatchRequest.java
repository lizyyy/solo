package com.metadata.repair.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import java.util.List;

public class CreateBatchRequest {
    @NotBlank(message = "批次号不能为空")
    private String batchNo;
    private String batchName;
    @NotBlank(message = "操作人不能为空")
    private String operator;
    private String description;
    @NotEmpty(message = "附件列表不能为空")
    private List<AttachmentDTO> attachments;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getBatchName() { return batchName; }
    public void setBatchName(String batchName) { this.batchName = batchName; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<AttachmentDTO> getAttachments() { return attachments; }
    public void setAttachments(List<AttachmentDTO> attachments) { this.attachments = attachments; }
}
