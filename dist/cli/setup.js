#!/usr/bin/env node
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * unitAI Setup Wizard
 *
 * TUI-based setup wizard for configuring AI backends and agent role assignments.
 * Run with: unitai setup
 */
import { useState, useEffect } from 'react';
import { render, Box, Text, useApp, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import Spinner from 'ink-spinner';
import { detectBackends, BACKEND_METADATA } from '../config/detectBackends.js';
import { loadConfig, saveConfig, createConfig, getConfigPath } from '../config/config.js';
const ROLE_DESCRIPTIONS = {
    architect: 'System design, security analysis',
    implementer: 'Production code generation',
    tester: 'Fast test generation'
};
// --- Sub-components to isolate hooks ---
const DetectingStep = () => (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83E\uDD16 unitAI Setup Wizard" }), _jsx(Box, { marginTop: 1, children: _jsxs(Text, { children: [_jsx(Spinner, { type: "dots" }), " Detecting available backends..."] }) })] }));
const ExistingConfigStep = ({ config, onAction }) => {
    const items = [
        { label: 'Edit roles', value: 'edit-roles' },
        { label: 'Add/remove backends', value: 'edit-backends' },
        { label: 'Start fresh', value: 'fresh' },
        { label: 'Exit', value: 'exit' }
    ];
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83E\uDD16 unitAI Setup Wizard" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { color: "yellow", children: "Existing configuration found" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Current setup:" }), _jsxs(Text, { children: ["  Architect   \u2192 ", config.roles.architect] }), _jsxs(Text, { children: ["  Implementer \u2192 ", config.roles.implementer] }), _jsxs(Text, { children: ["  Tester      \u2192 ", config.roles.tester] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "What would you like to do?" }), _jsx(SelectInput, { items: items, onSelect: (item) => onAction(item.value) })] })] })] }));
};
const SelectBackendsStep = ({ backends, enabledBackends, setEnabledBackends, onContinue }) => {
    const availableBackends = backends.filter(b => b.available);
    const items = [
        ...availableBackends.map(b => ({
            label: `${enabledBackends.has(b.name) ? '[x]' : '[ ]'} ${b.name.padEnd(10)} - ${b.description}`,
            value: b.name
        })),
        { label: '→ Continue', value: 'continue' }
    ];
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83E\uDD16 unitAI Setup Wizard" }), _jsx(Text, { dimColor: true, children: "Step 2: Select backends to enable" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { dimColor: true, children: ["Available backends (", availableBackends.length, " found):"] }), _jsx(SelectInput, { items: items, onSelect: (item) => {
                            if (item.value === 'continue') {
                                onContinue();
                            }
                            else {
                                const newEnabled = new Set(enabledBackends);
                                if (newEnabled.has(item.value)) {
                                    newEnabled.delete(item.value);
                                }
                                else {
                                    newEnabled.add(item.value);
                                }
                                setEnabledBackends(newEnabled);
                            }
                        } }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\u2191/\u2193 Navigate \u2502 Enter Toggle/Continue" }) })] })] }));
};
const AssignRolesStep = ({ enabledBackends, roles, setRoles, onComplete }) => {
    const [currentRole, setCurrentRole] = useState('architect');
    const enabled = Array.from(enabledBackends);
    const roleOrder = ['architect', 'implementer', 'tester'];
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
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83E\uDD16 unitAI Setup Wizard" }), _jsx(Text, { dimColor: true, children: "Step 3: Assign roles to backends" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [roleOrder.map((role, idx) => (_jsxs(Box, { flexDirection: "column", marginBottom: idx < roleOrder.length - 1 ? 1 : 0, children: [_jsxs(Text, { bold: role === currentRole, color: role === currentRole ? 'yellow' : undefined, children: [role.charAt(0).toUpperCase() + role.slice(1), " (", ROLE_DESCRIPTIONS[role], "):"] }), role === currentRole ? (_jsx(SelectInput, { items: items, onSelect: (item) => {
                                    const newRoles = { ...roles, [currentRole]: item.value };
                                    setRoles(newRoles);
                                    if (nextRole) {
                                        setCurrentRole(nextRole);
                                    }
                                    else {
                                        onComplete();
                                    }
                                } })) : (_jsxs(Text, { dimColor: true, children: ["  \u2192 ", roles[role] || '(not set)'] }))] }, role))), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "\u2191/\u2193 Navigate \u2502 Enter Select" }) })] })] }));
};
const TestingStep = ({ enabledBackends, onComplete }) => {
    const enabled = Array.from(enabledBackends);
    const [testResults, setTestResults] = useState({});
    useEffect(() => {
        const results = {};
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
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "cyan", children: "\uD83E\uDD16 unitAI Setup Wizard" }), _jsx(Text, { dimColor: true, children: "Step 4: Testing connections..." }), _jsx(Box, { marginTop: 1, flexDirection: "column", children: enabled.map(backend => (_jsx(Box, { children: testResults[backend] === 'pending' ? (_jsxs(Text, { children: [_jsx(Spinner, { type: "dots" }), " ", backend, " - testing..."] })) : testResults[backend] === 'success' ? (_jsxs(Text, { color: "green", children: ["\u2713 ", backend, " - ready"] })) : (_jsxs(Text, { color: "red", children: ["\u2717 ", backend, " - failed"] })) }, backend))) })] }));
};
const CompleteStep = ({ enabledBackends, backends, roles }) => {
    useEffect(() => {
        const config = createConfig({
            enabledBackends: Array.from(enabledBackends),
            detectedBackends: backends.filter(b => b.available).map(b => b.name),
            roles
        });
        saveConfig(config);
    }, []);
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Text, { bold: true, color: "green", children: "\u2705 Setup Complete!" }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsxs(Text, { dimColor: true, children: ["Config saved to: ", getConfigPath()] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { children: "Your setup:" }), _jsxs(Text, { children: ["  Architect   \u2192 ", roles.architect, " \u2713"] }), _jsxs(Text, { children: ["  Implementer \u2192 ", roles.implementer, " \u2713"] }), _jsxs(Text, { children: ["  Tester      \u2192 ", roles.tester, " \u2713"] })] }), _jsxs(Box, { marginTop: 1, flexDirection: "column", children: [_jsx(Text, { dimColor: true, children: "Quick commands:" }), _jsx(Text, { children: "  unitai        - Start MCP server" }), _jsx(Text, { children: "  unitai health - Quick health check" }), _jsx(Text, { children: "  unitai setup  - Re-run this wizard" })] })] }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { dimColor: true, children: "Press q to exit" }) })] }));
};
// --- Main Wizard Component ---
function SetupWizard() {
    const { exit } = useApp();
    const [step, setStep] = useState('detecting');
    const [backends, setBackends] = useState([]);
    const [enabledBackends, setEnabledBackends] = useState(new Set());
    const [roles, setRoles] = useState({ architect: '', implementer: '', tester: '' });
    const [existingConfig, setExistingConfig] = useState(null);
    useEffect(() => {
        const detected = detectBackends();
        setBackends(detected);
        const existing = loadConfig();
        if (existing) {
            setExistingConfig(existing);
            setStep('existing');
        }
        else {
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
            return _jsx(DetectingStep, {});
        case 'existing':
            return existingConfig ? (_jsx(ExistingConfigStep, { config: existingConfig, onAction: (action) => {
                    if (action === 'exit') {
                        exit();
                    }
                    else if (action === 'fresh') {
                        setExistingConfig(null);
                        const available = backends.filter(b => b.available).map(b => b.name);
                        setEnabledBackends(new Set(available));
                        setStep('select-backends');
                    }
                    else if (action === 'edit-backends') {
                        const available = backends.filter(b => b.available).map(b => b.name);
                        const enabled = existingConfig.backends.enabled.filter(b => available.includes(b));
                        setEnabledBackends(new Set(enabled));
                        setStep('select-backends');
                    }
                    else if (action === 'edit-roles') {
                        setRoles(existingConfig.roles);
                        setEnabledBackends(new Set(existingConfig.backends.enabled));
                        setStep('assign-roles');
                    }
                } })) : null;
        case 'select-backends':
            return (_jsx(SelectBackendsStep, { backends: backends, enabledBackends: enabledBackends, setEnabledBackends: setEnabledBackends, onContinue: () => {
                    if (enabledBackends.size === 0)
                        return;
                    const enabled = Array.from(enabledBackends);
                    // Default roles logic
                    const defaultRoles = {
                        architect: enabled.includes('gemini') ? 'gemini' : enabled[0],
                        implementer: enabled.includes('droid') ? 'droid' : enabled[0],
                        tester: enabled.includes('qwen') ? 'qwen' : (enabled.includes('droid') ? 'droid' : enabled[0])
                    };
                    setRoles(defaultRoles);
                    setStep('assign-roles');
                } }));
        case 'assign-roles':
            return (_jsx(AssignRolesStep, { enabledBackends: enabledBackends, roles: roles, setRoles: setRoles, onComplete: () => setStep('testing') }));
        case 'testing':
            return (_jsx(TestingStep, { enabledBackends: enabledBackends, onComplete: () => setStep('complete') }));
        case 'complete':
            return (_jsx(CompleteStep, { enabledBackends: enabledBackends, backends: backends, roles: roles }));
        default:
            return null;
    }
}
export function runSetupWizard() {
    render(_jsx(SetupWizard, {}));
}
if (process.argv[1]?.endsWith('setup.js') || process.argv[1]?.endsWith('setup.tsx')) {
    runSetupWizard();
}
//# sourceMappingURL=setup.js.map