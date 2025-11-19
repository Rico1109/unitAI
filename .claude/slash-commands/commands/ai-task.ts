import { CommandResult } from '../types';

export async function executeAiTask(params: string[]): Promise<CommandResult> {
  try {
    if (params.length === 0) {
      return {
        success: false,
        output: '',
        error: 'Sottocomando richiesto. Uso: /ai-task <list|run|status> [parametri]'
      };
    }

    const subcommand = params[0];
    const subParams = params.slice(1);

    switch (subcommand) {
      case 'list':
        return await listWorkflows();

      case 'run':
        return await runWorkflow(subParams);

      case 'status':
        return await getWorkflowStatus();

      default:
        return {
          success: false,
          output: '',
          error: `Sottocomando sconosciuto: ${subcommand}. Usa list, run, o status.`
        };
    }

  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Errore durante l'esecuzione ai-task: ${error.message}`
    };
  }
}

async function listWorkflows(): Promise<CommandResult> {
  const workflows = [
    {
      name: 'init-session',
      description: 'Inizializza sessione di lavoro',
      backends: 'Gemini + Qwen',
      duration: '15-30s'
    },
    {
      name: 'pre-commit-validate',
      description: 'Validazione pre-commit',
      backends: 'Tutti (Qwen + Gemini + Rovodev)',
      duration: '5-90s'
    },
    {
      name: 'parallel-review',
      description: 'Review parallelo del codice',
      backends: 'Gemini + Rovodev',
      duration: '10-30s'
    },
    {
      name: 'validate-last-commit',
      description: 'Validazione post-commit',
      backends: 'Gemini + Qwen',
      duration: '15-25s'
    },
    {
      name: 'bug-hunt',
      description: 'Caccia ai bug con analisi root cause',
      backends: 'Qwen → Gemini → Rovodev',
      duration: '30-60s'
    },
    {
      name: 'feature-design',
      description: 'Design feature con agenti multipli',
      backends: 'ArchitectAgent + ImplementerAgent + TesterAgent',
      duration: '45-90s'
    }
  ];

  let output = '# Workflow Disponibili\n\n';
  output += '| Workflow | Descrizione | Backend | Durata |\n';
  output += '|----------|-------------|---------|---------|\n';

  workflows.forEach(wf => {
    output += `| ${wf.name} | ${wf.description} | ${wf.backends} | ${wf.duration} |\n`;
  });

  output += '\n## Esempi di Utilizzo\n\n';
  output += '```bash\n';
  output += '/ai-task run pre-commit-validate --depth thorough\n';
  output += '/ai-task run parallel-review --files "src/**/*.ts" --focus security\n';
  output += '/ai-task run bug-hunt --symptoms "500 error on upload"\n';
  output += '/ai-task run feature-design --featureDescription "Add OAuth support"\n';
  output += '```\n';

  return {
    success: true,
    output
  };
}

async function runWorkflow(params: string[]): Promise<CommandResult> {
  if (params.length === 0) {
    return {
      success: false,
      output: '',
      error: 'Nome workflow richiesto. Uso: /ai-task run <nome-workflow> [parametri]'
    };
  }

  const workflowName = params[0];
  const workflowParams = parseWorkflowParams(params.slice(1));

  try {
    const result = await executeWorkflow({
      workflow: workflowName,
      params: workflowParams
    });

    let output = `# Esecuzione Workflow: ${workflowName}\n\n`;
    output += `**Status:** ${result.success ? '✅ Successo' : '❌ Fallito'}\n`;
    output += `**Durata:** ${result.duration || 'N/A'}ms\n\n`;

    if (result.output) {
      output += `## Risultato\n\n${result.output}\n`;
    }

    if (result.error) {
      output += `## Errore\n\n${result.error}\n`;
    }

    return {
      success: result.success,
      output
    };

  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Errore durante l'esecuzione del workflow ${workflowName}: ${error.message}`
    };
  }
}

async function getWorkflowStatus(): Promise<CommandResult> {
  // This would check for running workflows
  // For now, return mock status
  return {
    success: true,
    output: '# Status Workflow\n\nNessun workflow attualmente in esecuzione.'
  };
}

function parseWorkflowParams(params: string[]): Record<string, any> {
  const result: Record<string, any> = {};

  for (let i = 0; i < params.length; i++) {
    const param = params[i];

    if (param.startsWith('--')) {
      const key = param.slice(2);
      const value = params[i + 1];

      if (value && !value.startsWith('--')) {
        // Handle different parameter types
        if (value === 'true') {
          result[key] = true;
        } else if (value === 'false') {
          result[key] = false;
        } else if (!isNaN(Number(value))) {
          result[key] = Number(value);
        } else if (value.startsWith('"') && value.endsWith('"')) {
          result[key] = value.slice(1, -1);
        } else if (value.includes(',')) {
          result[key] = value.split(',').map(s => s.trim());
        } else {
          result[key] = value;
        }
        i++; // Skip next param as it's the value
      } else {
        result[key] = true; // Flag parameter
      }
    }
  }

  return result;
}

async function executeWorkflow(params: any): Promise<any> {
  // This would call the actual MCP smart-workflows tool
  // For now, return mock successful result
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate execution time

  return {
    success: true,
    output: 'Workflow completato con successo. Output dettagliato qui.',
    duration: 1500
  };
}
