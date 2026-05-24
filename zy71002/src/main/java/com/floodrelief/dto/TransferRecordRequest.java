package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class TransferRecordRequest {
    @NotNull(message = "安置点ID不能为空")
    private Long shelterId;

    @NotNull(message = "总人数不能为空")
    private Integer totalCount;

    private Integer elderlyCount;
    private Integer childrenCount;
    private Integer disabledCount;
    private String reporter;
    private String remark;
}
