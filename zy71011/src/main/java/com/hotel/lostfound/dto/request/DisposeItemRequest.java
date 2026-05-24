package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.DisposalType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class DisposeItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotNull(message = "处置类型不能为空")
    private DisposalType disposalType;

    @NotBlank(message = "申请人不能为空")
    private String appliedBy;

    @NotNull(message = "申请时间不能为空")
    private LocalDateTime appliedAt;

    private String applyReason;

    private boolean managerApproved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String evidenceImageUrls;

    @NotBlank(message = "处理人不能为空")
    private String handledBy;

    @NotNull(message = "处置时间不能为空")
    private LocalDateTime disposedAt;

    private String disposalDetail;
}
