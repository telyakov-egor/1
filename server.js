const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Хранилище данных игры
let gameState = {
    pin: Math.floor(1000 + Math.random() * 9000).toString(),
    active: false,
    currentSlide: 0,
    showOptions: false,
    timerActive: false,
    timerEndTime: null,
    timerDuration: 0,
    questionStartTime: null,
    correctAnswerRevealed: false,
    answers: new Map(),
    answeredCount: 0
};

let participants = [];

// Вопросы с медиа (используем надежные CDN ссылки)
let questions = [
    {
        type: 'welcome',
        title: '🎮 Добро пожаловать!',
        subtitle: 'Интерактивный квиз',
        background: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1200'
    },
    {
        type: 'question',
        question: 'Кто исполняет эту песню?',
        options: ['Ed Sheeran', 'Bruno Mars', 'The Weeknd', 'Sam Smith'],
        correct: 1,
        timer: 25,
        audio: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800'
    },
    {
        type: 'question',
        question: 'Какая планета самая большая?',
        options: ['Венера', 'Юпитер', 'Сатурн', 'Марс'],
        correct: 1,
        timer: 20,
        image: 'https://images.unsplash.com/photo-1614732414444-096e5f1122c5?w=800'
    },
    {
        type: 'question',
        question: 'Сколько спутников у Марса?',
        options: ['1', '2', '3', '4'],
        correct: 1,
        timer: 15,
        image: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800'
    },
    {
        type: 'podium',
        title: '🏆 Итоги игры'
    }
];

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API endpoints
app.get('/api/pin', (req, res) => {
    res.json({ pin: gameState.pin });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

app.post('/api/start', (req, res) => {
    gameState.active = true;
    gameState.currentSlide = 0;
    gameState.showOptions = false;
    gameState.timerActive = false;
    gameState.correctAnswerRevealed = false;
    gameState.answers.clear();
    gameState.answeredCount = 0;

    broadcast({
        type: 'game_started',
        slide: questions[0]
    });

    res.json({ success: true });
});

app.post('/api/next', (req, res) => {
    if (gameState.currentSlide < questions.length - 1) {
        gameState.currentSlide++;
        gameState.showOptions = false;
        gameState.timerActive = false;
        gameState.correctAnswerRevealed = false;
        gameState.answers.clear();
        gameState.answeredCount = 0;

        broadcast({
            type: 'slide_changed',
            slide: questions[gameState.currentSlide]
        });
    }
    res.json({ success: true });
});

app.post('/api/show-options', (req, res) => {
    const currentQuestion = questions[gameState.currentSlide];

    if (currentQuestion.type === 'question') {
        gameState.showOptions = true;
        gameState.timerActive = true;
        gameState.timerDuration = currentQuestion.timer;
        gameState.timerEndTime = Date.now() + (currentQuestion.timer * 1000);
        gameState.questionStartTime = Date.now();
        gameState.correctAnswerRevealed = false;
        gameState.answers.clear();
        gameState.answeredCount = 0;

        startTimer();

        broadcast({
            type: 'show_options',
            timer: currentQuestion.timer
        });
    }

    res.json({ success: true });
});

function calculateScore(responseTime, maxTime, basePoints = 1000) {
    const timeRatio = Math.max(0, 1 - (responseTime / (maxTime * 1000)));
    return Math.round(basePoints * (0.5 + timeRatio * 0.5));
}

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
            gameState.correctAnswerRevealed = true;

            const currentQuestion = questions[gameState.currentSlide];

            broadcast({
                type: 'show_results',
                correctIndex: currentQuestion.correct,
                correctText: currentQuestion.options[currentQuestion.correct]
            });

            participants.forEach(participant => {
                const answer = gameState.answers.get(participant.id);
                let pointsEarned = 0;

                if (answer && answer.isCorrect) {
                    pointsEarned = calculateScore(answer.responseTime, currentQuestion.timer);
                    participant.score += pointsEarned;
                }

                if (participant.ws && participant.ws.readyState === WebSocket.OPEN) {
                    participant.ws.send(JSON.stringify({
                        type: 'your_result',
                        correct: answer ? answer.isCorrect : false,
                        correctAnswer: currentQuestion.options[currentQuestion.correct],
                        pointsEarned: pointsEarned,
                        totalScore: participant.score
                    }));
                }
            });

            broadcastLeaderboard();
        }
    }, 1000);
}

app.post('/api/reset', (req, res) => {
    gameState.active = false;
    gameState.currentSlide = 0;
    gameState.showOptions = false;
    gameState.timerActive = false;
    gameState.correctAnswerRevealed = false;
    gameState.answers.clear();
    participants = [];
    broadcast({ type: 'game_reset' });
    res.json({ success: true });
});

// WebSocket
wss.on('connection', (ws) => {
    console.log('Новое подключение');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'join':
                    if (data.pin === gameState.pin) {
                        const participant = {
                            id: Date.now().toString() + Math.random(),
                            name: data.name || 'Игрок',
                            score: 0,
                            answers: [],
                            ws: ws
                        };

                        participants.push(participant);
                        ws.participantId = participant.id;

                        ws.send(JSON.stringify({
                            type: 'joined',
                            success: true,
                            participantId: participant.id
                        }));

                        ws.send(JSON.stringify({
                            type: 'current_slide',
                            slide: questions[gameState.currentSlide],
                            showOptions: gameState.showOptions,
                            timerActive: gameState.timerActive,
                            timeLeft: gameState.timerActive ? Math.max(0, Math.ceil((gameState.timerEndTime - Date.now()) / 1000)) : 0
                        }));

                        broadcastParticipants();
                    } else {
                        ws.send(JSON.stringify({
                            type: 'joined',
                            success: false,
                            error: 'Неверный ПИН-код'
                        }));
                    }
                    break;

                case 'answer':
                    const participant = participants.find(p => p.id === ws.participantId);
                    if (participant && gameState.timerActive && !gameState.correctAnswerRevealed) {
                        const currentQuestion = questions[gameState.currentSlide];

                        if (!gameState.answers.has(participant.id)) {
                            const responseTime = (Date.now() - gameState.questionStartTime) / 1000;
                            const isCorrect = data.answer === currentQuestion.correct;

                            gameState.answers.set(participant.id, {
                                answerIndex: data.answer,
                                isCorrect: isCorrect,
                                responseTime: responseTime
                            });

                            if (isCorrect) {
                                participant.answers.push({
                                    questionIndex: gameState.currentSlide,
                                    correct: true,
                                    responseTime: responseTime
                                });
                            }

                            gameState.answeredCount = gameState.answers.size;

                            ws.send(JSON.stringify({
                                type: 'answer_accepted'
                            }));

                            broadcast({
                                type: 'answered_count',
                                count: gameState.answeredCount,
                                total: participants.length
                            });
                        }
                    }
                    break;
            }
        } catch (e) {
            console.error('Ошибка обработки сообщения:', e);
        }
    });

    ws.on('close', () => {
        participants = participants.filter(p => p.ws !== ws);
        broadcastParticipants();
    });
});

function broadcast(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

function broadcastParticipants() {
    const participantList = participants.map(p => ({
        id: p.id,
        name: p.name,
        score: p.score
    }));

    broadcast({
        type: 'participants',
        participants: participantList
    });
}

function broadcastLeaderboard() {
    const leaderboard = [...participants]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: p.score }));

    broadcast({
        type: 'leaderboard',
        leaderboard
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=== 🚀 СЕРВЕР ЗАПУЩЕН ===');
    console.log(`📱 Порт: ${PORT}`);
    console.log(`👤 Ведущий: http://localhost:${PORT}/host.html`);
    console.log(`📱 Участник: http://localhost:${PORT}/join.html`);
    console.log(`🔑 PIN код: ${gameState.pin}`);
    console.log('========================\n');
});