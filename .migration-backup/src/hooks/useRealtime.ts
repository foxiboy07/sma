import { useEffect, useRef, useCallback } from 'react';
import { realtimeManager } from '../lib/realtime';
import { useAuth } from './useAuth';
import { useToast } from './useToast';

// Subscribe to a specific conversation's messages
export function useConversationRealtime(
  conversationId: string | null,
  onNewMessage: (message: any) => void
) {
  const { user } = useAuth();

  useEffect(() => {
    if (!conversationId || !user) return;

    const unsubscribe = realtimeManager.subscribeToConversation(
      conversationId,
      (message) => {
        onNewMessage(message);
      }
    );

    return () => unsubscribe();
  }, [conversationId, user?.id, onNewMessage]);
}

// Subscribe to all conversations for the inbox
export function useConversationsRealtime(
  tenantId: string | null,
  onConversationUpdate: (conversation: any) => void
) {
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = realtimeManager.subscribeToConversations(
      tenantId,
      onConversationUpdate
    );

    return () => unsubscribe();
  }, [tenantId, onConversationUpdate]);
}

// Subscribe to notifications with toast popups
export function useNotificationsRealtime(
  tenantId: string | null,
  userId: string | undefined,
  onNotification?: (notification: any) => void
) {
  const toast = useToast();

  useEffect(() => {
    if (!tenantId) return;

    realtimeManager.setUserId(userId || null);

    const unsubscribe = realtimeManager.subscribeToNotifications(
      tenantId,
      userId,
      (notification) => {
        // Show toast for new notifications
        if (notification.title) {
          toast.show({
            type: 'info',
            title: notification.title,
            description: notification.description,
            duration: 5000,
          });
        }

        // Call custom handler
        if (onNotification) {
          onNotification(notification);
        }
      }
    );

    return () => unsubscribe();
  }, [tenantId, userId, toast, onNotification]);
}

// Subscribe to flow updates for real-time collaboration
export function useFlowRealtime(
  flowId: string | null,
  onNodeUpdate: (node: any) => void,
  onEdgeUpdate: (edge: any) => void
) {
  useEffect(() => {
    if (!flowId) return;

    const unsubscribe = realtimeManager.subscribeToFlow(
      flowId,
      onNodeUpdate,
      onEdgeUpdate
    );

    return () => unsubscribe();
  }, [flowId, onNodeUpdate, onEdgeUpdate]);
}

// Subscribe to flow cursors for multiplayer editing
export function useFlowCursors(
  flowId: string | null
): [
  Map<string, { x: number; y: number; color: string }>,
  (position: { x: number; y: number }) => void
] {
  const { user } = useAuth();
  const cursors = useRef(new Map<string, { x: number; y: number; color: string }>());

  useEffect(() => {
    if (!flowId) return;

    const unsubscribe = realtimeManager.subscribeToCursors(
      flowId,
      (userId, position) => {
        cursors.current.set(userId, {
          ...position,
          color: getUserColor(userId),
        });
      }
    );

    return () => unsubscribe();
  }, [flowId]);

  const broadcastCursor = useCallback(
    (position: { x: number; y: number }) => {
      if (flowId) {
        realtimeManager.broadcastCursor(flowId, position);
      }
    },
    [flowId]
  );

  return [cursors.current, broadcastCursor];
}

// Subscribe to contact updates
export function useContactsRealtime(
  tenantId: string | null,
  onContactUpdate: (contact: any) => void
) {
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = realtimeManager.subscribeToContacts(
      tenantId,
      onContactUpdate
    );

    return () => unsubscribe();
  }, [tenantId, onContactUpdate]);
}

// Subscribe to account health changes
export function useAccountHealthRealtime(
  tenantId: string | null,
  onAccountUpdate: (account: any) => void
) {
  const toast = useToast();

  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = realtimeManager.subscribeToAccountHealth(
      tenantId,
      (account) => {
        // Show warning toast for broken accounts
        if (account.health_status === 'BROKEN') {
          toast.show({
            type: 'error',
            title: 'Account token broken',
            description: `${account.platform_username || account.platform} - flows paused`,
          });
        } else if (account.health_status === 'EXPIRING') {
          toast.show({
            type: 'warning',
            title: 'Token expiring soon',
            description: `${account.platform_username || account.platform} - renew within 72h`,
          });
        }

        onAccountUpdate(account);
      }
    );

    return () => unsubscribe();
  }, [tenantId, toast, onAccountUpdate]);
}

// Subscribe to DLQ changes
export function useDLQRealtime(
  tenantId: string | null,
  onDLQUpdate: (message: any) => void
) {
  const toast = useToast();

  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = realtimeManager.subscribeToDLQ(
      tenantId,
      (message) => {
        // Show toast for new DLQ messages
        if (message._event === 'INSERT') {
          toast.show({
            type: 'error',
            title: 'Message failed',
            description: `Message to ${message.contact_name || 'contact'} failed to deliver`,
          });
        }

        onDLQUpdate(message);
      }
    );

    return () => unsubscribe();
  }, [tenantId, toast, onDLQUpdate]);
}

// Subscribe to typing indicators
export function useTypingIndicator(
  conversationId: string | null
): [Set<string>, (isTyping: boolean) => void] {
  const { user } = useAuth();
  const typingUsers = useRef(new Set<string>());

  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = realtimeManager.subscribeToTyping(
      conversationId,
      (userId, isTyping) => {
        if (isTyping) {
          typingUsers.current.add(userId);
        } else {
          typingUsers.current.delete(userId);
        }
      }
    );

    return () => unsubscribe();
  }, [conversationId]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (conversationId) {
        realtimeManager.setTyping(conversationId, isTyping);
      }
    },
    [conversationId]
  );

  return [typingUsers.current, setTyping];
}

// Generate consistent color for user
function getUserColor(userId: string): string {
  const colors = [
    '#3B82F6', // blue
    '#22C55E', // green
    '#F59E0B', // amber
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#14B8A6', // teal
    '#F97316', // orange
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }

  return colors[Math.abs(hash) % colors.length];
}
