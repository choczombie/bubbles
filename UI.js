// UI.js - User Interface components for the game

/**
 * Represents a clickable button in the game UI
 */
export class Button {
    constructor(x, y, width, height, text, backgroundColor = 'blue', textColor = 'white') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = text;
        this.backgroundColor = backgroundColor;
        this.textColor = textColor;
        this.hovered = false;
    }

    /**
     * Draws the button on the canvas
     * @param {CanvasRenderingContext2D} ctx The canvas context
     */
    draw(ctx) {
        // Draw button background
        ctx.fillStyle = this.hovered ? this.lightenColor(this.backgroundColor) : this.backgroundColor;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw button border
        ctx.strokeStyle = this.textColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
        
        // Draw button text
        ctx.fillStyle = this.textColor;
        ctx.font = '20px Inter, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
            this.text, 
            this.x + this.width / 2, 
            this.y + this.height / 2
        );
    }

    /**
     * Checks if a point is inside the button
     * @param {number} x The x-coordinate
     * @param {number} y The y-coordinate
     * @returns {boolean} True if the point is inside the button
     */
    isClicked(x, y) {
        return x >= this.x && 
               x <= this.x + this.width && 
               y >= this.y && 
               y <= this.y + this.height;
    }

    /**
     * Sets the hover state of the button
     * @param {boolean} hovered Whether the button is hovered
     */
    setHovered(hovered) {
        this.hovered = hovered;
    }

    /**
     * Lightens a color for hover effect
     * @param {string} color The original color
     * @returns {string} The lightened color
     */
    lightenColor(color) {
        // Simple color lightening for common colors
        const colorMap = {
            'blue': '#4169E1',
            'red': '#FF6B6B',
            'gray': '#A0A0A0',
            'green': '#90EE90'
        };
        return colorMap[color] || color;
    }
}
