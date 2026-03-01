const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище данных
let gameState = {
    pin: Math.floor(1000 + Math.random() * 9000).toString(),
    code: 'EGA78',
    active: false,
    currentRound: 1,
    currentQuestionId: 'q1',
    showOptions: false,
    timerActive: false,
    timerEndTime: null,
    timerDuration: 30,
    correctAnswerRevealed: false,
    answers: new Map(),
    answeredCount: 0,
    startTime: null
};

// Команды
let teams = [
    { id: 't1', name: 'Ffc', score: 500, answers: [], isActive: true }
];

// Вопросы (полная структура как в Квизли)
let rounds = [
    {
        id: 'r1',
        name: 'Раунд 1',
        type: 'classic',
        questions: [
            {
                id: 'q1',
                text: 'Именно с этого вокзала едет в Петушки главный герой поэмы Венедикта Ерофеева.',
                options: [
                    { id: 'o1', text: 'Курский вокзал', letter: 'A' },
                    { id: 'o2', text: 'Ярославский вокзал', letter: 'B' },
                    { id: 'o3', text: 'Павелецкий вокзал', letter: 'C' },
                    { id: 'o4', text: 'Белорусский вокзал', letter: 'D' }
                ],
                correctOptionId: 'o4',
                points: 500,
                answered: true,
                timer: 30,
                media: null,
                hint: null
            }
        ]
    },
    {
        id: 'r2',
        name: 'Раунд 2',
        type: 'abcd',
        questions: [
            {
                id: 'q2',
                text: 'Завершившая в 2020 году карьеру Мария Шарапова успела стать обладательницей стольких титулов международной теннисной ассоциации',
                options: [
                    { id: 'o5', text: '51', letter: 'A' },
                    { id: 'o6', text: '39', letter: 'B' },
                    { id: 'o7', text: '36', letter: 'C' },
                    { id: 'o8', text: '24', letter: 'D' }
                ],
                correctOptionId: 'o7',
                points: 600,
                answered: false,
                timer: 30
            },
            {
                id: 'q3',
                text: 'Чарли Лайн собрал на Кикстартере почти 4 тысячи фунтов для того, чтобы заставить британских цензоров делать это.',
                options: [
                    { id: 'o9', text: 'Узнать, почем фунт лиха', letter: 'A' },
                    { id: 'o10', text: 'Считать цыплят по осени', letter: 'B' },
                    { id: 'o11', text: 'Смотреть, как сохнет краска', letter: 'C' },
                    { id: 'o12', text: 'Сидеть и ждать у моря погоды', letter: 'D' }
                ],
                correctOptionId: 'o11',
                points: 700,
                answered: false,
                timer: 30
            },
            {
                id: 'q4',
                text: 'Все эти актеры — гордость Австралии. А чье место рождения на самом деле — США?',
                options: [
                    { id: 'o13', text: 'Марго Робби', letter: 'A' },
                    { id: 'o14', text: 'Николь Кидман', letter: 'B' },
                    { id: 'o15', text: 'Хью Джекман', letter: 'C' },
                    { id: 'o16', text: 'Крис Хемсворт', letter: 'D' }
                ],
                correctOptionId: 'o14',
                points: 800,
                answered: false,
                timer: 30
            },
            {
                id: 'q5',
                text: 'Какая голливудская знаменитость упоминается самой первой в хите Мадонны "Vogue"?',
                options: [
                    { id: 'o17', text: 'Джин Харлоу', letter: 'A' },
                    { id: 'o18', text: 'Марлен Дитрих', letter: 'B' },
                    { id: 'o19', text: 'Джеймс Дин', letter: 'C' },
                    { id: 'o20', text: 'Грета Гарбо', letter: 'D' }
                ],
                correctOptionId: 'o20',
                points: 1100,
                answered: false,
                timer: 30
            }
        ]
    }
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API endpoints
app.get('/api/game/state', (req, res) => {
    res.json({
        pin: gameState.pin,
        code: gameState.code,
        teams: teams.map(t => ({ id: t.id, name: t.name, score: t.score, isActive: t.isActive })),
        rounds: rounds,
        currentRound: gameState.currentRound,
        currentQuestionId: gameState.currentQuestionId,
        timerActive: gameState.timerActive,
        timerDuration: gameState.timerDuration,
        showOptions: gameState.showOptions,
        answeredCount: gameState.answers.size,
        totalTeams: teams.length
    });
});

app.post('/api/game/join', (req, res) => {
    const { code, teamName } = req.body;

    if (code !== gameState.code) {
        return res.status(400).json({ error: 'Неверный код игры' });
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

app.post('/api/game/start-timer', (req, res) => {
    const currentQuestion = getCurrentQuestion();

    gameState.timerActive = true;
    gameState.timerEndTime = Date.now() + (currentQuestion.timer * 1000);
    gameState.showOptions = true;
    gameState.startTime = Date.now();
    gameState.correctAnswerRevealed = false;
    gameState.answers.clear();
    gameState.answeredCount = 0;

    startTimer();

    broadcast({
        type: 'timer_started',
        timeLeft: currentQuestion.timer,
        questionId: gameState.currentQuestionId
    });

    res.json({ success: true });
});

function startTimer() {
    const timerInterval = setInterval(() => {
        const timeLeft = Math.max(0, Math.ceil((gameState.timerEndTime - Date.now()) / 1000));

        broadcast({
            type: 'timer_update',
            timeLeft: timeLeft
        });

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            gameState.timerActive = false;

            broadcast({
                type: 'timer_finished'
            });
        }
    }, 1000);
}

app.post('/api/game/submit-answer', (req, res) => {
    const { teamId, optionId } = req.body;
    const team = teams.find(t => t.id === teamId);
    const currentQuestion = getCurrentQuestion();

    if (!team || !currentQuestion || !gameState.timerActive || gameState.answers.has(teamId)) {
        return res.json({ success: false });
    }

    const isCorrect = optionId === currentQuestion.correctOptionId;
    const responseTime = gameState.startTime ? (Date.now() - gameState.startTime) / 1000 : 0;

    // Расчет очков (чем быстрее, тем больше)
    let pointsEarned = 0;
    if (isCorrect) {
        const maxPoints = currentQuestion.points;
        const timeRatio = Math.max(0, 1 - (responseTime / currentQuestion.timer));
        pointsEarned = Math.round(maxPoints * (0.5 + timeRatio * 0.5));
        team.score += pointsEarned;
    }

    gameState.answers.set(teamId, {
        optionId,
        isCorrect,
        responseTime,
        pointsEarned
    });

    gameState.answeredCount = gameState.answers.size;

    broadcast({
        type: 'answer_submitted',
        teamId,
        teamName: team.name,
        optionId,
        isCorrect,
        pointsEarned,
        answeredCount: gameState.answeredCount,
        totalTeams: teams.length
    });

    res.json({
        success: true,
        isCorrect,
        pointsEarned,
        correctOptionId: currentQuestion.correctOptionId
    });
});

app.post('/api/game/show-answer', (req, res) => {
    gameState.correctAnswerRevealed = true;
    const currentQuestion = getCurrentQuestion();

    // Отмечаем вопрос как отвеченный
    currentQuestion.answered = true;

    broadcast({
        type: 'show_answer',
        correctOptionId: currentQuestion.correctOptionId,
        correctText: currentQuestion.options.find(o => o.id === currentQuestion.correctOptionId).text
    });

    res.json({ success: true });
});

app.post('/api/game/hide-question', (req, res) => {
    gameState.showOptions = false;
    gameState.timerActive = false;

    broadcast({
        type: 'hide_question'
    });

    res.json({ success: true });
});

app.post('/api/game/next-question', (req, res) => {
    const currentRound = rounds.find(r => r.id === `r${gameState.currentRound}`);
    const currentIndex = currentRound.questions.findIndex(q => q.id === gameState.currentQuestionId);

    if (currentIndex < currentRound.questions.length - 1) {
        // Следующий вопрос в этом же раунде
        gameState.currentQuestionId = currentRound.questions[currentIndex + 1].id;
    } else if (gameState.currentRound < rounds.length) {
        // Переход к следующему раунду
        gameState.currentRound++;
        const nextRound = rounds.find(r => r.id === `r${gameState.currentRound}`);
        if (nextRound && nextRound.questions.length > 0) {
            gameState.currentQuestionId = nextRound.questions[0].id;
        }
    }

    gameState.showOptions = false;
    gameState.timerActive = false;
    gameState.correctAnswerRevealed = false;
    gameState.answers.clear();
    gameState.answeredCount = 0;

    broadcast({
        type: 'next_question',
        question: getCurrentQuestion(),
        round: gameState.currentRound
    });

    res.json({ success: true });
});

app.post('/api/game/update-score', (req, res) => {
    const { teamId, newScore } = req.body;
    const team = teams.find(t => t.id === teamId);

    if (team) {
        team.score = newScore;

        broadcast({
            type: 'score_updated',
            teamId,
            newScore
        });
    }

    res.json({ success: true });
});

app.post('/api/game/add-team', (req, res) => {
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

app.post('/api/game/remove-team', (req, res) => {
    const { teamId } = req.body;

    teams = teams.filter(t => t.id !== teamId);

    broadcast({
        type: 'team_removed',
        teamId
    });

    res.json({ success: true });
});

app.post('/api/game/reset', (req, res) => {
    gameState = {
        ...gameState,
        currentRound: 1,
        currentQuestionId: 'q1',
        showOptions: false,
        timerActive: false,
        correctAnswerRevealed: false,
        answers: new Map(),
        answeredCount: 0
    };

    teams = teams.map(t => ({ ...t, score: 0, answers: [] }));

    rounds.forEach(round => {
        round.questions.forEach(q => {
            q.answered = false;
        });
    });

    broadcast({
        type: 'game_reset'
    });

    res.json({ success: true });
});

function getCurrentQuestion() {
    const currentRound = rounds.find(r => r.id === `r${gameState.currentRound}`);
    return currentRound?.questions.find(q => q.id === gameState.currentQuestionId);
}

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// WebSocket для реального времени
wss.on('connection', (ws) => {
    console.log('Новое WebSocket подключение');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join_as_host':
                    ws.role = 'host';
                    break;

                case 'join_as_projector':
                    ws.role = 'projector';
                    break;

                case 'join_as_player':
                    ws.role = 'player';
                    ws.teamId = data.teamId;
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=== 🚀 КВИЗЛИ КЛОН ЗАПУЩЕН ===');
    console.log(`📌 Локальный: http://localhost:${PORT}`);
    console.log(`👤 Ведущий: http://localhost:${PORT}/host.html`);
    console.log(`📺 Проектор: http://localhost:${PORT}/projector.html`);
    console.log(`📱 Участник: http://localhost:${PORT}/join.html`);
    console.log(`🔑 Код игры: ${gameState.code}`);
    console.log('===============================\n');
});