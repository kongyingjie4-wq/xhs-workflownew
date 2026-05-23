from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from app.routers import settings, upload, analyze, generate, refine

app = FastAPI(
    title="小红书文案生成看板",
    description="基于大模型的小红书文案自动生成系统",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings.router)
app.include_router(upload.router)
app.include_router(analyze.router)
app.include_router(generate.router)
app.include_router(refine.router)

# 静态文件服务
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")


@app.get("/", tags=["前端页面"])
def serve_frontend():
    return FileResponse(os.path.join(frontend_dir, "index.html"))


@app.get("/health", tags=["健康检查"])
def health_check():
    return {"status": "ok"}
