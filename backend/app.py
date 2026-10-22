import os
import uvicorn
from main import app

# Export the FastAPI app instance so commands like `uvicorn app:app` work directly
__all__ = ["app"]

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "5007"))
    reload = os.getenv("RELOAD", "true").lower() in ("true", "1", "yes")

    print("=" * 60)
    print(f"🚀 Starting SmartPOS Backend Server on http://{host}:{port}")
    print(f"📖 Interactive API Documentation: http://localhost:{port}/docs")
    print(f"🔄 Auto-reload: {'Enabled' if reload else 'Disabled'}")
    print("=" * 60)

    uvicorn.run(
        "app:app",
        host=host,
        port=port,
        reload=reload
    )
