const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Health check для Railway
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

// Текущая игровая сессия
let gameSession = {
    id: uuidv4(),
    gameId: 'game1',
    code: '5GXCR',
    pin: Math.floor(1000 + Math.random() * 9000).toString(),
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
    showPointsTable: false
};

// Команды
let teams = [
    { id: 't1', name: 'Команда 1', score: 0, answers: [], isActive: true }
];

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API для игр пользователя
app.get('/api/games', (req, res) => {
    res.json(userGames);
});

app.get('/api/games/:gameId', (req, res) => {
    const game = userGames.find(g => g.id === req.params.gameId);
    res.json(game);
});

app.post('/api/games', (req, res) => {
    const newGame = {
        id: uuidv4(),
        title: req.body.title || 'Новая игра',
        createdAt: new Date().toISOString().split('T')[0],
        rounds: []
    };
    userGames.push(newGame);
    res.json(newGame);
});

// API для игровой сессии
app.get('/api/session/state', (req, res) => {
    const currentGame = userGames.find(g => g.id === gameSession.gameId);
    const currentRound = currentGame?.rounds[gameSession.currentRound];
    const currentQuestion = currentRound?.questions[gameSession.currentQuestion];
    
    res.json({
        session: {
            id: gameSession.id,
            code: gameSession.code,
            pin: gameSession.pin,
            active: gameSession.active,
            currentRound: gameSession.currentRound,
            currentQuestion: gameSession.currentQuestion,
            showOptions: gameSession.showOptions,
            timerActive: gameSession.timerActive,
            timerDuration: gameSession.timerDuration,
            answeredCount: gameSession.answers.size,
            totalTeams: teams.length,
            hideQR: gameSession.hideQR,
            showPointsColumn: gameSession.showPointsColumn,
            showPointsTable: gameSession.showPointsTable
        },
        game: currentGame,
        currentRound: currentRound,
        currentQuestion: currentQuestion,
        teams: teams.map(t => ({ id: t.id, name: t.name, score: t.score }))
    });
});

app.post('/api/session/join', (req, res) => {
    const { code, teamName } = req.body;
    
    if (code !== gameSession.code) {
        return res.status(400).json({ error: 'Неверный код игры' });
    }
    
    if (teams.length >= 3) {
        return res.status(400).json({ error: 'Достигнут лимит команд на бесплатном тарифе' });
    }
    
    const newTeam = {
        id: uuidv4(),
        name: teamName || 'Новая команда',
        score: 0,
        answers: [],
        isActive: true
    };
    
    teams.push(newTeam);
    
    broadcast({
        type: 'team_joined',
        team: { id: newTeam.id, name: newTeam.name, score: newTeam.score }
    });
    
    res.json({ success: true, teamId: newTeam.id });
});

app.post('/api/session/start-timer', (req, res) => {
    const currentGame = userGames.find(g => g.id === gameSession.gameId);
    const currentRound = currentGame?.rounds[gameSession.currentRound];
    const currentQuestion = currentRound?.questions[gameSession.currentQuestion];
    
    if (!currentQuestion) return res.json({ success: false });
    
    gameSession.timerActive = true;
    gameSession.timerEndTime = Date.now() + (currentRound.settings.timePerQuestion * 1000);
    gameSession.showOptions = true;
    gameSession.startTime = Date.now();
    gameSession.correctAnswerRevealed = false;
    gameSession.answers.clear();
    gameSession.answeredCount = 0;
    
    startTimer();
    
    broadcast({
        type: 'timer_started',
        timeLeft: currentRound.settings.timePerQuestion,
        question: currentQuestion
    });
    
    res.json({ success: true });
});

function startTimer() {
    const timerInterval = setInterval(() => {
        const timeLeft = Math.max(0, Math.ceil((gameSession.timerEndTime - Date.now()) / 1000));
        
        broadcast({
            type: 'timer_update',
            timeLeft: timeLeft
        });
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameSession.timerActive = false;
            
            broadcast({
                type: 'timer_finished'
            });
        }
    }, 1000);
}

app.post('/api/session/submit-answer', (req, res) => {
    const { teamId, optionId } = req.body;
    const team = teams.find(t => t.id === teamId);
    
    const currentGame = userGames.find(g => g.id === gameSession.gameId);
    const currentRound = currentGame?.rounds[gameSession.currentRound];
    const currentQuestion = currentRound?.questions[gameSession.currentQuestion];
    
    if (!team || !currentQuestion || !gameSession.timerActive || gameSession.answers.has(teamId)) {
        return res.json({ success: false });
    }
    
    const selectedOption = currentQuestion.options.find(o => o.id === optionId);
    const isCorrect = selectedOption?.isCorrect || false;
    const responseTime = gameSession.startTime ? (Date.now() - gameSession.startTime) / 1000 : 0;
    
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
    
    gameSession.answers.set(teamId, {
        optionId,
        isCorrect,
        responseTime,
        pointsEarned
    });
    
    gameSession.answeredCount = gameSession.answers.size;
    
    broadcast({
        type: 'answer_submitted',
        teamId,
        optionId,
        isCorrect,
        pointsEarned,
        answeredCount: gameSession.answeredCount,
        totalTeams: teams.length
    });
    
    res.json({ 
        success: true, 
        isCorrect, 
        pointsEarned,
        correctOptionId: currentQuestion.options.find(o => o.isCorrect)?.id
    });
});

app.post('/api/session/show-answer', (req, res) => {
    gameSession.correctAnswerRevealed = true;
    
    const currentGame = userGames.find(g => g.id === gameSession.gameId);
    const currentRound = currentGame?.rounds[gameSession.currentRound];
    const currentQuestion = currentRound?.questions[gameSession.currentQuestion];
    
    if (currentQuestion) {
        currentQuestion.answered = true;
    }
    
    const correctOption = currentQuestion?.options.find(o => o.isCorrect);
    
    broadcast({
        type: 'show_answer',
        correctOptionId: correctOption?.id,
        correctText: correctOption?.text
    });
    
    res.json({ success: true });
});

app.post('/api/session/next-question', (req, res) => {
    const currentGame = userGames.find(g => g.id === gameSession.gameId);
    const currentRound = currentGame?.rounds[gameSession.currentRound];
    
    if (!currentRound) return res.json({ success: false });
    
    if (gameSession.currentQuestion < currentRound.questions.length - 1) {
        gameSession.currentQuestion++;
    } else if (gameSession.currentRound < currentGame.rounds.length - 1) {
        gameSession.currentRound++;
        gameSession.currentQuestion = 0;
    }
    
    gameSession.showOptions = false;
    gameSession.timerActive = false;
    gameSession.correctAnswerRevealed = false;
    gameSession.answers.clear();
    gameSession.answeredCount = 0;
    
    const nextRound = currentGame.rounds[gameSession.currentRound];
    const nextQuestion = nextRound.questions[gameSession.currentQuestion];
    
    broadcast({
        type: 'next_question',
        round: nextRound,
        question: nextQuestion
    });
    
    res.json({ success: true });
});

app.post('/api/session/hide-qr', (req, res) => {
    gameSession.hideQR = !gameSession.hideQR;
    broadcast({ type: 'hide_qr', hideQR: gameSession.hideQR });
    res.json({ success: true });
});

app.post('/api/session/toggle-points-column', (req, res) => {
    gameSession.showPointsColumn = !gameSession.showPointsColumn;
    broadcast({ type: 'toggle_points_column', show: gameSession.showPointsColumn });
    res.json({ success: true });
});

app.post('/api/session/toggle-points-table', (req, res) => {
    gameSession.showPointsTable = !gameSession.showPointsTable;
    broadcast({ type: 'toggle_points_table', show: gameSession.showPointsTable });
    res.json({ success: true });
});

app.post('/api/session/update-score', (req, res) => {
    const { teamId, newScore } = req.body;
    const team = teams.find(t => t.id === teamId);
    
    if (team) {
        team.score = newScore;
        broadcast({ type: 'score_updated', teamId, newScore });
    }
    
    res.json({ success: true });
});

app.post('/api/session/add-team', (req, res) => {
    const { teamName } = req.body;
    
    const newTeam = {
        id: uuidv4(),
        name: teamName || 'Новая команда',
        score: 0,
        answers: [],
        isActive: true
    };
    
    teams.push(newTeam);
    
    broadcast({
        type: 'team_added',
        team: { id: newTeam.id, name: newTeam.name, score: newTeam.score }
    });
    
    res.json({ success: true, teamId: newTeam.id });
});

app.post('/api/session/remove-team', (req, res) => {
    const { teamId } = req.body;
    teams = teams.filter(t => t.id !== teamId);
    broadcast({ type: 'team_removed', teamId });
    res.json({ success: true });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket
wss.on('connection', (ws) => {
    console.log('Новое WebSocket подключение');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=== 🚀 КВИЗЛИ ЗАПУЩЕН ===');
    console.log(`📌 Порт: ${PORT}`);
    console.log(`👤 Ведущий: /host.html`);
    console.log(`📺 Проектор: /projector.html`);
    console.log(`📱 Участник: /join.html`);
    console.log(`🔑 Код игры: ${gameSession.code}`);
    console.log('===========================\n');
});