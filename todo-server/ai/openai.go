package ai

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// OpenAIProvider implements the Provider interface using OpenAI API or compatible APIs.
type OpenAIProvider struct {
	apiKey  string
	model   string
	baseURL string
}

// NewOpenAIProvider creates a new OpenAIProvider.
// baseURL can be set to a custom endpoint for OpenAI-compatible APIs (e.g. "https://api.openai.com/v1").
func NewOpenAIProvider(apiKey, model, baseURL string) *OpenAIProvider {
	if model == "" {
		model = "gpt-4o-mini"
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	baseURL = strings.TrimRight(baseURL, "/")
	return &OpenAIProvider{apiKey: apiKey, model: model, baseURL: baseURL}
}

// Complete sends a text-only prompt to the OpenAI-compatible API.
func (o *OpenAIProvider) Complete(ctx context.Context, prompt string) (string, error) {
	messages := []openaiMessage{
		{
			Role: "user",
			Content: json.RawMessage(mustMarshal(prompt)),
		},
	}
	return o.call(ctx, messages)
}

// CompleteMultimodal sends a multimodal prompt (text + optional image) to the OpenAI-compatible API.
func (o *OpenAIProvider) CompleteMultimodal(ctx context.Context, text string, imageData []byte, imageMIME string) (string, error) {
	parts := []any{
		map[string]string{"type": "text", "text": text},
	}
	if len(imageData) > 0 && imageMIME != "" {
		dataURL := fmt.Sprintf("data:%s;base64,%s", imageMIME, base64.StdEncoding.EncodeToString(imageData))
		parts = append(parts, map[string]any{
			"type": "image_url",
			"image_url": map[string]string{
				"url": dataURL,
			},
		})
	}

	contentJSON, err := json.Marshal(parts)
	if err != nil {
		return "", fmt.Errorf("marshal content: %w", err)
	}

	messages := []openaiMessage{
		{
			Role:    "user",
			Content: json.RawMessage(contentJSON),
		},
	}
	return o.call(ctx, messages)
}

func (o *OpenAIProvider) call(ctx context.Context, messages []openaiMessage) (string, error) {
	url := o.baseURL + "/chat/completions"

	reqBody := openaiRequest{
		Model:    o.model,
		Messages: messages,
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
	req.Header.Set("Authorization", "Bearer "+o.apiKey)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("openai API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var openaiResp openaiResponse
	if err := json.Unmarshal(respBody, &openaiResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if len(openaiResp.Choices) == 0 {
		return "", fmt.Errorf("empty response from openai")
	}

	return openaiResp.Choices[0].Message.Content, nil
}

func mustMarshal(v any) []byte {
	b, _ := json.Marshal(v)
	return b
}

// OpenAI API types

type openaiRequest struct {
	Model    string          `json:"model"`
	Messages []openaiMessage `json:"messages"`
}

type openaiMessage struct {
	Role    string          `json:"role"`
	Content json.RawMessage `json:"content"`
}

type openaiResponse struct {
	Choices []openaiChoice `json:"choices"`
}

type openaiChoice struct {
	Message openaiResponseMessage `json:"message"`
}

type openaiResponseMessage struct {
	Content string `json:"content"`
}
