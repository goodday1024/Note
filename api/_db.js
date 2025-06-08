const mongoose = require('mongoose');

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/notes-app';
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// 笔记数据模型
const noteSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    content: { type: String, default: '' },
    workspace: { type: String, default: 'public' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    userId: { type: String, default: 'default' }
});

// 用户设置模型
const settingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    settings: { type: Object, default: {} },
    workspaces: { type: Array, default: ['public', 'private'] },
    updatedAt: { type: Date, default: Date.now }
});

const Note = mongoose.models.Note || mongoose.model('Note', noteSchema);
const UserSettings = mongoose.models.UserSettings || mongoose.model('UserSettings', settingsSchema);

module.exports = { connectDB, Note, UserSettings };