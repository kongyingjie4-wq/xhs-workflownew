import json
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models.schemas import ApiResponse
from app.services.text_processor import process_contents

router = APIRouter(prefix="/api", tags=["数据导入"])

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload", summary="上传 .jsonl 文件")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(".jsonl"):
        raise HTTPException(status_code=400, detail="只支持 .jsonl 文件")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="文件不能为空")

    text = content.decode("utf-8")
    lines = text.strip().split("\n")

    total_lines = len(lines)
    valid_lines = 0
    invalid_lines = 0
    contents = []

    for line in lines:
        line = line.strip()
        if not line:
            invalid_lines += 1
            continue
        try:
            data = json.loads(line)
            if "content" in data and data["content"]:
                contents.append(data["content"])
                valid_lines += 1
            else:
                invalid_lines += 1
        except json.JSONDecodeError:
            invalid_lines += 1

    if valid_lines == 0:
        raise HTTPException(status_code=400, detail="文件中没有有效数据")

    analysis = process_contents(contents)

    return {
        "code": 200,
        "message": "上传成功",
        "data": {
            "total_lines": total_lines,
            "valid_lines": valid_lines,
            "invalid_lines": invalid_lines,
            "contents": contents[:100],
            "word_freq": analysis["word_freq"],
            "word_comments": analysis["word_comments"],
            "topic_clusters": analysis["topic_clusters"],
        },
    }
