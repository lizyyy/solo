#!/usr/bin/env python3
import os
import io
from PIL import Image, ImageDraw, ImageFont
import piexif
import shutil


def create_sample_image(output_path, text="", has_exif=True, has_gps=True, gps_offset=None):
    colors = [(73, 109, 137), (100, 150, 100), (150, 100, 100), (100, 100, 150), (150, 150, 100)]
    idx = hash(text) % len(colors)
    img = Image.new('RGB', (400, 300), color=colors[idx])
    
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG')
    img_buffer.seek(0)
    
    if has_exif:
        exif_dict = {"0th": {}, "Exif": {}, "GPS": {}, "1st": {}}
        
        exif_dict["0th"][piexif.ImageIFD.Make] = b"iPhone"
        exif_dict["0th"][piexif.ImageIFD.Model] = b"iPhone 14"
        exif_dict["Exif"][piexif.ExifIFD.DateTimeOriginal] = b"2024:05:15 14:30:00"
        
        if has_gps:
            lat_deg, lat_min, lat_sec = 39, 55, 12.0
            lng_deg, lng_min, lng_sec = 116, 27, 36.0
            
            if gps_offset:
                lat_deg += gps_offset.get('lat', 0)
                lng_deg += gps_offset.get('lng', 0)
            
            exif_dict["GPS"][piexif.GPSIFD.GPSLatitudeRef] = b'N'
            exif_dict["GPS"][piexif.GPSIFD.GPSLatitude] = (
                (int(lat_deg), 1),
                (int(lat_min), 1),
                (int(lat_sec * 100), 100)
            )
            exif_dict["GPS"][piexif.GPSIFD.GPSLongitudeRef] = b'E'
            exif_dict["GPS"][piexif.GPSIFD.GPSLongitude] = (
                (int(lng_deg), 1),
                (int(lng_min), 1),
                (int(lng_sec * 100), 100)
            )
        
        exif_bytes = piexif.dump(exif_dict)
        img = Image.open(img_buffer)
        img.save(output_path, "JPEG", exif=exif_bytes)
    else:
        with open(output_path, 'wb') as f:
            f.write(img_buffer.getvalue())


def generate_corrupted_file(output_path):
    with open(output_path, 'wb') as f:
        f.write(b'corrupted data that is not a valid image')


def generate_all_samples(samples_dir="test_photos"):
    if os.path.exists(samples_dir):
        shutil.rmtree(samples_dir)
    os.makedirs(samples_dir)
    
    print(f"Generating samples to: {samples_dir}")
    
    create_sample_image(
        os.path.join(samples_dir, "BJ-001_entrance_20240515_143000.jpg"),
        text="Entrance",
        has_exif=True,
        has_gps=True
    )
    print("  ✓ BJ-001_entrance_20240515_143000.jpg - Normal with EXIF")
    
    create_sample_image(
        os.path.join(samples_dir, "BJ-001_shelves_20240515_143005.jpg"),
        text="Shelves",
        has_exif=True,
        has_gps=True
    )
    print("  ✓ BJ-001_shelves_20240515_143005.jpg - Normal with EXIF")
    
    shutil.copy(
        os.path.join(samples_dir, "BJ-001_entrance_20240515_143000.jpg"),
        os.path.join(samples_dir, "BJ-001_entrance_dup_20240515_143001.jpg")
    )
    print("  ✓ BJ-001_entrance_dup_20240515_143001.jpg - Duplicate photo")
    
    create_sample_image(
        os.path.join(samples_dir, "BJ-001_counter_noexif.jpg"),
        text="Counter noEXIF",
        has_exif=False
    )
    print("  ✓ BJ-001_counter_noexif.jpg - No EXIF data")
    
    create_sample_image(
        os.path.join(samples_dir, "BJ-001_fridge_nogps.jpg"),
        text="Fridge noGPS",
        has_exif=True,
        has_gps=False
    )
    print("  ✓ BJ-001_fridge_nogps.jpg - Has EXIF but no GPS")
    
    create_sample_image(
        os.path.join(samples_dir, "SH-002_entry_20240515_100000.jpg"),
        text="Shanghai entry",
        has_exif=True,
        has_gps=True,
        gps_offset={'lat': -8, 'lng': 5}
    )
    print("  ✓ SH-002_entry_20240515_100000.jpg - Shanghai store")
    
    create_sample_image(
        os.path.join(samples_dir, "SH-002_bad_location.jpg"),
        text="Bad location",
        has_exif=True,
        has_gps=True,
        gps_offset={'lat': 10, 'lng': 20}
    )
    print("  ✓ SH-002_bad_location.jpg - Relocation anomaly")
    
    generate_corrupted_file(os.path.join(samples_dir, "GZ-003_corrupted.jpg"))
    print("  ✓ GZ-003_corrupted.jpg - Corrupted image file")
    
    create_sample_image(
        os.path.join(samples_dir, "UNKNOWN_unknown_store.jpg"),
        text="Unknown store",
        has_exif=True,
        has_gps=True
    )
    print("  ✓ UNKNOWN_unknown_store.jpg - Cannot identify store ID")
    
    print(f"\nGenerated 8 sample files total:")
    print(f"  - Normal photos: 4")
    print(f"  - Duplicate photos: 1")
    print(f"  - No EXIF: 1")
    print(f"  - No GPS: 1")
    print(f"  - Location anomaly: 1")
    print(f"  - Corrupted file: 1")
    print(f"\nTest command: python photo_check_cli.py {samples_dir}")


if __name__ == '__main__':
    generate_all_samples()
