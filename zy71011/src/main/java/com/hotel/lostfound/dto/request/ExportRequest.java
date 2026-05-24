package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.ItemCategory;
import com.hotel.lostfound.entity.enums.LostItemStatus;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ExportRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    private String itemNo;

    private String itemName;

    private ItemCategory category;

    private LostItemStatus status;

    private String roomNumber;

    private String pickedByStaff;

    private LocalDateTime foundTimeStart;

    private LocalDateTime foundTimeEnd;
}
