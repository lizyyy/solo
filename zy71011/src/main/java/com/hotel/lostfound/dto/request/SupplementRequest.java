package com.hotel.lostfound.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SupplementRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotBlank(message = "补充类型不能为空")
    private String supplementType;

    private String supplementContent;

    private String evidenceImageUrls;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotNull(message = "操作时间不能为空")
    private LocalDateTime operateTime;

    private String remark;
}
