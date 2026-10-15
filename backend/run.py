import os
import sys
from pathlib import Path
import uvicorn
from dotenv import load_dotenv

# Ensure the project root is in Python's import search path for Uvicorn reload subprocesses
ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

# Propagate to child processes spawned by Uvicorn reloader on Windows
current_pythonpath = os.environ.get("PYTHONPATH", "")
os.environ["PYTHONPATH"] = f"{str(ROOT_DIR)}{os.pathsep}{current_pythonpath}" if current_pythonpath else str(ROOT_DIR)

# Load backend/.env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.getenv("API_PORT", 8000))

if __name__ == "__main__":
    print(f"Starting VetLink FastAPI Cloud Sync Server on http://localhost:{port}")
    print(f"Swagger API Documentation available at: http://localhost:{port}/docs")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
