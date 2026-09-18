FROM denoland/deno:latest

WORKDIR /app

COPY . ./

RUN deno task --cwd /app cache

ENTRYPOINT ["deno", "task", "--cwd", "/app", "action"]
