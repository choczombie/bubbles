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
let strokeTimeout = null; // Timeout for clearing previous stroke

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

        // Clear any pending timeouts
        if (strokeTimeout) {
            clearTimeout(strokeTimeout);
            strokeTimeout = null;
        }
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
            console.log("Stroke completed. Adding to visual queue.");
            // This is a drawing gesture. Add the completed stroke to the visual strokes array.
            visualStrokes.push({ points: currentStroke, startTime: Date.now() });
            lastStrokeTime = Date.now();
            
            // Limit the queue to the maximum number of strokes allowed for recognition.
            if (visualStrokes.length > MAX_STROKES) {
                visualStrokes.shift();
            }

            // Set a timeout to trigger recognition after the multi-stroke grace period.
            strokeTimeout = setTimeout(() => {
                console.log('Multi-stroke grace period ended. Attempting recognition.');
                onSymbolRecognized(visualStrokes.flatMap(s => s.points));
                // Clear the visual strokes array after recognition.
                visualStrokes = [];
            }, MULTI_STROKE_GRACE_PERIOD_MS);

        } else {
            console.log("Tap detected.");
            // This is a tap.
            const x = event.type === 'touchend' ? lastPoint.X : event.clientX;
            const y = event.type === 'touchend' ? lastPoint.Y : event.clientY;
            onPopAction(x, y);

            // Add a temporary "touch" object for visual feedback.
            visualStrokes.push({
                points: [{X: x, Y: y, ID: 0}], // A single point for a touch.
                startTime: Date.now(),
                isTap: true // A flag to distinguish it from a stroke.
            });
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

		