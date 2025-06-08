const { connectDB, Note } = require('../_db');

export default async function handler(req, res) {
  // 配置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await connectDB();
    
    const { id } = req.query;
    const { userId = 'default' } = req.query;
    
    // 先查找要删除的笔记
    const noteToDelete = await Note.findOne({ id, userId });
    
    if (!noteToDelete) {
      return res.status(404).json({ 
        error: 'Note not found',
        message: '要删除的笔记不存在'
      });
    }
    
    // 执行删除操作
    const deleteResult = await Note.findOneAndDelete({ id, userId });
    
    if (!deleteResult) {
      return res.status(500).json({ 
        error: 'Delete failed',
        message: '删除操作失败'
      });
    }
    
    // 验证删除结果
    const verifyDeleted = await Note.findOne({ id, userId });
    if (verifyDeleted) {
      return res.status(500).json({ 
        error: 'Delete verification failed',
        message: '删除验证失败，数据仍然存在'
      });
    }
    
    res.json({ 
      success: true, 
      deletedNote: {
        id: deleteResult.id,
        title: deleteResult.title
      },
      message: '笔记删除成功'
    });
  } catch (error) {
    console.error('Delete API Error:', error);
    res.status(500).json({ 
      error: error.message,
      message: '服务器删除操作失败'
    });
  }
}