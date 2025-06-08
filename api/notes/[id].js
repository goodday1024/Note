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
    
    await Note.findOneAndDelete({ id, userId });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete API Error:', error);
    res.status(500).json({ error: error.message });
  }
}