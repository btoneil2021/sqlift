try:
    from .app import app
except ImportError:  # pragma: no cover - Vercel can import this module as a script.
    from app import app


if __name__ == "__main__":
    app.run(debug=True)
