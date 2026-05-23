import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.services.llm_client import chat_completion
from app.services.llm_service import get_active_config

router = APIRouter(prefix="/api", tags=["话题分析"])


class AnalyzeRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    word_freq: dict[str, int]
    topic_clusters: dict[str, list[str]]


PROMPT_TEMPLATE = """你是一位母婴领域的内容分析专家。

以下是用户评论的高频词统计（Top 20）：
{word_freq}

以下是按主题分类的代表性评论：
{topic_comments}

请分析这些评论，提炼出 5 个最有价值的文案主题。

每个主题用 JSON 格式输出，包含以下字段：
- id：序号（1-5）
- title：主题标题（简洁有力，10字以内）
- summary：主题摘要（50-100字，说明这个主题的核心痛点和价值）
- keywords：关键词列表（3-5个）

请直接输出 JSON 数组，不要输出其他内容。格式：
[
  {{"id": 1, "title": "...", "summary": "...", "keywords": ["...", "..."]}},
  ...
]"""


def build_prompt(word_freq: dict, topic_clusters: dict) -> str:
    top_words = dict(list(word_freq.items())[:20])
    word_str = "、".join([f"{k}({v})" for k, v in top_words.items()])

    comments_str = ""
    for topic, comments in topic_clusters.items():
        sample = comments[:5]
        comments_str += f"\n【{topic}】\n"
        for c in sample:
            comments_str += f"- {c}\n"

    return PROMPT_TEMPLATE.format(word_freq=word_str, topic_comments=comments_str)


@router.post("/analyze", summary="分析并生成话题")
async def analyze_topics(body: AnalyzeRequest):
    if not get_active_config():
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中添加")

    prompt = build_prompt(body.word_freq, body.topic_clusters)

    messages = [
        {"role": "system", "content": "你是母婴领域的内容分析专家，擅长从用户评论中提炼有价值的文案主题。"},
        {"role": "user", "content": prompt},
    ]

    async def generate():
        try:
            async for chunk in await chat_completion(messages, stream=True):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
