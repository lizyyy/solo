package com.floodrelief.service;

import com.floodrelief.dto.ApiResponse;
import com.floodrelief.dto.GapCalculationRequest;
import com.floodrelief.dto.GapReportDTO;
import com.floodrelief.dto.ShelterAllocationSummary;
import com.floodrelief.entity.AllocationRecord;
import com.floodrelief.entity.GapReport;
import com.floodrelief.entity.Shelter;
import com.floodrelief.entity.TransferRecord;
import com.floodrelief.repository.GapReportRepository;
import com.floodrelief.repository.MaterialBatchRepository;
import com.floodrelief.repository.ShelterRepository;
import com.floodrelief.repository.TransferRecordRepository;
import com.floodrelief.repository.AllocationRecordRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class GapCalculationService {
    private static final Logger log = LoggerFactory.getLogger(GapCalculationService.class);
    
    private final GapReportRepository gapReportRepository;
    private final ShelterRepository shelterRepository;
    private final TransferRecordRepository transferRepository;
    private final AllocationRecordRepository allocationRepository;
    private final MaterialBatchRepository materialRepository;

    public GapCalculationService(GapReportRepository gapReportRepository,
                                  ShelterRepository shelterRepository,
                                  TransferRecordRepository transferRepository,
                                  AllocationRecordRepository allocationRepository,
                                  MaterialBatchRepository materialRepository) {
        this.gapReportRepository = gapReportRepository;
        this.shelterRepository = shelterRepository;
        this.transferRepository = transferRepository;
        this.allocationRepository = allocationRepository;
        this.materialRepository = materialRepository;
    }

    @Transactional
    public ApiResponse<List<GapReportDTO>> calculateGap(GapCalculationRequest request) {
        List<GapReportDTO> results = new ArrayList<>();

        List<Shelter> shelters = new ArrayList<>();
        if (request.getShelterId() != null) {
            Shelter shelter = shelterRepository.findById(request.getShelterId()).orElse(null);
            if (shelter != null) {
                shelters.add(shelter);
            }
        } else {
            shelters = shelterRepository.findByActiveTrue();
        }

        for (Shelter shelter : shelters) {
            TransferRecord latestTransfer = transferRepository.findLatestByShelterId(shelter.getId()).orElse(null);
            if (latestTransfer == null) {
                continue;
            }

            List<AllocationRecord> receivedAllocations = allocationRepository
                    .findByShelterIdAndMaterialBatchIdAndStatusNot(
                            shelter.getId(), null, AllocationRecord.AllocationStatus.RECEIVED);

            Map<String, Integer> materialTotals = receivedAllocations.stream()
                    .filter(a -> a.getMaterialBatchId() != null)
                    .collect(Collectors.groupingBy(
                            a -> getMaterialType(a.getMaterialBatchId()),
                            Collectors.summingInt(AllocationRecord::getQuantity)
                    ));

            int totalPeople = latestTransfer.getTotalCount();
            int elderlyCount = latestTransfer.getElderlyCount() != null ? latestTransfer.getElderlyCount() : 0;
            int childrenCount = latestTransfer.getChildrenCount() != null ? latestTransfer.getChildrenCount() : 0;

            results.add(calculateFoodGap(shelter, totalPeople, materialTotals.getOrDefault("FOOD", 0)));
            results.add(calculateWaterGap(shelter, totalPeople, materialTotals.getOrDefault("WATER", 0)));
            results.add(calculateMedicineGap(shelter, elderlyCount, materialTotals.getOrDefault("MEDICINE", 0)));
            results.add(calculateChildrenFoodGap(shelter, childrenCount, materialTotals.getOrDefault("CHILDREN_FOOD", 0)));
        }

        results.removeIf(r -> r.getGapQuantity() <= 0);
        log.info("缺口计算完成，共发现 {} 个缺口", results.size());
        return ApiResponse.success(results);
    }

    public ApiResponse<List<GapReportDTO>> getAllGapReports() {
        List<GapReport> reports = gapReportRepository.findAll();
        List<GapReportDTO> dtos = reports.stream().map(this::convertToDTO).collect(Collectors.toList());
        return ApiResponse.success(dtos);
    }

    @Transactional
    public ApiResponse<GapReportDTO> saveGapReport(GapReportDTO dto) {
        GapReport report = new GapReport();
        report.setShelterId(dto.getShelterId());
        report.setMaterialType(dto.getMaterialType());
        report.setMaterialName(dto.getMaterialName());
        report.setRequiredQuantity(dto.getRequiredQuantity());
        report.setCurrentQuantity(dto.getCurrentQuantity());
        report.setGapQuantity(dto.getGapQuantity());
        report.setUnit(dto.getUnit());
        report.setPriority(dto.getPriority());
        report.setReason(dto.getReason());
        report.setReportedAt(LocalDateTime.now());
        report = gapReportRepository.save(report);
        return ApiResponse.success(convertToDTO(report));
    }

    private GapReportDTO calculateFoodGap(Shelter shelter, int totalPeople, int currentFood) {
        int required = totalPeople * 3 * 3;
        int gap = required - currentFood;

        GapReportDTO dto = new GapReportDTO();
        dto.setShelterId(shelter.getId());
        dto.setShelterName(shelter.getName());
        dto.setMaterialType("FOOD");
        dto.setMaterialName("应急食品");
        dto.setRequiredQuantity(required);
        dto.setCurrentQuantity(currentFood);
        dto.setGapQuantity(Math.max(0, gap));
        dto.setUnit("份");
        dto.setPriority(gap > required * 0.5 ? "HIGH" : gap > 0 ? "MEDIUM" : "LOW");
        dto.setReason("按每人每天3份，储备3天计算");
        return dto;
    }

    private GapReportDTO calculateWaterGap(Shelter shelter, int totalPeople, int currentWater) {
        int required = totalPeople * 4 * 3;
        int gap = required - currentWater;

        GapReportDTO dto = new GapReportDTO();
        dto.setShelterId(shelter.getId());
        dto.setShelterName(shelter.getName());
        dto.setMaterialType("WATER");
        dto.setMaterialName("饮用水");
        dto.setRequiredQuantity(required);
        dto.setCurrentQuantity(currentWater);
        dto.setGapQuantity(Math.max(0, gap));
        dto.setUnit("瓶");
        dto.setPriority(gap > required * 0.5 ? "HIGH" : gap > 0 ? "MEDIUM" : "LOW");
        dto.setReason("按每人每天4瓶，储备3天计算");
        return dto;
    }

    private GapReportDTO calculateMedicineGap(Shelter shelter, int elderlyCount, int currentMedicine) {
        int required = elderlyCount * 2;
        int gap = required - currentMedicine;

        GapReportDTO dto = new GapReportDTO();
        dto.setShelterId(shelter.getId());
        dto.setShelterName(shelter.getName());
        dto.setMaterialType("MEDICINE");
        dto.setMaterialName("常用药品");
        dto.setRequiredQuantity(required);
        dto.setCurrentQuantity(currentMedicine);
        dto.setGapQuantity(Math.max(0, gap));
        dto.setUnit("份");
        dto.setPriority(gap > 0 ? "HIGH" : "LOW");
        dto.setReason("老人药品按每人2份计算");
        return dto;
    }

    private GapReportDTO calculateChildrenFoodGap(Shelter shelter, int childrenCount, int currentChildrenFood) {
        int required = childrenCount * 2 * 3;
        int gap = required - currentChildrenFood;

        GapReportDTO dto = new GapReportDTO();
        dto.setShelterId(shelter.getId());
        dto.setShelterName(shelter.getName());
        dto.setMaterialType("CHILDREN_FOOD");
        dto.setMaterialName("儿童食品");
        dto.setRequiredQuantity(required);
        dto.setCurrentQuantity(currentChildrenFood);
        dto.setGapQuantity(Math.max(0, gap));
        dto.setUnit("份");
        dto.setPriority(gap > 0 ? "HIGH" : "LOW");
        dto.setReason("儿童食品按每人每天2份，储备3天计算");
        return dto;
    }

    private String getMaterialType(Long materialBatchId) {
        return materialRepository.findById(materialBatchId)
                .map(m -> m.getMaterialType() != null ? m.getMaterialType() : "OTHER")
                .orElse("OTHER");
    }

    public ApiResponse<ShelterAllocationSummary> getShelterSummary(Long shelterId) {
        Shelter shelter = shelterRepository.findById(shelterId).orElse(null);
        if (shelter == null) {
            return ApiResponse.error("安置点不存在");
        }

        TransferRecord latestTransfer = transferRepository.findLatestByShelterId(shelterId).orElse(null);
        if (latestTransfer == null) {
            return ApiResponse.error("暂无转移人数记录");
        }

        List<AllocationRecord> allocations = allocationRepository
                .findByShelterIdAndMaterialBatchIdAndStatusNot(shelterId, null, AllocationRecord.AllocationStatus.RECEIVED);

        int totalFood = allocations.stream()
                .filter(a -> "FOOD".equals(getMaterialType(a.getMaterialBatchId())))
                .mapToInt(AllocationRecord::getQuantity)
                .sum();

        int totalMedicine = allocations.stream()
                .filter(a -> "MEDICINE".equals(getMaterialType(a.getMaterialBatchId())))
                .mapToInt(AllocationRecord::getQuantity)
                .sum();

        int totalPeople = latestTransfer.getTotalCount();
        int elderlyCount = latestTransfer.getElderlyCount() != null ? latestTransfer.getElderlyCount() : 0;

        ShelterAllocationSummary summary = new ShelterAllocationSummary();
        summary.setShelterId(shelterId);
        summary.setShelterName(shelter.getName());
        summary.setTotalPeople(totalPeople);
        summary.setElderlyCount(elderlyCount);
        summary.setChildrenCount(latestTransfer.getChildrenCount());
        summary.setDisabledCount(latestTransfer.getDisabledCount());

        double foodRatio = totalPeople > 0 ? (double) totalFood / totalPeople : 0;
        double medicineRatio = elderlyCount > 0 ? (double) totalMedicine / elderlyCount : 0;

        summary.setFoodRatio(Math.round(foodRatio * 100.0) / 100.0);
        summary.setMedicineRatio(Math.round(medicineRatio * 100.0) / 100.0);

        String ratioStatus = "NORMAL";
        if (foodRatio < 3 || medicineRatio < 1) {
            ratioStatus = "WARNING";
        }
        if (foodRatio < 1 || medicineRatio < 0.5) {
            ratioStatus = "CRITICAL";
        }
        summary.setRatioStatus(ratioStatus);

        return ApiResponse.success(summary);
    }

    private GapReportDTO convertToDTO(GapReport report) {
        GapReportDTO dto = new GapReportDTO();
        dto.setId(report.getId());
        dto.setShelterId(report.getShelterId());
        dto.setMaterialType(report.getMaterialType());
        dto.setMaterialName(report.getMaterialName());
        dto.setRequiredQuantity(report.getRequiredQuantity());
        dto.setCurrentQuantity(report.getCurrentQuantity());
        dto.setGapQuantity(report.getGapQuantity());
        dto.setUnit(report.getUnit());
        dto.setPriority(report.getPriority());
        dto.setReason(report.getReason());
        dto.setCreatedAt(report.getCreatedAt());

        shelterRepository.findById(report.getShelterId()).ifPresent(s -> dto.setShelterName(s.getName()));
        return dto;
    }
}
