class AIManager {
    constructor(settings) {
        this.settings = settings;
        this.apiEndpoints = {
            openai: 'https://api.openai.com/v1/chat/completions',
            anthropic: 'https://api.anthropic.com/v1/messages',
            gemini: 'https://generativelanguage.googleapis.com/v1beta/models',
            deepseek: 'https://api.deepseek.com/v1/chat/completions'
        };
    }

    updateSettings(newSettings) {
        this.settings = newSettings;
    }

    async makeAPIRequest(messages, options = {}) {
        const { aiProvider, aiApiKey, aiModel } = this.settings;
        
        if (!aiApiKey) {
            throw new Error('API 密钥未配置');
        }

        switch (aiProvider) {
            case 'openai':
                return await this.callOpenAI(messages, aiModel, options);
            case 'anthropic':
                return await this.callAnthropic(messages, aiModel, options);
            case 'gemini':
                return await this.callGemini(messages, aiModel, options);
            case 'deepseek':
                return await this.callDeepSeek(messages, aiModel, options);
            default:
                throw new Error(`不支持的 AI 服务商: ${aiProvider}`);
        }
    }

    async makeStreamRequest(messages, onChunk, options = {}) {
        const { aiProvider, aiApiKey, aiModel } = this.settings;
        
        if (!aiApiKey) {
            throw new Error('API 密钥未配置');
        }

        switch (aiProvider) {
            case 'openai':
                return await this.callOpenAIStream(messages, aiModel, onChunk, options);
            case 'deepseek':
                return await this.callDeepSeekStream(messages, aiModel, onChunk, options);
            case 'anthropic':
                return await this.callAnthropicStream(messages, aiModel, onChunk, options);
            default:
                throw new Error(`${aiProvider} 暂不支持流式返回`);
        }
    }

    async callOpenAI(messages, model, options) {
        const response = await fetch(this.apiEndpoints.openai, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '请求失败');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callOpenAIStream(messages, model, onChunk, options) {
        const response = await fetch(this.apiEndpoints.openai, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '请求失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }



    async callAnthropic(messages, model, options) {
        // 转换消息格式
        const anthropicMessages = messages.filter(msg => msg.role !== 'system');
        const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

        const response = await fetch(this.apiEndpoints.anthropic, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.settings.aiApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: options.maxTokens || 2000,
                system: systemMessage,
                messages: anthropicMessages
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '请求失败');
        }

        const data = await response.json();
        return data.content[0].text;
    }

    async callAnthropicStream(messages, model, onChunk, options) {
        // 转换消息格式
        const anthropicMessages = messages.filter(msg => msg.role !== 'system');
        const systemMessage = messages.find(msg => msg.role === 'system')?.content || '';

        const response = await fetch(this.apiEndpoints.anthropic, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.settings.aiApiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: options.maxTokens || 2000,
                system: systemMessage,
                messages: anthropicMessages,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '请求失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.delta?.text;
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    async callDeepSeek(messages, model, options) {
        const response = await fetch(this.apiEndpoints.deepseek, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'DeepSeek API 请求失败');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }

    async callDeepSeekStream(messages, model, onChunk, options) {
        const response = await fetch(this.apiEndpoints.deepseek, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.aiApiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                max_tokens: options.maxTokens || 2000,
                temperature: options.temperature || 0.7,
                stream: true
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'DeepSeek API 请求失败');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                onChunk(content);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }



    async callGemini(messages, model, options) {
        const endpoint = `${this.apiEndpoints.gemini}/${model}:generateContent?key=${this.settings.aiApiKey}`;
        
        // 转换消息格式为 Gemini 格式
        const contents = messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }));

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: contents,
                generationConfig: {
                    maxOutputTokens: options.maxTokens || 2000,
                    temperature: options.temperature || 0.7
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || '请求失败');
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    }

    async improveText(text) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的文本编辑助手。请改进用户提供的文本，使其更加清晰、流畅、准确。保持原文的核心意思和风格，只进行必要的改进。如果是中文文本，请用中文回复；如果是英文文本，请用英文回复。'
            },
            {
                role: 'user',
                content: `请改进以下文本：\n\n${text}`
            }
        ];

        return await this.makeAPIRequest(messages);
    }

    async improveTextStream(text, onChunk) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的文本编辑助手。请改进用户提供的文本，使其更加清晰、流畅、准确。保持原文的核心意思和风格，只进行必要的改进。如果是中文文本，请用中文回复；如果是英文文本，请用英文回复。'
            },
            {
                role: 'user',
                content: `请改进以下文本：\n\n${text}`
            }
        ];

        return await this.makeStreamRequest(messages, onChunk);
    }

    async summarizeText(text) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的文本摘要助手。请为用户提供的文本生成简洁、准确的摘要，突出关键信息和要点。如果是中文文本，请用中文回复；如果是英文文本，请用英文回复。'
            },
            {
                role: 'user',
                content: `请为以下文本生成摘要：\n\n${text}`
            }
        ];

        return await this.makeAPIRequest(messages);
    }

    async summarizeTextStream(text, onChunk) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的文本摘要助手。请为用户提供的文本生成简洁、准确的摘要，突出关键信息和要点。如果是中文文本，请用中文回复；如果是英文文本，请用英文回复。'
            },
            {
                role: 'user',
                content: `请为以下文本生成摘要：\n\n${text}`
            }
        ];

        return await this.makeStreamRequest(messages, onChunk);
    }

    async translateText(text, targetLanguage) {
        const messages = [
            {
                role: 'system',
                content: `你是一个专业的翻译助手。请将用户提供的文本翻译成${targetLanguage}。保持原文的语气、风格和格式，确保翻译准确、自然、流畅。`
            },
            {
                role: 'user',
                content: `请将以下文本翻译成${targetLanguage}：\n\n${text}`
            }
        ];

        return await this.makeAPIRequest(messages);
    }

    async generateContent(prompt, options = {}) {
        const messages = [
            {
                role: 'system',
                content: '你是一个专业的内容创作助手。请根据用户的要求生成高质量的内容。'
            },
            {
                role: 'user',
                content: prompt
            }
        ];

        return await this.makeAPIRequest(messages, options);
    }

    async chatWithAI(userMessage, conversationHistory = []) {
        const messages = [
            {
                role: 'system',
                content: '你是一个智能助手，可以帮助用户解答问题、提供建议和进行对话。请友好、专业地回应用户。'
            },
            ...conversationHistory,
            {
                role: 'user',
                content: userMessage
            }
        ];

        return await this.makeAPIRequest(messages);
    }

    // 检查 API 连接状态
    async testConnection() {
        try {
            const testMessage = [{
                role: 'user',
                content: 'Hello, this is a test message.'
            }];
            
            await this.makeAPIRequest(testMessage, { maxTokens: 10 });
            return { success: true, message: 'AI 服务连接正常' };
        } catch (error) {
            return { success: false, message: `连接失败: ${error.message}` };
        }
    }

    // 获取支持的模型列表
    getSupportedModels(provider) {
        const models = {
            openai: [
                { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: '快速、经济的模型' },
                { id: 'gpt-4', name: 'GPT-4', description: '更强大的推理能力' },
                { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: '最新的 GPT-4 模型' }
            ],
            anthropic: [
                { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: '快速、轻量级模型' },
                { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: '平衡性能和速度' },
                { id: 'claude-3-opus', name: 'Claude 3 Opus', description: '最强大的推理能力' }
            ],
            gemini: [
                { id: 'gemini-pro', name: 'Gemini Pro', description: 'Google 的多模态模型' },
                { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: '支持图像理解' }
            ],
            deepseek: [
                { id: 'deepseek-chat', name: 'DeepSeek Chat', description: '通用对话模型' },
                { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', description: '思考生成模型' }
            ]
        };

        return models[provider] || [];
    }
}

// 导出类以供使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIManager;
}