import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Jaro-Winkler similarity for fuzzy name matching
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length, len2 = s2.length;
  if (!len1 || !len2) return 0.0;
  const maxDist = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0, transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - maxDist);
    const end = Math.min(i + maxDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace("/functions/v1/loyalty-scoring", "");

    // POST /compute - Compute and update loyalty score for a contact
    if (req.method === "POST" && path === "/compute") {
      const { contact_id, tenant_id, brand_id } = await req.json();

      // Aggregate signals from attribution events
      const { data: events } = await supabase
        .from("attribution_events")
        .select("event_type, created_at")
        .eq("unified_contact_id", contact_id);

      // Count conversation interactions
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, created_at")
        .eq("unified_contact_id", contact_id);

      // Count messages
      const convoIds = (conversations || []).map((c: any) => c.id);
      const { count: messageCount } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convoIds.length > 0 ? convoIds : ["00000000-0000-0000-0000-000000000000"]);

      // Count purchases
      const purchases = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED").length;
      const totalRevenue = (events || []).filter(e => e.event_type === "PURCHASE_ATTRIBUTED")
        .reduce((sum: number, e: any) => sum + 0, 0); // revenue from attribution

      // Count link clicks
      const clicks = (events || []).filter(e => e.event_type === "LINK_CLICKED").length;

      // Count AI interactions
      const aiInteractions = (events || []).filter(e => e.event_type === "AI_RESPONSE_SENT").length;

      // Compute score (0-100)
      let score = 0;
      score += Math.min(20, (messageCount || 0) * 2);       // Messages: up to 20 pts
      score += Math.min(25, purchases * 10);                   // Purchases: up to 25 pts
      score += Math.min(15, clicks * 3);                       // Clicks: up to 15 pts
      score += Math.min(10, aiInteractions);                    // AI interactions: up to 10 pts
      score += Math.min(15, (conversations || []).length * 3); // Conversations: up to 15 pts
      score += Math.min(15, Math.floor((events || []).length / 5)); // Total engagement: up to 15 pts

      score = Math.min(100, Math.max(0, score));

      // Update contact
      await supabase.from("unified_contacts").update({
        loyalty_score: score,
      }).eq("id", contact_id);

      // The trigger will auto-update the tier

      return new Response(JSON.stringify({
        contact_id,
        score,
        tier: score >= 67 ? "ADVOCATE" : score >= 34 ? "FAN" : "NEWBIE",
        breakdown: {
          messages: Math.min(20, (messageCount || 0) * 2),
          purchases: Math.min(25, purchases * 10),
          clicks: Math.min(15, clicks * 3),
          ai_interactions: Math.min(10, aiInteractions),
          conversations: Math.min(15, (conversations || []).length * 3),
          engagement: Math.min(15, Math.floor((events || []).length / 5)),
        },
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /batch-compute - Compute scores for all contacts in a tenant
    if (req.method === "POST" && path === "/batch-compute") {
      const { tenant_id, brand_id } = await req.json();

      const { data: contacts } = await supabase
        .from("unified_contacts")
        .select("id")
        .eq("tenant_id", tenant_id)
        .is("gdpr_deleted_at", null);

      const results = [];
      for (const contact of contacts || []) {
        try {
          const res = await fetch(`${url.origin}/functions/v1/loyalty-scoring/compute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contact_id: contact.id, tenant_id, brand_id }),
          });
          const data = await res.json();
          results.push(data);
        } catch {
          results.push({ contact_id: contact.id, error: "failed" });
        }
      }

      return new Response(JSON.stringify({ updated: results.length, results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /identity-match - Check for potential duplicate contacts
    if (req.method === "POST" && path === "/identity-match") {
      const { tenant_id, brand_id, contact_id } = await req.json();

      const { data: contact } = await supabase
        .from("unified_contacts")
        .select("id, display_name, email, phone")
        .eq("id", contact_id)
        .maybeSingle();

      if (!contact) {
        return new Response(JSON.stringify({ error: "Contact not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Find potential matches
      const { data: allContacts } = await supabase
        .from("unified_contacts")
        .select("id, display_name, email, phone")
        .eq("tenant_id", tenant_id)
        .eq("brand_id", brand_id)
        .neq("id", contact_id)
        .is("gdpr_deleted_at", null);

      const matches: any[] = [];

      for (const other of allContacts || []) {
        let matchScore = 0;
        let matchMethod = "";

        // Exact email match
        if (contact.email && other.email && contact.email.toLowerCase() === other.email.toLowerCase()) {
          matchScore = 0.95;
          matchMethod = "EXACT_EMAIL";
        }
        // Exact phone match
        else if (contact.phone && other.phone && contact.phone.replace(/\D/g, "") === other.phone.replace(/\D/g, "")) {
          matchScore = 0.95;
          matchMethod = "EXACT_PHONE";
        }
        // Fuzzy name match
        else if (contact.display_name && other.display_name) {
          const similarity = jaroWinkler(contact.display_name.toLowerCase(), other.display_name.toLowerCase());
          if (similarity > 0.85) {
            matchScore = similarity;
            matchMethod = "FUZZY_NAME";
          }
        }

        if (matchScore > 0.7) {
          matches.push({ contact_b_id: other.id, contact_b_name: other.display_name, score: matchScore, method: matchMethod });

          // Add to identity match queue
          await supabase.from("identity_match_queue").insert({
            tenant_id,
            brand_id,
            contact_a_id: contact_id,
            contact_b_id: other.id,
            match_score: matchScore,
            match_method: matchMethod as any,
            status: matchScore > 0.9 ? "PENDING" : "PENDING",
          }).select("id").maybeSingle();
        }
      }

      return new Response(JSON.stringify({ matches }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /merge - Merge two contacts
    if (req.method === "POST" && path === "/merge") {
      const { primary_id, secondary_id, tenant_id, brand_id } = await req.json();

      // Move all platform profiles to primary
      await supabase.from("platform_profiles").update({
        unified_contact_id: primary_id,
      }).eq("unified_contact_id", secondary_id);

      // Move conversations to primary
      await supabase.from("conversations").update({
        unified_contact_id: primary_id,
      }).eq("unified_contact_id", secondary_id);

      // Move attribution events to primary
      await supabase.from("attribution_events").update({
        unified_contact_id: primary_id,
      }).eq("unified_contact_id", secondary_id);

      // Move short links to primary
      await supabase.from("short_links").update({
        contact_id: primary_id,
      }).eq("contact_id", secondary_id);

      // Merge tags from secondary into primary
      const { data: primary } = await supabase.from("unified_contacts").select("tags").eq("id", primary_id).maybeSingle();
      const { data: secondary } = await supabase.from("unified_contacts").select("tags, loyalty_score, email, phone").eq("id", secondary_id).maybeSingle();

      const mergedTags = [...new Set([...(primary?.tags || []), ...(secondary?.tags || [])])];
      const mergedScore = Math.max(primary?.tags?.length || 0, secondary?.loyalty_score || 0);

      await supabase.from("unified_contacts").update({
        tags: mergedTags,
        loyalty_score: mergedScore,
        email: (await supabase.from("unified_contacts").select("email").eq("id", primary_id).maybeSingle()).data?.email || secondary?.email,
        phone: (await supabase.from("unified_contacts").select("phone").eq("id", primary_id).maybeSingle()).data?.phone || secondary?.phone,
      }).eq("id", primary_id);

      // Soft-delete secondary
      await supabase.from("unified_contacts").update({
        gdpr_deleted_at: new Date().toISOString(),
        display_name: "MERGED",
      }).eq("id", secondary_id);

      // Update match queue
      await supabase.from("identity_match_queue").update({ status: "MERGED" as any })
        .eq("contact_a_id", primary_id).eq("contact_b_id", secondary_id);

      return new Response(JSON.stringify({ status: "merged", primary_id, secondary_id }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // POST /warm-hello - Generate cross-platform context injection for AI prompt
    if (req.method === "POST" && path === "/warm-hello") {
      const { contact_id, tenant_id, brand_id } = await req.json();

      const { data: contact } = await supabase
        .from("unified_contacts")
        .select("id, display_name, loyalty_score, loyalty_tier, zero_party_signals, created_at")
        .eq("id", contact_id)
        .maybeSingle();

      const { data: profiles } = await supabase
        .from("platform_profiles")
        .select("platform, platform_username, last_interaction_at")
        .eq("unified_contact_id", contact_id);

      const { data: recentEvents } = await supabase
        .from("attribution_events")
        .select("event_type, platform, created_at, metadata")
        .eq("unified_contact_id", contact_id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Build warm hello context
      const platforms = (profiles || []).map(p => p.platform).join(" and ");
      const daysSinceJoin = Math.floor((Date.now() - new Date(contact?.created_at || 0).getTime()) / (1000 * 60 * 60 * 24));
      const tierLabel = contact?.loyalty_tier === "ADVOCATE" ? "a valued Advocate" : contact?.loyalty_tier === "FAN" ? "a loyal Fan" : "new";

      let context = `This contact is ${tierLabel} (score: ${contact?.loyalty_score}/100) who has been with us for ${daysSinceJoin} days. They're active on ${platforms}.`;

      if (recentEvents?.length) {
        const lastEvent = recentEvents[0];
        context += ` Their most recent activity was a ${lastEvent.event_type.replace(/_/g, " ").toLowerCase()} on ${lastEvent.platform}.`;
      }

      const signals = contact?.zero_party_signals || {};
      if (Object.keys(signals).length > 0) {
        context += ` Known preferences: ${JSON.stringify(signals)}`;
      }

      return new Response(JSON.stringify({ warm_hello_context: context, contact, profiles, recent_events: recentEvents }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
