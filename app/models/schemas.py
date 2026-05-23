from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional


class ModelType(str, Enum):
    mimo = "mimo"
    openai = "openai"


class LLMConfigCreate(BaseModel):
    model_config = {"protected_namespaces": ()}
    model_type: ModelType = Field(..., description="模型类型")
    api_key: str = Field(..., min_length=10, description="API Key，至少10个字符")


class LLMConfigResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    id: int
    model_type: ModelType
    api_key: str  # 脱敏显示
    base_url: str
    is_active: bool


class LLMConfigList(BaseModel):
    code: int = 200
    message: str = "success"
    data: list[LLMConfigResponse]


class LLMConfigSingle(BaseModel):
    code: int = 200
    message: str = "success"
    data: LLMConfigResponse


class ApiResponse(BaseModel):
    code: int = 200
    message: str = "success"
    data: Optional[dict | list | None] = None
