# 项目规则 - 小红书文案生成看板

## 项目概述
- 后端：FastAPI + SSE 流式响应
- 前端：原生 HTML/CSS/JavaScript
- 功能：数据导入、话题分析、文案生成、文案微调

## 开发流程规则

### 代码修改
1. 改了后端数据结构，必须同步更新前端
2. 改了接口返回值，必须更新 DEV_NOTES.md
3. 改了 CSS 样式，要检查优先级冲突
4. 改了 JavaScript 事件绑定，要验证是否生效

### 测试要求
1. 后端接口改完，用 curl 测试返回值
2. 前端改完，用浏览器测试交互
3. 发现问题要分析根本原因，不要只改表面
4. 每次修改后重启服务再测试

### 数据一致性
1. 后端返回的字段名要和前端读取的一致
2. 数据处理要考虑去重和边界情况
3. 弹窗/模态框默认要隐藏，用 `.hidden` class

## 常见错误及避免

### CSS 优先级问题
- 问题：`.modal` 的 `display: flex` 覆盖 `.hidden` 的 `display: none`
- 解决：使用 `.modal.hidden` 组合选择器提高优先级

### 数据字段不一致
- 问题：后端返回 `word_comments`，前端读取 `word_comments`
- 解决：改了后端要同步前端，改了前端要同步后端

### 事件绑定不生效
- 问题：动态生成的元素没有绑定事件
- 解解：在元素生成后立即绑定事件

## 文件结构
```
xhs-view/
├── app/
│   ├── main.py              # 主入口
│   ├── routers/             # 路由
│   ├── models/              # 数据模型
│   └── services/            # 服务层
├── config/                  # 配置文件
├── frontend/                # 前端代码
├── DEV_NOTES.md             # 开发文档
└── CLAUDE.md                # 本文件
```

## 测试命令
```bash
# 启动服务
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# 测试接口
curl http://localhost:8000/health
```
