const API_BASE = 'http://localhost:8000';

// 通用请求方法
async function request(url, options = {}) {
    const response = await fetch(`${API_BASE}${url}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || '请求失败');
    }

    return response.json();
}

// 流式请求方法
async function streamRequest(url, body, onChunk, onDone, onError) {
    try {
        const response = await fetch(`${API_BASE}${url}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '请求失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    if (data.done) {
                        onDone();
                    } else if (data.error) {
                        onError(data.error);
                    } else if (data.chunk) {
                        onChunk(data.chunk);
                    }
                }
            }
        }
    } catch (error) {
        onError(error.message);
    }
}

// 系统设置 API
const settingsApi = {
    getKeys: () => request('/api/settings/llm'),
    addKey: (model_type, api_key) => request('/api/settings/llm', {
        method: 'POST',
        body: JSON.stringify({ model_type, api_key }),
    }),
    deleteKey: (id) => request(`/api/settings/llm/${id}`, { method: 'DELETE' }),
    activateKey: (id) => request(`/api/settings/llm/${id}`, { method: 'PUT' }),
};

// 文件上传 API
const uploadApi = {
    upload: async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || '上传失败');
        }
        return response.json();
    },
};

// 话题分析 API
const analyzeApi = {
    analyze: (word_freq, topic_clusters, onChunk, onDone, onError) =>
        streamRequest('/api/analyze', { word_freq, topic_clusters }, onChunk, onDone, onError),
};

// 文案生成 API
const generateApi = {
    generate: (topic, topic_summary, route_type, onChunk, onDone, onError) =>
        streamRequest('/api/generate', { topic, topic_summary, route_type }, onChunk, onDone, onError),
};

// 文案微调 API
const refineApi = {
    refine: (current_text, instruction, onChunk, onDone, onError) =>
        streamRequest('/api/refine', { current_text, instruction }, onChunk, onDone, onError),
};
