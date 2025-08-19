class RhythmGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.isPlaying = false;
        this.notes = [];
        this.lanes = 4;
        this.laneWidth = this.canvas.width / this.lanes;
        this.hitLineY = this.canvas.height - 100;
        this.noteSpeed = 3;
        this.lastNoteTime = 0;
        this.noteInterval = 500;
        this.audioContext = null;
        this.keys = ['d', 'f', 'j', 'k'];
        this.keyStates = {};
        this.hitEffects = [];
        this.voiceBuffers = {};
        
        this.init();
        this.prepareVoices();
    }

    init() {
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('stopBtn').addEventListener('click', () => this.stop());
        
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    async prepareVoices() {
        // 初回読み込み時に音声を生成してData URLとして保存
        if (Object.keys(this.voiceBuffers).length > 0) return;
        
        const createVoiceDataURL = (text, pitch, rate) => {
            return new Promise((resolve) => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.pitch = pitch;
                utterance.rate = rate;
                utterance.volume = 0.7;
                
                // 女性の声を選択
                const voices = speechSynthesis.getVoices();
                const femaleVoice = voices.find(voice => 
                    voice.name.toLowerCase().includes('female') || 
                    voice.name.toLowerCase().includes('woman') ||
                    voice.name.toLowerCase().includes('samantha') ||
                    voice.name.toLowerCase().includes('victoria') ||
                    voice.name.toLowerCase().includes('karen') ||
                    voice.name.toLowerCase().includes('moira') ||
                    voice.name.toLowerCase().includes('fiona') ||
                    voice.name.toLowerCase().includes('tessa') ||
                    voice.name.toLowerCase().includes('zira') ||
                    voice.name.toLowerCase().includes('google us english female') ||
                    voice.name.toLowerCase().includes('microsoft zira') ||
                    voice.name.toLowerCase().includes('google uk english female')
                );
                
                if (femaleVoice) {
                    utterance.voice = femaleVoice;
                } else {
                    const englishVoice = voices.find(voice => voice.lang.includes('en'));
                    if (englishVoice) {
                        utterance.voice = englishVoice;
                        utterance.pitch = Math.min(2, pitch * 1.2);
                    }
                }
                
                // 音声合成を一度実行してからキャンセル（初期化のため）
                speechSynthesis.speak(utterance);
                setTimeout(() => {
                    speechSynthesis.cancel();
                    resolve();
                }, 100);
            });
        };
        
        // 声が利用可能になったら初期化
        if (speechSynthesis.getVoices().length === 0) {
            speechSynthesis.addEventListener('voiceschanged', () => {
                this.prepareVoices();
            }, { once: true });
        } else {
            // ダミーの音声を生成して初期化
            await createVoiceDataURL('', 1.5, 1.0);
        }
    }

    start() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        this.isPlaying = true;
        this.score = 0;
        this.combo = 0;
        this.notes = [];
        this.hitEffects = [];
        
        document.getElementById('startBtn').disabled = true;
        document.getElementById('stopBtn').disabled = false;
        
        this.gameLoop();
        this.generateNotes();
    }

    stop() {
        this.isPlaying = false;
        document.getElementById('startBtn').disabled = false;
        document.getElementById('stopBtn').disabled = true;
    }

    generateNotes() {
        if (!this.isPlaying) return;
        
        const currentTime = Date.now();
        if (currentTime - this.lastNoteTime > this.noteInterval) {
            const lane = Math.floor(Math.random() * this.lanes);
            this.notes.push({
                lane: lane,
                y: -20,
                hit: false
            });
            this.lastNoteTime = currentTime;
            
            this.noteInterval = 300 + Math.random() * 700;
        }
        
        setTimeout(() => this.generateNotes(), 50);
    }

    handleKeyDown(e) {
        if (!this.isPlaying) return;
        
        const key = e.key.toLowerCase();
        const laneIndex = this.keys.indexOf(key);
        
        if (laneIndex !== -1 && !this.keyStates[key]) {
            this.keyStates[key] = true;
            this.checkHit(laneIndex);
        }
    }

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        this.keyStates[key] = false;
    }

    checkHit(lane) {
        let hitNote = null;
        let minDistance = Infinity;
        
        for (let note of this.notes) {
            if (note.lane === lane && !note.hit) {
                const distance = Math.abs(note.y - this.hitLineY);
                if (distance < minDistance && distance < 50) {
                    minDistance = distance;
                    hitNote = note;
                }
            }
        }
        
        if (hitNote) {
            hitNote.hit = true;
            
            let judgment = '';
            let points = 0;
            let color = '';
            
            if (minDistance < 15) {
                judgment = 'PERFECT!';
                points = 300;
                color = '#FFD700';
                this.combo++;
            } else if (minDistance < 30) {
                judgment = 'GREAT!';
                points = 200;
                color = '#00FF00';
                this.combo++;
            } else {
                judgment = 'GOOD';
                points = 100;
                color = '#00BFFF';
                this.combo++;
            }
            
            this.score += points * (1 + Math.floor(this.combo / 10) * 0.1);
            this.maxCombo = Math.max(this.combo, this.maxCombo);
            
            this.hitEffects.push({
                x: lane * this.laneWidth + this.laneWidth / 2,
                y: this.hitLineY,
                text: judgment,
                color: color,
                alpha: 1,
                scale: 1
            });
            
            this.playHitSound(points);
            this.updateUI(judgment);
        } else {
            this.combo = 0;
            this.updateUI('MISS');
            this.playMissSound();
        }
    }

    playHitSound(points) {
        // キューを使わずに即座に音声を再生
        speechSynthesis.cancel(); // 現在のキューをクリア
        
        const utterance = new SpeechSynthesisUtterance('yeah!');
        utterance.rate = 1.2 + (points / 300) * 0.5;
        utterance.pitch = 1.3 + (points / 300) * 0.5;
        utterance.volume = 0.7;
        
        // 女性の声を選択
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('female') || 
            voice.name.toLowerCase().includes('woman') ||
            voice.name.toLowerCase().includes('samantha') ||
            voice.name.toLowerCase().includes('victoria') ||
            voice.name.toLowerCase().includes('karen') ||
            voice.name.toLowerCase().includes('moira') ||
            voice.name.toLowerCase().includes('fiona') ||
            voice.name.toLowerCase().includes('tessa') ||
            voice.name.toLowerCase().includes('zira') ||
            voice.name.toLowerCase().includes('google us english female') ||
            voice.name.toLowerCase().includes('microsoft zira') ||
            voice.name.toLowerCase().includes('google uk english female')
        );
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        } else {
            const englishVoice = voices.find(voice => voice.lang.includes('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
                utterance.pitch = Math.min(2, 1.8);
            }
        }
        
        // 即座に新しい音声を再生
        speechSynthesis.speak(utterance);
        
        // Web Audio APIでキラキラ効果音を追加（完全に並列再生可能）
        if (this.audioContext) {
            const now = this.audioContext.currentTime;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 1500 + points * 3;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.05, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            oscillator.start(now);
            oscillator.stop(now + 0.1);
        }
    }

    playMissSound() {
        // キューをクリアして即座に再生
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance('oh no');
        utterance.rate = 0.8;
        utterance.pitch = 1.2;
        utterance.volume = 0.5;
        
        // 女性の声を選択
        const voices = speechSynthesis.getVoices();
        const femaleVoice = voices.find(voice => 
            voice.name.toLowerCase().includes('female') || 
            voice.name.toLowerCase().includes('woman') ||
            voice.name.toLowerCase().includes('samantha') ||
            voice.name.toLowerCase().includes('victoria') ||
            voice.name.toLowerCase().includes('karen') ||
            voice.name.toLowerCase().includes('moira') ||
            voice.name.toLowerCase().includes('fiona') ||
            voice.name.toLowerCase().includes('tessa') ||
            voice.name.toLowerCase().includes('zira') ||
            voice.name.toLowerCase().includes('google us english female') ||
            voice.name.toLowerCase().includes('microsoft zira') ||
            voice.name.toLowerCase().includes('google uk english female')
        );
        
        if (femaleVoice) {
            utterance.voice = femaleVoice;
        } else {
            const englishVoice = voices.find(voice => voice.lang.includes('en'));
            if (englishVoice) {
                utterance.voice = englishVoice;
                utterance.pitch = 1.5;
            }
        }
        
        speechSynthesis.speak(utterance);
        
        // Web Audio APIで低音のブザー音を追加
        if (this.audioContext) {
            const now = this.audioContext.currentTime;
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.frequency.value = 80;
            oscillator.type = 'sawtooth';
            
            gainNode.gain.setValueAtTime(0.08, now);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            
            oscillator.start(now);
            oscillator.stop(now + 0.15);
        }
    }

    updateUI(judgment) {
        document.getElementById('score').textContent = Math.floor(this.score);
        document.getElementById('combo').textContent = this.combo;
        document.getElementById('judgment').textContent = judgment;
    }

    update() {
        for (let i = this.notes.length - 1; i >= 0; i--) {
            const note = this.notes[i];
            note.y += this.noteSpeed;
            
            if (note.y > this.canvas.height + 20) {
                if (!note.hit) {
                    this.combo = 0;
                    this.updateUI('MISS');
                }
                this.notes.splice(i, 1);
            }
        }
        
        for (let i = this.hitEffects.length - 1; i >= 0; i--) {
            const effect = this.hitEffects[i];
            effect.alpha -= 0.02;
            effect.scale += 0.02;
            effect.y -= 1;
            
            if (effect.alpha <= 0) {
                this.hitEffects.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = 0; i < this.lanes; i++) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(i * this.laneWidth, 0);
            this.ctx.lineTo(i * this.laneWidth, this.canvas.height);
            this.ctx.stroke();
        }
        
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.hitLineY);
        this.ctx.lineTo(this.canvas.width, this.hitLineY);
        this.ctx.stroke();
        
        for (let i = 0; i < this.lanes; i++) {
            const x = i * this.laneWidth + this.laneWidth / 2;
            const y = this.hitLineY;
            
            if (this.keyStates[this.keys[i]]) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(i * this.laneWidth, this.hitLineY - 30, this.laneWidth, 60);
            }
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x - 30, y - 15, 60, 30);
            
            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(this.keys[i].toUpperCase(), x, y);
        }
        
        for (let note of this.notes) {
            if (!note.hit) {
                const x = note.lane * this.laneWidth + this.laneWidth / 2;
                
                const gradient = this.ctx.createLinearGradient(x - 25, note.y - 10, x + 25, note.y + 10);
                gradient.addColorStop(0, '#FF69B4');
                gradient.addColorStop(1, '#FFB6C1');
                
                this.ctx.fillStyle = gradient;
                this.ctx.fillRect(x - 25, note.y - 10, 50, 20);
                
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x - 25, note.y - 10, 50, 20);
            }
        }
        
        for (let effect of this.hitEffects) {
            this.ctx.save();
            this.ctx.globalAlpha = effect.alpha;
            this.ctx.fillStyle = effect.color;
            this.ctx.font = `bold ${20 * effect.scale}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(effect.text, effect.x, effect.y);
            this.ctx.restore();
        }
    }

    gameLoop() {
        if (!this.isPlaying) return;
        
        this.update();
        this.draw();
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

const game = new RhythmGame();