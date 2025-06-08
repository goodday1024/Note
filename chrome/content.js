// 内容脚本，用于与网页交互
// 网页总结插件内容脚本
console.log('网页总结插件已加载');

// 监听来自background的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        try {
            // 等待页面完全加载
            if (document.readyState !== 'complete') {
                window.addEventListener('load', () => {
                    const content = extractPageContent();
                    sendResponse({ success: true, content });
                });
                return true; // 保持消息通道开放
            } else {
                const content = extractPageContent();
                sendResponse({ success: true, content });
            }
        } catch (error) {
            console.error('提取页面内容失败:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    return true;
});

function extractPageContent() {
    // 检查页面是否已加载
    if (!document.body) {
        throw new Error('页面尚未完全加载');
    }
    
    // 创建文档副本以避免修改原页面
    const clone = document.cloneNode(true);
    
    // 移除不需要的元素
    const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ads', '.sidebar', '.menu', '.navigation',
        '[class*="ad-"]', '[id*="ad-"]', '.popup', '.modal',
        'iframe', 'embed', 'object'
    ];
    
    unwantedSelectors.forEach(selector => {
        try {
            const elements = clone.querySelectorAll(selector);
            elements.forEach(el => el.remove());
        } catch (e) {
            console.warn(`移除元素失败: ${selector}`, e);
        }
    });
    
    // 尝试找到主要内容区域
    const mainSelectors = [
        'main', 'article', '.content', '.main-content',
        '.post-content', '.entry-content', '#content',
        '.article-content', '.story-content', '.text-content'
    ];
    
    let mainContent = null;
    for (const selector of mainSelectors) {
        try {
            const element = clone.querySelector(selector);
            if (element && element.textContent.trim().length > 100) {
                mainContent = element;
                break;
            }
        } catch (e) {
            console.warn(`查找主要内容失败: ${selector}`, e);
        }
    }
    
    // 如果没找到主要内容区域，使用body
    const contentElement = mainContent || clone.body;
    
    if (!contentElement) {
        throw new Error('无法找到页面内容元素');
    }
    
    // 提取文本内容
    let text = '';
    try {
        text = contentElement.innerText || contentElement.textContent || '';
    } catch (e) {
        console.warn('提取文本内容失败，尝试备用方法', e);
        text = contentElement.textContent || '';
    }
    
    // 清理文本
    text = text
        .replace(/\s+/g, ' ')  // 合并多个空白字符
        .replace(/\n\s*\n/g, '\n')  // 合并多个换行
        .replace(/[\r\n\t]+/g, ' ')  // 替换换行和制表符为空格
        .trim();
    
    // 检查内容是否有效
    if (!text || text.length < 10) {
        throw new Error(`提取的内容过短或为空，长度: ${text.length}`);
    }
    
    // 限制长度以避免API调用过大
    if (text.length > 8000) {
        text = text.substring(0, 8000) + '...';
    }
    
    console.log(`成功提取页面内容，长度: ${text.length}`);
    return text;
}