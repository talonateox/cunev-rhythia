import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { exec } from "child_process";
import express from "express";
import type { Server } from "http";
import { ProfileManager } from "../profileManager";

const SUPABASE_SESSION_FIELD = "supabaseSession" as const;
const SUPABASE_AUTH_PORT = 9001;
const SUPABASE_AUTH_PATH = "/login";
const SUPABASE_REDIRECT_URL = `http://localhost:${SUPABASE_AUTH_PORT}${SUPABASE_AUTH_PATH}`;
const SUPABASE_URL = "https://pfkajngbllcbdzoylrvp.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBma2FqbmdibGxjYmR6b3lscnZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjkwMTUzMDUsImV4cCI6MjA0NDU5MTMwNX0.9j9lpQ-k8Qtp-s5jslGdxQe8cAvuLXIeB-DgfRMOFbc";

const supabaseClient: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

let profileLoaded = false;
let activeSessionRefresh: Promise<User | null> | null = null;

function ensureProfileLoaded(): void {
  if (!profileLoaded) {
    ProfileManager.load();
    profileLoaded = true;
  }
}

function getCachedSupabaseSession(): unknown | null {
  ensureProfileLoaded();
  const profile = ProfileManager.peek();
  return (profile as any)[SUPABASE_SESSION_FIELD] ?? null;
}

function setCachedSupabaseSession(session: unknown): void {
  ensureProfileLoaded();
  const accessToken =
    typeof session === "object" && session !== null
      ? ((session as any).access_token as string | undefined)
      : undefined;

  ProfileManager.update({
    supabaseSession: session,
    token: accessToken,
  });
  ProfileManager.save();
}

function clearCachedSupabaseSession(): void {
  ensureProfileLoaded();
  ProfileManager.update({ supabaseSession: undefined, token: undefined });
  ProfileManager.save();
}

const HASH_REDIRECT_SCRIPT = `
 <script>
   const hash = window.location.hash;
   if (hash.length > 0 && hash.startsWith('#')) {
     window.location.replace(window.location.href.replace('#', '?'));
   }
 </script>
`;

function openExternalUrl(url: string): void {
  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(command);
}

async function tryRestoreCachedSession(): Promise<User | null> {
  const cachedSession = getCachedSupabaseSession();
  if (!cachedSession) return null;

  try {
    const session = await supabaseClient.auth.setSession(cachedSession as any);

    if (!session.error) {
      if (session.data.session) {
        setCachedSupabaseSession(session.data.session);
      }
      return session.data.user ?? null;
    }
  } catch (error) {
    clearCachedSupabaseSession();
    return null;
  }

  clearCachedSupabaseSession();
  return null;
}

export async function refreshCachedSession(): Promise<User | null> {
  if (!activeSessionRefresh) {
    activeSessionRefresh = (async () => {
      try {
        return await tryRestoreCachedSession();
      } finally {
        activeSessionRefresh = null;
      }
    })();
  }

  return activeSessionRefresh;
}

ProfileManager.registerGetHook(() => {
  const profile = ProfileManager.peek();
  const hasSession = Boolean((profile as any)[SUPABASE_SESSION_FIELD]);
  const hasToken = Boolean(profile.token);

  if (!hasSession || hasToken) {
    return;
  }

  return refreshCachedSession()
    .then(() => undefined)
    .catch((error) => {
      console.error("Failed to refresh cached Supabase session:", error);
    });
});

export async function loginWithDiscord(
  cacheOnly?: boolean
): Promise<User | null> {
  return new Promise<User | null>(async (resolve, reject) => {
    let settled = false;
    let server: Server | null = null;

    const cleanup = () => {
      if (server) {
        server.close();
        server = null;
      }
    };

    const resolveOnce = (value: User | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: "discord",
        options: {
          redirectTo: SUPABASE_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        rejectOnce(error);
        return;
      }

      const cachedUser = await tryRestoreCachedSession();
      if (settled) {
        return;
      }

      if (cachedUser) {
        resolveOnce(cachedUser);
        return;
      }

      const redirectUrl = data?.url;
      if (!redirectUrl) {
        rejectOnce(new Error("Supabase did not return a redirect URL."));
        return;
      }

      if (cacheOnly) {
        return;
      }
      openExternalUrl(redirectUrl);

      const app = express();

      app.get(SUPABASE_AUTH_PATH, async (req, res) => {
        const code = req.query.code as string | undefined;
        const accessToken = req.query.access_token as string | undefined;
        const refreshToken = req.query.refresh_token as string | undefined;
        const errorParam = req.query.error as string | undefined;
        const errorDescription =
          (req.query.error_description as string | undefined) ||
          (req.query.error_message as string | undefined);

        if (errorParam) {
          const err = new Error(
            errorDescription || `Supabase OAuth error: ${errorParam}`
          );
          res.status(400).send("Authentication failed.");
          rejectOnce(err);
          return;
        }

        if (accessToken) {
          try {
            const authResult = await supabaseClient.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || "",
            });

            if (authResult.error) {
              throw authResult.error;
            }

            const currentSession = await supabaseClient.auth.getSession();
            if (currentSession.data.session) {
              setCachedSupabaseSession(currentSession.data.session);
            }

            res.send("OK!");
            resolveOnce(authResult.data.user ?? null);
          } catch (err) {
            clearCachedSupabaseSession();
            res.status(500).send("Authentication failed.");
            rejectOnce(err);
          }
          return;
        }

        if (!code) {
          res.send(HASH_REDIRECT_SCRIPT);
          return;
        }

        try {
          const exchange = await supabaseClient.auth.exchangeCodeForSession(
            code
          );

          if (exchange.error || !exchange.data.session) {
            throw exchange.error ?? new Error("Failed to exchange code.");
          }

          const authResult = await supabaseClient.auth.setSession({
            ...exchange.data.session,
          });

          if (authResult.error) {
            throw authResult.error;
          }

          const currentSession = await supabaseClient.auth.getSession();
          if (currentSession.data.session) {
            setCachedSupabaseSession(currentSession.data.session);
          }

          res.send("OK!");
          resolveOnce(authResult.data.user ?? null);
        } catch (err) {
          clearCachedSupabaseSession();
          res.status(500).send("Authentication failed.");
          rejectOnce(err);
        }
      });

      server = app.listen(SUPABASE_AUTH_PORT);
      server.on("error", rejectOnce);
    } catch (err) {
      clearCachedSupabaseSession();
      rejectOnce(err);
    }
  });
}

export async function loginGuest(): Promise<User | null> {
  const result = await supabaseClient.auth.signInWithPassword({
    email: "sample@hook.ac",
    password: "password",
  });

  if (result.error) {
    throw result.error;
  }

  return result.data.user ?? null;
}

export const SUPABASE_CONSTANTS = {
  SESSION_FIELD: SUPABASE_SESSION_FIELD,
  REDIRECT_URL: SUPABASE_REDIRECT_URL,
  PORT: SUPABASE_AUTH_PORT,
  PATH: SUPABASE_AUTH_PATH,
  URL: SUPABASE_URL,
  ANON_KEY: SUPABASE_ANON_KEY,
};

export { supabaseClient };

export async function getJwt(): Promise<string> {
  const session = await supabaseClient.auth.getSession();

  if (session.data.session) {
    setCachedSupabaseSession(session.data.session);
    return session.data.session.access_token || "";
  }

  clearCachedSupabaseSession();
  return "";
}
