const { connectDB, Note } = require('../_db.js');

module.exports = async function handler(req, res) {
  // 更全面的 CORS 配置
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'false');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await connectDB();
    
    const { userId = 'default' } = req.query;
    const notesCount = await Note.countDocuments({ userId });
    const lastSync = await Note.findOne({ userId }).sort({ updatedAt: -1 });
    
    res.json({
      connected: true,
      notesCount,
      lastSync: lastSync ? lastSync.updatedAt : null
    });
  } catch (error) {
    console.error('Sync Status API Error:', error);
    res.status(500).json({ error: error.message });
  }
}