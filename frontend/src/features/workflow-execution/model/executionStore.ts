import { create } from 'zustand';

export interface ExecutionState {
    logExecution: string[];
    setLogExecution: (logExecution: string[]) => void;
    runningNodeIds: string[];
    completedNodeIds: string[];
    startNode: (id: string) => void;
    finishNode: (id: string) => void;
    resetExecution: () => void;
    completeAll: (ids: string[]) => void;
}

export const useExecutionStore = create<ExecutionState>((set, get) => ({
    logExecution: [],
    setLogExecution: (logExecution: string[]) => set({ logExecution }),
    runningNodeIds: [],
    completedNodeIds: [],
    startNode: (id: string) => {
        const running = new Set(get().runningNodeIds); running.add(id);
        const completed = new Set(get().completedNodeIds); completed.delete(id);
        set({ runningNodeIds: Array.from(running), completedNodeIds: Array.from(completed) });
    },
    finishNode: (id: string) => {
        const running = new Set(get().runningNodeIds); running.delete(id);
        const completed = new Set(get().completedNodeIds); completed.add(id);
        set({ runningNodeIds: Array.from(running), completedNodeIds: Array.from(completed) });
    },
    resetExecution: () => set({ runningNodeIds: [], completedNodeIds: [] }),
    completeAll: (ids: string[]) => {
        const unique = Array.from(new Set(ids));
        set({ runningNodeIds: [], completedNodeIds: unique });
    },
}));
