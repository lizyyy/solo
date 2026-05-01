import pytest
from pathlib import Path
import tempfile
import json
import csv
import os

from dc_change_preview.readers import CSVReader, JSONReader, YAMLReader


class TestCSVReader:
    def test_read_rack_assets(self, tmp_path):
        csv_content = """device_id,name,device_type,rack_id,u_start,u_end,power_circuits,primary_switch_port,status
srv-001,Web Server,server,RACK-A01,1,2,circuit-A1;circuit-B1,port-001,online
srv-002,DB Server,server,RACK-A01,3,4,circuit-A2;circuit-B2,port-002,online"""

        csv_file = tmp_path / "rack_assets.csv"
        csv_file.write_text(csv_content)

        devices = list(CSVReader.read_rack_assets(csv_file))

        assert len(devices) == 2
        assert devices[0].device_id == "srv-001"
        assert devices[0].device_type.value == "server"
        assert devices[0].rack_id == "RACK-A01"
        assert devices[0].u_start == 1
        assert devices[0].u_end == 2
        assert len(devices[0].power_circuits) == 2

    def test_read_switch_ports(self, tmp_path):
        csv_content = """port_id,switch_id,port_name,vlan,status,connected_device_id
port-001,sw-001,Gi0/1,vlan100,occupied,srv-001
port-002,sw-001,Gi0/2,vlan100,free,"""

        csv_file = tmp_path / "switch_ports.csv"
        csv_file.write_text(csv_content)

        ports = list(CSVReader.read_switch_ports(csv_file))

        assert len(ports) == 2
        assert ports[0].port_id == "port-001"
        assert ports[0].vlan == "vlan100"
        assert ports[0].status == "occupied"
        assert ports[0].connected_device_id == "srv-001"
        assert ports[1].status == "free"
        assert ports[1].connected_device_id is None


class TestJSONReader:
    def test_read_pdu_circuits(self, tmp_path):
        json_content = {
            "pdus": [
                {
                    "pdu_id": "PDU-A01",
                    "rack_id": "RACK-A01",
                    "circuits": [
                        {"circuit_id": "circuit-A1", "phase": "A", "max_amps": 20.0, "used_amps": 8.0},
                        {"circuit_id": "circuit-B1", "phase": "B", "max_amps": 20.0, "used_amps": 5.0}
                    ]
                }
            ]
        }

        json_file = tmp_path / "pdu_circuits.json"
        with open(json_file, "w") as f:
            json.dump(json_content, f)

        pdus = JSONReader.read_pdu_circuits(json_file)

        assert len(pdus) == 1
        assert pdus[0].pdu_id == "PDU-A01"
        assert len(pdus[0].circuits) == 2
        assert pdus[0].circuits[0].circuit_id == "circuit-A1"
        assert pdus[0].circuits[0].max_amps == 20.0
        assert pdus[0].circuits[0].available_amps == 12.0


class TestYAMLReader:
    def test_read_change_plan(self, tmp_path):
        yaml_content = """
plan_id: PLAN-001
description: Test Plan

steps:
  - step_id: STEP-001
    change_type: add
    device_id: srv-001
    target_rack_id: RACK-A01
    target_u_start: 10
    target_u_end: 11
    target_switch_port: port-005
    target_vlan: vlan100
    notes: Test add
"""

        yaml_file = tmp_path / "change_plan.yaml"
        yaml_file.write_text(yaml_content)

        plan = YAMLReader.read_change_plan(yaml_file)

        assert plan.plan_id == "PLAN-001"
        assert plan.description == "Test Plan"
        assert len(plan.steps) == 1
        assert plan.steps[0].step_id == "STEP-001"
        assert plan.steps[0].change_type.value == "add"
        assert plan.steps[0].target_u_start == 10
