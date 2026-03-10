package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// GeminiProvider implements the Provider interface using Google Gemini API.
type GeminiProvider struct {
	apiKey string
	model  string
}

// NewGeminiProvider creates a new GeminiProvider.
func NewGeminiProvider(apiKey, model string) *GeminiProvider {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	return &GeminiProvider{apiKey: apiKey, model: model}
}

// Complete sends a text-only prompt to Gemini.
func (g *GeminiProvider) Complete(ctx context.Context, prompt string) (string, error) {
	req := geminiRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{Text: prompt},
				},
			},
		},
	}
	return g.call(ctx, req)
}

// CompleteMultimodal sends a multimodal prompt (text + optional image) to Gemini.
func (g *GeminiProvider) CompleteMultimodal(ctx context.Context, text string, imageData []byte, imageMIME string) (string, error) {
	parts := []geminiPart{{Text: text}}
	if len(imageData) > 0 && imageMIME != "" {
		parts = append(parts, geminiPart{
			InlineData: &geminiInlineData{
				MIMEType: imageMIME,
				Data:     imageData,
			},
		})
	}

	req := geminiRequest{
		Contents: []geminiContent{
			{Parts: parts},
		},
	}
	return g.call(ctx, req)
}

func (g *GeminiProvider) call(ctx context.Context, reqBody geminiRequest) (string, error) {
	url := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model, g.apiKey,
	)

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("gemini request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("gemini API error (status %d): %s", resp.StatusCode, string(respBody))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}

// Gemini API types

type geminiRequest struct {
	Contents []geminiContent `json:"contents"`
}

type geminiContent struct {
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text       string             `json:"text,omitempty"`
	InlineData *geminiInlineData  `json:"inline_data,omitempty"`
}

type geminiInlineData struct {
	MIMEType string `json:"mime_type"`
	Data     []byte `json:"data"`
}

type geminiResponse struct {
	Candidates []geminiCandidate `json:"candidates"`
}

type geminiCandidate struct {
	Content geminiContent `json:"content"`
}
