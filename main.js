// main.js - The core game loop and initialization.

import { initializeInput, getVisualStrokes, getCurrentStroke, cleanupExpiredStrokes } from './inputHandler.js';
import { Bubble, SpecialBubbleTypes } from './bubble.js';
import { Button } from './ui.js';

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
    const SPECIAL_BUBBLE_CHANCE = 0.3; // 30% chance for special bubbles

    // Recognition System
    let recognizer = new PDollarRecognizer();
    let recognitionThreshold = 0.25; // Moved from templates.json
    let templatesLoaded = false;

    // UI Elements
    let menuButtons = [];
    let endGameButtons = [];

    // Background Effect System
    let backgroundEffect = null;

    // Load templates from JSON file
    async function loadTemplates() {
        try {
            const response = await fetch('templates.json');
            const data = await response.json();
            
            console.log('Loading templates from JSON...');
            
            // Extract templates array from the wrapper object
            const templatesData = data.templates;
            if (!templatesData || !Array.isArray(templatesData)) {
                throw new Error('Invalid templates format - expected object with templates array');
            }
            
            console.log('Found', templatesData.length, 'templates');
            
            // Clear any existing templates (except the defaults)
            recognizer.DeleteUserGestures();
            
            // Convert and add each template
            templatesData.forEach(template => {
                const points = convertTemplateToPoints(template);
                recognizer.AddGesture(template.name, points);
                console.log(`Added template: ${template.name} with ${points.length} points`);
            });
            
            templatesLoaded = true;
            console.log('All templates loaded successfully');
        } catch (error) {
            console.error('Error loading templates:', error);
            // Fall back to basic templates if loading fails
            initializeFallbackTemplates();
        }
    }

    // Convert template format from JSON to P-Dollar Point format
    function convertTemplateToPoints(template) {
        const points = [];
        
        if (template.strokes && Array.isArray(template.strokes)) {
            // Multi-stroke template format
            template.strokes.forEach((stroke, strokeIndex) => {
                stroke.forEach(point => {
                    points.push(new Point(point.X, point.Y, strokeIndex + 1));
                });
            });
        } else if (template.points && Array.isArray(template.points)) {
            // Single array of points format
            template.points.forEach(point => {
                points.push(new Point(point.X, point.Y, point.ID || 1));
            });
        } else {
            console.warn('Unknown template format for:', template.name);
        }
        
        return points;
    }

    // Fallback templates if JSON loading fails
    function initializeFallbackTemplates() {
        console.log('Initializing fallback templates...');
        
        // Circle template
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

        templatesLoaded = true;
        console.log('Fallback templates initialized');
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

    // Background Effect Management
    function triggerBackgroundEffect(symbolName) {
        console.log('Triggering background effect for:', symbolName);
        backgroundEffect = {
            symbol: symbolName,
            startTime: Date.now(),
            duration: 1500, // 1.5 seconds
            maxSize: Math.min(canvas.width, canvas.height) * 0.6, // 60% of screen
            color: getSymbolColor(symbolName)
        };
    }

    function getSymbolColor(symbolName) {
        switch (symbolName.toLowerCase()) {
            case 'x': return 'rgba(255, 100, 100, 0.3)'; // Red
            case 'circle':
            case 'o': return 'rgba(100, 255, 100, 0.3)'; // Green  
            case 'triangle': return 'rgba(100, 100, 255, 0.3)'; // Blue
            default: return 'rgba(255, 255, 255, 0.3)'; // White fallback
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

        // Fade in then out animation
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
                const height = size * 0.866; // equilateral triangle height
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

    // Resize the canvas to fill the entire window
    function setCanvasDimensions() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    setCanvasDimensions();
    window.addEventListener('resize', setCanvasDimensions);

    // Game action handlers
    const onPopAction = (x, y) => {
        if (currentState !== GameState.GAME) {
            return;
        }

        bubbles.forEach(bubble => {
            if (bubble.isClicked(x, y) && !bubble.popped && !bubble.specialType) {
                // Only pop normal bubbles on tap - special bubbles require symbol drawing
                console.log('Normal bubble popped!');
                bubble.pop();
                popCount++;
            }
        });
    };

    const onSymbolRecognized = (points) => {
        if (currentState !== GameState.GAME || !templatesLoaded) {
            return;
        }

        console.log('Attempting symbol recognition with', points.length, 'points');
        
        try {
            // Convert input points to P-Dollar Point format
            const pDollarPoints = points.map(point => new Point(point.X, point.Y, point.ID || 1));
            
            const result = recognizer.Recognize(pDollarPoints);
            console.log('Recognition result:', result.Name, 'Score:', result.Score);
            
            if (result.Score >= recognitionThreshold) {
                console.log(`Recognized symbol: ${result.Name}`);
                const clearedCount = clearMatchingBubbles(result.Name);
                
                // Visual feedback for successful recognition
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
        console.log('Escape key pressed. Game quitting...');
        if (currentState === GameState.GAME) {
            currentState = GameState.MENU; // Go to menu
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

    // Initialize the input handler with our functions
    initializeInput(canvas, onPopAction, onSymbolRecognized, onQuitAction, onButtonClickAction);
    
    // --- GAME STATE LOGIC ---
    function setupMenu() {
        menuButtons = [
            new Button(canvas.width / 2 - 100, canvas.height / 2 - 60, 200, 50, 'New Game', '#4169E1', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2, 200, 50, 'Settings', '#666666', 'white'),
            new Button(canvas.width / 2 - 100, canvas.height / 2 + 60, 200, 50, 'Quit', '#DC143C', 'white')
        ];
    }
    
    function resetGame() {
        bubbles = [];
        popCount = 0;
        specialPopCount = 0;
        missedCount = 0;
        gameStartTime = Date.now();
        backgroundEffect = null; // Clear any active effects
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
        ctx.fillText('Bubble Pop!', canvas.width / 2, canvas.height / 2 - 150);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '24px Inter, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillText('Draw symbols to clear special bubbles', canvas.width / 2, canvas.height / 2 - 100);

        // Template loading status
        if (!templatesLoaded) {
            ctx.font = '16px Inter, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
            ctx.fillText('Loading gesture templates...', canvas.width / 2, canvas.height / 2 - 75);
        }

        menuButtons.forEach(button => button.draw(ctx));
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
        
        // Draw completed strokes with fading
        const now = Date.now();
        const FADE_TIME_MS = 2000;
        
        strokesToDraw.forEach(stroke => {
            const timeElapsed = now - stroke.startTime;
            const alpha = Math.max(0, 1 - (timeElapsed / FADE_TIME_MS));
            
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
        
        // Draw enhanced UI with background
        const timeLeft = Math.max(0, GAME_DURATION_MS - (Date.now() - gameStartTime));
        const secondsLeft = Math.ceil(timeLeft / 1000);
        const totalScore = popCount + specialPopCount * 3;
        
        // Stats background with rounded corners effect
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(15, 15, 220, 150);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(15, 15, 220, 150);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 18px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Time: ${Math.floor(secondsLeft / 60)}:${(secondsLeft % 60).toString().padStart(2, '0')}`, 25, 40);
        
        ctx.font = '16px Inter, Arial, sans-serif';
        ctx.fillText(`Normal Bubbles: ${popCount}`, 25, 65);
        ctx.fillText(`Special Bubbles: ${specialPopCount}`, 25, 85);
        ctx.fillText(`Missed: ${missedCount}`, 25, 105);
        
        ctx.font = 'bold 18px Inter, Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Score: ${totalScore}`, 25, 135);
    }
    
    function drawEndGame() {
        // Elegant end game background
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#2d1b69');
        gradient.addColorStop(1, '#11052c');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const totalScore = popCount + specialPopCount * 3;
        
        // Game Over title with glow
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText('Game Over!', canvas.width / 2, canvas.height / 2 - 120);
        ctx.shadowBlur = 0;

        // Final score highlight
        ctx.font = 'bold 36px Inter, Arial, sans-serif';
        ctx.fillStyle = '#FFD700';
        ctx.fillText(`Final Score: ${totalScore}`, canvas.width / 2, canvas.height / 2 - 60);

        // Stats
        ctx.fillStyle = 'white';
        ctx.font = '20px Inter, Arial, sans-serif';
        ctx.fillText(`Normal Bubbles: ${popCount}`, canvas.width / 2, canvas.height / 2 - 10);
        ctx.fillText(`Special Bubbles: ${specialPopCount} (×3 points)`, canvas.width / 2, canvas.height / 2 + 20);
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
    loadTemplates(); // Load templates from JSON file
    setupMenu();
    gameLoop();
};