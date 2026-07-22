# Project structure

The original `constructx.html` file has been separated into a normal static website layout so the code is easier to edit in GitHub.

```text
.
|-- index.html
|-- package.json
|-- README.md
|-- docs
|   `-- PROJECT_STRUCTURE.md
`-- assets
    |-- css
    |   `-- styles.css
    |-- images
    |   |-- favicon.svg
    |   |-- hero-mountain-residence.jpg
    |   |-- aspen-ridge.jpg
    |   |-- cascade-lodge.jpg
    |   |-- aster-residence.jpg
    |   |-- mountain-estate.jpg
    |   `-- site-update.jpg
    `-- js
        |-- app.js
        `-- hero-3d.js
```

## What each part does

- `index.html` contains the page structure and content.
- `assets/css/styles.css` contains the full visual design, layout, responsive styles, and animations.
- `assets/js/app.js` contains site interactions like navigation, reveal animations, estimator controls, map/team interactions, and the contact CTA.
- `assets/js/hero-3d.js` contains the interactive Three.js hero scene.
- `assets/images/` contains the images that were extracted from the original embedded base64 HTML.
- `package.json` provides a simple local start command.

## Run locally

```powershell
npm start
```

Then open `http://localhost:8000`.

## GitHub Pages

This repo includes `.nojekyll`, so the static files can be served directly by GitHub Pages or another static host.
