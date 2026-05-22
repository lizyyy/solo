package com.tea.compensation.dto;

import com.tea.compensation.enums.DuplicateStrategy;
import com.tea.compensation.enums.TaskType;
import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

@Data
public class TaskSubmitDTO {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotBlank(message = "门店ID不能为空")
    private String storeId;

    @NotBlank(message = "门店名称不能为空")
    private String storeName;

    @NotNull(message = "任务类型不能为空")
    private TaskType taskType;

    private DuplicateStrategy duplicateStrategy = DuplicateStrategy.IGNORE;

    private String parentBatchNo;

    private BigDecimal totalAmount;

    private String taskContent;

    private String externalReceiptNo;

    @NotBlank(message = "提交人不能为空")
    private String submitter;

    private String remark;

    @Valid
    @NotEmpty(message = "任务明细不能为空")
    private List<TaskItemDTO> items;

    @Data
    public static class TaskItemDTO {
        @NotBlank(message = "明细编号不能为空")
        private String itemNo;

        @NotBlank(message = "原料名称不能为空")
        private String materialName;

        private String materialCode;

        private BigDecimal quantity;

        private String unit;

        private BigDecimal unitPrice;

        private BigDecimal amount;

        private String externalId;

        private String remark;
    }
}
