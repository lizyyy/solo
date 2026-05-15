package com.apidiff.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BatchFieldAttributionRequest {

    @NotEmpty(message = "字段归因列表不能为空")
    @Valid
    private List<FieldAttributionRequest> fields;

    private String operatedBy;
}
