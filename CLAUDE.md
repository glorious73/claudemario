# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a vanilla JavaScript 2D side-scrolling platformer game inspired by classic Mario games. It uses pure HTML5 Canvas for rendering with no external libraries or frameworks.

## Running the Game

```bash
start index.html  # Windows
open index.html   # macOS
xdg-open index.html  # Linux
```

Or simply open `index.html` in any modern web browser.

## Architecture

### Core Files
- **index.html** - Game structure with four screen states (start, game, win, lose) and UI elements
- **style.css** - Visual styling for all screens and UI components
- **game.js** - Complete game engine (~570 lines)

### Game Engine Structure

The game follows a single-global-state pattern with all game state stored in the `game` object:

```javascript
const game = {
    canvas, ctx,           // Rendering context
    player,                // Current Player instance
    currentLevel,          // 1 or 2
    score, coins, lives,   // Game stats
    selectedCharacter,     // 'mario' or 'luigi'
    gameState,             // 'start', 'playing', 'win', 'lose'
    keys,                  // Keyboard input tracker
    camera,                // { x, y } for side-scrolling
    objects,               // Level platforms, coins, goals
    enemies,               // Enemy instances
    particles              // Visual effects
}
```

### Key Classes

**Player** (`game.js:46`)
- Handles movement physics (velocity, gravity, friction)
- Collision detection with platforms and enemies
- Character-specific traits (Mario: balanced, Luigi: higher jump)
- Input handling (Arrow keys/WASD + Space)

**Enemy** (`game.js:206`)
- Simple patrol AI that walks back and forth on platforms
- Can be defeated by jumping on top
- Uses same physics system as player (gravity, platform collision)

### Physics System

Collision detection uses AABB (Axis-Aligned Bounding Box) with overlap resolution:
- Calculates overlap on all four sides
- Resolves based on minimum overlap direction
- Prevents tunneling through platforms

Camera follows player horizontally with offset (`updateCamera()` at `game.js:507`).

### Level Design

Levels are defined as JSON objects in `LEVELS` constant (`game.js:320`):
```javascript
{
    playerStart: { x, y },
    objects: [                    // Static level geometry
        { type: 'platform', ... },
        { type: 'coin', ... },
        { type: 'goal', ... }
    ],
    enemies: [{ x, y, speed }]   // Enemy spawn points
}
```

Both levels are designed to be completed in ~20 seconds.

### Game Loop

Standard update-render loop in `gameLoop()` (`game.js:515`):
1. Update player, enemies, particles
2. Update camera position
3. Clear canvas and draw background
4. Draw all objects (platforms, coins, goal)
5. Draw enemies and particles
6. Draw player
7. Request next frame

### Adding New Levels

1. Add new level object to `LEVELS` constant
2. Include `playerStart`, `objects` array, and `enemies` array
3. Update level progression logic in `levelComplete()` function
4. Adjust `game.currentLevel` maximum value

### Modifying Character Stats

Character properties are defined in `CHARACTERS` object (`game.js:12`):
- `speed`: Horizontal movement speed (pixels/frame)
- `jumpPower`: Initial jump velocity (higher = higher jump)
- `color`: Primary rendering color

### Physics Tuning

Adjust constants in `CONFIG` object (`game.js:2`):
- `GRAVITY`: Vertical acceleration per frame
- `FRICTION`: Horizontal deceleration multiplier (0-1)
- `PLAYER_SIZE`: Character dimensions
- `CANVAS_WIDTH/HEIGHT`: Game viewport size
