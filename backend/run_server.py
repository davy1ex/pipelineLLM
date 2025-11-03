#!/usr/bin/env python3
"""
Standalone script to run Flask server.

Usage:
    python run_server.py
    # or with venv:
    source venv/bin/activate
    python run_server.py
"""

import sys
import os
from pathlib import Path

# Ensure we're in the backend directory
backend_dir = Path(__file__).parent.resolve()
os.chdir(backend_dir)

# Add backend directory to Python path
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Now import and run the server
from app.server import app

if __name__ == '__main__':
    port = int(os.environ.get('FLASK_PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)

