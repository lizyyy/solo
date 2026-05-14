package com.feiyong.feecalc.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class FeeDetailVo {
    private String name;
    private String desc;
    private BigDecimal amount;
}
