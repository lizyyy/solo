package com.resiliencehub.report;

import com.resiliencehub.circuitbreaker.CircuitBreakerService;
import com.resiliencehub.fault.FaultInjector;
import com.resiliencehub.ratelimit.RateLimitService;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.PrintWriter;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ReportService {
    
    private final CircuitBreakerService circuitBreakerService;
    private final RateLimitService rateLimitService;
    private final FaultInjector faultInjector;
    private final List<ProblemEvent> problemEvents = Collections.synchronizedList(new ArrayList<>());
    
    public ReportService(CircuitBreakerService circuitBreakerService,
                        RateLimitService rateLimitService,
                        FaultInjector faultInjector) {
        this.circuitBreakerService = circuitBreakerService;
        this.rateLimitService = rateLimitService;
        this.faultInjector = faultInjector;
    }
    
    public void recordProblem(ProblemEvent event) {
        problemEvents.add(event);
        if (problemEvents.size() > 10000) {
            problemEvents.subList(0, 1000).clear();
        }
    }
    
    public SystemReport generateReport() {
        SystemReport report = new SystemReport();
        report.setReportId(UUID.randomUUID().toString());
        report.setGeneratedAt(LocalDateTime.now());
        
        Map<String, Object> circuitBreakerReport = new HashMap<>();
        circuitBreakerService.getAllCircuitBreakers().forEach((name, cb) -> {
            CircuitBreakerService.CircuitBreakerMetrics metrics = cb.getMetrics();
            Map<String, Object> cbInfo = new HashMap<>();
            cbInfo.put("name", name);
            cbInfo.put("state", metrics.getState());
            cbInfo.put("totalCalls", metrics.getTotalCalls());
            cbInfo.put("successCount", metrics.getSuccessCount());
            cbInfo.put("failureCount", metrics.getFailureCount());
            cbInfo.put("slowCallCount", metrics.getSlowCallCount());
            cbInfo.put("failureRate", metrics.getFailureRate());
            cbInfo.put("slowCallRate", metrics.getSlowCallRate());
            cbInfo.put("averageResponseTime", metrics.getAverageResponseTime());
            circuitBreakerReport.put(name, cbInfo);
        });
        report.setCircuitBreakers(circuitBreakerReport);
        
        Map<String, Object> faultReport = new HashMap<>();
        faultReport.put("activeConfigs", faultInjector.getAllFaultConfigs().size());
        faultReport.put("configs", faultInjector.getAllFaultConfigs());
        report.setFaultInjection(faultReport);
        
        List<ProblemEvent> recentProblems = getRecentProblems(100);
        report.setRecentProblems(recentProblems);
        
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalProblems", problemEvents.size());
        stats.put("problemsByType", countProblemsByType());
        stats.put("problemsBySeverity", countProblemsBySeverity());
        report.setStatistics(stats);
        
        Map<String, Object> analysis = analyzeProblems();
        report.setAnalysis(analysis);
        
        report.setRecommendations(generateRecommendations());
        
        return report;
    }
    
    public byte[] exportReportAsMarkdown() {
        SystemReport report = generateReport();
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        PrintWriter writer = new PrintWriter(baos);
        
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
        
        writer.println("# 系统问题分析报告");
        writer.println();
        writer.println("**报告ID:** " + report.getReportId());
        writer.println("**生成时间:** " + report.getGeneratedAt().format(formatter));
        writer.println();
        
        writer.println("## 1. 熔断状态概览");
        writer.println();
        Map<String, Object> circuitBreakers = report.getCircuitBreakers();
        if (circuitBreakers.isEmpty()) {
            writer.println("暂无熔断配置");
        } else {
            writer.println("| 服务名称 | 状态 | 总请求数 | 失败率 | 慢调用率 | 平均响应时间 |");
            writer.println("|---------|------|---------|--------|---------|-------------|");
            circuitBreakers.forEach((name, cbInfo) -> {
                Map<?, ?> info = (Map<?, ?>) cbInfo;
                writer.printf("| %s | %s | %d | %.1f%% | %.1f%% | %.2fms |%n",
                    name,
                    info.get("state"),
                    info.get("totalCalls"),
                    info.get("failureRate"),
                    info.get("slowCallRate"),
                    info.get("averageResponseTime"));
            });
        }
        writer.println();
        
        writer.println("## 2. 故障注入配置");
        writer.println();
        Map<?, ?> faultConfig = (Map<?, ?>) report.getFaultInjection();
        writer.println("**活跃配置数:** " + faultConfig.get("activeConfigs"));
        writer.println();
        
        writer.println("## 3. 最近问题事件");
        writer.println();
        List<ProblemEvent> problems = report.getRecentProblems();
        if (problems.isEmpty()) {
            writer.println("暂无问题事件");
        } else {
            writer.println("| 时间 | 类型 | 严重程度 | 服务 | 描述 |");
            writer.println("|-----|------|---------|------|------|");
            for (ProblemEvent event : problems) {
                writer.printf("| %s | %s | %s | %s | %s |%n",
                    event.getTimestamp().format(formatter),
                    event.getType(),
                    event.getSeverity(),
                    event.getService(),
                    event.getDescription());
            }
        }
        writer.println();
        
        writer.println("## 4. 问题统计");
        writer.println();
        Map<?, ?> stats = (Map<?, ?>) report.getStatistics();
        writer.println("**总问题数:** " + stats.get("totalProblems"));
        writer.println();
        
        writer.println("### 按类型统计");
        Map<?, ?> byType = (Map<?, ?>) stats.get("problemsByType");
        byType.forEach((type, count) -> writer.println("- " + type + ": " + count));
        writer.println();
        
        writer.println("### 按严重程度统计");
        Map<?, ?> bySeverity = (Map<?, ?>) stats.get("problemsBySeverity");
        bySeverity.forEach((severity, count) -> writer.println("- " + severity + ": " + count));
        writer.println();
        
        writer.println("## 5. 问题分析");
        writer.println();
        Map<?, ?> analysis = (Map<?, ?>) report.getAnalysis();
        writer.println("**健康状态:** " + analysis.get("healthStatus"));
        writer.println("**健康分数:** " + analysis.get("healthScore"));
        writer.println();
        
        if (analysis.get("topIssues") != null) {
            writer.println("### 主要问题");
            List<?> topIssues = (List<?>) analysis.get("topIssues");
            topIssues.forEach(issue -> writer.println("- " + issue));
            writer.println();
        }
        
        writer.println("## 6. 建议措施");
        writer.println();
        List<?> recommendations = (List<?>) report.getRecommendations();
        if (recommendations.isEmpty()) {
            writer.println("系统运行正常，暂无建议");
        } else {
            recommendations.forEach(rec -> writer.println("- " + rec));
        }
        
        writer.flush();
        return baos.toByteArray();
    }
    
    public List<ProblemEvent> getRecentProblems(int limit) {
        int start = Math.max(0, problemEvents.size() - limit);
        return new ArrayList<>(problemEvents.subList(start, problemEvents.size()));
    }
    
    public List<ProblemEvent> getProblemsByType(String type) {
        return problemEvents.stream()
            .filter(e -> type.equals(e.getType()))
            .toList();
    }
    
    public List<ProblemEvent> getProblemsBySeverity(ProblemEvent.Severity severity) {
        return problemEvents.stream()
            .filter(e -> severity == e.getSeverity())
            .toList();
    }
    
    private Map<String, Long> countProblemsByType() {
        Map<String, Long> counts = new HashMap<>();
        problemEvents.forEach(e -> 
            counts.merge(e.getType(), 1L, Long::sum));
        return counts;
    }
    
    private Map<String, Long> countProblemsBySeverity() {
        Map<String, Long> counts = new HashMap<>();
        problemEvents.forEach(e -> 
            counts.merge(e.getSeverity().name(), 1L, Long::sum));
        return counts;
    }
    
    private Map<String, Object> analyzeProblems() {
        Map<String, Object> analysis = new HashMap<>();
        
        int criticalCount = (int) problemEvents.stream()
            .filter(e -> e.getSeverity() == ProblemEvent.Severity.CRITICAL)
            .count();
        int highCount = (int) problemEvents.stream()
            .filter(e -> e.getSeverity() == ProblemEvent.Severity.HIGH)
            .count();
        
        double healthScore = 100.0 - (criticalCount * 10) - (highCount * 5);
        healthScore = Math.max(0, Math.min(100, healthScore));
        
        String healthStatus;
        if (healthScore >= 80) {
            healthStatus = "HEALTHY";
        } else if (healthScore >= 60) {
            healthStatus = "WARNING";
        } else if (healthScore >= 30) {
            healthStatus = "DEGRADED";
        } else {
            healthStatus = "CRITICAL";
        }
        
        analysis.put("healthStatus", healthStatus);
        analysis.put("healthScore", healthScore);
        
        List<String> topIssues = new ArrayList<>();
        if (criticalCount > 0) {
            topIssues.add("存在 " + criticalCount + " 个严重问题需要立即处理");
        }
        if (highCount > 0) {
            topIssues.add("存在 " + highCount + " 个高优先级问题需要关注");
        }
        
        long openCircuitBreakers = circuitBreakerService.getAllCircuitBreakers().values().stream()
            .filter(cb -> cb.getState() == CircuitBreakerService.CircuitState.OPEN)
            .count();
        if (openCircuitBreakers > 0) {
            topIssues.add("有 " + openCircuitBreakers + " 个服务处于熔断状态");
        }
        
        analysis.put("topIssues", topIssues);
        
        return analysis;
    }
    
    private List<String> generateRecommendations() {
        List<String> recommendations = new ArrayList<>();
        
        circuitBreakerService.getAllCircuitBreakers().forEach((name, cb) -> {
            CircuitBreakerService.CircuitBreakerMetrics metrics = cb.getMetrics();
            if (metrics.getState() == CircuitBreakerService.CircuitState.OPEN) {
                recommendations.add("服务 [" + name + "] 处于熔断状态，建议检查下游服务健康状况");
            }
            if (metrics.getFailureRate() > 30) {
                recommendations.add("服务 [" + name + "] 失败率较高 (" + 
                    String.format("%.1f%%", metrics.getFailureRate()) + ")，建议优化容错机制");
            }
            if (metrics.getSlowCallRate() > 20) {
                recommendations.add("服务 [" + name + "] 慢调用率较高 (" + 
                    String.format("%.1f%%", metrics.getSlowCallRate()) + ")，建议优化性能");
            }
        });
        
        int criticalCount = (int) problemEvents.stream()
            .filter(e -> e.getSeverity() == ProblemEvent.Severity.CRITICAL)
            .count();
        if (criticalCount > 0) {
            recommendations.add("建议增加告警阈值，及时发现和处理严重问题");
        }
        
        return recommendations;
    }
    
    public void clearOldProblems(int hours) {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(hours);
        problemEvents.removeIf(e -> e.getTimestamp().isBefore(cutoff));
    }
    
    public static class ProblemEvent {
        private String id;
        private LocalDateTime timestamp;
        private String type;
        private Severity severity;
        private String service;
        private String endpoint;
        private String description;
        private String traceId;
        private Map<String, Object> metadata;
        
        public ProblemEvent() {
            this.id = UUID.randomUUID().toString();
            this.timestamp = LocalDateTime.now();
        }
        
        public enum Severity {
            LOW,
            MEDIUM,
            HIGH,
            CRITICAL
        }
        
        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public LocalDateTime getTimestamp() { return timestamp; }
        public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Severity getSeverity() { return severity; }
        public void setSeverity(Severity severity) { this.severity = severity; }
        public String getService() { return service; }
        public void setService(String service) { this.service = service; }
        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public String getTraceId() { return traceId; }
        public void setTraceId(String traceId) { this.traceId = traceId; }
        public Map<String, Object> getMetadata() { return metadata; }
        public void setMetadata(Map<String, Object> metadata) { this.metadata = metadata; }
    }
    
    public static class SystemReport {
        private String reportId;
        private LocalDateTime generatedAt;
        private Map<String, Object> circuitBreakers;
        private Map<String, Object> faultInjection;
        private List<ProblemEvent> recentProblems;
        private Map<String, Object> statistics;
        private Map<String, Object> analysis;
        private List<String> recommendations;
        
        public String getReportId() { return reportId; }
        public void setReportId(String reportId) { this.reportId = reportId; }
        public LocalDateTime getGeneratedAt() { return generatedAt; }
        public void setGeneratedAt(LocalDateTime generatedAt) { this.generatedAt = generatedAt; }
        public Map<String, Object> getCircuitBreakers() { return circuitBreakers; }
        public void setCircuitBreakers(Map<String, Object> circuitBreakers) { this.circuitBreakers = circuitBreakers; }
        public Map<String, Object> getFaultInjection() { return faultInjection; }
        public void setFaultInjection(Map<String, Object> faultInjection) { this.faultInjection = faultInjection; }
        public List<ProblemEvent> getRecentProblems() { return recentProblems; }
        public void setRecentProblems(List<ProblemEvent> recentProblems) { this.recentProblems = recentProblems; }
        public Map<String, Object> getStatistics() { return statistics; }
        public void setStatistics(Map<String, Object> statistics) { this.statistics = statistics; }
        public Map<String, Object> getAnalysis() { return analysis; }
        public void setAnalysis(Map<String, Object> analysis) { this.analysis = analysis; }
        public List<String> getRecommendations() { return recommendations; }
        public void setRecommendations(List<String> recommendations) { this.recommendations = recommendations; }
    }
}
