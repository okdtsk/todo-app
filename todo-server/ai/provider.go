package ai

import "context"

// Provider defines the interface for AI completion backends.
type Provider interface {
	Complete(ctx context.Context, prompt string) (string, error)
}

// MultimodalProvider extends Provider with image support.
type MultimodalProvider interface {
	Provider
	CompleteMultimodal(ctx context.Context, text string, imageData []byte, imageMIME string) (string, error)
}
