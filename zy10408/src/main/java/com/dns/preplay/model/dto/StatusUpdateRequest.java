package com.dns.preplay.model.dto;

import com.dns.preplay.model.enums.PreplayStatus;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class StatusUpdateRequest {

    @NotNull(message = "目标状态不能为空")
    private PreplayStatus targetStatus;

    private String comment;
}
