# Project structure

The app is organized as a Python backend/server plus a TypeScript/JavaScript frontend.

```text
.
|-- app.py
|-- backend
|   |-- __init__.py
|   `-- app.py
|-- frontend
|   `-- src
|       |-- app.ts
|       `-- hero-3d.ts
|-- assets
|   |-- css
|   |   `-- styles.css
|   |-- images
|   |   |-- favicon.svg
|   |   |-- hero-mountain-residence.jpg
|   |   |-- aspen-ridge.jpg
|   |   |-- cascade-lodge.jpg
|   |   |-- aster-residence.jpg
|   |   |-- mountain-estate.jpg
|   |   `-- site-update.jpg
|   `-- js
|       |-- app.js
|       `-- hero-3d.js
|-- docs
|   `-- PROJECT_STRUCTURE.md
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
`-- tsconfig.json
```

## Backend: Python

- `backend/app.py` contains the Python HTTP server.
- `app.py` is a tiny root launcher that imports and runs the backend.
- The backend serves `index.html` and static files from the repo root.

Run it with:

```powershell
python app.py
```

## Frontend: TypeScript/JavaScript

- `frontend/src/app.ts` contains navigation, reveal animations, estimator controls, map/team interactions, and contact CTA behavior.
- `frontend/src/hero-3d.ts` contains the interactive Three.js hero scene.
- `assets/js/app.js` and `assets/js/hero-3d.js` are generated browser JavaScript files.

Build the frontend with:

```powershell
npm run build
```

## Static assets

- `index.html` contains the page structure and content.
- `assets/css/styles.css` contains the visual design, layout, responsive styles, and animations.
- `assets/images/` contains the images extracted from the original embedded base64 HTML.

## GitHub Pages/static hosting

This repo includes `.nojekyll`, so the static files can also be served directly by GitHub Pages or another static host.
