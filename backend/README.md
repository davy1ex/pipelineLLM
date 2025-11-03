# Backend API Server

Flask-based backend API for workflow execution.

## Setup

1. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On macOS/Linux
# or
venv\Scripts\activate  # On Windows
```

2. Install dependencies:
```bash
pip install -r config/requirements.txt
```

## Running the Server

### Recommended: Using Python module

```bash
# From backend directory, with venv activated:
python -m app
```

### Alternative: Using run_server.py

```bash
# From backend directory, with venv activated:
python run_server.py
```

### Alternative: Direct script execution

```bash
# From backend directory, with venv activated:
python app/server.py
# or
python app/__main__.py
```

## API Endpoints

- `POST /api/workflow/execute` - Enqueue workflow for execution
- `GET /api/workflow/{queue_id}/status` - Get execution status
- `POST /api/python/execute` - Execute Python code
- `POST /api/ollama/chat` - Call Ollama API
- `POST /api/files/create` - Create file
- `GET /api/files/download/<file_id>` - Download file

## Configuration

Set environment variables:
- `FLASK_PORT` - Server port (default: 5000)
- `FLASK_DEBUG` - Debug mode (default: 0)
- `SECRET_KEY` - Flask secret key

## Project Structure

```
backend/
├── app/           # Flask application
│   ├── server.py  # Main server file
│   └── __main__.py # Module entry point
├── workflow/      # Workflow execution engine
├── executors/     # Node executors
├── shared/        # Shared services
├── tests/         # Test files
└── config/        # Configuration files
```
