// Usage guard: the single source of truth for rest / round / untimed / wrap-up / online-class.
// Lives in the main process and persists to disk, so reloading the renderer or restarting
// the app cannot clear a rest period (the 2026-10-24 bypass).
//
// Concepts
//   round  = untimed use + timed session (+ wrap-up). Capped at ROUND_LIMIT_SEC.
//   rest   = 1:1 with the round's total, starts when the round ends. Persisted as restEndAt.
//   class  = online-class mode: exempt from detection and totals; rest keeps counting down.
// All side effects (windows, IPC, Firebase) go through `hooks`, keeping this file testable.
const fs = require('fs');
const path = require('path');

const CFG = {
  ROUND_LIMIT_SEC: 30 * 60,
  WRAPUP_SEC: 5 * 60,
  WRAPUP_OFFER_MS: 3 * 60 * 1000,      // wrap-up must be claimed soon after time is up
  SNOOZE_MAX: 2,
  SNOOZE_MS: 5 * 60 * 1000,
  UNTIMED_CONFIRM_MS: 60 * 1000,       // continuous use before it counts as untimed
  // Getting ready (open the app, pick category and time) is not use: if the timer starts
  // within this long and no snooze was used, the untimed stretch costs no allowance.
  // Kept short on purpose: a parent who sees "not timing" for longer has a fair point.
  PREP_GRACE_SEC: 3 * 60,
  CANDIDATE_DROP_MS: 60 * 1000,        // idle gap that cancels a not-yet-confirmed candidate
  // 2026-11-14 (parent): kids felt cheated when a few minutes of clicking around cost them
  // the 30-min button. Untimed use now counts only time actually in use, and short stretches
  // that end with the kid walking away are forgiven. None of this can lower a kid's time.
  UNTIMED_IDLE_CLOSE_MS: 10 * 60 * 1000,
  // A poll counts as "in use" while the last input is this recent (reading / thinking
  // between clicks is use), or while a video is visibly playing.
  IN_USE_IDLE_SEC: 60,
  BRIEF_USE_MAX_SEC: 5 * 60,           // idle-closed untimed stretch this short is forgiven
  INPUT_SEEN_MIN_POLLS: 6,             // ~30 s of input before "touched keyboard/mouse"
  REMINDER_REPOP_MS: 30 * 1000,
  CLASS_SEC: 35 * 60,
  POST_CLASS_REST_SEC: 5 * 60,
  MUSIC_BREAK_SEC: 60,                 // rest overlay steps aside once per rest to set up music
  LOCK_STREAK_SEC: 60,
  LOCK_PENALTY_SEC: 120,               // rest paused while used (+60) plus 1:1 overtime (+60)
  ACTIVE_IDLE_SEC: 5,
  POLL_EVERY_TICKS: 5,                 // activity poll every 5 s, UI tick every 1 s
  HEARTBEAT_MS: 15 * 1000,
  APP_GAP_MS: 2 * 60 * 1000,
  // Hard ceiling for any single rest. Rest is 1:1 with a round (max 30 min), so anything
  // longer is a bug. 2026-11-13: a 10 h sleep inside an untimed stretch produced a 616 min
  // rest; this ceiling makes any future accounting bug harmless.
  REST_MAX_SEC: 30 * 60,
  // Ticks run every second; a gap longer than this means the PC slept or the process froze.
  // Nothing was observed during the gap, so it must never be counted as use.
  TICK_GAP_MS: 60 * 1000,
};

const USER_NAMES = { user1: '品瑜', user2: '品榕' };
const USER_IDS = { user1: 'pinyu', user2: 'pinrong' };

function hhmm(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function freshRound() {
  return { usedSec: 0, snoozeCount: 0 };
}
function freshState() {
  return {
    version: 1,
    identity: null,
    restEndAt: 0,
    restReason: null,           // 'round' | 'class'
    round: freshRound(),
    candidate: null,            // { firstActiveAt, lastActiveAt }
    untimed: null,              // { startAt, lastActiveAt, snoozes }
    timed: null,                // { startAt, category, totalDuration, elapsedSec }
    wrapupOffer: null,          // { until, prevUsed }
    wrapup: null,               // { startAt, endAt, prevUsed }
    cls: null,                  // { startAt, endAt, flags }
    lastClassEndAt: 0,
    musicBreak: null,           // { startAt, endAt } while the rest overlay is stepped aside
    musicUsedThisRest: false,
    snoozeUntil: 0,
    lastHeartbeat: 0,
    exitReason: null,           // 'user' | 'system' | 'update'
    pendingRecords: [],
  };
}

class UsageGuard {
  constructor(hooks) {
    this.hooks = hooks;
    this.state = freshState();
    this.filePath = null;
    this.tickCount = 0;
    this.lockStreakSec = 0;
    this.reminderShowing = false;
    this.reminderHiddenAt = 0;
    this.justCompletedUntil = 0;
    this.interval = null;
    this.lastTickAt = 0;
  }

  // ---------- persistence ----------
  load(userDataPath) {
    this.filePath = path.join(userDataPath, 'usage-guard.json');
    try {
      const raw = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      this.state = Object.assign(freshState(), raw);
    } catch (e) {
      this.state = freshState();
    }
  }
  save() {
    if (!this.filePath) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.state));
    } catch (e) {
      console.error('usage-guard save failed:', e.message);
    }
  }

  isChild() {
    return this.state.identity === 'user1' || this.state.identity === 'user2';
  }

  // Called once at startup (after load) to settle whatever the previous run left open.
  recoverAfterStart() {
    const s = this.state;
    const now = Date.now();
    const lastHb = s.lastHeartbeat || now;
    if (!this.isChild()) {
      s.exitReason = null;
      this.save();
      return;
    }
    this.dropBogusRest(now);

    if (s.cls) {
      if (now < s.cls.endAt && now - lastHb < CFG.APP_GAP_MS) {
        // Quick restart inside the class window: keep the class going.
      } else {
        this.endClass('app-closed', Math.min(s.cls.endAt, lastHb));
      }
    }
    if (s.wrapup) this.endWrapup('app-closed', Math.min(s.wrapup.endAt, lastHb));
    if (s.timed) {
      const t = s.timed;
      s.timed = null;
      this.recordTimed(t, Math.min(t.elapsedSec, t.totalDuration), lastHb, false, 'app-closed');
      s.round.usedSec += Math.min(t.elapsedSec, t.totalDuration);
      this.endRound(lastHb);
    }
    if (s.untimed) this.endRound(s.untimed.lastActiveAt);
    s.candidate = null;

    if (s.lastHeartbeat && now - s.lastHeartbeat > CFG.APP_GAP_MS &&
        s.exitReason !== 'system' && s.exitReason !== 'update') {
      this.pushRecord({
        kind: 'event', type: s.exitReason === 'user' ? '計時程式被手動退出' : '計時程式沒有在執行',
        startAt: s.lastHeartbeat, endAt: now, duration: 0, counted: false,
        flags: ['app-gap'],
      });
    }
    this.pushRecord({ kind: 'event', type: '程式啟動', startAt: now, endAt: now, duration: 0, counted: false });
    s.exitReason = null;
    s.lastHeartbeat = now;
    this.save();
  }

  // Re-create mode windows after startup recovery (windows do not survive a restart).
  resumeUi() {
    const s = this.state;
    const now = Date.now();
    if (s.cls) this.hooks.showModeMini('📘 線上課', Math.ceil((s.cls.endAt - now) / 1000));
    this.refreshRestScreen();
    this.broadcast();
  }

  start() {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), 1000);
  }

  setIdentity(identity) {
    if (this.state.identity === identity) return;
    if (this.isChild()) {
      // Leaving a kid identity switches every guard off, so it goes on the kid's log.
      const now = Date.now();
      if (this.state.untimed) this.endRound(now);
      this.pushRecord({
        kind: 'event', type: `身份切換為${identity === 'parent' ? '家長模式' : (USER_NAMES[identity] || '未選擇')}`,
        startAt: now, endAt: now, duration: 0, counted: false, flags: ['identity-change'],
      });
    }
    this.state.identity = identity;
    if (!this.isChild()) {
      this.hooks.hideRest();
      this.hooks.hideReminder();
    }
    this.save();
    this.broadcast();
  }

  markExit(reason) {
    if (!this.state.exitReason || reason === 'system' || reason === 'update') {
      this.state.exitReason = reason;
    }
    this.state.lastHeartbeat = Date.now();
    this.save();
  }

  // ---------- derived values ----------
  restActive(now = Date.now()) {
    return this.state.restEndAt > now;
  }
  // Seconds actually in use during the open untimed stretch (gaps excluded).
  // States saved by older builds have no activeSec: fall back to the wall-clock span.
  untimedUsedSec(now = Date.now()) {
    const u = this.state.untimed;
    if (!u) return 0;
    if (typeof u.activeSec === 'number') return u.activeSec;
    return Math.max(0, Math.round((now - u.startAt) / 1000));
  }
  // Untimed seconds that count against the round. Without a snooze the first PREP_GRACE_SEC
  // are free and only the excess counts; once a snooze was used, all of it counts.
  untimedCountedSec(now = Date.now()) {
    const u = this.state.untimed;
    if (!u) return 0;
    const sec = this.untimedUsedSec(now);
    return u.snoozes === 0 ? Math.max(0, sec - CFG.PREP_GRACE_SEC) : sec;
  }
  allowanceSec(now = Date.now()) {
    return Math.max(0, CFG.ROUND_LIMIT_SEC - this.state.round.usedSec - this.untimedCountedSec(now));
  }
  mode(now = Date.now()) {
    const s = this.state;
    if (s.cls) return 'class';
    if (s.wrapup) return 'wrapup';
    if (s.timed) return 'timing';
    if (this.restActive(now)) return 'rest';
    if (s.untimed) return 'untimed';
    return 'idle';
  }
  wrapupAvailable(now = Date.now()) {
    const o = this.state.wrapupOffer;
    return !!(o && now < o.until && this.restActive(now));
  }

  snapshot() {
    const now = Date.now();
    const s = this.state;
    return {
      identity: s.identity,
      active: this.isChild(),
      mode: this.mode(now),
      now,
      restEndAt: s.restEndAt,
      restRemainingSec: Math.max(0, Math.ceil((s.restEndAt - now) / 1000)),
      restReason: s.restReason,
      allowanceSec: this.allowanceSec(now),
      roundLimitSec: CFG.ROUND_LIMIT_SEC,
      roundUsedSec: s.round.usedSec + this.untimedCountedSec(now),
      snoozesLeft: Math.max(0, CFG.SNOOZE_MAX - s.round.snoozeCount),
      untimedStartAt: s.untimed ? s.untimed.startAt : null,
      wrapupAvailable: this.wrapupAvailable(now),
      wrapupOfferRemainingSec: s.wrapupOffer ? Math.max(0, Math.ceil((s.wrapupOffer.until - now) / 1000)) : 0,
      wrapupEndAt: s.wrapup ? s.wrapup.endAt : null,
      classEndAt: s.cls ? s.cls.endAt : null,
      musicBreakAvailable: this.restActive(now) && !s.musicUsedThisRest && !s.musicBreak,
      musicBreakRemainingSec: s.musicBreak ? Math.max(0, Math.ceil((s.musicBreak.endAt - now) / 1000)) : 0,
      justCompleted: now < this.justCompletedUntil,
    };
  }
  broadcast() {
    this.hooks.onState(this.snapshot());
  }

  // ---------- records ----------
  pushRecord(r) {
    const identity = this.state.identity;
    if (!USER_IDS[identity]) return;
    const rec = {
      id: `${r.startAt}-${r.kind}-${Math.random().toString(36).slice(2, 8)}`,
      kind: r.kind,
      type: r.type,
      user: USER_NAMES[identity],
      userId: USER_IDS[identity],
      start: hhmm(r.startAt),
      end: hhmm(r.endAt),
      startIso: new Date(r.startAt).toISOString(),
      endIso: new Date(r.endAt).toISOString(),
      dateKey: dateKey(r.endAt),
      duration: Math.max(0, Math.round(r.duration || 0)),
      counted: r.counted !== false,
      completed: r.completed !== undefined ? r.completed : null,
      endReason: r.endReason || null,
      snoozes: r.snoozes || 0,
      flags: r.flags || [],
      // Legacy fields kept so older readers (and Firestore console) still make sense.
      time: hhmm(r.endAt),
      timestamp: new Date(r.endAt).toISOString(),
    };
    this.state.pendingRecords.push(rec);
    if (this.state.pendingRecords.length > 500) this.state.pendingRecords.shift();
    this.save();
    this.hooks.emitRecord(rec);
  }
  ackRecord(id) {
    const before = this.state.pendingRecords.length;
    this.state.pendingRecords = this.state.pendingRecords.filter(r => r.id !== id);
    if (this.state.pendingRecords.length !== before) this.save();
  }
  resendPending() {
    this.state.pendingRecords.forEach(r => this.hooks.emitRecord(r));
  }

  recordTimed(t, usedSec, endAt, completed, reason) {
    if (usedSec < 5) return;
    const flags = [];
    if (reason === 'switch-class') flags.push('switch-class');
    if (reason === 'app-closed') flags.push('interrupted');
    if (reason === 'limit') flags.push('round-limit');
    this.pushRecord({
      kind: 'timed', type: t.category || '其他', startAt: t.startAt, endAt,
      duration: usedSec, counted: true, completed, endReason: reason, flags,
    });
  }

  // video-only: never really touched keyboard/mouse, detected by a playing video. A few
  // stray polls (mouse jitter) do not count as touching; see INPUT_SEEN_MIN_POLLS.
  untimedFlags(u) {
    const polls = typeof u.inputPolls === 'number' ? u.inputPolls : (u.inputSeen ? CFG.INPUT_SEEN_MIN_POLLS : 0);
    return polls < CFG.INPUT_SEEN_MIN_POLLS ? ['video-only'] : [];
  }

  closeUntimed(endAt, reason) {
    const u = this.state.untimed;
    if (!u) return;
    const sec = this.untimedUsedSec(endAt);
    this.state.untimed = null;
    this.hooks.hideReminder();
    this.reminderShowing = false;
    const flags = this.untimedFlags(u);

    // Brief use, then walked away (or the PC slept): forgiven entirely. Not while a paused
    // timer keeps the round open, so pausing cannot be used to launder untimed use.
    if ((reason === 'idle' || reason === 'sleep') && !this.state.timed && sec <= CFG.BRIEF_USE_MAX_SEC) {
      this.pushRecord({
        kind: 'untimed', type: '短暫使用（不計）', startAt: u.startAt, endAt, duration: sec,
        counted: false, endReason: reason, snoozes: u.snoozes, flags: flags.concat(['brief']),
      });
      return;
    }

    // Prep grace: without a snooze the first PREP_GRACE_SEC before starting the timer are free
    // (logged, not counted); only the excess counts.
    let counted = sec;
    if (reason === 'timer-start' && u.snoozes === 0) {
      const free = Math.min(sec, CFG.PREP_GRACE_SEC);
      counted = sec - free;
      this.pushRecord({
        kind: 'untimed', type: '準備時間', startAt: u.startAt, endAt: counted > 0 ? u.startAt + free * 1000 : endAt,
        duration: free, counted: false, endReason: reason, flags: ['prep-grace'],
      });
      if (counted <= 0) return;
    }
    this.state.round.usedSec += counted;
    this.pushRecord({
      kind: 'untimed', type: '未計時使用', startAt: counted < sec ? endAt - counted * 1000 : u.startAt, endAt,
      duration: counted, counted: true, endReason: reason, snoozes: u.snoozes, flags,
    });
  }

  // ---------- rest / round ----------
  startRest(totalSec, fromMs, reason) {
    if (totalSec <= 0) return;
    const end = fromMs + Math.min(totalSec, CFG.REST_MAX_SEC) * 1000;
    if (end > this.state.restEndAt) {
      this.state.restEndAt = end;
      this.state.restReason = reason || 'round';
    }
    this.save();
    this.hooks.onRestChanged(this.state.restEndAt);
  }
  endRound(atMs) {
    const s = this.state;
    if (s.untimed) this.closeUntimed(atMs, 'round-end');
    const used = s.round.usedSec;
    s.round = freshRound();
    s.snoozeUntil = 0;
    s.candidate = null;
    if (used > 0) this.startRest(used, atMs, 'round');
    this.save();
  }
  // A rest ending further out than the ceiling (+ lock-penalty slack) cannot be legitimate.
  isBogusRestEnd(ms, now = Date.now()) {
    return ms - now > (CFG.REST_MAX_SEC + CFG.LOCK_PENALTY_SEC) * 1000;
  }
  // Clears a rest left behind by an older build's accounting bug (local file or Firebase).
  dropBogusRest(now = Date.now()) {
    if (!this.isBogusRestEnd(this.state.restEndAt, now)) return false;
    this.pushRecord({
      kind: 'event', type: '異常休息時間已解除', startAt: now, endAt: now, duration: 0, counted: false,
      flags: ['bogus-rest'],
    });
    this.state.restEndAt = 0;
    this.state.restReason = null;
    this.state.wrapupOffer = null;
    this.save();
    this.hooks.onRestChanged(0);
    return true;
  }
  applyRemoteRest(ms) {
    if (!this.isChild() || typeof ms !== 'number') return;
    if (this.isBogusRestEnd(ms)) return;
    if (ms > Date.now() && ms > this.state.restEndAt) {
      this.state.restEndAt = ms;
      this.state.restReason = this.state.restReason || 'round';
      this.state.round = freshRound();
      this.save();
      this.broadcast();
    }
  }

  // ---------- timer integration (called from main.js) ----------
  canStartTimer(totalDuration) {
    if (!this.isChild()) return { ok: true };
    const m = this.mode();
    if (m === 'rest') return { ok: false, reason: 'rest' };
    if (m === 'class' || m === 'wrapup') return { ok: false, reason: m };
    if (totalDuration > this.allowanceSec() + 30) return { ok: false, reason: 'allowance' };
    return { ok: true };
  }
  onTimerStart({ category, totalDuration }) {
    if (!this.isChild()) return;
    const now = Date.now();
    if (this.state.untimed) this.closeUntimed(now, 'timer-start');
    this.state.candidate = null;
    this.state.wrapupOffer = null;
    this.state.timed = { startAt: now, category, totalDuration, elapsedSec: 0 };
    this.save();
    this.broadcast();
  }
  onTimerResume() {
    if (!this.isChild()) return;
    if (this.state.untimed) this.closeUntimed(Date.now(), 'timer-resume');
    this.state.candidate = null;
    this.save();
  }
  onTimerEnd({ completed, usedSec, reason }) {
    if (!this.isChild() || !this.state.timed) return;
    const now = Date.now();
    const t = this.state.timed;
    this.state.timed = null;
    const used = Math.min(usedSec, t.totalDuration);
    this.recordTimed(t, used, now, completed, reason);
    this.state.round.usedSec += used;
    const roundTotal = this.state.round.usedSec + this.untimedUsedSec(now);
    this.endRound(now);
    if (completed) {
      this.state.wrapupOffer = { until: now + CFG.WRAPUP_OFFER_MS, prevUsed: roundTotal };
      this.justCompletedUntil = now + 3000;
    }
    this.save();
    this.refreshRestScreen();
    this.broadcast();
  }

  // ---------- wrap-up ----------
  startWrapup() {
    if (!this.wrapupAvailable()) return false;
    const now = Date.now();
    const o = this.state.wrapupOffer;
    this.state.wrapupOffer = null;
    // Suspend the rest that the finished round just started; it restarts after wrap-up.
    this.state.restEndAt = 0;
    this.state.wrapup = { startAt: now, endAt: now + CFG.WRAPUP_SEC * 1000, prevUsed: o.prevUsed };
    this.save();
    this.hooks.hideRest();
    this.hooks.showModeMini('⏳ 收尾', CFG.WRAPUP_SEC);
    this.broadcast();
    return true;
  }
  endWrapup(reason, atMs) {
    const w = this.state.wrapup;
    if (!w) return;
    const end = atMs || Math.min(Date.now(), w.endAt);
    this.state.wrapup = null;
    const sec = Math.max(0, Math.round((end - w.startAt) / 1000));
    this.pushRecord({ kind: 'wrapup', type: '收尾', startAt: w.startAt, endAt: end, duration: sec, counted: true, endReason: reason });
    this.startRest(w.prevUsed + sec, end, 'round');
    this.hooks.hideModeMini();
    this.refreshRestScreen();
    this.broadcast();
  }

  // ---------- online class ----------
  startClass() {
    if (!this.isChild()) return false;
    const now = Date.now();
    const s = this.state;
    if (s.cls) return false;
    const flags = [];
    // Decide flags before stopping the timer, which itself starts a rest.
    const wasResting = this.restActive(now) && !s.timed && !s.wrapup;
    if (s.musicBreak) this.endMusicBreak(now);
    if (s.wrapup) this.endWrapup('switch-class');
    if (s.timed) {
      flags.push('switched-from-timer');
      this.hooks.forceStopTimer('switch-class'); // re-enters onTimerEnd synchronously
    }
    if (s.untimed) this.endRound(now);
    if (now - s.lastClassEndAt < 2 * 60 * 1000) flags.push('chained');
    else if (wasResting) flags.push('started-during-rest');
    s.wrapupOffer = null;
    s.candidate = null;
    s.cls = { startAt: now, endAt: now + CFG.CLASS_SEC * 1000, flags };
    this.save();
    this.hooks.hideReminder();
    this.reminderShowing = false;
    this.hooks.hideRest();
    this.hooks.showModeMini('📘 線上課', CFG.CLASS_SEC);
    this.broadcast();
    return true;
  }
  endClass(reason, atMs) {
    const c = this.state.cls;
    if (!c) return;
    const end = atMs || Math.min(Date.now(), c.endAt);
    this.state.cls = null;
    this.state.lastClassEndAt = end;
    const sec = Math.max(0, Math.round((end - c.startAt) / 1000));
    this.pushRecord({
      kind: 'class', type: '線上課', startAt: c.startAt, endAt: end, duration: sec,
      counted: false, endReason: reason, flags: c.flags,
    });
    this.startRest(CFG.POST_CLASS_REST_SEC, end, 'class');
    this.hooks.hideModeMini();
    this.refreshRestScreen();
    this.broadcast();
  }

  // ---------- reminder actions (from renderer) ----------
  snooze() {
    const s = this.state;
    if (!s.untimed || s.round.snoozeCount >= CFG.SNOOZE_MAX) return false;
    s.round.snoozeCount++;
    s.untimed.snoozes++;
    s.snoozeUntil = Date.now() + CFG.SNOOZE_MS;
    this.reminderShowing = false;
    this.hooks.hideReminder();
    this.save();
    this.broadcast();
    return true;
  }
  reminderHidden() {
    this.reminderShowing = false;
    this.reminderHiddenAt = Date.now();
  }

  // ---------- music break (rest overlay steps aside for 60 s, once per rest) ----------
  // Listening to music is not "use", but the overlay blocks opening a music app.
  // The rest countdown keeps running; the break is logged so parents can see it.
  startMusicBreak() {
    const s = this.state;
    const now = Date.now();
    if (!this.isChild() || !this.restActive(now) || s.musicUsedThisRest || s.musicBreak) return false;
    s.musicUsedThisRest = true;
    s.musicBreak = { startAt: now, endAt: now + CFG.MUSIC_BREAK_SEC * 1000 };
    this.lockStreakSec = 0;
    this.save();
    this.hooks.hideRest();
    this.hooks.openMusicApp();
    this.broadcast();
    return true;
  }
  endMusicBreak(atMs) {
    const b = this.state.musicBreak;
    if (!b) return;
    this.state.musicBreak = null;
    const end = atMs || Date.now();
    this.pushRecord({
      kind: 'music', type: '休息中設定音樂', startAt: b.startAt, endAt: end,
      duration: Math.round((end - b.startAt) / 1000), counted: false,
    });
    this.save();
    this.refreshRestScreen();
  }

  refreshRestScreen() {
    if (!this.isChild()) return;
    const m = this.mode();
    if (m === 'rest' && !this.state.musicBreak) this.hooks.showRest();
    else this.hooks.hideRest();
  }

  // ---------- main loop ----------
  tick() {
    const s = this.state;
    const now = Date.now();
    this.tickCount++;
    const gapped = this.lastTickAt > 0 && now - this.lastTickAt > CFG.TICK_GAP_MS;
    this.lastTickAt = now;

    if (now - s.lastHeartbeat >= CFG.HEARTBEAT_MS) {
      s.lastHeartbeat = now;
      if (s.timed) s.timed.elapsedSec = this.hooks.getTimerElapsedSec();
      this.save();
    }
    if (!this.isChild()) return;

    // Woke from sleep / froze: close untimed use where it was last seen, BEFORE the poll
    // below refreshes lastActiveAt (that order caused the 10 h untimed stretch).
    if (gapped) {
      s.candidate = null;
      if (s.untimed) {
        const at = s.untimed.lastActiveAt;
        this.closeUntimed(at, 'sleep');
        if (!s.timed) {
          this.endRound(at);
          this.refreshRestScreen();
        }
      }
    }

    if (s.cls) {
      if (now >= s.cls.endAt) this.endClass('auto');
      else this.hooks.updateModeMini('📘 線上課', Math.ceil((s.cls.endAt - now) / 1000));
      this.broadcast();
      return;
    }
    if (s.wrapup) {
      if (now >= s.wrapup.endAt) this.endWrapup('auto');
      else this.hooks.updateModeMini('⏳ 收尾', Math.ceil((s.wrapup.endAt - now) / 1000));
      this.broadcast();
      return;
    }

    if (s.musicBreak && now >= s.musicBreak.endAt) this.endMusicBreak(s.musicBreak.endAt);

    if (s.restEndAt > 0 && now >= s.restEndAt) {
      s.restEndAt = 0;
      s.restReason = null;
      s.wrapupOffer = null;
      s.musicUsedThisRest = false;
      if (s.musicBreak) this.endMusicBreak(now);
      this.lockStreakSec = 0;
      this.save();
      this.hooks.hideRest();
      this.hooks.onRestEnded();
    }
    if (s.wrapupOffer && now >= s.wrapupOffer.until) s.wrapupOffer = null;

    const isPollTick = this.tickCount % CFG.POLL_EVERY_TICKS === 0;
    if (isPollTick) this.poll(now);
    this.broadcast();
  }

  poll(now) {
    const s = this.state;
    const idleSec = this.hooks.getIdleSec();
    const inputActive = idleSec < CFG.ACTIVE_IDLE_SEC;
    // A visibly playing video counts as use for untimed detection only (eyes on screen,
    // hands off). Music / hidden videos do not report it; see lib/display-probe.js.
    const videoActive = this.hooks.getVideoActive ? this.hooks.getVideoActive() : false;
    const active = inputActive || videoActive;
    const timer = this.hooks.getTimerInfo();

    if (s.timed && timer.active && !timer.paused) return; // timing: nothing to detect

    if (this.restActive(now)) {
      if (s.musicBreak) return; // overlay stepped aside on purpose; no lock either
      this.hooks.showRest(); // idempotent; also restores a window that got closed somehow
      // Input only: a video still playing behind the rest overlay is not being watched.
      this.lockStreakSec = inputActive ? this.lockStreakSec + 5 : 0;
      if (this.lockStreakSec >= CFG.LOCK_STREAK_SEC) {
        this.lockStreakSec = 0;
        s.restEndAt = Math.min(s.restEndAt + CFG.LOCK_PENALTY_SEC * 1000, now + CFG.REST_MAX_SEC * 1000);
        this.pushRecord({
          kind: 'overtime', type: '休息中持續使用', startAt: now - CFG.LOCK_STREAK_SEC * 1000, endAt: now,
          duration: CFG.LOCK_STREAK_SEC, counted: true, flags: ['locked'],
        });
        this.save();
        this.hooks.onRestChanged(s.restEndAt);
        this.hooks.lockWorkstation();
      }
      return;
    }

    // Untimed detection (no timer, or timer paused).
    if (active) {
      if (s.untimed) {
        s.untimed.lastActiveAt = now;
        if (inputActive) s.untimed.inputPolls = (s.untimed.inputPolls || 0) + 1;
      } else if (s.candidate) {
        s.candidate.lastActiveAt = now;
        if (inputActive) s.candidate.inputPolls = (s.candidate.inputPolls || 0) + 1;
        if (now - s.candidate.firstActiveAt >= CFG.UNTIMED_CONFIRM_MS) {
          s.untimed = {
            startAt: s.candidate.firstActiveAt, lastActiveAt: now, snoozes: 0,
            activeSec: Math.round((now - s.candidate.firstActiveAt) / 1000),
            inputPolls: s.candidate.inputPolls || 0,
          };
          s.candidate = null;
          this.save();
        }
      } else {
        // Activity happened somewhere inside the last poll interval.
        s.candidate = { firstActiveAt: now - CFG.POLL_EVERY_TICKS * 1000, lastActiveAt: now, inputPolls: inputActive ? 1 : 0 };
      }
    } else if (s.candidate && now - s.candidate.lastActiveAt > CFG.CANDIDATE_DROP_MS) {
      s.candidate = null;
    }

    // Only time in use counts: input within IN_USE_IDLE_SEC, or a visible video.
    if (s.untimed && (idleSec < CFG.IN_USE_IDLE_SEC || videoActive)) {
      if (typeof s.untimed.activeSec !== 'number') s.untimed.activeSec = this.untimedUsedSec(now);
      else s.untimed.activeSec += CFG.POLL_EVERY_TICKS;
    }

    if (!s.untimed) return;

    if (now - s.untimed.lastActiveAt >= CFG.UNTIMED_IDLE_CLOSE_MS) {
      const at = s.untimed.lastActiveAt;
      this.closeUntimed(at, 'idle');
      if (s.timed) {
        this.save(); // paused timer keeps the round open
      } else {
        this.endRound(at);
        this.refreshRestScreen();
      }
      return;
    }

    const timedElapsed = s.timed ? timer.elapsedSec : 0;
    if (s.round.usedSec + this.untimedUsedSec(now) + timedElapsed >= CFG.ROUND_LIMIT_SEC) {
      this.closeUntimed(now, 'round-limit');
      if (s.timed) this.hooks.forceStopTimer('limit'); // ends the round via onTimerEnd
      else this.endRound(now);
      this.refreshRestScreen();
      return;
    }

    const snoozed = now < s.snoozeUntil;
    const repopReady = now - this.reminderHiddenAt >= CFG.REMINDER_REPOP_MS;
    if (!snoozed && !this.reminderShowing && repopReady) {
      this.reminderShowing = true;
      this.hooks.showReminder({
        snoozesLeft: Math.max(0, CFG.SNOOZE_MAX - s.round.snoozeCount),
        untimedSince: hhmm(s.untimed.startAt),
        allowanceMin: Math.floor(this.allowanceSec(now) / 60),
      });
    }
  }
}

module.exports = { UsageGuard, CFG };
