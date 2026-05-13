package com.lineage.service;

import com.lineage.dto.*;
import com.lineage.entity.*;
import com.lineage.enums.LineageStatus;
import com.lineage.exception.ErrorCode;
import com.lineage.exception.LineageException;
import com.lineage.repository.FieldLineageRepository;
import com.lineage.repository.LineageHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FieldLineageService {

    private final FieldLineageRepository lineageRepository;
    private final LineageHistoryRepository historyRepository;

    @Transactional
    public FieldLineage createLineage(FieldLineageCreateRequest request) {
        log.info("Creating lineage for API: {}, field: {}", request.getApiPath(), request.getResponseField());

        if (lineageRepository.existsByApiPathAndResponseField(request.getApiPath(), request.getResponseField())) {
            throw new LineageException(ErrorCode.LINEAGE_ALREADY_EXISTS, 
                    String.format("血缘记录已存在: API=%s, Field=%s", request.getApiPath(), request.getResponseField()));
        }

        FieldLineage lineage = new FieldLineage();
        lineage.setApiPath(request.getApiPath());
        lineage.setApiMethod(request.getApiMethod());
        lineage.setApiName(request.getApiName());
        lineage.setResponseField(request.getResponseField());
        lineage.setFieldPath(request.getFieldPath());
        lineage.setFieldType(request.getFieldType());
        lineage.setDescription(request.getDescription());
        lineage.setExampleValue(request.getExampleValue());
        lineage.setCreatedBy(request.getCreatedBy());
        lineage.setStatus(LineageStatus.DRAFT);

        if (request.getSourceTables() != null) {
            List<SourceTable> sourceTables = request.getSourceTables().stream()
                    .map(this::convertToSourceTable)
                    .collect(Collectors.toList());
            lineage.setSourceTables(sourceTables);
        }

        if (request.getCalculationRule() != null) {
            CalculationRule rule = convertToCalculationRule(request.getCalculationRule(), request.getCreatedBy());
            lineage.setCalculationRule(rule);
        }

        if (request.getDependentApis() != null) {
            List<DependentApi> dependentApis = request.getDependentApis().stream()
                    .map(this::convertToDependentApi)
                    .collect(Collectors.toList());
            lineage.setDependentApis(dependentApis);
        }

        FieldLineage saved = lineageRepository.save(lineage);
        recordHistory(saved.getId(), null, LineageStatus.DRAFT, "CREATE", "创建血缘记录", request.getCreatedBy());

        log.info("Created lineage with ID: {}", saved.getId());
        return saved;
    }

    @Transactional(readOnly = true)
    public FieldLineage getLineage(Long id) {
        return lineageRepository.findById(id)
                .orElseThrow(() -> new LineageException(ErrorCode.LINEAGE_NOT_FOUND, "血缘记录不存在: " + id));
    }

    @Transactional(readOnly = true)
    public List<FieldLineage> getLineagesByApi(String apiPath) {
        return lineageRepository.findByApiPath(apiPath);
    }

    @Transactional
    public FieldLineage validateLineage(Long id, String operator) {
        log.info("Validating lineage: {}", id);
        FieldLineage lineage = getLineage(id);

        if (lineage.getStatus() != LineageStatus.DRAFT) {
            throw new LineageException(ErrorCode.INVALID_STATUS_TRANSITION, 
                    "只能验证 DRAFT 状态的血缘记录");
        }

        lineage.setStatus(LineageStatus.VALIDATING);
        lineage.setUpdatedBy(operator);
        recordHistory(lineage.getId(), LineageStatus.DRAFT, LineageStatus.VALIDATING, "VALIDATE", "开始验证血缘记录", operator);

        boolean isValid = performValidation(lineage);

        if (isValid) {
            lineage.setStatus(LineageStatus.VALID);
            recordHistory(lineage.getId(), LineageStatus.VALIDATING, LineageStatus.VALID, "VALIDATE", "血缘记录验证通过", operator);
            log.info("Lineage {} validated successfully", id);
        } else {
            lineage.setStatus(LineageStatus.INVALID);
            recordHistory(lineage.getId(), LineageStatus.VALIDATING, LineageStatus.INVALID, "VALIDATE", "血缘记录验证失败", operator);
            log.info("Lineage {} validation failed", id);
        }

        return lineageRepository.save(lineage);
    }

    @Transactional
    public FieldLineage updateStatus(Long id, LineageStatus newStatus, String reason, String operator) {
        log.info("Updating lineage {} status to {}", id, newStatus);
        FieldLineage lineage = getLineage(id);
        LineageStatus oldStatus = lineage.getStatus();

        if (!isValidStatusTransition(oldStatus, newStatus)) {
            throw new LineageException(ErrorCode.INVALID_STATUS_TRANSITION,
                    String.format("不允许的状态转换: %s -> %s", oldStatus, newStatus));
        }

        lineage.setStatus(newStatus);
        lineage.setUpdatedBy(operator);
        recordHistory(lineage.getId(), oldStatus, newStatus, "STATUS_CHANGE", reason, operator);

        return lineageRepository.save(lineage);
    }

    @Transactional(readOnly = true)
    public List<FieldLineage> getImpactAnalysis(String tableName, String columnName) {
        log.info("Performing impact analysis for {}.{}", tableName, columnName);
        return lineageRepository.findBySourceTableAndColumn(tableName, columnName);
    }

    @Transactional(readOnly = true)
    public List<FieldLineage> getImpactByApi(String dependentApiPath) {
        log.info("Performing impact analysis for API: {}", dependentApiPath);
        return lineageRepository.findByDependentApiPath(dependentApiPath);
    }

    @Transactional(readOnly = true)
    public List<LineageDependency> expandDependencies(Long id, int maxDepth) {
        log.info("Expanding dependencies for lineage {}, maxDepth: {}", id, maxDepth);
        FieldLineage root = getLineage(id);

        List<LineageDependency> result = new ArrayList<>();
        Set<String> visited = new HashSet<>();
        expandDependenciesRecursive(root, 0, maxDepth, result, visited);

        return result;
    }

    @Transactional(readOnly = true)
    public List<LineageHistory> getHistory(Long lineageId) {
        return historyRepository.findByLineageIdOrderByCreatedAtDesc(lineageId);
    }

    @Transactional(readOnly = true)
    public LineageExport exportLineage(Long id) {
        log.info("Exporting lineage: {}", id);
        FieldLineage lineage = getLineage(id);

        LineageExport export = new LineageExport();
        export.setId(lineage.getId());
        export.setApiPath(lineage.getApiPath());
        export.setApiMethod(lineage.getApiMethod());
        export.setApiName(lineage.getApiName());
        export.setResponseField(lineage.getResponseField());
        export.setFieldPath(lineage.getFieldPath());
        export.setFieldType(lineage.getFieldType());
        export.setDescription(lineage.getDescription());
        export.setStatus(lineage.getStatus());
        export.setCreatedBy(lineage.getCreatedBy());
        export.setCreatedAt(lineage.getCreatedAt());
        export.setSourceTables(lineage.getSourceTables());
        export.setCalculationRule(lineage.getCalculationRule());
        export.setDependentApis(lineage.getDependentApis());
        export.setDependencies(expandDependencies(id, 5));
        export.setHistory(getHistory(id));

        return export;
    }

    private void expandDependenciesRecursive(FieldLineage lineage, int currentDepth, int maxDepth,
                                              List<LineageDependency> result, Set<String> visited) {
        if (currentDepth > maxDepth) {
            return;
        }

        String key = lineage.getApiPath() + ":" + lineage.getResponseField();
        if (visited.contains(key)) {
            return;
        }
        visited.add(key);

        for (DependentApi dependentApi : lineage.getDependentApis()) {
            LineageDependency dependency = new LineageDependency();
            dependency.setDepth(currentDepth + 1);
            dependency.setDependentApiPath(dependentApi.getApiPath());
            dependency.setDependentApiMethod(dependentApi.getApiMethod());
            dependency.setDependentApiName(dependentApi.getApiName());
            dependency.setDependentField(dependentApi.getResponseField());
            dependency.setDescription(dependentApi.getDescription());
            result.add(dependency);

            List<FieldLineage> dependentLineages = lineageRepository.findByApiPath(dependentApi.getApiPath());
            for (FieldLineage dep : dependentLineages) {
                if (Objects.equals(dep.getResponseField(), dependentApi.getResponseField())) {
                    expandDependenciesRecursive(dep, currentDepth + 1, maxDepth, result, visited);
                }
            }
        }
    }

    private boolean performValidation(FieldLineage lineage) {
        if (lineage.getSourceTables() == null || lineage.getSourceTables().isEmpty()) {
            return false;
        }
        return !lineage.getApiPath().isEmpty() && !lineage.getResponseField().isEmpty();
    }

    private boolean isValidStatusTransition(LineageStatus oldStatus, LineageStatus newStatus) {
        switch (oldStatus) {
            case DRAFT:
                return newStatus == LineageStatus.VALIDATING || newStatus == LineageStatus.DEPRECATED;
            case VALIDATING:
                return newStatus == LineageStatus.VALID || newStatus == LineageStatus.INVALID;
            case VALID:
                return newStatus == LineageStatus.DEPRECATED || newStatus == LineageStatus.DRAFT;
            case INVALID:
                return newStatus == LineageStatus.DRAFT;
            case DEPRECATED:
                return newStatus == LineageStatus.ARCHIVED || newStatus == LineageStatus.DRAFT;
            case ARCHIVED:
                return false;
            default:
                return false;
        }
    }

    private void recordHistory(Long lineageId, LineageStatus oldStatus, LineageStatus newStatus,
                               String changeType, String description, String operator) {
        LineageHistory history = new LineageHistory();
        history.setLineageId(lineageId);
        history.setOldStatus(oldStatus);
        history.setNewStatus(newStatus);
        history.setChangeType(changeType);
        history.setChangeDescription(description);
        history.setOperator(operator);
        historyRepository.save(history);
    }

    private SourceTable convertToSourceTable(SourceTableDto dto) {
        SourceTable sourceTable = new SourceTable();
        sourceTable.setTableName(dto.getTableName());
        sourceTable.setSchemaName(dto.getSchemaName());
        sourceTable.setColumnName(dto.getColumnName());
        sourceTable.setColumnType(dto.getColumnType());
        sourceTable.setDescription(dto.getDescription());
        sourceTable.setDataSource(dto.getDataSource());
        return sourceTable;
    }

    private CalculationRule convertToCalculationRule(CalculationRuleDto dto, String createdBy) {
        CalculationRule rule = new CalculationRule();
        rule.setRuleName(dto.getRuleName());
        rule.setRuleType(dto.getRuleType());
        rule.setRuleExpression(dto.getRuleExpression());
        rule.setDescription(dto.getDescription());
        rule.setCreatedBy(createdBy);
        return rule;
    }

    private DependentApi convertToDependentApi(DependentApiDto dto) {
        DependentApi dependentApi = new DependentApi();
        dependentApi.setApiPath(dto.getApiPath());
        dependentApi.setApiMethod(dto.getApiMethod());
        dependentApi.setApiName(dto.getApiName());
        dependentApi.setResponseField(dto.getResponseField());
        dependentApi.setDescription(dto.getDescription());
        return dependentApi;
    }
}
