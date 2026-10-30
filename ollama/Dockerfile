FROM golang:1.25-alpine AS gateway-build
WORKDIR /src
COPY gateway.go .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/ollama-gateway gateway.go

FROM ollama/ollama:0.40.11
COPY --from=gateway-build /out/ollama-gateway /usr/local/bin/ollama-gateway
COPY start.sh /usr/local/bin/start-ollama.sh

ENV OLLAMA_HOST=127.0.0.1:11434 \
    OLLAMA_MODELS=/var/data/models \
    OLLAMA_KEEP_ALIVE=-1 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    OLLAMA_CONTEXT_LENGTH=8192 \
    OLLAMA_FLASH_ATTENTION=1

EXPOSE 11435
ENTRYPOINT ["/bin/sh", "/usr/local/bin/start-ollama.sh"]
