/**
 * CrewTool - TypeScript interface for invoking agentic-crew CLI
 * 
 * This tool invokes the published agentic-crew Python package via CLI,
 * enabling TypeScript/Node.js applications to run AI crews.
 * 
 * Architecture:
 * - agentic-crew (Python): Crew orchestration, framework decomposition
 * - agentic-control (TypeScript): Fleet management, invokes crews via this tool
 */

import { spawn } from 'child_process';
import type {
    CrewInfo,
    CrewListResponse,
    CrewResult,
    CrewToolConfig,
    InvokeCrewOptions,
} from './types.js';
import { validateConfig, validateInvokeOptions } from './types.js';

/**
 * Error categories for crew tool operations
 */
export type CrewToolErrorCategory = 'config' | 'validation' | 'subprocess' | 'crew' | 'not_installed';

/**
 * Custom error class for crew tool operations
 */
export class CrewToolError extends Error {
    constructor(
        message: string,
        public category: CrewToolErrorCategory,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'CrewToolError';
    }
}

/**
 * Grace period before sending SIGKILL after SIGTERM (in milliseconds)
 */
const SIGKILL_GRACE_PERIOD_MS = 5000;

/**
 * Crew tool for invoking agentic-crew from TypeScript
 * 
 * @example Basic usage
 * ```typescript
 * const crewTool = new CrewTool();
 * 
 * // List available crews
 * const crews = await crewTool.listCrews();
 * 
 * // Run a crew
 * const result = await crewTool.invokeCrew({
 *   package: 'otterfall',
 *   crew: 'game_builder',
 *   input: 'Create a QuestComponent',
 * });
 * ```
 * 
 * @example As a Vercel AI tool
 * ```typescript
 * import { tool } from 'ai';
 * import { z } from 'zod';
 * 
 * const crewTool = new CrewTool();
 * 
 * export const invokeCrewTool = tool({
 *   description: 'Delegate a task to a specialized AI crew',
 *   parameters: z.object({
 *     package: z.string(),
 *     crew: z.string(),
 *     input: z.string(),
 *   }),
 *   execute: async ({ package: pkg, crew, input }) => {
 *     const result = await crewTool.invokeCrew({ package: pkg, crew, input });
 *     if (!result.success) throw new Error(result.error);
 *     return result.output;
 *   },
 * });
 * ```
 */
export class CrewTool {
    private config: Required<CrewToolConfig>;

    constructor(config?: CrewToolConfig) {
        const validated = validateConfig(config ?? {});
        this.config = {
            invokeMethod: validated.invokeMethod ?? 'uv',
            defaultTimeout: validated.defaultTimeout ?? 300000,
            env: validated.env ?? {},
        };
    }

    /**
     * List all available crews across all packages
     */
    async listCrews(): Promise<CrewInfo[]> {
        const result = await this.executeCommand(['list', '--json']);

        if (!result.success) {
            throw new CrewToolError(
                `Failed to list crews: ${result.error}`,
                'crew',
                { exitCode: result.exitCode }
            );
        }

        try {
            const response = JSON.parse(result.output ?? '{}') as CrewListResponse;
            return response.crews ?? [];
        } catch {
            throw new CrewToolError(
                'Failed to parse crew list response',
                'subprocess',
                { output: result.output }
            );
        }
    }

    /**
     * Get detailed information about a specific crew
     */
    async getCrewInfo(packageName: string, crewName: string): Promise<CrewInfo> {
        const result = await this.executeCommand(['info', packageName, crewName, '--json']);

        if (!result.success) {
            throw new CrewToolError(
                `Failed to get crew info: ${result.error}`,
                'crew',
                { package: packageName, crew: crewName, exitCode: result.exitCode }
            );
        }

        try {
            return JSON.parse(result.output ?? '{}') as CrewInfo;
        } catch {
            throw new CrewToolError(
                'Failed to parse crew info response',
                'subprocess',
                { output: result.output }
            );
        }
    }

    /**
     * Invoke a crew with the given input
     */
    async invokeCrew(options: InvokeCrewOptions): Promise<CrewResult> {
        const startTime = Date.now();

        try {
            const validated = validateInvokeOptions(options);

            const result = await this.executeCommand(
                ['run', validated.package, validated.crew, '--input', validated.input, '--json'],
                {
                    timeout: validated.timeout ?? this.config.defaultTimeout,
                    env: { ...this.config.env, ...validated.env },
                }
            );

            // Parse JSON result from agentic-crew CLI
            if (result.success && result.output) {
                try {
                    const parsed = JSON.parse(result.output) as CrewResult;
                    return {
                        ...parsed,
                        duration_ms: parsed.duration_ms ?? (Date.now() - startTime),
                    };
                } catch {
                    // If JSON parsing fails, treat output as plain text result
                    return {
                        success: true,
                        output: result.output,
                        duration_ms: Date.now() - startTime,
                    };
                }
            }

            return {
                success: false,
                error: result.error ?? 'Unknown error',
                duration_ms: Date.now() - startTime,
            };

        } catch (error) {
            if (error instanceof CrewToolError) {
                return {
                    success: false,
                    error: error.message,
                    duration_ms: Date.now() - startTime,
                };
            }

            return {
                success: false,
                error: `Unexpected error: ${(error as Error).message}`,
                duration_ms: Date.now() - startTime,
            };
        }
    }

    /**
     * Execute an agentic-crew CLI command
     */
    private async executeCommand(
        args: string[],
        options?: { timeout?: number; env?: Record<string, string> }
    ): Promise<{ success: boolean; output?: string; error?: string; exitCode?: number }> {
        return new Promise((resolve) => {
            const timeout = options?.timeout ?? this.config.defaultTimeout;
            const env = { ...process.env, ...this.config.env, ...options?.env };

            // Build command based on invoke method
            const executable = this.config.invokeMethod === 'uv' ? 'uv' : 'agentic-crew';
            const commandArgs = this.config.invokeMethod === 'uv'
                ? ['run', 'agentic-crew', ...args]
                : args;

            const proc = spawn(executable, commandArgs, { env });

            let stdout = '';
            let stderr = '';
            let killed = false;

            const timeoutHandle = setTimeout(() => {
                killed = true;
                proc.kill('SIGTERM');

                setTimeout(() => {
                    if (!proc.killed) {
                        proc.kill('SIGKILL');
                    }
                }, SIGKILL_GRACE_PERIOD_MS);
            }, timeout);

            proc.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('exit', (code) => {
                clearTimeout(timeoutHandle);

                if (killed) {
                    resolve({
                        success: false,
                        error: `Crew execution timed out after ${timeout}ms`,
                        output: stdout.trim(),
                        exitCode: code ?? 1,
                    });
                    return;
                }

                if (code === 0) {
                    resolve({
                        success: true,
                        output: stdout.trim(),
                        exitCode: code,
                    });
                } else {
                    resolve({
                        success: false,
                        error: stderr.trim() || stdout.trim() || 'Crew execution failed',
                        output: stdout.trim(),
                        exitCode: code ?? 1,
                    });
                }
            });

            proc.on('error', (error) => {
                clearTimeout(timeoutHandle);

                // Check if agentic-crew is not installed
                if (error.message.includes('ENOENT')) {
                    resolve({
                        success: false,
                        error: `agentic-crew not found. Install with: pip install agentic-crew (or uv pip install agentic-crew)`,
                    });
                } else {
                    resolve({
                        success: false,
                        error: `Failed to spawn process: ${error.message}`,
                    });
                }
            });
        });
    }
}
