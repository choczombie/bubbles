// bubble.js - Defines the Bubble class for the game.

/**
 * Generates a random color with a specified hue, avoiding colors too close to black or white.
 * @returns {string} An rgba color string.
 */
function getRandomColor() {
    const r = Math.floor(Math.random() * 150) + 50; // Avoids very dark colors
    const g = Math.floor(Math.random() * 150) + 50;
    const b = Math.floor(Math.random() * 150) + 50;
    return `rgba(${r}, ${g}, ${b}, 0.7)`;
}

/**
 * Special bubble types with their corresponding colors and symbols
 */
export const SpecialBubbleTypes = {
    CIRCLE: { name: 'circle', color: 'gold' },
    TRIANGLE: { name: 'triangle', color: 'silver' }, 
    X: { name: 'X', color: 'rainbow' }
};

/**
 * Represents a single bubble in the game.
 */
export class Bubble {
    constructor(x, y, radius, color, specialType = null) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.specialType = specialType; // null for normal bubbles, or one of SpecialBubbleTypes
        this.popped = false;
        this.popTime = 0;
        this.popRadius = 0;
        this.speedY = Math.random() * 0.5 + 0.2; // A random upward speed
        this.rainbowOffset = Math.random() * Math.PI * 2; // For rainbow animation
    }

    /**
     * Updates the bubble's position each frame.
     */
    update() {
        // Only move the bubble if it hasn't been popped
        if (!this.popped) {
            this.y -= this.speedY;
        } else {
            // Animate the popping effect
            const timeElapsed = Date.now() - this.popTime;
            this.popRadius = this.radius * (timeElapsed / 500); // Animation duration of 500ms
        }
    }

    /**
     * Gets the special bubble color, handling rainbow animation
     */
    getSpecialColor() {
        if (!this.specialType) return this.color;
        
        const type = this.specialType;
        if (type.color === 'gold') {
            return 'rgba(255, 215, 0, 0.9)'; // Gold
        } else if (type.color === 'silver') {
            return 'rgba(192, 192, 192, 0.9)'; // Silver
        } else if (type.color === 'rainbow') {
            // Animated rainbow effect
            const time = Date.now() * 0.005 + this.rainbowOffset;
            const r = Math.floor(127 * Math.sin(time) + 128);
            const g = Math.floor(127 * Math.sin(time + 2) + 128);
            const b = Math.floor(127 * Math.sin(time + 4) + 128);
            return `rgba(${r}, ${g}, ${b}, 0.9)`;
        }
        return this.color;
    }

    /**
     * Draws a symbol on the bubble based on its special type
     */
    drawSymbol(ctx) {
        if (!this.specialType) return;
        
        const symbolSize = this.radius * 0.6;
        const centerX = this.x;
        const centerY = this.y;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        switch(this.specialType.name) {
            case 'circle':
                ctx.beginPath();
                ctx.arc(centerX, centerY, symbolSize * 0.5, 0, 2 * Math.PI);
                ctx.stroke();
                break;
                
            case 'triangle':
                ctx.beginPath();
                ctx.moveTo(centerX, centerY - symbolSize * 0.5); // Top point
                ctx.lineTo(centerX - symbolSize * 0.43, centerY + symbolSize * 0.25); // Bottom left
                ctx.lineTo(centerX + symbolSize * 0.43, centerY + symbolSize * 0.25); // Bottom right
                ctx.closePath();
                ctx.stroke();
                break;
                
            case 'X':
                ctx.beginPath();
                // First diagonal
                ctx.moveTo(centerX - symbolSize * 0.35, centerY - symbolSize * 0.35);
                ctx.lineTo(centerX + symbolSize * 0.35, centerY + symbolSize * 0.35);
                // Second diagonal
                ctx.moveTo(centerX + symbolSize * 0.35, centerY - symbolSize * 0.35);
                ctx.lineTo(centerX - symbolSize * 0.35, centerY + symbolSize * 0.35);
                ctx.stroke();
                break;
        }
    }

    /**
     * Draws the bubble on the canvas.
     * @param {CanvasRenderingContext2D} ctx The canvas context.
     */
    draw(ctx) {
        if (this.popped) {
            // Draw the pop animation
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.popRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - (this.popRadius / this.radius)})`;
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Determine bubble color (special or normal)
            const bubbleColor = this.specialType ? this.getSpecialColor() : this.color;
            
            // Draw the 3D-looking bubble
            ctx.beginPath();
            const gradient = ctx.createRadialGradient(
                this.x + this.radius / 3, this.y - this.radius / 3, this.radius / 10,
                this.x, this.y, this.radius
            );
            gradient.addColorStop(0, '#FFFFFF'); // White highlight
            gradient.addColorStop(0.5, bubbleColor);
            gradient.addColorStop(1, bubbleColor);

            ctx.fillStyle = gradient;
            ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw symbol if this is a special bubble
            this.drawSymbol(ctx);
        }
    }

    /**
     * Checks if a point is inside the bubble.
     * @param {number} x The x-coordinate of the click/tap.
     * @param {number} y The y-coordinate of the click/tap.
     * @returns {boolean} True if the point is inside the bubble.
     */
    isClicked(x, y) {
        const dist = Math.sqrt(Math.pow(x - this.x, 2) + Math.pow(y - this.y, 2));
        return dist < this.radius;
    }

    /**
     * Triggers the popping animation.
     */
    pop() {
        this.popped = true;
        this.popTime = Date.now();
    }

    /**
     * Checks if the bubble is still "alive" and should be rendered.
     * @returns {boolean} True if the bubble is still active.
     */
    isAlive() {
        if (this.popped) {
            return Date.now() - this.popTime < 500; // Popping animation lasts 500ms
        }
        return this.y + this.radius > 0; // Bubble is on screen
    }
}