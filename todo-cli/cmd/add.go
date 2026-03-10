package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/spf13/cobra"
)

var (
	addPriority    string
	addDeadline    string
	addDate        string
	addDescription string
	addProjectID   int
	addLabels      []string
)

var addCmd = &cobra.Command{
	Use:   "add [task name]",
	Short: "Add a new todo",
	Args:  cobra.ExactArgs(1),
	Run:   runAdd,
}

func init() {
	addCmd.Flags().StringVarP(&addPriority, "priority", "p", "none", "Priority: none, low, medium, high")
	addCmd.Flags().StringVar(&addDeadline, "deadline", "", "Deadline (YYYY-MM-DD)")
	addCmd.Flags().StringVar(&addDate, "date", "", "Scheduled date (YYYY-MM-DD)")
	addCmd.Flags().StringVarP(&addDescription, "description", "d", "", "Task description")
	addCmd.Flags().IntVar(&addProjectID, "project-id", 0, "Project ID")
	addCmd.Flags().StringSliceVarP(&addLabels, "label", "l", nil, "Labels (comma-separated or repeated)")

	rootCmd.AddCommand(addCmd)
}

func runAdd(cmd *cobra.Command, args []string) {
	payload := map[string]interface{}{
		"task_name": args[0],
		"priority":  addPriority,
	}

	if addDescription != "" {
		payload["description"] = addDescription
	}

	if addDeadline != "" {
		t, err := time.Parse("2006-01-02", addDeadline)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: invalid deadline format: %s (expected YYYY-MM-DD)\n", addDeadline)
			os.Exit(1)
		}
		payload["deadline"] = t.Format(time.RFC3339)
	}

	if addDate != "" {
		t, err := time.Parse("2006-01-02", addDate)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: invalid date format: %s (expected YYYY-MM-DD)\n", addDate)
			os.Exit(1)
		}
		payload["date"] = t.Format(time.RFC3339)
	}

	if addProjectID != 0 {
		payload["project_id"] = addProjectID
	}

	if len(addLabels) > 0 {
		payload["labels"] = addLabels
	}

	body, err := json.Marshal(payload)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to marshal request: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.Post(getServerURL()+"/api/v1/todos", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to connect to server: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to read response: %v\n", err)
		os.Exit(1)
	}

	if resp.StatusCode >= 400 {
		fmt.Fprintf(os.Stderr, "Error: server returned %d: %s\n", resp.StatusCode, string(respBody))
		os.Exit(1)
	}

	var todo map[string]interface{}
	if err := json.Unmarshal(respBody, &todo); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to parse response: %v\n", err)
		os.Exit(1)
	}

	id := todo["id"]
	fmt.Printf("Created todo #%.0f: %s\n", id, args[0])
}
