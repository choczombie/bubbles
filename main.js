// main.js - The core game loop and initialization.

import { initializeInput, getVisualStrokes, getCurrentStroke } from './inputHandler.js';
import { Bubble, SpecialBubbleTypes } from './bubble.js';
import { Button } from './UI.js';

window.onload = function() {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    
    // Game State Management
    const GameState = {
        MENU: 'menu',
        GAME: 'game',
        END_GAME: 'end_game',
    };
    let currentState = GameState.MENU;

    // Game Variables
    const GAME_DURATION_MS = 2 * 60 * 1000; // 2 minutes in milliseconds
    let gameStartTime = 0;
    let bubbles = [];
    let popCount = 0;
    let specialPopCount = 0;
    let missedCount = 0;
    let spawnRate = 1000; // Initial spawn rate in ms
    let lastSpawnTime = 0;
    const MAX_BUBBLES = 20;
    const SPECIAL_BUBBLE_CHANCE = 0.2; // 20% chance for special bubbles

    // Recognition System
    let recognizer = new PDollarRecognizer();
    let templates = null;
    let recognitionThreshold = 0.25;

    // UI Elements
    let menuButtons = [];
    let endGameButtons = [];
    let pauseButton;

    // Load templates from JSON file
    async function loadTemplates() {
        try {
            const response = await fetch('templates.json');
            const data = await response.json();
            templates = data;
            recognitionThreshold = data.recognitionThreshold || 0.25;
            
            // Add templates to P-dollar recognizer
            data.templates.forEach(template => {
                // Flatten all strokes into a single point array for P-dollar
                const allPoints = [];
                template.strokes.forEach(stroke => {
                    allPoints.push(...stroke);
                });
                recognizer.AddGesture(template.name, allPoints);
            });
            
            console.log('Templates loaded:', data.templates.length);
        } catch (error) {
            console.error('Failed to load templates:', error);
            // Use default templates if file fails to load
            useDefaultTemplates();
        }
    }

    // Fallback default templates
    function useDefaultTemplates() {
        recognizer.AddGesture('circle', [
            new Point(100, 50, 1), new Point(120, 60, 1), new Point(135, 80, 1),
            new Point(140, 100, 1), new Point(135, 120, 1), new Point(120, 140, 1),
            new Point(100, 150, 1), new Point(80, 140, 1), new Point(65, 120, 1),
            new Point(60, 100, 1), new Point(65, 80, 1), new Point(80, 60, 1),
            new Point(100, 50, 1)
        ]);
        recognizer.AddGesture('triangle', [
            new Point(100, 50, 1), new Point(70, 120, 1),
            new Point(130, 120, 1), new Point(100, 50, 1)
        ]);
        recognizer.AddGesture('X', [
            new Point(70, 70, 1), new Point(130, 130, 1),
            new Point(130, 70, 2), new Point(70, 130, 2)
        ]);
    }

    // --- BUBBLE MANAGEMENT ---
    function spawnBubble() {
        const radius = Math.random() * 30 + 20; // Radius between 20 and 50
        const x = Math.random() * (canvas.width - radius * 2) + radius;
        const y = canvas.height + radius;
        
        let specialType = null;
        let color;
        
        // Determine if this should be a special bubble
        if (Math.random() < SPECIAL_BUBBLE_CHANCE) {
            const types = Object.values(SpecialBubbleTypes);
            specialType = types[Math.floor(Math.random() * types.length)];
            color = null; // Color will be determined by special type
        } else {
            color = `rgba(${Math.floor(Math.random() * 150) + 50}, ${Math.floor(Math.random() * 150) + 50}, ${Math.floor(Math.random() * 150) + 50}, 0.7)`;
        }
        
        bubbles.push(new Bubble(x, y, radius, color, specialType));
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
        }
        
        return clearedCount;
    }

    // Resize the canvas to fill the entire window
    function setCanvasDimensions() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);

    // Placeholder functions for game actions.
    const onPopAction = (x, y) => {
        if (currentState !== GameState.GAME) {
            return;
        }

        let bubblePopped = false;
        bubbles.forEach(bubble => {
            if (bubble.isClicked(x, y) && !bubble.popped) {
                console.log('Bubble popped!');
                bubble.pop();
                popCount++;
                if (bubble.specialType) {
                    specialPopCount++;
                }
                bubblePopped = true;
            }
        });
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
                
                // Visual feedback for successful recognition
                if (clearedCount > 0) {
                    // You could add particle effects or screen flash here
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
        console.log('Escape key pressed. Game quitting...');
        if (currentState === GameState.GAME) {
            currentState = GameState.MENU; // Pause or go to menu
        } else if (currentState === GameState.MENU) {
            window.close(); // Only works in some browsers for security reasons
        }
    };
    
    const onButtonClickAction = (x, y) => {
        if (currentState === GameState.MENU) {
            const buttonClicked = menuButtons.find(button => button.isClicked(x, y));
            if (buttonClicked) {
                if (buttonClicked.text === 'New Game') {
                    resetGame();
                    currentState = GameState.GAME;
                } else if (buttonClicked.text === 'Quit') {
                    onQuitAction();
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

    // Initialize the input handler with our placeholder functions.
    initializeInput(canvas, onPopAction, onSymbolRecognized, onQuitAction, onButtonClickAction);
    
    // --- GAME STATE LOGIC ---
    function setupMenu() {
        menuButtons = [
            new Button(canvas.width / 2 - 100, canvas.height / 2 - 60, 200, 50, 'New Game', 'blue', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2, 200, 50, 'Settings', 'gray', 'black'),
            new Button(canvas.width / 2 - 100, canvas.height / 2 + 60, 200, 50, 'Quit', 'red', 'white')
        ];
    }
    
    function resetGame() {
        bubbles = [];
        popCount = 0;
        specialPopCount = 0;
        missedCount = 0;
        gameStartTime = Date.now();
    }

    function checkEndGameCondition() {
        const timeElapsed = Date.now() - gameStartTime;
        if (timeElapsed >= GAME_DURATION_MS) {
            currentState = GameState.END_GAME;
        }
    }
    
    function checkSpawnCondition() {
        const now = Date.now();
        if (now - lastSpawnTime > spawnRate && bubbles.length < MAX_BUBBLES) {
            spawnBubble();
            lastSpawnTime = now;
        }
    }

    function drawMenu() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '50px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Bubble Pop!', canvas.width / 2, canvas.height / 2 - 150);

        menuButtons.forEach(button => button.draw(ctx));
    }
    
    function drawGame() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        
        if (currentStroke.length > 0) {
             ctx.beginPath();
             ctx.strokeStyle = `rgba(255, 255, 255, 1)`;
             ctx.lineWidth = 5;
             ctx.lineCap = 'round';
             ctx.moveTo(currentStroke[0].X, currentStroke[0].Y);
             for (let i = 1; i < currentStroke.length; i++) {
                 ctx.lineTo(currentStroke[i].X, currentStroke[i].Y);
             }
             ctx.stroke();
        }
        
        const now = Date.now();
        const FADE_TIME_MS = 2000;
        const activeStrokes = strokesToDraw.filter(s => (now - s.startTime) < FADE_TIME_MS);
        
        activeStrokes.forEach(stroke => {
            const timeElapsed = now - stroke.startTime;
            const alpha = 1 - (timeElapsed / FADE_TIME_MS);
            
            if (alpha > 0) {
                ctx.beginPath();
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                
                if (stroke.isTap) {
                    const point = stroke.points[0];
                    ctx.arc(point.X, point.Y, 10, 0, 2 * Math.PI);
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
        strokesToDraw.splice(0, strokesToDraw.length, ...activeStrokes);
        
        // Draw timer and stats
        const timeLeft = Math.max(0, GAME_DURATION_MS - (Date.now() - gameStartTime));
        const secondsLeft = Math.ceil(timeLeft / 1000);
        
        ctx.fillStyle = 'white';
        ctx.font = '24px Inter';
        ctx.textAlign = 'left';
        ctx.fillText(`Time Left: ${secondsLeft}s`, 20, 40);
        ctx.fillText(`Popped: ${popCount}`, 20, 70);
        ctx.fillText(`Special: ${specialPopCount}`, 20, 100);
        ctx.fillText(`Missed: ${missedCount}`, 20, 130);
    }
    
    function drawEndGame() {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = 'white';
        ctx.font = '50px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 100);

        ctx.font = '24px Inter';
        ctx.fillText(`Bubbles Popped: ${popCount}`, canvas.width / 2, canvas.height / 2 - 20);
        ctx.fillText(`Special Bubbles Popped: ${specialPopCount}`, canvas.width / 2, canvas.height / 2 + 10);
        ctx.fillText(`Bubbles Missed: ${missedCount}`, canvas.width / 2, canvas.height / 2 + 40);

        const buttonWidth = 200;
        const buttonHeight = 50;
        endGameButtons = [
            new Button(canvas.width / 2 - buttonWidth / 2, canvas.height / 2 + 100, buttonWidth, buttonHeight, 'Back to Menu', 'blue', 'white')
        ];
        endGameButtons.forEach(button => button.draw(ctx));
    }
    
    // The main game loop.
    function gameLoop() {
        switch (currentState) {
            case GameState.MENU:
                drawMenu();
                break;
            case GameState.GAME:
                drawGame();
                checkEndGameCondition();
                checkSpawnCondition();
                break;
            case GameState.END_GAME:
                drawEndGame();
                break;
        }

        requestAnimationFrame(gameLoop);
    }
    
    // Initial setup
    setupMenu();
    loadTemplates().then(() => {
        console.log('Game initialized with templates');
        gameLoop();
    });
};