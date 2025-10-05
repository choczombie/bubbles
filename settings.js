// settings.js - Game settings management system
// Version: 2.2.0

/**
 * Game settings with default values
 */
export const gameSettings = {
    // Difficulty progression settings
    difficultyMultiplier: 1.0,        // 0.5x to 2.0x progression speed
    specialBubbleFrequency: 0.3,      // 0.0 to 1.0 (0% to 100%)
    
    // Baby mode setting
    babyMode: false,                  // Baby mode with oversized bubbles
    
    // Time settings
    gameTimeMinutes: 2,               // Game duration in minutes
    
    // Multi-stroke timing settings
    gestureTimingSeconds: 2.0,        // 1.0 to 5.0 seconds for gesture completion and stroke fade
    
    // Derived difficulty values (calculated from difficultyMultiplier)
    get spawnRateReduction() {
        return 14 * this.difficultyMultiplier; // Per pop reduction in spawn rate
    },
    get speedIncrease() {
        return 0.008 * this.difficultyMultiplier; // Per pop speed increase
    },
    get maxBubbleIncrease() {
        return 0.2 * this.difficultyMultiplier; // Per pop max bubble increase
    },
    
    // Derived timing values (calculated from gestureTimingSeconds)
    get fadeTimeMs() {
        return this.gestureTimingSeconds * 1000; // Convert to milliseconds
    },
    get multiStrokeGracePeriodMs() {
        return this.gestureTimingSeconds * 1000; // Same as fade time
    }
};

/**
 * Time preset configurations
 */
export const timePresets = [
    { label: "1 min", value: 1 },
    { label: "2 min", value: 2 },
    { label: "3 min", value: 3 },
    { label: "4 min", value: 4 },
    { label: "5 min", value: 5 },
    { label: "10 min", value: 10 },
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "60 min", value: 60 },
    { label: "Unlimited", value: -1 }
];

/**
 * Calculates progressive difficulty values based on total pops
 * In baby mode, returns consistent easy values
 */
export function calculateDifficultyValues(totalPops) {
    if (gameSettings.babyMode) {
        // Baby mode: consistent, easy settings
        return {
            spawnRate: 1500,      // Slower spawn rate
            minSpeed: 0.15,       // Slower minimum speed
            maxSpeed: 0.4,        // Slower maximum speed
            maxBubbles: 15,       // Fewer bubbles on screen
            totalPops
        };
    }
    
    // Normal progressive difficulty
    // Spawn rate progression: 1000ms → 300ms plateau
    const spawnRateReduction = Math.min(700, totalPops * gameSettings.spawnRateReduction);
    const spawnRate = Math.max(300, 1000 - spawnRateReduction);
    
    // Speed progression: 0.2-0.7 → 0.4-1.1 plateau
    const speedIncrease = Math.min(0.4, totalPops * gameSettings.speedIncrease);
    const minSpeed = Math.min(0.4, 0.2 + speedIncrease);
    const maxSpeed = Math.min(1.1, 0.7 + speedIncrease);
    
    // Max bubbles progression: 20 → 30 plateau
    const bubbleIncrease = Math.min(10, totalPops * gameSettings.maxBubbleIncrease);
    const maxBubbles = Math.min(30, 20 + bubbleIncrease);
    
    return {
        spawnRate,
        minSpeed,
        maxSpeed,
        maxBubbles,
        totalPops
    };
}

/**
 * Toggle button component for boolean settings
 */
export class ToggleButton {
    constructor(x, y, width, height, value, label) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.value = value;
        this.label = label;
    }
    
    draw(ctx) {
        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.label, this.x, this.y - 10);
        
        // Draw toggle background
        ctx.fillStyle = this.value ? '#4169E1' : 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw toggle knob
        const knobSize = this.height - 4;
        const knobX = this.value ? this.x + this.width - knobSize - 2 : this.x + 2;
        ctx.fillStyle = 'white';
        ctx.fillRect(knobX, this.y + 2, knobSize, knobSize);
        
        // Draw state text
        ctx.fillStyle = 'white';
        ctx.font = '14px Inter, Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(this.value ? 'ON' : 'OFF', this.x + this.width + 50, this.y + this.height / 2 + 5);
    }
    
    handleInput(x, y) {
        if (x >= this.x && x <= this.x + this.width && 
            y >= this.y && y <= this.y + this.height) {
            this.value = !this.value;
            return true;
        }
        return false;
    }
}

/**
 * Slider component for settings
 */
export class Slider {
    constructor(x, y, width, height, min, max, value, label, formatValue = null) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.min = min;
        this.max = max;
        this.value = value;
        this.label = label;
        this.formatValue = formatValue || ((v) => v.toFixed(1));
        this.isDragging = false;
        this.knobRadius = height / 2;
    }
    
    draw(ctx) {
        const knobX = this.x + ((this.value - this.min) / (this.max - this.min)) * this.width;
        
        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.label, this.x, this.y - 10);
        
        // Draw value
        ctx.textAlign = 'right';
        ctx.fillText(this.formatValue(this.value), this.x + this.width, this.y - 10);
        
        // Draw track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw progress
        const progressWidth = ((this.value - this.min) / (this.max - this.min)) * this.width;
        ctx.fillStyle = '#4169E1';
        ctx.fillRect(this.x, this.y, progressWidth, this.height);
        
        // Draw knob
        ctx.beginPath();
        ctx.arc(knobX, this.y + this.height / 2, this.knobRadius, 0, 2 * Math.PI);
        ctx.fillStyle = this.isDragging ? '#FFD700' : 'white';
        ctx.fill();
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    handleInput(x, y, isDown) {
        const knobX = this.x + ((this.value - this.min) / (this.max - this.min)) * this.width;
        const knobY = this.y + this.height / 2;
        const dist = Math.sqrt((x - knobX) ** 2 + (y - knobY) ** 2);
        
        if (isDown && dist <= this.knobRadius * 1.5) {
            this.isDragging = true;
            return true;
        } else if (isDown && x >= this.x && x <= this.x + this.width && 
                   y >= this.y && y <= this.y + this.height) {
            // Click anywhere on track
            const ratio = Math.max(0, Math.min(1, (x - this.x) / this.width));
            this.value = this.min + ratio * (this.max - this.min);
            this.isDragging = true;
            return true;
        }
        
        return false;
    }
    
    handleDrag(x, y) {
        if (this.isDragging) {
            const ratio = Math.max(0, Math.min(1, (x - this.x) / this.width));
            this.value = this.min + ratio * (this.max - this.min);
            return true;
        }
        return false;
    }
    
    stopDragging() {
        this.isDragging = false;
    }
}

/**
 * Discrete slider for time presets
 */
export class DiscreteSlider extends Slider {
    constructor(x, y, width, height, presets, currentIndex, label) {
        super(x, y, width, height, 0, presets.length - 1, currentIndex, label);
        this.presets = presets;
        this.currentIndex = currentIndex;
    }
    
    get selectedPreset() {
        return this.presets[Math.round(this.value)];
    }
    
    draw(ctx) {
        this.currentIndex = Math.round(this.value);
        
        const knobX = this.x + (this.currentIndex / (this.presets.length - 1)) * this.width;
        
        // Draw label
        ctx.fillStyle = 'white';
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.label, this.x, this.y - 10);
        
        // Draw current selection
        ctx.textAlign = 'right';
        ctx.fillText(this.selectedPreset.label, this.x + this.width, this.y - 10);
        
        // Draw track
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw preset markers
        for (let i = 0; i < this.presets.length; i++) {
            const markerX = this.x + (i / (this.presets.length - 1)) * this.width;
            ctx.beginPath();
            ctx.arc(markerX, this.y + this.height / 2, 3, 0, 2 * Math.PI);
            ctx.fillStyle = i <= this.currentIndex ? '#4169E1' : 'rgba(255, 255, 255, 0.5)';
            ctx.fill();
        }
        
        // Draw knob
        ctx.beginPath();
        ctx.arc(knobX, this.y + this.height / 2, this.knobRadius, 0, 2 * Math.PI);
        ctx.fillStyle = this.isDragging ? '#FFD700' : 'white';
        ctx.fill();
        ctx.strokeStyle = '#4169E1';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    handleDrag(x, y) {
        if (this.isDragging) {
            const ratio = Math.max(0, Math.min(1, (x - this.x) / this.width));
            const rawIndex = ratio * (this.presets.length - 1);
            this.value = Math.round(rawIndex); // Snap to discrete values
            return true;
        }
        return false;
    }
}

/**
 * Settings manager class
 */
export class SettingsManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.controls = [];
        this.setupControls();
    }
    
    setupControls() {
        const centerX = this.canvas.width / 2;
        const sliderWidth = Math.min(400, this.canvas.width * 0.6);
        const startX = centerX - sliderWidth / 2;
        
        // Baby mode toggle
        this.babyModeToggle = new ToggleButton(
            startX, 180, 60, 25, gameSettings.babyMode, "Baby Mode (3x Bubble Size)"
        );
        
        // Difficulty multiplier slider (disabled in baby mode)
        this.difficultySlider = new Slider(
            startX, 240, sliderWidth, 20,
            0.5, 2.0, gameSettings.difficultyMultiplier,
            "Difficulty Progression",
            (v) => {
                if (v <= 0.7) return "Easy";
                if (v <= 1.3) return "Normal";
                return "Hard";
            }
        );
        
        // Special bubble frequency slider
        this.specialBubbleSlider = new Slider(
            startX, 320, sliderWidth, 20,
            0.0, 1.0, gameSettings.specialBubbleFrequency,
            "Special Bubble Frequency",
            (v) => Math.round(v * 100) + "%"
        );
        
        // Gesture timing slider
        this.gestureTimingSlider = new Slider(
            startX, 400, sliderWidth, 20,
            1.0, 5.0, gameSettings.gestureTimingSeconds,
            "Gesture Timing",
            (v) => v.toFixed(1) + "s"
        );
        
        // Game time discrete slider
        const currentTimeIndex = timePresets.findIndex(p => p.value === gameSettings.gameTimeMinutes);
        this.timeSlider = new DiscreteSlider(
            startX, 480, sliderWidth, 20,
            timePresets, currentTimeIndex >= 0 ? currentTimeIndex : 1,
            "Game Duration"
        );
        
        this.controls = [this.babyModeToggle, this.difficultySlider, this.specialBubbleSlider, this.gestureTimingSlider, this.timeSlider];
    }
    
    draw(ctx) {
        // Animated gradient background
        const time = Date.now() * 0.001;
        const gradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, `hsl(${220 + Math.sin(time * 0.5) * 20}, 70%, 15%)`);
        gradient.addColorStop(1, `hsl(${200 + Math.cos(time * 0.3) * 15}, 60%, 8%)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Title
        ctx.fillStyle = 'white';
        ctx.font = 'bold 40px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        ctx.shadowBlur = 15;
        ctx.fillText('Settings', this.canvas.width / 2, 80);
        ctx.shadowBlur = 0;
        
        // Draw all controls
        this.controls.forEach(control => {
            // Dim difficulty slider if baby mode is enabled
            if (control === this.difficultySlider && gameSettings.babyMode) {
                ctx.globalAlpha = 0.3;
            }
            control.draw(ctx);
            ctx.globalAlpha = 1.0;
        });
        
        // Baby mode explanation
        if (gameSettings.babyMode) {
            ctx.font = '14px Inter, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
            ctx.textAlign = 'center';
            ctx.fillText('Baby Mode: Large bubbles, slow speed, no difficulty progression', this.canvas.width / 2, 560);
        } else {
            // Gesture timing explanation
            ctx.font = '14px Inter, Arial, sans-serif';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
            ctx.textAlign = 'center';
            ctx.fillText('Gesture Timing controls how long strokes stay visible and multi-stroke grace period', this.canvas.width / 2, 560);
        }
        
        // Back button
        const backButtonWidth = 120;
        const backButtonHeight = 40;
        const backButtonX = this.canvas.width / 2 - backButtonWidth / 2;
        const backButtonY = this.canvas.height - 80;
        
        ctx.fillStyle = '#666666';
        ctx.fillRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.strokeRect(backButtonX, backButtonY, backButtonWidth, backButtonHeight);
        
        ctx.fillStyle = 'white';
        ctx.font = '18px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Back', this.canvas.width / 2, backButtonY + backButtonHeight / 2 + 6);
    }
    
    handleInput(x, y, isDown, isDrag) {
        let handled = false;
        
        // Check back button first
        const backButtonWidth = 120;
        const backButtonHeight = 40;
        const backButtonX = this.canvas.width / 2 - backButtonWidth / 2;
        const backButtonY = this.canvas.height - 80;
        
        if (isDown && !isDrag && 
            x >= backButtonX && x <= backButtonX + backButtonWidth &&
            y >= backButtonY && y <= backButtonY + backButtonHeight) {
            return 'back';
        }
        
        for (let control of this.controls) {
            if (control instanceof ToggleButton) {
                if (isDown && !isDrag && control.handleInput(x, y)) {
                    this.updateSettings();
                    handled = true;
                }
            } else {
                // Slider logic
                if (isDrag) {
                    if (control.handleDrag(x, y)) {
                        this.updateSettings();
                        handled = true;
                    }
                } else if (isDown) {
                    if (control.handleInput(x, y, true)) {
                        this.updateSettings();
                        handled = true;
                    }
                } else {
                    control.stopDragging();
                }
            }
        }
        
        return handled;
    }
    
    updateSettings() {
        gameSettings.babyMode = this.babyModeToggle.value;
        gameSettings.difficultyMultiplier = this.difficultySlider.value;
        gameSettings.specialBubbleFrequency = this.specialBubbleSlider.value;
        gameSettings.gestureTimingSeconds = this.gestureTimingSlider.value;
        gameSettings.gameTimeMinutes = this.timeSlider.selectedPreset.value;
        
        console.log(`Settings updated: baby mode = ${gameSettings.babyMode}, gesture timing = ${gameSettings.gestureTimingSeconds}s`);
    }
    
    resize() {
        this.setupControls(); // Recalculate control positions
    }
}