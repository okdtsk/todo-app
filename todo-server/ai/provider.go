package ai

import "context"

// Provider defines the interface for AI completion backends.
type Provider interface {
	Complete(ctx context.Context, prompt string) (string, error)
}
