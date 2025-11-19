import { SlashCommand, CommandResult } from './types';
import { executeInitSession } from './commands/init-session';
import { executeSaveCommit } from './commands/save-commit';
import { executeAiTask } from './commands/ai-task';
import { executeCreateSpec } from './commands/create-spec';
import { executeCheckDocs } from './commands/check-docs';
import { getHelpText } from './commands/help';

const commandHandlers: Record<string, (params: string[]) => Promise<CommandResult>> = {
  'init-session': executeInitSession,
  'save-commit': executeSaveCommit,
  'ai-task': executeAiTask,
  'create-spec': executeCreateSpec,
  'check-docs': executeCheckDocs,
  'help': async () => ({ success: true, output: getHelpText(), duration: 0 })
};

export async function executeSlashCommand(command: SlashCommand): Promise<CommandResult> {
  const startTime = Date.now();

  try {
    const handler = commandHandlers[command.command];

    if (!handler) {
      return {
        success: false,
        output: '',
        error: `Comando slash non implementato: /${command.command}`,
        duration: Date.now() - startTime
      };
    }

    const result = await handler(command.params);

    return {
      ...result,
      duration: Date.now() - startTime
    };

  } catch (error) {
    return {
      success: false,
      output: '',
      error: `Errore durante l'esecuzione del comando /${command.command}: ${error.message}`,
      duration: Date.now() - startTime
    };
  }
}
