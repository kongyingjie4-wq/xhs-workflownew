from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    LLMConfigCreate,
    LLMConfigList,
    LLMConfigSingle,
    ApiResponse,
)
from app.services import llm_service

router = APIRouter(prefix="/api/settings", tags=["系统设置"])


@router.get("/llm", response_model=LLMConfigList, summary="获取所有 API Key 列表")
def get_llm_configs():
    configs = llm_service.get_all_configs()
    return LLMConfigList(data=configs)


@router.post("/llm", response_model=LLMConfigSingle, summary="添加 API Key")
def add_llm_config(body: LLMConfigCreate):
    config = llm_service.add_config(body.model_type, body.api_key)
    return LLMConfigSingle(message="添加成功", data=config)


@router.delete("/llm/{config_id}", response_model=ApiResponse, summary="删除 API Key")
def delete_llm_config(config_id: int):
    success = llm_service.delete_config(config_id)
    if not success:
        raise HTTPException(status_code=404, message="配置不存在")
    return ApiResponse(message="删除成功")


@router.put("/llm/{config_id}", response_model=LLMConfigSingle, summary="激活 API Key")
def activate_llm_config(config_id: int):
    config = llm_service.activate_config(config_id)
    if config is None:
        raise HTTPException(status_code=404, message="配置不存在")
    return LLMConfigSingle(message="激活成功", data=config)
