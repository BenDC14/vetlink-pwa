import uvicorn
import os
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

port = int(os.getenv("API_PORT", 8000))

if __name__ == "__main__":
    print(f"Starting VetLink FastAPI Cloud Sync Server on http://localhost:{port}")
    print(f"Swagger API Documentation available at: http://localhost:{port}/docs")
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
