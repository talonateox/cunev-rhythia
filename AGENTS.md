# Repository Guidelines

## Important
- Do not comment your code
- Before writing any code, please double check any existing class and re-use as much as possible!
- As less code as possible, it should be extensible by a human and do not create files if not necessarry.
- Do not introduce methods if they're small or can be included inline.
- Write simple code, don't overly try/catch or type-check, but make it type safe in elegant way

## Project Structure & Module Organization
- `src/` — TypeScript source. Key areas: `atoms/` (engine core), `scenes/` (game/menu/tutorial flows), `ui/` (drawing/animations), `utils/` (config, audio, input, storage), `types/`.
- `public/` — shipped assets (images, audio, fonts). Copied to `dist/` on build.
- `shaders/` — GLSL shaders. Use sparingly; macOS performance is poor.
- `scripts/` — build helpers (`build.ts`, `postbuild.ts`).
- Entry: `index.ts` initializes Steam, config, profiles, palettes, then boots `Rhythia.gameInit()`.

## Build, Test, and Development Commands
- Do not launch or run package command.

## Coding Style & Naming Conventions
- Language: TypeScript. Indent 2 spaces, use double quotes and semicolons.
- Naming: PascalCase classes (`GameLogic.ts`), camelCase functions/vars, UPPER_CASE constants.
- Files: class-centric files in `src/atoms` and `src/scenes` use PascalCase; utilities in `src/utils` use lower camel/kebab as existing.
- Imports: prefer relative from project root paths already in use (e.g., `./src/utils/logger`).

## Testing Guidelines
- Don't test code

## Commit & Pull Request Guidelines
- Don't commit code

## Security & Configuration Tips
- Do not commit local data: `cache/`, `profile.json`, `config.json`, `app.log`, and `dist/` are ignored by `.gitignore`.
- Keep tokens/keys out of source. Asset additions go in `public/`. Do not introduce shaders.
