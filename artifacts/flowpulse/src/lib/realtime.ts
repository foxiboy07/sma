// Real-time subscriptions removed (Supabase replaced with Express backend).
// Subscriptions can be re-implemented via WebSockets or polling in a future iteration.

class RealtimeManager {
  setUserId(_userId: string | null) {}

  subscribeToConversation(_conversationId: string, _onMessage: (msg: any) => void): () => void {
    return () => {};
  }

  subscribeToConversations(_tenantId: string, _onUpdate: (conv: any) => void): () => void {
    return () => {};
  }

  subscribeToNotifications(_tenantId: string, _userId: string | undefined, _onNotification: (n: any) => void): () => void {
    return () => {};
  }

  subscribeToFlow(_flowId: string, _onNodeUpdate: (n: any) => void, _onEdgeUpdate: (e: any) => void): () => void {
    return () => {};
  }

  subscribeToContacts(_tenantId: string, _onUpdate: (c: any) => void): () => void {
    return () => {};
  }

  subscribeToAccountHealth(_tenantId: string, _onUpdate: (a: any) => void): () => void {
    return () => {};
  }

  subscribeToDLQ(_tenantId: string, _onUpdate: (m: any) => void): () => void {
    return () => {};
  }

  subscribeToTyping(_conversationId: string, _onTyping: (userId: string, isTyping: boolean) => void): () => void {
    return () => {};
  }

  async setTyping(_conversationId: string, _isTyping: boolean): Promise<void> {}

  async broadcastCursor(_flowId: string, _position: { x: number; y: number }): Promise<void> {}

  subscribeToCursors(_flowId: string, _onCursor: (userId: string, position: { x: number; y: number }) => void): () => void {
    return () => {};
  }

  unsubscribeAll() {}

  getChannelStatus(_channelName: string): string | null {
    return null;
  }
}

export const realtimeManager = new RealtimeManager();
