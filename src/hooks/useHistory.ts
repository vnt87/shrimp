import { useCallback, useReducer } from 'react'

interface HistoryState<T> {
    past: T[]
    present: T
    future: T[]
}

type HistoryAction<T> =
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET', newPresent: T | ((prev: T) => T) }
    | { type: 'REPLACE', newPresent: T | ((prev: T) => T) }
    | { type: 'CLEAR', initialPresent: T }

const initialState = <T>(initialPresent: T): HistoryState<T> => ({
    past: [],
    present: initialPresent,
    future: [],
})

function historyReducer<T>(state: HistoryState<T>, action: HistoryAction<T>): HistoryState<T> {
    const { past, present, future } = state

    switch (action.type) {
        case 'UNDO':
            if (past.length === 0) return state
            const previous = past[past.length - 1]
            const newPast = past.slice(0, past.length - 1)
            return {
                past: newPast,
                present: previous,
                future: [present, ...future],
            }
        case 'REDO':
            if (future.length === 0) return state
            const next = future[0]
            const newFuture = future.slice(1)
            return {
                past: [...past, present],
                present: next,
                future: newFuture,
            }
        case 'SET':
            const nextPresent = action.newPresent instanceof Function
                ? (action.newPresent as (prev: T) => T)(present)
                : action.newPresent

            if (nextPresent === present) return state
            return {
                past: [...past, present],
                present: nextPresent,
                future: [],
            }
        case 'REPLACE':
            const replacedPresent = action.newPresent instanceof Function
                ? (action.newPresent as (prev: T) => T)(present)
                : action.newPresent

            if (replacedPresent === present) return state
            return {
                ...state,
                present: replacedPresent,
            }
        case 'CLEAR':
            return initialState(action.initialPresent)
        default:
            return state
    }
}

export function useHistory<T>(initialPresent: T) {
    const [state, dispatch] = useReducer(historyReducer<T>, initialState(initialPresent))

    const canUndo = state.past.length > 0
    const canRedo = state.future.length > 0

    const undo = useCallback(() => dispatch({ type: 'UNDO' }), [])
    const redo = useCallback(() => dispatch({ type: 'REDO' }), [])
    const set = useCallback((newPresent: T | ((prev: T) => T)) => dispatch({ type: 'SET', newPresent }), [])
    const replace = useCallback((newPresent: T | ((prev: T) => T)) => dispatch({ type: 'REPLACE', newPresent }), [])
    const clear = useCallback((initialPresent: T) => dispatch({ type: 'CLEAR', initialPresent }), [])

    return {
        state: state.present,
        set,
        undo,
        redo,
        replace,
        clear,
        canUndo,
        canRedo,
        historyState: state // Expose full state for debugging/advanced usage
    }
}
