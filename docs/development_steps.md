# Development Steps: React + Flask

This guide explains how to set up, run, and extend this project.

## Recommended Project Structure
We use a separate directory for the frontend and backend to keep the code clean and ensure easy deployment on Vercel.

```text
/
├── api/                # Flask backend (Python)
├── frontend/           # React source code (Vite)
│   ├── src/
│   ├── index.html
│   └── package.json
├── public/             # (Optional) Static assets
├── .env                # Local credentials (ignored by git)
└── vercel.json         # Vercel deployment config
```

## 1. Installation

### System Prerequisites
Ensure you have the following installed:
- **Python 3.9+**: Check with `python --version`. [Download here](https://www.python.org/downloads/)
- **Node.js (v18+)**: Check with `node -v`. [Download here](https://nodejs.org/)
- **Vercel CLI**: `npm install -g vercel`.

### Project Setup
1. **Initialize Backend**:
   ```bash
   pip install -r requirements.txt
   ```
2. **Initialize Frontend**:
   ```bash
   npx create-vite@latest frontend --template react
   cd frontend
   npm install
   ```
3. **Configure Environment**: Copy `.env.example` to `.env` and fill in your Supabase credentials.

## 2. Running Locally

To run the full stack locally, you need two terminals open:

### Terminal A: Backend (Flask)
```bash
# From the root directory
python api/app.py
```
Backend will run at `http://127.0.0.1:5328`.

### Terminal B: Frontend (Vite)
```bash
# From the root directory
cd frontend
npm run dev
```
Frontend will run at `http://localhost:5173`.


## 3. Adding Pages (Frontend)
To add a new page to your React application:

1. Create a new component in `frontend/src/components/` or `frontend/src/pages/`.
2. Import the component in `frontend/src/App.jsx`.
3. If using `react-router-dom`, add a new `<Route>` for your page.

**Example Page Component:**
```jsx
// frontend/src/pages/MyNewPage.jsx
export default function MyNewPage() {
  return (
    <div>
      <h1>New Feature</h1>
      <p>This is a custom page!</p>
    </div>
  );
}
```

## 4. Adding API Calls (Backend)
To keep the backend organized, every page's API calls should be placed in their own `.py` file inside the `api/` directory (e.g., `api/home.py`).

### Step 1: Define the endpoint in a Blueprint
Create a new file for the page, define a Flask Blueprint, and use the `@api_route` decorator to handle database connections.

```python
# api/my_page.py
from flask import Blueprint, jsonify
from api.utils import api_route

my_page_bp = Blueprint('my_page', __name__)

@my_page_bp.route("/api/new-feature")
@api_route(limit="10 per minute") # Rate limit is optional
def my_new_endpoint(conn): # 'conn' is automatically injected
    with conn.cursor() as cur:
        cur.execute("SELECT * FROM my_table")
        results = cur.fetchall()
        return jsonify(results)
```

### Step 2: Register Blueprint
Import and register your new Blueprint in `api/app.py`.

```python
# api/app.py
from api.my_page import my_page_bp

app.register_blueprint(my_page_bp)
```

### Step 2: Call it from the Frontend
Use a standard `fetch` call in your React component. The proxy will handle routing `/api` to the Flask backend.

```javascript
const response = await fetch('/api/new-feature');
const data = await response.json();
```

## Deployment Notes
When deploying to Vercel:
1. **Dashboard Environment Variables**: Add `DATABASE_URL` and `DATABASE_PASSWORD` in the Vercel project settings.
2. **Project Settings**:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Root Directory**: `./`
