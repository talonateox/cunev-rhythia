# RyRay

Rhythia Runtime Engine


## TODOS

- Scores
- Spin Integration
- Migrate cache from FS to Mongo or Redis
- Mod multipliers
- Better mod interface
- Better AuthN integration

## Testing the build

This is still not ready to test, as many features are subject to change, or complete overhaul as track changes everyday.

## RayLib

This engine uses RayLib bindings as backend for rendering. It is a custom branch due to a memory leak issue present in the bindings library.

## Development Notice

This project is under heavy development now, any PR's are not welcome as things change and refactor every single day.

## Important upcoming refactors

The game is heavily based on drawSprite for any renderers, as most GPUs are optimized for sprite rendering rather than primite shapes.

In some places this is overused (f.e to draw borders), but it will be refactored.

## Shader usages

Shaders perform really (really) poorly on MacOS, you MUST not use shaders where you can make render something CPU based.

## Multiplayer and Steam Integration

Very WIP, things are still underway
