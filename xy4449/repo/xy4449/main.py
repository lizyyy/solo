import asyncio
import uvicorn
from config import settings, ensure_dirs
from scanner.file_watcher import FileScanner
from web.app import create_app


def main():
    ensure_dirs()
    
    app = create_app()
    scanner = FileScanner()
    
    async def run_app():
        config = uvicorn.Config(
            app,
            host=settings.HOST,
            port=settings.PORT,
            log_level="info"
        )
        server = uvicorn.Server(config)
        
        scanner_task = asyncio.create_task(scanner.start())
        
        await server.serve()
        scanner_task.cancel()
        try:
            await scanner_task
        except asyncio.CancelledError:
            pass
    
    asyncio.run(run_app())


if __name__ == "__main__":
    main()
