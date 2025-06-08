const { connectDB, Note } = require('./_db.js');

module.exports = async function handler(req, res) {
  // 配置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectDB();

    if (req.method === 'GET') {
      const { userId = 'default', workspace } = req.query;
      const filter = { userId };
      if (workspace) {
        filter.workspace = workspace;
      }
      const notes = await Note.find(filter).sort({ updatedAt: -1 });
      res.json(notes);
    } else if (req.method === 'POST') {
      const { id, title, content, workspace, userId = 'default' } = req.body;
      
      const noteData = {
        id,
        title,
        content,
        workspace,
        userId,
        updatedAt: new Date()
      };
      
      const note = await Note.findOneAndUpdate(
        { id, userId },
        noteData,
        { upsert: true, new: true }
      );
      
      res.json(note);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}