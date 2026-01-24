SUCCESS: # Triangulated Review

## Metadati

- **files**: src/server.ts,src/dependencies.ts,src/utils/circuitBreaker.ts,src/workflows/modelSelector.ts,src/utils/aiExecutor.ts
- **goal**: refactor
- **backendsUsed**: ask-gemini,ask-cursor
- **failedBackends**: 


## Sintesi Analisi (Gemini + Cursor)
# Analisi Combinata

## Risultati delle Analisi

### ask-gemini

Certamente. Ecco un'analisi dettagliata dei file forniti, con un focus sulla qualità del codice, l'allineamento architetturale e l'impatto a lungo termine.

---

### **Analisi Generale e Architetturale**

L'architettura generale che emerge da questi file è quella di un sistema robusto, modulare e orientato alla resilienza. I componenti chiave come `aiExecutor`, `modelSelector` e `circuitBreaker` formano un "intelligent proxy" o un "facade" che astrae la complessità dell'interazione con molteplici backend AI.

L'uso di un gestore di dipendenze centralizzato (`dependencies.ts`) e di un entry-point server ben definito (`server.ts`) suggerisce un'attenzione alla manutenibilità e alla separazione delle responsabilità (Separation of Concerns).

**Allineamento con l'obiettivo Refactor:**
L'architettura attuale è ben posizionata per un'evoluzione futura. La modularità permette di sostituire o aggiungere componenti (es. un nuovo backend AI) con un impatto minimo sul resto del sistema. Il disaccoppiamento tra la logica di business (selezione e esecuzione) e le implementazioni concrete (wrapper dei CLI) è il maggior punto di forza in ottica di refactoring e manutenibilità a lungo termine.

---

### **Analisi per File**

#### **1. `src/server.ts`**

Questo file agisce come entry-point per il server MCP (Model Context Protocol), gestendo le connessioni e l'instradamento delle richieste ai gestori di tool.

*   **Punti di Forza:**
    *   **Incapsulamento:** L'uso della classe `UnitAIServer` incapsula bene la logica del server.
    *   **Ciclo di Vita:** Gestisce correttamente l'inizializzazione (`initializeDependencies`) e la chiusura (`closeDependencies`), inclusa una gestione per il "graceful shutdown".
    *   **Standardizzazione:** L'adesione a `@modelcontextprotocol/sdk` favorisce l'interoperabilità e la standardizzazione.

*   **Aree di Miglioramento:**
    *   **Gestione Errori:** Nel gestore `CallToolRequestSchema`, gli errori vengono catturati e rilanciati. Sebbene l'SDK li gestisca, potrebbe essere utile mappare gli errori interni in errori specifici del protocollo per dare più contesto al client.
    *   **Dependency Injection:** Le dipendenze vengono ottenute tramite `initializeDependencies()` nel costruttore. Per migliorare la testabilità (unit testing), sarebbe preferibile iniettare le dipendenze dall'esterno (es. nel costruttore).

#### **2. `src/dependencies.ts`**

Questo modulo è responsabile della creazione e gestione del ciclo di vita delle dipendenze condivise, principalmente le connessioni al database.

*   **Punti di Forza:**
    *   **Centralizzazione:** Fornisce un unico punto per gestire le risorse condivise, semplificando la logica e la configurazione.
    *   **Performance DB:** L'impostazione `pragma('journal_mode = WAL')` per `better-sqlite3` è una best practice per migliorare la concorrenza e le performance in lettura.
    *   **Chiarezza:** Le funzioni `initialize`, `get`, e `close` definiscono un ciclo di vita chiaro e prevedibile.

*   **Aree di Miglioramento:**
    *   **Tight Coupling (Accoppiamento Elevato):** L'uso del pattern Singleton (esposto come modulo) rende i componenti che usano `getDependencies()` dipendenti da questa implementazione specifica. Questo rende i test di unità più complessi, poiché non è possibile "mockare" facilmente le dipendenze.
    *   **Raccomandazione:** Valutare l'introduzione di un semplice container di Inversion of Control (IoC) o passare le dipendenze esplicitamente dove servono. Questo allenterebbe l'accoppiamento e migliorerebbe drasticamente la testabilità.

#### **3. `src/utils/circuitBreaker.ts`**

Implementazione del pattern Circuit Breaker per monitorare la salute dei backend AI e prevenire fallimenti a cascata.

*   **Punti di Forza:**
    *   **Implementazione Solida:** Segue correttamente la macchina a stati del pattern (CLOSED, OPEN, HALF_OPEN).
    *   **Singleton:** L'uso del pattern Singleton è appropriato per uno stato globale come questo.
    *   **Logging:** Fornisce un logging chiaro durante le transizioni di stato, fondamentale per il debugging.

*   **Aree di Miglioramento:**
    *   **Configurazione Hardcoded:** I parametri `failureThreshold` e `resetTimeoutMs` sono hardcoded. Renderli configurabili (tramite file di configurazione o variabili d'ambiente) permetterebbe di adattare il comportamento del sistema senza modificare il codice.
    *   **Stato In-Memory:** Lo stato dei circuiti è volatile. Al riavvio del server, tutte le informazioni sulla salute dei backend vengono perse.
    *   **Raccomandazione (Priorità Bassa):** Per una maggiore robustezza, si potrebbe considerare di persistere lo stato (es. su un file JSON o un DB K-V leggero) per "sopravvivere" ai riavvii.

#### **4. `src/utils/aiExecutor.ts`**

Questo file è il cuore del sistema. Agisce come un facade che orchestra l'esecuzione dei comandi verso i vari backend AI, integrando logica di resilienza.

*   **Punti di Forza:**
    *   **Pattern Facade:** Eccellente esempio di Facade. Fornisce un'interfaccia unica (`executeAIClient`) che astrae la complessità di diversi sottosistemi (i vari CLI). Questo è un enorme vantaggio per la manutenibilità.
    *   **Resilienza:** L'integrazione con il `circuitBreaker` e la logica di **retry-with-fallback** è un punto di forza eccezionale, che rende il sistema molto più robusto.
    *   **Sicurezza:** L'attenzione alla sicurezza è evidente con la validazione e sanitizzazione degli input (`sanitizePrompt`, `validateFilePaths`). L'opzione `trustedSource` è una soluzione pragmatica per gestire chiamate interne.

*   **Aree di Miglioramento:**
    *   **Complessità Funzione:** La funzione `executeAIClient` sta diventando complessa. La logica di retry, fallback e circuit breaking è mescolata. Potrebbe essere astratta in una funzione di ordine superiore (higher-order function) o in una classe dedicata per la gestione delle policy di esecuzione.
    *   **Gestione Errori nel Retry:** La logica di retry viene attivata da qualsiasi errore. Sarebbe più efficiente distinguere tra errori transienti (es. timeout, errori di rete), per cui un retry è sensato, ed errori fatali (es. argomenti invalidi, prompt rifiutato), per cui il sistema dovrebbe fallire immediatamente.
    *   **Codice Commentato:** Sono presenti frammenti di codice commentati che andrebbero rimossi per mantenere il codice pulito.

#### **5. `src/workflows/modelSelector.ts`**

Implementa la logica di selezione del backend AI più adatto in base alle caratteristiche del task.

*   **Punti di Forza:**
    *   **Motore a Regole:** La logica di selezione (`selectOptimalBackend`) basata su regole (`if/else if`) è semplice, leggibile e facile da debuggare.
    *   **Astrazione:** L'uso dell'interfaccia `TaskCharacteristics` per descrivere un task è un'ottima astrazione.
    *   **Integrazione:** Si integra correttamente con il `circuitBreaker` per escludere backend non disponibili.
    *   **Funzioni di Supporto:** La presenza di `selectFallbackBackend` e delle statistiche (`BackendStats`) arricchisce il sistema di resilienza e osservabilità.

*   **Aree di Miglioramento:**
    *   **Regole Rigide:** La catena `if/else if` in `selectOptimalBackend` può diventare difficile da manutenere con l'aumentare delle regole e dei modelli.
    *   **Raccomandazione (Lungo Termine):** Si potrebbe evolvere verso un approccio più data-driven, dove le regole sono definite in un oggetto di configurazione o un array di "predicati", rendendo il motore di selezione più dinamico e facile da estendere.
    *   **Mancato Apprendimento Dinamico:** Il sistema colleziona statistiche (`BackendStats`) ma non le usa per influenzare dinamicamente la selezione del backend. La selezione rimane statica. Il passo successivo sarebbe integrare metriche come il "success rate" o il "tempo di risposta" nella logica di `selectOptimalBackend` per creare un sistema che si auto-adatta.
    *   **Linting:** C'è un'importazione duplicata di `circuitBreaker`.

---

### **Riepilogo e Raccomandazioni**

#### **Punti di Forza Identificati**

1.  **Architettura Robusta e Resiliente:** L'uso combinato di Facade, Circuit Breaker e logica di retry/fallback è eccellente.
2.  **Codice Modulare e Disaccoppiato:** I componenti hanno responsabilità chiare e sono ben separati.
3.  **Buona Leggibilità:** Il codice è ben scritto, documentato con JSDoc e utilizza convenzioni chiare.
4.  **Attenzione alla Sicurezza:** La sanitizzazione degli input è una best practice correttamente implementata.

#### **Problemi e Aree di Miglioramento (con Priorità)**

1.  **Priorità Alta:** **Migliorare la Testabilità (Dependency Injection)**. L'attuale pattern in `dependencies.ts` crea un forte accoppiamento. Modificarlo per permettere la DI (Dependency Injection) sbloccherebbe la capacità di scrivere unit test efficaci, cruciali per la stabilità a lungo termine del progetto.
2.  **Priorità Media:** **Rendere Configurabili i Componenti Critici.** Spostare la configurazione hardcoded (es. in `circuitBreaker.ts` e le regole in `modelSelector.ts`) in file esterni (`.json`, `.env`) per aumentare la flessibilità.
3.  **Priorità Media:** **Affinare la Logica di Retry.** In `aiExecutor.ts`, distinguere tra errori recuperabili e non recuperabili per evitare retry inutili e costosi.
4.  **Priorità Bassa:** **Rendere Dinamica la Selezione del Modello.** In `modelSelector.ts`, iniziare a usare le statistiche raccolte per influenzare la selezione del backend. Questo trasformerebbe il sistema da reattivo a proattivo.

#### **Raccomandazioni Specifiche**

1.  **Azione Immediata:** Refactor di `dependencies.ts`. Introdurre un semplice container IoC o modificare i costruttori delle classi (`UnitAIServer`, etc.) per accettare le dipendenze come argomenti.
2.  **Azione a Breve Termine:** Creare un file di configurazione centrale (es. `config.ts` o `config.json`) da cui `circuitBreaker.ts` e altri componenti possano leggere i loro parametri.
3.  **Azione a Lungo Termine:** Pianificare un'evoluzione per `modelSelector.ts` dove le regole di selezione non siano più una catena di `if` ma una struttura dati (es. un array di oggetti-regola). Questo faciliterà l'aggiunta di nuovi modelli e strategie di routing.


### ask-cursor

Inizierò leggendo i file che hai richiesto. Due dei file (`src/server.ts`, `src/dependencies.ts`) esistono, ma altri tre (`src/utils/circuitBreaker.ts`, `src/workflows/modelSelector.ts`, `src/utils/aiExecutor.ts`) non sembrano essere presenti nella struttura del progetto che mi hai fornito.

Procedo a leggere i file esistenti e a verificare il contenuto delle directory `src/utils/` e `src/workflows/` per trovare eventuali file con nomi simili o funzionalità equivalenti che potrebbero essere rilevanti per l'analisi.
Ho letto `src/server.ts` e `src/dependencies.ts`. Ora cercherò i file mancanti utilizzando `glob` per ispezionare le directory `src/utils` and `src/workflows`.
Bene, `glob` ha trovato `src/utils/circuitBreaker.ts` e `src/utils/aiExecutor.ts`. Evidentemente, i percorsi erano corretti. Ora verifico la presenza di `src/workflows/modelSelector.ts`.
Perfetto, `glob` ha trovato `src/workflows/modelSelector.ts`. Ora leggo i tre file rimanenti.
Perfetto, ho analizzato tutti i file. Ecco un'analisi dettagliata seguita da suggerimenti concreti.

---

### **Analisi Dettagliata del Codice**

Ecco un'analisi dei file forniti, suddivisa secondo i criteri richiesti.

#### **1. Punti di Forza Identificati**

*   **Architettura Robusta e Modulare:**
    *   **Separation of Concerns:** Il codice dimostra una chiara separazione delle responsabilità. `dependencies.ts` gestisce il setup delle risorse, `server.ts` la comunicazione, `aiExecutor.ts` astrae le chiamate ai tool, `circuitBreaker.ts` la resilienza e `modelSelector.ts` la logica di business. Questa è una best practice che aumenta la manutenibilità.
    *   **Design Pattern Solidi:** L'uso di pattern come il **Singleton** (`CircuitBreaker`, `dependencies`), il **Facade** (`aiExecutor.ts`) e lo **Strategy** (la logica di selezione in `modelSelector.ts`) è appropriato e ben implementato. L'architettura è orientata alla resilienza (Circuit Breaker, retry con fallback).
    *   **Dependency Injection Semplice:** `dependencies.ts` implementa una forma base di DI (Service Locator), centralizzando la gestione delle dipendenze in modo efficace per le esigenze attuali.

*   **Qualità del Codice e Leggibilità:**
    *   **TypeScript Moderno:** L'uso di `async/await`, `enum`, interfacce (`TaskCharacteristics`, `AIExecutionOptions`) e tipi unione è idiomatico e migliora la sicurezza dei tipi.
    *   **Codice Ben Commentato:** La maggior parte delle classi e funzioni ha commenti JSDoc che ne spiegano lo scopo e il funzionamento (es. `CircuitBreaker`), eccellente per la documentazione.
    *   **Logging Chiaro:** L'uso di un `logger` centralizzato con livelli diversi (`info`, `debug`, `error`) è una best practice. I messaggi di log sono informativi e contestualizzati (es. `[CircuitBreaker] Backend ${backend} recovered.`).

*   **Gestione degli Errori e Resilienza:**
    *   **Circuit Breaker:** L'implementazione in `src/utils/circuitBreaker.ts` è un punto di forza enorme. Previene fallimenti a cascata e permette al sistema di auto-ripararsi.
    *   **Retry con Fallback:** La logica di re-tentativo in `executeAIClient` (`aiExecutor.ts`), che collabora con `modelSelector` e `circuitBreaker`, è un pattern di resilienza avanzato e ben implementato.
    *   **Gestione Esplicita degli Errori:** Gli errori vengono catturati, loggati e gestiti appropriatamente, spesso ri-lanciandoli per essere gestiti dai livelli superiori (es. l'SDK di MCP in `server.ts`).

*   **Sicurezza:**
    *   **Sanitizzazione degli Input:** In `aiExecutor.ts`, la chiamata a `sanitizePrompt` prima di eseguire comandi CLI è una misura di sicurezza fondamentale per prevenire command injection.
    *   **Validazione dei Percorsi:** L'uso di `validateFilePaths` per gli `attachments` è un'altra buona pratica di sicurezza per evitare Path Traversal.

#### **2. Problemi o Aree di Miglioramento**

*   **Testabilità e Design Pattern:**
    *   **Abuso del Singleton:** L'uso estensivo di Singleton (`CircuitBreaker.getInstance()`, `initializeDependencies`) rende i test di unità difficili. Per testare una funzione che usa il `circuitBreaker`, si interagisce con uno stato globale, rendendo i test non isolati e fragili. Sarebbe meglio passare le dipendenze tramite **Dependency Injection** esplicita (es. nel costruttore).
    *   **Mancanza di Interfacce per i Servizi:** I moduli esportano classi e funzioni concrete. L'uso di interfacce (`ICircuitBreaker`, `IModelSelector`) permetterebbe di "mockare" facilmente le dipendenze nei test, disaccoppiando la logica di business dalle sue implementazioni.

*   **Accoppiamento e Manutenibilità:**
    *   **Dipendenze Cicliche Implicite:** `aiExecutor.ts` importa `modelSelector.ts` (per il fallback), e `modelSelector.ts` importa `aiExecutor.ts` (per `BACKENDS`). Sebbene TypeScript lo gestisca, è un "code smell" che indica un accoppiamento troppo stretto tra la logica di selezione e quella di esecuzione.
    *   **Logica di Selezione Complessa:** La funzione `selectOptimalBackend` in `modelSelector.ts` è una lunga catena di `if`. Con l'aumentare dei modelli e delle regole, diventerà molto difficile da leggere e manutenere.
    *   **Grande `switch` in `executeAIClient`:** Similmente, il blocco `switch` per scegliere la funzione di esecuzione in `aiExecutor.ts` crescerà con ogni nuovo backend, violando il principio Open/Closed.

*   **Gestione degli Errori:**
    *   **Throw Generico:** In `server.ts`, `executeTool` cattura un errore e poi lo ri-lancia (`throw error;`). Sarebbe meglio wrappare l'errore in una classe di errore specifica (es. `ToolExecutionError`) per fornire più contesto al chiamante.

*   **Copertura dei Test (Deduzione):**
    *   Data la struttura del codice (Singleton, mancanza di DI), è probabile che la copertura dei test di unità sia bassa o che i test siano più simili a lenti e fragili test di integrazione. La mancanza di file `*.test.ts` nel tree supporta questa ipotesi.

#### **3. Raccomandazioni Specifiche e Suggerimenti di Refactoring**

1.  **Refactoring: Introdurre Dependency Injection (DI)**
    *   **Priorità:** **Alta**
    *   **Descrizione:**
        1.  Rimuovere l'export del Singleton `circuitBreaker` e della funzione `getDependencies`.
        2.  Le classi e le funzioni che necessitano di queste dipendenze dovrebbero riceverle nel costruttore o come argomenti.
        3.  Il file di entry point (che avvia `UnitAIServer`) diventerà il **"Composition Root"**: il luogo dove tutte le dipendenze vengono create e "iniettate" nelle classi che le richiedono.
        *   **Esempio (in `server.ts`):**
            ```typescript
            // Prima
            constructor() {
                this.dependencies = initializeDependencies();
                // ...
            }
            // Dopo
            constructor(dependencies: AppDependencies) {
                this.dependencies = dependencies;
                // ...
            }
            ```
    *   **Rischi Residui:** Basso. È un refactoring strutturale ma sicuro se fatto in modo incrementale. Il compilatore TypeScript aiuterà a trovare tutti i punti da aggiornare.

2.  **Refactoring: Disaccoppiare Selezione ed Esecuzione**
    *   **Priorità:** **Media**
    *   **Descrizione:**
        1.  **Usare una Mappa di Esecutori:** In `aiExecutor.ts`, sostituire il grande blocco `switch` con una mappa che associa dinamicamente il nome del backend alla sua funzione di esecuzione. Questo rende l'aggiunta di nuovi backend un'operazione O(1).
            ```typescript
            const backendExecutors: Record<string, (opts: any) => Promise<string>> = {
                [BACKENDS.GEMINI]: executeGeminiCLI,
                [BACKENDS.QWEN]: executeQwenCLI,
                // ...
            };

            const executorFn = backendExecutors[backend];
            if (!executorFn) throw new Error(`Unsupported backend: ${backend}`);
            result = await executorFn(rest);
            ```
        2.  **Usare Regole per la Selezione:** In `modelSelector.ts`, trasformare la catena di `if` in un array di oggetti-regola con priorità. Ogni regola ha una condizione e una lista di backend candidati.
            ```typescript
            const selectionRules = [
                {
                    condition: (task) => task.requiresArchitecturalThinking,
                    backends: [BACKENDS.GEMINI, BACKENDS.QWEN]
                },
                // ...
            ];
            ```
    *   **Rischi Residui:** Basso. Se le interfacce delle funzioni non cambiano, è un refactoring interno. È cruciale verificare che la nuova logica copra tutti i casi precedenti.

3.  **Refactoring: Estrarre Interfacce per i Servizi**
    *   **Priorità:** **Media** (da fare insieme o dopo la DI)
    *   **Descrizione:**
        1.  Creare `ICircuitBreaker`, `IModelSelector`, `IBackendExecutor`.
        2.  Le classi concrete (`CircuitBreaker`, ecc.) implementeranno queste interfacce.
        3.  Le altre classi dipenderanno dalle interfacce, non dalle implementazioni concrete, facilitando il mocking nei test.
    *   **Rischi Residui:** Minimo. È un cambiamento che riguarda la "forma" del codice e viene validato dal compilatore. Il beneficio principale è per i test.

#### **4. Priorità dei Problemi**

1.  **Alta:** La **mancanza di Dependency Injection** e l'abuso di Singleton, che compromettono la testabilità e la manutenibilità del sistema.
2.  **Media:** L'**accoppiamento stretto** tra i moduli di selezione ed esecuzione e la logica complessa hardcoded (`if`/`switch`), che rendono il codice fragile e difficile da estendere.
3.  **Bassa:** La **gestione di errori generici**, che pur funzionando, potrebbe essere migliorata con classi di errore custom per aumentare la robustezza e facilitare il debugging.




---

## Autonomous Verification (Droid)
Basandomi sull'analisi dei file, ecco la **checklist operativa per il refactor**:

---

## 📋 Checklist Operativa (5 Step)

### **STEP 1: Migrare Circuit Breaker nel DI Container**
**Obiettivo:** Sostituire il singleton pattern con dependency injection

**Metriche/Controlli:**
- ✅ Verificare che `AppDependencies` in `src/dependencies.ts` includa `circuitBreaker: CircuitBreaker`
- ✅ Rimuovere `getInstance()` e singleton export da `circuitBreaker.ts`
- ✅ Verificare che non ci siano import diretti di `circuitBreaker` singleton nei moduli

**Rischi Residui:**
- ⚠️ **Breaking change**: Tutti i file che importano il singleton richiederanno aggiornamento
- ⚠️ **Migrazione stato iniziale**: Al primo avvio il circuit breaker non avrà stato (rischiabile in prod se backend sono down)

---

### **STEP 2: Aggiornare modelSelector per ricevere dipendenze**
**Obiettivo:** Iniettare `circuitBreaker` e `BackendStats` invece di usare globali

**Metriche/Controlli:**
- ✅ Le funzioni `selectOptimalBackend`, `selectParallelBackends`, `selectFallbackBackend` accettano `CircuitBreaker` come parametro
- ✅ `BackendStats` viene istanziata nel DI container e passata come dipendenza
- ✅ Verificare che tutte le funzioni esportate accettino le dipendenze necessarie
- ✅ Testare con backends simulati (OPEN/CLOSED states)

**Rischi Residui:**
- ⚠️ **Complessità firma**: Funzioni con troppi parametri (potrebbe richiedere wrapper objects)
- ⚠️ **Backward compatibility**: API esportate cambiano - aggiornare tutti i consumer

---

### **STEP 3: Aggiornare aiExecutor per usare DI**
**Obiettivo:** Passare `CircuitBreaker` e `BackendStats` tramite DI invece di import diretti

**Metriche/Controlli:**
- ✅ `executeAIClient()` accetta `circuitBreaker` da `AppDependencies`
- ✅ Aggiornare tutte le funzioni di esecuzione (Gemini, Droid, Qwen, etc.) per usare circuit breaker iniettato
- ✅ Verificare che il meccanismo di retry fallback funzioni ancora correttamente
- ✅ Testare failover con backend simulati

**Rischi Residui:**
- ⚠️ **Cascading changes**: Tutti i workflow e tools che chiamano `executeAIClient` richiedono aggiornamento
- ⚠️ **Testing complexity**: Mockare l'intera chain DI diventa più complesso

---

### **STEP 4: Aggiungere persistenza stato Circuit Breaker**
**Obiettivo:** Salvare e ripristinare lo stato del circuit breaker tra i riavvii

**Metriche/Controlli:**
- ✅ Creare tabella `circuit_breaker_state` in `activityDb` con campi: backend, state, failures, lastFailureTime
- ✅ Implementare `loadState()` in `CircuitBreaker` che legge da DB all'inizializzazione
- ✅ Implementare `saveState()` che persiste ogni transizione di stato
- ✅ Testare shutdown/restart con backend in stato OPEN/HALF_OPEN
- ✅ Verificare che lo script `reset-circuit-breaker.ts` pulisca anche il DB

**Rischi Residui:**
- ⚠️ **Race conditions**: Mentre il DB viene scritto, lo stato potrebbe cambiare (usare lock?)
- ⚠️ **Stale state**: Backend tornati online mentre server era down (timeout expiration deve essere controllato)
- ⚠️ **Performance**: Scrittura DB su ogni transizione (potrebbe essere bottleneck per chiamate frequenti)

---

### **STEP 5: Aggiungere gestione lifecycle completa**
**Obiettivo:** Garantire shutdown clean e recovery robusto

**Metriche/Controlli:**
- ✅ Aggiungere `shutdown()` method in `CircuitBreaker` che persiste lo stato finale
- ✅ Integrare `circuitBreaker.shutdown()` in `closeDependencies()`
- ✅ Aggiungere test che simulano crash e recovery (SIGTERM/SIGKILL)
- ✅ Verificare che lo stato in memoria rimane consistente con DB dopo operazioni
- ✅ Aggiungere health check endpoint che espone stato circuit breaker

**Rischi Residui:**
- ⚠️ **Data loss**: Se il processo crash prima di persistere lo stato, informazioni perdute
- ⚠️ **Zombie states**: Backend che ripristinano stato inconsistente (es. tutti OPEN senza timeout)

---

## 📊 Riepilogo Metriche

| Step | File Modificati | Nuovi Test | Breaking Changes |
|------|-----------------|------------|------------------|
| 1 | `dependencies.ts`, `circuitBreaker.ts` | 2+ | Alto |
| 2 | `workflows/modelSelector.ts` | 3+ | Alto |
| 3 | `utils/aiExecutor.ts` | 4+ | Alto |
| 4 | `circuitBreaker.ts`, `dependencies.ts` | 2+ | Basso |
| 5 | `dependencies.ts`, `circuitBreaker.ts`, `server.ts` | 3+ | Basso |

## ⚠️ Rischi Complessivi

1. **Cascading Breaking Changes**: Tutti i workflow e tools che usano `modelSelector` o `aiExecutor` richiedono aggiornamento massivo
2. **Testing Gap**: Unit tests esistenti per singleton non funzioneranno più - richiede refactoring dei test
3. **Startup Time**: Caricamento stato da DB rallenta l'avvio (misurare e ottimizzare)
4. **State Consistency**: Mentre il sistema è in uso, stato in memoria e DB devono rimanere sincronizzati

---

**Nota importante:** Essendo sul branch `feat/di-lifecycle`, questo refactor sembra coerente con la direzione attuale. Considerare di creare un feature branch specifico per questo refactor per evitare conflitti.


---

## Stato Backend
- Successi: ask-gemini, ask-cursor
- Fallimenti: Nessuno

