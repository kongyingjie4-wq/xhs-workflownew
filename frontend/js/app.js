// 全局状态
const state = {
    uploadData: null,
    selectedTopic: null,
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
    loadKeys();
});

// 导航切换
function initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = btn.dataset.page;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
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
            <td>${key.model_type}</td>
            <td>${key.api_key}</td>
            <td>${key.is_active ? '<span class="btn-success" style="padding:2px 8px;border-radius:4px;">已激活</span>' : '未激活'}</td>
            <td>
                <button onclick="activateKey(${key.id})" class="btn btn-primary" style="padding:4px 12px;margin-right:5px;" ${key.is_active ? 'disabled' : ''}>激活</button>
                <button onclick="deleteKey(${key.id})" class="btn btn-danger" style="padding:4px 12px;">删除</button>
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
    wordFreq.innerHTML = Object.entries(data.word_freq)
        .slice(0, 20)
        .map(([word, count]) => `<span class="word-tag">${word} (${count})</span>`)
        .join('');

    const preview = document.getElementById('content-preview');
    preview.innerHTML = data.contents
        .slice(0, 10)
        .map(content => `<div class="preview-item">${content}</div>`)
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

    const topicCards = document.getElementById('topic-cards');
    topicCards.innerHTML = '<p class="placeholder">正在分析中...</p>';
    document.getElementById('btn-confirm-topic').classList.add('hidden');

    // 切换到分析页面
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="analyze"]').classList.add('active');
    document.getElementById('page-analyze').classList.add('active');

    let fullResponse = '';

    await analyzeApi.analyze(
        state.uploadData.word_freq,
        state.uploadData.topic_clusters,
        (chunk) => {
            fullResponse += chunk;
        },
        () => {
            try {
                const topics = JSON.parse(fullResponse);
                renderTopicCards(topics);
                document.getElementById('btn-confirm-topic').classList.remove('hidden');
            } catch (e) {
                topicCards.innerHTML = '<p class="placeholder">解析失败，请重试</p>';
            }
        },
        (error) => {
            topicCards.innerHTML = `<p class="placeholder">分析失败: ${error}</p>`;
        }
    );
}

function renderTopicCards(topics) {
    const container = document.getElementById('topic-cards');
    container.innerHTML = topics.map(topic => `
        <div class="topic-card" data-id="${topic.id}" data-title="${topic.title}" data-summary="${topic.summary}">
            <h4>${topic.title}</h4>
            <p>${topic.summary}</p>
            <div class="topic-keywords">
                ${topic.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.topic-card').forEach(card => {
        card.addEventListener('click', () => {
            container.querySelectorAll('.topic-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedTopic = {
                id: card.dataset.id,
                title: card.dataset.title,
                summary: card.dataset.summary,
            };
        });
    });
}

function confirmTopic() {
    if (!state.selectedTopic) {
        showMessage('请选择一个话题');
        return;
    }

    // 切换到生成页面
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
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
    if (!state.selectedTopic) {
        showMessage('请先选择话题');
        return;
    }

    const route_type = document.getElementById('route-type').value;
    const output = document.getElementById('content-output');
    output.textContent = '';
    state.currentText = '';

    document.getElementById('btn-generate').disabled = true;

    await generateApi.generate(
        state.selectedTopic.title,
        state.selectedTopic.summary,
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
    messages.innerHTML += `<div class="chat-message user">${instruction}</div>`;
    input.value = '';

    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
    messages.appendChild(assistantMsg);

    state.currentText = '';

    await refineApi.refine(
        state.currentText,
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
