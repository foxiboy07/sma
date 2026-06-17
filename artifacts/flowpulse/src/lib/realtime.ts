import { supabase } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Realtime channel manager - handles all subscriptions
class RealtimeManager {
  private channels: Map<string, RealtimeChannel> = new Map();
  private userId: string | null = null;

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  // Subscribe to new messages in a conversation
  subscribeToConversation(
    conversationId: string,
    onMessage: (message: any) => void
  ): () => void {
    const channelName = `conversation:${conversationId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessage(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          onMessage({ ...payload.new, _update: true });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to all conversations for a tenant (inbox updates)
  subscribeToConversations(
    tenantId: string,
    onUpdate: (conversation: any) => void
  ): () => void {
    const channelName = `conversations:${tenantId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          onUpdate({ ...payload.new, _event: payload.event });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to notifications for a user
  subscribeToNotifications(
    tenantId: string,
    userId: string | undefined,
    onNotification: (notification: any) => void
  ): () => void {
    const channelName = `notifications:${tenantId}:${userId || 'all'}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    let filter = `tenant_id=eq.${tenantId}`;
    if (userId) {
      filter += `,user_id=eq.${userId}`;
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter,
        },
        (payload) => {
          onNotification(payload.new);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to flow updates (for collaboration)
  subscribeToFlow(
    flowId: string,
    onNodeUpdate: (node: any) => void,
    onEdgeUpdate: (edge: any) => void
  ): () => void {
    const channelName = `flow:${flowId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flow_nodes',
          filter: `flow_id=eq.${flowId}`,
        },
        (payload) => {
          onNodeUpdate({ ...payload.new, _event: payload.event });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'flow_edges',
          filter: `flow_id=eq.${flowId}`,
        },
        (payload) => {
          onEdgeUpdate({ ...payload.new, _event: payload.event });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to contact updates
  subscribeToContacts(
    tenantId: string,
    onUpdate: (contact: any) => void
  ): () => void {
    const channelName = `contacts:${tenantId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'unified_contacts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          onUpdate({ ...payload.new, _event: payload.event });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to connected account health changes
  subscribeToAccountHealth(
    tenantId: string,
    onUpdate: (account: any) => void
  ): () => void {
    const channelName = `accounts:${tenantId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connected_accounts',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          onUpdate(payload.new);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to DLQ changes
  subscribeToDLQ(
    tenantId: string,
    onUpdate: (message: any) => void
  ): () => void {
    const channelName = `dlq:${tenantId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dlq_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          onUpdate({ ...payload.new, _event: 'INSERT' });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dlq_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          onUpdate({ ...payload.new, _event: 'UPDATE' });
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Subscribe to typing indicators (presence)
  subscribeToTyping(
    conversationId: string,
    onTyping: (userId: string, isTyping: boolean) => void
  ): () => void {
    const channelName = `typing:${conversationId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        Object.entries(state).forEach(([key, presences]: [string, any]) => {
          if (presences[0]?.typing) {
            onTyping(key, true);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        onTyping(key, false);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && this.userId) {
          await channel.track({ user_id: this.userId, typing: false });
        }
      });

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Update typing status
  async setTyping(conversationId: string, isTyping: boolean) {
    const channelName = `typing:${conversationId}`;
    const channel = this.channels.get(channelName);
    if (channel && this.userId) {
      await channel.track({ user_id: this.userId, typing: isTyping });
    }
  }

  // Broadcast cursor position for flow collaboration
  async broadcastCursor(flowId: string, position: { x: number; y: number }) {
    const channelName = `flow-cursors:${flowId}`;
    let channel = this.channels.get(channelName);

    if (!channel) {
      channel = supabase.channel(channelName);
      this.channels.set(channelName, channel);
      await channel.subscribe();
    }

    if (this.userId) {
      await channel.send({
        type: 'broadcast',
        event: 'cursor_move',
        payload: { user_id: this.userId, position },
      });
    }
  }

  // Subscribe to cursor movements
  subscribeToCursors(
    flowId: string,
    onCursor: (userId: string, position: { x: number; y: number }) => void
  ): () => void {
    const channelName = `flow-cursors:${flowId}`;

    if (this.channels.has(channelName)) {
      return () => this.unsubscribe(channelName);
    }

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'cursor_move' }, (payload) => {
        onCursor(payload.payload.user_id, payload.payload.position);
      })
      .subscribe();

    this.channels.set(channelName, channel);
    return () => this.unsubscribe(channelName);
  }

  // Unsubscribe from a specific channel
  private unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  // Get channel status
  getChannelStatus(channelName: string): string | null {
    const channel = this.channels.get(channelName);
    return channel ? channel.state : null;
  }
}

// Export singleton
export const realtimeManager = new RealtimeManager();
