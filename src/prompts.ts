/**
 * Prompt suggestions for AI assistants (ChatGPT, Claude, etc.)
 * These help users understand what they can do with the SSH MCP tool
 */

export interface PromptSuggestion {
  name: string;
  description: string;
  prompt: string;
  category: "session" | "command" | "file" | "system" | "package";
}

export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  // Session management
  {
    name: "Connect to Server",
    description: "Open an SSH connection to a remote server",
    prompt: "Connect to my server at hostname with username user1",
    category: "session",
  },
  {
    name: "List Active Sessions",
    description: "Show all currently active SSH sessions",
    prompt: "Show me all my active SSH sessions",
    category: "session",
  },
  {
    name: "Check Server Health",
    description: "Ping a session to verify the connection is alive",
    prompt: "Check if my SSH session is still connected",
    category: "session",
  },

  // Command execution
  {
    name: "Run Command",
    description: "Execute a command on the remote server",
    prompt: 'Run "ls -la /var/log" on my server',
    category: "command",
  },
  {
    name: "Check Disk Space",
    description: "Check available disk space on the server",
    prompt: "How much disk space is left on my server?",
    category: "command",
  },
  {
    name: "Get System Info",
    description: "Detect OS, architecture, and system details",
    prompt: "What operating system is running on my server?",
    category: "system",
  },

  // File operations
  {
    name: "Read Configuration",
    description: "Read contents of a configuration file",
    prompt: "Show me the contents of /etc/nginx/nginx.conf",
    category: "file",
  },
  {
    name: "Edit File",
    description: "Modify a configuration file on the server",
    prompt: "Add a new server block to my nginx config",
    category: "file",
  },
  {
    name: "List Directory",
    description: "List files and directories in a path",
    prompt: "List all files in /var/www",
    category: "file",
  },

  // Package management
  {
    name: "Install Package",
    description: "Install a software package on the server",
    prompt: "Install nginx on my server",
    category: "package",
  },
  {
    name: "Manage Service",
    description: "Start, stop, or restart a service",
    prompt: "Restart the nginx service",
    category: "package",
  },
];

/**
 * Get prompts by category
 */
export function getPromptsByCategory(category: PromptSuggestion["category"]): PromptSuggestion[] {
  return PROMPT_SUGGESTIONS.filter((p) => p.category === category);
}

/**
 * Get a random subset of prompts for initial suggestions
 */
export function getRandomPrompts(count = 5): PromptSuggestion[] {
  const shuffled = [...PROMPT_SUGGESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Format prompts for display in AI assistant
 */
export function formatPromptsForDisplay(): string {
  const categories = ["session", "command", "file", "system", "package"] as const;
  const lines: string[] = ["## SSH MCP Tool - What You Can Do\n"];

  for (const category of categories) {
    const prompts = getPromptsByCategory(category);
    if (prompts.length > 0) {
      lines.push(`### ${category.charAt(0).toUpperCase() + category.slice(1)} Operations`);
      for (const p of prompts) {
        lines.push(`- **${p.name}**: "${p.prompt}"`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
