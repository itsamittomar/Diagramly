FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
COPY --from=frontend /app/frontend/dist ./frontend/dist
RUN go build -o server .

FROM alpine:latest
WORKDIR /app
COPY --from=backend /app/server .
COPY --from=backend /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["./server"]
