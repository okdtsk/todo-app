package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var serverURL string

var rootCmd = &cobra.Command{
	Use:   "todo",
	Short: "CLI client for tdtd todo server",
	Long:  "A command-line interface for managing todos via the tdtd todo-server.",
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)
	rootCmd.PersistentFlags().StringVar(&serverURL, "server", "", "todo-server URL (default: http://localhost:8080)")
}

func initConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath("$HOME/.config/todo")

	viper.SetDefault("server_url", "http://localhost:8080")

	viper.BindEnv("server_url", "TODO_SERVER_URL")

	// Read config file if available; ignore error if not found.
	_ = viper.ReadInConfig()

	if serverURL == "" {
		serverURL = viper.GetString("server_url")
	}
}

func getServerURL() string {
	return serverURL
}
