# Configuration Guide

Complete guide to configuring the crew tool integration.

## Basic Configuration

Add a `crews` section to your `agentic.config.json`:

```json
{
  "crews": {
    "pythonExecutable": "uv",
    "crewAgentsPath": "./python",
    "defaultTimeout": 300000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY"
    }
  }
}
```

## Configuration Options

### pythonExecutable

**Type**: `string`  
**Default**: `"uv"`  
**Description**: Path to Python executable

**Options**:
- `"uv"` - Use uv package manager (recommended)
- `"python3"` - Use system Python 3
- `"python"` - Use system Python
- `"/path/to/python"` - Absolute path to Python

**Example**:
```json
{
  "crews": {
    "pythonExecutable": "python3"
  }
}
```

### crewAgentsPath

**Type**: `string`  
**Default**: Auto-detected (looks for `./python`, `../python`, etc.)  
**Description**: Path to crew-agents package directory

**Example**:
```json
{
  "crews": {
    "crewAgentsPath": "./python"
  }
}
```

**Auto-detection**: If not specified, the system checks:
1. `./python`
2. `../python`
3. `../../python`
4. `{cwd}/python`

### defaultTimeout

**Type**: `number` (milliseconds)  
**Default**: `300000` (5 minutes)  
**Description**: Default timeout for crew execution

**Example**:
```json
{
  "crews": {
    "defaultTimeout": 600000
  }
}
```

**Per-invocation override**:
```typescript
const result = await crewTool.invokeCrew({
  package: 'otterfall',
  crew: 'game_builder',
  input: 'test',
  timeout: 120000,  // Override default
});
```

### env

**Type**: `Record<string, string>`  
**Default**: `{}`  
**Description**: Environment variables to pass to crew execution

**Example**:
```json
{
  "crews": {
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY": "OPENAI_API_KEY",
      "CUSTOM_VAR": "custom_value"
    }
  }
}
```

**Per-invocation override**:
```typescript
const result = await crewTool.invokeCrew({
  package: 'otterfall',
  crew: 'game_builder',
  input: 'test',
  env: {
    ADDITIONAL_VAR: 'value',
  },
});
// Merges with config.env
```

## Complete Configuration Example

```json
{
  "tokens": {
    "organizations": {
      "my-org": {
        "name": "my-org",
        "tokenEnvVar": "GITHUB_MY_ORG_TOKEN"
      }
    },
    "defaultTokenEnvVar": "GITHUB_TOKEN",
    "prReviewTokenEnvVar": "GITHUB_TOKEN"
  },
  "defaultRepository": "my-org/my-repo",
  "logLevel": "info",
  "verbose": false,
  "cursor": {
    "apiKeyEnvVar": "CURSOR_API_KEY",
    "baseUrl": "https://api.cursor.com"
  },
  "fleet": {
    "autoCreatePr": true,
    "openAsCursorGithubApp": false,
    "skipReviewerRequest": false
  },
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKeyEnvVar": "ANTHROPIC_API_KEY"
  },
  "crews": {
    "pythonExecutable": "uv",
    "crewAgentsPath": "./python",
    "defaultTimeout": 300000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
      "LOG_LEVEL": "INFO"
    }
  }
}
```

## Environment Variables

### Required for Crew Tool

- **Python executable**: Must be in PATH or specified in config
- **crew-agents package**: Must be installed or path specified

### Required for Crews

Depends on which crews you're using:

- **ANTHROPIC_API_KEY**: For crews using Claude
- **OPENAI_API_KEY**: For crews using GPT
- **MESHY_API_KEY**: For 3D asset generation crews

### Example .env file

```bash
# GitHub tokens
GITHUB_TOKEN=ghp_...
GITHUB_MY_ORG_TOKEN=ghp_...

# Cursor API
CURSOR_API_KEY=...

# AI providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Optional crew-specific
MESHY_API_KEY=...
LOG_LEVEL=INFO
```

## Configuration Precedence

Configuration is merged in this order (later overrides earlier):

1. **Default values** (hardcoded)
2. **Config file** (`agentic.config.json`)
3. **Environment variables** (for specific settings)
4. **Runtime overrides** (passed to constructors)
5. **Per-invocation options** (passed to methods)

### Example

```json
// agentic.config.json
{
  "crews": {
    "defaultTimeout": 300000,
    "env": {
      "VAR1": "from-config"
    }
  }
}
```

```typescript
// Runtime override
const crewTool = new CrewTool({
  defaultTimeout: 600000,  // Overrides config
  env: {
    VAR2: 'from-constructor',
  },
});

// Per-invocation override
const result = await crewTool.invokeCrew({
  package: 'test',
  crew: 'test',
  input: 'test',
  timeout: 120000,  // Overrides constructor and config
  env: {
    VAR3: 'from-invocation',
  },
});

// Final environment: { VAR1: 'from-config', VAR2: 'from-constructor', VAR3: 'from-invocation' }
// Final timeout: 120000
```

## Configuration Validation

The system validates configuration at initialization:

```typescript
import { CrewTool, CrewToolError } from 'agentic-control/crews';

try {
  const crewTool = new CrewTool({
    defaultTimeout: -1000,  // Invalid!
  });
} catch (error) {
  if (error instanceof CrewToolError) {
    console.error('Configuration error:', error.message);
    // Error: defaultTimeout must be positive
  }
}
```

### Validation Rules

- `pythonExecutable`: Must be a non-empty string
- `crewAgentsPath`: Must be a valid path (if specified)
- `defaultTimeout`: Must be a positive number
- `env`: Must be a record of string key-value pairs

## Platform-Specific Configuration

### macOS / Linux

```json
{
  "crews": {
    "pythonExecutable": "uv",
    "crewAgentsPath": "./python"
  }
}
```

### Windows

```json
{
  "crews": {
    "pythonExecutable": "python",
    "crewAgentsPath": ".\\python"
  }
}
```

### Docker

```json
{
  "crews": {
    "pythonExecutable": "/usr/local/bin/python3",
    "crewAgentsPath": "/app/python",
    "env": {
      "PYTHONUNBUFFERED": "1"
    }
  }
}
```

## Troubleshooting Configuration

### Python Not Found

```
Error: Failed to spawn process: ENOENT
```

**Solutions**:
1. Check Python is installed: `which python3` or `which uv`
2. Specify full path: `"pythonExecutable": "/usr/local/bin/python3"`
3. Add Python to PATH

### crew-agents Not Found

```
Error: crew-agents package not found
```

**Solutions**:
1. Install crew-agents: `cd python && uv sync`
2. Verify path: `ls python/pyproject.toml`
3. Specify correct path: `"crewAgentsPath": "./python"`

### Invalid Timeout

```
Error: defaultTimeout must be positive
```

**Solution**: Use positive number in milliseconds:
```json
{
  "crews": {
    "defaultTimeout": 300000
  }
}
```

### Environment Variables Not Passed

**Check**:
1. Variables are defined in config `env` section
2. Variables exist in process environment
3. Variable names are correct (case-sensitive)

**Debug**:
```typescript
console.log('Config env:', crewTool.config.env);
console.log('Process env:', process.env);
```

## Configuration Best Practices

1. **Use Environment Variables**: Store sensitive data in environment, not config
2. **Set Reasonable Timeouts**: Balance between patience and responsiveness
3. **Specify Paths Explicitly**: Don't rely on auto-detection in production
4. **Version Control**: Commit config file, not .env file
5. **Document Custom Settings**: Add comments explaining non-standard config
6. **Test Configuration**: Verify config works before deployment
7. **Use Defaults**: Only override what you need to change

## Configuration Templates

### Development

```json
{
  "crews": {
    "pythonExecutable": "uv",
    "crewAgentsPath": "./python",
    "defaultTimeout": 600000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
      "LOG_LEVEL": "DEBUG"
    }
  },
  "logLevel": "debug",
  "verbose": true
}
```

### Production

```json
{
  "crews": {
    "pythonExecutable": "/usr/local/bin/python3",
    "crewAgentsPath": "/app/python",
    "defaultTimeout": 300000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
      "LOG_LEVEL": "INFO"
    }
  },
  "logLevel": "info",
  "verbose": false
}
```

### CI/CD

```json
{
  "crews": {
    "pythonExecutable": "python3",
    "crewAgentsPath": "./python",
    "defaultTimeout": 180000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY",
      "CI": "true"
    }
  },
  "logLevel": "warn"
}
```

## See Also

- [Fleet with Crew Spec](./fleet-with-crew-spec.md)
- [Triage with Crew Delegation](./triage-with-crew-delegation.md)
- [Error Handling Guide](./error-handling.md)
