package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/spf13/cobra"
)

var summaryCmd = &cobra.Command{
	Use:   "summary",
	Short: "Get AI-generated daily summary",
	Run:   runSummary,
}

func init() {
	rootCmd.AddCommand(summaryCmd)
}

func runSummary(cmd *cobra.Command, args []string) {
	resp, err := http.Post(getServerURL()+"/api/v1/ai/daily-summary", "application/json", nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to connect to server: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to read response: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode >= 400 {
		fmt.Fprintf(os.Stderr, "Error: server returned %d: %s\n", resp.StatusCode, string(body))
		os.Exit(1)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		// If not JSON, print raw text (markdown)
		fmt.Println(string(body))
		return
	}

	if summary, ok := result["summary"].(string); ok {
		fmt.Println(summary)
	} else {
		fmt.Println(string(body))
	}
}
