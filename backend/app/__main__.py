"""
Run Flask server.

Usage:
    python -m app
    # or
    python app/__main__.py
"""

from app.server import app

if __name__ == '__main__':
    import os
    # Use FLASK_PORT env var or default to 5000 (for Docker) or 5001 (for local macOS)
    # In Docker, use 5000. For local development on macOS, use 5001 to avoid AirPlay conflict
    default_port = 5000 if os.environ.get('DOCKER_CONTAINER') else 5001
    port = int(os.environ.get('FLASK_PORT', default_port))
    app.run(host='0.0.0.0', port=port, debug=True)

