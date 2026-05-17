content = '''


def read_har_file(file_path, result):
    with open(file_path, "r", encoding="utf-8") as f:
        har_data = json.load(f)
    
    har_entries = har_data.get("log", {}).get("entries", [])
    
    for idx, har_entry in enumerate(har_entries):
        try:
            request_data = har_entry.get("request", {})
            headers = {h["name"]: h["value"] for h in request_data.get("headers", [])}
            
            request = {
                "method": request_data.get("method", "UNKNOWN"),
                "url": request_data.get("url", ""),
                "headers": headers,
                "body": request_data.get("postData", {}).get("text"),
                "source_type": "har",
                "source_location": f"{file_path}:entry {idx}",
            }
            
            response_data = har_entry.get("response", {})
            resp_headers = {h["name"]: h["value"] for h in response_data.get("headers", [])}
            
            response = {
                "status": response_data.get("status", 0),
                "headers": resp_headers,
                "body": response_data.get("content", {}).get("text"),
                "mimeType": response_data.get("content", {}).get("mimeType"),
                "timing": har_entry.get("time"),
            }
            
            entry = {
                "id": f"har_{idx}_{datetime.now().strftime('%H%M%S%f')}",
                "request": request,
                "response": response,
                "curl_command": generate_curl(request["method"], request["url"], headers, request["body"]),
                "is_sensitive": False,
                "sensitive_fields": [],
                "status": "success",
            }
            result["entries"].append(entry)
            
        except Exception as e:
            result["errors"].append({
                "message": f"解析HAR条目失败: {str(e)}",
                "location": f"{file_path}:entry {idx}",
                "timestamp": datetime.now().isoformat(),
            })
'''

with open("api_archive.py", "a") as f:
    f.write(content)
print(f"Appended {len(content)} bytes")
