"use client";

// ... existing code ...
import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/database.types";

// ... existing code ...

const DEBUG_SLOTS = true;

type Block = "AB1" | "AB2" | "CB" ;
type SlotLabel = string;

type ClassroomRow = Database["public"]["Tables"]["free_classrooms"]["Row"];
type ClassroomInsert = Database["public"]["Tables"]["free_classrooms"]["Insert"];

const BLOCK_OPTIONS: Block[] = ["AB1", "AB2", "CB"];

/**
 * Sample timetable mapping (Winter Semester) — UPDATED from your message.
 * 8 periods/day (09:00, 10:00, 11:00, 12:00, 14:00, 15:00, 16:00, 17:00)
 * NOTE: cells can contain multiple slots separated by "&" (e.g., "TF2&G2")
 */
const PERIOD_WINDOWS: Array<{ startMin: number; endMin: number; periodIndex: number }> = [
  { startMin: 9 * 60, endMin: 9 * 60 + 50, periodIndex: 0 }, // 09:00–09:50
  { startMin: 10 * 60, endMin: 10 * 60 + 50, periodIndex: 1 }, // 10:00–10:50
  { startMin: 11 * 60, endMin: 11 * 60 + 50, periodIndex: 2 }, // 11:00–11:50
  { startMin: 12 * 60, endMin: 12 * 60 + 50, periodIndex: 3 }, // 12:00–12:50
  // 12:50–14:00 break (no slot)
  { startMin: 14 * 60, endMin: 14 * 60 + 50, periodIndex: 4 }, // 14:00–14:50
  { startMin: 15 * 60, endMin: 15 * 60 + 50, periodIndex: 5 }, // 15:00–15:50
  { startMin: 16 * 60, endMin: 16 * 60 + 50, periodIndex: 6 }, // 16:00–16:50
  { startMin: 17 * 60, endMin: 17 * 60 + 50, periodIndex: 7 }, // 17:00–17:50
];

// Day index: 0 Sun, 1 Mon, ... 6 Sat
const SAMPLE_TIMETABLE_BY_DAY: Partial<Record<number, string[]>> = {
  // 2 = Tue
  2: ["A1", "B1", "TC1", "D1", "F2", "A2", "B2", "TC2&G2"],
  // 3 = Wed
  3: ["D1", "F1", "E1", "B1", "D2", "TF2&G2", "E2&SC1", "B2"],
  // 4 = Thu
  4: ["C1", "TD1&TG1", "TAA1", "TBB1", "TE2&SE1", "C2", "A2", "TD2&TG2"],
  // 5 = Fri
  5: ["TB1", "TA1", "F1", "TE1&SD2", "C2", "TB2", "TA2", "F2"],
  // 6 = Sat
  6: ["E1&SE2", "C1", "TF1&G1", "A1", "D2", "E2&SD1", "TAA2", "TBB2"],
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function parseSlots(cell: string): SlotLabel[] {
  return cell
    .split("&")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase());
}

function detectActiveSlot(now: Date): { slots: SlotLabel[]; reason: "outside" | "gap" | "no-day" | null } {
  const mins = minutesSinceMidnight(now);

  // Strict valid window: 09:00–18:00 (outside => no active slots)
  if (mins < 9 * 60 || mins >= 18 * 60) {
    if (DEBUG_SLOTS) console.log("[Slot Detection] outside window", { mins, now: now.toISOString() });
    return { slots: [], reason: "outside" };
  }

  const window = PERIOD_WINDOWS.find((w) => mins >= w.startMin && mins < w.endMin);
  if (!window) {
    if (DEBUG_SLOTS) console.log("[Slot Detection] gap (no period window)", { mins, now: now.toISOString() });
    return { slots: [], reason: "gap" };
  }

  const todays = SAMPLE_TIMETABLE_BY_DAY[now.getDay()];
  const cell = todays?.[window.periodIndex];
  if (!cell) {
    if (DEBUG_SLOTS) console.log("[Slot Detection] no-day/cell", { day: now.getDay(), window, mins });
    return { slots: [], reason: "no-day" };
  }

  const slots = parseSlots(cell);
  if (DEBUG_SLOTS) console.log("[Slot Detection] detected", { mins, window, day: now.getDay(), cell, slots });

  return { slots, reason: null };
}

export default function Home() {
  const supabase = React.useMemo(() => createClient(), []);

  // IMPORTANT: must be deterministic on server + first client render (avoid new Date() here)
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    // set client time only after hydration
    const tick = () => {
      const d = new Date();
      if (DEBUG_SLOTS) console.log("[Slot Detection] tick setNow", d.toISOString());
      setNow(d);
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const active = React.useMemo(() => {
    const result = now ? detectActiveSlot(now) : { slots: [], reason: null as const };
    if (DEBUG_SLOTS) console.log("[Slot Detection] useMemo", { now: now?.toISOString() ?? null, result });
    return result;
  }, [now]);

  const hasClock = now !== null;
  const activeSlots = hasClock ? active.slots : [];
  const hasActive = activeSlots.length > 0;

  const slotLabel = !hasClock ? "—" : hasActive ? activeSlots.join(" + ") : "No active slots at this time.";

  const [classrooms, setClassrooms] = React.useState<ClassroomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = React.useState<boolean>(false);
  const [banner, setBanner] = React.useState<{ type: "error" | "info"; text: string } | null>(null);

  const activeSlotsRef = React.useRef<string[]>([]);
  React.useEffect(() => {
    activeSlotsRef.current = activeSlots;
  }, [activeSlots]);

  React.useEffect(() => {
    const channel = supabase
      .channel("free_classrooms_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "free_classrooms" },
        (payload) => {
          // payload.new / payload.old are untyped; cast carefully
          const next = payload.new as Partial<ClassroomRow> | null;
          const prev = payload.old as Partial<ClassroomRow> | null;

          const isRelevant = (slot?: string | null) => !!slot && activeSlotsRef.current.includes(slot);

          // If current view has no active slot(s), ignore realtime updates
          if (activeSlotsRef.current.length === 0) return;

          if (payload.eventType === "INSERT") {
            if (!isRelevant(next?.slot)) return;
            setClassrooms((cur) => {
              const row = next as ClassroomRow;
              if (cur.some((c) => c.id === row.id)) return cur;
              return [row, ...cur].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
            });
          } else if (payload.eventType === "DELETE") {
            if (!isRelevant(prev?.slot)) return;
            setClassrooms((cur) => cur.filter((c) => c.id !== prev?.id));
          } else if (payload.eventType === "UPDATE") {
            if (!isRelevant(next?.slot) && !isRelevant(prev?.slot)) return;
            setClassrooms((cur) =>
              cur
                .map((c) => (c.id === next?.id ? (next as ClassroomRow) : c))
                .filter((c) => activeSlotsRef.current.includes(c.slot))
                .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
            );
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!hasActive) {
        setClassrooms([]);
        return;
      }

      setLoadingRooms(true);
      setBanner(null);

      const { data, error } = await supabase
        .from("free_classrooms")
        .select("*")
        .in("slot", activeSlots)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setBanner({ type: "error", text: error.message });
        setClassrooms([]);
      } else {
        setClassrooms(data ?? []);
      }

      setLoadingRooms(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [supabase, hasActive, activeSlots]);

  const [selectedSlot, setSelectedSlot] = React.useState<string>("");
  React.useEffect(() => {
    // keep selection valid whenever activeSlots changes
    if (!hasActive) {
      setSelectedSlot("");
      return;
    }
    setSelectedSlot((cur) => (cur && activeSlots.includes(cur) ? cur : activeSlots[0] ?? ""));
  }, [hasActive, activeSlots]);

  const [block, setBlock] = React.useState<Block>("AB1");
  const [room, setRoom] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [search, setSearch] = React.useState<string>("");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c) => {
      const hay = `${c.slot} ${c.block} ${c.room} ${c.notes ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [classrooms, search]);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBanner(null);

    const cleanedRoom = room.trim();
    if (!cleanedRoom) return;
    if (!selectedSlot) {
      setBanner({ type: "error", text: "No active slot detected. Try again during 9:00 AM–6:00 PM." });
      return;
    }

    const payload: ClassroomInsert = {
      slot: selectedSlot,
      block,
      room: cleanedRoom,
      notes: notes.trim() ? notes.trim() : null,
    };

    const { error } = await supabase.from("free_classrooms").insert(payload);

    if (error) {
      // Unique violation (duplicate slot+block+room)
      if ((error as { code?: string }).code === "23505") {
        setBanner({ type: "info", text: "That room is already listed for this slot." });
        return;
      }
      setBanner({ type: "error", text: error.message });
      return;
    }

    setRoom("");
    setNotes("");
  }

  async function onRemove(id: string) {
    setBanner(null);
    const { error } = await supabase.from("free_classrooms").delete().eq("id", id);
    if (error) setBanner({ type: "error", text: error.message });
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              Winter Semester · VIT-AP
              <span className="h-1 w-1 rounded-full bg-emerald-400/90" />
              Real-time classroom availability
            </p>

            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Find a free classroom <span className="text-white/70">right now</span>
            </h1>

            <p className="max-w-2xl text-sm leading-6 text-white/70">
              This tool answers one question: <span className="text-white">which classrooms are free for the current slot</span>.
              Students can contribute rooms per slot (A1, B2, etc.). No login in v1.
            </p>
          </div>

          <div className="flex items-stretch gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs text-white/60">Current slot</div>

              <div className="mt-1 flex items-center gap-2">
                {!hasClock ? (
                  <div className="text-sm font-medium text-white/60">{slotLabel}</div>
                ) : hasActive ? (
                  <>
                    <div className="text-lg font-semibold">{slotLabel}</div>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] text-emerald-200">
                      active
                    </span>
                  </>
                ) : (
                  <div className="text-sm font-medium text-white/80">{slotLabel}</div>
                )}
              </div>

              <div className="mt-2 text-[11px] text-white/45">
                {!hasClock ? (
                  <>Detecting local time…</>
                ) : (
                  <>
                    Local time:{" "}
                    {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {active.reason === "gap" ? " · break between periods" : ""}
                    {active.reason === "no-day" ? " · no mapping for today" : ""}
                  </>
                )}
              </div>
            </div>

            <div className="hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/15 via-white/5 to-sky-500/10 px-4 py-3 md:block">
              <div className="text-xs text-white/60">Status</div>
              <div className="mt-1 text-sm text-white/80">
                Ready for contributions
              </div>
            </div>
          </div>
        </header>

        <main className="mt-10 grid gap-6 lg:grid-cols-12">
          <section className="lg:col-span-7">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    Free classrooms {hasActive ? <span className="text-white/60">· Slot {slotLabel}</span> : null}
                  </h2>
                  <p className="mt-1 text-sm text-white/65">
                    {!hasClock
                      ? "Detecting the current slot…"
                      : hasActive
                        ? "Showing rooms contributed for the currently active slot."
                        : "No active slot right now (only 9:00 AM–6:00 PM, excluding breaks)."}
                  </p>
                </div>

                <div className="w-full sm:w-64">
                  <label className="text-xs text-white/60">Search</label>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="e.g., AB1 204"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none ring-0 focus:border-white/20"
                  />
                </div>
              </div>

              {banner ? (
                <div
                  className={
                    banner.type === "error"
                      ? "mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-100"
                      : "mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/75"
                  }
                >
                  {banner.text}
                </div>
              ) : null}

              <div className="mt-6">
                {!hasClock ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
                    <div className="text-sm font-medium">Detecting current slot…</div>
                    <div className="mt-1 text-sm text-white/60">Just a moment.</div>
                  </div>
                ) : !hasActive ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
                    <div className="text-sm font-medium">No active slots at this time.</div>
                    <div className="mt-1 text-sm text-white/60">
                      Come back during an active period between 9:00 AM and 6:00 PM.
                    </div>
                  </div>
                ) : loadingRooms ? (
                  <div className="rounded-2xl border border-white/10 bg-neutral-950/30 p-6">
                    <div className="text-sm font-medium">Loading classrooms…</div>
                    <div className="mt-1 text-sm text-white/60">Fetching latest contributions for {slotLabel}.</div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6">
                    <div className="text-sm font-medium">No classrooms listed yet</div>
                    <div className="mt-1 text-sm text-white/60">Be the first to add a free room for this slot.</div>
                  </div>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {filtered.map((c) => (
                      <li
                        key={c.id}
                        className="group rounded-2xl border border-white/10 bg-neutral-950/30 p-4 transition hover:border-white/15 hover:bg-neutral-950/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
                                {c.slot}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/75">
                                {c.block}
                              </span>
                              <span className="text-base font-semibold tracking-tight">Room {c.room}</span>
                            </div>
                            {c.notes ? (
                              <p className="mt-2 text-sm text-white/60">{c.notes}</p>
                            ) : (
                              <p className="mt-2 text-sm text-white/45">No notes</p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => void onRemove(c.id)}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 opacity-100 transition hover:border-white/20 hover:bg-white/10 sm:opacity-0 sm:group-hover:opacity-100"
                            aria-label={`Remove ${c.slot} ${c.block} ${c.room}`}
                            title="Remove"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/[0.03] to-transparent p-4">
                <div className="text-xs text-white/60">Tip</div>
                <div className="mt-1 text-sm text-white/70">
                  Rooms are stored <span className="text-white">per slot</span> (A1, B2…). If a slot repeats later in the week,
                  the same rooms will show again.
                </div>
              </div>
            </div>
          </section>

          <aside className="lg:col-span-5">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-lg font-semibold">Add a free classroom</h2>
              <p className="mt-1 text-sm text-white/65">
                {!hasClock ? (
                  <>Detecting the current slot…</>
                ) : hasActive ? (
                  <>
                    Contribute a room that's free for <span className="text-white">slot {slotLabel}</span>. No login required
                    in v1.
                  </>
                ) : (
                  <>Come back during an active slot (9:00 AM–6:00 PM) to contribute for the current slot.</>
                )}
              </p>

              <form onSubmit={(e) => void onAdd(e)} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-white/60">Slot</label>
                    <select
                      value={selectedSlot}
                      onChange={(e) => setSelectedSlot(e.target.value)}
                      disabled={!hasActive}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20 disabled:opacity-50"
                    >
                      {hasActive ? (
                        activeSlots.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))
                      ) : (
                        <option value="">No active slot</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-white/60">Block / Building</label>
                    <select
                      value={block}
                      onChange={(e) => setBlock(e.target.value as Block)}
                      className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-white outline-none focus:border-white/20"
                    >
                      {BLOCK_OPTIONS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/60">Room number</label>
                  <input
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    placeholder="e.g., 204"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60">Notes (optional)</label>
                  <input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g., Projector works, quiet, near stairs"
                    className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/20"
                  />
                </div>

                <button
                  type="submit"
                  className={cx(
                    "w-full rounded-2xl px-4 py-3 text-sm font-semibold",
                    "bg-white text-neutral-950 hover:bg-white/90",
                    "disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60"
                  )}
                  disabled={!room.trim() || !hasActive || !selectedSlot}
                >
                  Add classroom
                </button>

                <div className="rounded-2xl border border-white/10 bg-neutral-950/30 p-4">
                  <div className="text-xs text-white/60">Live updates</div>
                  <div className="mt-1 text-sm text-white/70">
                    New rooms added by anyone will appear here automatically for the active slot(s).
                  </div>
                </div>
              </form>
            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-sm font-semibold text-white/90">Scope</h3>
              <div className="mt-2 grid gap-2 text-sm text-white/70">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-950/30 px-4 py-3">
                  <span>Only today</span>
                  <span className="text-white/60">Yes</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-950/30 px-4 py-3">
                  <span>Only Winter Semester</span>
                  <span className="text-white/60">Yes</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-950/30 px-4 py-3">
                  <span>Valid time window</span>
                  <span className="text-white/60">9:00 AM – 6:00 PM</span>
                </div>
              </div>
            </div>
          </aside>
        </main>

        <footer className="mt-10 border-t border-white/10 pt-6 text-xs text-white/45">
          Built for quick, real-time "where can I sit right now?" decisions. v1 has no authentication.
        </footer>
      </div>
    </div>
  );
}
// ... existing code ...
