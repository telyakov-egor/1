const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище активных игровых сессий
let activeSessions = new Map();

// Хранилище игр пользователя
let userGames = [
    {
        id: 'game1',
        title: 'Квиз про все на свете №2',
        createdAt: '2024-03-01',
        rounds: [
            {
                id: 'round1',
                name: 'Раунд 1',
                type: 'jeopardy',
                description: 'Своя игра',
                settings: {
                    timePerQuestion: 30,
                    mode: 'normal',
                    canChangeAnswer: false,
                    ignoreInTotal: false,
                    pointsTable: 'normal',
                    minusForWrong: false,
                    doubleForFirst: false
                },
                questions: [
                    {
                        id: 'q1',
                        text: 'Именно с этого вокзала едет в Петушки главный герой поэмы Венедикта Ерофеева.',
                        points: 500,
                        media: 'https://cdn-y.quizzly.ru/image/1678457329082.webp',
                        options: [
                            { id: 'o1', text: 'Курский вокзал', letter: 'A', isCorrect: false },
                            { id: 'o2', text: 'Ярославский вокзал', letter: 'B', isCorrect: false },
                            { id: 'o3', text: 'Павелецкий вокзал', letter: 'C', isCorrect: false },
                            { id: 'o4', text: 'Белорусский вокзал', letter: 'D', isCorrect: true }
                        ],
                        commentary: 'Герой поэмы отправляется с Курского вокзала',
                        answered: false
                    }
                ]
            },
            {
                id: 'round2',
                name: 'Тур 2',
                type: 'abcd',
                description: 'ABCD',
                settings: {
                    timePerQuestion: 30,
                    mode: 'normal',
                    canChangeAnswer: false,
                    ignoreInTotal: false,
                    pointsTable: 'normal'
                },
                questions: [
                    {
                        id: 'q2',
                        text: 'Завершившая в 2020 году карьеру Мария Шарапова успела стать обладательницей стольких титулов международной теннисной ассоциации',
                        points: 600,
                        options: [
                            { id: 'o5', text: '51', letter: 'A', isCorrect: false },
                            { id: 'o6', text: '39', letter: 'B', isCorrect: false },
                            { id: 'o7', text: '36', letter: 'C', isCorrect: true },
                            { id: 'o8', text: '24', letter: 'D', isCorrect: false }
                        ],
                        answered: false
                    },
                    {
                        id: 'q3',
                        text: 'Чарли Лайн собрал на Кикстартере почти 4 тысячи фунтов для того, чтобы заставить британских цензоров делать это.',
                        points: 700,
                        options: [
                            { id: 'o9', text: 'Узнать, почем фунт лиха', letter: 'A', isCorrect: false },
                            { id: 'o10', text: 'Считать цыплят по осени', letter: 'B', isCorrect: false },
                            { id: 'o11', text: 'Смотреть, как сохнет краска', letter: 'C', isCorrect: true },
                            { id: 'o12', text: 'Сидеть и ждать у моря погоды', letter: 'D', isCorrect: false }
                        ],
                        answered: false
                    },
                    {
                        id: 'q4',
                        text: 'Все эти актеры – гордость Австралии. А чье место рождения на самом деле – США?',
                        points: 800,
                        options: [
                            { id: 'o13', text: 'Марго Робби', letter: 'A', isCorrect: false },
                            { id: 'o14', text: 'Николь Кидман', letter: 'B', isCorrect: true },
                            { id: 'o15', text: 'Хью Джекман', letter: 'C', isCorrect: false },
                            { id: 'o16', text: 'Крис Хемсворт', letter: 'D', isCorrect: false }
                        ],
                        answered: false
                    },
                    {
                        id: 'q5',
                        text: 'Какая голливудская знаменитость упоминается самой первой в хите Мадонны "Vogue"?',
                        points: 1100,
                        options: [
                            { id: 'o17', text: 'Джин Харлоу', letter: 'A', isCorrect: false },
                            { id: 'o18', text: 'Марлен Дитрих', letter: 'B', isCorrect: false },
                            { id: 'o19', text: 'Джеймс Дин', letter: 'C', isCorrect: false },
                            { id: 'o20', text: 'Грета Гарбо', letter: 'D', isCorrect: true }
                        ],
                        answered: false
                    }
                ]
            },
            {
                id: 'round3',
                name: 'Раунд 3',
                type: 'jeopardy',
                description: 'Своя игра',
                settings: {
                    timePerQuestion: 30,
                    mode: 'normal',
                    canChangeAnswer: false,
                    ignoreInTotal: false
                },
                questions: []
            },
            {
                id: 'round4',
                name: 'Тур 4',
                type: 'biathlon',
                description: 'Биатлон',
                settings: {
                    timePerQuestion: 30,
                    mode: 'biathlon',
                    canChangeAnswer: false,
                    ignoreInTotal: false
                },
                questions: []
            }
        ]
    }
];

// Генерация случайного кода игры
function generateGameCode() {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return code;
}

// Создание новой игровой сессии
function createGameSession(gameId) {
    const gameCode = generateGameCode();
    const session = {
        id: uuidv4(),
        gameId: gameId,
        code: gameCode,
        pin: Math.floor(1000 + Math.random() * 9000).toString(),
        createdAt: new Date(),
        active: false,
        currentRound: 0,
        currentQuestion: 0,
        showOptions: false,
        timerActive: false,
        timerEndTime: null,
        timerDuration: 30,
        correctAnswerRevealed: false,
        answers: new Map(),
        answeredCount: 0,
        startTime: null,
        hideQR: false,
        showPointsColumn: true,
        showPointsTable: false,
        teams: []
    };
    activeSessions.set(session.id, session);
    return session;
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API для создания новой игры
app.post('/api/games/create-session', async (req, res) => {
    const { gameId } = req.body;
    const session = createGameSession(gameId || 'game1');
    
    // Генерируем QR-код
    const baseUrl = req.get('host');
    const protocol = req.protocol;
    const joinUrl = `${protocol}://${baseUrl}/join.html?code=${session.code}`;
    
    try {
        const qrCodeDataUrl = await QRCode.toDataURL(joinUrl);
        
        res.json({
            success: true,
            session: {
                id: session.id,
                code: session.code,
                pin: session.pin,
                joinUrl: joinUrl,
                qrCode: qrCodeDataUrl
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Ошибка генерации QR-кода' });
    }
});

// API для получения сессии по коду
app.get('/api/session/:code', (req, res) => {
    const { code } = req.params;
    
    for (let [id, session] of activeSessions) {
        if (session.code === code) {
            const game = userGames.find(g => g.id === session.gameId);
            return res.json({
                success: true,
                session: {
                    id: session.id,
                    code: session.code,
                    pin: session.pin,
                    active: session.active,
                    currentRound: session.currentRound,
                    currentQuestion: session.currentQuestion
                },
                game: game,
                teams: session.teams
            });
        }
    }
    
    res.status(404).json({ error: 'Сессия не найдена' });
});

// API для присоединения к игре
app.post('/api/session/join', (req, res) => {
    const { code, teamName } = req.body;
    
    let foundSession = null;
    for (let [id, session] of activeSessions) {
        if (session.code === code) {
            foundSession = session;
            break;
        }
    }
    
    if (!foundSession) {
        return res.status(404).json({ error: 'Игра не найдена' });
    }
    
    if (foundSession.teams.length >= 3) {
        return res.status(400).json({ error: 'Достигнут лимит команд' });
    }
    
    const newTeam = {
        id: uuidv4(),
        name: teamName || 'Новая команда',
        score: 0,
        answers: [],
        isActive: true
    };
    
    foundSession.teams.push(newTeam);
    
    // Отправляем обновление всем в этой сессии
    broadcastToSession(foundSession.id, {
        type: 'team_joined',
        team: { id: newTeam.id, name: newTeam.name, score: newTeam.score },
        teams: foundSession.teams
    });
    
    res.json({ 
        success: true, 
        teamId: newTeam.id,
        sessionId: foundSession.id
    });
});

// API для запуска презентации
app.post('/api/session/:sessionId/start-presentation', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
        return res.status(404).json({ error: 'Сессия не найдена' });
    }
    
    session.active = true;
    
    broadcastToSession(sessionId, {
        type: 'presentation_started',
        session: session
    });
    
    res.json({ success: true });
});

// API для управления игрой
app.post('/api/session/:sessionId/start-timer', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    const game = userGames.find(g => g.id === session.gameId);
    const currentRound = game?.rounds[session.currentRound];
    const currentQuestion = currentRound?.questions[session.currentQuestion];
    
    if (!currentQuestion) return res.json({ success: false });
    
    session.timerActive = true;
    session.timerEndTime = Date.now() + (currentRound.settings.timePerQuestion * 1000);
    session.showOptions = true;
    session.startTime = Date.now();
    session.correctAnswerRevealed = false;
    session.answers.clear();
    session.answeredCount = 0;
    
    startTimer(session);
    
    broadcastToSession(sessionId, {
        type: 'timer_started',
        timeLeft: currentRound.settings.timePerQuestion,
        question: currentQuestion
    });
    
    res.json({ success: true });
});

function startTimer(session) {
    const timerInterval = setInterval(() => {
        const timeLeft = Math.max(0, Math.ceil((session.timerEndTime - Date.now()) / 1000));
        
        broadcastToSession(session.id, {
            type: 'timer_update',
            timeLeft: timeLeft
        });
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            session.timerActive = false;
            
            broadcastToSession(session.id, {
                type: 'timer_finished'
            });
        }
    }, 1000);
}

app.post('/api/session/:sessionId/submit-answer', (req, res) => {
    const { sessionId } = req.params;
    const { teamId, optionId } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    const team = session.teams.find(t => t.id === teamId);
    const game = userGames.find(g => g.id === session.gameId);
    const currentRound = game?.rounds[session.currentRound];
    const currentQuestion = currentRound?.questions[session.currentQuestion];
    
    if (!team || !currentQuestion || !session.timerActive || session.answers.has(teamId)) {
        return res.json({ success: false });
    }
    
    const selectedOption = currentQuestion.options.find(o => o.id === optionId);
    const isCorrect = selectedOption?.isCorrect || false;
    const responseTime = session.startTime ? (Date.now() - session.startTime) / 1000 : 0;
    
    let pointsEarned = 0;
    if (isCorrect) {
        if (currentRound.settings.mode === 'fast') {
            const timeRatio = Math.max(0, 1 - (responseTime / currentRound.settings.timePerQuestion));
            pointsEarned = Math.round(currentQuestion.points * (0.5 + timeRatio * 0.5));
        } else {
            pointsEarned = currentQuestion.points;
        }
        team.score += pointsEarned;
    }
    
    session.answers.set(teamId, {
        optionId,
        isCorrect,
        responseTime,
        pointsEarned
    });
    
    session.answeredCount = session.answers.size;
    
    broadcastToSession(sessionId, {
        type: 'answer_submitted',
        teamId,
        optionId,
        isCorrect,
        pointsEarned,
        answeredCount: session.answeredCount,
        totalTeams: session.teams.length,
        teams: session.teams
    });
    
    res.json({ 
        success: true, 
        isCorrect, 
        pointsEarned,
        correctOptionId: currentQuestion.options.find(o => o.isCorrect)?.id
    });
});

app.post('/api/session/:sessionId/show-answer', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    session.correctAnswerRevealed = true;
    
    const game = userGames.find(g => g.id === session.gameId);
    const currentRound = game?.rounds[session.currentRound];
    const currentQuestion = currentRound?.questions[session.currentQuestion];
    
    if (currentQuestion) {
        currentQuestion.answered = true;
    }
    
    const correctOption = currentQuestion?.options.find(o => o.isCorrect);
    
    broadcastToSession(sessionId, {
        type: 'show_answer',
        correctOptionId: correctOption?.id,
        correctText: correctOption?.text
    });
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/next-question', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    const game = userGames.find(g => g.id === session.gameId);
    const currentRound = game?.rounds[session.currentRound];
    
    if (!currentRound) return res.json({ success: false });
    
    if (session.currentQuestion < currentRound.questions.length - 1) {
        session.currentQuestion++;
    } else if (session.currentRound < game.rounds.length - 1) {
        session.currentRound++;
        session.currentQuestion = 0;
    }
    
    session.showOptions = false;
    session.timerActive = false;
    session.correctAnswerRevealed = false;
    session.answers.clear();
    session.answeredCount = 0;
    
    const nextRound = game.rounds[session.currentRound];
    const nextQuestion = nextRound.questions[session.currentQuestion];
    
    broadcastToSession(sessionId, {
        type: 'next_question',
        round: nextRound,
        question: nextQuestion
    });
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/hide-qr', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        session.hideQR = !session.hideQR;
        broadcastToSession(sessionId, { type: 'hide_qr', hideQR: session.hideQR });
    }
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/toggle-points-column', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        session.showPointsColumn = !session.showPointsColumn;
        broadcastToSession(sessionId, { type: 'toggle_points_column', show: session.showPointsColumn });
    }
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/toggle-points-table', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        session.showPointsTable = !session.showPointsTable;
        broadcastToSession(sessionId, { type: 'toggle_points_table', show: session.showPointsTable });
    }
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/update-score', (req, res) => {
    const { sessionId } = req.params;
    const { teamId, newScore } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    const team = session.teams.find(t => t.id === teamId);
    if (team) {
        team.score = newScore;
        broadcastToSession(sessionId, { 
            type: 'score_updated', 
            teamId, 
            newScore,
            teams: session.teams 
        });
    }
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/add-team', (req, res) => {
    const { sessionId } = req.params;
    const { teamName } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    const newTeam = {
        id: uuidv4(),
        name: teamName || 'Новая команда',
        score: 0,
        answers: [],
        isActive: true
    };
    
    session.teams.push(newTeam);
    
    broadcastToSession(sessionId, {
        type: 'team_added',
        team: { id: newTeam.id, name: newTeam.name, score: newTeam.score },
        teams: session.teams
    });
    
    res.json({ success: true, teamId: newTeam.id });
});

app.post('/api/session/:sessionId/remove-team', (req, res) => {
    const { sessionId } = req.params;
    const { teamId } = req.body;
    
    const session = activeSessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Сессия не найдена' });
    
    session.teams = session.teams.filter(t => t.id !== teamId);
    
    broadcastToSession(sessionId, {
        type: 'team_removed',
        teamId,
        teams: session.teams
    });
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/present-players', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        broadcastToSession(sessionId, { 
            type: 'present_players',
            teams: session.teams 
        });
    }
    
    res.json({ success: true });
});

app.post('/api/session/:sessionId/show-winners', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    
    if (session) {
        const sortedTeams = [...session.teams].sort((a, b) => b.score - a.score);
        broadcastToSession(sessionId, { 
            type: 'show_winners', 
            winners: sortedTeams.slice(0, 3) 
        });
    }
    
    res.json({ success: true });
});

function broadcastToSession(sessionId, data) {
    // В реальном приложении здесь нужно хранить WebSocket соединения по сессиям
    // Для упрощения отправляем всем
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.sessionId === sessionId) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket с поддержкой сессий
wss.on('connection', (ws, req) => {
    const urlParams = new URLSearchParams(req.url?.split('?')[1]);
    const sessionId = urlParams.get('sessionId');
    
    if (sessionId) {
        ws.sessionId = sessionId;
        console.log(`WebSocket подключен к сессии ${sessionId}`);
    }
    
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'join_session') {
                ws.sessionId = data.sessionId;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=== 🚀 КВИЗЛИ ЗАПУЩЕН ===');
    console.log(`📌 Порт: ${PORT}`);
    console.log(`👤 Ведущий: http://localhost:${PORT}/host.html`);
    console.log(`📺 Проектор: http://localhost:${PORT}/projector.html`);
    console.log(`📱 Участник: http://localhost:${PORT}/join.html`);
    console.log('===========================\n');
});