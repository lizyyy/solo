import subprocess
import re
from typing import Dict, Any, List, Optional
from pathlib import Path

class SignatureVerifier:
    def __init__(self):
        self.codesign_available = self._check_codesign()

    def _check_codesign(self) -> bool:
        try:
            result = subprocess.run(
                ['which', 'codesign'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except:
            return False

    def verify_signature(self, file_path: str) -> Dict[str, Any]:
        result = {
            "has_signature": False,
            "signature_valid": False,
            "signing_identity": None,
            "team_identifier": None,
            "bundle_identifier": None,
            "authority": [],
            "entitlements": None,
            "flags": [],
            "errors": []
        }

        if not self.codesign_available:
            result["errors"].append("codesign tool not available (not on macOS?)")
            return result

        path = Path(file_path)
        if not path.exists() or not path.is_file():
            result["errors"].append("File does not exist or is not a file")
            return result

        try:
            self._check_signature_presence(str(path), result)
            if result["has_signature"]:
                self._verify_signature_validity(str(path), result)
                self._extract_signing_info(str(path), result)
                self._extract_entitlements(str(path), result)
        except Exception as e:
            result["errors"].append(f"Signature verification error: {str(e)}")

        return result

    def _check_signature_presence(self, file_path: str, result: Dict[str, Any]) -> None:
        try:
            check_result = subprocess.run(
                ['codesign', '--display', file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            if check_result.returncode == 0:
                result["has_signature"] = True
                self._parse_display_output(check_result.stdout, result)
        except subprocess.TimeoutExpired:
            result["errors"].append("Signature check timed out")
        except Exception as e:
            pass

    def _parse_display_output(self, stdout: str, result: Dict[str, Any]) -> None:
        lines = stdout.strip().split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('Identifier='):
                result["bundle_identifier"] = line.split('=', 1)[1]
            elif line.startswith('Format='):
                result["format"] = line.split('=', 1)[1]
            elif line.startswith('Authority='):
                authority = line.split('=', 1)[1]
                result["authority"].append(authority)
                if "Developer ID Application" in authority or "Apple Distribution" in authority:
                    match = re.search(r'\(([A-Z0-9]+)\)', authority)
                    if match:
                        result["team_identifier"] = match.group(1)

    def _verify_signature_validity(self, file_path: str, result: Dict[str, Any]) -> None:
        try:
            verify_result = subprocess.run(
                ['codesign', '--verify', '--verbose', file_path],
                capture_output=True,
                text=True,
                timeout=60
            )
            result["signature_valid"] = verify_result.returncode == 0
            if verify_result.stderr:
                result["verify_output"] = verify_result.stderr
        except subprocess.TimeoutExpired:
            result["errors"].append("Signature verification timed out")
        except Exception as e:
            result["errors"].append(f"Verification error: {str(e)}")

    def _extract_signing_info(self, file_path: str, result: Dict[str, Any]) -> None:
        try:
            info_result = subprocess.run(
                ['codesign', '--display', '--verbose=4', file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            if info_result.stderr:
                self._parse_verbose_output(info_result.stderr, result)
        except subprocess.TimeoutExpired:
            result["errors"].append("Signing info extraction timed out")
        except Exception as e:
            result["errors"].append(f"Signing info extraction error: {str(e)}")

    def _parse_verbose_output(self, stderr: str, result: Dict[str, Any]) -> None:
        lines = stderr.strip().split('\n')
        for line in lines:
            line = line.strip()
            if 'Signed Time=' in line:
                result["signed_time"] = line.split('=', 1)[1]
            elif 'Info.plist entries=' in line:
                result["info_plist_entries"] = line.split('=', 1)[1]
            elif 'TeamIdentifier=' in line:
                result["team_identifier"] = line.split('=', 1)[1]
            elif 'Sealed Resources=' in line:
                result["sealed_resources"] = line.split('=', 1)[1]
            elif 'Internal requirements count=' in line:
                result["internal_requirements"] = line.split('=', 1)[1]

    def _extract_entitlements(self, file_path: str, result: Dict[str, Any]) -> None:
        try:
            ent_result = subprocess.run(
                ['codesign', '--display', '--entitlements', ':-', file_path],
                capture_output=True,
                text=True,
                timeout=30
            )
            if ent_result.returncode == 0 and ent_result.stdout and ent_result.stdout.strip():
                result["entitlements"] = ent_result.stdout.strip()
        except subprocess.TimeoutExpired:
            result["errors"].append("Entitlements extraction timed out")
        except Exception as e:
            pass

    def get_certificate_info(self, file_path: str) -> Dict[str, Any]:
        cert_info = {
            "certificates": [],
            "errors": []
        }

        if not self.codesign_available:
            cert_info["errors"].append("codesign tool not available")
            return cert_info

        try:
            result = subprocess.run(
                ['codesign', '--display', '--extract-certificates', file_path],
                capture_output=True,
                text=True,
                timeout=30,
                cwd='/tmp'
            )
            if result.returncode == 0:
                cert_info["extracted"] = True
        except Exception as e:
            cert_info["errors"].append(f"Certificate extraction error: {str(e)}")

        return cert_info

    def batch_verify(self, file_paths: List[str]) -> Dict[str, Dict[str, Any]]:
        results = {}
        for file_path in sorted(file_paths):
            results[file_path] = self.verify_signature(file_path)
        return results
