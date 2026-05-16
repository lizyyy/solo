package com.statuspage.dto;

import com.statuspage.model.IncidentStatus;
import com.statuspage.model.ServiceStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateAnnouncementRequest {
    @NotBlank(message = "标题不能为空")
    private String title;

    @NotBlank(message = "内容不能为空")
    private String content;

    @NotNull(message = "服务状态不能为空")
    private ServiceStatus serviceStatus;

    private IncidentStatus incidentStatus;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    private Boolean publishImmediately = false;
}