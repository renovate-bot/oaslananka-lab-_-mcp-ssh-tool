import { describe, expect, test } from "@jest/globals";
import {
  formatPromptsForDisplay,
  getPromptsByCategory,
  getRandomPrompts,
  PROMPT_SUGGESTIONS,
} from "../../src/prompts.js";

describe("prompt suggestions", () => {
  test("filters prompts by category", () => {
    const prompts = getPromptsByCategory("session");

    expect(prompts.length).toBeGreaterThan(0);
    expect(prompts.every((prompt) => prompt.category === "session")).toBe(true);
  });

  test("returns a bounded random selection", () => {
    const prompts = getRandomPrompts(3);

    expect(prompts.length).toBe(3);
    expect(prompts.every((prompt) => PROMPT_SUGGESTIONS.includes(prompt))).toBe(true);
  });

  test("formats display output by category", () => {
    const display = formatPromptsForDisplay();

    expect(display).toContain("SSH MCP Tool - What You Can Do");
    expect(display).toContain("Session Operations");
    expect(display).toContain("Package Operations");
  });
});
