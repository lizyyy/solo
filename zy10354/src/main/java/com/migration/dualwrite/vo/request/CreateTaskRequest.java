package com.migration.dualwrite.vo.request;

import com.migration.dualwrite.dto.DataSourceConfig;
import com.migration.dualwrite.dto.MigrationField;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
public class CreateTaskRequest {
    @NotBlank(message = "接口名称不能为空")
    private String interfaceName;
    private String businessKey;
    private String createdBy;
    private String remark;

    @NotNull(message = "旧数据源配置不能为空")
    @Valid
    private DataSourceConfig oldDataSource;

    @NotNull(message = "新数据源配置不能为空")
    @Valid
    private DataSourceConfig newDataSource;

    @NotEmpty(message = "比对字段不能为空")
    @Valid
    private List<MigrationField> fields;

    @NotNull(message = "写入数据不能为空")
    private Map<String, Object> writeData;
}
