package com.degrade.drill.filter;

import com.degrade.drill.enums.DrillStatus;
import com.degrade.drill.model.DrillPlan;
import com.degrade.drill.repository.DrillPlanRepository;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.PrintWriter;
import java.util.List;

@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class FallbackFilter implements Filter {

    private final DrillPlanRepository drillPlanRepository;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String requestPath = httpRequest.getRequestURI();
        String requestMethod = httpRequest.getMethod();

        List<DrillPlan> runningDrills = drillPlanRepository.findByStatus(DrillStatus.RUNNING);

        for (DrillPlan plan : runningDrills) {
            if (plan.getTargetApi() != null
                    && plan.getTargetApi().getPath().equals(requestPath)
                    && plan.getTargetApi().getMethod().equalsIgnoreCase(requestMethod)
                    && Boolean.TRUE.equals(plan.getTargetApi().getEnabled())) {

                log.info("命中降级演练，返回兜底响应: path={}, drillId={}", requestPath, plan.getId());

                if (plan.getFallbackResponse().getDelayMs() != null && plan.getFallbackResponse().getDelayMs() > 0) {
                    try {
                        Thread.sleep(plan.getFallbackResponse().getDelayMs());
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }

                response.setContentType(plan.getFallbackResponse().getContentType());
                if (response instanceof jakarta.servlet.http.HttpServletResponse httpResponse) {
                    httpResponse.setStatus(plan.getFallbackResponse().getHttpStatus());
                }

                if (plan.getFallbackResponse().getResponseBody() != null) {
                    PrintWriter writer = response.getWriter();
                    writer.write(plan.getFallbackResponse().getResponseBody());
                    writer.flush();
                }
                return;
            }
        }

        chain.doFilter(request, response);
    }
}