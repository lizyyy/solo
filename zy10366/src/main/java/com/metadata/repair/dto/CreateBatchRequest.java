package com.metadata.repair.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import lombok.Data;
import java.util.List;

@Data
public class CreateBatchRequest {
    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    private String batchName;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String description;

    @NotEmpty(message = "附件列表不能为空")
    private List<AttachmentDTO> attachments;
}
