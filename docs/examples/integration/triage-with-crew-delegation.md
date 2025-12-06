# Triage with Crew Delegation

This example demonstrates how to use the Triage system to delegate specialized analysis tasks to CrewAI crews.

## Overview

The `delegateToCrew()` method allows the AI Analyzer to offload complex, domain-specific tasks to specialized CrewAI crews while maintaining the triage workflow.

## Configuration

Configure the crew tool in `agentic.config.json`:

```json
{
  "crews": {
    "pythonExecutable": "uv",
    "crewAgentsPath": "./python",
    "defaultTimeout": 300000,
    "env": {
      "ANTHROPIC_API_KEY": "ANTHROPIC_API_KEY"
    }
  },
  "triage": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

## Basic Usage

```typescript
import { Analyzer } from 'agentic-control/triage';

const analyzer = new Analyzer();

// Delegate task to crew
const result = await analyzer.delegateToCrew(
  'otterfall',           // Package name
  'game_builder',        // Crew name
  'Design a quest system with branching narratives'  // Input
);

if (result.success) {
  console.log('Crew output:', result.output);
} else {
  console.error('Crew failed:', result.error);
}
```

## Combined Triage and Crew Workflow

```typescript
import { Analyzer } from 'agentic-control/triage';
import { Fleet } from 'agentic-control';

const analyzer = new Analyzer({ repo: 'org/repo' });
const fleet = new Fleet();

// Step 1: Analyze conversation to extract tasks
const agentId = 'bc-agent-123';
const conv = await fleet.conversation(agentId);

if (conv.success) {
  const analysis = await analyzer.analyzeConversation(conv.data);
  
  console.log(`Found ${analysis.outstandingTasks.length} outstanding tasks`);
  
  // Step 2: For complex tasks, delegate to specialized crews
  for (const task of analysis.outstandingTasks) {
    if (task.category === 'feature' && task.priority === 'high') {
      console.log(`Delegating to crew: ${task.title}`);
      
      const crewResult = await analyzer.delegateToCrew(
        'otterfall',
        'gameplay_design',
        task.description || task.title
      );
      
      if (crewResult.success) {
        // Use crew output to create detailed issue
        console.log('Crew provided detailed design:', crewResult.output);
        
        // Could create GitHub issue with crew output
        // await createIssue(task.title, crewResult.output);
      }
    }
  }
}
```

## Error Handling

```typescript
try {
  const result = await analyzer.delegateToCrew(
    'otterfall',
    'game_builder',
    'Design quest system'
  );

  if (!result.success) {
    // Categorize error
    if (result.error?.includes('not configured')) {
      console.error('Crew tool not configured');
      console.error('Add crews section to agentic.config.json');
    } else if (result.error?.includes('timed out')) {
      console.error('Crew execution timed out');
      console.error('Consider increasing timeout or simplifying input');
    } else if (result.error?.includes('not found')) {
      console.error('Crew not found');
      console.error('Check package and crew names');
    } else {
      console.error('Crew execution failed:', result.error);
    }
    return;
  }

  // Process successful result
  console.log('Crew completed successfully');
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Output length: ${result.output?.length} characters`);
  
} catch (error) {
  if (error instanceof Error) {
    console.error('Unexpected error:', error.message);
  }
}
```

## Parallel Crew Delegation

```typescript
// Delegate multiple tasks to different crews in parallel
const tasks = [
  { crew: 'gameplay_design', input: 'Design combat system' },
  { crew: 'world_design', input: 'Create world map layout' },
  { crew: 'creature_design', input: 'Design enemy types' },
];

const results = await Promise.all(
  tasks.map(task =>
    analyzer.delegateToCrew('otterfall', task.crew, task.input)
  )
);

// Process results
results.forEach((result, index) => {
  if (result.success) {
    console.log(`${tasks[index].crew}: ✅ Success`);
    console.log(`Output: ${result.output?.slice(0, 100)}...`);
  } else {
    console.log(`${tasks[index].crew}: ❌ Failed`);
    console.error(`Error: ${result.error}`);
  }
});
```

## With Custom Timeout

```typescript
// For long-running analysis tasks
const result = await analyzer.delegateToCrew(
  'otterfall',
  'qa_validation',
  'Comprehensive test plan for quest system',
  {
    timeout: 600000, // 10 minutes
  }
);
```

## Integrating with Code Review

```typescript
import { Analyzer } from 'agentic-control/triage';

const analyzer = new Analyzer({ repo: 'org/repo' });

// Get diff from git
const diff = await getDiff('main', 'feature-branch');

// Standard code review
const review = await analyzer.reviewCode(diff);

// If review finds complex issues, delegate to crew for detailed analysis
if (review.issues.some(i => i.severity === 'critical')) {
  console.log('Critical issues found, delegating to QA crew...');
  
  const qaResult = await analyzer.delegateToCrew(
    'otterfall',
    'qa_validation',
    `Review this code change and provide detailed test recommendations:\n\n${diff}`
  );
  
  if (qaResult.success) {
    console.log('QA Crew Recommendations:');
    console.log(qaResult.output);
  }
}
```

## Chaining Crews

```typescript
// Use output from one crew as input to another
const designResult = await analyzer.delegateToCrew(
  'otterfall',
  'gameplay_design',
  'Design a quest system'
);

if (designResult.success) {
  // Use design output to generate implementation plan
  const implResult = await analyzer.delegateToCrew(
    'otterfall',
    'ecs_implementation',
    `Implement this design:\n\n${designResult.output}`
  );
  
  if (implResult.success) {
    console.log('Implementation plan:', implResult.output);
  }
}
```

## Best Practices

1. **Check Configuration**: Verify crew tool is configured before delegation
2. **Set Appropriate Timeouts**: Complex analysis may need longer timeouts
3. **Handle Failures Gracefully**: Always check result.success before using output
4. **Validate Crew Names**: Ensure package and crew names are correct
5. **Monitor Duration**: Log execution time to identify slow crews
6. **Cache Results**: Consider caching crew outputs for repeated queries

## Common Issues

### Crew Tool Not Configured
```
Error: Crew tool not configured. Add crews section to agentic.config.json
```
**Solution**: Add crews configuration (see Configuration section)

### Crew Not Found
```
Error: Crew execution failed: Crew not found
```
**Solution**: Verify crew exists:
```bash
crew-agents list
```

### Timeout Issues
```
Error: Crew execution timed out after 300000ms
```
**Solution**: Increase timeout or simplify input:
```typescript
const result = await analyzer.delegateToCrew(
  pkg, crew, input,
  { timeout: 600000 }
);
```

## Performance Tips

1. **Parallel Execution**: Use `Promise.all()` for independent crew calls
2. **Timeout Tuning**: Set timeouts based on crew complexity
3. **Input Size**: Keep inputs focused and concise
4. **Result Caching**: Cache crew outputs when appropriate
5. **Error Recovery**: Implement retry logic for transient failures

## See Also

- [Fleet with Crew Spec](./fleet-with-crew-spec.md)
- [Error Handling Guide](./error-handling.md)
- [Configuration Guide](./configuration.md)
