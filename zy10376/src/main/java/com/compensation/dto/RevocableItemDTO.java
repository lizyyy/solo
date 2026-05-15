package com.compensation.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RevocableItemDTO {

    private Long id;
    private String itemId;
    private String itemType;
    private String itemKey;
    private String itemDescription;
    private String beforeState;
    private String afterState;
    private Boolean revocable;
    private String compensationMethod;
    private String compensationParams;
    private Boolean compensated;
    private LocalDateTime compensatedAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
