// UI.js - Defines UI elements like buttons and text.

/**
 * A simple class to represent a clickable button on the canvas.
 */
export class Button {
    constructor(x, y, width, height, text, color, textColor) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = text;
        this.color = color;
        this.textColor = textColor;
    }

    /**
     * Draws the button on the canvas.
     * @param {CanvasRenderingContext2D} ctx The canvas context.
     */
    draw(ctx) {
        // Draw the rounded rectangle for the button
        ctx.fillStyle = this.color;
        ctx.beginPath();
        const cornerRadius = 10;
        ctx.moveTo(this.x + cornerRadius, this.y);
        ctx.lineTo(this.x + this.width - cornerRadius, this.y);
        ctx.quadraticCurveTo(this.x + this.width, this.y, this.x + this.width, this.y + cornerRadius);
        ctx.lineTo(this.x + this.width, this.y + this.height - cornerRadius);
        ctx.quadraticCurveTo(this.x + this.width, this.y + this.height, this.x + this.width - cornerRadius, this.y + this.height);
        ctx.lineTo(this.x + cornerRadius, this.y + this.height);
        ctx.quadraticCurveTo(this.x, this.y + this.height, this.x, this.y + this.height - cornerRadius);
        ctx.lineTo(this.x, this.y + cornerRadius);
        ctx.quadraticCurveTo(this.x, this.y, this.x + cornerRadius, this.y);
        ctx.closePath();
        ctx.fill();

        // Draw the text
        ctx.fillStyle = this.textColor;
        ctx.font = '24px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x + this.width / 2, this.y + this.height / 2);
    }

    /**
     * Checks if a point is inside the button's boundaries.
     * @param {number} x The x-coordinate of the point.
     * @param {number} y The y-coordinate of the point.
     * @returns {boolean} True if the point is within the button.
     */
    isClicked(x, y) {
        return x > this.x && x < this.x + this.width && y > this.y && y < this.y + this.height;
    }
}
