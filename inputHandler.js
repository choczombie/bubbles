// This file handles all user input for the game, including mouse, touch, and keyboard events.

// A simple Point class, as required by the P-dollar recognizer.
function Point(x, y, id) {
    this.X = x;
    this.Y = y;
    this.ID = id; // Stroke ID to which this point belongs
}

// Global variables for managing input state.
let isDrawing = false; // Flag to check if a drawing gesture is in progress.
let currentStroke = []; // Array to store points for the current stroke.
let visualStrokes = []; // Array to store all strokes to be drawn on the canvas.
let previousStroke = null; // Store the previous stroke for multi-stroke recognition
let previousStrokeEndTime = 0; // When the previous stroke ended
let currentStrokeStartTime = 0; // When the current stroke started

// We will define these constants here for clarity.
const FADE_TIME_MS = 2000; // Time in milliseconds for a stroke to fade away (2 seconds).
const MULTI_STROKE_GRACE_PERIOD_MS = 2000; // Time to wait for a potential second stroke.
const MIN_DRAG_DISTANCE = 5; // Minimum distance a pointer must move to be considered a drag, not a tap.

/**
 * Initializes the input handler by setting up all necessary event listeners.
 * @param {HTMLCanvasElement} canvas The game canvas element.
 * @param {Function} onPopAction Callback function to execute on a tap (bubble pop).
 * @param {Function} onSymbolRecognized Callback function to execute when a symbol is recognized.
 * @param {Function} onQuitAction Callback function to execute when the game should quit.
 * @param {Function} onButtonClickAction Callback function for UI button clicks.
 */
export function initializeInput(canvas, onPopAction, onSymbolRecognized, onQuitAction, onButtonClickAction) {
    // Helper function to unify mouse and touch events.
    const handlePointerDown = (event) => {
        event.preventDefault();
        console.log("Pointer down event.");
        
        const x = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX;
        const y = event.type === 'touchstart' ? event.touches[0].clientY : event.clientY;

        // Check for button clicks first
        if (onButtonClickAction && onButtonClickAction(x, y)) {
            return; // A button was clicked, so don't start a drawing or tap gesture
        }
        
        // Record when this stroke started
        currentStrokeStartTime = Date.now();
        
        // Start recording points for the new stroke
        currentStroke = [new Point(x, y, 1)];
        isDrawing = true;
    };

    const handlePointerMove = (event) => {
        if (!isDrawing) return;

        event.preventDefault();

        const x = event.type === 'touchmove' ? event.touches[0].clientX : event.clientX;
        const y = event.type === 'touchmove' ? event.touches[0].clientY : event.clientY;

        const lastPoint = currentStroke[currentStroke.length - 1];
        const distance = Math.sqrt(Math.pow(x - lastPoint.X, 2) + Math.pow(y - lastPoint.Y, 2));

        if (distance > MIN_DRAG_DISTANCE) {
            currentStroke.push(new Point(x, y, 1));
        }
    };

    const handlePointerUp = (event) => {
        if (!isDrawing) return;
        isDrawing = false;
        
        const firstPoint = currentStroke[0];
        const lastPoint = currentStroke[currentStroke.length - 1];
        const distance = Math.sqrt(Math.pow(lastPoint.X - firstPoint.X, 2) + Math.pow(lastPoint.Y - firstPoint.Y, 2));

        if (currentStroke.length > 1 && distance > MIN_DRAG_DISTANCE) {
            console.log("Stroke completed. Processing recognition logic.");
            
            // Add current stroke to visual strokes for rendering
            visualStrokes.push({ points: currentStroke, startTime: Date.now() });
            
            // Step 1: Check if we have a previous stroke within the grace period
            const timeSinceCurrentStart = currentStrokeStartTime;
            const hasValidPreviousStroke = previousStroke && 
                (timeSinceCurrentStart - previousStrokeEndTime) <= MULTI_STROKE_GRACE_PERIOD_MS;
            
            if (hasValidPreviousStroke) {
                console.log("Attempting multi-stroke recognition (previous + current).");
                // Combine previous stroke and current stroke for recognition
                const combinedStrokes = [...previousStroke, ...currentStroke];
                
                // Try recognition on combined strokes
                onSymbolRecognized(combinedStrokes);
                
                // Always clear stroke data after attempting multi-stroke recognition
                // The recognition function handles success/failure internally
                console.log("Multi-stroke recognition attempted. Clearing stroke data.");
                previousStroke = null;
                previousStrokeEndTime = 0;
                currentStroke = [];
            } else {
                // Step 2: No previous stroke exists OR outside grace period
                console.log("Attempting single-stroke recognition (current only).");
                // Try recognition on current stroke alone
                onSymbolRecognized(currentStroke);
                
                // Step 3: Current stroke becomes the "previous stroke" for potential multi-stroke
                console.log("Storing current stroke as previous for potential multi-stroke.");
                previousStroke = [...currentStroke]; // Make a copy
                previousStrokeEndTime = Date.now();
                currentStroke = [];
                
                // Note: The 2-second timer is implicit - we check the time difference
                // when the next stroke starts, so no explicit timer needed
            }

        } else {
            console.log("Tap detected.");
            // This is a tap - only pop normal bubbles, NOT special bubbles
            const x = event.type === 'touchend' ? lastPoint.X : event.clientX;
            const y = event.type === 'touchend' ? lastPoint.Y : event.clientY;
            onPopAction(x, y); // onPopAction now handles the special bubble filtering

            // Add a temporary "touch" object for visual feedback.
            visualStrokes.push({
                points: [{X: x, Y: y, ID: 0}], // A single point for a touch.
                startTime: Date.now(),
                isTap: true // A flag to distinguish it from a stroke.
            });
            
            // Clear any previous stroke data since this was just a tap
            previousStroke = null;
            previousStrokeEndTime = 0;
        }
        
        currentStroke = []; // Clear the current stroke for the next input.
    };

    // Set up mouse event listeners.
    canvas.addEventListener('mousedown', handlePointerDown);
    canvas.addEventListener('mousemove', handlePointerMove);
    canvas.addEventListener('mouseup', handlePointerUp);

    // Set up touch event listeners.
    canvas.addEventListener('touchstart', handlePointerDown);
    canvas.addEventListener('touchmove', handlePointerMove);
    canvas.addEventListener('touchend', handlePointerUp);
    
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
 * @returns {Array} An array of stroke objects.
 */
export function getVisualStrokes() {
    return visualStrokes;
}

/**
 * Returns the currently active stroke for live drawing.
 * @returns {Array} An array of Point objects for the current stroke.
 */
export function getCurrentStroke() {
    return currentStroke;
}

/**
 * Cleans up expired visual strokes (older than FADE_TIME_MS).
 * Should be called regularly by the main game loop.
 */
export function cleanupExpiredStrokes() {
    const now = Date.now();
    visualStrokes = visualStrokes.filter(stroke => 
        (now - stroke.startTime) <= FADE_TIME_MS
    );
}