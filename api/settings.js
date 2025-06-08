const { connectDB, UserSettings } = require('./_db');

export default async function handler(req, res) {
  // 配置 CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    await connectDB();

    if (req.method === 'GET') {
      const { userId = 'default' } = req.query;
      const userSettings = await UserSettings.findOne({ userId });
      
      if (!userSettings) {
        // 创建默认设置
        const defaultSettings = {
          userId,
          settings: {
            theme: 'light',
            fontSize: 14,
            autoSave: true,
            aiEnabled: false,
            aiApiKey: '',
            aiBaseUrl: 'https://api.deepseek.com',
            aiModel: 'deepseek-chat',
            markdownTheme: 'github',
            customThemeUrl: '',
            cloudSync: true
          },
          workspaces: ['public', 'private']
        };
        
        const newSettings = await UserSettings.create(defaultSettings);
        return res.json(newSettings);
      }
      
      res.json(userSettings);
    } else if (req.method === 'POST') {
      const { userId = 'default', settings, workspaces } = req.body;
      
      const userSettings = await UserSettings.findOneAndUpdate(
        { userId },
        { 
          settings,
          workspaces,
          updatedAt: new Date()
        },
        { upsert: true, new: true }
      );
      
      res.json(userSettings);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Settings API Error:', error);
    res.status(500).json({ error: error.message });
  }
}