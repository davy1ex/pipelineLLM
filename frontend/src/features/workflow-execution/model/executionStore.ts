import { create } from 'zustand';

export interface ExecutionState {
    logExecution: string[];
    setLogExecution: (logExecution: string[]) => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
    logExecution: [],
    setLogExecution: (logExecution: string[]) => set({ logExecution }),
}));
