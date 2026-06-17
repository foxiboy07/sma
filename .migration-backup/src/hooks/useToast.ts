import { useState, useCallback } from 'react';
import { Toast } from '../types';

let toastCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(++toastCounter);
    const newToast: Toast = { ...toast, id };
    setToasts(prev => [...prev.slice(-2), newToast]);

    const duration = toast.duration ?? (toast.type === 'error' ? 8000 : toast.type === 'success' ? 4000 : 5000);
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const show = useCallback((options: { type: Toast['type']; title: string; description?: string; duration?: number }) => {
    return addToast(options);
  }, [addToast]);

  const toast = {
    success: (title: string, description?: string) => addToast({ type: 'success', title, description }),
    error: (title: string, description?: string) => addToast({ type: 'error', title, description }),
    warning: (title: string, description?: string) => addToast({ type: 'warning', title, description }),
    info: (title: string, description?: string) => addToast({ type: 'info', title, description }),
  };

  return { toasts, toast, show, removeToast };
}
