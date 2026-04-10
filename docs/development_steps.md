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

To keep the project organized and simple, we use a **flat structure** for pages. Each page component should be a single `.jsx` file directly in `src/pages/`.

### The Layout Component
Internal pages should be wrapped in the `src/components/Layout.jsx` component. This provides:
- The top navigation bar.
- Global navigation links (Home, Profile, Stats, Leaderboard).
- The page title (via the `title` prop).
- Consistent spacing and layout.

### Step-by-Step Instructions

1. **Create the Page Component**:
   Create a new `.jsx` file in `frontend/src/pages/`.

   Example (`frontend/src/pages/MyNewPage.jsx`):
   ```jsx
   import Layout from '../components/Layout'

   export default function MyNewPage() {
     return (
       <Layout title="NEW FEATURE">
         <div className="status-text">
           <h2>New Feature</h2>
           <p>Your implementation goes here.</p>
         </div>
       </Layout>
     );
   }
   ```

2. **Register the Route**:
   Import the component in `frontend/src/App.jsx` and add a new `<Route>`.

   ```jsx
   import MyNewPage from './pages/MyNewPage'
   // ...
   <Route path="/new-feature" element={<MyNewPage />} />
   ```

3. **Link to the Page**:
   If the page should be in the main nav, update `frontend/src/components/Layout.jsx`. Otherwise, use a `<Link>` from another page.

   ```jsx
   import { Link } from 'react-router-dom'
   // ...
   <Link to="/new-feature" className="btn btn--primary">Go to Feature</Link>
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
