import json
from pathlib import Path
from typing import Any, Union

from .models import PDU, PDUCircuit, PowerPhase


class JSONReader:
    @staticmethod
    def read_pdu_circuits(json_path: Union[str, Path]) -> list[PDU]:
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)

        pdus = []
        for pdu_data in data.get("pdus", []):
            circuits = []
            for circuit_data in pdu_data.get("circuits", []):
                circuit = PDUCircuit(
                    circuit_id=circuit_data["circuit_id"],
                    pdu_id=pdu_data["pdu_id"],
                    phase=PowerPhase(circuit_data["phase"]),
                    max_amps=float(circuit_data["max_amps"]),
                    used_amps=float(circuit_data.get("used_amps", 0.0)),
                )
                circuits.append(circuit)

            pdu = PDU(
                pdu_id=pdu_data["pdu_id"],
                rack_id=pdu_data["rack_id"],
                circuits=circuits,
            )
            pdus.append(pdu)

        return pdus

    @staticmethod
    def read_switch_config(json_path: Union[str, Path]) -> dict[str, Any]:
        with open(json_path, encoding="utf-8") as f:
            return json.load(f)
