import chardet

BOM_SIGNATURES = [
    (b"\xef\xbb\xbf", "utf-8-sig"),
    (b"\xff\xfe", "utf-16-le"),
    (b"\xfe\xff", "utf-16-be"),
]

def detect_bom(data):
    for bom_sig, encoding in BOM_SIGNATURES:
        if data.startswith(bom_sig):
            return encoding, len(bom_sig)
    return None, 0

def detect_encoding(file_path, sample_size=100000):
    with open(file_path, "rb") as f:
        raw_data = f.read(sample_size)
    
    bom_encoding, bom_length = detect_bom(raw_data)
    has_bom = bom_encoding is not None
    
    chardet_result = chardet.detect(raw_data)
    primary_encoding = chardet_result["encoding"]
    primary_confidence = chardet_result["confidence"]
    
    candidates = []
    
    if bom_encoding:
        candidates.append({
            "encoding": bom_encoding,
            "confidence": 1.0 if primary_encoding and primary_encoding.lower().startswith("utf") else 0.95,
            "has_bom": True
        })
    
    encoding_map = {
        "gb2312": ["gb18030", "gbk", "cp936"],
        "gbk": ["gb18030", "gbk", "cp936"],
    }
    
    if primary_encoding:
        primary_lower = primary_encoding.lower()
        alt_encodings = encoding_map.get(primary_lower, [])
        
        candidates.append({
            "encoding": primary_encoding,
            "confidence": primary_confidence,
            "has_bom": has_bom
        })
        
        for alt_enc in alt_encodings:
            if alt_enc.lower() != primary_lower:
                candidates.append({
                    "encoding": alt_enc,
                    "confidence": primary_confidence * 0.7,
                    "has_bom": False
                })
    
    fallback_encodings = ["utf-8", "gb18030", "gbk", "latin-1"]
    for enc in fallback_encodings:
        if not any(c["encoding"].lower() == enc.lower() for c in candidates):
            candidates.append({
                "encoding": enc,
                "confidence": 0.3,
                "has_bom": False
            })
    
    seen = set()
    unique_candidates = []
    for c in candidates:
        key = c["encoding"].lower()
        if key not in seen:
            seen.add(key)
            unique_candidates.append(c)
    
    return sorted(unique_candidates, key=lambda x: -x["confidence"])
