package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.IdType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ClaimItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotBlank(message = "认领人姓名不能为空")
    private String claimantName;

    @NotBlank(message = "认领人电话不能为空")
    private String claimantPhone;

    @NotNull(message = "证件类型不能为空")
    private IdType idType;

    @NotBlank(message = "证件号码不能为空")
    private String idNumber;

    private String idImageUrl;

    private String relation;

    private String itemDescription;

    private boolean identificationVerified;

    private boolean itemDescriptionMatched;

    private boolean approved;

    private String approveRemark;

    @NotBlank(message = "处理人不能为空")
    private String handledBy;

    @NotNull(message = "认领时间不能为空")
    private LocalDateTime claimTime;
}
