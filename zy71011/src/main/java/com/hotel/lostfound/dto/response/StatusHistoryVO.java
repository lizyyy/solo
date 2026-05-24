package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.LostItemStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class StatusHistoryVO {

    private Long id;

    private LostItemStatus fromStatus;

    private LostItemStatus toStatus;

    private String operator;

    private String remark;

    private LocalDateTime operateTime;
}
