package com.example.readonlywindow.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
public class CreateWindowRequest {
    @NotBlank(message = "窗口名称不能为空")
    private String name;

    private String description;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    private List<ResourceScopeDTO> resourceScopes;

    private String operator;
}
