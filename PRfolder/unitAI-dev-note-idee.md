---
date_created: Tuesday, January 6th 2026, 6:02:45 pm
date_modified: Monday, January 26th 2026, 10:09:45 pm
title: unitAI-dev-note-idee
---
- UNITAI: nel init-session workflow gli agenti dovrebbero puntare alla cartella .serena, se presente, e includerne il contesto nella risposta data all'agente. Se non presente, punta a docs/ verificando le date di ultima modifica con ls -l. Dovrebbe suggerire installazione di serena e formazione della struttura ssot.
- aggiustare scelta della directory perchè in alcuni casi come utilizzando antigravity, i workflows puntano ad home.
# aggiustamenti e improvements
Applicare il server-side filtering per tools, improve dei docstrings con xml, seguendo [[guida-per-replicare-mcp-server-infrastructure]] [[CLAUDE_BEST_PRACTICES_GUIDE]].
Modificare i workflows e strip-down per semplicità, applicare smart filtering.
Implementare skills - hooks user wide per forzarne l'utilizzo, valutare implementazione di `ccs` e `cliproxy` nei workflows e come `ask-` command.
I workflows unitAI potrebbero essere integrati con il progetto di semantic search obsidian e codebase integrato (definire in quale modo) ad esempio:
	- anzichè utilizzare sub-agents o agente direttamente, per risparmiarne contesto e tokens, utilizza ask-gemini per operazioni complesse di aggiornamento documentazioni ssot.
# Smart workflows
Gli smart workflows subiranno un refactoring appena ho tempo, qui alcune idee tra nuovi workflows e cambiamenti.
## Overthinker
**implementato** da verificare ultimo commit.
Un loop di 3-5 agenti che ragionano su di una idea (da integrare in unitAI MCP):
	- utente - prompt iniziale
	- primo agente - raffina il prompt, xml tags, scopo preciso / se codebase già presente consulta documentazioni e commits o file come claude.md/agent.md per il contesto del progetto e la inserisce nel prompt. salva file .md locale o db, come prompt master per questo workflow.
	- secondo agente - ragiona sul prompt master / comprende prompt e propone una sua idea/piano, salva .md overthinking iniziale.
	- terzo agente - ragiona sul prompt master / legge prompt overthinking (del secondo agente) e tramite sezioni **review 2nd agent** fa delle note se pensa che siano corrette o meno.
	- quarto agente - ragiona sul prompt master / legge overthinkg e ripete workflow del terzo ..
	- così via fino a 5-6 interazioni
	- overthinking.md finale.
Dubbi:
- gli agenti in sequenza dovrebbero sovrascrivere il file .md del tutto o il ragionamento sopra va bene?
- dovrebbe salvare ogni agente in un file separato che viene letto da un agente intermedio ogni due agenti per crearne uno integrato / alla fine del processo? (quindi un validatore finale - potrebbe essere un modello più potente, oppure ogni agente potrebbe essere un top tier model)

### Miglioramento
Overthinker dovrebbe seguire una metodologia come TDD, standard, nella creazione del piano finale. Non ricordo se alla fine avevo già aggiunto l'interazione e passaggio dal file overthinker alla creazione di un piano preciso, se no, devo farlo.
- Bisogna specificare dove e come salvare piani, overthinker.md, audits, ovvero nella cartella .unitai/
- Ha bisogno di skill complementare
- Database locale unitai.db sqlite (schema da definire) per non basarsi su .md (utile per altri workflows)

## Implementor + skill
Nuovo/refactor di qualcuno degli altri workflow, che si occupa di implementare una determinata task, il piano di overthinker oppure una parte di esso. Può essere un modello più light o GLM.
## Verificator + skill
Verifica il lavoro di implementor manualmente o esegue una serie di test predefiniti della codebase. Deve essere un modello più potente.

# Init-session
Scegliere modello gemini-2.5-flash o gemini-3-flash per eseguire il workflow.

# prompt-improver
`/improve: "prompt` workflow con agente leggero istruito a prendere "prompt", migliorarlo per renderlo più tecnico e preciso per l'agente front, usando anche best practices anthropics (xml, prompting, examples) per corredare la richiesta. Restituisce il prompt migliorato e basta. Una skill potrebbe essere abbinata all'improve: 
- menu interattivi
- proposte di creazione piani
- esecuzione di altri workflow o agenti dedicati, ad esempio explorer, overthinker, test creator, bug fixer
	- l'agente comprende di quale tematica si tratta, e risponde: in base al prompt che mi hai dato propongo di avviare workflow x.

# explorer
Manca un workflow che esegua explorazioni e mapping della codebase, per intero o specifici.
- `/explorer: prompt` - dove prompt potrebbe essere il percorso a una cartella o una specifica di che cosa debba essere esplorato. Corredato da skill, al termine può proporre di creare structure.md, se rileva discrepanze nelle documentazioni rispetto al codice può avviare un altro workflow che aggiusta, può avviare workflow bug fix, può essere utilizzato per proporre refactoring se una cartella è incasinata. Forse gemini-3-flash è sufficiente, ma in base alla complessità può essere usato il 3-pro. Potrebbe essere fatto in due fasi: explorer leggero, proposer intelligente.
- se rileva qualcosa da cambiare, migliorare, in termini di codice, potrebbe usare overthinker o direttamente implementor, previa autorizzazione di un piano, per eseguire direttamente.

**DOPO IL REFACTORING DEGLI SMART-WORKFLOWS, BISOGNA CORREDARE CON SKILLS. SKILLS VANNO INSTALLATE CON UNA CONFIGURAZIONE TRAMITE NPX**

