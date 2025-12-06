# Error Handling Guide

This guide covers error handling patterns for crew tool integration.

## Error Categories

The crew tool categorizes errors into five types:

1. **Configuration Errors**: Invalid or missing configuration
2. **Validation Errors**: Invalid input parameters
3. **Subprocess Errors**: Failed to spawn or communicate with Python process
4. **Crew Errors**: Crew execution failed
5. **Communication Errors**: Failed to parse crew output

## Error Structure

All crew operations return a `CrewResult`:

```typescript
interface CrewResult {
  success: boolean;
  output?: string;      // Present if successful
  error?: string;       // Present if failed
  exitCode?: number;    // Process exit code
  duration: number;     // Execution time in ms
}
```

## Handling Configuration Errors

```typescript
import { CrewTool, CrewToolError } from 'agentic-control/crews';

try {
  const crewTool = new CrewTool({
    pythonExecutable: 'uv',
    defaultTimeout: -1000,  // Invalid!
  });
} catch (error) {
  if (error instanceof CrewToolError && error.category === 'config') {
    console.error('Configuration error:', error.message);
    console.error('Details:', error.details);
    // Fix configuration and retry
  }
}
```

## Handling Validation Errors

```typescript
const result = await crewTool.invokeCrew({
  package: 'invalid@package',  // Invalid characters
  crew: 'test-crew',
  input: 'test',
});

if (!result.success) {
  if (result.error?.includes('alphanumeric') || result.error?.includes('format')) {
    console.error('Validation error:', result.error);
    console.error('Package names must be alphanumeric with hyphens or underscores');
  }
}
```

## Handling Subprocess Errors

```typescript
const result = await crewTool.invokeCrew({
  package: 'test-package',
  crew: 'test-crew',
  input: 'test',
});

if (!result.success) {
  // Check for subprocess errors
  if (result.error?.includes('spawn') || result.error?.includes('ENOENT')) {
    console.error('Failed to start Python process');
    console.error('Check pythonExecutable configuration');
    console.error('Current setting:', crewTool.config.pythonExecutable);
  } else if (result.error?.includes('not found')) {
    console.error('crew-agents package not found');
    console.error('Check crewAgentsPath configuration');
  }
}
```

## Handling Crew Execution Errors

```typescript
const result = await crewTool.invokeCrew({
  package: 'otterfall',
  crew: 'game_builder',
  input: 'Create a QuestComponent',
});

if (!result.success) {
  // Crew execution failed
  console.error('Crew execution failed');
  console.error('Error:', result.error);
  console.error('Exit code:', result.exitCode);
  console.error('Duration:', result.duration, 'ms');
  
  // Check if crew exists
  const crews = await crewTool.listCrews();
  const exists = crews.some(c => 
    c.package === 'otterfall' && c.name === 'game_builder'
  );
  
  if (!exists) {
    console.error('Crew not found. Available crews:');
    crews.forEach(c => console.log(`  - ${c.package}.${c.name}`));
  }
}
```

## Handling Timeout Errors

```typescript
const result = await crewTool.invokeCrew({
  package: 'otterfall',
  crew: 'game_builder',
  input: 'Complex task that takes a long time',
  timeout: 5000,  // 5 seconds
});

if (!result.success && result.error?.includes('timed out')) {
  console.error('Crew execution timed out');
  console.error(`Duration: ${result.duration}ms`);
  console.error('Partial output:', result.output);
  
  // Retry with longer timeout
  console.log('Retrying with longer timeout...');
  const retryResult = await crewTool.invokeCrew({
    package: 'otterfall',
    crew: 'game_builder',
    input: 'Complex task that takes a long time',
    timeout: 60000,  // 1 minute
  });
}
```

## Retry Logic

```typescript
async function invokeCrewWithRetry(
  crewTool: CrewTool,
  options: InvokeCrewOptions,
  maxRetries = 3
): Promise<CrewResult> {
  let lastError: string | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`Attempt ${attempt}/${maxRetries}...`);
    
    const result = await crewTool.invokeCrew(options);
    
    if (result.success) {
      return result;
    }
    
    lastError = result.error;
    
    // Don't retry validation errors
    if (result.error?.includes('validation') || 
        result.error?.includes('alphanumeric')) {
      break;
    }
    
    // Don't retry if crew not found
    if (result.error?.includes('not found')) {
      break;
    }
    
    // Exponential backoff
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`Waiting ${delay}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    success: false,
    error: lastError || 'All retry attempts failed',
    duration: 0,
  };
}

// Usage
const result = await invokeCrewWithRetry(crewTool, {
  package: 'otterfall',
  crew: 'game_builder',
  input: 'Create a QuestComponent',
});
```

## Graceful Degradation

```typescript
import { Fleet } from 'agentic-control';

const fleet = new Fleet();

async function spawnWithOptionalCrew(
  repository: string,
  task: string,
  crewPackage?: string,
  crewName?: string
) {
  // Try crew-generated spec first
  if (crewPackage && crewName) {
    try {
      const result = await fleet.spawnWithCrewSpec(
        repository,
        crewPackage,
        crewName,
        task
      );
      
      if (result.success) {
        return result;
      }
      
      console.warn('Crew generation failed, falling back to direct spawn');
      console.warn('Error:', result.error);
    } catch (error) {
      console.warn('Crew tool error, falling back to direct spawn');
      console.warn('Error:', error);
    }
  }
  
  // Fallback to direct spawn with original task
  return fleet.spawn({
    repository,
    task,
  });
}

// Usage
const result = await spawnWithOptionalCrew(
  'https://github.com/org/repo',
  'Create a QuestComponent',
  'otterfall',
  'game_builder'
);
```

## Error Logging

```typescript
function logCrewError(result: CrewResult, context: string) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    context,
    success: result.success,
    error: result.error,
    exitCode: result.exitCode,
    duration: result.duration,
  };
  
  // Log to file or monitoring service
  console.error(JSON.stringify(logEntry, null, 2));
  
  // Could send to monitoring service
  // await sendToMonitoring(logEntry);
}

// Usage
const result = await crewTool.invokeCrew({
  package: 'otterfall',
  crew: 'game_builder',
  input: 'Create a QuestComponent',
});

if (!result.success) {
  logCrewError(result, 'game_builder invocation');
}
```

## Error Recovery Strategies

### 1. Timeout Recovery
```typescript
if (result.error?.includes('timed out')) {
  // Strategy: Increase timeout and retry
  const retryResult = await crewTool.invokeCrew({
    ...options,
    timeout: (options.timeout || 300000) * 2,
  });
}
```

### 2. Subprocess Recovery
```typescript
if (result.error?.includes('spawn') || result.error?.includes('ENOENT')) {
  // Strategy: Try alternative Python executable
  const altCrewTool = new CrewTool({
    ...config,
    pythonExecutable: 'python3',  // Try python3 instead of uv
  });
  const retryResult = await altCrewTool.invokeCrew(options);
}
```

### 3. Crew Not Found Recovery
```typescript
if (result.error?.includes('not found')) {
  // Strategy: List available crews and suggest alternatives
  const crews = await crewTool.listCrews();
  const similar = crews.filter(c => 
    c.name.includes(options.crew) || 
    c.package.includes(options.package)
  );
  
  console.error('Crew not found. Similar crews:');
  similar.forEach(c => console.log(`  - ${c.package}.${c.name}`));
}
```

## Best Practices

1. **Always Check Success**: Never assume crew execution succeeded
2. **Log Errors**: Capture error details for debugging
3. **Implement Retries**: Use exponential backoff for transient failures
4. **Validate Early**: Check configuration before execution
5. **Provide Context**: Include operation context in error logs
6. **Graceful Degradation**: Have fallback strategies
7. **Monitor Duration**: Track execution time to identify issues
8. **Categorize Errors**: Handle different error types appropriately

## Common Error Messages

| Error Message | Category | Solution |
|--------------|----------|----------|
| `Crew tool not configured` | Configuration | Add crews section to config |
| `Package name must be alphanumeric` | Validation | Fix package/crew name format |
| `Failed to spawn process` | Subprocess | Check pythonExecutable path |
| `crew-agents package not found` | Subprocess | Check crewAgentsPath |
| `Crew execution timed out` | Crew | Increase timeout |
| `Crew not found` | Crew | Verify crew exists with `list` |
| `Unexpected error` | Communication | Check Python environment |

## See Also

- [Fleet with Crew Spec](./fleet-with-crew-spec.md)
- [Triage with Crew Delegation](./triage-with-crew-delegation.md)
- [Configuration Guide](./configuration.md)
