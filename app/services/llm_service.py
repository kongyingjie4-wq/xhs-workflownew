import json
import os
from typing import Optional
from app.models.schemas import ModelType

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "config")
LLM_CONFIG_FILE = os.path.join(CONFIG_DIR, "llm.json")

BASE_URL_MAP = {
    ModelType.mimo: "https://token-plan-cn.xiaomimimo.com/v1",
    ModelType.openai: "https://api.openai.com/v1",
}


def _read_config() -> list[dict]:
    if not os.path.exists(LLM_CONFIG_FILE):
        return []
    with open(LLM_CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_config(data: list[dict]):
    with open(LLM_CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _mask_api_key(api_key: str) -> str:
    if len(api_key) <= 11:
        return api_key[:3] + "***"
    return api_key[:7] + "..." + api_key[-4:]


def get_all_configs() -> list[dict]:
    configs = _read_config()
    result = []
    for config in configs:
        result.append({
            "id": config["id"],
            "model_type": config["model_type"],
            "api_key": _mask_api_key(config["api_key"]),
            "base_url": config["base_url"],
            "is_active": config["is_active"],
        })
    return result


def get_active_config() -> Optional[dict]:
    configs = _read_config()
    for config in configs:
        if config["is_active"]:
            return config
    return None


def add_config(model_type: ModelType, api_key: str) -> dict:
    configs = _read_config()
    new_id = max([c["id"] for c in configs], default=0) + 1
    new_config = {
        "id": new_id,
        "model_type": model_type.value,
        "api_key": api_key,
        "base_url": BASE_URL_MAP[model_type],
        "is_active": False,
    }
    configs.append(new_config)
    _write_config(configs)
    return {
        "id": new_config["id"],
        "model_type": new_config["model_type"],
        "api_key": _mask_api_key(new_config["api_key"]),
        "base_url": new_config["base_url"],
        "is_active": new_config["is_active"],
    }


def delete_config(config_id: int) -> bool:
    configs = _read_config()
    new_configs = [c for c in configs if c["id"] != config_id]
    if len(new_configs) == len(configs):
        return False
    _write_config(new_configs)
    return True


def activate_config(config_id: int) -> Optional[dict]:
    configs = _read_config()
    target_config = None
    for config in configs:
        if config["id"] == config_id:
            target_config = config
            break
    if target_config is None:
        return None
    for config in configs:
        config["is_active"] = (config["id"] == config_id)
    _write_config(configs)
    return {
        "id": target_config["id"],
        "model_type": target_config["model_type"],
        "api_key": _mask_api_key(target_config["api_key"]),
        "base_url": target_config["base_url"],
        "is_active": True,
    }
