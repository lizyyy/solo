package com.hospital.oxygen.controller;

import com.hospital.oxygen.common.ApiResponse;
import com.hospital.oxygen.entity.*;
import com.hospital.oxygen.repository.*;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/master")
public class MasterDataController {

    private final BedRepository bedRepository;
    private final PatientRepository patientRepository;
    private final OxygenPortRepository portRepository;
    private final EquipmentRepository equipmentRepository;

    public MasterDataController(BedRepository bedRepository, PatientRepository patientRepository, OxygenPortRepository portRepository, EquipmentRepository equipmentRepository) {
        this.bedRepository = bedRepository;
        this.patientRepository = patientRepository;
        this.portRepository = portRepository;
        this.equipmentRepository = equipmentRepository;
    }

    @GetMapping("/beds")
    public ApiResponse<List<Bed>> getAllBeds() {
        return ApiResponse.success(bedRepository.findAll());
    }

    @GetMapping("/beds/ward/{ward}")
    public ApiResponse<List<Bed>> getBedsByWard(@PathVariable String ward) {
        return ApiResponse.success(bedRepository.findByWard(ward));
    }

    @GetMapping("/patients")
    public ApiResponse<List<Patient>> getAllPatients() {
        return ApiResponse.success(patientRepository.findAll());
    }

    @GetMapping("/patients/{patientId}")
    public ApiResponse<Patient> getPatient(@PathVariable String patientId) {
        return patientRepository.findByPatientId(patientId)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "患者不存在"));
    }

    @GetMapping("/ports")
    public ApiResponse<List<OxygenPort>> getAllPorts() {
        return ApiResponse.success(portRepository.findAll());
    }

    @GetMapping("/ports/ward/{ward}")
    public ApiResponse<List<OxygenPort>> getPortsByWard(@PathVariable String ward) {
        return ApiResponse.success(portRepository.findByWard(ward));
    }

    @GetMapping("/ports/{portCode}")
    public ApiResponse<OxygenPort> getPort(@PathVariable String portCode) {
        return portRepository.findByPortCode(portCode)
                .map(ApiResponse::success)
                .orElse(ApiResponse.error(404, "氧气接口不存在"));
    }

    @GetMapping("/equipments")
    public ApiResponse<List<Equipment>> getAllEquipments() {
        return ApiResponse.success(equipmentRepository.findAll());
    }

    @GetMapping("/equipments/ward/{ward}")
    public ApiResponse<List<Equipment>> getEquipmentsByWard(@PathVariable String ward) {
        return ApiResponse.success(equipmentRepository.findByWard(ward));
    }
}
