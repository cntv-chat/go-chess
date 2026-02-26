# 围棋对战平台

网页版围棋对战平台，支持人机对战和人人在线对战。

## 功能

- 注册/登录
- 人机对战（简单/中等/困难三种 AI 难度）
- 人人在线匹配对战
- 支持 9×9、13×13、19×19 棋盘
- 标准围棋规则（提子、打劫、禁着点）
- 中国规则数目

## 技术栈

- 前端：React + Vite
- 后端：Node.js + Express + Socket.IO
- 数据库：SQLite (better-sqlite3)
- 认证：JWT

## 运行

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 启动后端
cd server && npm run dev

# 启动前端（另一个终端）
cd client && npm run dev
```

打开 http://localhost:5173 即可。

## 部署

```bash
cd client && npm run build
cd ../server && npm start
```

构建后后端会自动托管前端静态文件，访问 http://localhost:3001。

## License

MIT
