# 开发笔记 - 前后端对齐

## 一、项目概述
- 小红书文案生成看板
- 后端：FastAPI
- 前端：待开发（后端测试完成后）

## 二、第一阶段：数据导入模块

### 后端接口
- `POST /api/upload`：上传 .jsonl 文件
- 请求：`multipart/form-data`，参数 `file`（.jsonl 文件）
- 返回：
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "total_lines": 766,
    "valid_lines": 765,
    "invalid_lines": 1,
    "contents": ["第一条内容", "第二条内容", ...],  // 最多返回100条
    "word_freq": {"追奶": 152, "老师": 92, "母乳": 91, ...},  // Top 50 高频词
    "topic_clusters": {
      "追奶方法": ["评论1", "评论2", ...],  // 每个主题最多20条代表性评论
      "母乳喂养": ["评论1", "评论2", ...],
      ...
    }
  }
}
```

### 前端实现要点
1. **文件上传组件**：
   - 支持拖拽和点击选择
   - 只接受 `.jsonl` 文件
   - 文件大小限制：10MB

2. **上传成功后展示**：
   - 统计信息：总行数、有效行数、无效行数
   - 高频词展示：表格或词云形式
   - 内容预览：显示前 5-10 条内容（可滚动）
   - 按钮：「开始分析」解锁，进入第二阶段

3. **错误处理**：
   - 文件格式错误：提示"只支持 .jsonl 文件"
   - 文件为空：提示"文件不能为空"
   - 无有效数据：提示"文件中没有有效数据"

4. **技术要点**：
   - 使用 `FormData` 上传文件
   - 使用 `fetch` 或 `axios` 发送请求
   - 响应类型：`application/json`

## 三、第二阶段：话题分析模块

### 后端接口
- `POST /api/analyze`：分析并生成话题
- 请求体：
```json
{
  "word_freq": {"追奶": 152, "母乳": 91, ...},
  "topic_clusters": {
    "追奶方法": ["评论1", "评论2", ...],
    "母乳喂养": ["评论1", "评论2", ...],
    ...
  }
}
```
- 返回（SSE 流式）：
```
data: {"chunk": "[\n  {\"id\": 1, \"title\": \"追奶方法\", ..."}
data: {"chunk": ",\n  {\"id\": 2, \"title\": \"母乳喂养\", ..."}
...
data: {"done": true}
```

### 后端逻辑
1. 组装 Prompt：高频词 + 每个主题的代表性评论
2. 调用大模型（使用激活的 API Key）
3. 流式返回 5 个主题卡片（JSON 数组）

### 前端实现要点
1. **触发方式**：点击「开始分析」按钮
2. **流式接收**：使用 `EventSource` 或 `fetch` + `ReadableStream`
3. **数据拼接**：将所有 `chunk` 拼接成完整 JSON 字符串
4. **JSON 解析**：拼接完成后解析 JSON 数组
5. **卡片渲染**：每解析出一个主题，立即渲染一张卡片
6. **卡片内容**：
   - 标题（title）
   - 摘要（summary）
   - 关键词标签（keywords）
7. **交互**：
   - 点击卡片选中/取消选中（支持多选）
   - 选中后高亮显示
8. **按钮**：「确认选题」解锁，进入第三阶段

### 错误处理
| 场景 | 返回 |
|------|------|
| 未配置 API Key | `{"detail": "未配置 API Key，请先在设置中添加"}` |
| 大模型调用失败 | `{"error": "错误信息"}` |

## 四、第三阶段：文案生成模块

### 后端接口
- `POST /api/generate`：SSE 流式生成初版文案
- 请求体：
```json
{
  "topic": "追奶方法",
  "topic_summary": "多位宝妈反馈奶量不足，希望通过科学方法追奶...",
  "route_type": "KIND_REMINDER"  // 或 "MARKETING"
}
```
- 返回（SSE 流式）：
```
data: {"chunk": "标题："}
data: {"chunk": "宝妈必看！5个科学追奶方法"}
data: {"chunk": "\n\n正文："}
data: {"chunk": "很多新手妈妈都会遇到奶量不足的问题..."}
...
data: {"done": true}
```

### 后端逻辑
1. 读取配置文件：`prompt.md` + `product_advantages.md`
2. 根据 route_type 组装 Prompt：
   - KIND_REMINDER：只输出科学知识，不提品牌
   - MARKETING：先科普建立信任，再自然融入产品卖点
3. 调用大模型，SSE 流式返回标题和正文

### 前端实现要点
1. **触发方式**：用户选择话题 + 点击路由按钮
2. **路由选择**：两个单选按钮
   - [生成纯科普文案] → `route_type: "KIND_REMINDER"`
   - [生成科普+营销文案] → `route_type: "MARKETING"`
3. **流式接收**：使用 `EventSource` 或 `fetch` + `ReadableStream`
4. **文本框**：实时渲染大模型返回的内容
5. **按钮**：「一键复制文案」
6. **草稿保存**：生成完成后自动保存到 localStorage

### 错误处理
| 场景 | 返回 |
|------|------|
| 未配置 API Key | `{"detail": "未配置 API Key"}` |
| 大模型调用失败 | `{"error": "错误信息"}` |

## 五、第四阶段：文案微调模块

### 后端接口
- `POST /api/refine`：SSE 流式微调文案
- 请求体：
```json
{
  "current_text": "当前文案全文...",
  "instruction": "把第二段写得更温柔一点"
}
```
- 返回（SSE 流式）：
```
data: {"chunk": "标题："}
data: {"chunk": "宝妈必看！5个科学追奶方法（修改版）"}
data: {"chunk": "\n\n正文："}
data: {"chunk": "很多新手妈妈都会遇到奶量不足的问题，别担心..."}
...
data: {"done": true}
```

### 后端逻辑
1. 系统提示：文案润色专家，只修改用户要求的部分
2. 用户提示：当前文案 + 修改意见
3. 调用大模型，SSE 流式返回修改后的完整文案

### 前端实现要点
1. **触发方式**：用户在 Chat 对话框输入修改意见，点击发送
2. **流式接收**：使用 `EventSource` 或 `fetch` + `ReadableStream`
3. **文本框**：实时渲染修改后的文案（覆盖原内容）
4. **对话历史**：可选显示最近 N 轮修改记录
5. **草稿保存**：每次修改后自动保存到 localStorage
6. **按钮**：「一键复制文案」

### 错误处理
| 场景 | 返回 |
|------|------|
| 未配置 API Key | `{"detail": "未配置 API Key"}` |
| 当前文案为空 | `{"detail": "当前文案不能为空"}` |
| 修改意见为空 | `{"detail": "修改意见不能为空"}` |
| 大模型调用失败 | `{"error": "错误信息"}` |

## 六、系统设置模块

### 后端接口
- `GET /api/settings/llm`：获取所有 API Key
- `POST /api/settings/llm`：添加 API Key
- `DELETE /api/settings/llm/{id}`：删除 API Key
- `PUT /api/settings/llm/{id}`：激活 API Key

### 前端注意事项
- API Key 列表：表格展示，含序号、模型类型、API Key（脱敏）、激活状态
- 操作按钮：添加、删除、激活
- 激活逻辑：激活一个自动取消其他激活

## 七、文件存储结构
```
config/
├── llm.json                    # LLM 配置存储
├── product_advantages.md       # 产品优势文档
└── prompt.md                   # 提示词文档
```

## 八、技术要点
- 流式响应：SSE（Server-Sent Events）
- 接口格式：统一 `{code, message, data}`
- 多会话：支持多标签页，每页独立 session_id
- 草稿恢复：localStorage 存储，key 格式 `draft_{session_id}`
