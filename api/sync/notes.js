const { connectDB, Note } = require('../_db.js');

module.exports = async function handler(req, res) {
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
    
    // 获取服务器上现有的所有笔记
    const existingNotes = await Note.find({ userId });
    const clientNoteIds = new Set(notes.map(note => note.id));
    
    // 找出需要删除的笔记（服务器有但客户端没有的）
    const notesToDelete = existingNotes.filter(note => !clientNoteIds.has(note.id));
    
    // 删除服务器上多余的笔记
    if (notesToDelete.length > 0) {
      const deleteIds = notesToDelete.map(note => note.id);
      await Note.deleteMany({ id: { $in: deleteIds }, userId });
      console.log(`删除了 ${notesToDelete.length} 个笔记:`, deleteIds);
    }
    
    // 更新/插入客户端的笔记
    if (notes.length > 0) {
      const operations = notes.map(note => ({
        updateOne: {
          filter: { id: note.id, userId },
          update: { ...note, userId, updatedAt: new Date() },
          upsert: true
        }
      }));
      
      await Note.bulkWrite(operations);
    }
    
    // 返回所有笔记
    const allNotes = await Note.find({ userId }).sort({ updatedAt: -1 });
    res.json(allNotes);
  } catch (error) {
    console.error('Sync Notes API Error:', error);
    res.status(500).json({ error: error.message });
  }
}