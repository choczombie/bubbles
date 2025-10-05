// main.js - The core game loop and initialization with configurable timing
// Version: 2.2.0

import { initializeInput, getVisualStrokes, getCurrentStroke, cleanupExpiredStrokes } from './inputHandler.js';
import { Bubble, SpecialBubbleTypes } from './bubble.js';
import { Button } from './ui.js';
import { gameSettings, calculateDifficultyValues, SettingsManager } from './settings.js';

window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Game State Management
    const GameState = {
        MENU: 'menu',
        ABOUT: 'about',
        SETTINGS: 'settings',
        GAME: 'game',
        PAUSE_CONFIRM: 'pause_confirm',
        END_GAME: 'end_game',
    };
    let currentState = GameState.MENU;

    // Game Variables
    let gameStartTime = 0;
    let bubbles = [];
    let popCount = 0;
    let specialPopCount = 0;
    let missedCount = 0;
    let lastSpawnTime = 0;
    
    // Dynamic difficulty values (updated based on pops)
    let currentSpawnRate = 1000;
    let currentMaxBubbles = 20;
    let currentMinSpeed = 0.2;
    let currentMaxSpeed = 0.7;

    // Recognition System
    let recognizer = new PDollarRecognizer();
    let recognitionThreshold = 0.4;

    // UI Elements
    let menuButtons = [];
    let aboutButtons = [];
    let pauseButtons = [];
    let endGameButtons = [];
    let settingsManager = null;

    // Background Effect System
    let backgroundEffect = null;

    // Initialize gesture templates
    function initializeTemplates() {
        // Circle template - more points for better recognition
        const circlePoints = [];
        for (let i = 0; i <= 24; i++) {
            const angle = (i / 24) * 2 * Math.PI;
            circlePoints.push(new Point(
                100 + Math.cos(angle) * 40,
                100 + Math.sin(angle) * 40,
                1
            ));
        }
        recognizer.AddGesture('circle', circlePoints);

        // Triangle template
        recognizer.AddGesture('triangle', [
            new Point(100, 60, 1),   // Top point
            new Point(70, 130, 1),   // Bottom left
            new Point(130, 130, 1),  // Bottom right
            new Point(100, 60, 1)    // Back to top to close
        ]);

        // X template - two separate strokes
        recognizer.AddGesture('X', [
            // First diagonal stroke
            new Point(70, 70, 1), new Point(80, 80, 1), new Point(90, 90, 1),
            new Point(100, 100, 1), new Point(110, 110, 1), new Point(120, 120, 1), 
            new Point(130, 130, 1),
            // Second diagonal stroke  
            new Point(130, 70, 2), new Point(120, 80, 2), new Point(110, 90, 2),
            new Point(100, 100, 2), new Point(90, 110, 2), new Point(80, 120, 2),
            new Point(70, 130, 2)
        ]);

        console.log('Templates initialized: circle, triangle, X');
    }

    // --- DIFFICULTY MANAGEMENT ---
    function updateDifficulty() {
        const totalPops = popCount + specialPopCount;
        const difficulty = calculateDifficultyValues(totalPops);
        
        currentSpawnRate = difficulty.spawnRate;
        currentMaxBubbles = difficulty.maxBubbles;
        currentMinSpeed = difficulty.minSpeed;
        currentMaxSpeed = difficulty.maxSpeed;
        
        console.log(`Difficulty updated: pops=${totalPops}, spawn=${currentSpawnRate}ms, speed=${currentMinSpeed}-${currentMaxSpeed}, max=${currentMaxBubbles}`);
    }

    // --- BUBBLE MANAGEMENT ---
    function spawnBubble() {
        // Base radius - 3x larger in baby mode
        let baseRadius = gameSettings.babyMode ? 60 : 20; // Triple size in baby mode
        let radiusVariation = gameSettings.babyMode ? 30 : 30; // Keep some variation
        const radius = Math.random() * radiusVariation + baseRadius;
        
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = canvas.height + radius;
        
        let specialType = null;
        let color;
        
        // Use settings-based special bubble frequency
        if (Math.random() < gameSettings.specialBubbleFrequency) {
            const types = Object.values(SpecialBubbleTypes);
            specialType = types[Math.floor(Math.random() * types.length)];
            color = null; // Color will be determined by special type
        } else {
            color = `rgba(${Math.floor(Math.random() * 150) + 50}, ${Math.floor(Math.random() * 150) + 50}, ${Math.floor(Math.random() * 150) + 50}, 0.7)`;
        }
        
        // Create bubble with dynamic speed based on current difficulty
        const bubble = new Bubble(x, y, radius, color, specialType);
        bubble.speedY = Math.random() * (currentMaxSpeed - currentMinSpeed) + currentMinSpeed;
        bubbles.push(bubble);
    }

    // Clear all bubbles matching a symbol type
    function clearMatchingBubbles(symbolName) {
        let clearedCount = 0;
        bubbles.forEach(bubble => {
            if (bubble.specialType && bubble.specialType.name === symbolName && !bubble.popped) {
                bubble.pop();
                clearedCount++;
                specialPopCount++;
            }
        });
        
        if (clearedCount > 0) {
            console.log(`Cleared ${clearedCount} ${symbolName} bubbles!`);
            updateDifficulty(); // Update difficulty after special pops
        }
        
        return clearedCount;
    }

    // Background Effect Management
    function triggerBackgroundEffect(symbolName) {
        console.log('Triggering background effect for:', symbolName);
        backgroundEffect = {
            symbol: symbolName,
            startTime: Date.now(),
            duration: 1500,
            maxSize: Math.min(canvas.width, canvas.height) * 0.6,
            color: getSymbolColor(symbolName)
        };
    }

    function getSymbolColor(symbolName) {
        switch (symbolName.toLowerCase()) {
            case 'x': return 'rgba(255, 100, 100, 0.3)';
            case 'circle':
            case 'o': return 'rgba(100, 255, 100, 0.3)';
            case 'triangle': return 'rgba(100, 100, 255, 0.3)';
            default: return 'rgba(255, 255, 255, 0.3)';
        }
    }

    function drawBackgroundEffect(ctx) {
        if (!backgroundEffect) return;

        const elapsed = Date.now() - backgroundEffect.startTime;
        const progress = elapsed / backgroundEffect.duration;

        if (progress >= 1) {
            backgroundEffect = null;
            return;
        }

        const fadeProgress = progress < 0.3 ? progress / 0.3 : 1 - ((progress - 0.3) / 0.7);
        const alpha = Math.max(0, fadeProgress);
        const size = backgroundEffect.maxSize * (0.5 + 0.5 * fadeProgress);

        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = backgroundEffect.color;
        ctx.fillStyle = backgroundEffect.color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';

        // Draw the symbol
        switch (backgroundEffect.symbol.toLowerCase()) {
            case 'x':
                const halfSize = size / 2;
                ctx.beginPath();
                ctx.moveTo(centerX - halfSize, centerY - halfSize);
                ctx.lineTo(centerX + halfSize, centerY + halfSize);
                ctx.moveTo(centerX + halfSize, centerY - halfSize);
                ctx.lineTo(centerX - halfSize, centerY + halfSize);
                ctx.stroke();
                break;

            case 'circle':
            case 'o':
                ctx.beginPath();
                ctx.arc(centerX, centerY, size / 2, 0, 2 * Math.PI);
                ctx.stroke();
                break;

            case 'triangle':
                const height = size * 0.866;
                ctx.beginPath();
                ctx.moveTo(centerX, centerY - height / 2);
                ctx.lineTo(centerX - size / 2, centerY + height / 2);
                ctx.lineTo(centerX + size / 2, centerY + height / 2);
                ctx.closePath();
                ctx.stroke();
                break;
        }

        ctx.restore();
    }

    // Draw close button (X) in top right corner during game
    function drawCloseButton(ctx) {
        const size = 30;
        const margin = 20;
        const x = canvas.width - size - margin;
        const y = margin;
        
        // Draw background circle
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/2, size/2, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw X
        ctx.beginPath();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        const offset = size * 0.25;
        ctx.moveTo(x + offset, y + offset);
        ctx.lineTo(x + size - offset, y + size - offset);
        ctx.moveTo(x + size - offset, y + offset);
        ctx.lineTo(x + offset, y + size - offset);
        ctx.stroke();
        
        return { x, y, size }; // Return bounds for click detection
    }

    // Check if click is on close button
    function isCloseButtonClicked(clickX, clickY) {
        const size = 30;
        const margin = 20;
        const x = canvas.width - size - margin;
        const y = margin;
        
        return clickX >= x && clickX <= x + size && clickY >= y && clickY <= y + size;
    }

    // Resize the canvas to fill the entire window
    function setCanvasDimensions() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        // Recreate settings manager with new dimensions
        if (settingsManager) {
            settingsManager = new SettingsManager(canvas);
        }
    }
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);

    // Game action handlers
    const onPopAction = (x, y) => {
        if (currentState === GameState.SETTINGS) {
            return; // No bubble popping in settings
        }
        
        if (currentState === GameState.GAME) {
            // Check if clicking close button
            if (isCloseButtonClicked(x, y)) {
                currentState = GameState.PAUSE_CONFIRM;
                return;
            }
            
            // Pop bubbles
            bubbles.forEach(bubble => {
                if (bubble.isClicked(x, y) && !bubble.popped && !bubble.specialType) {
                    console.log('Normal bubble popped!');
                    bubble.pop();
                    popCount++;
                    updateDifficulty(); // Update difficulty after normal pops
                }
            });
        }
    };

    const onSymbolRecognized = (points) => {
        if (currentState !== GameState.GAME) {
            return;
        }

        console.log('Attempting symbol recognition with', points.length, 'points');
        
        try {
            const result = recognizer.Recognize(points);
            console.log('Recognition result:', result.Name, 'Score:', result.Score);
            
            if (result.Score >= recognitionThreshold) {
                console.log(`Recognized symbol: ${result.Name}`);
                const clearedCount = clearMatchingBubbles(result.Name);
                
                if (clearedCount > 0) {
                    triggerBackgroundEffect(result.Name);
                    console.log(`Successfully cleared ${clearedCount} bubbles!`);
                }
            } else {
                console.log('Recognition score too low:', result.Score);
            }
        } catch (error) {
            console.error('Recognition error:', error);
        }
    };

    const onQuitAction = () => {
        console.log('Escape key pressed.');
        if (currentState === GameState.GAME) {
            currentState = GameState.PAUSE_CONFIRM;
        } else if (currentState === GameState.SETTINGS) {
            currentState = GameState.MENU;
        } else if (currentState === GameState.ABOUT) {
            currentState = GameState.MENU;
        } else if (currentState === GameState.PAUSE_CONFIRM) {
            currentState = GameState.GAME;
        }
    };
    
    const onButtonClickAction = (x, y) => {
        if (currentState === GameState.MENU) {
            const buttonClicked = menuButtons.find(button => button.isClicked(x, y));
            if (buttonClicked) {
                if (buttonClicked.text === 'New Game') {
                    resetGame();
                    currentState = GameState.GAME;
                } else if (buttonClicked.text === 'About') {
                    currentState = GameState.ABOUT;
                } else if (buttonClicked.text === 'Settings') {
                    if (!settingsManager) {
                        settingsManager = new SettingsManager(canvas);
                    }
                    currentState = GameState.SETTINGS;
                } else if (buttonClicked.text === 'Quit') {
                    onQuitAction();
                }
                return true;
            }
        } else if (currentState === GameState.ABOUT) {
            const buttonClicked = aboutButtons.find(button => button.isClicked(x, y));
            if (buttonClicked && buttonClicked.text === 'Back to Menu') {
                currentState = GameState.MENU;
                return true;
            }
        } else if (currentState === GameState.PAUSE_CONFIRM) {
            const buttonClicked = pauseButtons.find(button => button.isClicked(x, y));
            if (buttonClicked) {
                if (buttonClicked.text === 'End Game') {
                    currentState = GameState.END_GAME;
                } else if (buttonClicked.text === 'Keep Playing') {
                    currentState = GameState.GAME;
                }
                return true;
            }
        } else if (currentState === GameState.END_GAME) {
            const buttonClicked = endGameButtons.find(button => button.isClicked(x, y));
            if (buttonClicked && buttonClicked.text === 'Back to Menu') {
                currentState = GameState.MENU;
                return true;
            }
        }
        return false;
    };

    // Handle settings input
    const onSettingsInput = (x, y, isDown, isDrag) => {
        if (currentState === GameState.SETTINGS && settingsManager) {
            const result = settingsManager.handleInput(x, y, isDown, isDrag);
            if (result === 'back') {
                currentState = GameState.MENU;
                return true;
            }
            return result;
        }
        return false;
    };

    // Initialize the input handler with our functions
    initializeInput(canvas, onPopAction, onSymbolRecognized, onQuitAction, onButtonClickAction, onSettingsInput);
    
    // --- GAME STATE LOGIC ---
    function setupMenu() {
        menuButtons = [
            new Button(canvas.width / 2 - 100, canvas.height / 2 - 80, 200, 50, 'New Game', '#4169E1', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2 - 20, 200, 50, 'About', '#228B22', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2 + 40, 200, 50, 'Settings', '#666666', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2 + 100, 200, 50, 'Quit', '#DC143C', 'white')
        ];
    }
    
    function setupAbout() {
        aboutButtons = [
            new Button(canvas.width / 2 - 100, canvas.height - 100, 200, 50, 'Back to Menu', '#666666', 'white')
        ];
    }
    
    function setupPauseConfirm() {
        pauseButtons = [
            new Button(canvas.width / 2 - 120, canvas.height / 2 + 20, 100, 50, 'End Game', '#DC143C', 'white'),
            new Button(canvas.width / 2 + 20, canvas.height / 2 + 20, 100, 50, 'Keep Playing', '#228B22', 'white')
        ];
    }
    
    function resetGame() {
        bubbles = [];
        popCount = 0;
        specialPopCount = 0;
        missedCount = 0;
        gameStartTime = Date.now();
        backgroundEffect = null;
        
        // Reset difficulty to base values (or baby mode values)
        const difficulty = calculateDifficultyValues(0);
        currentSpawnRate = difficulty.spawnRate;
        currentMaxBubbles = difficulty.maxBubbles;
        currentMinSpeed = difficulty.minSpeed;
        currentMaxSpeed = difficulty.maxSpeed;
        
        console.log('Game reset with settings:', gameSettings);
    }

    function checkEndGameCondition() {
        // Check if unlimited time is set
        if (gameSettings.gameTimeMinutes === -1) {
            return; // Never end for unlimited mode
        }
        
        const gameTimeMs = gameSettings.gameTimeMinutes * 60 * 1000;
        const timeElapsed = Date.now() - gameStartTime;
        if (timeElapsed >= gameTimeMs) {
            currentState = GameState.END_GAME;
        }
    }
    
    function checkSpawnCondition() {
        const now = Date.now();
        if (now - lastSpawnTime > currentSpawnRate && bubbles.length < currentMaxBubbles) {
            spawnBubble();
            lastSpawnTime = now;
        }
    }

    function drawMenu() {
        // Animated gradient background
        const time = Date.now() * 0.001;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `hsl(${220 + Math.sin(time * 0.5) * 20}, 70%, 15%)`);
        gradient.addColorStop(1, `hsl(${200 + Math.cos(time * 0.3) * 15}, 60%, 8%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title with glow effect
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText('Bubble Pop!', canvas.width / 2, canvas.height / 2 - 180);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '24px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Draw symbols to clear special bubbles', canvas.width / 2, canvas.height / 2 - 130);

        menuButtons.forEach(button => button.draw(ctx));
    }
    
    function drawAbout() {
        // Animated gradient background
        const time = Date.now() * 0.001;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `hsl(${220 + Math.sin(time * 0.5) * 20}, 70%, 15%)`);
        gradient.addColorStop(1, `hsl(${200 + Math.cos(time * 0.3) * 15}, 60%, 8%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText('How to Play', canvas.width / 2, 80);
        ctx.shadowBlur = 0;
        
        // Instructions
        const instructions = [
            'Basic Controls:',
            '• Tap to pop normal bubbles',
            '• Draw symbols to clear special bubbles',
            '',
            'Special Bubbles:',
            '• Gold bubbles with ○ - Draw a circle to clear all',
            '• Silver bubbles with △ - Draw a triangle to clear all', 
            '• Rainbow bubbles with ✕ - Draw an X to clear all',
            '',
            'Game Tips:',
            '• Special bubbles give more points',
            '• Game gets harder as you pop more bubbles',
            '• Try to clear special bubbles quickly for big scores!',
            '',
            'Controls:',
            '• ESC key or ✕ button to pause/quit',
            '• Customize settings for different difficulty levels'
        ];
        
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'left';
        
        const startY = 140;
        const lineHeight = 28;
        const leftMargin = Math.max(50, (canvas.width - 600) / 2);
        
        instructions.forEach((line, index) => {
            if (line === '') return; // Skip empty lines
            
            if (line.endsWith(':')) {
                // Headers
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 20px Inter, Arial, sans-serif';
            } else if (line.startsWith('•')) {
                // Bullet points
                ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.font = '16px Inter, Arial, sans-serif';
            } else {
                // Regular text
                ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.font = '16px Inter, Arial, sans-serif';
            }
            
            ctx.fillText(line, leftMargin, startY + index * lineHeight);
        });
        
        aboutButtons.forEach(button => button.draw(ctx));
    }
    
    function drawSettings() {
        if (settingsManager) {
            settingsManager.draw(ctx);
        }
    }
    
    function drawPauseConfirm() {
        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dialog box
        const dialogWidth = 300;
        const dialogHeight = 150;
        const dialogX = (canvas.width - dialogWidth) / 2;
        const dialogY = (canvas.height - dialogHeight) / 2;
        
        ctx.fillStyle = 'rgba(40, 40, 40, 0.95)';
        ctx.fillRect(dialogX, dialogY, dialogWidth, dialogHeight);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(dialogX, dialogY, dialogWidth, dialogHeight);
        
        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 24px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Pause Game', canvas.width / 2, dialogY + 40);
        
        // Message
        ctx.font = '16px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Do you want to end the current game?', canvas.width / 2, dialogY + 70);
        
        pauseButtons.forEach(button => button.draw(ctx));
    }
    
    function drawGame() {
        // Animated gradient background
        const time = Date.now() * 0.001;
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `hsl(${220 + Math.sin(time * 0.3) * 10}, 70%, 10%)`);
        gradient.addColorStop(1, `hsl(${200 + Math.cos(time * 0.5) * 10}, 60%, 5%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background effect first (behind everything)
        drawBackgroundEffect(ctx);

        // Clean up expired strokes
        cleanupExpiredStrokes();

        // --- BUBBLE LOOP ---
        bubbles = bubbles.filter(bubble => {
            const isAlive = bubble.isAlive();
            if (!isAlive && !bubble.popped) {
                // If a bubble goes off screen without being popped, count it as missed.
                missedCount++;
            }
            return isAlive;
        });
        
        bubbles.forEach(bubble => {
            bubble.update();
            bubble.draw(ctx);
        });

        // --- DRAW STROKES ---
        const strokesToDraw = getVisualStrokes();
        const currentStroke = getCurrentStroke();
        
        // Draw current stroke being drawn
        if (currentStroke.length > 0) {
             ctx.beginPath();
             ctx.strokeStyle = `rgba(255, 255, 255, 0.9)`;
             ctx.lineWidth = 4;
             ctx.lineCap = 'round';
             ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
             ctx.shadowBlur = 5;
             ctx.moveTo(currentStroke[0].X, currentStroke[0].Y);
             for (let i = 1; i < currentStroke.length; i++) {
                 ctx.lineTo(currentStroke[i].X, currentStroke[i].Y);
             }
             ctx.stroke();
             ctx.shadowBlur = 0;
        }
        
        // Draw completed strokes with configurable fading
        const now = Date.now();
        const fadeTimeMs = gameSettings.fadeTimeMs; // Use configurable fade time
        
        strokesToDraw.forEach(stroke => {
            const timeElapsed = now - stroke.startTime;
            const alpha = Math.max(0, 1 - (timeElapsed / fadeTimeMs));
            
            if (alpha > 0) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.7})`;
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                
                if (stroke.isTap) {
                    const point = stroke.points[0];
                    ctx.arc(point.X, point.Y, 8, 0, 2 * Math.PI);
                    ctx.stroke();
                } else {
                    ctx.moveTo(stroke.points[0].X, stroke.points[0].Y);
                    for (let i = 1; i < stroke.points.length; i++) {
                        ctx.lineTo(stroke.points[i].X, stroke.points[i].Y);
                    }
                    ctx.stroke();
                }
            }
        });
        
        // Draw close button
        drawCloseButton(ctx);
        
        // Draw enhanced UI with background
        const gameTimeMs = gameSettings.gameTimeMinutes === -1 ? Infinity : gameSettings.gameTimeMinutes * 60 * 1000;
        const timeLeft = gameTimeMs === Infinity ? Infinity : Math.max(0, gameTimeMs - (Date.now() - gameStartTime));
        const totalPops = popCount + specialPopCount;
        
        // Stats background with rounded corners effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(15, 15, 320, 200);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, 15, 320, 200);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        
        if (timeLeft === Infinity) {
            ctx.fillText('Time: Unlimited', 25, 40);
        } else {
            const secondsLeft = Math.ceil(timeLeft / 1000);
            ctx.fillText(`Time: ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`, 25, 40);
        }
        
        ctx.font = '16px Inter, Arial, sans-serif';
        ctx.fillText(`Normal Bubbles: ${popCount}`, 25, 65);
        ctx.fillText(`Special Bubbles: ${specialPopCount}`, 25, 85);
        ctx.fillText(`Missed: ${missedCount}`, 25, 105);
        ctx.fillText(`Total Pops: ${totalPops}`, 25, 125);
        
        // Show current difficulty stats (unless baby mode)
        if (!gameSettings.babyMode) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.font = '14px Inter, Arial, sans-serif';
            ctx.fillText(`Spawn Rate: ${currentSpawnRate}ms`, 25, 150);
            ctx.fillText(`Speed: ${currentMinSpeed.toFixed(1)}-${currentMaxSpeed.toFixed(1)}`, 25, 170);
            ctx.fillText(`Max Bubbles: ${currentMaxBubbles}`, 150, 170);
        } else {
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.font = '14px Inter, Arial, sans-serif';
            ctx.fillText('Baby Mode: Large bubbles, easy pace', 25, 150);
        }
        
        // Show gesture timing setting
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '12px Inter, Arial, sans-serif';
        ctx.fillText(`Gesture Time: ${gameSettings.gestureTimingSeconds.toFixed(1)}s`, 25, 190);
    }
    
    function drawEndGame() {
        // Elegant end game background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#2d1b69');
        gradient.addColorStop(1, '#11052c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const totalPops = popCount + specialPopCount;
        
        // Game Over title with glow
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 120);
        ctx.shadowBlur = 0;

        // Final stats
        ctx.font = 'bold 36px Inter, Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Total Bubbles Popped: ${totalPops}`, canvas.width / 2, canvas.height / 2 - 60);

        // Detailed stats
        ctx.fillStyle = 'white';
        ctx.font = '20px Inter, Arial, sans-serif';
        ctx.fillText(`Normal Bubbles: ${popCount}`, canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText(`Special Bubbles: ${specialPopCount}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.fillText(`Bubbles Missed: ${missedCount}`, canvas.width / 2, canvas.height / 2 + 50);

        // Button
        const buttonWidth = 200;
        const buttonHeight = 50;
        endGameButtons = [
            new Button(canvas.width / 2 - buttonWidth / 2, canvas.height / 2 + 100, buttonWidth, buttonHeight, 'Back to Menu', '#4169E1', 'white')
        ];
        endGameButtons.forEach(button => button.draw(ctx));
    }
    
    // The main game loop
    function gameLoop() {
        switch (currentState) {
            case GameState.MENU:
                drawMenu();
                break;
            case GameState.ABOUT:
                drawAbout();
                break;
            case GameState.SETTINGS:
                drawSettings();
                break;
            case GameState.GAME:
                drawGame();
                checkEndGameCondition();
                checkSpawnCondition();
                break;
            case GameState.PAUSE_CONFIRM:
                drawGame(); // Draw game in background
                drawPauseConfirm(); // Draw pause overlay
                break;
            case GameState.END_GAME:
                drawEndGame();
                break;
        }

        requestAnimationFrame(gameLoop);
    }
    
    // Initial setup
    initializeTemplates();
    setupMenu();
    setupAbout();
    setupPauseConfirm();
    gameLoop();
};