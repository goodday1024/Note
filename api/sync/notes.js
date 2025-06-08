const { connectDB, Note } = require('../_db');

export default async function handler(req, res) {
  // 配置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    await connectDB();
    
    const { notes, userId = 'default' } = req.body;
    
    const operations = notes.map(note => ({
      updateOne: {
        filter: { id: note.id, userId },
        update: { ...note, userId, updatedAt: new Date() },
        upsert: true
      }
    }));
    
    await Note.bulkWrite(operations);
    
    // 返回所有笔记
    const allNotes = await Note.find({ userId }).sort({ updatedAt: -1 });
    res.json(allNotes);
  } catch (error) {
    console.error('Sync Notes API Error:', error);
    res.status(500).json({ error: error.message });
  }
}