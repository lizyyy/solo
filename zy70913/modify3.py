import os

with open("app/api/endpoints.py", "r") as f:
    content = f.read()

old = "        created = ImportService.create_grievance_records(db, batch, grievance_list)"
new = """        flight_map = None
        if flight_file:
            flight_content = await flight_file.read()
            flight_map = ImportService.parse_flights_json(flight_content)
        
        photo_map = None
        if photo_file:
            photo_content = await photo_file.read()
            photo_map = ImportService.parse_photos_json(photo_content)
        
        created = ImportService.create_grievance_records(db, batch, grievance_list, flight_map, photo_map)"""

content = content.replace(old, new)
print("修改3完成")

with open("app/api/endpoints.py", "w") as f:
    f.write(content)
print("文件已保存")
