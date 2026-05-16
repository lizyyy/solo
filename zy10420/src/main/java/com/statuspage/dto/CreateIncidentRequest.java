package com.statuspage.dto;

import com.statuspage.model.ServiceStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateIncidentRequest {
    @NotBlank(message = "事故编号不能为空")
    private String incidentNumber;

    @NotBlank(message = "标题不能为空")
    private String title;

    private String description;

    @NotNull(message = "服务状态不能为空")
    private ServiceStatus serviceStatus;

    private String affectedServices;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    private String announcementTitle;

    private String announcementContent;
}