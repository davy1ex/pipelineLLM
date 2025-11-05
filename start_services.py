#!/usr/bin/env python3
"""
Start services with different profiles for PipelineLLM.

Profiles:
  - docker (default): All services in Docker (CPU only, good for production)
  - local: Frontend/nginx in Docker, backend runs locally (MPS/GPU available on Mac)
  - none: Only frontend/nginx in Docker, backend must be started manually

Usage:
    python start_services.py --profile docker
    python start_services.py --profile local
    python start_services.py --profile none
"""

import subprocess
import sys
import argparse
import os
import socket
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.resolve()
DOCKER_DIR = PROJECT_ROOT / "docker"
BACKEND_DIR = PROJECT_ROOT / "backend"


def run_command(cmd, cwd=None, check=True):
    """Run a shell command."""
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, check=check)
    return result


def start_docker_services(services, skip_deps=False):
    """Start specific Docker services.
    
    Args:
        services: List of service names to start
        skip_deps: If True, don't start dependencies
    """
    cmd = ["docker", "compose", "-f", str(DOCKER_DIR / "docker-compose.yml"), "up", "-d", "--build"]
    if skip_deps:
        cmd.append("--no-deps")
    if services:
        cmd.extend(services)
    else:
        cmd.append("nginx")  # Always start nginx
    run_command(cmd, cwd=DOCKER_DIR)


def stop_docker_services(services=None):
    """Stop specific Docker services."""
    cmd = ["docker", "compose", "-f", str(DOCKER_DIR / "docker-compose.yml"), "down"]
    if services:
        cmd.extend(services)
    run_command(cmd, cwd=DOCKER_DIR)


def check_port_available(port: int) -> bool:
    """Check if a port is available."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(('localhost', port))
            return True
        except OSError:
            return False


def start_backend_local(force_port: int = None):
    """Start backend locally for MPS/GPU support.
    
    Args:
        force_port: If specified, use this port and fail if unavailable.
                   If None, try to find an available port.
    """
    print("\n" + "="*60)
    print("Starting backend locally (MPS/GPU available)")
    print("="*60)
    
    # Check if venv exists
    venv_python = BACKEND_DIR / "venv" / "bin" / "python"
    if not venv_python.exists():
        print("ERROR: Backend venv not found. Please create it first:")
        print(f"  cd {BACKEND_DIR}")
        print("  python3 -m venv venv")
        print("  source venv/bin/activate")
        print("  pip install -r config/requirements.txt")
        sys.exit(1)
    
    # Check if port is available
    if force_port:
        port = force_port
        if not check_port_available(port):
            print(f"ERROR: Port {port} is required but already in use!")
            print(f"Please free port {port} before continuing")
            sys.exit(1)
    else:
        port = 5001
        if not check_port_available(port):
            print(f"WARNING: Port {port} is already in use.")
            print("Trying to find alternative port...")
            for alt_port in range(5002, 5010):
                if check_port_available(alt_port):
                    port = alt_port
                    print(f"Using port {port} instead")
                    break
            else:
                print(f"ERROR: No available ports found (5001-5009)")
                print("Please stop the process using port 5001 or choose a different port")
                sys.exit(1)
    
    # Set environment for local run
    env = os.environ.copy()
    env["FLASK_PORT"] = str(port)
    env["DOCKER_CONTAINER"] = "0"  # Not in Docker
    
    # Start backend server
    backend_script = BACKEND_DIR / "run_server.py"
    print(f"\nStarting backend at http://localhost:{port}")
    print("Press Ctrl+C to stop\n")
    
    try:
        subprocess.run([str(venv_python), str(backend_script)], env=env, check=True)
    except KeyboardInterrupt:
        print("\n\nBackend stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\nERROR: Backend failed to start (exit code {e.returncode})")
        sys.exit(1)


def profile_docker():
    """Profile: All services in Docker (CPU only)."""
    print("\n" + "="*60)
    print("Profile: docker (all services in Docker, CPU only)")
    print("="*60)
    print("Starting all services in Docker...")
    start_docker_services(["frontend", "backend", "nginx"])
    print("\n✅ All services started in Docker")
    print("   Frontend: http://localhost")
    print("   Backend API: http://localhost/api")
    print("\nNote: Docling will use CPU only (no GPU acceleration)")


def profile_local():
    """Profile: Frontend/nginx in Docker, backend locally (MPS/GPU)."""
    print("\n" + "="*60)
    print("Profile: local (frontend/nginx in Docker, backend locally)")
    print("="*60)
    
    # Stop and remove backend container if running
    print("Stopping and removing backend container (if running)...")
    stop_cmd = ["docker", "compose", "-f", str(DOCKER_DIR / "docker-compose.yml"), "stop", "backend"]
    subprocess.run(stop_cmd, cwd=DOCKER_DIR, check=False)
    remove_cmd = ["docker", "compose", "-f", str(DOCKER_DIR / "docker-compose.yml"), "rm", "-f", "backend"]
    subprocess.run(remove_cmd, cwd=DOCKER_DIR, check=False)
    
    # Also try direct docker stop/rm in case compose didn't work
    rm_cmd = ["docker", "rm", "-f", "backend_dev"]
    subprocess.run(rm_cmd, check=False)
    
    # Check port 5001 availability - required for nginx
    if not check_port_available(5001):
        print("\n❌ ERROR: Port 5001 is already in use!")
        print("   Port 5001 is required for local backend (nginx expects it)")
        print("\n   To free port 5001, find and stop the process:")
        print("   lsof -ti:5001 | xargs kill -9")
        print("   # or")
        print("   docker stop backend_dev  # if it's the Docker backend")
        print("\n   Or use --profile docker to run everything in Docker")
        sys.exit(1)
    
    print("Starting frontend and nginx in Docker...")
    start_docker_services(["frontend", "nginx"])
    
    # Double-check that backend container is not running
    print("\nVerifying backend container is stopped...")
    check_cmd = ["docker", "ps", "--filter", "name=backend_dev", "--format", "{{.Names}}"]
    result = subprocess.run(check_cmd, capture_output=True, text=True, check=False)
    if result.stdout.strip():
        print("WARNING: Backend container is still running. Force stopping...")
        subprocess.run(["docker", "stop", "-t", "0", "backend_dev"], check=False)
        subprocess.run(["docker", "rm", "-f", "backend_dev"], check=False)
    
    print("\n✅ Frontend and nginx started in Docker")
    print("   Frontend: http://localhost")
    print("   Backend will run locally on port 5001 (MPS/GPU available)")
    print("\nStarting backend locally...")
    
    # Start backend locally (force port 5001)
    start_backend_local(force_port=5001)


def profile_none():
    """Profile: Only frontend/nginx in Docker, backend manual."""
    print("\n" + "="*60)
    print("Profile: none (only frontend/nginx in Docker)")
    print("="*60)
    print("Starting frontend and nginx in Docker (without backend)...")
    start_docker_services(["frontend", "nginx"], skip_deps=True)
    
    print("\n✅ Frontend and nginx started in Docker")
    print("   Frontend: http://localhost")
    print("\n📝 Backend must be started manually:")
    print(f"   cd {BACKEND_DIR}")
    print("   source venv/bin/activate  # or activate.fish on Fish shell")
    print("   python run_server.py")
    print("\n   Or use: python -m app")


def main():
    parser = argparse.ArgumentParser(
        description="Start PipelineLLM services with different profiles",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python start_services.py --profile docker    # All in Docker (CPU)
  python start_services.py --profile local    # Backend local (MPS/GPU)
  python start_services.py --profile none     # Manual backend start
        """
    )
    
    parser.add_argument(
        "--profile",
        choices=["docker", "local", "none"],
        default="docker",
        help="Service profile (default: docker)"
    )
    
    parser.add_argument(
        "--stop",
        action="store_true",
        help="Stop services instead of starting"
    )
    
    args = parser.parse_args()
    
    if args.stop:
        print("Stopping Docker services...")
        stop_docker_services()
        print("✅ Services stopped")
        return
    
    # Route to appropriate profile
    if args.profile == "docker":
        profile_docker()
    elif args.profile == "local":
        profile_local()
    elif args.profile == "none":
        profile_none()
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()

