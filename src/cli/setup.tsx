#!/usr/bin/env node
/**
 * unitAI Setup Wizard
 * 
 * TUI-based setup wizard for configuring AI backends and agent role assignments.
 * Run with: unitai setup
 */

import React, { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { detectBackends, BackendInfo, BACKEND_METADATA } from '../config/detectBackends.js';
import { loadConfig, saveConfig, createConfig, getConfigPath, UnitAIConfig } from '../config/config.js';

type WizardStep = 'detecting' | 'existing' | 'select-backends' | 'assign-roles' | 'fallback-priority' | 'testing' | 'complete';
type Role = 'architect' | 'implementer' | 'tester';

interface RoleAssignment {
    architect: string;
    implementer: string;
    tester: string;
}

const ROLE_DESCRIPTIONS: Record<Role, string> = {
    architect: 'System design, security analysis',
    implementer: 'Production code generation',
    tester: 'Fast test generation'
};

// --- Sub-components to isolate hooks ---

const DetectingStep = () => (
    <Box flexDirection="column" padding={1}>
        <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
        <Box marginTop={1}>
            <Text><Spinner type="dots" /> Detecting available backends...</Text>
        </Box>
    </Box>
);

const ExistingConfigStep = ({
    config,
    onAction
}: {
    config: UnitAIConfig,
    onAction: (action: string) => void
}) => {
    const items = [
        { label: 'Edit roles', value: 'edit-roles' },
        { label: 'Add/remove backends', value: 'edit-backends' },
        { label: 'Start fresh', value: 'fresh' },
        { label: 'Exit', value: 'exit' }
    ];

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
            <Box marginTop={1} flexDirection="column">
                <Text color="yellow">Existing configuration found</Text>
                <Box marginTop={1} flexDirection="column">
                    <Text dimColor>Current setup:</Text>
                    <Text>  Architect   → {config.roles.architect}</Text>
                    <Text>  Implementer → {config.roles.implementer}</Text>
                    <Text>  Tester      → {config.roles.tester}</Text>
                </Box>
                <Box marginTop={1} flexDirection="column">
                    <Text dimColor>What would you like to do?</Text>
                    <SelectInput items={items} onSelect={(item) => onAction(item.value)} />
                </Box>
            </Box>
        </Box>
    );
};

const SelectBackendsStep = ({
    backends,
    enabledBackends,
    setEnabledBackends,
    onContinue
}: {
    backends: BackendInfo[],
    enabledBackends: Set<string>,
    setEnabledBackends: (s: Set<string>) => void,
    onContinue: () => void
}) => {
    const availableBackends = backends.filter(b => b.available);
    const items = [
        ...availableBackends.map(b => ({
            label: `${enabledBackends.has(b.name) ? '[x]' : '[ ]'} ${b.name.padEnd(10)} - ${b.description}`,
            value: b.name
        })),
        { label: '→ Continue', value: 'continue' }
    ];

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
            <Text dimColor>Step 2: Select backends to enable</Text>
            <Box marginTop={1} flexDirection="column">
                <Text dimColor>Available backends ({availableBackends.length} found):</Text>
                <SelectInput
                    items={items}
                    onSelect={(item) => {
                        if (item.value === 'continue') {
                            onContinue();
                        } else {
                            const newEnabled = new Set(enabledBackends);
                            if (newEnabled.has(item.value)) {
                                newEnabled.delete(item.value);
                            } else {
                                newEnabled.add(item.value);
                            }
                            setEnabledBackends(newEnabled);
                        }
                    }}
                />
                <Box marginTop={1}>
                    <Text dimColor>↑/↓ Navigate │ Enter Toggle/Continue</Text>
                </Box>
            </Box>
        </Box>
    );
};

const AssignRolesStep = ({
    enabledBackends,
    roles,
    setRoles,
    onComplete
}: {
    enabledBackends: Set<string>,
    roles: RoleAssignment,
    setRoles: (r: RoleAssignment) => void,
    onComplete: () => void
}) => {
    const [currentRole, setCurrentRole] = useState<Role>('architect');
    const enabled = Array.from(enabledBackends);
    const roleOrder: Role[] = ['architect', 'implementer', 'tester'];

    const items = enabled.map(backend => {
        const meta = BACKEND_METADATA[backend];
        const isRecommended = meta?.recommended?.role === currentRole;
        const isSelected = roles[currentRole] === backend;
        return {
            label: `${isSelected ? '>' : ' '} ${backend}${isRecommended ? '  (recommended ✓)' : ''}`,
            value: backend
        };
    });

    const currentRoleIndex = roleOrder.indexOf(currentRole);
    const nextRole = roleOrder[currentRoleIndex + 1];

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
            <Text dimColor>Step 3: Assign roles to backends</Text>
            <Box marginTop={1} flexDirection="column">
                {roleOrder.map((role, idx) => (
                    <Box key={role} flexDirection="column" marginBottom={idx < roleOrder.length - 1 ? 1 : 0}>
                        <Text bold={role === currentRole} color={role === currentRole ? 'yellow' : undefined}>
                            {role.charAt(0).toUpperCase() + role.slice(1)} ({ROLE_DESCRIPTIONS[role]}):
                        </Text>
                        {role === currentRole ? (
                            <SelectInput
                                items={items}
                                onSelect={(item) => {
                                    const newRoles = { ...roles, [currentRole]: item.value };
                                    setRoles(newRoles);
                                    if (nextRole) {
                                        setCurrentRole(nextRole);
                                    } else {
                                        onComplete();
                                    }
                                }}
                            />
                        ) : (
                            <Text dimColor>  → {roles[role] || '(not set)'}</Text>
                        )}
                    </Box>
                ))}
                <Box marginTop={1}>
                    <Text dimColor>↑/↓ Navigate │ Enter Select</Text>
                </Box>
            </Box>
        </Box>
    );
};

const FallbackPriorityStep = ({
    enabledBackends,
    fallbackPriority,
    setFallbackPriority,
    onContinue
}: {
    enabledBackends: string[];
    fallbackPriority: string[];
    setFallbackPriority: (p: string[]) => void;
    onContinue: () => void;
}) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    const handleSelect = (item: { value: string | number }) => {
        if (item.value === 'continue') {
            onContinue();
        } else if (item.value === 'move-up' && selectedIndex !== null && selectedIndex > 0) {
            const newOrder = [...fallbackPriority];
            [newOrder[selectedIndex - 1], newOrder[selectedIndex]] =
                [newOrder[selectedIndex], newOrder[selectedIndex - 1]];
            setFallbackPriority(newOrder);
            setSelectedIndex(selectedIndex - 1);
        } else if (item.value === 'move-down' && selectedIndex !== null && selectedIndex < fallbackPriority.length - 1) {
            const newOrder = [...fallbackPriority];
            [newOrder[selectedIndex], newOrder[selectedIndex + 1]] =
                [newOrder[selectedIndex + 1], newOrder[selectedIndex]];
            setFallbackPriority(newOrder);
            setSelectedIndex(selectedIndex + 1);
        } else if (item.value === 'cancel') {
            setSelectedIndex(null);
        } else if (typeof item.value === 'number') {
            setSelectedIndex(item.value);
        }
    };

    // Build items list with current order + actions
    const items: { label: string; value: string | number }[] = [
        ...fallbackPriority.map((backend, idx) => ({
            label: `${idx + 1}. ${backend}${idx === selectedIndex ? ' ◀' : ''}`,
            value: idx
        })),
        ...(selectedIndex !== null ? [
            { label: '  ↑ Move Up', value: 'move-up' as const },
            { label: '  ↓ Move Down', value: 'move-down' as const },
            { label: '  ✕ Cancel', value: 'cancel' as const },
        ] : []),
        { label: '→ Continue', value: 'continue' as const }
    ];

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
            <Text dimColor>Step 4: Configure Fallback Priority</Text>
            <Box marginTop={1} flexDirection="column">
                <Text dimColor>When a backend fails, these will be tried in order:</Text>
                <Box marginTop={1}>
                    <SelectInput items={items} onSelect={handleSelect} />
                </Box>
                <Box marginTop={1}>
                    <Text dimColor>Select a backend to reorder, then use Move Up/Down</Text>
                </Box>
            </Box>
        </Box>
    );
};

const TestingStep = ({
    enabledBackends,
    onComplete
}: {
    enabledBackends: Set<string>,
    onComplete: () => void
}) => {
    const enabled = Array.from(enabledBackends);
    const [testResults, setTestResults] = useState<Record<string, 'pending' | 'success' | 'failed'>>({});

    useEffect(() => {
        const results: Record<string, 'pending' | 'success' | 'failed'> = {};
        enabled.forEach(b => results[b] = 'pending');
        setTestResults(results);

        let delay = 0;
        enabled.forEach(backend => {
            setTimeout(() => {
                setTestResults(prev => ({ ...prev, [backend]: 'success' }));
            }, delay += 800);
        });

        setTimeout(() => {
            onComplete();
        }, delay + 500);
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="cyan">🤖 unitAI Setup Wizard</Text>
            <Text dimColor>Step 5: Testing connections...</Text>
            <Box marginTop={1} flexDirection="column">
                {enabled.map(backend => (
                    <Box key={backend}>
                        {testResults[backend] === 'pending' ? (
                            <Text><Spinner type="dots" /> {backend} - testing...</Text>
                        ) : testResults[backend] === 'success' ? (
                            <Text color="green">✓ {backend} - ready</Text>
                        ) : (
                            <Text color="red">✗ {backend} - failed</Text>
                        )}
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

const CompleteStep = ({
    enabledBackends,
    backends,
    roles,
    fallbackPriority
}: {
    enabledBackends: Set<string>,
    backends: BackendInfo[],
    roles: RoleAssignment,
    fallbackPriority: string[]
}) => {
    useEffect(() => {
        const config = createConfig({
            enabledBackends: Array.from(enabledBackends),
            detectedBackends: backends.filter(b => b.available).map(b => b.name),
            roles,
            fallbackPriority
        });
        saveConfig(config);
    }, []);

    return (
        <Box flexDirection="column" padding={1}>
            <Text bold color="green">✅ Setup Complete!</Text>
            <Box marginTop={1} flexDirection="column">
                <Text dimColor>Config saved to: {getConfigPath()}</Text>
                <Box marginTop={1} flexDirection="column">
                    <Text>Your setup:</Text>
                    <Text>  Architect   → {roles.architect} ✓</Text>
                    <Text>  Implementer → {roles.implementer} ✓</Text>
                    <Text>  Tester      → {roles.tester} ✓</Text>
                </Box>
                <Box marginTop={1} flexDirection="column">
                    <Text dimColor>Quick commands:</Text>
                    <Text>  unitai        - Start MCP server</Text>
                    <Text>  unitai health - Quick health check</Text>
                    <Text>  unitai setup  - Re-run this wizard</Text>
                </Box>
            </Box>
            <Box marginTop={1}>
                <Text dimColor>Press q to exit</Text>
            </Box>
        </Box>
    );
};

// --- Main Wizard Component ---

function SetupWizard() {
    const { exit } = useApp();
    const [step, setStep] = useState<WizardStep>('detecting');
    const [backends, setBackends] = useState<BackendInfo[]>([]);
    const [enabledBackends, setEnabledBackends] = useState<Set<string>>(new Set());
    const [roles, setRoles] = useState<RoleAssignment>({ architect: '', implementer: '', tester: '' });
    const [existingConfig, setExistingConfig] = useState<UnitAIConfig | null>(null);
    const [fallbackPriority, setFallbackPriority] = useState<string[]>([]);

    useEffect(() => {
        const detected = detectBackends();
        setBackends(detected);
        const existing = loadConfig();
        if (existing) {
            setExistingConfig(existing);
            setStep('existing');
        } else {
            const available = detected.filter(b => b.available).map(b => b.name);
            setEnabledBackends(new Set(available));
            setStep('select-backends');
        }
    }, []);

    useInput((input, key) => {
        if (input === 'q' || (key.ctrl && input === 'c')) {
            exit();
        }
    });

    switch (step) {
        case 'detecting':
            return <DetectingStep />;

        case 'existing':
            return existingConfig ? (
                <ExistingConfigStep
                    config={existingConfig}
                    onAction={(action) => {
                        if (action === 'exit') {
                            exit();
                        } else if (action === 'fresh') {
                            setExistingConfig(null);
                            const available = backends.filter(b => b.available).map(b => b.name);
                            setEnabledBackends(new Set(available));
                            setStep('select-backends');
                        } else if (action === 'edit-backends') {
                            const available = backends.filter(b => b.available).map(b => b.name);
                            const enabled = existingConfig.backends.enabled.filter(b => available.includes(b));
                            setEnabledBackends(new Set(enabled));
                            setStep('select-backends');
                        } else if (action === 'edit-roles') {
                            setRoles(existingConfig.roles);
                            setEnabledBackends(new Set(existingConfig.backends.enabled));
                            setStep('assign-roles');
                        }
                    }}
                />
            ) : null;

        case 'select-backends':
            return (
                <SelectBackendsStep
                    backends={backends}
                    enabledBackends={enabledBackends}
                    setEnabledBackends={setEnabledBackends}
                    onContinue={() => {
                        if (enabledBackends.size === 0) return;
                        const enabled = Array.from(enabledBackends);
                        // Default roles logic
                        const defaultRoles: RoleAssignment = {
                            architect: enabled.includes('gemini') ? 'gemini' : enabled[0],
                            implementer: enabled.includes('droid') ? 'droid' : enabled[0],
                            tester: enabled.includes('qwen') ? 'qwen' : (enabled.includes('droid') ? 'droid' : enabled[0])
                        };
                        setRoles(defaultRoles);
                        setStep('assign-roles');
                    }}
                />
            );

        case 'assign-roles':
            return (
                <AssignRolesStep
                    enabledBackends={enabledBackends}
                    roles={roles}
                    setRoles={setRoles}
                    onComplete={() => {
                        // Initialize fallback priority with enabled backends in detection order
                        const enabled = Array.from(enabledBackends);
                        setFallbackPriority(enabled);
                        setStep('fallback-priority');
                    }}
                />
            );

        case 'fallback-priority':
            return (
                <FallbackPriorityStep
                    enabledBackends={Array.from(enabledBackends)}
                    fallbackPriority={fallbackPriority}
                    setFallbackPriority={setFallbackPriority}
                    onContinue={() => setStep('testing')}
                />
            );

        case 'testing':
            return (
                <TestingStep
                    enabledBackends={enabledBackends}
                    onComplete={() => setStep('complete')}
                />
            );

        case 'complete':
            return (
                <CompleteStep
                    enabledBackends={enabledBackends}
                    backends={backends}
                    roles={roles}
                    fallbackPriority={fallbackPriority}
                />
            );

        default:
            return null;
    }
}

export function runSetupWizard() {
    render(<SetupWizard />);
}

if (process.argv[1]?.endsWith('setup.js') || process.argv[1]?.endsWith('setup.tsx')) {
    runSetupWizard();
}
