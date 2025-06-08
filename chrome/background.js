// 后台服务工作者
chrome.runtime.onInstalled.addListener(() => {
    console.log('网页总结插件已安装');
});

// 处理插件图标点击
chrome.action.onClicked.addListener((tab) => {
    // 打开popup（这个在manifest v3中会自动处理）
});

// 监听来自content script或popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'summarizePage') {
        handleSummarizePage(request, sendResponse);
        return true; // 保持消息通道开放
    }
});

async function handleSummarizePage(request, sendResponse) {
    try {
        // 这里可以添加额外的后台处理逻辑
        sendResponse({ success: true });
    } catch (error) {
        sendResponse({ success: false, error: error.message });
    }
}