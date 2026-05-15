package com.migration.dualwrite.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DataSourceConfig {
    @NotBlank(message = "数据源类型不能为空")
    private String type;
    @NotBlank(message = "表名不能为空")
    private String tableName;
    private String jdbcUrl;
    private String username;
    private String password;
    private String driverClassName;
}
