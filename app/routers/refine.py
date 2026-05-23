import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from app.services.llm_client import chat_completion
from app.services.llm_service import get_active_config

router = APIRouter(prefix="/api", tags=["文案微调"])


class RefineRequest(BaseModel):
    current_text: str = Field(..., description="当前文案全文")
    instruction: str = Field(..., description="修改意见")


SYSTEM_PROMPT = """你是一位文案润色专家，擅长根据用户意见对文案进行精准调整。

## 工作原则
1. 只修改用户要求修改的部分，其他内容保持不变
2. 保持文案的整体风格和结构
3. 如果用户要求不合理，可以适当调整但要说明原因
4. 输出修改后的完整文案，不要输出解释说明"""

USER_PROMPT_TEMPLATE = """当前文案：
{current_text}

修改意见：
{instruction}

请根据修改意见对文案进行调整，输出修改后的完整文案。"""


@router.post("/refine", summary="微调文案")
async def refine_content(body: RefineRequest):
    if not get_active_config():
        raise HTTPException(status_code=400, detail="未配置 API Key，请先在设置中添加")

    if not body.current_text.strip():
        raise HTTPException(status_code=400, detail="当前文案不能为空")

    if not body.instruction.strip():
        raise HTTPException(status_code=400, detail="修改意见不能为空")

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": USER_PROMPT_TEMPLATE.format(
            current_text=body.current_text,
            instruction=body.instruction,
        )},
    ]

    async def generate():
        try:
            async for chunk in await chat_completion(messages, stream=True):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
