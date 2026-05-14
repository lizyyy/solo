package com.feiyong.feecalc.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Data
public class CalculateRequest {

    @NotBlank(message = "业务类型不能为空")
    private String bizType;

    @NotBlank(message = "业务编号不能为空")
    private String bizNo;

    private String userId;

    @NotBlank(message = "规则编码不能为空")
    private String ruleCode;

    @NotNull(message = "数量不能为空")
    private BigDecimal quantity;

    private List<String> discountCodes;

    private String expirationStrategyCode = "DEFAULT";

    private Map<String, Object> extraParams;

    private String operator;
}
