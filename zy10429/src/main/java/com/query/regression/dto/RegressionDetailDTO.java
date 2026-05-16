package com.query.regression.dto;

import com.query.regression.entity.ExecutionPlan;
import com.query.regression.entity.PlanDifference;
import com.query.regression.entity.QueryParameter;
import com.query.regression.entity.RegressionRecord;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegressionDetailDTO {
    private RegressionRecord record;
    private List<QueryParameter> parameters;
    private ExecutionPlan oldPlan;
    private ExecutionPlan newPlan;
    private List<PlanDifference> differences;
}
