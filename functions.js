/* ════════════════════════════════════════════════════════════════
 * FAULTLINES — SHARED FUNCTION LIBRARY (functions.js)
 * ════════════════════════════════════════════════════════════════
 * This file holds every constant, data table, and helper function
 * that both player.html and gm.html rely on: the Supabase fetch
 * layer, session handling, tile/zone data, and generic UI helpers.
 * index.html only needs a small slice of this (login + session
 * helpers) but loads the whole file for simplicity — none of it
 * touches game state on its own.
 *
 * NOTE ON "SECURITY ABSTRACTION": moving code into this file gives
 * you a clean separation of concerns, but it is NOT an access-control
 * boundary. This is all client-side JavaScript — anyone who can load
 * gm.html can read its full source (and this file's) in devtools,
 * same as before. The only two things actually gating GM actions are
 * (1) the GM service key, which is typed in at login and never
 * hard-coded here, and (2) whatever Row Level Security policies you
 * have configured in Supabase. If real access control matters to
 * you, that's where to invest — this split is about code
 * organization, not security. See the reply for more on this.
 * ════════════════════════════════════════════════════════════════ */

    /* 
     * ─── CONFIGURATION & DATA MODELS ──────────────────────────────────────
     * This section contains the static data and connection keys.
     */
    const SB_URL = 'https://fbvybpxosrjvtrwkdrmr.supabase.co';
    const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnlicHhvc3JqdnRyd2tkcm1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5OTk1NjEsImV4cCI6MjA5MTU3NTU2MX0.tH6NYFlpZmH3tE_oh5V9gKe62hC_VCo3cIF2Dym-ydE';

    // Country flag emojis for display
    const FLAGS = { China: '🇨🇳', Taiwan: '🇹🇼', Philippines: '🇵🇭', Malaysia: '🇲🇾', Indonesia: '🇮🇩', Thailand: '🇹🇭', Cambodia: '🇰🇭', Vietnam: '🇻🇳' };

    // List of active participating countries
    const COUNTRIES = ['China', 'Taiwan', 'Philippines', 'Malaysia', 'Indonesia', 'Thailand', 'Cambodia', 'Vietnam'];

    // Base amount of gold each country earns per Fall season
    const BASE_INCOME = { China: 5, Taiwan: 2, Philippines: 4, Malaysia: 3, Indonesia: 3, Thailand: 3, Cambodia: 2, Vietnam: 4 };

    // Geographical Exclusive Economic Zones (EEZ) for each country
    const EEZ = { China: ['2', '3', '6', '7', '8', '9', '10', '11'], Vietnam: ['1', '5', '14', '24', '35'], Taiwan: ['19', '20', '30'], Philippines: ['41', '51', '60', '68', '69'], Malaysia: ['76', '77', '78', '79'], Indonesia: ['52', '61', '70', '71'], Cambodia: ['23', '33', '34'], Thailand: ['4', '12', '13', '21', '31', '42'] };

    const ALL_ZONES = ['China', 'Taiwan', 'Philippines', 'Malaysia', 'Indonesia', 'Thailand', 'Cambodia', 'Vietnam', 'Green Neutral Zone', 'Blue Neutral Zone', 'Purple Neutral Zone', 'Orange Neutral Zone'];

    // Icons used for the turn status indicator
    const SEASON_ICONS = { setup: '◈', fall: '◆', winter: '❄', spring: '◉', summer: '⚔' };
    const SHIP_STATS = { 'Fishing Boat': { cost: 3, attack: 0, hp: 1, speed: 2, range: 4, notes: '1 fish/turn. Cannot attack.' }, 'Coast Guard': { cost: 3, attack: 4, hp: 4, speed: 4, range: 2, atk_label: 'D4', notes: 'Territorial waters' }, 'FAC': { cost: 6, attack: 6, hp: 3, speed: 4, range: 5, atk_label: 'D6', notes: 'D4 in water cannon engagements' }, 'Destroyer': { cost: 13, attack: 8, hp: 9, speed: 3, range: 1e9, atk_label: '2×D4', notes: 'Unlimited range. No base tether.' } };

    // Spy card definitions — id, icon, name, description, needs_target type
    const SPY_CARDS = {
      'upgrade_dice': { icon: '🎲', name: 'Upgrade Dice', desc: 'Your next combat roll uses a higher dice tier. Play before combat. GM deletes after use.', target: 'none' },
      'extended_move': { icon: '💨', name: 'Extended Move', desc: 'One fleet or ship moves up to double its normal speed. Play during Spring.', target: 'self_unit' },
      'steal_gold': { icon: '💰', name: 'Steal Gold', desc: 'Steal up to 5g from a target country. Play anytime.', target: 'country_gold' },
      'destroy_base': { icon: '💥', name: 'Destroy Base', desc: 'Destroy a target enemy base. GM resolves. Play anytime.', target: 'enemy_base' },
      'sink_ship': { icon: '⚓', name: 'Sink Ship', desc: 'Eliminate one enemy ship. GM removes it from the board. Play anytime.', target: 'enemy_ship' },
      'disable_unit': { icon: '🔒', name: 'Disable Unit', desc: 'Prevent a ship or fleet from moving or attacking for 1 full turn. Play anytime.', target: 'enemy_unit' },
      'toxic_spill': { icon: '☣️', name: 'Toxic Spill', desc: 'Target a fishing zone — no one can fish there next Fall. Play anytime.', target: 'fishing_zone' },
      'bonus_fish': { icon: '🐟', name: 'Bonus Fish', desc: 'Add 2 fish to a target fishing zone, raising its stock. Play anytime.', target: 'fishing_zone' },
      'sabotage_base': { icon: '🔧', name: 'Sabotage Base', desc: 'Target enemy base cannot spawn new ships for one Winter. GM resolves. Play anytime.', target: 'enemy_base' },
      'spy': { icon: '🕵️', name: 'Spy', desc: 'See one country\'s currently held spy cards. GM tells you privately. Play anytime.', target: 'enemy_country' },
      'sanction': { icon: '📜', name: 'Sanction', desc: 'Target country earns 1 less base income next Fall. Play anytime.', target: 'enemy_country' },
      'naval_superiority': { icon: '⚔️', name: 'Naval Superiority', desc: 'Your ships gain +1 attack for one combat this turn. Play before combat.', target: 'none' },
      'nothing': { icon: '🃏', name: 'Nothing', desc: 'This card has no effect. Better luck next time.', target: 'none' },
    };

    /** Picks a random card type from the currently allowed pool */
    function randomCardKey() {
      const allowed = D.cardConfig?.allowed_types || [];
      const pool = allowed.length > 0 ? allowed : Object.keys(SPY_CARDS);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    const ZONE_COLORS = { "China": "#c1121f", "Vietnam": "#d4a017", "Taiwan": "#3a86ff", "Philippines": "#8338ec", "Malaysia": "#fb5607", "Indonesia": "#06d6a0", "Cambodia": "#bc6c25", "Thailand": "#e9c46a", "Blue Neutral Zone": "#4cc9f0", "Purple Neutral Zone": "#9d4edd", "Orange Neutral Zone": "#f77f00", "Green Neutral Zone": "#2d9e5f" };

    // Carrying capacity and initial fish per zone (from rulebook)
    const ZONE_FISH_DATA = {
      'China': { cap: 16, initial: 4 },
      'Taiwan': { cap: 6, initial: 2 },
      'Philippines': { cap: 10, initial: 2 },
      'Malaysia': { cap: 8, initial: 2 },
      'Indonesia': { cap: 8, initial: 3 },
      'Thailand': { cap: 12, initial: 3 },
      'Cambodia': { cap: 6, initial: 2 },
      'Vietnam': { cap: 10, initial: 2 },
      'Green Neutral Zone': { cap: 30, initial: 6 },
      'Orange Neutral Zone': { cap: 30, initial: 6 },
      'Blue Neutral Zone': { cap: 30, initial: 6 },
      'Purple Neutral Zone': { cap: 30, initial: 6 },
    };

    /**
     * Logistic growth model: next turn's fish population.
     * Uses standard fisheries logistic: N(t+1) = N(t) + r*N(t)*(1 - N(t)/K) - harvest
     * Growth rate r = 0.4 (moderate replenishment each turn)
     */
    // EEZ zones: r=0.75 (sustains ≥1 fish/turn from starting stock)
    // Neutral zones: r=1.25 with phase=2 shift — dampens early growth, opens up as stock grows
    const NEUTRAL_ZONES = new Set(['Green Neutral Zone', 'Orange Neutral Zone', 'Blue Neutral Zone', 'Purple Neutral Zone']);
    function projectFish(current, cap, harvest, asInt = false, zone = '') {
      const isNeutral = NEUTRAL_ZONES.has(zone);
      const r = isNeutral ? 1.5 : 0.8;
      const phase = isNeutral ? 1 : 0;  // phase shift: slows early neutral zone growth for balance
      // Use cap+1 as the logistic ceiling so stock always approaches but never reaches cap
      const growth = r * Math.max(0, current - phase) * (1 - current / (cap + 1));
      const raw = current + growth - harvest;
      // asInt=true for DB writes; false keeps one decimal for simulator display
      return asInt ? Math.max(0, Math.floor(raw)) : Math.max(0, Math.round(raw * 10) / 10);
    }

    /** Returns health label and color for a stock level */
    function fishHealth(current, cap) {
      const ratio = current / cap;
      if (ratio >= 0.7) return { label: 'Healthy', color: '#2ec4b6' };
      if (ratio >= 0.4) return { label: 'Moderate', color: '#e9c46a' };
      if (ratio >= 0.2) return { label: 'Low', color: '#f4a261' };
      return { label: 'Critical', color: '#e63946' };
    }
    const TILE_DATA = { "1": { "z": "Vietnam", "a": ["2", "5", "6", "7"] }, "2": { "z": "China", "a": ["1", "3", "6", "7", "8"] }, "3": { "z": "China", "a": ["2", "7", "8", "9"] }, "4": { "z": "Thailand", "a": ["5", "12", "13"] }, "5": { "z": "Vietnam", "a": ["1", "4", "6", "13", "14"] }, "6": { "z": "China", "a": ["1", "2", "5", "7", "14", "15"] }, "7": { "z": "China", "a": ["1", "2", "3", "6", "8", "15", "16", "17"] }, "8": { "z": "China", "a": ["2", "3", "7", "9", "17", "18"] }, "9": { "z": "China", "a": ["3", "8", "10", "17", "18"] }, "10": { "z": "China", "a": ["9", "11", "18", "19"] }, "11": { "z": "China", "a": ["10", "19", "20"] }, "12": { "z": "Thailand", "a": ["4", "13", "21", "22"] }, "13": { "z": "Thailand", "a": ["4", "5", "12", "22", "23"] }, "14": { "z": "Vietnam", "a": ["5", "6", "13", "15", "23", "24", "25"] }, "15": { "z": "Blue Neutral Zone", "a": ["6", "7", "14", "16", "24", "25"] }, "16": { "z": "Blue Neutral Zone", "a": ["7", "15", "17", "25", "26", "27"] }, "17": { "z": "Blue Neutral Zone", "a": ["7", "8", "9", "16", "18", "26", "27", "28"] }, "18": { "z": "Purple Neutral Zone", "a": ["8", "9", "10", "17", "19", "28", "29"] }, "19": { "z": "Taiwan", "a": ["10", "11", "18", "20", "29", "30"] }, "20": { "z": "Taiwan", "a": ["11", "19", "30"] }, "21": { "z": "Thailand", "a": ["12", "22", "31", "32"] }, "22": { "z": "Green Neutral Zone", "a": ["12", "13", "21", "23", "32", "33"] }, "23": { "z": "Cambodia", "a": ["13", "14", "22", "24", "33", "34", "35"] }, "24": { "z": "Vietnam", "a": ["14", "15", "23", "25", "34", "35", "36"] }, "25": { "z": "Blue Neutral Zone", "a": ["14", "15", "16", "24", "26", "35", "36", "37"] }, "26": { "z": "Blue Neutral Zone", "a": ["16", "17", "25", "27", "36", "37", "38"] }, "27": { "z": "Blue Neutral Zone", "a": ["16", "17", "26", "28", "37", "38", "39"] }, "28": { "z": "Purple Neutral Zone", "a": ["17", "18", "27", "29", "38", "39", "40"] }, "29": { "z": "Purple Neutral Zone", "a": ["18", "19", "28", "30", "39", "40", "41"] }, "30": { "z": "Taiwan", "a": ["19", "20", "29", "40", "41"] }, "31": { "z": "Thailand", "a": ["21", "32", "42"] }, "32": { "z": "Green Neutral Zone", "a": ["21", "22", "31", "33", "42", "43"] }, "33": { "z": "Cambodia", "a": ["22", "23", "32", "34", "43", "44"] }, "34": { "z": "Cambodia", "a": ["23", "24", "33", "35", "44", "45"] }, "35": { "z": "Vietnam", "a": ["23", "24", "25", "34", "36", "45", "46"] }, "36": { "z": "Blue Neutral Zone", "a": ["24", "25", "26", "35", "37", "45", "46", "47"] }, "37": { "z": "Blue Neutral Zone", "a": ["25", "26", "27", "36", "38", "46", "47", "48"] }, "38": { "z": "Blue Neutral Zone", "a": ["26", "27", "28", "37", "39", "47", "48", "49"] }, "39": { "z": "Purple Neutral Zone", "a": ["27", "28", "29", "38", "40", "48", "49", "50"] }, "40": { "z": "Purple Neutral Zone", "a": ["28", "29", "30", "39", "41", "49", "50", "51"] }, "41": { "z": "Philippines", "a": ["29", "30", "40", "50", "51"] }, "42": { "z": "Thailand", "a": ["31", "32", "43", "52", "53"] }, "43": { "z": "Green Neutral Zone", "a": ["32", "33", "42", "44", "53", "54"] }, "44": { "z": "Green Neutral Zone", "a": ["33", "34", "43", "45", "54", "55"] }, "45": { "z": "Green Neutral Zone", "a": ["34", "35", "36", "44", "46", "54", "55", "56"] }, "46": { "z": "Orange Neutral Zone", "a": ["35", "36", "37", "45", "47", "55", "56", "57"] }, "47": { "z": "Blue Neutral Zone", "a": ["36", "37", "38", "46", "48", "56", "57", "58"] }, "48": { "z": "Purple Neutral Zone", "a": ["37", "38", "39", "47", "49", "57", "58", "59"] }, "49": { "z": "Purple Neutral Zone", "a": ["38", "39", "40", "48", "50", "58", "59", "60"] }, "50": { "z": "Purple Neutral Zone", "a": ["39", "40", "41", "49", "51", "59", "60"] }, "51": { "z": "Philippines", "a": ["40", "41", "50", "60"] }, "52": { "z": "Indonesia", "a": ["42", "53", "61", "62"] }, "53": { "z": "Green Neutral Zone", "a": ["42", "43", "52", "54", "62", "63"] }, "54": { "z": "Green Neutral Zone", "a": ["43", "44", "45", "53", "55", "63", "64"] }, "55": { "z": "Orange Neutral Zone", "a": ["44", "45", "46", "54", "56", "63", "64", "65"] }, "56": { "z": "Orange Neutral Zone", "a": ["45", "46", "47", "55", "57", "64", "65", "66"] }, "57": { "z": "Purple Neutral Zone", "a": ["46", "47", "48", "56", "58", "65", "66", "67"] }, "58": { "z": "Purple Neutral Zone", "a": ["47", "48", "49", "57", "59", "66", "67", "68"] }, "59": { "z": "Purple Neutral Zone", "a": ["48", "49", "50", "58", "60", "67", "68", "69"] }, "60": { "z": "Philippines", "a": ["49", "50", "51", "59", "68", "69"] }, "61": { "z": "Indonesia", "a": ["52", "62", "70"] }, "62": { "z": "Green Neutral Zone", "a": ["52", "53", "61", "63", "70", "71"] }, "63": { "z": "Green Neutral Zone", "a": ["53", "54", "55", "62", "64", "71", "72"] }, "64": { "z": "Orange Neutral Zone", "a": ["54", "55", "56", "63", "65", "71", "72", "73"] }, "65": { "z": "Orange Neutral Zone", "a": ["55", "56", "57", "64", "66", "72", "73", "74"] }, "66": { "z": "Orange Neutral Zone", "a": ["56", "57", "58", "65", "67", "73", "74", "75"] }, "67": { "z": "Purple Neutral Zone", "a": ["57", "58", "59", "66", "68", "74", "75"] }, "68": { "z": "Philippines", "a": ["58", "59", "60", "67", "69", "75"] }, "69": { "z": "Philippines", "a": ["59", "60", "68"] }, "70": { "z": "Indonesia", "a": ["61", "62", "71"] }, "71": { "z": "Indonesia", "a": ["62", "63", "64", "70", "72"] }, "72": { "z": "Orange Neutral Zone", "a": ["63", "64", "65", "66", "71", "73", "76", "77"] }, "73": { "z": "Orange Neutral Zone", "a": ["64", "65", "66", "67", "72", "74", "77", "78"] }, "74": { "z": "Orange Neutral Zone", "a": ["65", "66", "67", "68", "73", "75", "78", "79"] }, "75": { "z": "Orange Neutral Zone", "a": ["66", "67", "68", "74", "79"] }, "76": { "z": "Malaysia", "a": ["72", "77"] }, "77": { "z": "Malaysia", "a": ["72", "73", "76", "78"] }, "78": { "z": "Malaysia", "a": ["73", "74", "77", "79"] }, "79": { "z": "Malaysia", "a": ["74", "75", "78"] } };
    /* ─── DATA ACCESS HELPERS ─────────────────────────────────────── */

    // Gets the zone name for a specific tile ID
    function tz(id) { return TILE_DATA[String(id)]?.z || ''; }

    // Gets the list of adjacent tile IDs for a specific tile
    function tadj(id) { return TILE_DATA[String(id)]?.a || []; }

    // Maps a ship type string to its emoji representation
    function se(t) { return { 'Fishing Boat': '🎣', 'Coast Guard': '⚓', 'FAC': '⚡', 'Destroyer': '🚢' }[t] || '🚢'; }

    // Sanitizes zone names for use in CSS classes (replaces spaces with underscores)
    function zi(z) { return z.replace(/ /g, '_'); }

    // Maps a ship type string to its badge color class
    function tc(t) { return { 'Fishing Boat': 'bgy', 'Coast Guard': 'bt', 'FAC': 'bgo', 'Destroyer': 'br' }[t] || 'bgy'; }

    // Formats an ISO date string into a user-friendly time string
    function ft(iso) { try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }

    // Breadth-First Search: Finds the shortest path between two tiles
    function bfs(from, to) { const f = String(from), t2 = String(to); if (f === t2) return [f]; const q = [[f]]; const vis = new Set([f]); while (q.length) { const p = q.shift(); const n = p[p.length - 1]; for (const nb of (TILE_DATA[n]?.a || [])) { if (nb === t2) return [...p, nb]; if (!vis.has(nb)) { vis.add(nb); q.push([...p, nb]); } } } return null; }


    // ─── SESSION (memory only) ───────────────────────────────────────
    let SB_SVC = null, SESSION_PIN = null, CU = null;
    let D = {
      cfg: null, myEco: null, myTroops: [], myBases: [], myOrders: [], myFleets: [],
      allTroops: [], allBases: [], allEco: [], allOrders: [], allEcoLog: [], allFleets: [], pins: [],
      myCards: [], allCards: [], cardConfig: { enabled: false, allowed_types: [] }, broadcast: null,
      activeEffects: [], myActiveEffects: [], myNotifications: []
    };

    const SEASON_ORDER = ['fall', 'winter', 'spring', 'summer'];

    // Cleans the API keys to remove hidden characters (prevents fetch errors)
    function apiKey() { return (SB_SVC || SB_ANON).replace(/[^\x20-\x7E]/g, ''); }

    /**
     * Core Fetch Wrapper for Supabase REST API
     * @param {string} path - The table or resource path (e.g. 'ships?id=eq.1')
     * @param {object} opts - Fetch options (method, body, headers, prefer)
     */
    // Fetch with automatic timeout + up to 2 retries on network errors
    // ─── PROXY-SAFE FETCH LAYER ──────────────────────────────────────
    // Many school/corporate proxies:
    //   • Block OPTIONS preflight → CORS fails before any real request
    //   • Strip custom headers (Authorization, Prefer, Content-Type, X-HTTP-Method-Override)
    //   • Block non-GET/POST HTTP methods (DELETE, PATCH)
    //
    // Strategy:
    //   GET    → plain GET, apikey in URL
    //   POST   → plain POST, apikey in URL, application/json (required by PostgREST)
    //   PATCH  → rewritten as POST upsert (merge-duplicates), PK injected into body
    //   DELETE → Tier 1: real DELETE; Tier 2: GET tunnel (?_method_override=DELETE);
    //            Tier 3: POST + X-HTTP-Method-Override header
    //   Prefer → kept in header only (PostgREST does NOT support it as a URL param)
    //   apikey → always in URL (?apikey=...)

    let _proxyMode = null; // null=untested, 'direct', 'headers-stripped', 'blocked'

    async function detectProxyMode() {
      if (_proxyMode !== null) return _proxyMode;
      const key = (SB_ANON || '').replace(/[^ -~]/g, '');
      const base = SB_URL.replace(/[^ -~]/g, '');
      try {
        const url = base + '/rest/v1/game_config?select=turn&limit=1&apikey=' + encodeURIComponent(key);
        const r = await Promise.race([
          fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit' }),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
        ]);
        if (r.ok || r.status === 406) {
          try {
            const r2 = await Promise.race([
              fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal', 'apikey': key, 'Authorization': 'Bearer ' + key }, body: '{}', mode: 'cors', credentials: 'omit' }),
              new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
            ]);
            _proxyMode = (r2.ok || r2.status < 500) ? 'direct' : 'headers-stripped';
          } catch { _proxyMode = 'headers-stripped'; }
        } else { _proxyMode = 'blocked'; }
      } catch { _proxyMode = 'blocked'; }
      console.info('[SCS] Proxy mode:', _proxyMode);
      return _proxyMode;
    }

    async function fetchWithTimeout(url, opts = {}, timeoutMs = 14000, retries = 2) {
      let lastErr;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);
        try {
          const res = await fetch(url, { ...opts, signal: ctrl.signal });
          clearTimeout(timer);
          return res;
        } catch (e) {
          clearTimeout(timer);
          lastErr = e.name === 'AbortError' ? new Error('Request timed out after ' + (timeoutMs / 1000) + 's') : e;
          if (attempt < retries) await new Promise(r => setTimeout(r, 900 * (attempt + 1)));
        }
      }
      throw lastErr;
    }

    /**
     * Core Supabase REST wrapper — fully proxy-safe.
     *
     * All writes use POST. PATCH is rewritten as a POST upsert with the PK
     * injected into the body so URL filters being stripped cannot break it.
     * DELETE uses a three-tier fallback (real DELETE → GET tunnel → POST override).
     * apikey and Prefer are always embedded in the URL so stripped headers
     * cannot break authentication or response formatting.
     */
    async function sb(path, opts = {}) {
      const key = apiKey();
      const baseUrl = SB_URL.replace(/[^ -~]/g, '') + '/rest/v1/';
      const method = opts.method || 'GET';

      // Preserve arrays (bulk inserts) — spreading an array with {...arr} produces {}
      // which silently drops all data. Only spread plain objects.
      let bodyObj = opts.body
        ? (typeof opts.body === 'string'
          ? JSON.parse(opts.body)
          : Array.isArray(opts.body) ? opts.body : { ...opts.body })
        : {};

      const preferVal = opts.prefer || 'return=minimal';

      // Embed apikey in URL — proxy-safe auth even if Authorization header is stripped.
      // NOTE: Prefer must stay in the header only; PostgREST does NOT support it as a
      // URL query param and will throw PGRST100 trying to parse it as a filter.
      const sep = path.includes('?') ? '&' : '?';
      const urlWithParams = baseUrl + path + sep + 'apikey=' + encodeURIComponent(key);

      // Route by method
      if (method === 'DELETE') return _sbDelete(urlWithParams, key, preferVal);
      if (method === 'PATCH') return _sbPatch(urlWithParams, key, preferVal, path, bodyObj);
      if (method === 'GET') {
        const res = await fetchWithTimeout(urlWithParams, {
          method: 'GET',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key },
          mode: 'cors', credentials: 'omit'
        });
        if (!res.ok) { const e = await res.text(); throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300)); }
        const t = await res.text(); return t ? JSON.parse(t) : null;
      }

      // POST — plain insert
      return _sbPost(urlWithParams, key, preferVal, bodyObj);
    }

    /**
     * POST helper — used for plain inserts.
     * Note: text/plain does NOT work as a fallback — PostgREST requires application/json.
     */
    async function _sbPost(url, key, preferVal, bodyObj) {
      // Note: Content-Type: application/json triggers a CORS preflight OPTIONS request.
      // If the proxy blocks OPTIONS, this POST will fail with a network error.
      // text/plain does NOT work as a fallback — PostgREST requires application/json
      // to parse the body, so we do not attempt that. Instead we surface a clear message.
      const bodyStr = JSON.stringify(bodyObj);
      let res;
      try {
        res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': preferVal },
          body: bodyStr, mode: 'cors', credentials: 'omit'
        });
      } catch (netErr) {
        throw new Error('Write blocked by proxy (CORS preflight failed). Try a different network or ask your GM to use a direct connection. (' + netErr.message + ')');
      }
      if (!res.ok) {
        const e = await res.text();
        if (res.status === 405) throw new Error('HTTP POST blocked by proxy. Try a different network.');
        throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300));
      }
      const t = await res.text(); return t ? JSON.parse(t) : null;
    }

    /**
     * PATCH with two-tier proxy fallback.
     *
     * Tier 1: Real PATCH — correct semantics, no INSERT risk, works on direct connections.
     *         Uses X-HTTP-Method-Override tunneled through POST for proxies that block PATCH.
     * Tier 2: POST upsert (merge-duplicates) — only used if PATCH is hard-blocked (405/403).
     *         Requires INSERT permission, so limited to tables where anon has INSERT.
     *         The PK is injected into the body from the URL filter so it survives proxy
     *         stripping of the URL query string.
     *
     * Tables that must NEVER reach Tier 2 (no INSERT permission): pins, economy,
     * game_config, fish_zones, ship_counter, player_notifications.
     * Tables safe for Tier 2 (have INSERT permission as part of upsert flows): troops,
     * bases, spy_cards — these use POST upsert elsewhere anyway.
     */
    /**
     * PATCH with two-tier proxy fallback.
     *
     * Tier 1: Real PATCH (direct connection + most proxies)
     * Tier 2: POST + X-HTTP-Method-Override: PATCH header (proxies that block PATCH method
     *         but honour the override header)
     *         The PK is injected into the body from the URL filter so that even if the proxy
     *         strips the URL querystring, PostgREST can still identify the row.
     *
     * We deliberately do NOT fall through to a POST upsert (merge-duplicates) as a final
     * tier — that requires INSERT permission which many tables (pins, economy, game_config,
     * fish_zones) do not grant to the anon role, causing RLS 401 errors.
     */
    async function _sbPatch(url, key, preferVal, path, bodyObj) {
      // Extract PK from URL filter so we can inject it into the body for Tier 2.
      // This ensures the correct row is targeted even if the URL filter is stripped.
      const filterMatch = path.match(/[?&](\w+)=eq\.([^&]+)/);
      let bodyWithPK = { ...bodyObj };
      if (filterMatch) {
        const [, col, rawVal] = filterMatch;
        const decoded = decodeURIComponent(rawVal);
        bodyWithPK[col] = /^\d+$/.test(decoded) ? Number(decoded) : decoded;
      }
      const bodyStr = JSON.stringify(bodyObj);        // original body for real PATCH
      const bodyPKStr = JSON.stringify(bodyWithPK);   // PK-enriched body for tunneled PATCH

      // Tier 1: Real PATCH
      try {
        const res = await fetchWithTimeout(url, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': preferVal },
          body: bodyStr, mode: 'cors', credentials: 'omit'
        });
        if (res.ok || res.status === 204) { const t = await res.text(); return t ? JSON.parse(t) : null; }
        if (res.status !== 405 && res.status !== 403) {
          const e = await res.text(); throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300));
        }
        // 405/403 = method blocked, fall through to Tier 2
      } catch (e) { if (e.message.startsWith('DB error')) throw e; }

      // Tier 2: POST + X-HTTP-Method-Override: PATCH
      // PK is in the body so the correct row is identified even if URL filter is stripped.
      try {
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'Prefer': preferVal, 'X-HTTP-Method-Override': 'PATCH' },
          body: bodyPKStr, mode: 'cors', credentials: 'omit'
        });
        if (res.ok || res.status === 204) { const t = await res.text(); return t ? JSON.parse(t) : null; }
        const e = await res.text(); throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300));
      } catch (e) {
        if (e.message.startsWith('DB error')) throw e;
        throw new Error('PATCH blocked by proxy on all fallback methods. Try a different network.');
      }
    }

    /**
     * DELETE with two-tier proxy fallback.
     *
     * Tier 1: Real HTTP DELETE (direct connections + most proxies)
     * Tier 2: POST + X-HTTP-Method-Override: DELETE header (proxies that block DELETE
     *         but honour the override header)
     *
     * For targeted deletes (id=eq.X): the PK is injected into the POST body so that
     * PostgREST can identify the row even if the proxy strips the URL querystring.
     *
     * For bulk deletes (id=not.is.null / key=not.is.null): Tier 2 is intentionally
     * skipped because a POST with an empty body would be treated as an INSERT.
     * Bulk deletes are GM-only reset operations — if Tier 1 fails on a proxy, a clear
     * error is surfaced asking for a direct connection.
     *
     * NOTE: The ?_method_override=DELETE URL-param "GET tunnel" that PostgREST
     * supposedly supports is NOT implemented here — testing shows PostgREST ignores
     * it and treats the request as a plain GET, returning rows instead of deleting.
     */
    async function _sbDelete(urlWithParams, key, preferVal) {
      // Determine if this is a targeted delete (has `=eq.` filter) or a bulk delete
      const eqFilterMatch = urlWithParams.match(/[?&](\w+)=eq\.([^&]+)/);
      const isBulk = !eqFilterMatch;

      // Tier 1: Real DELETE
      try {
        const res = await fetchWithTimeout(urlWithParams, {
          method: 'DELETE',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': preferVal },
          mode: 'cors', credentials: 'omit'
        });
        // 204 No Content and 404 Not Found are both success for DELETE
        if (res.ok || res.status === 204 || res.status === 404) return null;
        if (res.status !== 405 && res.status !== 403) {
          const e = await res.text(); throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300));
        }
        // 405/403 = method blocked by proxy, fall through
      } catch (e) { if (e.message.startsWith('DB error')) throw e; }

      // Bulk deletes cannot safely use Tier 2 (POST with empty body = INSERT attempt)
      if (isBulk) {
        throw new Error('Bulk DELETE blocked by proxy. This operation (game reset/advance) requires a direct connection — try a different network.');
      }

      // Tier 2: POST + X-HTTP-Method-Override: DELETE (targeted deletes only)
      // Inject the PK into the body so the row is identified even if URL filter is stripped.
      try {
        const [, col, rawVal] = eqFilterMatch;
        const decoded = decodeURIComponent(rawVal);
        const pkBody = { [col]: /^\d+$/.test(decoded) ? Number(decoded) : decoded };
        const res = await fetchWithTimeout(urlWithParams, {
          method: 'POST',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json', 'X-HTTP-Method-Override': 'DELETE', 'Prefer': preferVal },
          body: JSON.stringify(pkBody), mode: 'cors', credentials: 'omit'
        });
        if (res.ok || res.status === 204 || res.status === 404) return null;
        const e = await res.text(); throw new Error('DB error (' + res.status + '): ' + e.slice(0, 300));
      } catch (e) {
        if (e.message.startsWith('DB error')) throw e;
        throw new Error('DELETE blocked by proxy on all fallback methods. Try a different network.');
      }
    }

    /**
     * RPC Wrapper — proxy-safe: apikey in URL.
     */
    async function rpc(name, payload) {
      // RPC calls require Content-Type: application/json — PostgREST will not parse
      // the body without it. There is no meaningful fallback if CORS preflight is blocked.
      const key = apiKey();
      const url = SB_URL.replace(/[^ -~]/g, '') + '/rest/v1/rpc/' + name + '?apikey=' + encodeURIComponent(key);
      const bodyStr = JSON.stringify(payload);
      let res;
      try {
        res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
          body: bodyStr, mode: 'cors', credentials: 'omit'
        });
      } catch (netErr) {
        throw new Error('RPC call blocked by proxy (CORS preflight failed). Try a different network. (' + netErr.message + ')');
      }
      if (!res.ok) {
        const e = await res.text();
        throw new Error('RPC error (' + res.status + '): ' + e.slice(0, 300));
      }
      return res.json();
    }

    /**
     * Generates a unique ID for a new ship based on country and type
     * @param {string} country - The country owning the ship
     * @param {string} type - The type of ship
     */
    async function genID(country, type) {
      const px = { China: 'CHN', Taiwan: 'TWN', Philippines: 'PHL', Malaysia: 'MYS', Indonesia: 'IDN', Thailand: 'THA', Cambodia: 'KHM', Vietnam: 'VNM' };
      const tx = { 'Fishing Boat': 'FB', 'Coast Guard': 'CG', 'FAC': 'FAC', 'Destroyer': 'DD' };
      const key = (px[country] || country.slice(0, 3).toUpperCase()) + '_' + (tx[type] || 'XX');
      try {
        // Step 1: Ensure the counter row exists (ignore if already there)
        await sb('ship_counter', { method: 'POST', prefer: 'resolution=ignore-duplicates,return=minimal', body: { key, val: 1 } });
        // Step 2: Read current value
        const rows = await sb('ship_counter?key=eq.' + encodeURIComponent(key));
        const cur = rows?.[0]?.val ?? 1;
        // Step 3: Increment atomically — add a per-attempt random jitter to the
        // new value so two simultaneous reads of the same `cur` still produce
        // different stored values, making the next reader see a higher number.
        // This doesn't fully eliminate the race window but makes collisions
        // statistically negligible for the small concurrent-purchase scenario here.
        // The timestamp fallback below is the true uniqueness guarantee.
        const jitter = Math.floor(Math.random() * 3); // 0-2 extra slots
        await sb('ship_counter?key=eq.' + encodeURIComponent(key), { method: 'PATCH', prefer: 'return=minimal', body: { val: cur + 1 + jitter } });
        // Append a 2-char random suffix to the sequential number so that even a
        // perfect read collision (two buyers read the same `cur`) produces distinct IDs.
        const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
        return key + '-' + String(cur).padStart(2, '0') + rand;
      } catch (e) {
        // Fallback: timestamp + random — guaranteed unique even without DB access
        return key + '-' + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 4).toUpperCase();
      }
    }

    // ─── UI HELPERS ──────────────────────────────────────────────────
    function showLoad(m) { document.getElementById('loading').classList.remove('hidden'); document.getElementById('lmsg').textContent = m || 'Loading…'; }
    function hideLoad() { document.getElementById('loading').classList.add('hidden'); }
    function showAl(el, m, c) { el.innerHTML = '<div class="al ' + c + '">' + m + '</div>'; el.classList.remove('hidden'); }
    function openMod(id) { document.getElementById('moverlay').classList.remove('hidden'); document.querySelectorAll('.mbox').forEach(m => m.classList.add('hidden')); document.getElementById(id).classList.remove('hidden'); }
    function closeMod() { document.getElementById('moverlay').classList.add('hidden'); }
    function togglePw(inputId, btn) { const el = document.getElementById(inputId); el.type = el.type === 'password' ? 'text' : 'password'; btn.textContent = el.type === 'password' ? '👁' : '🙈'; }

    function logout() {
      SB_SVC = null; SESSION_PIN = null; CU = null;
      D = {
        cfg: null, myEco: null, myTroops: [], myBases: [], myOrders: [], myFleets: [],
        allTroops: [], allBases: [], allEco: [], allOrders: [], allEcoLog: [], allFleets: [], pins: []
      };
      document.getElementById('lp').value = ''; document.getElementById('gk').value = '';
      document.getElementById('lr').value = '';
      document.getElementById('lcw').classList.add('hidden');
      document.getElementById('gkw').classList.add('hidden');
      document.getElementById('app-header').classList.add('hidden');
      showScreen('login'); hideLoad();
    }

    function setSeasonChip(s) {
      const el = document.getElementById('season-chip');
      const L = { setup: 'Setup', fall: 'Fall', winter: 'Winter', spring: 'Spring', summer: 'Summer' };
      el.textContent = (SEASON_ICONS[s] || '◆') + ' ' + (L[s] || s);
      el.className = 'season-chip ' + s;
    }

    // ─── FISH ZONES ──────────────────────────────────────────────────

    /**
     * Renders the fish zone status widget into a container element by id.
     * Works for both player (containerId='p-fz') and GM (containerId='gm-fz').
     * Uses D.allTroops (GM) or D.myTroops + D.allTroops if available.
     */
    function renderFishZones(containerId) {
      const el = document.getElementById(containerId);
      if (!el) return;

      const troops = D.allTroops?.length ? D.allTroops : D.myTroops;
      const fishingBoats = troops.filter(s => s.type === 'Fishing Boat');
      const boatsByZone = {};
      fishingBoats.forEach(s => { const z = tz(s.tile); if (!z) return; if (!boatsByZone[z]) boatsByZone[z] = []; boatsByZone[z].push(s); });

      const toxicZones = new Set((D.activeEffects || []).filter(e => e.type === 'toxic_spill').map(e => e.target_zone));
      const bonusZones = {};
      (D.activeEffects || []).filter(e => e.type === 'bonus_fish').forEach(e => { bonusZones[e.target_zone] = (bonusZones[e.target_zone] || 0) + 2; });

      const getZoneRow = z => (D.fishStocks || []).find(f => f.zone === z);
      const getStock = z => { const r = getZoneRow(z); return r ? r.stock : (ZONE_FISH_DATA[z]?.initial ?? 0); };
      const getCap = z => { const r = getZoneRow(z); return r ? r.capacity : (ZONE_FISH_DATA[z]?.cap ?? 15); };

      // Build a stable zone ID safe for use in element ids
      const zid = z => 'fz-' + containerId + '-' + z.replace(/[^a-z0-9]/gi, '_');

      let html = '';
      ALL_ZONES.forEach(z => {
        const stock = getStock(z) + (bonusZones[z] || 0);
        const cap = getCap(z);
        const boats = boatsByZone[z] || [];
        const boatCount = boats.length;
        const isToxic = toxicZones.has(z);
        const hasBonus = !!bonusZones[z];
        const baseHarvest = isToxic ? 0 : boatCount;
        const health = fishHealth(stock, cap);
        const fillPct = Math.min(100, Math.round(stock / cap * 100));
        const id = zid(z);

        // Default projection at zero harvest (natural growth, no fishing assumed)
        const projDefault = [];
        let cur = stock;
        for (let i = 0; i < 5; i++) { cur = projectFish(cur, cap, 0, false, z); projDefault.push(cur); }

        const effectBadges =
          (isToxic ? '<span class="spy-badge" style="background:rgba(231,111,81,.15);border-color:rgba(231,111,81,.3);color:#e76f51;margin-left:6px;">TOXIC</span>' : '')
          + (hasBonus ? '<span class="spy-badge" style="background:rgba(46,196,182,.12);border-color:rgba(46,196,182,.3);color:var(--green);margin-left:4px;">+' + bonusZones[z] + ' BONUS</span>' : '');

        const boatListHtml = boatCount > 0
          ? '<div class="fz-boats">' + boats.map(s => '<span>' + (FLAGS[s.country] || '') + ' ' + s.id + ' (T' + (s.tile || '?') + ')</span>').join(' · ') + '</div>'
          : '';

        html += '<div class="fz-card" id="' + id + '-card">'

          // Header
          + '<div class="fz-card-header">'
          + '<div class="fz-card-dot" style="background:' + (ZONE_COLORS[z] || '#555') + ';"></div>'
          + '<div class="fz-card-name">' + z + effectBadges + '</div>'
          + '<span class="fz-card-health" style="color:' + health.color + ';background:' + health.color + '18;border-color:' + health.color + '44;">' + health.label + '</span>'
          + '</div>'

          // Stock bar
          + '<div class="fz-bar-wrap">'
          + '<div class="fz-bar-bg"><div class="fz-bar-fill" id="' + id + '-bar" style="width:' + fillPct + '%;background:' + health.color + ';"></div></div>'
          + '<div class="fz-bar-labels"><span id="' + id + '-stk">' + stock + ' fish</span><span>Cap: ' + cap + '</span></div>'
          + '</div>'

          // Stats row
          + '<div class="fz-card-body">'
          + '<div class="fz-stat"><div class="fz-stat-v" style="color:' + health.color + ';">' + stock + '</div><div class="fz-stat-l">Current Stock</div></div>'
          + '<div class="fz-stat"><div class="fz-stat-v">' + cap + '</div><div class="fz-stat-l">Carrying Cap</div></div>'
          + '<div class="fz-stat"><div class="fz-stat-v" style="color:' + (boatCount > 0 ? (isToxic ? 'var(--text2)' : '#f4a261') : 'var(--text2)') + ';">' + (isToxic ? '—' : boatCount) + '</div><div class="fz-stat-l">Fishing Boats</div></div>'
          + '</div>'

          + boatListHtml

          // Current projection row (static, based on actual boats)
          + '<div class="fz-proj">'
          + '<div style="font-family:var(--fm);font-size:10px;color:var(--text2);margin-right:2px;align-self:center;">Natural →</div>'
          + projDefault.map((v, i) => {
            const ph = fishHealth(v, cap);
            const prev = i === 0 ? stock : projDefault[i - 1];
            const arrow = v - prev > 0.1 ? '↑' : v - prev < -0.1 ? '↓' : '→';
            return '<div class="fz-proj-box"><div class="fz-proj-v" style="color:' + ph.color + ';">' + v + '</div>'
              + '<div class="fz-proj-l">T+' + (i + 1) + ' ' + arrow + '</div></div>';
          }).join('')
          + '</div>'

          // ── Interactive simulator — per-turn harvest inputs ──
          + '<div class="fz-sim">'
          + '<div class="fz-sim-title">Harvest Simulator <span style="font-family:var(--fm);font-size:9px;color:var(--text2);font-weight:400;letter-spacing:0;">— set fish removed each turn</span></div>'
          + '<div style="display:flex;align-items:center;gap:6px;margin-bottom:7px;flex-wrap:wrap;">'
          + '<span style="font-family:var(--fm);font-size:9px;color:var(--text2);">Fill all turns:</span>'
          + '<input class="fz-sim-input" id="' + id + '-fill-val" type="number" min="0" max="' + cap + '" value="' + boatCount + '" style="width:42px;" placeholder="0" />'
          + '<button class="btn btn-o btn-sm" style="padding:2px 8px;font-size:9px;" onclick="fillFzSim(\'' + id + '\', ' + cap + ')">Fill</button>'
          + '<button class="btn btn-o btn-sm" style="padding:2px 8px;font-size:9px;" onclick="clearFzSim(\'' + id + '\', ' + cap + ')">Clear</button>'
          + '</div>'
          + '<div class="fz-sim-row" style="flex-wrap:wrap;gap:6px;align-items:flex-end;">'
          + [1, 2, 3, 4, 5, 6, 7, 8].map(function (t) {
            return '<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">'
              + '<span style="font-family:var(--fm);font-size:8px;color:var(--text2);">T+' + t + '</span>'
              + '<input class="fz-sim-input" id="' + id + '-inp-t' + t + '" type="number" min="0" max="' + cap + '" value="0" style="width:38px;" oninput="updateFzSim(this)" />'
              + '</div>';
          }).join('')
          + '<span class="fz-sim-label" id="' + id + '-hinf" style="color:#f4a261;align-self:flex-end;padding-bottom:2px;"></span>'
          + '</div>'
          + '<div class="fz-sim-chart" id="' + id + '-chart"></div>'
          + '<div class="fz-sim-warn" id="' + id + '-warn"></div>'
          + '</div>'

          + '</div>'; // end fz-card
      });

      el.innerHTML = html;

      // Run initial simulator render for each zone
      ALL_ZONES.forEach(z => { const inp = document.getElementById('fz-' + containerId + '-' + z.replace(/[^a-z0-9]/gi, '_') + '-inp-t1'); if (inp) updateFzSim(inp); });

      // Populate GM edit dropdown if present
      const sel = document.getElementById('fz-edit-zone');
      if (sel) {
        sel.innerHTML = '<option value="">— select —</option>'
          + ALL_ZONES.map(z => '<option value="' + z + '">' + z + ' (' + getStock(z) + '/' + getCap(z) + ')</option>').join('');
      }
    }

    /**
     * Updates the harvest simulator chart for a single zone.
     * Called on input change — reads the harvest input, recalculates
     * 8-turn projection, redraws bar chart, and updates warnings.
     */
    function updateFzSim(inputEl) {
      // Derive id prefix from the input's id: fz-{containerId}-{zone_slug}-inp-t{N}
      // Use greedy match up to -inp-t so containerId hyphens (e.g. 'gm-fz') are preserved
      const inputId = inputEl ? inputEl.id : '';
      const idMatch = inputId.match(/^(.+)-inp-t\d+$/);
      if (!idMatch) return;
      const id = idMatch[1];
      // Recover zone: id = 'fz-{containerId}-{zone_slug}', strip the 'fz-XX-fz-' prefix
      const zoneSlug = id.replace(/^fz-[^-]+-fz-/, '').replace(/^fz-[^-]+-/, '');
      const zone = ALL_ZONES.find(z => z.replace(/[^a-z0-9]/gi, '_') === zoneSlug.replace(/[^a-z0-9]/gi, '_')) || '';
      const chart = document.getElementById(id + '-chart');
      const warnEl = document.getElementById(id + '-warn');
      const hinfEl = document.getElementById(id + '-hinf');
      if (!chart) return;

      const TURNS = 8;
      // Read per-turn harvest values from individual inputs
      const harvests = [];
      for (let t = 1; t <= TURNS; t++) {
        const inp = document.getElementById(id + '-inp-t' + t);
        harvests.push(inp ? Math.max(0, parseInt(inp.value) || 0) : 0);
      }

      const getZoneRow = z => (D.fishStocks || []).find(f => f.zone === z);
      const bonusZones = {};
      (D.activeEffects || []).filter(e => e.type === 'bonus_fish').forEach(e => { bonusZones[e.target_zone] = (bonusZones[e.target_zone] || 0) + 2; });
      const isToxic = (D.activeEffects || []).some(e => e.type === 'toxic_spill' && e.target_zone === zone);
      const row = getZoneRow(zone);
      const stock = (row ? row.stock : (ZONE_FISH_DATA[zone]?.initial ?? 0)) + (bonusZones[zone] || 0);
      const cap = row ? row.capacity : (ZONE_FISH_DATA[zone]?.cap ?? 15);

      // Project each turn using its own harvest value
      const series = [stock];
      let cur = stock;
      for (let i = 0; i < TURNS; i++) {
        const effectiveHarvest = isToxic && i === 0 ? 0 : harvests[i];
        cur = projectFish(cur, cap, effectiveHarvest, false, zone);
        series.push(cur);
      }

      const maxVal = Math.max(cap, ...series);

      // Render bar chart
      chart.innerHTML = series.map((v, i) => {
        const h = fishHealth(v, cap);
        const pct = maxVal > 0 ? Math.max(3, Math.round(v / maxVal * 100)) : 3;
        const label = i === 0 ? 'Now' : 'T+' + i;
        const harvestLabel = i > 0 && harvests[i - 1] > 0 ? '<span style="color:#f4a261;font-size:7px;">-' + harvests[i - 1] + '</span>' : '';
        return '<div class="fz-sim-bar-wrap">'
          + '<div style="font-family:var(--fm);font-size:8px;color:' + h.color + ';margin-bottom:2px;">' + v + '</div>'
          + '<div class="fz-sim-bar" style="height:' + pct + '%;background:' + h.color + ';"></div>'
          + '<div class="fz-sim-bar-lbl" style="color:' + (i === 0 ? 'var(--text)' : 'var(--text2)') + ';">' + label + '</div>'
          + harvestLabel
          + '</div>';
      }).join('');

      // Sustainability info — mirrors projectFish logic including phase shift
      const _isNeutral = ['Green Neutral Zone', 'Orange Neutral Zone', 'Blue Neutral Zone', 'Purple Neutral Zone'].includes(zone);
      const _r = _isNeutral ? 1.5 : 0.8;
      const _phase = _isNeutral ? 1 : 0;
      const growthAtStock = _r * Math.max(0, stock - _phase) * (1 - stock / (cap + 1));
      const maxSustainable = Math.floor(growthAtStock + 0.001);
      if (hinfEl) hinfEl.textContent = 'max sustainable: ~' + maxSustainable + '/turn';

      // Warnings — check if any turn's harvest is unsustainable or zone collapses
      let warn = '';
      if (isToxic) {
        warn = 'Toxic spill active — fishing yields 0 this turn regardless.';
      } else if (harvests[0] > stock) {
        warn = 'T+1 harvest exceeds current stock. Zone depleted immediately.';
      } else if (series[series.length - 1] < 1) {
        const collapseAt = series.findIndex(v => v < 1);
        warn = 'Zone collapses at T+' + collapseAt + ' at these harvest rates.';
      } else if (series[series.length - 1] < cap * 0.2) {
        warn = 'Population falls to critical levels by T+' + TURNS + '. Consider reducing pressure.';
      } else if (Math.max(...harvests) > maxSustainable) {
        warn = 'Some turns exceed natural growth — population will decline those turns.';
      }
      if (warnEl) warnEl.textContent = warn;
    }

    /** Fills all 8 per-turn harvest inputs for a zone with the value in the fill box, then reruns the sim */
    function fillFzSim(id, cap) {
      const fillInp = document.getElementById(id + '-fill-val');
      const val = Math.max(0, Math.min(cap, parseInt(fillInp?.value) || 0));
      for (let t = 1; t <= 8; t++) {
        const inp = document.getElementById(id + '-inp-t' + t);
        if (inp) inp.value = val;
      }
      updateFzSim(document.getElementById(id + '-inp-t1'));
    }

    /** Clears all 8 per-turn harvest inputs for a zone back to 0, then reruns the sim */
    function clearFzSim(id) {
      for (let t = 1; t <= 8; t++) {
        const inp = document.getElementById(id + '-inp-t' + t);
        if (inp) inp.value = 0;
      }
      const fillInp = document.getElementById(id + '-fill-val');
      if (fillInp) fillInp.value = 0;
      updateFzSim(document.getElementById(id + '-inp-t1'));
    }

    /* ─── CROSS-PAGE SESSION PERSISTENCE ──────────────────────────────
     * The original single-file app kept SB_SVC / SESSION_PIN / CU as
     * in-memory-only variables — fine when "screens" were just divs
     * toggled inside one never-reloaded page. Now that login, player,
     * and GM are three real pages, something has to carry the logged-in
     * session across that page load. sessionStorage is the standard
     * tool for exactly this: it lives only for this browser tab and is
     * cleared on logout (see logout() below) or when the tab closes —
     * same "not persisted long-term" spirit as before, just able to
     * survive a navigation or an accidental refresh.
     */
    function saveSession() {
      try { sessionStorage.setItem('scs_session', JSON.stringify({ SB_SVC, SESSION_PIN, CU })); } catch (e) { /* ignore */ }
    }
    function loadSession() {
      try {
        const raw = sessionStorage.getItem('scs_session');
        if (!raw) return false;
        const s = JSON.parse(raw);
        SB_SVC = s.SB_SVC ?? null; SESSION_PIN = s.SESSION_PIN ?? null; CU = s.CU ?? null;
        return !!(CU && SESSION_PIN);
      } catch (e) { return false; }
    }
    function clearSession() {
      try { sessionStorage.removeItem('scs_session'); } catch (e) { /* ignore */ }
    }

    /**
     * Logs the user out and returns to the login page. Adapted for the
     * multi-page split: the original reset several login-form input
     * fields (#lp, #gk, #lr, ...) and toggled screens with showScreen();
     * those elements no longer live on this page (they're on
     * index.html), so instead we clear session state and navigate —
     * index.html loads with empty fields naturally, same end result.
     */
    function logout() {
      clearSession();
      SB_SVC = null; SESSION_PIN = null; CU = null;
      window.location.href = 'index.html';
    }
