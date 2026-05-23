import json
import os
from enum import Enum
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.llm_client import chat_completion
from app.services.llm_service import get_active_config

router = APIRouter(prefix="/api", tags=["文案生成"])

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config")


class RouteType(str, Enum):
    KIND_REMINDER = "KIND_REMINDER"
    MARKETING = "MARKETING"


class GenerateRequest(BaseModel):
    topic: str = Field(..., description="话题标题")
    topic_summary: str = Field(..., description="话题摘要")
    route_type: RouteType = Field(..., description="路由类型")


def read_file(filename: str) -> str:
    filepath = os.path.join(CONFIG_DIR, filename)
    if os.path.exists(filepath):
        with open(filepath, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def build_prompt(topic: str, topic_summary: str, route_type: RouteType) -> list[dict]:
    prompt_doc = read_file("prompt.md")
    advantages_doc = read_file("product_advantages.md")

    if route_type == RouteType.KIND_REMINDER:
        system_prompt = f"""{prompt_doc}

## 本次任务要求
- 你只输出科学知识和实用建议
- 绝对不提任何品牌和产品
- 内容要专业、有温度、有共情力
- 适合小红书平台发布"""
    else:
        system_prompt = f"""{prompt_doc}

## 产品优势信息
{advantages_doc}

## 本次任务要求
- 先输出科学知识建立信任
- 然后自然融入产品优势进行推荐
- 不要生硬推销，要像朋友推荐一样自然
- 适合小红书平台发布"""

    user_prompt = f"""请围绕以下主题写一篇小红书文案：

主题：{topic}
背景：{topic_summary}

要求：
1. 标题要吸引眼球，包含emoji
2. 正文分段清晰，每段不超过3句话
3. 结尾有互动引导（点赞、收藏、评论）
4. 总字数控制在300-500字

请直接输出标题和正文，不要输出其他内容。"""

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


@router.post("/generate", summary="生成初版文案")
async def generate_content(body: GenerateRequest):
    if not get_active_config():
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中添加")

    messages = build_prompt(body.topic, body.topic_summary, body.route_type)

    async def generate():
        try:
            async for chunk in await chat_completion(messages, stream=True):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
