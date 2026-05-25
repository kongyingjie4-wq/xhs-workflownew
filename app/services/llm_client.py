import httpx
import json
from typing import AsyncGenerator
from app.services.llm_service import get_active_config


async def chat_completion(messages: list[dict], stream: bool = False) -> AsyncGenerator[str, None] | dict:
    config = get_active_config()
    if not config:
        raise ValueError("未配置 API Key，请先在设置中添加")

    base_url = config["base_url"]
    api_key = config["api_key"]
    model_type = config["model_type"]

    if model_type == "mimo":
        model = "mimo-v2-pro"
    else:
        model = "gpt-4o-mini"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "temperature": 0.7,
        "max_tokens": 2000,
    }

    if stream:
        return stream_completion(base_url, headers, payload)
    else:
        return await normal_completion(base_url, headers, payload)


async def normal_completion(base_url: str, headers: dict, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]


async def stream_completion(base_url: str, headers: dict, payload: dict) -> AsyncGenerator[str, None]:
    async with httpx.AsyncClient(timeout=60.0) as client:
        async with client.stream(
            "POST",
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    line = line[6:]
                    if line.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(line)
                        if "choices" in data and len(data["choices"]) > 0:
                            content = data["choices"][0].get("delta", {}).get("content", "")
                            if content:
                                yield content
                    except json.JSONDecodeError:
                        continue
