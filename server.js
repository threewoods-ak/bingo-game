const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('crypto');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 環境変数: スロットアニメーション間隔（ミリ秒）
const SLOT_ANIMATION_DELAY = parseInt(process.env.SLOT_ANIMATION_DELAY || '500');

app.use(express.static('public'));
app.use(express.json());

// ゲームセッション管理
const gameSessions = new Map();

// デフォルトセッション作成
const defaultSessionId = 'default';
gameSessions.set(defaultSessionId, {
  sessionId: defaultSessionId,
  pickedNumbers: [],
  players: [],
  startTime: new Date().toISOString(),
  theme: 'party'
});

// 数字生成ロジック
function generateNumber(pickedNumbers) {
  const remaining = [];
  for (let i = 1; i <= 75; i++) {
    if (!pickedNumbers.includes(i)) {
      remaining.push(i);
    }
  }

  if (remaining.length === 0) return null;
  
  // 残り20個以下は直接選択
  if (remaining.length <= 20) {
    const num = remaining[Math.floor(Math.random() * remaining.length)];
    return { x: 0, operator: '+', z: num, result: num };
  }

  // 演算子の重み付け
  const operators = ['+', '+', '-', '×', '÷'];
  let attempts = 0;
  
  while (attempts < 10) {
    const operator = operators[Math.floor(Math.random() * operators.length)];
    let x, z, result;

    switch (operator) {
      case '+':
        x = Math.floor(Math.random() * 37) + 1;
        z = Math.floor(Math.random() * 37) + 1;
        result = x + z;
        break;
      case '-':
        x = Math.floor(Math.random() * 75) + 1;
        z = Math.floor(Math.random() * Math.min(x - 1, 74)) + 1;
        result = x - z;
        break;
      case '×':
        x = Math.floor(Math.random() * 8) + 1;
        z = Math.floor(Math.random() * 9) + 1;
        result = x * z;
        break;
      case '÷':
        const divisors = [];
        for (let i = 1; i <= 75; i++) {
          for (let j = 1; j <= 75; j++) {
            if (i % j === 0 && i / j >= 1 && i / j <= 75) {
              divisors.push({ x: i, z: j, result: i / j });
            }
          }
        }
        if (divisors.length > 0) {
          const pick = divisors[Math.floor(Math.random() * divisors.length)];
          x = pick.x;
          z = pick.z;
          result = pick.result;
        }
        break;
    }

    if (result >= 1 && result <= 75 && !pickedNumbers.includes(result)) {
      return { x, operator, z, result };
    }
    attempts++;
  }

  // 10回失敗したら残りから直接選択
  const num = remaining[Math.floor(Math.random() * remaining.length)];
  return { x: num, operator: '+', z: 0, result: num };
}

// QRコード生成エンドポイント
app.get('/api/qr/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;
  const url = `${req.protocol}://${req.get('host')}/player.html?session=${sessionId}`;
  
  try {
    const qrCode = await QRCode.toDataURL(url);
    res.json({ qrCode, url });
  } catch (error) {
    res.status(500).json({ error: 'QR生成エラー' });
  }
});

// Socket.io接続管理
io.on('connection', (socket) => {
  console.log('クライアント接続:', socket.id);

  // セッション参加
  socket.on('join_session', (data) => {
    const { sessionId, isHost } = data;
    let session = gameSessions.get(sessionId);
    
    if (!session) {
      session = {
        sessionId,
        pickedNumbers: [],
        players: [],
        startTime: new Date().toISOString(),
        theme: 'party'
      };
      gameSessions.set(sessionId, session);
    }

    socket.join(sessionId);
    socket.sessionId = sessionId;
    socket.isHost = isHost;
    
    // 現在の状態を送信
    socket.emit('session_state', session);
  });

  // プレイヤー参加
  socket.on('player_join', (data) => {
    const { sessionId, name } = data;
    const session = gameSessions.get(sessionId);
    
    if (session) {
      // ユーザー名のバリデーション
      const sanitizedName = name.trim().substring(0, 20);
      
      // 空白のみ、または空文字の場合はデフォルト名
      if (!sanitizedName || sanitizedName.length === 0) {
        socket.emit('join_error', { message: '名前を入力してください' });
        return;
      }
      
      // HTMLタグを含む場合は拒否
      if (/<[^>]*>/g.test(sanitizedName)) {
        socket.emit('join_error', { message: '特殊文字は使用できません' });
        return;
      }
      
      const playerId = socket.id;
      const player = {
        id: playerId,
        name: sanitizedName,
        status: null,
        joinedAt: new Date().toISOString()
      };
      
      session.players.push(player);
      socket.playerId = playerId;
      
      io.to(sessionId).emit('player_joined', player);
      socket.emit('player_registered', { playerId });
    }
  });

  // 数字ピック
  socket.on('pick_number', () => {
    const sessionId = socket.sessionId;
    const session = gameSessions.get(sessionId);
    
    if (session && socket.isHost) {
      const calculation = generateNumber(session.pickedNumbers);
      
      if (calculation) {
        session.pickedNumbers.push(calculation.result);
        io.to(sessionId).emit('number_picked', {
          calculation,
          pickedNumbers: session.pickedNumbers,
          remaining: 75 - session.pickedNumbers.length,
          animationDelay: SLOT_ANIMATION_DELAY
        });
      } else {
        io.to(sessionId).emit('game_complete');
      }
    }
  });

  // ステータス変更
  socket.on('status_change', (data) => {
    const { status } = data;
    const sessionId = socket.sessionId;
    const session = gameSessions.get(sessionId);
    
    if (session) {
      const player = session.players.find(p => p.id === socket.playerId);
      if (player) {
        player.status = status;
        io.to(sessionId).emit('player_status_changed', {
          playerId: player.id,
          name: player.name,
          status
        });
      }
    }
  });

  // テーマ変更
  socket.on('theme_change', (data) => {
    const { theme } = data;
    const sessionId = socket.sessionId;
    const session = gameSessions.get(sessionId);
    
    if (session && socket.isHost) {
      session.theme = theme;
      io.to(sessionId).emit('theme_changed', { theme });
    }
  });

  // ゲームリセット
  socket.on('reset_game', () => {
    const sessionId = socket.sessionId;
    const session = gameSessions.get(sessionId);
    
    if (session && socket.isHost) {
      session.pickedNumbers = [];
      session.players.forEach(p => p.status = null);
      io.to(sessionId).emit('game_reset');
    }
  });

  // 切断処理
  socket.on('disconnect', () => {
    console.log('クライアント切断:', socket.id);
    
    const sessionId = socket.sessionId;
    const session = gameSessions.get(sessionId);
    
    if (session && socket.playerId) {
      const index = session.players.findIndex(p => p.id === socket.playerId);
      if (index !== -1) {
        const player = session.players[index];
        session.players.splice(index, 1);
        io.to(sessionId).emit('player_left', { playerId: player.id, name: player.name });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバー起動: http://localhost:${PORT}`);
});
