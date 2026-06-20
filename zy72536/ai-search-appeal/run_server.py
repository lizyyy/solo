import uvicorn
uvicorn.run("backend.main:app", host="0.0.0.0", port=8001, log_level="info")
