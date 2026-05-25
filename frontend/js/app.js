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
    const wordEntries = Object.entries(data.word_freq).slice(0, 20);

    // 调试信息
    console.log('word_freq:', data.word_freq);
    console.log('word_comments:', data.word_comments);
    console.log('wordEntries:', wordEntries);

    wordFreq.innerHTML = wordEntries
        .map(([word, count]) => `<span class="word-tag" data-word="${word}">${word} (${count})</span>`)
        .join('');

    // 给高频词标签添加点击事件
    wordFreq.querySelectorAll('.word-tag').forEach(tag => {
        tag.addEventListener('click', () => {
            const word = tag.dataset.word;
            console.log('点击了:', word);
            console.log('word_comments[word]:', data.word_comments[word]);
            const comments = data.word_comments[word] || [];
            showModal(word, comments);
        });
    });

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

    // 切换到分析页面
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-page="analyze"]').classList.add('active');
    document.getElementById('page-analyze').classList.add('active');

    // 直接用高频词作为主题，不需要大模型分析
    renderTopicKeywords(state.uploadData.word_freq);
    document.getElementById('btn-confirm-topic').classList.remove('hidden');
}

function renderTopicKeywords(wordFreq) {
    const container = document.getElementById('topic-keywords');
    const selectedList = document.getElementById('selected-list');

    // 渲染高频词标签
    container.innerHTML = Object.entries(wordFreq)
        .map(([word, count]) => `
            <div class="topic-keyword-item" data-word="${word}">
                ${word} (${count})
            </div>
        `).join('');

    // 绑定点击事件
    container.querySelectorAll('.topic-keyword-item').forEach(item => {
        item.addEventListener('click', () => {
            const word = item.dataset.word;
            if (item.classList.contains('selected')) {
                // 取消选择
                item.classList.remove('selected');
                state.selectedTopics = state.selectedTopics.filter(t => t !== word);
            } else {
                // 选择
                item.classList.add('selected');
                state.selectedTopics.push(word);
            }
            updateSelectedList();
        });
    });

    // 更新已选主题列表
    function updateSelectedList() {
        selectedList.innerHTML = state.selectedTopics
            .map(word => `<span class="selected-tag">${word}</span>`)
            .join('');
    }
}

function confirmTopic() {
    if (state.selectedTopics.length === 0) {
        showMessage('请至少选择一个主题关键词');
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
    messages.innerHTML += `<div class="chat-message user">${instruction}</div>`;
    input.value = '';

    const assistantMsg = document.createElement('div');
    assistantMsg.className = 'chat-message assistant';
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
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('modal-close');

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
}

function showModal(title, comments) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.textContent = `包含「${title}」的评论 (${comments.length}条)`;
    modalBody.innerHTML = comments.length > 0
        ? comments.map(c => `<div class="modal-comment">${c}</div>`).join('')
        : '<p style="text-align:center;color:#999;">暂无相关评论</p>';

    modal.classList.remove('hidden');
}

function closeModal() {
    document.getElementById('modal').classList.add('hidden');
}
