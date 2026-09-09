/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://zxempgaqylcbdnasqygs.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_JPsv5JwZ56nI-HJWTmBFRA_nist6iMY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
