# ConstructX

Luxury residential, commercial, interior, remodel, lake, mountain, and specialty project website for ConstructX.

Note: the GitHub repository is named `ConctructX`, while the website brand shown in the page is `ConstructX`.

## Stack

- Frontend: TypeScript/JavaScript, HTML, CSS
- Backend/server: Python standard-library HTTP server with a private enquiry API

The original single-file `constructx.html` has been organized into separate frontend source, compiled browser assets, images, docs, and backend server code. See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for the full layout.

## Run locally

Install frontend tooling once:

```powershell
npm install
```

Run the full app:

```powershell
npm run dev
```

Then visit `http://localhost:8000`.

You can also start only the Python backend/server:

```powershell
python app.py
```

## Build frontend JavaScript from TypeScript

Compile TypeScript from `frontend/src` into `assets/js`:

```powershell
npm run build
```

## Private enquiries

The contact form posts to the Python backend at `POST /api/enquiries`. Submissions are stored locally as JSON Lines in `data/enquiries.jsonl`.

That file is intentionally ignored by Git so client/project details do not get committed.

## Notes

- Edit TypeScript source in `frontend/src/`.
- Do not hand-edit `assets/js/*.js` unless you intentionally want to bypass the TypeScript source.
- The page uses Google Fonts and Three.js from public CDNs, so those effects require an internet connection.
