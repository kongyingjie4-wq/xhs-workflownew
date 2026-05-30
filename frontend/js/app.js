// 全局状态
const state = {
    uploadData: null,
    selectedTopics: [], // 改成数组，支持多选
    currentText: '',
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initSettings();
    initUpload();
    initAnalyze();
    initGenerate();
    initRefine();
    initModal();
    loadKeys();
});

// 导航切换
function initNav() {
    document.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`page-${page}`).classList.add('active');
        });
    });
}

// 设置页面
function initSettings() {
    document.getElementById('btn-add-key').addEventListener('click', addKey);
    document.getElementById('btn-save-advantages').addEventListener('click', saveAdvantages);
    document.getElementById('btn-save-prompt').addEventListener('click', savePrompt);
}

async function loadKeys() {
    try {
        const result = await settingsApi.getKeys();
        renderKeys(result.data);
    } catch (error) {
        showMessage('加载 API Key 失败: ' + error.message);
    }
}

function renderKeys(keys) {
    const tbody = document.querySelector('#key-table tbody');
    tbody.innerHTML = keys.map((key, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><span class="badge bg-info">${key.model_type}</span></td>
            <td><code>${key.api_key}</code></td>
            <td>${key.is_active ? '<span class="badge bg-success">已激活</span>' : '<span class="badge bg-secondary">未激活</span>'}</td>
            <td>
                <button onclick="activateKey(${key.id})" class="btn btn-sm btn-primary me-1" ${key.is_active ? 'disabled' : ''}>激活</button>
                <button onclick="deleteKey(${key.id})" class="btn btn-sm btn-danger">删除</button>
            </td>
        </tr>
    `).join('');
}

async function addKey() {
    const model_type = document.getElementById('model-type').value;
    const api_key = document.getElementById('api-key').value;

    if (api_key.length < 10) {
        showMessage('API Key 至少10个字符');
        return;
    }

    try {
        await settingsApi.addKey(model_type, api_key);
        document.getElementById('api-key').value = '';
        loadKeys();
        showMessage('添加成功');
    } catch (error) {
        showMessage('添加失败: ' + error.message);
    }
}

async function deleteKey(id) {
    if (!confirm('确定删除此 API Key？')) return;
    try {
        await settingsApi.deleteKey(id);
        loadKeys();
        showMessage('删除成功');
    } catch (error) {
        showMessage('删除失败: ' + error.message);
    }
}

async function activateKey(id) {
    try {
        await settingsApi.activateKey(id);
        loadKeys();
        showMessage('激活成功');
    } catch (error) {
        showMessage('激活失败: ' + error.message);
    }
}

async function saveAdvantages() {
    // 后端暂未实现保存接口，提示用户手动编辑文件
    showMessage('请直接编辑 config/product_advantages.md 文件');
}

async function savePrompt() {
    showMessage('请直接编辑 config/prompt.md 文件');
}

// 数据导入页面
function initUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) uploadFile(file);
    });

    document.getElementById('btn-analyze').addEventListener('click', startAnalyze);
    document.getElementById('btn-auto-generate').addEventListener('click', startAutoGenerate);
}

async function uploadFile(file) {
    if (!file.name.endsWith('.jsonl')) {
        showMessage('只支持 .jsonl 文件');
        return;
    }

    try {
        const result = await uploadApi.upload(file);
        state.uploadData = result.data;
        renderUploadResult(result.data);
        showMessage('上传成功');
    } catch (error) {
        showMessage('上传失败: ' + error.message);
    }
}

function renderUploadResult(data) {
    document.getElementById('stat-total').textContent = data.total_lines;
    document.getElementById('stat-valid').textContent = data.valid_lines;
    document.getElementById('stat-invalid').textContent = data.invalid_lines;

    const wordFreq = document.getElementById('word-freq');
    const wordEntries = Object.entries(data.word_freq).slice(0, 20);

    wordFreq.innerHTML = wordEntries
        .map(([word, count]) => `<span class="badge bg-primary cursor-pointer" data-word="${word}" style="cursor:pointer;">${word} (${count})</span>`)
        .join('');

    // 给高频词标签添加点击事件
    wordFreq.querySelectorAll('.badge').forEach(tag => {
        tag.addEventListener('click', () => {
            const word = tag.dataset.word;
            const comments = data.word_comments[word] || [];
            showModal(word, comments);
        });
    });

    const preview = document.getElementById('content-preview');
    preview.innerHTML = data.contents
        .slice(0, 10)
        .map(content => `<div class="p-2 border-bottom">${content}</div>`)
        .join('');

    document.getElementById('upload-result').classList.remove('hidden');
}

// 话题分析页面
function initAnalyze() {
    document.getElementById('btn-confirm-topic').addEventListener('click', confirmTopic);
}

async function startAnalyze() {
    if (!state.uploadData) {
        showMessage('请先上传数据');
        return;
    }

    // 切换到分析页面
    document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="analyze"]').classList.add('active');
    document.getElementById('page-analyze').classList.add('active');

    // 直接用高频词作为主题，不需要大模型分析
    renderTopicKeywords(state.uploadData.word_freq);
    document.getElementById('btn-confirm-topic').classList.remove('hidden');
}

async function startAutoGenerate() {
    if (!state.uploadData) {
        showMessage('请先上传数据');
        return;
    }

    // 切换到生成页面
    document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="generate"]').classList.add('active');
    document.getElementById('page-generate').classList.add('active');

    const output = document.getElementById('content-output');
    const decisionInfo = document.getElementById('decision-info');
    output.textContent = '';
    decisionInfo.textContent = 'Agent 正在分析数据...';
    state.currentText = '';

    document.getElementById('btn-generate').disabled = true;

    console.log('开始自动生成，word_freq:', state.uploadData.word_freq);

    await generateApi.autoGenerate(
        state.uploadData.word_freq,
        (chunk) => {
            console.log('收到 chunk:', chunk);
            state.currentText += chunk;
            output.textContent = state.currentText;
        },
        () => {
            console.log('生成完成');
            document.getElementById('btn-generate').disabled = false;
            saveDraft();
        },
        (error) => {
            console.log('生成失败:', error);
            output.textContent = `生成失败: ${error}`;
            document.getElementById('btn-generate').disabled = false;
        },
        (decision) => {
            console.log('收到决策:', decision);
            // 显示 Agent 的决策
            decisionInfo.innerHTML = `
                <div class="p-2 border-bottom">✅ Agent 选择了主题：${decision.topics.join('、')}</div>
                <div class="p-2 border-bottom">✅ Agent 选择了类型：${decision.route_name}</div>
                <div class="p-2">⏳ 正在生成文案...</div>
            `;
        }
    );
}

function renderTopicKeywords(wordFreq) {
    const container = document.getElementById('topic-keywords');
    const selectedList = document.getElementById('selected-list');

    // 渲染高频词标签
    container.innerHTML = Object.entries(wordFreq)
        .map(([word, count]) => `
            <span class="badge bg-light text-dark border p-2" data-word="${word}" style="cursor:pointer;">
                ${word} (${count})
            </span>
        `).join('');

    // 绑定点击事件
    container.querySelectorAll('.badge').forEach(item => {
        item.addEventListener('click', () => {
            const word = item.dataset.word;
            if (item.classList.contains('bg-primary')) {
                // 取消选择
                item.classList.remove('bg-primary', 'text-white');
                item.classList.add('bg-light', 'text-dark');
                state.selectedTopics = state.selectedTopics.filter(t => t !== word);
            } else {
                // 选择
                item.classList.remove('bg-light', 'text-dark');
                item.classList.add('bg-primary', 'text-white');
                state.selectedTopics.push(word);
            }
            updateSelectedList();
        });
    });

    // 更新已选主题列表
    function updateSelectedList() {
        selectedList.innerHTML = state.selectedTopics
            .map(word => `<span class="badge bg-primary">${word}</span>`)
            .join('');
    }
}

function confirmTopic() {
    if (state.selectedTopics.length === 0) {
        showMessage('请至少选择一个主题关键词');
        return;
    }

    // 切换到生成页面
    document.querySelectorAll('[data-page]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="generate"]').classList.add('active');
    document.getElementById('page-generate').classList.add('active');
}

// 文案生成页面
function initGenerate() {
    document.getElementById('btn-generate').addEventListener('click', generateContent);
    document.getElementById('btn-copy').addEventListener('click', copyContent);
    document.getElementById('btn-refine').addEventListener('click', toggleRefine);
}

async function generateContent() {
    if (state.selectedTopics.length === 0) {
        showMessage('请先选择主题关键词');
        return;
    }

    const route_type = document.getElementById('route-type').value;
    const output = document.getElementById('content-output');
    output.textContent = '';
    state.currentText = '';

    document.getElementById('btn-generate').disabled = true;

    // 把选中的高频词作为主题传给大模型
    const topic = state.selectedTopics.join('、');
    const topicSummary = `用户关注的主题：${topic}`;

    await generateApi.generate(
        topic,
        topicSummary,
        route_type,
        (chunk) => {
            state.currentText += chunk;
            output.textContent = state.currentText;
        },
        () => {
            document.getElementById('btn-generate').disabled = false;
            saveDraft();
        },
        (error) => {
            output.textContent = `生成失败: ${error}`;
            document.getElementById('btn-generate').disabled = false;
        }
    );
}

function copyContent() {
    if (!state.currentText) {
        showMessage('没有可复制的内容');
        return;
    }
    navigator.clipboard.writeText(state.currentText)
        .then(() => showMessage('已复制到剪贴板'))
        .catch(() => showMessage('复制失败'));
}

function toggleRefine() {
    const section = document.getElementById('refine-section');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
}

// 文案微调页面
function initRefine() {
    document.getElementById('btn-send-refine').addEventListener('click', sendRefine);
    document.getElementById('refine-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendRefine();
    });
}

async function sendRefine() {
    const input = document.getElementById('refine-input');
    const instruction = input.value.trim();

    if (!instruction) {
        showMessage('请输入修改意见');
        return;
    }

    if (!state.currentText) {
        showMessage('没有可微调的文案');
        return;
    }

    const messages = document.getElementById('chat-messages');
    messages.innerHTML += `<div class="p-2 mb-2 bg-primary text-white rounded">${instruction}</div>`;
    input.value = '';

    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'p-2 mb-2 bg-light rounded';
    messages.appendChild(assistantMsg);

    // 保存当前文案，然后清空准备接收新文案
    const previousText = state.currentText;
    state.currentText = '';

    await refineApi.refine(
        previousText,  // 传递之前的文案
        instruction,
        (chunk) => {
            state.currentText += chunk;
            assistantMsg.textContent = state.currentText;
            document.getElementById('content-output').textContent = state.currentText;
        },
        () => {
            saveDraft();
            messages.scrollTop = messages.scrollHeight;
        },
        (error) => {
            assistantMsg.textContent = `微调失败: ${error}`;
        }
    );
}

// 草稿保存
function saveDraft() {
    if (state.currentText) {
        localStorage.setItem('draft_current', state.currentText);
    }
}

function loadDraft() {
    const draft = localStorage.getItem('draft_current');
    if (draft) {
        state.currentText = draft;
        document.getElementById('content-output').textContent = draft;
    }
}

// 消息提示
function showMessage(msg) {
    alert(msg);
}

// 弹窗功能
function initModal() {
    // Bootstrap Modal 会自动处理关闭按钮
}

function showModal(title, comments) {
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = `包含「${title}」的评论 (${comments.length}条)`;
    modalBody.innerHTML = comments.length > 0
        ? comments.map(c => `<div class="p-2 border-bottom">${c}</div>`).join('')
        : '<p class="text-center text-muted">暂无相关评论</p>';

    const modal = new bootstrap.Modal(document.getElementById('modal'));
    modal.show();
}

function closeModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
    if (modal) modal.hide();
}
