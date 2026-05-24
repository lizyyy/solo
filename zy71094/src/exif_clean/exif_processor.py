import os
import io
import piexif
from PIL import Image
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
from pathlib import Path
from enum import Enum


class ExifStatus(Enum):
    SUCCESS = "success"
    SKIPPED = "skipped"
    CORRUPTED = "corrupted"
    ERROR = "error"
    NO_EXIF = "no_exif"


@dataclass
class ExifRecord:
    file_path: str
    line_number: int
    status: ExifStatus
    original_exif: Dict = field(default_factory=dict)
    cleaned_exif: Dict = field(default_factory=dict)
    removed_fields: List[str] = field(default_factory=list)
    preserved_fields: List[str] = field(default_factory=list)
    gps_found: bool = False
    thumbnail_issue: bool = False
    error_message: str = ""
    camera_model: str = ""
    output_path: str = ""
    processing_time: float = 0.0


@dataclass
class CleanRules:
    preserve_date: bool = True
    preserve_camera: bool = False
    preserve_orientation: bool = True
    remove_gps: bool = True
    remove_thumbnail: bool = True
    custom_preserve_fields: Set[str] = field(default_factory=set)
    custom_remove_fields: Set[str] = field(default_factory=set)


GPS_TAGS = {
    piexif.GPSIFD.GPSVersionID: "GPSVersionID",
    piexif.GPSIFD.GPSLatitudeRef: "GPSLatitudeRef",
    piexif.GPSIFD.GPSLatitude: "GPSLatitude",
    piexif.GPSIFD.GPSLongitudeRef: "GPSLongitudeRef",
    piexif.GPSIFD.GPSLongitude: "GPSLongitude",
    piexif.GPSIFD.GPSAltitudeRef: "GPSAltitudeRef",
    piexif.GPSIFD.GPSAltitude: "GPSAltitude",
    piexif.GPSIFD.GPSTimeStamp: "GPSTimeStamp",
    piexif.GPSIFD.GPSSatellites: "GPSSatellites",
    piexif.GPSIFD.GPSStatus: "GPSStatus",
    piexif.GPSIFD.GPSMeasureMode: "GPSMeasureMode",
    piexif.GPSIFD.GPSDOP: "GPSDOP",
    piexif.GPSIFD.GPSSpeedRef: "GPSSpeedRef",
    piexif.GPSIFD.GPSSpeed: "GPSSpeed",
    piexif.GPSIFD.GPSTrackRef: "GPSTrackRef",
    piexif.GPSIFD.GPSTrack: "GPSTrack",
    piexif.GPSIFD.GPSImgDirectionRef: "GPSImgDirectionRef",
    piexif.GPSIFD.GPSImgDirection: "GPSImgDirection",
    piexif.GPSIFD.GPSMapDatum: "GPSMapDatum",
    piexif.GPSIFD.GPSDestLatitudeRef: "GPSDestLatitudeRef",
    piexif.GPSIFD.GPSDestLatitude: "GPSDestLatitude",
    piexif.GPSIFD.GPSDestLongitudeRef: "GPSDestLongitudeRef",
    piexif.GPSIFD.GPSDestLongitude: "GPSDestLongitude",
    piexif.GPSIFD.GPSDestBearingRef: "GPSDestBearingRef",
    piexif.GPSIFD.GPSDestBearing: "GPSDestBearing",
    piexif.GPSIFD.GPSDestDistanceRef: "GPSDestDistanceRef",
    piexif.GPSIFD.GPSDestDistance: "GPSDestDistance",
    piexif.GPSIFD.GPSProcessingMethod: "GPSProcessingMethod",
    piexif.GPSIFD.GPSAreaInformation: "GPSAreaInformation",
    piexif.GPSIFD.GPSDateStamp: "GPSDateStamp",
    piexif.GPSIFD.GPSDifferential: "GPSDifferential",
}

DATE_TAGS = {
    piexif.ExifIFD.DateTimeOriginal: "DateTimeOriginal",
    piexif.ExifIFD.DateTimeDigitized: "DateTimeDigitized",
}

IMAGE_DATE_TAGS = {
    piexif.ImageIFD.DateTime: "DateTime",
}

DEVICE_TAGS = {
    piexif.ImageIFD.Make: "Make",
    piexif.ImageIFD.Model: "Model",
    piexif.ImageIFD.Software: "Software",
    piexif.ExifIFD.LensMake: "LensMake",
    piexif.ExifIFD.LensModel: "LensModel",
    piexif.ExifIFD.LensSerialNumber: "LensSerialNumber",
    piexif.ExifIFD.BodySerialNumber: "BodySerialNumber",
}

ORIENTATION_TAG = piexif.ImageIFD.Orientation


class ExifProcessor:
    def __init__(self, rules: Optional[CleanRules] = None):
        self.rules = rules or CleanRules()
        self.records: List[ExifRecord] = []
        self._line_counter = 0

    def _get_tag_name(self, ifd: str, tag: int) -> str:
        tag_maps = {
            "0th": piexif.TAGS["0th"],
            "Exif": piexif.TAGS["Exif"],
            "GPS": GPS_TAGS,
            "1st": piexif.TAGS["1st"],
            "thumbnail": {"name": "thumbnail"},
        }
        if ifd in tag_maps and tag in tag_maps[ifd]:
            name = tag_maps[ifd][tag]
            if isinstance(name, dict):
                return name.get("name", str(tag))
            return name
        return str(tag)

    def _has_gps_data(self, exif_dict: Dict) -> bool:
        if "GPS" not in exif_dict:
            return False
        return bool(exif_dict["GPS"])

    def _has_thumbnail_metadata(self, exif_dict: Dict) -> bool:
        if "1st" in exif_dict and exif_dict["1st"]:
            return True
        if "thumbnail" in exif_dict and exif_dict["thumbnail"]:
            return True
        return False

    def read_exif(self, file_path: str) -> Tuple[Optional[Dict], Optional[str]]:
        try:
            with Image.open(file_path) as img:
                if "exif" not in img.info:
                    return None, None
                exif_bytes = img.info["exif"]
                exif_dict = piexif.load(exif_bytes)
                return exif_dict, None
        except Exception as e:
            return None, str(e)

    def _get_camera_model(self, exif_dict: Dict) -> str:
        make = exif_dict.get("0th", {}).get(piexif.ImageIFD.Make, b"").decode("utf-8", errors="ignore").strip()
        model = exif_dict.get("0th", {}).get(piexif.ImageIFD.Model, b"").decode("utf-8", errors="ignore").strip()
        if make and model:
            return f"{make} {model}"
        return model or make or ""

    def clean_exif(self, exif_dict: Dict, record: ExifRecord) -> Dict:
        cleaned = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None}
        
        gps_found = self._has_gps_data(exif_dict)
        record.gps_found = gps_found
        
        thumbnail_issue = self._has_thumbnail_metadata(exif_dict)
        record.thumbnail_issue = thumbnail_issue

        if self.rules.remove_gps and gps_found:
            for tag in exif_dict.get("GPS", {}):
                tag_name = self._get_tag_name("GPS", tag)
                record.removed_fields.append(f"GPS:{tag_name}")
            cleaned["GPS"] = {}

        if self.rules.remove_thumbnail:
            cleaned["1st"] = {}
            cleaned["thumbnail"] = None
            if thumbnail_issue:
                record.removed_fields.append("thumbnail")

        for tag, value in exif_dict.get("0th", {}).items():
            tag_name = self._get_tag_name("0th", tag)
            
            if tag == ORIENTATION_TAG and self.rules.preserve_orientation:
                cleaned["0th"][tag] = value
                record.preserved_fields.append(f"0th:{tag_name}")
                continue
            
            if tag in IMAGE_DATE_TAGS and self.rules.preserve_date:
                cleaned["0th"][tag] = value
                record.preserved_fields.append(f"0th:{tag_name}")
                continue
            
            if tag in DEVICE_TAGS.values():
                if not self.rules.preserve_camera:
                    record.removed_fields.append(f"0th:{tag_name}")
                    continue
            
            if tag_name in self.rules.custom_preserve_fields:
                cleaned["0th"][tag] = value
                record.preserved_fields.append(f"0th:{tag_name}")
                continue
            
            if tag_name in self.rules.custom_remove_fields:
                record.removed_fields.append(f"0th:{tag_name}")
                continue
            
            record.removed_fields.append(f"0th:{tag_name}")

        for tag, value in exif_dict.get("Exif", {}).items():
            tag_name = self._get_tag_name("Exif", tag)
            
            if tag in DATE_TAGS and self.rules.preserve_date:
                cleaned["Exif"][tag] = value
                record.preserved_fields.append(f"Exif:{tag_name}")
                continue
            
            if tag in DEVICE_TAGS.values():
                if not self.rules.preserve_camera:
                    record.removed_fields.append(f"Exif:{tag_name}")
                    continue
            
            if tag_name in self.rules.custom_preserve_fields:
                cleaned["Exif"][tag] = value
                record.preserved_fields.append(f"Exif:{tag_name}")
                continue
            
            if tag_name in self.rules.custom_remove_fields:
                record.removed_fields.append(f"Exif:{tag_name}")
                continue
            
            record.removed_fields.append(f"Exif:{tag_name}")

        return cleaned

    def verify_cleaned_exif(self, exif_dict: Dict) -> Tuple[bool, List[str]]:
        issues = []
        
        if self.rules.remove_gps and exif_dict.get("GPS"):
            for tag in exif_dict["GPS"]:
                tag_name = self._get_tag_name("GPS", tag)
                issues.append(f"残留GPS字段: GPS:{tag_name}")
        
        if self.rules.remove_thumbnail:
            if exif_dict.get("1st"):
                issues.append("残留缩略图IFD数据")
            if exif_dict.get("thumbnail"):
                issues.append("残留缩略图数据")
        
        return (len(issues) == 0, issues)

    def process_image(
        self,
        input_path: str,
        output_path: Optional[str] = None,
    ) -> ExifRecord:
        import time
        start_time = time.time()
        
        self._line_counter += 1
        record = ExifRecord(
            file_path=os.path.abspath(input_path),
            line_number=self._line_counter,
            status=ExifStatus.SUCCESS,
        )

        try:
            if not os.path.exists(input_path):
                record.status = ExifStatus.ERROR
                record.error_message = "文件不存在"
                record.processing_time = time.time() - start_time
                self.records.append(record)
                return record

            if not self._is_valid_image(input_path):
                record.status = ExifStatus.CORRUPTED
                record.error_message = "图片损坏或格式不支持"
                record.processing_time = time.time() - start_time
                self.records.append(record)
                return record

            exif_dict, error = self.read_exif(input_path)
            if error:
                record.status = ExifStatus.CORRUPTED
                record.error_message = f"读取EXIF失败: {error}"
                record.processing_time = time.time() - start_time
                self.records.append(record)
                return record

            if exif_dict is None:
                record.status = ExifStatus.NO_EXIF
                self._copy_file(input_path, output_path)
                record.output_path = os.path.abspath(output_path) if output_path else record.file_path
                record.processing_time = time.time() - start_time
                self.records.append(record)
                return record

            record.original_exif = self._exif_to_serializable(exif_dict)
            record.camera_model = self._get_camera_model(exif_dict)

            cleaned_exif = self.clean_exif(exif_dict, record)

            verify_ok, verify_issues = self.verify_cleaned_exif(cleaned_exif)
            if not verify_ok:
                record.error_message = "复检发现残留: " + "; ".join(verify_issues)

            record.cleaned_exif = self._exif_to_serializable(cleaned_exif)

            if output_path:
                self._save_image_with_exif(input_path, output_path, cleaned_exif)
                record.output_path = os.path.abspath(output_path)

        except Exception as e:
            record.status = ExifStatus.ERROR
            record.error_message = str(e)

        record.processing_time = time.time() - start_time
        self.records.append(record)
        return record

    def _is_valid_image(self, file_path: str) -> bool:
        try:
            with Image.open(file_path) as img:
                img.verify()
            return True
        except Exception:
            return False

    def _copy_file(self, input_path: str, output_path: Optional[str]):
        if output_path and output_path != input_path:
            import shutil
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            shutil.copy2(input_path, output_path)

    def _save_image_with_exif(self, input_path: str, output_path: str, exif_dict: Dict):
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with Image.open(input_path) as img:
            if any(exif_dict.values()):
                try:
                    exif_bytes = piexif.dump(exif_dict)
                    img.save(output_path, exif=exif_bytes)
                except Exception:
                    img.save(output_path)
            else:
                data = list(img.getdata())
                new_img = Image.new(img.mode, img.size)
                new_img.putdata(data)
                new_img.save(output_path)

    def _exif_to_serializable(self, exif_dict: Dict) -> Dict:
        result = {}
        for ifd, data in exif_dict.items():
            if ifd == "thumbnail":
                continue
            result[ifd] = {}
            if isinstance(data, dict):
                for tag, value in data.items():
                    tag_name = self._get_tag_name(ifd, tag)
                    if isinstance(value, bytes):
                        result[ifd][tag_name] = value.decode("utf-8", errors="replace")[:100]
                    elif isinstance(value, tuple):
                        result[ifd][tag_name] = str(value)
                    else:
                        result[ifd][tag_name] = str(value)[:100]
        return result

    def batch_process(
        self,
        input_dir: str,
        output_dir: Optional[str] = None,
        extensions: Optional[List[str]] = None,
    ) -> List[ExifRecord]:
        if extensions is None:
            extensions = [".jpg", ".jpeg", ".png", ".tiff", ".webp"]
        
        extensions = [ext.lower() for ext in extensions]
        input_path = Path(input_dir)
        
        if not input_path.exists():
            raise FileNotFoundError(f"输入目录不存在: {input_dir}")

        for file_path in sorted(input_path.rglob("*")):
            if file_path.is_file() and file_path.suffix.lower() in extensions:
                rel_path = file_path.relative_to(input_path)
                if output_dir:
                    output_path = str(Path(output_dir) / rel_path)
                else:
                    output_path = None
                
                self.process_image(str(file_path), output_path)

        return self.records
