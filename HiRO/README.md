ONE LAST RECKONING
Version 1

ONE LAST RECKONING is a browser-based interactive 3D narrative game built using Three.js.
It blends storytelling, symbolism, and gameplay to explore causality, memory, and choice through a four-level progression.

This game is also a playable extension of an original story that is currently being written under the same name:
“ONE LAST RECKONING”.

Description

The game follows Ram, a character trapped inside a fractured timeline rooted in political violence, loss, and guilt.
Each level represents a different mental or temporal construct, gradually revealing the cause behind a single murder that destroyed multiple lives.

Instead of traditional combat or puzzles, the game uses environmental interaction, symbolic mechanics, and spatial reasoning to move the story forward.

This is Version 1 of the project and serves as the foundational experience.

Game Structure

The game is divided into four levels, each with its own mechanics and narrative purpose.

Level 1 – Broken Future

A glowing floor and memory rings introduce the timeline fracture.
The player walks through past memories, activating them in sequence to understand how everything began.

Core mechanics:

Movement and exploration

Ordered memory activation

Visual storytelling through shaders and lighting

Level 2 – Iris Wall

A cylindrical room of hundreds of watching eyes.
Only a few contain real conspiracies. The rest are noise.

Core mechanics:

First-person focus mode

Raycasting interaction

Pattern recognition and deduction

HUD-based progress tracking

Level 3 – InsideOut House

A 5×5 grid inside a rain-soaked house that represents hierarchy and dependency.
Relationships must be repaired in the correct order.

Core mechanics:

Grid-based movement

Connection logic with prerequisites

Collision-restricted architecture

Environmental rain shaders

Logic-driven progression

Level 4 – Infinity Room

A mirrored space where reflections stretch endlessly.
Floating chrome orbs represent future decisions. Only three matter.

Core mechanics:

Physics-based orb movement

Bat interaction (melee)

Projectile throw mode

Orb collision resolution

Multiple interaction styles

Narrative branching through choices

Controls
Movement

W / A / S / D or Arrow Keys – Move

Mouse – Look around

SPACE – Jump

Double-tap SPACE – Long jump

General

ENTER – Close story panels / advance narrative

O – Toggle pointer lock

J – Toggle UI visibility

P – Toggle FPS overlay

H – Developer cheat (skip levels)

Level-Specific

Level 2

Right-click – Focus mode

Left-click – Inspect eye

Level 3

E – Start / complete a connection

Level 4

F – Equip / unequip bat

G – Toggle throw mode

Right-click – Aim (throw mode)

Left-click – Swing bat / throw projectile

R – Replay game (after completion)

Installation

This is a pure front-end project and does not require a backend.

Requirements

A modern browser with WebGL support

Internet connection (for Three.js CDN)

Steps

Clone or download the repository

Ensure the file structure is intact:

assets/
levels/
  level1.js
  level2.js
  level3.js
  level4.js
index.html
main.js
style.css


Open index.html using:

A local server (recommended), or

Directly in a browser (may work with minor limitations)

Technologies Used

Three.js (r160)

Custom GLSL shaders

JavaScript (no frameworks)

HTML5 Canvas

CSS UI overlays

No external game engines were used.

Performance Notes

Reflection environments are dynamically updated at controlled intervals

Spatial hashing is used for orb collision optimization

Shader complexity is balanced to avoid unnecessary post-processing

FPS overlay included for diagnostics

Further optimizations are planned for future versions.

Future Improvements

Planned updates for upcoming versions include:

1. Sound effects and ambient audio

2. Background music per level

3. Further performance optimizations

4. Visual polish and lighting refinements

5. Additional interactions and hidden mechanics

6. An Easter-Egg level connected to the story

7. A direct link to the completed story once writing is finished

Story Integration

This game is directly tied to an original narrative titled:

ONE LAST RECKONING

The story is currently being written.
Once completed, a link to the full story will be added inside the game and in this repository.

The game is designed to be both playable on its own and deeper when experienced alongside the story.

Version Information

Current Version: 1.0

Status: Playable narrative prototype

Backend: None (client-side only)

Author

Created and designed by Rohith Ankalla
as part of a larger creative and technical exploration in interactive storytelling and computer graphics.
