import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node, Edge, addEdge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, Connection, BackgroundVariant,
  NodeTypes, Handle, Position, MarkerType, useReactFlow, Viewport,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  ArrowLeft, Save, Play, Pause, Undo2, Redo2,
  AlertTriangle, CheckCircle2, X, ChevronDown, ChevronRight, Plus, Trash2,
  Zap, MessageSquare, Brain, GitBranch, Clock, RefreshCw,
  Code2, Webhook, ShoppingBag, Tag, Settings2, Variable,
  MousePointerClick, BookOpen, Layers, Share2, Link2, Hash,
  ToggleLeft, SlidersHorizontal, Send, CreditCard, Sparkles,
  CircleSlash, FlaskConical, Loader2, CheckCircle, Info,
  Instagram, Facebook, Video, Phone, Users, Wrench,
  Calendar, FileSpreadsheet, Bell, MessageCircle, AtSign,
  UserPlus, QrCode, MousePointer, ShoppingCart, Search,
  Star, Timer, Repeat, Shield, Database, Mail, TrendingUp,
  Megaphone
} from 'lucide-react';
import { Button, Badge, Toggle, Modal } from '../components/ui';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { flowEngineApi } from '../lib/api';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

type NodeCategory = 'TRIGGER' | 'MESSAGE' | 'LOGIC' | 'AI' | 'INTEGRATION';
type FlowStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED';
type SaveState = 'saved' | 'saving' | 'unsaved';

const CAT_COLORS: Record<NodeCategory, string> = {
  TRIGGER:     '#22C55E',
  MESSAGE:     '#3B82F6',
  LOGIC:       '#F59E0B',
  AI:          '#14B8A6',
  INTEGRATION: '#22C55E',
};

const NODE_CATEGORY: Record<string, NodeCategory> = {
  // Instagram Triggers
  IG_POST_COMMENT:      'TRIGGER',
  IG_STORY_REPLY:        'TRIGGER',
  IG_STORY_MENTION:      'TRIGGER',
  IG_DIRECT_MESSAGE:     'TRIGGER',
  IG_POST_SHARE:         'TRIGGER',
  IG_ADS_CLICK:         'TRIGGER',
  IG_LIVE_COMMENT:      'TRIGGER',
  IG_REFERRAL_LINK:     'TRIGGER',
  IG_KEYWORD:           'TRIGGER',
  // Facebook Triggers
  FB_POST_COMMENT:      'TRIGGER',
  FB_DIRECT_MESSAGE:    'TRIGGER',
  FB_KEYWORD:           'TRIGGER',
  FB_LEAD_AD:           'TRIGGER',
  FB_CHECKBOX_PLUGIN:   'TRIGGER',
  FB_REFERRAL:          'TRIGGER',
  // TikTok Triggers
  TT_VIDEO_COMMENT:     'TRIGGER',
  TT_DIRECT_MESSAGE:    'TRIGGER',
  TT_LIVE_COMMENT:      'TRIGGER',
  TT_KEYWORD:           'TRIGGER',
  TT_SHOP_CLICK:        'TRIGGER',
  // WhatsApp Triggers
  WA_MESSAGE:           'TRIGGER',
  WA_QR_SCAN:           'TRIGGER',
  WA_CTA_CLICK:         'TRIGGER',
  WA_TEMPLATE_REPLY:    'TRIGGER',
  // Contact Triggers
  CONTACT_CREATED:        'TRIGGER',
  CONTACT_FIELD_CHANGED:  'TRIGGER',
  CONTACT_SYSTEM_FIELD:   'TRIGGER',
  CONTACT_TAG_ADDED:      'TRIGGER',
  CONTACT_TAG_REMOVED:    'TRIGGER',
  CONTACT_SEQUENCE_SUB:   'TRIGGER',
  CONTACT_SEQUENCE_UNSUB:  'TRIGGER',
  CONTACT_SEGMENT_ENTRY:  'TRIGGER',
  CONTACT_DATETIME:       'TRIGGER',
  // System Triggers
  SYSTEM_SCHEDULED:     'TRIGGER',
  SYSTEM_WEBHOOK:       'TRIGGER',
  SYSTEM_API:           'TRIGGER',
  SYSTEM_SHOPIFY:       'TRIGGER',
  SYSTEM_STRIPE:        'TRIGGER',
  SYSTEM_ZAPIER:        'TRIGGER',
  SYSTEM_MANUAL:        'TRIGGER',
  // Legacy Triggers
  COMMENT_TO_DM:         'TRIGGER',
  STORY_MENTION:         'TRIGGER',
  STORY_REPLY:           'TRIGGER',
  FOLLOW_TO_DM:          'TRIGGER',
  SHARE_TO_DM:           'TRIGGER',
  TIKTOK_COMMENT_TO_DM:  'TRIGGER',
  DEEPLINK_BIO_CLICK:    'TRIGGER',
  MANUAL:                'TRIGGER',
  // Messages
  SEND_MESSAGE:          'MESSAGE',
  SEND_DM_CARD:          'MESSAGE',
  SEND_CAROUSEL:         'MESSAGE',
  SEND_PRODUCT:          'MESSAGE',
  SEND_TEMPLATE:         'MESSAGE',
  SEND_QUIZ:            'MESSAGE',
  TIKTOK_SHOP_PRODUCT:   'MESSAGE',
  COLLECT_INPUT:         'MESSAGE',
  // Logic
  CONDITION:             'LOGIC',
  SUPER_RANDOMIZER:      'LOGIC',
  SMART_DELAY:           'LOGIC',
  FRICTION_RECOVERY:     'LOGIC',
  // AI
  AI_STEP:               'AI',
  CUSTOM_CODE:           'AI',
  // Contact Actions
  ACTION_ADD_TAG:        'INTEGRATION',
  ACTION_REMOVE_TAG:     'INTEGRATION',
  ACTION_SET_FIELD:      'INTEGRATION',
  ACTION_INCREMENT_FIELD: 'INTEGRATION',
  ACTION_ADD_SEQUENCE:   'INTEGRATION',
  ACTION_REMOVE_SEQUENCE: 'INTEGRATION',
  ACTION_UPDATE_SEGMENT: 'INTEGRATION',
  ACTION_CLEAR_FIELD:    'INTEGRATION',
  ACTION_NOTIFY:         'INTEGRATION',
  // System Actions
  ACTION_BLOCK:          'INTEGRATION',
  OUTBOUND_WEBHOOK:      'INTEGRATION',
  ACTION_GOOGLE_SHEETS:  'INTEGRATION',
  ACTION_SHOPIFY:        'INTEGRATION',
  ACTION_STRIPE:         'INTEGRATION',
};

const NODE_COLOR = (type: string): string => {
  const cat = NODE_CATEGORY[type];
  return cat ? CAT_COLORS[cat] : '#3B82F6';
};

const NODE_ICONS: Record<string, React.ReactNode> = {
  // Instagram Triggers
  IG_POST_COMMENT:      <MessageCircle className="w-3.5 h-3.5" />,
  IG_STORY_REPLY:        <Share2 className="w-3.5 h-3.5" />,
  IG_STORY_MENTION:      <AtSign className="w-3.5 h-3.5" />,
  IG_DIRECT_MESSAGE:     <Send className="w-3.5 h-3.5" />,
  IG_POST_SHARE:         <Share2 className="w-3.5 h-3.5" />,
  IG_ADS_CLICK:         <Megaphone className="w-3.5 h-3.5" />,
  IG_LIVE_COMMENT:      <Video className="w-3.5 h-3.5" />,
  IG_REFERRAL_LINK:     <Link2 className="w-3.5 h-3.5" />,
  IG_KEYWORD:           <Search className="w-3.5 h-3.5" />,
  // Facebook Triggers
  FB_POST_COMMENT:      <MessageCircle className="w-3.5 h-3.5" />,
  FB_DIRECT_MESSAGE:    <Send className="w-3.5 h-3.5" />,
  FB_KEYWORD:           <Search className="w-3.5 h-3.5" />,
  FB_LEAD_AD:           <Database className="w-3.5 h-3.5" />,
  FB_CHECKBOX_PLUGIN:   <ToggleLeft className="w-3.5 h-3.5" />,
  FB_REFERRAL:          <Link2 className="w-3.5 h-3.5" />,
  // TikTok Triggers
  TT_VIDEO_COMMENT:     <MessageCircle className="w-3.5 h-3.5" />,
  TT_DIRECT_MESSAGE:    <Send className="w-3.5 h-3.5" />,
  TT_LIVE_COMMENT:      <Video className="w-3.5 h-3.5" />,
  TT_KEYWORD:           <Search className="w-3.5 h-3.5" />,
  TT_SHOP_CLICK:        <ShoppingBag className="w-3.5 h-3.5" />,
  // WhatsApp Triggers
  WA_MESSAGE:           <MessageCircle className="w-3.5 h-3.5" />,
  WA_QR_SCAN:           <QrCode className="w-3.5 h-3.5" />,
  WA_CTA_CLICK:         <MousePointer className="w-3.5 h-3.5" />,
  WA_TEMPLATE_REPLY:    <FileSpreadsheet className="w-3.5 h-3.5" />,
  // Contact Triggers
  CONTACT_CREATED:        <UserPlus className="w-3.5 h-3.5" />,
  CONTACT_FIELD_CHANGED:  <Variable className="w-3.5 h-3.5" />,
  CONTACT_SYSTEM_FIELD:   <Settings2 className="w-3.5 h-3.5" />,
  CONTACT_TAG_ADDED:      <Tag className="w-3.5 h-3.5" />,
  CONTACT_TAG_REMOVED:    <Tag className="w-3.5 h-3.5" />,
  CONTACT_SEQUENCE_SUB:   <Repeat className="w-3.5 h-3.5" />,
  CONTACT_SEQUENCE_UNSUB: <Repeat className="w-3.5 h-3.5" />,
  CONTACT_SEGMENT_ENTRY:  <Layers className="w-3.5 h-3.5" />,
  CONTACT_DATETIME:       <Calendar className="w-3.5 h-3.5" />,
  // System Triggers
  SYSTEM_SCHEDULED:     <Calendar className="w-3.5 h-3.5" />,
  SYSTEM_WEBHOOK:       <Webhook className="w-3.5 h-3.5" />,
  SYSTEM_API:           <Code2 className="w-3.5 h-3.5" />,
  SYSTEM_SHOPIFY:       <ShoppingCart className="w-3.5 h-3.5" />,
  SYSTEM_STRIPE:        <CreditCard className="w-3.5 h-3.5" />,
  SYSTEM_ZAPIER:        <Zap className="w-3.5 h-3.5" />,
  SYSTEM_MANUAL:        <MousePointerClick className="w-3.5 h-3.5" />,
  // Legacy triggers
  COMMENT_TO_DM:        <MessageSquare className="w-3.5 h-3.5" />,
  STORY_MENTION:        <Layers className="w-3.5 h-3.5" />,
  STORY_REPLY:          <Share2 className="w-3.5 h-3.5" />,
  FOLLOW_TO_DM:         <Zap className="w-3.5 h-3.5" />,
  SHARE_TO_DM:          <Share2 className="w-3.5 h-3.5" />,
  TIKTOK_COMMENT_TO_DM: <Hash className="w-3.5 h-3.5" />,
  DEEPLINK_BIO_CLICK:   <Link2 className="w-3.5 h-3.5" />,
  MANUAL:               <MousePointerClick className="w-3.5 h-3.5" />,
  // Actions
  SEND_MESSAGE:         <MessageSquare className="w-3.5 h-3.5" />,
  SEND_DM_CARD:         <CreditCard className="w-3.5 h-3.5" />,
  SEND_CAROUSEL:        <Layers className="w-3.5 h-3.5" />,
  SEND_PRODUCT:         <ShoppingBag className="w-3.5 h-3.5" />,
  SEND_TEMPLATE:        <FileSpreadsheet className="w-3.5 h-3.5" />,
  SEND_QUIZ:           <MessageSquare className="w-3.5 h-3.5" />,
  TIKTOK_SHOP_PRODUCT:  <ShoppingBag className="w-3.5 h-3.5" />,
  COLLECT_INPUT:        <ToggleLeft className="w-3.5 h-3.5" />,
  // Logic & AI
  CONDITION:            <GitBranch className="w-3.5 h-3.5" />,
  SUPER_RANDOMIZER:     <SlidersHorizontal className="w-3.5 h-3.5" />,
  SMART_DELAY:          <Clock className="w-3.5 h-3.5" />,
  FRICTION_RECOVERY:    <RefreshCw className="w-3.5 h-3.5" />,
  AI_STEP:              <Brain className="w-3.5 h-3.5" />,
  CUSTOM_CODE:          <Code2 className="w-3.5 h-3.5" />,
  // Contact Actions
  ACTION_ADD_TAG:       <Tag className="w-3.5 h-3.5" />,
  ACTION_REMOVE_TAG:    <Tag className="w-3.5 h-3.5" />,
  ACTION_SET_FIELD:     <Variable className="w-3.5 h-3.5" />,
  ACTION_INCREMENT_FIELD: <TrendingUp className="w-3.5 h-3.5" />,
  ACTION_ADD_SEQUENCE:  <Repeat className="w-3.5 h-3.5" />,
  ACTION_REMOVE_SEQUENCE: <Repeat className="w-3.5 h-3.5" />,
  ACTION_UPDATE_SEGMENT: <Layers className="w-3.5 h-3.5" />,
  ACTION_CLEAR_FIELD:   <X className="w-3.5 h-3.5" />,
  ACTION_NOTIFY:        <Bell className="w-3.5 h-3.5" />,
  // System Actions
  ACTION_BLOCK:         <Settings2 className="w-3.5 h-3.5" />,
  OUTBOUND_WEBHOOK:     <Webhook className="w-3.5 h-3.5" />,
  ACTION_GOOGLE_SHEETS: <FileSpreadsheet className="w-3.5 h-3.5" />,
  ACTION_SHOPIFY:       <ShoppingCart className="w-3.5 h-3.5" />,
  ACTION_STRIPE:        <CreditCard className="w-3.5 h-3.5" />,
};

const NODE_LABELS: Record<string, string> = {
  // Instagram Triggers
  IG_POST_COMMENT:      'Post/Reel Comment',
  IG_STORY_REPLY:        'Story Reply',
  IG_STORY_MENTION:      'Story Mention',
  IG_DIRECT_MESSAGE:     'Instagram DM',
  IG_POST_SHARE:        'Post/Reel Share',
  IG_ADS_CLICK:         'Instagram Ads',
  IG_LIVE_COMMENT:      'Live Comments',
  IG_REFERRAL_LINK:     'Referral Link',
  IG_KEYWORD:           'Keyword Trigger',
  // Facebook Triggers
  FB_POST_COMMENT:      'FB Post Comment',
  FB_DIRECT_MESSAGE:    'FB Message',
  FB_KEYWORD:           'FB Keyword',
  FB_LEAD_AD:           'Lead Ad',
  FB_CHECKBOX_PLUGIN:   'Checkbox Plugin',
  FB_REFERRAL:          'FB Referral',
  // TikTok Triggers
  TT_VIDEO_COMMENT:     'Video Comment',
  TT_DIRECT_MESSAGE:    'TikTok DM',
  TT_LIVE_COMMENT:      'Live Comment',
  TT_KEYWORD:           'TikTok Keyword',
  TT_SHOP_CLICK:        'Shop Click',
  // WhatsApp Triggers
  WA_MESSAGE:           'WhatsApp Message',
  WA_QR_SCAN:           'QR Scan',
  WA_CTA_CLICK:         'CTA Click',
  WA_TEMPLATE_REPLY:    'Template Reply',
  // Contact Triggers
  CONTACT_CREATED:        'New Contact',
  CONTACT_FIELD_CHANGED:  'Field Changed',
  CONTACT_SYSTEM_FIELD:   'System Field Changed',
  CONTACT_TAG_ADDED:      'Tag Applied',
  CONTACT_TAG_REMOVED:    'Tag Removed',
  CONTACT_SEQUENCE_SUB:   'Sequence Subscribed',
  CONTACT_SEQUENCE_UNSUB: 'Sequence Unsubscribed',
  CONTACT_SEGMENT_ENTRY:  'Segment Entry',
  CONTACT_DATETIME:       'Date/Time Trigger',
  // System Triggers
  SYSTEM_SCHEDULED:     'Scheduled Time',
  SYSTEM_WEBHOOK:       'Webhook',
  SYSTEM_API:           'API Trigger',
  SYSTEM_SHOPIFY:       'Shopify Event',
  SYSTEM_STRIPE:        'Stripe Event',
  SYSTEM_ZAPIER:        'Zapier Trigger',
  SYSTEM_MANUAL:        'Manual Trigger',
  // Legacy triggers (for backwards compatibility)
  COMMENT_TO_DM:        'Comment Trigger',
  STORY_MENTION:        'Story Mention',
  STORY_REPLY:          'Story Reply',
  FOLLOW_TO_DM:         'Follow Trigger',
  SHARE_TO_DM:          'Share Trigger',
  TIKTOK_COMMENT_TO_DM: 'TikTok Comment',
  DEEPLINK_BIO_CLICK:   'Bio Link Click',
  MANUAL:               'Manual Trigger',
  // Actions
  SEND_MESSAGE:         'Send Message',
  SEND_DM_CARD:         'Send DM Card',
  SEND_CAROUSEL:        'Send Carousel',
  SEND_PRODUCT:         'Send Product Card',
  SEND_TEMPLATE:        'Send Template',
  SEND_QUIZ:           'Send Quiz',
  TIKTOK_SHOP_PRODUCT:  'Send Product Card',
  COLLECT_INPUT:        'Collect User Input',
  // Logic & AI
  CONDITION:            'Condition',
  SUPER_RANDOMIZER:     'A/B Split',
  SMART_DELAY:          'Smart Delay',
  FRICTION_RECOVERY:    'Friction Recovery',
  AI_STEP:              'AI Step',
  CUSTOM_CODE:          'Custom Code',
  // Contact Actions
  ACTION_ADD_TAG:       'Add Tag',
  ACTION_REMOVE_TAG:    'Remove Tag',
  ACTION_SET_FIELD:     'Set Field',
  ACTION_INCREMENT_FIELD: 'Increment Field',
  ACTION_ADD_SEQUENCE:  'Add to Sequence',
  ACTION_REMOVE_SEQUENCE: 'Remove from Sequence',
  ACTION_UPDATE_SEGMENT: 'Update Segment',
  ACTION_CLEAR_FIELD:   'Clear Field',
  ACTION_NOTIFY:        'Notify Team',
  // System Actions
  ACTION_BLOCK:         'Action Block',
  OUTBOUND_WEBHOOK:     'Webhook',
  ACTION_GOOGLE_SHEETS: 'Google Sheets',
  ACTION_SHOPIFY:       'Shopify Action',
  ACTION_STRIPE:        'Stripe Action',
};

// ─────────────────────────────────────────────────────────────────────────────
// NODE PICKER POPUP — ManyChat-style channel-based selector
// ─────────────────────────────────────────────────────────────────────────────

type PickerMode = 'trigger' | 'action';
type PickerChannel = 'instagram' | 'facebook' | 'tiktok' | 'whatsapp' | 'contact' | 'system';

interface PickerOption {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  pro?: boolean;
  isNew?: boolean;
  color: string;
}

interface PickerChannelGroup {
  id: PickerChannel;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const TRIGGER_CHANNELS: PickerChannelGroup[] = [
  { id: 'instagram',  label: 'Instagram',  icon: <Instagram className="w-4 h-4" />, color: '#E1306C' },
  { id: 'facebook',   label: 'Facebook',   icon: <Facebook className="w-4 h-4" />,  color: '#1877F2' },
  { id: 'tiktok',     label: 'TikTok',     icon: <Video className="w-4 h-4" />,      color: '#00F2EA' },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: <Phone className="w-4 h-4" />,      color: '#25D366' },
  { id: 'contact',    label: 'Contact',    icon: <Users className="w-4 h-4" />,      color: '#8B5CF6' },
  { id: 'system',     label: 'System',     icon: <Wrench className="w-4 h-4" />,     color: '#F59E0B' },
];

const ACTION_CHANNELS: PickerChannelGroup[] = [
  { id: 'instagram',  label: 'Instagram',  icon: <Instagram className="w-4 h-4" />, color: '#E1306C' },
  { id: 'facebook',   label: 'Facebook',   icon: <Facebook className="w-4 h-4" />, color: '#1877F2' },
  { id: 'tiktok',     label: 'TikTok',     icon: <Video className="w-4 h-4" />,    color: '#00F2EA' },
  { id: 'whatsapp',   label: 'WhatsApp',   icon: <Phone className="w-4 h-4" />,    color: '#25D366' },
  { id: 'contact',    label: 'Contact',    icon: <Users className="w-4 h-4" />,    color: '#8B5CF6' },
  { id: 'system',     label: 'System',     icon: <Wrench className="w-4 h-4" />,   color: '#F59E0B' },
];

// Comprehensive trigger options matching market leaders
const TRIGGER_OPTIONS: Record<PickerChannel, PickerOption[]> = {
  instagram: [
    { type: 'IG_POST_COMMENT',    label: 'Post or Reel Comments', description: 'User comments on your Post or Reel', icon: <MessageCircle className="w-4 h-4" />,  color: '#E1306C' },
    { type: 'IG_STORY_REPLY',     label: 'Story Reply',           description: 'User replies to your Story',       icon: <Share2 className="w-4 h-4" />,         color: '#E1306C' },
    { type: 'IG_STORY_MENTION',   label: 'Story Mention',        description: 'User mentions you in story',      icon: <AtSign className="w-4 h-4" />,         color: '#E1306C' },
    { type: 'IG_DIRECT_MESSAGE', label: 'Instagram Message',     description: 'User sends a direct message',       icon: <Send className="w-4 h-4" />,          color: '#E1306C' },
    { type: 'IG_POST_SHARE',      label: 'Post or Reel Share',   description: 'User shares your Post or Reel as Story', icon: <Share2 className="w-4 h-4" />, color: '#E1306C', isNew: true },
    { type: 'IG_ADS_CLICK',       label: 'Instagram Ads',        description: 'User clicks an Instagram Ad',       icon: <Megaphone className="w-4 h-4" />,     color: '#E1306C', pro: true },
    { type: 'IG_LIVE_COMMENT',    label: 'Live Comments',        description: 'User comments on your Live',        icon: <Video className="w-4 h-4" />,        color: '#E1306C' },
    { type: 'IG_REFERRAL_LINK',   label: 'Instagram Ref URL',    description: 'User clicks a referral link',       icon: <Link2 className="w-4 h-4" />,        color: '#E1306C' },
    { type: 'IG_KEYWORD',         label: 'Keyword Trigger',      description: 'Specific keyword in comment/message', icon: <Search className="w-4 h-4" />,     color: '#E1306C' },
  ],
  facebook: [
    { type: 'FB_POST_COMMENT',    label: 'Post Comment',         description: 'User comments on page post',         icon: <MessageCircle className="w-4 h-4" />, color: '#1877F2' },
    { type: 'FB_DIRECT_MESSAGE', label: 'Facebook Message',      description: 'User sends a message',               icon: <Send className="w-4 h-4" />,          color: '#1877F2' },
    { type: 'FB_KEYWORD',         label: 'Keyword',              description: 'Keyword in message triggers flow',   icon: <Search className="w-4 h-4" />,        color: '#1877F2' },
    { type: 'FB_LEAD_AD',         label: 'Lead Ad',              description: 'Lead ad form submission',            icon: <Database className="w-4 h-4" />,       color: '#1877F2', pro: true },
    { type: 'FB_CHECKBOX_PLUGIN', label: 'Checkbox Plugin',      description: 'Checkbox plugin opt-in',             icon: <ToggleLeft className="w-4 h-4" />,    color: '#1877F2' },
    { type: 'FB_REFERRAL',        label: 'Facebook Referral',    description: 'User comes from referral link',     icon: <Link2 className="w-4 h-4" />,        color: '#1877F2' },
  ],
  tiktok: [
    { type: 'TT_VIDEO_COMMENT',   label: 'Video Comment',        description: 'User comments on TikTok video',      icon: <MessageCircle className="w-4 h-4" />,  color: '#00F2EA' },
    { type: 'TT_DIRECT_MESSAGE',  label: 'TikTok Message',       description: 'User sends a TikTok DM',           icon: <Send className="w-4 h-4" />,          color: '#00F2EA', isNew: true },
    { type: 'TT_LIVE_COMMENT',    label: 'Live Comment',        description: 'User comments during live',          icon: <Video className="w-4 h-4" />,        color: '#00F2EA' },
    { type: 'TT_KEYWORD',         label: 'Keyword Trigger',     description: 'Specific keyword in comments',       icon: <Search className="w-4 h-4" />,       color: '#00F2EA' },
    { type: 'TT_SHOP_CLICK',      label: 'Shop Click',           description: 'User clicks TikTok Shop link',      icon: <ShoppingBag className="w-4 h-4" />,   color: '#00F2EA' },
  ],
  whatsapp: [
    { type: 'WA_MESSAGE',         label: 'Incoming Message',    description: 'WhatsApp message received',         icon: <MessageCircle className="w-4 h-4" />, color: '#25D366' },
    { type: 'WA_QR_SCAN',         label: 'QR Scan',             description: 'WhatsApp QR code scanned',           icon: <QrCode className="w-4 h-4" />,        color: '#25D366' },
    { type: 'WA_CTA_CLICK',       label: 'CTA Click',            description: 'Click-to-WhatsApp ad click',        icon: <MousePointer className="w-4 h-4" />,  color: '#25D366' },
    { type: 'WA_TEMPLATE_REPLY',  label: 'Template Reply',      description: 'User replies to template message',   icon: <FileSpreadsheet className="w-4 h-4" />,color: '#25D366' },
  ],
  contact: [
    { type: 'CONTACT_CREATED',    label: 'New Contact',         description: 'New contact created',                icon: <UserPlus className="w-4 h-4" />,       color: '#8B5CF6' },
    { type: 'CONTACT_FIELD_CHANGED', label: 'Custom Field Changed', description: 'Custom field value is changed',    icon: <Variable className="w-4 h-4" />,      color: '#8B5CF6', pro: true },
    { type: 'CONTACT_SYSTEM_FIELD', label: 'System Field Changed', description: 'System field value is changed',    icon: <Settings2 className="w-4 h-4" />,     color: '#8B5CF6', pro: true },
    { type: 'CONTACT_TAG_ADDED',  label: 'Tag Applied',         description: 'Tag is applied to a contact',        icon: <Tag className="w-4 h-4" />,           color: '#8B5CF6', pro: true },
    { type: 'CONTACT_TAG_REMOVED', label: 'Tag Removed',         description: 'Tag is removed from a contact',      icon: <Tag className="w-4 h-4" />,           color: '#8B5CF6', pro: true },
    { type: 'CONTACT_SEQUENCE_SUB', label: 'Sequence Subscribed', description: 'Contact subscribed to a sequence',  icon: <Repeat className="w-4 h-4" />,       color: '#8B5CF6', pro: true },
    { type: 'CONTACT_SEQUENCE_UNSUB', label: 'Sequence Unsubscribed', description: 'Contact unsubscribed from sequence', icon: <UserPlus className="w-4 h-4" />,  color: '#8B5CF6', pro: true },
    { type: 'CONTACT_SEGMENT_ENTRY', label: 'Segment Entry',    description: 'Contact enters a segment',          icon: <Layers className="w-4 h-4" />,        color: '#8B5CF6' },
    { type: 'CONTACT_DATETIME',   label: 'Date/Time Occurred',    description: 'Specific date/time reached',         icon: <Calendar className="w-4 h-4" />,      color: '#8B5CF6', pro: true },
  ],
  system: [
    { type: 'SYSTEM_SCHEDULED',   label: 'Scheduled Time',       description: 'Run flow on a schedule',             icon: <Calendar className="w-4 h-4" />,      color: '#F59E0B' },
    { type: 'SYSTEM_WEBHOOK',     label: 'Incoming Webhook',    description: 'External webhook trigger',          icon: <Webhook className="w-4 h-4" />,       color: '#F59E0B', pro: true },
    { type: 'SYSTEM_API',         label: 'API Trigger',         description: 'Trigger via REST API',              icon: <Code2 className="w-4 h-4" />,          color: '#F59E0B', pro: true },
    { type: 'SYSTEM_SHOPIFY',     label: 'Shopify Event',       description: 'Shopify order/event trigger',        icon: <ShoppingCart className="w-4 h-4" />,   color: '#F59E0B', pro: true },
    { type: 'SYSTEM_STRIPE',      label: 'Stripe Event',        description: 'Stripe payment event trigger',      icon: <CreditCard className="w-4 h-4" />,    color: '#F59E0B', pro: true },
    { type: 'SYSTEM_ZAPIER',      label: 'Zapier Trigger',      description: 'Trigger from Zapier workflow',      icon: <Zap className="w-4 h-4" />,           color: '#F59E0B', pro: true },
    { type: 'SYSTEM_MANUAL',      label: 'Manual Trigger',      description: 'Manually start flow for contact',   icon: <MousePointerClick className="w-4 h-4" />, color: '#F59E0B' },
  ],
};

// Comprehensive action options matching market leaders
const ACTION_OPTIONS: Record<PickerChannel, PickerOption[]> = {
  instagram: [
    { type: 'SEND_MESSAGE',       label: 'Send Message',        description: 'Text message with quick replies',   icon: <Send className="w-4 h-4" />,           color: '#E1306C' },
    { type: 'SEND_DM_CARD',       label: 'Send DM Card',        description: 'Rich card with image & buttons',    icon: <CreditCard className="w-4 h-4" />,     color: '#E1306C' },
    { type: 'SEND_CAROUSEL',      label: 'Send Carousel',       description: 'Multiple cards in one message',     icon: <Layers className="w-4 h-4" />,        color: '#E1306C', pro: true },
    { type: 'COLLECT_INPUT',      label: 'Collect User Input',  description: 'Ask question, store reply',          icon: <ToggleLeft className="w-4 h-4" />,    color: '#E1306C' },
    { type: 'SEND_PRODUCT',       label: 'Send Product Card',   description: 'Showcase product in DM',            icon: <ShoppingBag className="w-4 h-4" />,    color: '#E1306C' },
    { type: 'SEND_QUIZ',          label: 'Send Quiz/Poll',      description: 'Interactive quiz in message',       icon: <MessageSquare className="w-4 h-4" />, color: '#E1306C', isNew: true },
  ],
  facebook: [
    { type: 'SEND_MESSAGE',      label: 'Send Message',        description: 'Text message with quick replies',   icon: <Send className="w-4 h-4" />,           color: '#1877F2' },
    { type: 'SEND_DM_CARD',      label: 'Send Card',           description: 'Rich card with image & buttons',     icon: <CreditCard className="w-4 h-4" />,     color: '#1877F2' },
    { type: 'COLLECT_INPUT',     label: 'Collect User Input',  description: 'Ask question, store reply',          icon: <ToggleLeft className="w-4 h-4" />,    color: '#1877F2' },
    { type: 'SEND_PRODUCT',      label: 'Send Product Card',   description: 'Product showcase in message',       icon: <ShoppingBag className="w-4 h-4" />,    color: '#1877F2' },
  ],
  tiktok: [
    { type: 'SEND_MESSAGE',        label: 'Send Message',       description: 'Text message to TikTok DM',         icon: <Send className="w-4 h-4" />,            color: '#00F2EA' },
    { type: 'TIKTOK_SHOP_PRODUCT',  label: 'Product Card',       description: 'TikTok Shop product showcase',      icon: <ShoppingBag className="w-4 h-4" />,     color: '#00F2EA' },
    { type: 'SEND_DM_CARD',         label: 'Send Card',          description: 'Rich card with buttons',             icon: <CreditCard className="w-4 h-4" />,      color: '#00F2EA' },
    { type: 'COLLECT_INPUT',        label: 'Collect User Input', description: 'Ask question, store reply',          icon: <ToggleLeft className="w-4 h-4" />,     color: '#00F2EA' },
  ],
  whatsapp: [
    { type: 'SEND_MESSAGE',      label: 'Send Message',        description: 'WhatsApp text message',             icon: <Send className="w-4 h-4" />,          color: '#25D366' },
    { type: 'SEND_TEMPLATE',     label: 'Send Template',       description: 'WhatsApp approved template',        icon: <FileSpreadsheet className="w-4 h-4" />,color: '#25D366' },
    { type: 'SEND_DM_CARD',      label: 'Send Card',           description: 'Rich card message',                 icon: <CreditCard className="w-4 h-4" />,     color: '#25D366' },
    { type: 'COLLECT_INPUT',     label: 'Collect User Input',  description: 'Ask question, store reply',          icon: <ToggleLeft className="w-4 h-4" />,    color: '#25D366' },
  ],
  contact: [
    { type: 'ACTION_ADD_TAG',        label: 'Add Tag',            description: 'Apply a tag to contact',            icon: <Tag className="w-4 h-4" />,           color: '#8B5CF6' },
    { type: 'ACTION_REMOVE_TAG',     label: 'Remove Tag',         description: 'Remove a tag from contact',         icon: <Tag className="w-4 h-4" />,           color: '#8B5CF6' },
    { type: 'ACTION_SET_FIELD',      label: 'Set Custom Field',   description: 'Set contact field value',          icon: <Variable className="w-4 h-4" />,      color: '#8B5CF6' },
    { type: 'ACTION_INCREMENT_FIELD', label: 'Increment Field',    description: 'Add to a numeric field',            icon: <TrendingUp className="w-4 h-4" />,    color: '#8B5CF6' },
    { type: 'ACTION_ADD_SEQUENCE',  label: 'Subscribe to Sequence', description: 'Enroll in automation sequence',  icon: <Repeat className="w-4 h-4" />,        color: '#8B5CF6' },
    { type: 'ACTION_REMOVE_SEQUENCE', label: 'Unsubscribe from Sequence', description: 'Remove from sequence',        icon: <Repeat className="w-4 h-4" />,        color: '#8B5CF6' },
    { type: 'ACTION_UPDATE_SEGMENT', label: 'Update Segment',     description: 'Add/remove from segment',           icon: <Layers className="w-4 h-4" />,        color: '#8B5CF6' },
    { type: 'ACTION_CLEAR_FIELD',    label: 'Clear Field',       description: 'Clear a contact field',              icon: <X className="w-4 h-4" />,              color: '#8B5CF6' },
  ],
  system: [
    { type: 'OUTBOUND_WEBHOOK',  label: 'Send Webhook',        description: 'Send HTTP request to external API', icon: <Webhook className="w-4 h-4" />,       color: '#F59E0B' },
    { type: 'ACTION_GOOGLE_SHEETS', label: 'Google Sheets',    description: 'Add row to spreadsheet',           icon: <FileSpreadsheet className="w-4 h-4" />,color: '#F59E0B' },
    { type: 'SMART_DELAY',      label: 'Delay',               description: 'Wait before next step',              icon: <Timer className="w-4 h-4" />,         color: '#F59E0B' },
    { type: 'ACTION_NOTIFY',    label: 'Notify Team',         description: 'Alert team via email/Slack',        icon: <Bell className="w-4 h-4" />,         color: '#F59E0B', pro: true },
    { type: 'AI_STEP',          label: 'AI Response',         description: 'AI-powered response with KB',        icon: <Brain className="w-4 h-4" />,         color: '#14B8A6' },
    { type: 'CUSTOM_CODE',      label: 'Run Custom Code',     description: 'Execute JavaScript',                icon: <Code2 className="w-4 h-4" />,          color: '#14B8A6' },
    { type: 'CONDITION',        label: 'Condition/Branch',    description: 'Branch flow based on conditions',    icon: <GitBranch className="w-4 h-4" />,      color: '#F59E0B' },
    { type: 'SUPER_RANDOMIZER', label: 'A/B Split',           description: 'Split traffic by percentage',        icon: <SlidersHorizontal className="w-4 h-4" />, color: '#F59E0B' },
    { type: 'FRICTION_RECOVERY', label: 'Friction Recovery',   description: 'Retry on failure',                   icon: <RefreshCw className="w-4 h-4" />,      color: '#F59E0B' },
    { type: 'ACTION_SHOPIFY',   label: 'Shopify Action',      description: 'Create order, update customer',      icon: <ShoppingCart className="w-4 h-4" />,   color: '#F59E0B', pro: true },
    { type: 'ACTION_STRIPE',    label: 'Stripe Action',        description: 'Create charge, update customer',    icon: <CreditCard className="w-4 h-4" />,    color: '#F59E0B', pro: true },
  ],
};

interface NodePickerPopupProps {
  mode: PickerMode;
  position?: { x: number; y: number };
  onClose: () => void;
  onSelect: (type: string) => void;
}

function NodePickerPopup({ mode, position, onClose, onSelect }: NodePickerPopupProps) {
  const channels = mode === 'trigger' ? TRIGGER_CHANNELS : ACTION_CHANNELS;
  const options = mode === 'trigger' ? TRIGGER_OPTIONS : ACTION_OPTIONS;
  const [activeChannel, setActiveChannel] = useState<PickerChannel>(channels[0].id);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const channelOptions = options[activeChannel] || [];
  const filtered = search
    ? channelOptions.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.description.toLowerCase().includes(search.toLowerCase())
      )
    : channelOptions;

  // Search across all channels
  const allOptions = search
    ? (Object.values(options).flat().filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        o.description.toLowerCase().includes(search.toLowerCase())
      ))
    : filtered;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#111318] border border-[#2A2E42] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1E2130] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${mode === 'trigger' ? 'bg-green-500/15' : 'bg-blue-500/15'}`}>
              {mode === 'trigger'
                ? <Zap className="w-4 h-4 text-green-400" />
                : <Send className="w-4 h-4 text-blue-400" />
              }
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#F0F2FF]">
                Choose a {mode === 'trigger' ? 'Trigger' : 'Action'}
              </h2>
              <p className="text-[10px] text-[#4B5068] mt-0.5">
                {mode === 'trigger' ? 'What starts this flow?' : 'What should happen next?'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-5 py-3 border-b border-[#1E2130] flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4B5068]" />
            <input
              ref={searchRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${mode === 'trigger' ? 'triggers' : 'actions'}...`}
              className="h-9 w-full rounded-lg bg-[#0A0B0F] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] pl-9 pr-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Body: left channels + right options */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left: Channel sidebar */}
          {!search && (
            <div className="w-[140px] flex-shrink-0 border-r border-[#1E2130] overflow-y-auto py-2 px-2">
              {channels.map(ch => {
                const isActive = activeChannel === ch.id;
                const count = (options[ch.id] || []).length;
                return (
                  <button
                    key={ch.id}
                    onClick={() => setActiveChannel(ch.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                      isActive
                        ? 'bg-[#1A1C24] text-[#F0F2FF]'
                        : 'text-[#8B90A7] hover:bg-[#1A1C24]/50 hover:text-[#F0F2FF]'
                    }`}
                  >
                    <span style={{ color: isActive ? ch.color : undefined }} className="flex-shrink-0">
                      {ch.icon}
                    </span>
                    <span className="text-xs font-medium flex-1 truncate">{ch.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0 rounded-full ${
                      isActive ? 'bg-[#2A2E42] text-[#F0F2FF]' : 'text-[#4B5068]'
                    }`}>{count}</span>
                  </button>
                );
              })}

              {/* Divider + Logic/AI section */}
              <div className="border-t border-[#1E2130] my-2" />
              <p className="text-[9px] font-black text-[#4B5068] uppercase tracking-[0.15em] px-3 mb-1">Logic & AI</p>
              {(mode === 'action' ? [
                { id: 'logic' as const, label: 'Logic', icon: <GitBranch className="w-4 h-4" />, color: '#F59E0B', types: ['CONDITION', 'SUPER_RANDOMIZER', 'SMART_DELAY', 'FRICTION_RECOVERY'] },
                { id: 'ai' as const, label: 'AI & Code', icon: <Brain className="w-4 h-4" />, color: '#14B8A6', types: ['AI_STEP', 'CUSTOM_CODE'] },
              ] : []).map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveChannel(group.id as PickerChannel)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                    activeChannel === group.id
                      ? 'bg-[#1A1C24] text-[#F0F2FF]'
                      : 'text-[#8B90A7] hover:bg-[#1A1C24]/50 hover:text-[#F0F2FF]'
                  }`}
                >
                  <span style={{ color: activeChannel === group.id ? group.color : undefined }} className="flex-shrink-0">
                    {group.icon}
                  </span>
                  <span className="text-xs font-medium flex-1 truncate">{group.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Right: Options grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {search ? (
              /* Global search results */
              allOptions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="w-8 h-8 text-[#4B5068] mb-3" />
                  <p className="text-sm text-[#8B90A7]">No results for "{search}"</p>
                  <p className="text-xs text-[#4B5068] mt-1">Try a different search term</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {allOptions.map((opt, i) => (
                    <OptionCard key={`${opt.type}-${i}`} option={opt} onClick={() => onSelect(opt.type)} />
                  ))}
                </div>
              )
            ) : activeChannel === 'logic' ? (
              /* Logic nodes */
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { type: 'CONDITION',        label: 'Condition',         description: 'Branch on field/content', icon: <GitBranch className="w-5 h-5" />,   color: '#F59E0B' },
                  { type: 'SUPER_RANDOMIZER', label: 'A/B Split',         description: 'Traffic split by %',      icon: <SlidersHorizontal className="w-5 h-5" />, color: '#F59E0B' },
                  { type: 'SMART_DELAY',      label: 'Smart Delay',       description: 'Wait with 24h awareness', icon: <Clock className="w-5 h-5" />,       color: '#F59E0B' },
                  { type: 'FRICTION_RECOVERY',label: 'Friction Recovery', description: 'Retry on failure',        icon: <RefreshCw className="w-5 h-5" />,   color: '#F59E0B' },
                ].map(opt => (
                  <OptionCard key={opt.type} option={opt} onClick={() => onSelect(opt.type)} />
                ))}
              </div>
            ) : activeChannel === 'ai' ? (
              /* AI nodes */
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { type: 'AI_STEP',     label: 'AI Step',     description: 'Knowledge-base AI response', icon: <Brain className="w-5 h-5" />,  color: '#14B8A6' },
                  { type: 'CUSTOM_CODE', label: 'Custom Code', description: 'JavaScript execution block', icon: <Code2 className="w-5 h-5" />,  color: '#14B8A6' },
                ].map(opt => (
                  <OptionCard key={opt.type} option={opt} onClick={() => onSelect(opt.type)} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-xl bg-[#1A1C24] border border-[#2A2E42] flex items-center justify-center mb-3">
                  {channels.find(c => c.id === activeChannel)?.icon}
                </div>
                <p className="text-sm text-[#8B90A7]">No {mode === 'trigger' ? 'triggers' : 'actions'} available</p>
                <p className="text-xs text-[#4B5068] mt-1">Try a different channel</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {filtered.map((opt, i) => (
                  <OptionCard key={`${opt.type}-${i}`} option={opt} onClick={() => onSelect(opt.type)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionCard({ option, onClick }: { option: PickerOption | { type: string; label: string; description: string; icon: React.ReactNode; color: string; pro?: boolean; isNew?: boolean }; onClick: () => void }) {
  const { type, label, description, icon, color, pro, isNew } = option;
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 p-3 rounded-xl bg-[#0A0B0F] border border-[#2A2E42] hover:border-[#3A3E52] hover:bg-[#1A1C24] transition-all text-left w-full"
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"
        style={{ backgroundColor: `${color}15`, color }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-xs font-semibold text-[#F0F2FF] group-hover:text-white truncate transition-colors">
            {label}
          </p>
          {isNew && (
            <span className="flex-shrink-0 px-1.5 py-0 rounded text-[8px] font-black tracking-wider bg-green-500/15 text-green-400 border border-green-500/20">
              NEW
            </span>
          )}
          {pro && (
            <span className="flex-shrink-0 px-1.5 py-0 rounded text-[8px] font-black tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20">
              PRO
            </span>
          )}
        </div>
        <p className="text-[10px] text-[#4B5068] group-hover:text-[#8B90A7] truncate mt-0.5 leading-tight transition-colors">
          {description}
        </p>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM NODE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

function FlowNode({ data, selected }: { data: Record<string, unknown>; selected: boolean }) {
  const type = data.nodeType as string;
  const color = NODE_COLOR(type);
  const cat = NODE_CATEGORY[type];
  const isTrigger = cat === 'TRIGGER';
  const isCondition = type === 'CONDITION';
  const isABSplit = type === 'SUPER_RANDOMIZER';
  const paths: { label: string; pct: number }[] = (data.config as any)?.paths || [];
  const isUnconfigured = !data.preview && Object.keys((data.config as Record<string, unknown>) || {}).length === 0;
  const onPlusClick = data.onPlusClick as ((nodeId: string) => void) | undefined;

  return (
    <div
      className={`relative rounded-xl bg-[#1A1C24] border transition-all duration-150 select-none`}
      style={{
        width: 224,
        borderColor: selected ? color : '#2A2E42',
        boxShadow: selected ? `0 0 0 2px ${color}33, 0 8px 32px rgba(0,0,0,0.4)` : '0 2px 12px rgba(0,0,0,0.3)',
      }}
    >
      {/* Target handle (top) — not on triggers */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
          style={{ background: '#3B82F6', top: -6 }}
        />
      )}

      {/* Left color stripe */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      {/* Header */}
      <div className="pl-4 pr-3 pt-3 pb-2 border-b border-[#1E2130]">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span style={{ color }}>{NODE_ICONS[type]}</span>
          <span className="text-[10px] text-[#4B5068] uppercase tracking-wider font-semibold">
            {NODE_LABELS[type]}
          </span>
        </div>
        <p className="text-sm font-semibold text-[#F0F2FF] truncate leading-tight">
          {data.label as string || NODE_LABELS[type]}
        </p>
      </div>

      {/* Body — unconfigured nodes show click-to-configure CTA */}
      <div className="pl-4 pr-3 py-2.5">
        {data.preview ? (
          <p className="text-xs text-[#8B90A7] line-clamp-2 leading-relaxed">{data.preview as string}</p>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <div className="w-5 h-5 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Plus className="w-3 h-3 text-blue-400" />
            </div>
            <p className="text-xs text-blue-400 font-medium">Click to configure</p>
          </div>
        )}
      </div>

      {/* A/B split path labels */}
      {isABSplit && paths.length > 0 && (
        <div className="flex justify-around px-4 pb-2">
          {paths.map((p, i) => (
            <span key={i} className="text-[9px] text-[#8B90A7] font-medium">{p.label} {p.pct}%</span>
          ))}
        </div>
      )}

      {/* Source handle(s) */}
      {isCondition ? (
        <>
          {/* Yes handle — left bottom */}
          <Handle
            id="true"
            type="source"
            position={Position.Bottom}
            style={{ left: '28%', background: '#22C55E', bottom: -6 }}
            className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
          />
          {/* Default/bottom handle — center */}
          <Handle
            id="default"
            type="source"
            position={Position.Bottom}
            style={{ left: '50%', transform: 'translateX(-50%)', background: '#3B82F6', bottom: -6 }}
            className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
          />
          {/* No handle — right bottom */}
          <Handle
            id="false"
            type="source"
            position={Position.Bottom}
            style={{ left: '72%', background: '#EF4444', bottom: -6 }}
            className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
          />
        </>
      ) : isABSplit && paths.length > 0 ? (
        paths.map((p, i) => (
          <Handle
            key={p.label}
            id={`path-${i}`}
            type="source"
            position={Position.Bottom}
            style={{
              left: `${(i + 1) * (100 / (paths.length + 1))}%`,
              background: '#F59E0B',
              bottom: -6,
            }}
            className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: '#3B82F6', bottom: -6 }}
          className="!w-3 !h-3 !rounded-full !border-2 !border-[#0A0B0F]"
        />
      )}

      {/* Handle labels for condition */}
      {isCondition && (
        <div className="flex justify-between px-3 pb-1.5 -mt-0.5">
          <span className="text-[9px] text-green-500 font-semibold">YES</span>
          <span className="text-[9px] text-[#4B5068]">DEFAULT</span>
          <span className="text-[9px] text-red-500 font-semibold">NO</span>
        </div>
      )}

      {/* + Add next step button */}
      {isCondition ? (
        <div className="flex justify-between px-2 pb-2">
          <button
            onClick={(e) => { e.stopPropagation(); if (onPlusClick) onPlusClick((data as any).id || ''); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-green-400 hover:text-white hover:bg-green-500 transition-all border border-green-500/20"
            title="Add YES step"
          >
            <Plus className="w-2.5 h-2.5" /> Yes
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (onPlusClick) onPlusClick((data as any).id || ''); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-[#8B90A7] hover:text-white hover:bg-blue-500 transition-all border border-[#2A2E42]"
            title="Add DEFAULT step"
          >
            <Plus className="w-2.5 h-2.5" /> Default
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (onPlusClick) onPlusClick((data as any).id || ''); }}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-red-400 hover:text-white hover:bg-red-500 transition-all border border-red-500/20"
            title="Add NO step"
          >
            <Plus className="w-2.5 h-2.5" /> No
          </button>
        </div>
      ) : isABSplit ? (
        <div className="flex justify-center gap-2 px-2 pb-2">
          {paths.map((p, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); if (onPlusClick) onPlusClick((data as any).id || ''); }}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-amber-400 hover:text-white hover:bg-amber-500 transition-all border border-amber-500/20"
              title={`Add step for ${p.label}`}
            >
              <Plus className="w-2.5 h-2.5" /> {p.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex justify-center pb-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onPlusClick) onPlusClick((data as any).id || '');
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-blue-400 hover:text-white hover:bg-blue-500 transition-all border border-blue-500/20 hover:border-blue-500"
            title="Add next step"
          >
            <Plus className="w-3 h-3" />
            Add step
          </button>
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = { flowNode: FlowNode };

// ─────────────────────────────────────────────────────────────────────────────
// SMALL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-semibold text-[#8B90A7] uppercase tracking-wider mb-1">{children}</label>;
}

function PanelSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      {title && (
        <p className="text-[10px] font-bold text-[#4B5068] uppercase tracking-widest">{title}</p>
      )}
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-[#1E2130]" />;
}

function StyledInput({
  value, onChange, placeholder, type = 'text', className = '', ...rest
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={`h-9 w-full rounded-lg bg-[#0F1117] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${className}`}
      {...rest}
    />
  );
}

function StyledSelect({
  value, onChange, children, className = '',
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className={`h-9 w-full appearance-none rounded-lg bg-[#0F1117] border border-[#2A2E42] text-sm text-[#F0F2FF] px-3 pr-8 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all ${className}`}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4B5068] pointer-events-none" />
    </div>
  );
}

function StyledTextarea({
  value, onChange, placeholder, rows = 4, maxLength,
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className="w-full rounded-lg bg-[#0F1117] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all resize-y leading-relaxed"
    />
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-blue-500/8 border border-blue-500/15">
      <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-[#8B90A7] leading-relaxed">{children}</p>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
      <p className="text-[11px] text-[#8B90A7] leading-relaxed">{children}</p>
    </div>
  );
}

// Chip tag input
function ChipInput({
  chips, onAdd, onRemove, placeholder, color = 'blue',
}: {
  chips: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder?: string;
  color?: 'blue' | 'amber' | 'teal';
}) {
  const [input, setInput] = useState('');
  const colorMap = {
    blue:  { chip: 'bg-blue-500/15 text-blue-400 border-blue-500/20',  btn: 'bg-blue-500/15 text-blue-400 hover:bg-blue-500/25' },
    amber: { chip: 'bg-amber-500/15 text-amber-400 border-amber-500/20', btn: 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25' },
    teal:  { chip: 'bg-teal-500/15 text-teal-400 border-teal-500/20',   btn: 'bg-teal-500/15 text-teal-400 hover:bg-teal-500/25' },
  };
  const c = colorMap[color];

  const commit = () => {
    const v = input.trim().replace(/,$/, '');
    if (v && !chips.includes(v)) { onAdd(v); setInput(''); }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 rounded-lg bg-[#0F1117] border border-[#2A2E42]">
        {chips.map(c2 => (
          <span key={c2} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${c.chip}`}>
            {c2}
            <X className="w-2.5 h-2.5 cursor-pointer hover:opacity-70" onClick={() => onRemove(c2)} />
          </span>
        ))}
        {chips.length === 0 && <span className="text-[11px] text-[#4B5068] italic self-center">No items</span>}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
          placeholder={placeholder || 'Type + Enter'}
          className="flex-1 h-7 rounded-lg bg-[#0F1117] border border-[#2A2E42] text-xs text-[#F0F2FF] placeholder:text-[#4B5068] px-2.5 focus:outline-none focus:border-blue-500"
        />
        <button onClick={commit} className={`h-7 px-3 rounded-lg text-xs font-medium transition-colors ${c.btn}`}>
          Add
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COUNTER for new node IDs
// ─────────────────────────────────────────────────────────────────────────────

let _nodeCounter = 1000;
function nextNodeId() { return `node-${++_nodeCounter}`; }

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES PANEL
// ─────────────────────────────────────────────────────────────────────────────

interface PropsPanelProps {
  node: Node;
  onClose: () => void;
  onSave: (config: Record<string, any>, label: string) => void;
  onDelete: () => void;
}

function PropertiesPanel({ node, onClose, onSave, onDelete }: PropsPanelProps) {
  const type = node.data.nodeType as string;
  const color = NODE_COLOR(type);
  const cfg = (node.data.config as Record<string, any>) || {};

  // ── Local state seeded from node config ──
  const [label, setLabel] = useState<string>((node.data.label as string) || NODE_LABELS[type] || '');

  // TRIGGER
  const [triggerType, setTriggerType] = useState(cfg.triggerType || type);
  const [keywords, setKeywords] = useState<string[]>(cfg.keywords || []);
  const [semanticMatch, setSemanticMatch] = useState(cfg.semanticMatch || false);
  const [activeHoursFrom, setActiveHoursFrom] = useState(cfg.activeHoursFrom || '08:00');
  const [activeHoursTo, setActiveHoursTo] = useState(cfg.activeHoursTo || '22:00');
  const [platformFilter, setPlatformFilter] = useState(cfg.platformFilter || 'ALL');

  // SEND_MESSAGE
  const [message, setMessage] = useState(cfg.message || '');
  const [quickButtons, setQuickButtons] = useState<{ label: string; action: string; value: string }[]>(cfg.quickButtons || []);
  const [collectResponse, setCollectResponse] = useState(cfg.collectResponse || false);
  const [responseField, setResponseField] = useState(cfg.responseField || '');
  const [responseValidation, setResponseValidation] = useState(cfg.responseValidation || 'text');
  const [maxRetries, setMaxRetries] = useState<number>(cfg.maxRetries ?? 2);

  // SEND_DM_CARD
  const [cardTitle, setCardTitle] = useState(cfg.cardTitle || '');
  const [cardSubtitle, setCardSubtitle] = useState(cfg.cardSubtitle || '');
  const [cardImage, setCardImage] = useState(cfg.cardImage || '');
  const [cardButtons, setCardButtons] = useState<{ label: string; action: string; value: string }[]>(cfg.cardButtons || []);

  // CONDITION
  const [conditionType, setConditionType] = useState(cfg.conditionType || 'Check Contact Field');
  const [condField, setCondField] = useState(cfg.condField || 'email');
  const [condOperator, setCondOperator] = useState(cfg.condOperator || 'equals');
  const [condValue, setCondValue] = useState(cfg.condValue || '');
  const [condKeyword, setCondKeyword] = useState(cfg.condKeyword || '');
  const [condSemantic, setCondSemantic] = useState(cfg.condSemantic || false);
  const [condTier, setCondTier] = useState(cfg.condTier || 'NEWBIE');
  const [condTags, setCondTags] = useState<string[]>(cfg.condTags || []);

  // A/B SPLIT
  const [abPaths, setAbPaths] = useState<{ label: string; pct: number; conv?: string }[]>(
    cfg.paths || [{ label: 'Path A', pct: 60 }, { label: 'Path B', pct: 40 }]
  );

  // SMART DELAY
  const [delayValue, setDelayValue] = useState<number>(cfg.delayValue ?? 30);
  const [delayUnit, setDelayUnit] = useState(cfg.delayUnit || 'minutes');
  const [only24h, setOnly24h] = useState(cfg.only24h || false);
  const [queueOutside, setQueueOutside] = useState(cfg.queueOutside || false);

  // AI STEP
  const [knowledgeBase, setKnowledgeBase] = useState(cfg.knowledgeBase || 'Product FAQ');
  const [strictness, setStrictness] = useState(cfg.strictness || 'BALANCED');
  const [ifUnsure, setIfUnsure] = useState(cfg.ifUnsure || 'Hand off to human');
  const [aiCollect, setAiCollect] = useState(cfg.aiCollect || false);
  const [aiField, setAiField] = useState(cfg.aiField || '');
  const [aiValidation, setAiValidation] = useState(cfg.aiValidation || 'text');
  const [aiSaveResponseTo, setAiSaveResponseTo] = useState(cfg.aiSaveResponseTo || '');
  const [aiMaxRetries, setAiMaxRetries] = useState<number>(cfg.aiMaxRetries ?? 2);

  // ACTION BLOCK
  const [actionType, setActionType] = useState(cfg.actionType || 'Add Tag');
  const [actionTag, setActionTag] = useState(cfg.actionTag || '');
  const [actionField, setActionField] = useState(cfg.actionField || '');
  const [actionFieldValue, setActionFieldValue] = useState(cfg.actionFieldValue || '');
  const [actionNotifyEmail, setActionNotifyEmail] = useState(cfg.actionNotifyEmail || '');
  const [actionSequence, setActionSequence] = useState(cfg.actionSequence || '');

  // OUTBOUND WEBHOOK
  const [webhookUrl, setWebhookUrl] = useState(cfg.webhookUrl || '');
  const [webhookMethod, setWebhookMethod] = useState(cfg.webhookMethod || 'POST');
  const [webhookHeaders, setWebhookHeaders] = useState(cfg.webhookHeaders || '');
  const [webhookBody, setWebhookBody] = useState(cfg.webhookBody || '');

  // CUSTOM CODE
  const [customCode, setCustomCode] = useState(cfg.customCode || '// Return an object with updated contact fields\nreturn { tags: ["vip"] };');

  // COLLECT INPUT
  const [ciQuestion, setCiQuestion] = useState(cfg.ciQuestion || '');
  const [ciField, setCiField] = useState(cfg.ciField || '');
  const [ciValidation, setCiValidation] = useState(cfg.ciValidation || 'text');
  const [ciMaxRetries, setCiMaxRetries] = useState<number>(cfg.ciMaxRetries ?? 2);

  // ── Computed ──
  const charLimit = 1000;
  const abTotal = abPaths.reduce((s, p) => s + (p.pct || 0), 0);
  const abValid = abTotal === 100;

  function delayExceeds24h(): boolean {
    const v = Number(delayValue) || 0;
    if (delayUnit === 'days')    return v >= 1;
    if (delayUnit === 'hours')   return v >= 24;
    if (delayUnit === 'minutes') return v >= 1440;
    return false;
  }

  const VARIABLES = [
    '{{contact.name}}',
    '{{contact.email}}',
    '{{contact.phone}}',
    '{{flow.keyword}}',
    '{{brand.name}}',
  ];

  // ── Collect & save config ──
  function handleSave() {
    let config: Record<string, any> = {};
    let preview = '';

    const cat = NODE_CATEGORY[type];

    if (cat === 'TRIGGER') {
      config = { triggerType, keywords, semanticMatch, activeHoursFrom, activeHoursTo, platformFilter };
      preview = keywords.length > 0 ? `Keywords: ${keywords.join(', ')}` : NODE_LABELS[type];
    } else if (type === 'SEND_MESSAGE') {
      config = { message, quickButtons, collectResponse, responseField, responseValidation, maxRetries };
      preview = message ? message.slice(0, 80) : '';
    } else if (type === 'SEND_DM_CARD') {
      config = { cardTitle, cardSubtitle, cardImage, cardButtons };
      preview = cardTitle ? `${cardTitle}${cardSubtitle ? ' — ' + cardSubtitle : ''}` : '';
    } else if (type === 'COLLECT_INPUT') {
      config = { ciQuestion, ciField, ciValidation, ciMaxRetries };
      preview = ciQuestion ? ciQuestion.slice(0, 80) : `Save to: ${ciField}`;
    } else if (type === 'CONDITION') {
      config = { conditionType, condField, condOperator, condValue, condKeyword, condSemantic, condTier, condTags };
      if (conditionType === 'Check Contact Field') preview = `${condField} ${condOperator} "${condValue}"`;
      else if (conditionType === 'Check Message Content') preview = `Contains: "${condKeyword}"`;
      else if (conditionType === 'Check Loyalty Tier') preview = `Tier = ${condTier}`;
      else if (conditionType === 'Check Tag') preview = `Has tag: ${condTags.join(', ')}`;
    } else if (type === 'SUPER_RANDOMIZER') {
      config = { paths: abPaths };
      preview = abPaths.map(p => `${p.label} ${p.pct}%`).join(' · ');
    } else if (type === 'SMART_DELAY') {
      config = { delayValue, delayUnit, only24h, queueOutside };
      preview = `Wait ${delayValue} ${delayUnit}${only24h ? ' · 24h window' : ''}`;
    } else if (type === 'FRICTION_RECOVERY') {
      config = { maxRetries };
      preview = `Max retries: ${maxRetries}`;
    } else if (type === 'AI_STEP') {
      config = { knowledgeBase, strictness, ifUnsure, aiCollect, aiField, aiValidation, aiSaveResponseTo, aiMaxRetries };
      preview = `KB: ${knowledgeBase} · ${strictness}`;
    } else if (type === 'CUSTOM_CODE') {
      config = { customCode };
      preview = customCode.slice(0, 60);
    } else if (type === 'ACTION_BLOCK') {
      config = { actionType, actionTag, actionField, actionFieldValue, actionNotifyEmail, actionSequence };
      if (actionType === 'Add Tag' || actionType === 'Remove Tag') preview = `${actionType}: ${actionTag}`;
      else if (actionType === 'Set Contact Field') preview = `${actionField} = ${actionFieldValue}`;
      else if (actionType === 'Notify Team') preview = `Notify: ${actionNotifyEmail}`;
      else if (actionType === 'Subscribe to Sequence') preview = `Sequence: ${actionSequence}`;
    } else if (type === 'OUTBOUND_WEBHOOK') {
      config = { webhookUrl, webhookMethod, webhookHeaders, webhookBody };
      preview = `${webhookMethod} ${webhookUrl}`;
    } else if (type === 'TIKTOK_SHOP_PRODUCT') {
      config = { cardTitle, cardSubtitle, cardImage, cardButtons };
      preview = cardTitle || 'Product showcase';
    }

    onSave(config, label.trim() || NODE_LABELS[type]);
  }

  const cat = NODE_CATEGORY[type];
  const isTrigger = cat === 'TRIGGER';

  return (
    <div className="w-full md:w-[320px] flex-shrink-0 bg-[#111318] border-l border-[#1E2130] flex flex-col overflow-hidden absolute md:relative inset-0 md:inset-auto z-30 md:z-auto">
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-[#1E2130] flex-shrink-0"
        style={{ borderLeftColor: color, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span style={{ color }}>{NODE_ICONS[type]}</span>
          <span className="text-xs font-bold text-[#F0F2FF] truncate">{NODE_LABELS[type]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#4B5068] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 space-y-5">

          {/* Node name */}
          <PanelSection>
            <FieldLabel>Node Name</FieldLabel>
            <StyledInput
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={NODE_LABELS[type]}
            />
          </PanelSection>

          <Divider />

          {/* ════════════════════════════════════
              TRIGGER CONFIG
          ════════════════════════════════════ */}
          {isTrigger && (
            <PanelSection title="Trigger Settings">
              <div className="space-y-3">
                <div>
                  <FieldLabel>Trigger Type</FieldLabel>
                  <StyledSelect value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                    <optgroup label="Instagram">
                      <option value="IG_POST_COMMENT">Post/Reel Comment</option>
                      <option value="IG_STORY_REPLY">Story Reply</option>
                      <option value="IG_STORY_MENTION">Story Mention</option>
                      <option value="IG_DIRECT_MESSAGE">Instagram DM</option>
                      <option value="IG_POST_SHARE">Post/Reel Share</option>
                      <option value="IG_LIVE_COMMENT">Live Comments</option>
                      <option value="IG_KEYWORD">Keyword Trigger</option>
                    </optgroup>
                    <optgroup label="Facebook">
                      <option value="FB_POST_COMMENT">Post Comment</option>
                      <option value="FB_DIRECT_MESSAGE">Facebook Message</option>
                      <option value="FB_KEYWORD">Keyword</option>
                    </optgroup>
                    <optgroup label="TikTok">
                      <option value="TT_VIDEO_COMMENT">Video Comment</option>
                      <option value="TT_DIRECT_MESSAGE">TikTok DM</option>
                      <option value="TT_LIVE_COMMENT">Live Comment</option>
                    </optgroup>
                    <optgroup label="WhatsApp">
                      <option value="WA_MESSAGE">Incoming Message</option>
                      <option value="WA_QR_SCAN">QR Scan</option>
                    </optgroup>
                    <optgroup label="Contact">
                      <option value="CONTACT_CREATED">New Contact</option>
                      <option value="CONTACT_TAG_ADDED">Tag Applied</option>
                      <option value="CONTACT_FIELD_CHANGED">Field Changed</option>
                      <option value="CONTACT_SEGMENT_ENTRY">Segment Entry</option>
                    </optgroup>
                    <optgroup label="System">
                      <option value="SYSTEM_SCHEDULED">Scheduled Time</option>
                      <option value="SYSTEM_WEBHOOK">Incoming Webhook</option>
                      <option value="SYSTEM_MANUAL">Manual Trigger</option>
                    </optgroup>
                    <optgroup label="Legacy">
                      <option value="COMMENT_TO_DM">Comment → DM</option>
                      <option value="STORY_MENTION">Story Mention</option>
                      <option value="MANUAL">Manual</option>
                    </optgroup>
                  </StyledSelect>
                </div>

                {/* Keyword configuration for comment/keyword triggers */}
                {(triggerType.startsWith('IG_') && triggerType.includes('COMMENT') ||
                  triggerType.startsWith('TT_') && triggerType.includes('COMMENT') ||
                  triggerType.startsWith('FB_') && triggerType.includes('COMMENT') ||
                  triggerType.includes('KEYWORD') ||
                  triggerType === 'COMMENT_TO_DM') && (
                  <div>
                    <FieldLabel>Keywords <span className="text-[#4B5068] normal-case font-normal">(any match triggers flow)</span></FieldLabel>
                    <ChipInput
                      chips={keywords}
                      onAdd={v => setKeywords(prev => [...prev, v])}
                      onRemove={v => setKeywords(prev => prev.filter(k => k !== v))}
                      placeholder="e.g. price, buy, link"
                      color="blue"
                    />
                    <div className="mt-2">
                      <Toggle
                        checked={semanticMatch}
                        onChange={setSemanticMatch}
                        label="Semantic matching (match similar meaning)"
                        size="sm"
                      />
                    </div>
                  </div>
                )}

                {/* Scheduled time configuration */}
                {(triggerType === 'SYSTEM_SCHEDULED' || triggerType === 'CONTACT_DATETIME') && (
                  <div className="space-y-2">
                    <div>
                      <FieldLabel>Schedule Type</FieldLabel>
                      <StyledSelect>
                        <option>One-time</option>
                        <option>Daily</option>
                        <option>Weekly</option>
                        <option>Monthly</option>
                      </StyledSelect>
                    </div>
                    <div>
                      <FieldLabel>Run At</FieldLabel>
                      <StyledInput type="time" />
                    </div>
                    <InfoBox>
                      Scheduled triggers will run automatically at the specified time for all matching contacts.
                    </InfoBox>
                  </div>
                )}

                {/* Contact event configuration */}
                {triggerType.startsWith('CONTACT_') && (
                  <div className="space-y-2">
                    {triggerType === 'CONTACT_FIELD_CHANGED' && (
                      <div>
                        <FieldLabel>Watch Field</FieldLabel>
                        <StyledSelect>
                          <option>Any custom field</option>
                          <option>email</option>
                          <option>phone</option>
                          <option>loyalty_score</option>
                        </StyledSelect>
                      </div>
                    )}
                    {triggerType === 'CONTACT_TAG_ADDED' && (
                      <div>
                        <FieldLabel>Tag to Watch</FieldLabel>
                        <StyledInput placeholder="e.g. vip, purchased" />
                      </div>
                    )}
                    {triggerType === 'CONTACT_SEGMENT_ENTRY' && (
                      <div>
                        <FieldLabel>Segment</FieldLabel>
                        <StyledSelect>
                          <option>All segments</option>
                        </StyledSelect>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <FieldLabel>Active Hours</FieldLabel>
                  <div className="flex items-center gap-2">
                    <StyledInput
                      type="time"
                      value={activeHoursFrom}
                      onChange={e => setActiveHoursFrom(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-[#4B5068] text-xs font-medium">to</span>
                    <StyledInput
                      type="time"
                      value={activeHoursTo}
                      onChange={e => setActiveHoursTo(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Platform Filter</FieldLabel>
                  <StyledSelect value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}>
                    <option value="ALL">All Platforms</option>
                    <option value="INSTAGRAM">Instagram</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="TIKTOK">TikTok</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </StyledSelect>
                </div>
              </div>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              SEND MESSAGE CONFIG
          ════════════════════════════════════ */}
          {(type === 'SEND_MESSAGE' || type === 'SEND_TEMPLATE' || type === 'SEND_PRODUCT') && (
            <>
              <PanelSection title="Message Content">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel>Message Text</FieldLabel>
                    <span className={`text-[10px] font-semibold tabular-nums ${message.length > charLimit * 0.9 ? 'text-red-400' : message.length > charLimit * 0.7 ? 'text-amber-400' : 'text-[#4B5068]'}`}>
                      {message.length}/{charLimit}
                    </span>
                  </div>
                  <StyledTextarea
                    value={message}
                    onChange={e => setMessage((e.target as HTMLTextAreaElement).value)}
                    placeholder={`Hi {{contact.name}}! Thanks for reaching out 👋\n\nHere's the link you requested:`}
                    rows={5}
                    maxLength={charLimit}
                  />
                </div>

                <div>
                  <FieldLabel><Variable className="inline w-3 h-3 mr-1" />Insert Variable</FieldLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map(v => (
                      <button
                        key={v}
                        onClick={() => setMessage(prev => prev + v)}
                        className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-mono hover:bg-blue-500/20 border border-blue-500/15 transition-colors"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message preview */}
                {(message || quickButtons.length > 0) && (
                  <div>
                    <FieldLabel>Preview</FieldLabel>
                    <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130]">
                      {message && (
                        <p className="text-xs text-[#F0F2FF] whitespace-pre-wrap leading-relaxed">{message}</p>
                      )}
                      {quickButtons.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {quickButtons.map((btn, i) => (
                            <span key={i} className="px-3 py-1 rounded-full border border-blue-500/30 text-xs text-blue-400 bg-blue-500/8 font-medium">
                              {btn.label || 'Button'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </PanelSection>

              <Divider />

              <PanelSection title="Quick Reply Buttons">
                <div className="space-y-2">
                  {quickButtons.length === 0 && (
                    <p className="text-[11px] text-[#4B5068] italic">No buttons added. Max 3 quick replies.</p>
                  )}
                  {quickButtons.map((btn, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={btn.label}
                          onChange={e => setQuickButtons(prev => prev.map((b, j) => j === i ? { ...b, label: e.target.value } : b))}
                          placeholder="Button label"
                          className="flex-1 h-7 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={() => setQuickButtons(prev => prev.filter((_, j) => j !== i))}
                          className="text-[#4B5068] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="relative">
                        <select
                          value={btn.action}
                          onChange={e => setQuickButtons(prev => prev.map((b, j) => j === i ? { ...b, action: e.target.value } : b))}
                          className="h-7 w-full appearance-none rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 pr-7 focus:outline-none focus:border-blue-500"
                        >
                          <option value="postback">Postback</option>
                          <option value="open_url">Open URL</option>
                          <option value="trigger_flow">Trigger Flow</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4B5068] pointer-events-none" />
                      </div>
                      <input
                        value={btn.value}
                        onChange={e => setQuickButtons(prev => prev.map((b, j) => j === i ? { ...b, value: e.target.value } : b))}
                        placeholder={btn.action === 'open_url' ? 'https://...' : btn.action === 'trigger_flow' ? 'Flow name or ID' : 'Action payload'}
                        className="h-7 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                  {quickButtons.length < 3 && (
                    <button
                      onClick={() => setQuickButtons(prev => [...prev, { label: `Button ${prev.length + 1}`, action: 'postback', value: '' }])}
                      className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl border border-dashed border-[#2A2E42] text-xs text-[#8B90A7] hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Button
                    </button>
                  )}
                </div>
              </PanelSection>

              <Divider />

              <PanelSection title="Collect Response">
                <Toggle
                  checked={collectResponse}
                  onChange={setCollectResponse}
                  label="Save reply to contact field"
                  size="sm"
                />
                {collectResponse && (
                  <div className="mt-3 space-y-2.5 pl-0">
                    <div>
                      <FieldLabel>Save to Field</FieldLabel>
                      <StyledInput
                        value={responseField}
                        onChange={e => setResponseField(e.target.value)}
                        placeholder="e.g. user_email"
                      />
                    </div>
                    <div>
                      <FieldLabel>Validation</FieldLabel>
                      <StyledSelect value={responseValidation} onChange={e => setResponseValidation(e.target.value)}>
                        <option value="text">Any text</option>
                        <option value="email">Email address</option>
                        <option value="phone">Phone number</option>
                        <option value="number">Number</option>
                      </StyledSelect>
                    </div>
                    <div>
                      <FieldLabel>Max Retries Before Fallback</FieldLabel>
                      <StyledInput
                        type="number"
                        value={maxRetries}
                        onChange={e => setMaxRetries(Number(e.target.value))}
                        min={0} max={5}
                        className="w-24"
                      />
                    </div>
                  </div>
                )}
              </PanelSection>
            </>
          )}

          {/* ════════════════════════════════════
              SEND DM CARD / PRODUCT CARD
          ════════════════════════════════════ */}
          {(type === 'SEND_DM_CARD' || type === 'TIKTOK_SHOP_PRODUCT') && (
            <>
              <PanelSection title="Card Content">
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Card Title</FieldLabel>
                    <StyledInput value={cardTitle} onChange={e => setCardTitle(e.target.value)} placeholder="e.g. Check out our new drop!" />
                  </div>
                  <div>
                    <FieldLabel>Subtitle</FieldLabel>
                    <StyledInput value={cardSubtitle} onChange={e => setCardSubtitle(e.target.value)} placeholder="Short description..." />
                  </div>
                  <div>
                    <FieldLabel>Image URL</FieldLabel>
                    <StyledInput value={cardImage} onChange={e => setCardImage(e.target.value)} placeholder="https://..." />
                  </div>

                  {/* Card preview */}
                  {(cardTitle || cardImage) && (
                    <div>
                      <FieldLabel>Preview</FieldLabel>
                      <div className="rounded-xl overflow-hidden border border-[#2A2E42] bg-[#0A0B0F]">
                        {cardImage && (
                          <div className="h-24 bg-[#1A1C24] flex items-center justify-center text-[#4B5068] text-xs overflow-hidden">
                            <img src={cardImage} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                        )}
                        <div className="p-3">
                          {cardTitle && <p className="text-sm font-semibold text-[#F0F2FF]">{cardTitle}</p>}
                          {cardSubtitle && <p className="text-xs text-[#8B90A7] mt-0.5">{cardSubtitle}</p>}
                          {cardButtons.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-2.5">
                              {cardButtons.map((btn, i) => (
                                <span key={i} className="flex items-center justify-center h-8 rounded-lg border border-blue-500/30 text-xs text-blue-400 bg-blue-500/8 font-medium">
                                  {btn.label || 'Button'}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </PanelSection>

              <Divider />

              <PanelSection title="Action Buttons">
                <div className="space-y-2">
                  {cardButtons.map((btn, i) => (
                    <div key={i} className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          value={btn.label}
                          onChange={e => setCardButtons(prev => prev.map((b, j) => j === i ? { ...b, label: e.target.value } : b))}
                          placeholder="Button label"
                          className="flex-1 h-7 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                        />
                        <button onClick={() => setCardButtons(prev => prev.filter((_, j) => j !== i))} className="text-[#4B5068] hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="relative">
                        <select
                          value={btn.action}
                          onChange={e => setCardButtons(prev => prev.map((b, j) => j === i ? { ...b, action: e.target.value } : b))}
                          className="h-7 w-full appearance-none rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 pr-7 focus:outline-none focus:border-blue-500"
                        >
                          <option value="open_url">Open URL</option>
                          <option value="postback">Postback</option>
                          <option value="trigger_flow">Trigger Flow</option>
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#4B5068] pointer-events-none" />
                      </div>
                      <input
                        value={btn.value}
                        onChange={e => setCardButtons(prev => prev.map((b, j) => j === i ? { ...b, value: e.target.value } : b))}
                        placeholder={btn.action === 'open_url' ? 'https://...' : 'Payload'}
                        className="h-7 w-full rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                  {cardButtons.length < 3 && (
                    <button
                      onClick={() => setCardButtons(prev => [...prev, { label: `Button ${prev.length + 1}`, action: 'open_url', value: '' }])}
                      className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl border border-dashed border-[#2A2E42] text-xs text-[#8B90A7] hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Button
                    </button>
                  )}
                </div>
              </PanelSection>
            </>
          )}

          {/* ════════════════════════════════════
              COLLECT INPUT
          ════════════════════════════════════ */}
          {type === 'COLLECT_INPUT' && (
            <PanelSection title="Collect User Input">
              <div className="space-y-3">
                <div>
                  <FieldLabel>Question to Ask</FieldLabel>
                  <StyledTextarea
                    value={ciQuestion}
                    onChange={e => setCiQuestion((e.target as HTMLTextAreaElement).value)}
                    placeholder="What's your email address?"
                    rows={3}
                  />
                </div>
                <div>
                  <FieldLabel>Save Response to Field</FieldLabel>
                  <StyledInput value={ciField} onChange={e => setCiField(e.target.value)} placeholder="e.g. user_email" />
                </div>
                <div>
                  <FieldLabel>Validation Type</FieldLabel>
                  <StyledSelect value={ciValidation} onChange={e => setCiValidation(e.target.value)}>
                    <option value="text">Any text</option>
                    <option value="email">Email address</option>
                    <option value="phone">Phone number</option>
                    <option value="number">Number</option>
                  </StyledSelect>
                </div>
                <div>
                  <FieldLabel>Max Retries</FieldLabel>
                  <StyledInput
                    type="number"
                    value={ciMaxRetries}
                    onChange={e => setCiMaxRetries(Number(e.target.value))}
                    min={0} max={5}
                    className="w-24"
                  />
                </div>
              </div>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              CONDITION
          ════════════════════════════════════ */}
          {type === 'CONDITION' && (
            <>
              <PanelSection title="Condition">
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Condition Type</FieldLabel>
                    <StyledSelect value={conditionType} onChange={e => setConditionType(e.target.value)}>
                      <option>Check Contact Field</option>
                      <option>Check Message Content</option>
                      <option>Check Loyalty Tier</option>
                      <option>Check Tag</option>
                    </StyledSelect>
                  </div>

                  {conditionType === 'Check Contact Field' && (
                    <div className="space-y-2.5">
                      <div>
                        <FieldLabel>Field</FieldLabel>
                        <StyledSelect value={condField} onChange={e => setCondField(e.target.value)}>
                          <option value="email">Email</option>
                          <option value="phone">Phone</option>
                          <option value="first_name">First Name</option>
                          <option value="loyalty_score">Loyalty Score</option>
                          <option value="sentiment_score">Sentiment Score</option>
                          <option value="total_orders">Total Orders</option>
                          <option value="custom_field_1">Custom Field 1</option>
                        </StyledSelect>
                      </div>
                      <div>
                        <FieldLabel>Operator</FieldLabel>
                        <StyledSelect value={condOperator} onChange={e => setCondOperator(e.target.value)}>
                          <option value="equals">Equals</option>
                          <option value="not_equals">Not equals</option>
                          <option value="contains">Contains</option>
                          <option value="not_contains">Does not contain</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                          <option value="is_set">Is set</option>
                          <option value="is_not_set">Is not set</option>
                        </StyledSelect>
                      </div>
                      {condOperator !== 'is_set' && condOperator !== 'is_not_set' && (
                        <div>
                          <FieldLabel>Value</FieldLabel>
                          <StyledInput value={condValue} onChange={e => setCondValue(e.target.value)} placeholder="Comparison value" />
                        </div>
                      )}
                    </div>
                  )}

                  {conditionType === 'Check Message Content' && (
                    <div className="space-y-2.5">
                      <div>
                        <FieldLabel>Keyword or Phrase</FieldLabel>
                        <StyledInput value={condKeyword} onChange={e => setCondKeyword(e.target.value)} placeholder="e.g. price, how much" />
                      </div>
                      <Toggle
                        checked={condSemantic}
                        onChange={setCondSemantic}
                        label="Semantic matching (similar intent)"
                        size="sm"
                      />
                    </div>
                  )}

                  {conditionType === 'Check Loyalty Tier' && (
                    <div>
                      <FieldLabel>Loyalty Tier</FieldLabel>
                      <StyledSelect value={condTier} onChange={e => setCondTier(e.target.value)}>
                        <option value="NEWBIE">Newbie</option>
                        <option value="FAN">Fan</option>
                        <option value="ADVOCATE">Advocate</option>
                      </StyledSelect>
                    </div>
                  )}

                  {conditionType === 'Check Tag' && (
                    <div>
                      <FieldLabel>Tags (contact must have all)</FieldLabel>
                      <ChipInput
                        chips={condTags}
                        onAdd={v => setCondTags(prev => [...prev, v])}
                        onRemove={v => setCondTags(prev => prev.filter(t => t !== v))}
                        placeholder="Tag name + Enter"
                        color="amber"
                      />
                    </div>
                  )}
                </div>
              </PanelSection>

              <Divider />

              <div className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] space-y-2">
                <p className="text-[10px] font-bold text-[#4B5068] uppercase tracking-wider mb-2">Handle Legend</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0" />
                  <p className="text-[11px] text-[#8B90A7]"><span className="text-green-400 font-semibold">YES</span> — condition is true</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0" />
                  <p className="text-[11px] text-[#8B90A7]"><span className="text-red-400 font-semibold">NO</span> — condition is false</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500 flex-shrink-0" />
                  <p className="text-[11px] text-[#8B90A7]"><span className="text-blue-400 font-semibold">DEFAULT</span> — fallback path</p>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════
              A/B SPLIT
          ════════════════════════════════════ */}
          {type === 'SUPER_RANDOMIZER' && (
            <PanelSection title="A/B Split Paths">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-[#8B90A7]">Traffic distribution</p>
                  <span className={`text-xs font-bold ${abValid ? 'text-green-400' : 'text-red-400'}`}>
                    {abTotal}% {abValid ? '✓' : `(must = 100%)`}
                  </span>
                </div>

                {abPaths.map((path, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#0A0B0F] border border-[#1E2130] space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={path.label}
                        onChange={e => setAbPaths(prev => prev.map((p, j) => j === i ? { ...p, label: e.target.value } : p))}
                        className="flex-1 h-7 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs font-semibold text-[#F0F2FF] px-2.5 focus:outline-none focus:border-blue-500"
                      />
                      {abPaths.length > 2 && (
                        <button onClick={() => setAbPaths(prev => prev.filter((_, j) => j !== i))} className="text-[#4B5068] hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range" min={0} max={100} step={5}
                        value={path.pct}
                        onChange={e => setAbPaths(prev => prev.map((p, j) => j === i ? { ...p, pct: Number(e.target.value) } : p))}
                        className="flex-1 h-1.5 accent-amber-400"
                      />
                      <div className="flex items-center gap-1 w-16 flex-shrink-0">
                        <input
                          type="number" min={0} max={100}
                          value={path.pct}
                          onChange={e => setAbPaths(prev => prev.map((p, j) => j === i ? { ...p, pct: Number(e.target.value) } : p))}
                          className="w-10 h-7 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs text-[#F0F2FF] text-center focus:outline-none focus:border-amber-500"
                        />
                        <span className="text-[#4B5068] text-xs">%</span>
                      </div>
                    </div>
                    {path.conv && (
                      <p className="text-[10px] text-green-400 font-medium">Conversion: {path.conv}</p>
                    )}
                    <div className="h-1 bg-[#1A1C24] rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${path.pct}%` }} />
                    </div>
                  </div>
                ))}

                {abPaths.length < 5 && (
                  <button
                    onClick={() => setAbPaths(prev => [...prev, { label: `Path ${String.fromCharCode(65 + prev.length)}`, pct: 0 }])}
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-xl border border-dashed border-[#2A2E42] text-xs text-[#8B90A7] hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Path
                  </button>
                )}

                {!abValid && (
                  <WarningBox>Percentages must add up to exactly 100%. Current total: {abTotal}%</WarningBox>
                )}
              </div>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              SMART DELAY
          ════════════════════════════════════ */}
          {type === 'SMART_DELAY' && (
            <PanelSection title="Delay Settings">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <FieldLabel>Delay</FieldLabel>
                    <StyledInput
                      type="number"
                      value={delayValue}
                      onChange={e => setDelayValue(Number(e.target.value))}
                      min={1}
                    />
                  </div>
                  <div className="flex-1">
                    <FieldLabel>Unit</FieldLabel>
                    <StyledSelect value={delayUnit} onChange={e => setDelayUnit(e.target.value)}>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </StyledSelect>
                  </div>
                </div>

                <Toggle
                  checked={only24h}
                  onChange={setOnly24h}
                  label="Send within 24h window only"
                  size="sm"
                />

                {only24h && (
                  <Toggle
                    checked={queueOutside}
                    onChange={setQueueOutside}
                    label="Queue for next window if outside"
                    size="sm"
                  />
                )}

                {delayExceeds24h() && (
                  <div className="p-3 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <p className="text-xs font-semibold text-amber-400">24H Window Warning</p>
                    </div>
                    <p className="text-[11px] text-[#8B90A7] leading-relaxed">
                      A delay of {delayValue} {delayUnit} will push contacts outside their 24-hour messaging window.
                      {!only24h && ' Enable "Send within 24h window only" or add a Message Tag to downstream nodes.'}
                    </p>
                  </div>
                )}
              </div>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              FRICTION RECOVERY
          ════════════════════════════════════ */}
          {type === 'FRICTION_RECOVERY' && (
            <PanelSection title="Retry Settings">
              <div>
                <FieldLabel>Max Retries</FieldLabel>
                <StyledInput
                  type="number"
                  value={maxRetries}
                  onChange={e => setMaxRetries(Number(e.target.value))}
                  min={1} max={10}
                  className="w-28"
                />
              </div>
              <InfoBox>
                When a downstream action fails, this node will retry up to {maxRetries} time{maxRetries !== 1 ? 's' : ''} before routing to the failure path.
              </InfoBox>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              AI STEP
          ════════════════════════════════════ */}
          {type === 'AI_STEP' && (
            <>
              <PanelSection title="AI Configuration">
                <div className="space-y-3">
                  <div>
                    <FieldLabel>Knowledge Base</FieldLabel>
                    <StyledSelect value={knowledgeBase} onChange={e => setKnowledgeBase(e.target.value)}>
                      <option>Product FAQ</option>
                      <option>Shipping Policy</option>
                      <option>Returns Policy</option>
                      <option>Brand Guidelines</option>
                      <option>Pricing</option>
                    </StyledSelect>
                  </div>

                  <div>
                    <FieldLabel>Response Strictness</FieldLabel>
                    <div className="grid grid-cols-3 gap-1 p-1 bg-[#0A0B0F] rounded-xl border border-[#1E2130]">
                      {(['STRICT', 'BALANCED', 'CREATIVE'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setStrictness(s)}
                          className={`py-2 rounded-lg text-[10px] font-bold tracking-wider transition-all ${
                            strictness === s
                              ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                              : 'text-[#4B5068] hover:text-[#8B90A7]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[#4B5068] mt-1.5">
                      {strictness === 'STRICT' && 'Only answers from the knowledge base. No hallucinations.'}
                      {strictness === 'BALANCED' && 'Primarily knowledge base with reasonable inference.'}
                      {strictness === 'CREATIVE' && 'Creative responses with knowledge base as context.'}
                    </p>
                  </div>

                  <div>
                    <FieldLabel>When AI is Unsure</FieldLabel>
                    <StyledSelect value={ifUnsure} onChange={e => setIfUnsure(e.target.value)}>
                      <option>Hand off to human</option>
                      <option>Ask clarifying question</option>
                      <option>Send fallback message</option>
                    </StyledSelect>
                  </div>
                </div>
              </PanelSection>

              <Divider />

              <PanelSection title="Collect User Input">
                <Toggle
                  checked={aiCollect}
                  onChange={setAiCollect}
                  label="AI asks a question and waits for reply"
                  size="sm"
                />
                {aiCollect && (
                  <div className="mt-3 space-y-2.5">
                    <div>
                      <FieldLabel>Input Field Name</FieldLabel>
                      <StyledInput value={aiField} onChange={e => setAiField(e.target.value)} placeholder="e.g. order_number" />
                      <p className="text-[10px] text-[#4B5068] mt-1">Stored in contact's custom_fields</p>
                    </div>
                    <div>
                      <FieldLabel>Validation</FieldLabel>
                      <StyledSelect value={aiValidation} onChange={e => setAiValidation(e.target.value)}>
                        <option value="text">Any text</option>
                        <option value="email">Email address</option>
                        <option value="phone">Phone number</option>
                        <option value="number">Number</option>
                      </StyledSelect>
                    </div>
                    <div>
                      <FieldLabel>Save Response To</FieldLabel>
                      <StyledInput value={aiSaveResponseTo} onChange={e => setAiSaveResponseTo(e.target.value)} placeholder="contact field name" />
                    </div>
                    <div>
                      <FieldLabel>Max Retries</FieldLabel>
                      <StyledInput
                        type="number"
                        value={aiMaxRetries}
                        onChange={e => setAiMaxRetries(Number(e.target.value))}
                        min={0} max={5}
                        className="w-24"
                      />
                    </div>
                  </div>
                )}
              </PanelSection>
            </>
          )}

          {/* ════════════════════════════════════
              CUSTOM CODE
          ════════════════════════════════════ */}
          {type === 'CUSTOM_CODE' && (
            <PanelSection title="JavaScript Code">
              <div>
                <FieldLabel>Code <span className="text-[#4B5068] normal-case font-normal">(runs in sandbox)</span></FieldLabel>
                <textarea
                  value={customCode}
                  onChange={e => setCustomCode(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full rounded-xl bg-[#0A0B0F] border border-[#2A2E42] text-xs text-green-400 font-mono px-3 py-2.5 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 resize-y leading-relaxed"
                />
              </div>
              <InfoBox>
                Available: <code className="text-teal-400">contact</code>, <code className="text-teal-400">flow</code>, <code className="text-teal-400">brand</code>. Return an object to update contact fields.
              </InfoBox>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              ACTION BLOCK
          ════════════════════════════════════ */}
          {type === 'ACTION_BLOCK' && (
            <PanelSection title="Action Settings">
              <div className="space-y-3">
                <div>
                  <FieldLabel>Action Type</FieldLabel>
                  <StyledSelect value={actionType} onChange={e => setActionType(e.target.value)}>
                    <option>Add Tag</option>
                    <option>Remove Tag</option>
                    <option>Set Contact Field</option>
                    <option>Notify Team</option>
                    <option>Subscribe to Sequence</option>
                  </StyledSelect>
                </div>

                {(actionType === 'Add Tag' || actionType === 'Remove Tag') && (
                  <div>
                    <FieldLabel>Tag Name</FieldLabel>
                    <StyledInput value={actionTag} onChange={e => setActionTag(e.target.value)} placeholder="e.g. vip-customer" />
                  </div>
                )}

                {actionType === 'Set Contact Field' && (
                  <>
                    <div>
                      <FieldLabel>Field Name</FieldLabel>
                      <StyledInput value={actionField} onChange={e => setActionField(e.target.value)} placeholder="e.g. lead_score" />
                    </div>
                    <div>
                      <FieldLabel>Value</FieldLabel>
                      <StyledInput value={actionFieldValue} onChange={e => setActionFieldValue(e.target.value)} placeholder="e.g. 100 or {{flow.keyword}}" />
                    </div>
                  </>
                )}

                {actionType === 'Notify Team' && (
                  <div>
                    <FieldLabel>Notify Email / Slack</FieldLabel>
                    <StyledInput value={actionNotifyEmail} onChange={e => setActionNotifyEmail(e.target.value)} placeholder="team@example.com or slack webhook" />
                  </div>
                )}

                {actionType === 'Subscribe to Sequence' && (
                  <div>
                    <FieldLabel>Sequence Name or ID</FieldLabel>
                    <StyledInput value={actionSequence} onChange={e => setActionSequence(e.target.value)} placeholder="e.g. Welcome Sequence" />
                  </div>
                )}
              </div>
            </PanelSection>
          )}

          {/* ════════════════════════════════════
              OUTBOUND WEBHOOK
          ════════════════════════════════════ */}
          {type === 'OUTBOUND_WEBHOOK' && (
            <PanelSection title="Webhook Settings">
              <div className="space-y-3">
                <div>
                  <FieldLabel>URL</FieldLabel>
                  <StyledInput value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://api.example.com/webhook" />
                </div>
                <div>
                  <FieldLabel>Method</FieldLabel>
                  <StyledSelect value={webhookMethod} onChange={e => setWebhookMethod(e.target.value)}>
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </StyledSelect>
                </div>
                <div>
                  <FieldLabel>Headers <span className="text-[#4B5068] normal-case font-normal">(JSON)</span></FieldLabel>
                  <StyledTextarea
                    value={webhookHeaders}
                    onChange={e => setWebhookHeaders((e.target as HTMLTextAreaElement).value)}
                    placeholder={'{\n  "Authorization": "Bearer ..."\n}'}
                    rows={3}
                  />
                </div>
                {webhookMethod !== 'GET' && (
                  <div>
                    <FieldLabel>Request Body <span className="text-[#4B5068] normal-case font-normal">(JSON)</span></FieldLabel>
                    <StyledTextarea
                      value={webhookBody}
                      onChange={e => setWebhookBody((e.target as HTMLTextAreaElement).value)}
                      placeholder={'{\n  "contact_id": "{{contact.id}}",\n  "event": "flow_triggered"\n}'}
                      rows={5}
                    />
                  </div>
                )}
              </div>
            </PanelSection>
          )}

        </div>
      </div>

      {/* Footer actions */}
      <div className="flex-shrink-0 p-4 border-t border-[#1E2130] flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 h-9 flex items-center justify-center gap-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          Apply Changes
        </button>
        <button
          onClick={onDelete}
          className="h-9 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
          title="Delete node"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

// Inner component that uses ReactFlow hooks
function FlowBuilderContent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tenant, brand } = useAuth();
  const { zoomIn, zoomOut, setViewport: setFlowViewport, getViewport } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Record<string, unknown>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [flowName, setFlowName] = useState('Untitled Flow');
  const [editingName, setEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<FlowStatus>('DRAFT');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<PickerMode>('trigger');
  const [pickerSourceNodeId, setPickerSourceNodeId] = useState<string | null>(null);

  const [showValidation, setShowValidation] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testInput, setTestInput] = useState('');
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<null | { steps: { label: string; ok: boolean; detail: string }[] }>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showMobilePalette, setShowMobilePalette] = useState(false);

  // ── Undo/Redo history ──
  const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isUndoRedo, setIsUndoRedo] = useState(false);

  // Save to history
  const saveToHistory = useCallback((newNodes: Node[], newEdges: Edge[]) => {
    if (isUndoRedo) return;
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ nodes: JSON.parse(JSON.stringify(newNodes)), edges: JSON.parse(JSON.stringify(newEdges)) });
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, isUndoRedo]);

  // Undo
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    setIsUndoRedo(true);
    const prevState = history[historyIndex - 1];
    if (prevState) {
      setNodes(JSON.parse(JSON.stringify(prevState.nodes)));
      setEdges(JSON.parse(JSON.stringify(prevState.edges)));
      setHistoryIndex(prev => prev - 1);
    }
    setTimeout(() => setIsUndoRedo(false), 50);
  }, [history, historyIndex, setNodes, setEdges]);

  // Redo
  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    setIsUndoRedo(true);
    const nextState = history[historyIndex + 1];
    if (nextState) {
      setNodes(JSON.parse(JSON.stringify(nextState.nodes)));
      setEdges(JSON.parse(JSON.stringify(nextState.edges)));
      setHistoryIndex(prev => prev + 1);
    }
    setTimeout(() => setIsUndoRedo(false), 50);
  }, [history, historyIndex, setNodes, setEdges]);

  // Clipboard for copy/paste
  const [clipboard, setClipboard] = useState<{ nodes: Node[]; edges: Edge[] } | null>(null);

  // Viewport state for zoom sync
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // ── Save history when nodes/edges change ──
  useEffect(() => {
    if (nodes.length === 0 && edges.length === 0) return;
    saveToHistory(nodes, edges);
  }, [nodes, edges, saveToHistory]);

  // ── Sync zoom state with viewport ──
  const handleMoveEnd = useCallback((event: React.SyntheticEvent, newViewport: Viewport) => {
    setViewport(newViewport);
    setZoom(newViewport.zoom);
  }, []);

  // ── Load flow from Supabase ──
  useEffect(() => {
    if (!id || !tenant) return;

    async function load() {
      setLoading(true);
      try {
        const { data: flow } = await supabase
          .from('flows')
          .select('name, status')
          .eq('id', id)
          .single();

        if (flow) {
          setFlowName(flow.name || 'Untitled Flow');
          setStatus(flow.status || 'DRAFT');
        }

        const { data: dbNodes } = await supabase
          .from('flow_nodes')
          .select('*')
          .eq('flow_id', id);

        const rfNodes: Node[] = (dbNodes || []).map((n: any) => ({
          id: n.id,
          type: 'flowNode',
          position: { x: Number(n.position_x), y: Number(n.position_y) },
          data: {
            nodeType: n.node_type,
            label: n.label || NODE_LABELS[n.node_type] || '',
            preview: buildPreview(n.node_type, n.config || {}),
            config: n.config || {},
            dbId: n.id,
            onPlusClick: (nodeId: string) => openPicker('action', nodeId),
          },
        }));
        setNodes(rfNodes);

        const { data: dbEdges } = await supabase
          .from('flow_edges')
          .select('*')
          .eq('flow_id', id);

        const rfEdges: Edge[] = (dbEdges || []).map((e: any) => ({
          id: e.id,
          source: e.source_node_id,
          target: e.target_node_id,
          sourceHandle: e.source_handle || null,
          type: 'smoothstep',
          label: e.edge_label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: '#2A2E42' },
          style: { stroke: '#2A2E42', strokeWidth: 1.5 },
          data: { dbId: e.id },
        }));
        setEdges(rfEdges);
      } catch (err) {
        console.error('Error loading flow:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, tenant, setNodes, setEdges]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd + S: Save
      if (isMod && e.key === 's') {
        e.preventDefault();
        saveFlow();
      }
      // Ctrl/Cmd + Z: Undo
      else if (isMod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y: Redo
      else if (isMod && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        redo();
      }
      // Ctrl/Cmd + C: Copy selected nodes
      else if (isMod && e.key === 'c' && selectedNode) {
        e.preventDefault();
        const selectedNodes = nodes.filter(n => n.id === selectedNode.id);
        const selectedEdges = edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id);
        setClipboard({ nodes: JSON.parse(JSON.stringify(selectedNodes)), edges: JSON.parse(JSON.stringify(selectedEdges)) });
      }
      // Ctrl/Cmd + V: Paste
      else if (isMod && e.key === 'v' && clipboard) {
        e.preventDefault();
        const offset = 40;
        const newNodes = clipboard.nodes.map(n => ({
          ...JSON.parse(JSON.stringify(n)),
          id: nextNodeId(),
          position: { x: n.position.x + offset, y: n.position.y + offset },
          data: { ...n.data, dbId: undefined },
        }));
        setNodes(prev => [...prev, ...newNodes]);
        setSaveState('unsaved');
      }
      // Ctrl/Cmd + D: Duplicate selected node
      else if (isMod && e.key === 'd' && selectedNode) {
        e.preventDefault();
        const offset = 40;
        const newNode = {
          ...JSON.parse(JSON.stringify(selectedNode)),
          id: nextNodeId(),
          position: { x: selectedNode.position.x + offset, y: selectedNode.position.y + offset },
          data: { ...selectedNode.data, dbId: undefined },
        };
        setNodes(prev => [...prev, newNode]);
        setSaveState('unsaved');
      }
      // Delete/Backspace: Delete selected node
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && !editingName) {
        // Only if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          handleDeleteNode();
        }
      }
      // ?: Show shortcuts
      else if (e.key === '?' && !isMod) {
        setShowShortcuts(prev => !prev);
      }
      // Escape: Close panels
      else if (e.key === 'Escape') {
        if (showPicker) { setShowPicker(false); setPickerSourceNodeId(null); }
        else if (selectedNode) setSelectedNode(null);
        else if (showValidation) setShowValidation(false);
        else if (showTest) setShowTest(false);
        else if (showShortcuts) setShowShortcuts(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── Focus name input when editing ──
  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  function buildPreview(type: string, cfg: Record<string, any>): string {
    if (!cfg || Object.keys(cfg).length === 0) return '';
    if (type === 'SEND_MESSAGE') return (cfg.message || '').slice(0, 80);
    if (type === 'CONDITION') {
      if (cfg.conditionType === 'Check Contact Field') return `${cfg.condField || 'field'} ${cfg.condOperator || 'equals'} "${cfg.condValue || ''}"`;
      if (cfg.conditionType === 'Check Message Content') return `Contains: "${cfg.condKeyword || ''}"`;
      if (cfg.conditionType === 'Check Loyalty Tier') return `Tier = ${cfg.condTier || ''}`;
      if (cfg.conditionType === 'Check Tag') return `Has tag: ${(cfg.condTags || []).join(', ')}`;
    }
    if (type === 'SMART_DELAY') return `Wait ${cfg.delayValue || 0} ${cfg.delayUnit || 'minutes'}`;
    if (type === 'AI_STEP') return `KB: ${cfg.knowledgeBase || ''} · ${cfg.strictness || 'BALANCED'}`;
    if (type === 'OUTBOUND_WEBHOOK') return `${cfg.webhookMethod || 'POST'} ${cfg.webhookUrl || ''}`;
    if (type === 'ACTION_BLOCK') return cfg.actionType || '';
    if (type === 'SUPER_RANDOMIZER') return (cfg.paths || []).map((p: any) => `${p.label} ${p.pct}%`).join(' · ');
    return '';
  }

  // ── onConnect ──
  const onConnect = useCallback((params: Connection) => {
    let label: string | undefined;
    let stroke = '#2A2E42';
    if (params.sourceHandle === 'true')  { label = 'Yes'; stroke = '#22C55E'; }
    if (params.sourceHandle === 'false') { label = 'No';  stroke = '#EF4444'; }

    setEdges(eds => addEdge({
      ...params,
      type: 'smoothstep',
      label,
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      style: { stroke, strokeWidth: 1.5 },
    }, eds));
    setSaveState('unsaved');
  }, [setEdges]);

  // ── Add node from palette ──
  function addNode(type: string) {
    const rfId = nextNodeId();
    const isTrigger = NODE_CATEGORY[type] === 'TRIGGER';

    // If adding from a + connector, position relative to source node
    let posX = 250 + Math.random() * 180;
    let posY = 120 + (nodes.length * 120) % 600;

    if (pickerSourceNodeId) {
      const srcNode = nodes.find(n => n.id === pickerSourceNodeId);
      if (srcNode) {
        posX = srcNode.position.x + Math.random() * 40 - 20;
        posY = srcNode.position.y + 200;
      }
    } else if (nodes.length === 0) {
      posX = 300;
      posY = 80;
    }

    const newNode: Node = {
      id: rfId,
      type: 'flowNode',
      position: { x: posX, y: posY },
      data: {
        nodeType: type,
        label: NODE_LABELS[type] || type,
        preview: '',
        config: {},
        onPlusClick: (nodeId: string) => openPicker('action', nodeId),
      },
    };

    setNodes(prev => [...prev, newNode]);

    // Auto-connect if adding from a + connector
    if (pickerSourceNodeId) {
      const srcNode = nodes.find(n => n.id === pickerSourceNodeId);
      if (srcNode) {
        const srcType = srcNode.data?.nodeType as string;
        const isSrcCondition = srcType === 'CONDITION';
        const isSrcABSplit = srcType === 'SUPER_RANDOMIZER';
        let sourceHandle: string | null = null;
        let label: string | undefined;
        let stroke = '#2A2E42';

        if (isSrcCondition) {
          sourceHandle = 'default';
          label = undefined;
        } else if (isSrcABSplit) {
          const paths = (srcNode.data?.config as any)?.paths || [];
          sourceHandle = paths.length > 0 ? `path-0` : null;
        }

        setEdges(eds => [...eds, {
          id: `e-${pickerSourceNodeId}-${rfId}`,
          source: pickerSourceNodeId,
          target: rfId,
          sourceHandle,
          type: 'smoothstep',
          label,
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          style: { stroke, strokeWidth: 1.5 },
        }]);
      }
    }

    setSaveState('unsaved');
    setShowMobilePalette(false);
    setShowPicker(false);
    setPickerSourceNodeId(null);

    // Select the new node to open configuration panel
    setTimeout(() => {
      setSelectedNode(newNode);
    }, 50);
  }

  function openPicker(mode: PickerMode, sourceNodeId?: string | null) {
    setPickerMode(mode);
    setPickerSourceNodeId(sourceNodeId || null);
    setShowPicker(true);
  }

  // ── Update node data after panel save ──
  function handleNodePanelSave(config: Record<string, any>, newLabel: string) {
    if (!selectedNode) return;
    const type = selectedNode.data.nodeType as string;
    const preview = buildPreview(type, config);

    setNodes(ns => ns.map(n => {
      if (n.id !== selectedNode.id) return n;
      return { ...n, data: { ...n.data, label: newLabel, preview, config } };
    }));

    // Label condition edges
    if (type === 'CONDITION') {
      setEdges(eds => eds.map(e => {
        if (e.source !== selectedNode.id) return e;
        if (e.sourceHandle === 'true')  return { ...e, label: 'Yes', style: { stroke: '#22C55E', strokeWidth: 1.5 } };
        if (e.sourceHandle === 'false') return { ...e, label: 'No',  style: { stroke: '#EF4444', strokeWidth: 1.5 } };
        return e;
      }));
    }

    setSelectedNode(prev =>
      prev ? { ...prev, data: { ...prev.data, label: newLabel, preview, config } } : prev
    );
    setSaveState('unsaved');
  }

  function handleDeleteNode() {
    if (!selectedNode) return;
    setNodes(ns => ns.filter(n => n.id !== selectedNode.id));
    setEdges(eds => eds.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setSelectedNode(null);
    setSaveState('unsaved');
  }

  // ── Save to Supabase ──
  async function saveFlow() {
    if (!id || !tenant) return;
    setSaving(true);
    setSaveState('saving');

    try {
      // 1. Update flow metadata
      await supabase
        .from('flows')
        .update({ name: flowName, updated_at: new Date().toISOString() })
        .eq('id', id);

      // 2. Split nodes into existing (dbId) vs new
      const existingNodes = nodes.filter(n => n.data?.dbId);
      const newNodes = nodes.filter(n => !n.data?.dbId);

      if (existingNodes.length > 0) {
        await supabase.from('flow_nodes').upsert(
          existingNodes.map(n => ({
            id: n.data!.dbId as string,
            flow_id: id,
            tenant_id: tenant.id,
            node_type: n.data!.nodeType as string,
            label: n.data!.label as string || null,
            position_x: n.position.x,
            position_y: n.position.y,
            config: (n.data!.config as Record<string, unknown>) || {},
          })),
          { onConflict: 'id' }
        );
      }

      if (newNodes.length > 0) {
        const { data: inserted } = await supabase.from('flow_nodes').insert(
          newNodes.map(n => ({
            flow_id: id,
            tenant_id: tenant.id,
            node_type: n.data!.nodeType as string,
            label: n.data!.label as string || null,
            position_x: n.position.x,
            position_y: n.position.y,
            config: (n.data!.config as Record<string, unknown>) || {},
          }))
        ).select();

        if (inserted && inserted.length === newNodes.length) {
          const idMap = new Map<string, string>();
          inserted.forEach((dbNode: any, i: number) => {
            idMap.set(newNodes[i].id, dbNode.id);
          });

          setNodes(nds => nds.map(n => {
            const dbId = idMap.get(n.id);
            if (dbId) return { ...n, id: dbId, data: { ...n.data, dbId } };
            return n;
          }));
          setEdges(eds => eds.map(e => {
            const s = idMap.get(e.source) || e.source;
            const t = idMap.get(e.target) || e.target;
            return (s !== e.source || t !== e.target) ? { ...e, source: s, target: t } : e;
          }));
        }
      }

      // 3. Delete removed nodes
      const { data: allDbNodes } = await supabase.from('flow_nodes').select('id').eq('flow_id', id);
      if (allDbNodes) {
        const currentIds = new Set(nodes.map(n => (n.data?.dbId as string) || '').filter(Boolean));
        const toDelete = allDbNodes.filter((n: any) => !currentIds.has(n.id)).map((n: any) => n.id);
        if (toDelete.length > 0) await supabase.from('flow_nodes').delete().in('id', toDelete);
      }

      // 4. Edges — existing
      const existingEdges = edges.filter(e => e.data?.dbId);
      if (existingEdges.length > 0) {
        await supabase.from('flow_edges').upsert(
          existingEdges.map(e => ({
            id: e.data!.dbId as string,
            flow_id: id,
            tenant_id: tenant.id,
            source_node_id: e.source,
            target_node_id: e.target,
            source_handle: e.sourceHandle || null,
            edge_label: (e.label as string) || null,
            condition_config: {},
          })),
          { onConflict: 'id' }
        );
      }

      // 5. Edges — new
      const newEdges = edges.filter(e => !e.data?.dbId);
      if (newEdges.length > 0) {
        const { data: insertedEdges } = await supabase.from('flow_edges').insert(
          newEdges.map(e => ({
            flow_id: id,
            tenant_id: tenant.id,
            source_node_id: e.source,
            target_node_id: e.target,
            source_handle: e.sourceHandle || null,
            edge_label: (e.label as string) || null,
            condition_config: {},
          }))
        ).select();

        if (insertedEdges) {
          setEdges(eds => eds.map(e => {
            if (e.data?.dbId) return e;
            const match = insertedEdges.find(
              (ie: any) => ie.source_node_id === e.source && ie.target_node_id === e.target
            );
            return match ? { ...e, data: { ...e.data, dbId: match.id } } : e;
          }));
        }
      }

      // 6. Delete removed edges
      const { data: allDbEdges } = await supabase.from('flow_edges').select('id').eq('flow_id', id);
      if (allDbEdges) {
        const currentEdgeIds = new Set(edges.map(e => (e.data?.dbId as string) || '').filter(Boolean));
        const toDelete = allDbEdges.filter((e: any) => !currentEdgeIds.has(e.id)).map((e: any) => e.id);
        if (toDelete.length > 0) await supabase.from('flow_edges').delete().in('id', toDelete);
      }

      setSaveState('saved');
    } catch (err) {
      console.error('Save failed:', err);
      setSaveState('unsaved');
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish() {
    const next: FlowStatus = status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    setStatus(next);
    if (id) {
      try {
        await supabase.from('flows').update({ status: next, updated_at: new Date().toISOString() }).eq('id', id);
      } catch {
        setStatus(status);
      }
    }
  }

  async function runTest() {
    if (!id) return;
    setTestRunning(true);
    try {
      const result = await flowEngineApi.validate(id);
      const steps = (result?.steps || []).map((s: any) => ({
        label: s.label || s.node_type || 'Step',
        ok: s.ok !== false,
        detail: s.detail || s.message || '',
      }));
      setTestResults({ steps });
    } catch (err: any) {
      setTestResults({ steps: [{ label: 'Validation failed', ok: false, detail: err.message || 'Unknown error' }] });
    } finally {
      setTestRunning(false);
    }
  }

  // ── Validation ──
  const hasTrigger = nodes.some(n => NODE_CATEGORY[n.data?.nodeType as string] === 'TRIGGER');
  const hasAction  = nodes.some(n => NODE_CATEGORY[n.data?.nodeType as string] !== 'TRIGGER' && n.data?.nodeType);
  const validationErrors = [
    ...(!hasTrigger ? [{ msg: 'Flow needs at least one Trigger node' }] : []),
    ...(!hasAction && nodes.length > 0 ? [{ msg: 'Flow needs at least one action node after the trigger' }] : []),
    ...(nodes.length === 0 ? [{ msg: 'Canvas is empty — click "Add a trigger" to get started' }] : []),
  ];
  const validationWarnings = [
    ...(nodes.some(n => n.data?.nodeType === 'SMART_DELAY') ? [{ msg: 'Check Smart Delay nodes — delays over 24h may require Message Tag' }] : []),
  ];
  const flowIsValid = validationErrors.length === 0;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-[#0A0B0F] overflow-hidden">

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0A0B0F]/90">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            <p className="text-sm text-[#8B90A7]">Loading flow...</p>
          </div>
        </div>
      )}

      {/* ─── TOP TOOLBAR ─── */}
      <div className="h-[52px] md:h-[56px] flex items-center justify-between px-3 md:px-4 bg-[#111318] border-b border-[#1E2130] flex-shrink-0 z-20">

        {/* Left: back + name + status */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button
            onClick={() => navigate('/flows')}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {editingName ? (
            <input
              ref={nameInputRef}
              value={flowName}
              onChange={e => { setFlowName(e.target.value); setSaveState('unsaved'); }}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => { if (e.key === 'Enter') setEditingName(false); }}
              className="text-sm font-bold text-[#F0F2FF] bg-transparent border-b border-blue-500 outline-none min-w-[80px] max-w-[140px] md:max-w-[240px] pb-0.5"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-bold text-[#F0F2FF] hover:text-blue-400 transition-colors truncate max-w-[100px] md:max-w-[200px] text-left"
              title="Click to rename"
            >
              {flowName}
            </button>
          )}

          <Badge variant={status === 'ACTIVE' ? 'success' : status === 'PAUSED' ? 'warning' : 'default'} className="hidden sm:inline-flex">
            {status.charAt(0) + status.slice(1).toLowerCase()}
          </Badge>
        </div>

        {/* Right: controls - hidden on mobile, shown on md+ */}
        <div className="hidden md:flex items-center gap-1.5">
          {/* 24H indicator */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-green-500/8 border border-green-500/15 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-green-400 font-bold tracking-wider">24H OK</span>
          </div>

          {/* Undo/Redo with working state */}
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${historyIndex > 0 ? 'text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24]' : 'text-[#2A2E42] cursor-not-allowed'}`}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${historyIndex < history.length - 1 ? 'text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24]' : 'text-[#2A2E42] cursor-not-allowed'}`}
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg bg-[#0A0B0F] border border-[#2A2E42]">
            <button
              onClick={() => { zoomOut(); setZoom(getViewport().zoom); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] text-xs font-bold"
              title="Zoom out"
            >
              −
            </button>
            <button
              onClick={() => { setFlowViewport({ x: 0, y: 0, zoom: Math.round(zoom * 100) / 100 }); setZoom(getViewport().zoom); }}
              className="text-[10px] text-[#8B90A7] font-mono w-8 text-center hover:text-[#F0F2FF] cursor-pointer"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => { zoomIn(); setZoom(getViewport().zoom); }}
              className="w-6 h-6 flex items-center justify-center rounded text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] text-xs font-bold"
              title="Zoom in"
            >
              +
            </button>
          </div>

          <div className="w-px h-5 bg-[#1E2130] mx-1" />

          {/* Shortcuts help */}
          <button
            onClick={() => setShowShortcuts(s => !s)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8B90A7] hover:text-[#F0F2FF] hover:bg-[#1A1C24] transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          {/* Validation button */}
          <button
            onClick={() => setShowValidation(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              validationErrors.length > 0
                ? 'bg-red-500/8 border-red-500/20 text-red-400 hover:bg-red-500/12'
                : validationWarnings.length > 0
                ? 'bg-amber-500/8 border-amber-500/20 text-amber-400 hover:bg-amber-500/12'
                : 'bg-green-500/8 border-green-500/15 text-green-400 hover:bg-green-500/12'
            }`}
          >
            {validationErrors.length > 0
              ? <AlertTriangle className="w-3.5 h-3.5" />
              : <CheckCircle2 className="w-3.5 h-3.5" />
            }
            Validate
            {validationErrors.length > 0 && <span className="text-[10px]">({validationErrors.length})</span>}
          </button>

          <Button variant="secondary" size="sm" onClick={() => setShowTest(true)}>
            <FlaskConical className="w-3.5 h-3.5" />
            Test
          </Button>

          {/* Save state */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold ${
            saveState === 'saved' ? 'text-green-400' : saveState === 'saving' ? 'text-[#8B90A7]' : 'text-amber-400'
          }`}>
            {saveState === 'saving' && <Loader2 className="w-3 h-3 animate-spin" />}
            {saveState === 'saved' && <CheckCircle className="w-3 h-3" />}
            {saveState === 'unsaved' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            {saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving...' : 'Unsaved'}
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={saveFlow}
            loading={saving}
            disabled={saving}
            title="Save (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={togglePublish}
          >
            {status === 'ACTIVE'
              ? <><Pause className="w-3.5 h-3.5" />Pause</>
              : <><Play  className="w-3.5 h-3.5" />Publish</>
            }
          </Button>
        </div>
      </div>

      {/* ─── KEYBOARD SHORTCUTS PANEL ─── */}
      {showShortcuts && (
        <div className="absolute top-16 right-4 z-30 w-72 bg-[#111318] border border-[#2A2E42] rounded-xl shadow-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#F0F2FF]">Keyboard Shortcuts</h3>
            <button onClick={() => setShowShortcuts(false)} className="text-[#4B5068] hover:text-[#F0F2FF]">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { keys: ['Ctrl', 'S'], action: 'Save flow' },
              { keys: ['Ctrl', 'Z'], action: 'Undo' },
              { keys: ['Ctrl', 'Shift', 'Z'], action: 'Redo' },
              { keys: ['Ctrl', 'C'], action: 'Copy node' },
              { keys: ['Ctrl', 'V'], action: 'Paste node' },
              { keys: ['Ctrl', 'D'], action: 'Duplicate node' },
              { keys: ['Del'], action: 'Delete selected' },
              { keys: ['Esc'], action: 'Close panel' },
              { keys: ['?'], action: 'Toggle shortcuts' },
            ].map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-[#8B90A7]">{s.action}</span>
                <div className="flex gap-1">
                  {s.keys.map((k, j) => (
                    <span key={j} className="px-1.5 py-0.5 rounded bg-[#1A1C24] border border-[#2A2E42] text-[#F0F2FF] font-mono text-[10px]">
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── VALIDATION TOAST STRIP ─── */}
      {showValidation && (
        <div className={`flex-shrink-0 border-b px-5 py-3 z-10 ${
          validationErrors.length > 0
            ? 'bg-red-500/5 border-red-500/15'
            : validationWarnings.length > 0
            ? 'bg-amber-500/5 border-amber-500/15'
            : 'bg-green-500/5 border-green-500/15'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {validationErrors.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {e.msg}
                </div>
              ))}
              {validationWarnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                  {w.msg}
                </div>
              ))}
              {flowIsValid && validationWarnings.length === 0 && (
                <div className="flex items-center gap-1.5 text-xs text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Flow is valid and ready to publish
                </div>
              )}
            </div>
            <button onClick={() => setShowValidation(false)} className="text-[#4B5068] hover:text-[#F0F2FF] flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── MAIN AREA ─── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── CANVAS (full width — no left sidebar) ─── */}
        <div className="flex-1 relative min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={changes => { onNodesChange(changes); setSaveState('unsaved'); }}
            onEdgesChange={changes => { onEdgesChange(changes); setSaveState('unsaved'); }}
            onConnect={onConnect}
            onMoveEnd={handleMoveEnd}
            onNodeClick={(_, node) => {
              // If node is unconfigured, open picker instead of properties
              const isUnconfigured = !node.data?.preview && Object.keys((node.data?.config as Record<string, unknown>) || {}).length === 0;
              if (isUnconfigured) {
                const cat = NODE_CATEGORY[node.data?.nodeType as string];
                openPicker(cat === 'TRIGGER' ? 'trigger' : 'action', node.id);
              } else {
                setSelectedNode(node);
              }
            }}
            onPaneClick={() => setSelectedNode(null)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            snapToGrid
            snapGrid={[12, 12]}
            minZoom={0.2}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'smoothstep',
              style: { stroke: '#2A2E42', strokeWidth: 1.5 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#2A2E42' },
            }}
            deleteKeyCode={['Backspace', 'Delete']}
            style={{ background: '#0A0B0F' }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.2}
              color="#1A1C24"
            />
            <Controls
              className="!bg-[#111318] !border-[#2A2E42] !rounded-xl overflow-hidden"
              style={{ bottom: 16, left: 16 }}
            />
            <MiniMap
              nodeColor={(n) => NODE_COLOR(n.data?.nodeType as string) || '#2A2E42'}
              maskColor="rgba(10,11,15,0.8)"
              style={{ bottom: 16, right: selectedNode ? 336 : 16, background: '#111318', border: '1px solid #1E2130', borderRadius: 12 }}
            />
          </ReactFlow>

          {/* Empty state — clickable to open trigger picker (outside ReactFlow) */}
          {nodes.length === 0 && !loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <button
                onClick={() => openPicker('trigger')}
                className="group text-center pointer-events-auto"
              >
                <div className="w-20 h-20 rounded-2xl bg-green-500/10 border-2 border-dashed border-green-500/30 group-hover:border-green-500/60 group-hover:bg-green-500/15 flex items-center justify-center mx-auto mb-4 transition-all">
                  <Zap className="w-8 h-8 text-green-400 group-hover:scale-110 transition-transform" />
                </div>
                <p className="text-sm font-bold text-[#8B90A7] group-hover:text-[#F0F2FF] mb-1 transition-colors">Add a trigger to start</p>
                <p className="text-xs text-[#4B5068]">Click here to choose what starts this flow</p>
              </button>
            </div>
          )}

          {/* Floating "+" button — always visible, opens action picker */}
          {nodes.length > 0 && !selectedNode && !showPicker && (
            <button
              onClick={() => {
                // If no trigger exists, open trigger picker; otherwise action
                const hasTrigger = nodes.some(n => NODE_CATEGORY[n.data?.nodeType as string] === 'TRIGGER');
                openPicker(hasTrigger ? 'action' : 'trigger');
              }}
              className="absolute bottom-6 right-6 z-20 w-11 h-11 rounded-full bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center transition-all hover:scale-105"
              title="Add step"
            >
              <Plus className="w-5 h-5" />
            </button>
          )}

          {/* Quick-add buttons in toolbar area */}
          {nodes.length > 0 && !selectedNode && !showPicker && (
            <div className="absolute top-3 left-3 z-20 flex gap-1.5">
              <button
                onClick={() => openPicker('trigger')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111318] border border-[#2A2E42] hover:border-green-500/30 text-[10px] font-bold text-[#8B90A7] hover:text-green-400 transition-all shadow-lg"
              >
                <Zap className="w-3 h-3" />
                Add Trigger
              </button>
              <button
                onClick={() => openPicker('action')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111318] border border-[#2A2E42] hover:border-blue-500/30 text-[10px] font-bold text-[#8B90A7] hover:text-blue-400 transition-all shadow-lg"
              >
                <Plus className="w-3 h-3" />
                Add Step
              </button>
            </div>
          )}
        </div>

        {/* ─── PROPERTIES PANEL ─── */}
        {selectedNode && (
          <PropertiesPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onSave={handleNodePanelSave}
            onDelete={handleDeleteNode}
          />
        )}
      </div>

      {/* ─── MOBILE BOTTOM ACTION BAR ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111318] border-t border-[#1E2130] px-3 py-2 safe-area-bottom">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Zoom */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0A0B0F] border border-[#2A2E42]">
            <button
              onClick={() => { zoomOut(); setZoom(getViewport().zoom); }}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8B90A7] hover:text-[#F0F2FF] text-sm font-bold"
            >
              −
            </button>
            <span className="text-[10px] text-[#8B90A7] font-mono w-7 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => { zoomIn(); setZoom(getViewport().zoom); }}
              className="w-7 h-7 flex items-center justify-center rounded text-[#8B90A7] hover:text-[#F0F2FF] text-sm font-bold"
            >
              +
            </button>
          </div>

          {/* Center: Save/Publish */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={saveFlow}
              disabled={saving}
              className="h-9 px-3 flex items-center gap-1.5 rounded-lg bg-[#1A1C24] border border-[#2A2E42] text-xs font-semibold text-[#F0F2FF] disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving' : 'Save'}
            </button>
            <button
              onClick={togglePublish}
              className={`h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-semibold text-white ${status === 'ACTIVE' ? 'bg-amber-500' : 'bg-green-500'}`}
            >
              {status === 'ACTIVE' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {status === 'ACTIVE' ? 'Pause' : 'Publish'}
            </button>
          </div>

          {/* Right: Add step */}
          <button
            onClick={() => openPicker(nodes.some(n => NODE_CATEGORY[n.data?.nodeType as string] === 'TRIGGER') ? 'action' : 'trigger')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-blue-500 text-white"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ─── NODE PICKER POPUP ─── */}
      {showPicker && (
        <NodePickerPopup
          mode={pickerMode}
          onClose={() => { setShowPicker(false); setPickerSourceNodeId(null); }}
          onSelect={(type) => addNode(type)}
        />
      )}

      {/* ─── TEST MODAL ─── */}
      <Modal
        open={showTest}
        onClose={() => { setShowTest(false); setTestResults(null); }}
        title="Test Flow"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#8B90A7] uppercase tracking-wider block mb-1.5">
              Simulated Trigger Input
            </label>
            <input
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') runTest(); }}
              placeholder="e.g. what's the price?"
              className="h-9 w-full rounded-xl bg-[#0F1117] border border-[#2A2E42] text-sm text-[#F0F2FF] placeholder:text-[#4B5068] px-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
            />
          </div>

          <Button variant="primary" loading={testRunning} onClick={runTest} className="w-full">
            <FlaskConical className="w-3.5 h-3.5" />
            Run Simulation
          </Button>

          {testResults && (
            <div className="space-y-2">
              <p className="text-[10px] font-black text-[#4B5068] uppercase tracking-widest">Execution Trace</p>
              <div className="space-y-1.5">
                {testResults.steps.map((s, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-[#0F1117] border border-[#1E2130]">
                    {s.ok
                      ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                      : <CircleSlash  className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    }
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F0F2FF]">{s.label}</p>
                      {s.detail && <p className="text-[11px] text-[#8B90A7] mt-0.5 leading-relaxed">{s.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#4B5068] text-center pt-1">Simulation only — no messages were sent</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

// Wrap with ReactFlowProvider for hooks to work
export function FlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <FlowBuilderContent />
    </ReactFlowProvider>
  );
}
