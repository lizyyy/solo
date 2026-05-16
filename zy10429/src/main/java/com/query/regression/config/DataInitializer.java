package com.query.regression.config;

import com.query.regression.dto.CreateRegressionRequest;
import com.query.regression.entity.QueryTemplate;
import com.query.regression.repository.QueryTemplateRepository;
import com.query.regression.service.RegressionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final QueryTemplateRepository templateRepository;
    private final RegressionService regressionService;

    @Override
    public void run(String... args) {
        if (templateRepository.count() == 0) {
            log.info("初始化示例数据...");
            createSampleData();
        }
    }

    private void createSampleData() {
        QueryTemplate template1 = new QueryTemplate();
        template1.setName("用户订单查询");
        template1.setSqlTemplate("SELECT * FROM orders WHERE user_id = ? AND status = ?");
        template1.setDescription("根据用户ID和订单状态查询订单列表");
        template1.setDatabaseType("PostgreSQL");
        template1.setCreatedBy("system");
        template1 = templateRepository.save(template1);

        QueryTemplate template2 = new QueryTemplate();
        template2.setName("商品统计查询");
        template2.setSqlTemplate("SELECT category, COUNT(*) FROM products GROUP BY category");
        template2.setDescription("按商品分类统计数量");
        template2.setDatabaseType("MySQL");
        template2.setCreatedBy("system");
        templateRepository.save(template2);

        createSampleRegression(template1.getId(), "性能优化-索引变更", 150.5, 320.8, "idx_user_status", "");
        createSampleRegression(template1.getId(), "性能优化-无变化", 100.0, 100.0, "idx_user_status", "idx_user_status");
        createSampleRegression(template2.getId(), "性能优化-改进", 500.0, 250.0, "", "idx_category");

        log.info("示例数据初始化完成");
    }

    private void createSampleRegression(Long templateId, String queryName, 
            double oldCost, double newCost, String oldIndex, String newIndex) {
        CreateRegressionRequest request = new CreateRegressionRequest();
        request.setQueryName(queryName);
        request.setTemplateId(templateId);
        request.setCreatedBy("admin");

        Map<String, Object> params = new HashMap<>();
        params.put("user_id", 12345);
        params.put("status", "PAID");
        request.setParameters(params);

        String oldPlan = generatePlan(oldCost, oldIndex);
        String newPlan = generatePlan(newCost, newIndex);
        request.setOldPlan(oldPlan);
        request.setNewPlan(newPlan);

        regressionService.createRegression(request);
    }

    private String generatePlan(double cost, String indexes) {
        StringBuilder plan = new StringBuilder();
        plan.append("Nested Loop (cost=").append(cost).append(" rows=1000)\n");
        plan.append("  -> Index Scan using ").append(indexes.isEmpty() ? "NULL" : indexes)
             .append(" on users (cost=").append(cost * 0.2).append(" rows=100)\n");
        plan.append("  -> Hash Join (cost=").append(cost * 0.8).append(" rows=10)\n");
        return plan.toString();
    }
}
