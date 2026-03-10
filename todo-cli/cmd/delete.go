package cmd

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"

	"github.com/spf13/cobra"
)

var deleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a todo",
	Args:  cobra.ExactArgs(1),
	Run:   runDelete,
}

func init() {
	rootCmd.AddCommand(deleteCmd)
}

func runDelete(cmd *cobra.Command, args []string) {
	id, err := strconv.Atoi(args[0])
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: invalid todo ID: %s\n", args[0])
		os.Exit(1)
	}

	req, err := http.NewRequest(http.MethodDelete, fmt.Sprintf("%s/api/v1/todos/%d", getServerURL(), id), nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: failed to create request: %v\n", err)
		os.Exit(1)
	}

	resp, err := http.DefaultClient.Do(req)
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

	fmt.Printf("Deleted todo #%d\n", id)
}
