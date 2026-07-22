# ConstructX

Static marketing site for ConstructX luxury mountain residences.

Note: the GitHub repository is named `ConctructX`, while the website brand shown in the page is `ConstructX`.

The original single-file HTML has been organized into separate HTML, CSS, JavaScript, and image assets, and the site now runs through a Python entrypoint. See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for the full layout.

## Project structure

```text
.
|-- index.html
`-- assets
    |-- css
    |   `-- styles.css
    |-- images
    |   |-- favicon.svg
    |   `-- *.jpg
    `-- js
        |-- app.js
        `-- hero-3d.js
```

## Preview locally

Open `index.html` directly in a browser, or run a local static server:

```powershell
python app.py
```

Then visit `http://localhost:8000`.

The page uses Google Fonts and Three.js from public CDNs, so those effects require an internet connection.
