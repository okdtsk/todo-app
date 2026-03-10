package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// AnthropicProvider implements the Provider interface using the Anthropic Messages API.
type AnthropicProvider struct {
	apiKey string
	model  string
}

// NewAnthropicProvider creates a new AnthropicProvider.
func NewAnthropicProvider(apiKey, model string) *AnthropicProvider {
	if model == "" {
		model = "claude-sonnet-4-20250514"
	}
	return &AnthropicProvider{apiKey: apiKey, model: model}
}

// Complete sends a text-only prompt to the Anthropic API.
func (a *AnthropicProvider) Complete(ctx context.Context, prompt string) (string, error) {
	content := []anthropicContent{
		{Type: "text", Text: prompt},
	}
	return a.call(ctx, content)
}

// CompleteMultimodal sends a multimodal prompt (text + optional image) to the Anthropic API.
func (a *AnthropicProvider) CompleteMultimodal(ctx context.Context, text string, imageData []byte, imageMIME string) (string, error) {
	content := []anthropicContent{}
	if len(imageData) > 0 && imageMIME != "" {
		content = append(content, anthropicContent{
			Type: "image",
			Source: &anthropicImageSource{
				Type:      "base64",
				MediaType: imageMIME,
				Data:      base64.StdEncoding.EncodeToString(imageData),
			},
		})
	}
	content = append(content, anthropicContent{
		Type: "text",
		Text: text,
	})
	return a.call(ctx, content)
}

func (a *AnthropicProvider) call(ctx context.Context, content []anthropicContent) (string, error) {
	url := "https://api.anthropic.com/v1/messages"

	reqBody := anthropicRequest{
		Model:     a.model,
		MaxTokens: 4096,
		Messages: []anthropicMessage{
			{
				Role:    "user",
				Content: content,
			},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", a.apiKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("anthropic request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("anthropic API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var anthropicResp anthropicResponse
	if err := json.Unmarshal(respBody, &anthropicResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if len(anthropicResp.Content) == 0 {
		return "", fmt.Errorf("empty response from anthropic")
	}

	// Concatenate all text blocks
	var result string
	for _, block := range anthropicResp.Content {
		if block.Type == "text" {
			result += block.Text
		}
	}

	return result, nil
}

// Anthropic API types

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int                `json:"max_tokens"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicMessage struct {
	Role    string             `json:"role"`
	Content []anthropicContent `json:"content"`
}

type anthropicContent struct {
	Type   string                `json:"type"`
	Text   string                `json:"text,omitempty"`
	Source *anthropicImageSource `json:"source,omitempty"`
}

type anthropicImageSource struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

type anthropicResponse struct {
	Content []anthropicResponseBlock `json:"content"`
}

type anthropicResponseBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}
