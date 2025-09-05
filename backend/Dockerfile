# Build stage
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Install git and ca-certificates (required for some Go modules)
RUN apk add --no-cache git ca-certificates

# Copy go module files first to leverage Docker layer caching
COPY go.mod ./

# Copy all source files
COPY *.go ./

# Initialize go modules and download dependencies
# This will generate the proper go.sum file with all checksums
RUN go mod tidy
RUN go mod download
RUN go mod verify

# Build the application (Go will automatically exclude test files)
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Expose port
EXPOSE 8080

# Command to run
CMD ["./main"]