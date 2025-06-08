// 内容脚本，用于与网页交互
console.log('网页总结插件已加载');

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPageContent') {
        try {
            const content = extractPageContent();
            sendResponse({ success: true, content });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
    }
    return true;
});

function extractPageContent() {
    // 创建文档副本以避免修改原页面
    const clone = document.cloneNode(true);
    
    // 移除不需要的元素
    const unwantedSelectors = [
        'script', 'style', 'nav', 'header', 'footer', 'aside',
        '.advertisement', '.ads', '.sidebar', '.menu',
        '[class*="ad-"]', '[id*="ad-"]'
    ];
    
    unwantedSelectors.forEach(selector => {
        const elements = clone.querySelectorAll(selector);
        elements.forEach(el => el.remove());
    });
    
    // 尝试找到主要内容区域
    const mainSelectors = [
        'main', 'article', '.content', '.main-content',
        '.post-content', '.entry-content', '#content'
    ];
    
    let mainContent = null;
    for (const selector of mainSelectors) {
        const element = clone.querySelector(selector);
        if (element) {
            mainContent = element;
            break;
        }
    }
    
    // 如果没找到主要内容区域，使用body
    const contentElement = mainContent || clone.body;
    
    // 提取文本内容
    let text = contentElement.innerText || contentElement.textContent || '';
    
    // 清理文本
    text = text
        .replace(/\s+/g, ' ')  // 合并多个空白字符
        .replace(/\n\s*\n/g, '\n')  // 合并多个换行
        .trim();
    
    // 限制长度以避免API调用过大
    if (text.length > 8000) {
        text = text.substring(0, 8000) + '...';
    }
    
    return text;
}