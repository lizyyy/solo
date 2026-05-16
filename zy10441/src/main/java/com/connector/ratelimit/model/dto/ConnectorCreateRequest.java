package com.connector.ratelimit.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConnectorCreateRequest {
    @NotBlank(message = "连接器编码不能为空")
    private String connectorCode;

    @NotBlank(message = "连接器名称不能为空")
    private String connectorName;

    private String description;

    @NotBlank(message = "供应商编码不能为空")
    private String supplierCode;
}
