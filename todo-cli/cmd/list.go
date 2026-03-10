package cmd

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

var (
	listToday    bool
	listProject  string
	listLabel    string
	listPriority string
	listDone     bool
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List todos",
	Run:   runList,
}

func init() {
	listCmd.Flags().BoolVar(&listToday, "today", false, "Show today's todos and overdue")
	listCmd.Flags().StringVar(&listProject, "project", "", "Filter by project ID")
	listCmd.Flags().StringVar(&listLabel, "label", "", "Filter by label")
	listCmd.Flags().StringVar(&listPriority, "priority", "", "Filter by priority")
	listCmd.Flags().BoolVar(&listDone, "done", false, "Show completed todos")

	rootCmd.AddCommand(listCmd)
}

type todo struct {
	ID          int      `json:"id"`
	TaskName    string   `json:"task_name"`
	Description string   `json:"description,omitempty"`
	Priority    string   `json:"priority"`
	Date        string   `json:"date,omitempty"`
	Deadline    string   `json:"deadline,omitempty"`
	Labels      []string `json:"labels"`
	ProjectID   *int     `json:"project_id,omitempty"`
	Done        bool     `json:"done"`
}

func runList(cmd *cobra.Command, args []string) {
	params := url.Values{}
	if listToday {
		params.Set("date", "today")
	}
	if listProject != "" {
		params.Set("project_id", listProject)
	}
	if listLabel != "" {
		params.Set("label", listLabel)
	}
	if listPriority != "" {
		params.Set("priority", listPriority)
	}
	if listDone {
		params.Set("done", "true")
	}

	reqURL := getServerURL() + "/api/v1/todos"
	if encoded := params.Encode(); encoded != "" {
		reqURL += "?" + encoded
	}

	resp, err := http.Get(reqURL)
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

	var todos []todo
	if err := json.Unmarshal(body, &todos); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to parse response: %v\n", err)
		os.Exit(1)
	}

	if len(todos) == 0 {
		fmt.Println("No todos found.")
		return
	}

	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tSTATUS\tPRIORITY\tTASK\tDEADLINE\tLABELS")
	for _, t := range todos {
		status := " "
		if t.Done {
			status = "\u2713"
		}

		priority := formatPriority(t.Priority)

		deadline := "-"
		if t.Deadline != "" {
			deadline = t.Deadline[:10]
		}

		labels := "-"
		if len(t.Labels) > 0 {
			labels = strings.Join(t.Labels, ", ")
		}

		fmt.Fprintf(w, "%d\t%s\t%s\t%s\t%s\t%s\n",
			t.ID, status, priority, t.TaskName, deadline, labels)
	}
	if err := w.Flush(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to flush output: %v\n", err)
		os.Exit(1)
	}
}

func formatPriority(p string) string {
	// Use ANSI colors if terminal supports it
	isTTY := fileIsTTY(os.Stdout)

	switch p {
	case "high":
		if isTTY {
			return "\033[31mhigh\033[0m" // red
		}
		return "high"
	case "medium":
		if isTTY {
			return "\033[33mmedium\033[0m" // yellow
		}
		return "medium"
	case "low":
		if isTTY {
			return "\033[34mlow\033[0m" // blue
		}
		return "low"
	default:
		return "none"
	}
}

func fileIsTTY(f *os.File) bool {
	fi, err := f.Stat()
	if err != nil {
		return false
	}
	return (fi.Mode() & os.ModeCharDevice) != 0
}
