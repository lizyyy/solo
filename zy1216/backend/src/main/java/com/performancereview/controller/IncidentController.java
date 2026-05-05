package com.performancereview.controller;

import com.performancereview.dto.ApiResponse;
import com.performancereview.entity.*;
import com.performancereview.enums.BottleneckSeverity;
import com.performancereview.enums.PerformanceMetricType;
import com.performancereview.repository.*;
import com.performancereview.service.DataAnalysisService;
import com.performancereview.service.ReportExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

@RestController
@RequestMapping("/api/incidents")
@Tag(name = "事故管理", description = "事故查询、更新、分析和报告导出相关接口")
@Slf4j
public class IncidentController {

    private final IncidentRepository incidentRepository;
    private final CpuHotSpotRepository cpuHotSpotRepository;
    private final HeapGrowthRepository heapGrowthRepository;
    private final GcPauseRepository gcPauseRepository;
    private final LockWaitChainRepository lockWaitChainRepository;
    private final IoBlockRepository ioBlockRepository;
    private final NetworkRttRepository networkRttRepository;
    private final SlowRequestRepository slowRequestRepository;
    private final EvidenceFragmentRepository evidenceFragmentRepository;
    private final DataAnalysisService dataAnalysisService;
    private final ReportExportService reportExportService;

    public IncidentController(IncidentRepository incidentRepository,
                               CpuHotSpotRepository cpuHotSpotRepository,
                               HeapGrowthRepository heapGrowthRepository,
                               GcPauseRepository gcPauseRepository,
                               LockWaitChainRepository lockWaitChainRepository,
                               IoBlockRepository ioBlockRepository,
                               NetworkRttRepository networkRttRepository,
                               SlowRequestRepository slowRequestRepository,
                               EvidenceFragmentRepository evidenceFragmentRepository,
                               DataAnalysisService dataAnalysisService,
                               ReportExportService reportExportService) {
        this.incidentRepository = incidentRepository;
        this.cpuHotSpotRepository = cpuHotSpotRepository;
        this.heapGrowthRepository = heapGrowthRepository;
        this.gcPauseRepository = gcPauseRepository;
        this.lockWaitChainRepository = lockWaitChainRepository;
        this.ioBlockRepository = ioBlockRepository;
        this.networkRttRepository = networkRttRepository;
        this.slowRequestRepository = slowRequestRepository;
        this.evidenceFragmentRepository = evidenceFragmentRepository;
        this.dataAnalysisService = dataAnalysisService;
        this.reportExportService = reportExportService;
    }

    @GetMapping
    @Operation(summary = "获取事故列表", description = "获取所有事故列表，支持按状态和严重程度筛选")
    public ResponseEntity<ApiResponse<List<Incident>>> getIncidents(
            @Parameter(description = "状态筛选") @RequestParam(required = false) String status,
            @Parameter(description = "严重程度筛选") @RequestParam(required = false) String severity,
            @Parameter(description = "关键词搜索") @RequestParam(required = false) String keyword) {
        
        log.info("获取事故列表: status={}, severity={}, keyword={}", status, severity, keyword);

        try {
            List<Incident> incidents;
            
            if (keyword != null && !keyword.isEmpty()) {
                incidents = incidentRepository.searchByKeyword(keyword);
            } else if (status != null) {
                incidents = incidentRepository.findByStatusOrderByCreatedAtDesc(status);
            } else if (severity != null) {
                incidents = incidentRepository.findBySeverityOrderByCreatedAtDesc(severity);
            } else {
                incidents = incidentRepository.findAll();
                incidents.sort((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()));
            }

            return ResponseEntity.ok(ApiResponse.success(incidents));
        } catch (Exception e) {
            log.error("获取事故列表失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取事故列表失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}")
    @Operation(summary = "获取事故详情", description = "获取指定事故的详细信息")
    public ResponseEntity<ApiResponse<Incident>> getIncidentById(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故详情: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(ApiResponse.success(optional.get()));
        } catch (Exception e) {
            log.error("获取事故详情失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取事故详情失败: " + e.getMessage()));
        }
    }

    @PostMapping
    @Operation(summary = "创建事故", description = "创建新的事故记录")
    public ResponseEntity<ApiResponse<Incident>> createIncident(
            @RequestBody Incident incident) {
        
        log.info("创建事故: title={}", incident.getTitle());

        try {
            if (incident.getTitle() == null || incident.getTitle().isEmpty()) {
                incident.setTitle("未命名事故 - " + LocalDateTime.now());
            }
            if (incident.getStatus() == null) {
                incident.setStatus("OPEN");
            }
            if (incident.getSeverity() == null) {
                incident.setSeverity("MEDIUM");
            }

            Incident saved = incidentRepository.save(incident);
            return ResponseEntity.ok(ApiResponse.success("事故创建成功", saved));
        } catch (Exception e) {
            log.error("创建事故失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("创建事故失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @Operation(summary = "更新事故", description = "更新指定事故的信息")
    public ResponseEntity<ApiResponse<Incident>> updateIncident(
            @Parameter(description = "事故ID") @PathVariable Long id,
            @RequestBody Incident incident) {
        
        log.info("更新事故: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Incident existing = optional.get();
            
            if (incident.getTitle() != null) {
                existing.setTitle(incident.getTitle());
            }
            if (incident.getDescription() != null) {
                existing.setDescription(incident.getDescription());
            }
            if (incident.getStatus() != null) {
                existing.setStatus(incident.getStatus());
            }
            if (incident.getSeverity() != null) {
                existing.setSeverity(incident.getSeverity());
            }
            if (incident.getDispositionSuggestion() != null) {
                existing.setDispositionSuggestion(incident.getDispositionSuggestion());
            }
            if (incident.getResolutionNotes() != null) {
                existing.setResolutionNotes(incident.getResolutionNotes());
            }

            Incident saved = incidentRepository.save(existing);
            return ResponseEntity.ok(ApiResponse.success("事故更新成功", saved));
        } catch (Exception e) {
            log.error("更新事故失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("更新事故失败: " + e.getMessage()));
        }
    }

    @PutMapping("/{id}/suggestion")
    @Operation(summary = "标记处置建议", description = "为事故添加或更新处置建议")
    public ResponseEntity<ApiResponse<Incident>> updateDispositionSuggestion(
            @Parameter(description = "事故ID") @PathVariable Long id,
            @RequestBody Map<String, String> request) {
        
        log.info("更新事故处置建议: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Incident incident = optional.get();
            String suggestion = request.get("suggestion");
            incident.setDispositionSuggestion(suggestion);

            Incident saved = incidentRepository.save(incident);
            return ResponseEntity.ok(ApiResponse.success("处置建议更新成功", saved));
        } catch (Exception e) {
            log.error("更新处置建议失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("更新处置建议失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/cpu-hotspots")
    @Operation(summary = "获取CPU热点", description = "获取指定事故的所有CPU热点数据")
    public ResponseEntity<ApiResponse<List<CpuHotSpot>>> getCpuHotSpots(
            @Parameter(description = "事故ID") @PathVariable Long id,
            @Parameter(description = "严重程度筛选") @RequestParam(required = false) String severity) {
        
        log.info("获取事故CPU热点: id={}, severity={}", id, severity);

        try {
            List<CpuHotSpot> items;
            if (severity != null) {
                items = cpuHotSpotRepository.findByIncidentIdAndSeverityOrderByTimestampDesc(
                        id, BottleneckSeverity.valueOf(severity.toUpperCase()));
            } else {
                items = cpuHotSpotRepository.findByIncidentIdOrderByTimestampDesc(id);
            }
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取CPU热点失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取CPU热点失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/heap-growths")
    @Operation(summary = "获取堆增长数据", description = "获取指定事故的所有堆增长数据")
    public ResponseEntity<ApiResponse<List<HeapGrowth>>> getHeapGrowths(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故堆增长数据: id={}", id);

        try {
            List<HeapGrowth> items = heapGrowthRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取堆增长数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取堆增长数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/gc-pauses")
    @Operation(summary = "获取GC暂停数据", description = "获取指定事故的所有GC暂停数据")
    public ResponseEntity<ApiResponse<List<GcPause>>> getGcPauses(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故GC暂停数据: id={}", id);

        try {
            List<GcPause> items = gcPauseRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取GC暂停数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取GC暂停数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/lock-waits")
    @Operation(summary = "获取锁等待链数据", description = "获取指定事故的所有锁等待链数据")
    public ResponseEntity<ApiResponse<List<LockWaitChain>>> getLockWaitChains(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故锁等待链数据: id={}", id);

        try {
            List<LockWaitChain> items = lockWaitChainRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取锁等待链数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取锁等待链数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/io-blocks")
    @Operation(summary = "获取I/O阻塞数据", description = "获取指定事故的所有I/O阻塞数据")
    public ResponseEntity<ApiResponse<List<IoBlock>>> getIoBlocks(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故I/O阻塞数据: id={}", id);

        try {
            List<IoBlock> items = ioBlockRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取I/O阻塞数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取I/O阻塞数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/network-rtts")
    @Operation(summary = "获取网络RTT数据", description = "获取指定事故的所有网络RTT数据")
    public ResponseEntity<ApiResponse<List<NetworkRtt>>> getNetworkRtts(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故网络RTT数据: id={}", id);

        try {
            List<NetworkRtt> items = networkRttRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取网络RTT数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取网络RTT数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/slow-requests")
    @Operation(summary = "获取慢请求数据", description = "获取指定事故的所有慢请求数据")
    public ResponseEntity<ApiResponse<List<SlowRequest>>> getSlowRequests(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("获取事故慢请求数据: id={}", id);

        try {
            List<SlowRequest> items = slowRequestRepository.findByIncidentIdOrderByTimestampDesc(id);
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取慢请求数据失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取慢请求数据失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/evidence-fragments")
    @Operation(summary = "获取证据片段", description = "获取指定事故的所有证据片段")
    public ResponseEntity<ApiResponse<List<EvidenceFragment>>> getEvidenceFragments(
            @Parameter(description = "事故ID") @PathVariable Long id,
            @Parameter(description = "是否只获取关键证据") @RequestParam(required = false) Boolean keyOnly) {
        
        log.info("获取事故证据片段: id={}, keyOnly={}", id, keyOnly);

        try {
            List<EvidenceFragment> items;
            if (Boolean.TRUE.equals(keyOnly)) {
                items = evidenceFragmentRepository.findByIncidentIdAndIsKeyEvidenceOrderByTimestampDesc(id, true);
            } else {
                items = evidenceFragmentRepository.findByIncidentIdOrderByTimestampDesc(id);
            }
            return ResponseEntity.ok(ApiResponse.success(items));
        } catch (Exception e) {
            log.error("获取证据片段失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("获取证据片段失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/analyze")
    @Operation(summary = "重新分析事故", description = "重新执行事故分析，包括时间线构建、瓶颈排序等")
    public ResponseEntity<ApiResponse<Incident>> analyzeIncident(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("重新分析事故: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            Incident incident = optional.get();
            dataAnalysisService.analyzeIncident(incident);
            Incident saved = incidentRepository.save(incident);

            return ResponseEntity.ok(ApiResponse.success("事故分析完成", saved));
        } catch (Exception e) {
            log.error("分析事故失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("分析事故失败: " + e.getMessage()));
        }
    }

    @GetMapping("/{id}/export/markdown")
    @Operation(summary = "导出Markdown报告", description = "导出事故的Markdown格式复盘报告")
    public ResponseEntity<byte[]> exportMarkdownReport(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("导出Markdown报告: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            String markdown = reportExportService.exportToMarkdown(optional.get());
            String fileName = "incident-report-" + id + "-" + 
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".md";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                    .contentType(MediaType.TEXT_MARKDOWN)
                    .body(markdown.getBytes("UTF-8"));
        } catch (Exception e) {
            log.error("导出Markdown报告失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/{id}/export/json")
    @Operation(summary = "导出JSON报告", description = "导出事故的JSON格式复盘报告")
    public ResponseEntity<byte[]> exportJsonReport(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("导出JSON报告: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            String json = reportExportService.exportToJson(optional.get());
            String fileName = "incident-report-" + id + "-" + 
                    LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) + ".json";

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + fileName)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(json.getBytes("UTF-8"));
        } catch (Exception e) {
            log.error("导出JSON报告失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "删除事故", description = "删除指定的事故及其所有关联数据")
    public ResponseEntity<ApiResponse<Void>> deleteIncident(
            @Parameter(description = "事故ID") @PathVariable Long id) {
        
        log.info("删除事故: id={}", id);

        try {
            Optional<Incident> optional = incidentRepository.findById(id);
            if (optional.isEmpty()) {
                return ResponseEntity.notFound().build();
            }

            incidentRepository.deleteById(id);
            return ResponseEntity.ok(ApiResponse.success("事故删除成功", null));
        } catch (Exception e) {
            log.error("删除事故失败: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError()
                    .body(ApiResponse.error("删除事故失败: " + e.getMessage()));
        }
    }
}
