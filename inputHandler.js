// inputHandler.js - Enhanced input handling with configurable timing parameters
// Version: 2.1.0

import { gameSettings } from './settings.js';

// A simple Point class, as required by the P-dollar recognizer.
function Point(x, y, id) {
    this.X = x;
    this.Y = y;
    this.ID = id; // Stroke ID to which this point belongs
}

// Global variables for managing input state.
let isDrawing = false;
let currentStroke = [];
let visualStrokes = [];
let previousStroke = null;
let previousStrokeEndTime = 0;
let currentStrokeStartTime = 0;

// Input state for settings interactions
let isDraggingSlider = false;

// Constants
const MIN_DRAG_DISTANCE = 5;

/**
 * Gets the current fade time from settings
 */
function getFadeTimeMs() {
    return gameSettings.fadeTimeMs;
}

/**
 * Gets the current multi-stroke grace period from settings
 */
function getMultiStrokeGracePeriodMs() {
    return gameSettings.multiStrokeGracePeriodMs;
}

/**
 * Converts screen coordinates to canvas coordinates, accounting for scaling and positioning
 */
function getCanvasCoordinates(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if (event.type.startsWith('touch')) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

/**
 * Initializes the input handler with enhanced settings support
 */
export function initializeInput(canvas, onPopAction, onSymbolRecognized, onQuitAction, onButtonClickAction, onSettingsInput = null) {
    // Helper function to unify mouse and touch events.
    const handlePointerDown = (event) => {
        event.preventDefault();
        console.log("Pointer down event.");
        
        const coords = getCanvasCoordinates(canvas, event);
        const x = coords.x;
        const y = coords.y;

        // Priority 1: Settings input (if in settings mode)
        if (onSettingsInput && onSettingsInput(x, y, true, false)) {
            isDraggingSlider = true;
            return;
        }

        // Priority 2: Button clicks
        if (onButtonClickAction && onButtonClickAction(x, y)) {
            return;
        }
        
        // Priority 3: Game interactions (drawing/tapping)
        currentStrokeStartTime = Date.now();
        currentStroke = [new Point(x, y, 1)];
        isDrawing = true;
    };

    const handlePointerMove = (event) => {
        event.preventDefault();
        
        const coords = getCanvasCoordinates(canvas, event);
        const x = coords.x;
        const y = coords.y;

        // Handle settings dragging
        if (isDraggingSlider && onSettingsInput) {
            onSettingsInput(x, y, false, true);
            return;
        }

        // Handle drawing
        if (!isDrawing) return;

        const lastPoint = currentStroke[currentStroke.length - 1];
        const distance = Math.sqrt(Math.pow(x - lastPoint.X, 2) + Math.pow(y - lastPoint.Y, 2));

        if (distance > MIN_DRAG_DISTANCE) {
            currentStroke.push(new Point(x, y, 1));
        }
    };

    const handlePointerUp = (event) => {
        // Handle settings interactions
        if (isDraggingSlider) {
            if (onSettingsInput) {
                const coords = getCanvasCoordinates(canvas, event);
                onSettingsInput(coords.x, coords.y, false, false);
            }
            isDraggingSlider = false;
            return;
        }

        if (!isDrawing) return;
        isDrawing = false;
        
        const firstPoint = currentStroke[0];
        const lastPoint = currentStroke[currentStroke.length - 1];
        const distance = Math.sqrt(Math.pow(lastPoint.X - firstPoint.X, 2) + Math.pow(lastPoint.Y - firstPoint.Y, 2));

        if (currentStroke.length > 1 && distance > MIN_DRAG_DISTANCE) {
            console.log("Stroke completed. Processing recognition logic.");
            
            // Add current stroke to visual strokes for rendering
            visualStrokes.push({ points: currentStroke, startTime: Date.now() });
            
            // Multi-stroke recognition logic using configurable grace period
            const timeSinceCurrentStart = currentStrokeStartTime;
            const hasValidPreviousStroke = previousStroke && 
                (timeSinceCurrentStart - previousStrokeEndTime) <= getMultiStrokeGracePeriodMs();
            
            if (hasValidPreviousStroke) {
                console.log(`Attempting multi-stroke recognition (previous + current) with grace period: ${getMultiStrokeGracePeriodMs()}ms`);
                const combinedStrokes = [...previousStroke, ...currentStroke];
                onSymbolRecognized(combinedStrokes);
                
                console.log("Multi-stroke recognition attempted. Clearing stroke data.");
                previousStroke = null;
                previousStrokeEndTime = 0;
                currentStroke = [];
            } else {
                console.log("Attempting single-stroke recognition (current only).");
                onSymbolRecognized(currentStroke);
                
                console.log("Storing current stroke as previous for potential multi-stroke.");
                previousStroke = [...currentStroke];
                previousStrokeEndTime = Date.now();
                currentStroke = [];
            }

        } else {
            console.log("Tap detected.");
            const coords = getCanvasCoordinates(canvas, event);
            const x = coords.x;
            const y = coords.y;
            onPopAction(x, y);

            // Add visual feedback for tap
            visualStrokes.push({
                points: [{X: x, Y: y, ID: 0}],
                startTime: Date.now(),
                isTap: true
            });
            
            // Clear any previous stroke data since this was just a tap
            previousStroke = null;
            previousStrokeEndTime = 0;
        }
        
        currentStroke = [];
    };

    // Set up mouse event listeners.
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);

    // Set up touch event listeners.
    canvas.addEventListener('touchstart', handlePointerDown, { passive: false });
    canvas.addEventListener('touchmove', handlePointerMove, { passive: false });
    canvas.addEventListener('touchend', handlePointerUp, { passive: false });
    
    // Set up keyboard event listener for the Escape key.
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            console.log('Escape key pressed.');
            onQuitAction();
        }
    });
}

/**
 * Returns the array of visual strokes to be rendered by the main game loop.
 */
export function getVisualStrokes() {
    return visualStrokes;
}

/**
 * Returns the currently active stroke for live drawing.
 */
export function getCurrentStroke() {
    return currentStroke;
}

/**
 * Cleans up expired visual strokes using configurable fade time.
 */
export function cleanupExpiredStrokes() {
    const now = Date.now();
    const fadeTimeMs = getFadeTimeMs();
    visualStrokes = visualStrokes.filter(stroke => 
        (now - stroke.startTime) <= fadeTimeMs
    );
    console.log(`Cleaning up strokes with fade time: ${fadeTimeMs}ms, remaining strokes: ${visualStrokes.length}`);
}