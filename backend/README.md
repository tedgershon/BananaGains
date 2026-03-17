Create the venv (macOS):
`python -m venv .venv`
Activate it with
`source venv/bin/activate`

Probably similar on Windows. I'd use WSL or bash instead of powershell though. If bash, the setup is the same as above

To run the server, we use uvicorn. FastAPI even says for production you should use FastAPI run, and it also uses uvicorn internally. We have more control over the executable path, hard reload, and server path

`uvicorn main:app --host 127.0.0.1 --port 8000 --reload`