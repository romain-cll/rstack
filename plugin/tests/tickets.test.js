"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// The pure functions of plugin/hooks/tickets.ts. The contract these tests fix:
//
//   listTickets({ worktrees, files, sessions, self? }) -> Ticket[]
//     worktrees: `git worktree list --porcelain` output
//     files:     worktree path -> { file name -> text } (the files of the
//                worktree's features folder, `.rstack/features/`)
//     sessions:  the JSON text `list_sessions` answers (an array; it leaves
//                out the calling session)
//     self:      the JSON text `get_session` answers for `self` (one session
//                object, same fields as an entry of `sessions`); missing,
//                an error text or unparseable -> the list alone
//     Ticket:    { worktree, slug?, title?, status?, branch?, red?,
//                  session?: { sessionId, isRunning, link, isPilot? } }
//                  (isPilot: true on the session taken from `self`)
//   parseReview(text | undefined) -> { rounds, verdict, fixes, cap } | undefined
//   deriveState(ticket, { review?, questions? }) -> { kind, ... }
//     questions: [{ sessionId?, question, at }] (what the sessions publish;
//       sessionId is the app session id, `local_…`, of the asking session)
//   parsePr({ exitCode, stdout }) -> { state, url, ci } | undefined
//     (the result of `gh pr view <branch> --json state,url,statusCheckRollup`)
//
// pilot-v2-ui adds:
//   ticketId(title | undefined, slug) -> { id?, name }
//   sections(rows) -> [{ id: 'toi' | 'running' | 'pr', rows, count }, ...]
//     rows: { state: { kind }, since?: number (ms) }; sections in that order
//   stepOf(status | undefined) -> 1..5
//   waitingSince({ state, session? }) -> ms | undefined
//     state.at: the pending question's `at`; session.lastActivityAt: ISO text
//   elapsed(since, now) -> { n, unit: 'min' | 'h' | 'd' }
//   reviewLine({ rounds, verdict, fixes, cap }) -> { rounds, cap, running }
//     running: 'fix' | 'round' | undefined
//   planSummary(text) -> string | undefined
//
// pilot-gitlab adds:
//   forgeOf(url | undefined) -> 'gitlab' | 'github'   (the `origin` URL)
//   parseMr({ exitCode, stdout }) -> { state, url, ci, number, kind: 'mr' } | undefined
//     (the result of `glab mr view <branch> -F json`)
//
// pilot-v3-ui adds:
//   counters(rows) -> { toi, review, dev, pr }
//     rows: { section, state: { kind } } (a PilotRow: `section` is sectionOf(kind))
//   planFacts(text) -> { criteria, files }
//   segments(step) -> { name: 'plan' | 'red' | 'green' | 'review' | 'ship',
//                       state: 'done' | 'current' | 'todo' }[]   (5, in that order)
var testing_1 = require("claude-code/testing");
var tickets_1 = require("../hooks/tickets");
var MAIN = '/repo';
var WT_A = '/repo/.claude/worktrees/a';
var WT_B = '/repo/.claude/worktrees/b';
var WT_C = '/repo/.claude/worktrees/c';
var porcelain = function (paths) {
    return paths
        .map(function (path, i) {
        return "worktree ".concat(path, "\nHEAD ").concat(String(i).repeat(40), "\nbranch refs/heads/wt-").concat(i, "\n");
    })
        .join('\n');
};
// A worktree whose block holds a `detached` line instead of a `branch` line.
var detachedPorcelain = function (blocks) {
    return blocks
        .map(function (_a, i) {
        var path = _a.path, detached = _a.detached;
        return "worktree ".concat(path, "\nHEAD ").concat(String(i).repeat(40), "\n").concat(detached ? 'detached' : "branch refs/heads/wt-".concat(i), "\n");
    })
        .join('\n');
};
var spec = function (o) {
    var _a;
    return __spreadArray(__spreadArray(__spreadArray(__spreadArray([
        '---',
        "status: ".concat(o.status)
    ], (o.red ? ["red: ".concat(o.red)] : []), true), [
        'owner: Someone'
    ], false), (o.noBranch ? [] : ["branch: ".concat((_a = o.branch) !== null && _a !== void 0 ? _a : 'feat/x')]), true), [
        'created: 2026-11-18',
        '---',
        '',
        "# ".concat(o.title),
        '',
        '## User story',
        'As a user.',
    ], false).join('\n');
};
var session = function (o) { return (__assign({ title: 't', isArchived: false, isRunning: false, lastActivityAt: '2026-11-18T10:00:00.000Z', group: null, link: "claude://claude.ai/epitaxy/".concat(o.sessionId), remoteControlActive: false }, o)); };
(0, testing_1.test)('AC1 — one ticket per spec, never a review history, with its frontmatter', function () {
    var _a;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([MAIN, WT_A]),
        files: (_a = {},
            _a[MAIN] = {},
            _a[WT_A] = {
                'alpha.md': spec({
                    title: 'Alpha feature',
                    status: 'red',
                    branch: 'feat/alpha',
                    red: 'a1b2c3d',
                }),
                'alpha.review.md': '## Round 1 — OK — abc1234\n',
                'beta.md': spec({ title: 'Beta feature', status: 'draft' }),
            },
            _a),
        sessions: '[]',
    });
    (0, testing_1.expect)(tickets).toHaveLength(2);
    (0, testing_1.expect)(tickets[0]).toMatchObject({
        worktree: WT_A,
        slug: 'alpha',
        title: 'Alpha feature',
        status: 'red',
        branch: 'feat/alpha',
        red: 'a1b2c3d',
    });
    (0, testing_1.expect)(tickets[1]).toMatchObject({
        worktree: WT_A,
        slug: 'beta',
        title: 'Beta feature',
        status: 'draft',
    });
});
(0, testing_1.test)('AC1 — a worktree with no spec yields a ticket only when it has a session', function () {
    var _a;
    var _b, _c, _d, _e;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([MAIN, WT_A, WT_B]),
        files: (_a = {}, _a[MAIN] = {}, _a[WT_A] = {}, _a[WT_B] = {}, _a),
        sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
    });
    (0, testing_1.expect)(tickets).toHaveLength(1);
    (0, testing_1.expect)((_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.worktree).toBe(WT_A);
    (0, testing_1.expect)((_c = tickets[0]) === null || _c === void 0 ? void 0 : _c.slug).toBeUndefined();
    (0, testing_1.expect)((_e = (_d = tickets[0]) === null || _d === void 0 ? void 0 : _d.session) === null || _e === void 0 ? void 0 : _e.sessionId).toBe('sA');
});
(0, testing_1.test)('AC2 — a ticket gets the session whose cwd is its worktree', function () {
    var _a;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([WT_A, WT_B]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a),
        sessions: JSON.stringify([
            session({ sessionId: 'sA', cwd: WT_A, isRunning: true }),
            session({ sessionId: 'elsewhere', cwd: '/somewhere/else' }),
        ]),
    });
    var a = tickets.find(function (t) { return t.slug === 'a'; });
    var b = tickets.find(function (t) { return t.slug === 'b'; });
    (0, testing_1.expect)(a === null || a === void 0 ? void 0 : a.session).toMatchObject({
        sessionId: 'sA',
        isRunning: true,
        link: 'claude://claude.ai/epitaxy/sA',
    });
    (0, testing_1.expect)(b === null || b === void 0 ? void 0 : b.session).toBeUndefined();
});
(0, testing_1.test)('AC2 — an archived session is ignored, the most recently active one wins', function () {
    var _a;
    var _b, _c, _d, _e;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([WT_A, WT_B, WT_C]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a[WT_C] = { 'c.md': spec({ title: 'C', status: 'ready' }) },
            _a),
        sessions: JSON.stringify([
            session({
                sessionId: 'a-old',
                cwd: WT_A,
                isRunning: true,
                lastActivityAt: '2026-11-18T08:00:00.000Z',
            }),
            session({
                sessionId: 'a-new',
                cwd: WT_A,
                isRunning: false,
                lastActivityAt: '2026-11-18T12:00:00.000Z',
            }),
            session({
                sessionId: 'a-newest-archived',
                cwd: WT_A,
                isArchived: true,
                lastActivityAt: '2026-11-18T13:00:00.000Z',
            }),
            session({ sessionId: 'b-archived', cwd: WT_B, isArchived: true }),
        ]),
    });
    (0, testing_1.expect)((_c = (_b = tickets.find(function (t) { return t.slug === 'a'; })) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.sessionId).toBe('a-new');
    (0, testing_1.expect)((_d = tickets.find(function (t) { return t.slug === 'b'; })) === null || _d === void 0 ? void 0 : _d.session).toBeUndefined();
    (0, testing_1.expect)((_e = tickets.find(function (t) { return t.slug === 'c'; })) === null || _e === void 0 ? void 0 : _e.session).toBeUndefined();
});
(0, testing_1.test)('AC2 — the pilot\'s own session, left out of the list, is matched to its worktree', function () {
    var _a;
    var _b, _c, _d;
    var input = {
        worktrees: porcelain([WT_A, WT_B]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a),
        sessions: JSON.stringify([session({ sessionId: 'sB', cwd: WT_B })]),
    };
    var self = JSON.stringify(session({ sessionId: 'pilot', cwd: WT_A, isRunning: true }));
    var tickets = (0, tickets_1.listTickets)(__assign(__assign({}, input), { self: self }));
    (0, testing_1.expect)((_b = tickets.find(function (t) { return t.slug === 'a'; })) === null || _b === void 0 ? void 0 : _b.session).toMatchObject({
        sessionId: 'pilot',
        isRunning: true,
        link: 'claude://claude.ai/epitaxy/pilot',
    });
    (0, testing_1.expect)((_d = (_c = tickets.find(function (t) { return t.slug === 'b'; })) === null || _c === void 0 ? void 0 : _c.session) === null || _d === void 0 ? void 0 : _d.sessionId).toBe('sB');
});
(0, testing_1.test)('AC2 — among the list and the pilot\'s own session, the most recently active non-archived one wins', function () {
    var _a;
    var _b, _c, _d, _e;
    var input = {
        worktrees: porcelain([WT_A, WT_B]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a),
        sessions: JSON.stringify([
            session({
                sessionId: 'a-listed',
                cwd: WT_A,
                lastActivityAt: '2026-11-18T09:00:00.000Z',
            }),
            session({
                sessionId: 'b-listed',
                cwd: WT_B,
                lastActivityAt: '2026-11-18T09:00:00.000Z',
            }),
        ]),
    };
    var selfIn = function (cwd, extra) {
        if (extra === void 0) { extra = {}; }
        return JSON.stringify(session(__assign({ sessionId: 'pilot', cwd: cwd, lastActivityAt: '2026-11-18T12:00:00.000Z' }, extra)));
    };
    var newer = (0, tickets_1.listTickets)(__assign(__assign({}, input), { self: selfIn(WT_A) }));
    (0, testing_1.expect)((_c = (_b = newer.find(function (t) { return t.slug === 'a'; })) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.sessionId).toBe('pilot');
    var archived = (0, tickets_1.listTickets)(__assign(__assign({}, input), { self: selfIn(WT_B, { isArchived: true }) }));
    (0, testing_1.expect)((_e = (_d = archived.find(function (t) { return t.slug === 'b'; })) === null || _d === void 0 ? void 0 : _d.session) === null || _e === void 0 ? void 0 : _e.sessionId).toBe('b-listed');
});
(0, testing_1.test)('AC2 — a pilot session missing or unreadable leaves the list alone', function () {
    var _a;
    var _b, _c;
    var input = {
        worktrees: porcelain([WT_A]),
        files: (_a = {}, _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) }, _a),
        sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
    };
    for (var _i = 0, _d = [undefined, '', 'Error: no such session', '{"oops":']; _i < _d.length; _i++) {
        var self_1 = _d[_i];
        var tickets = (0, tickets_1.listTickets)(__assign(__assign({}, input), { self: self_1 }));
        (0, testing_1.expect)(tickets).toHaveLength(1);
        (0, testing_1.expect)((_c = (_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.sessionId).toBe('sA');
    }
});
(0, testing_1.test)('open-session AC1 — the session taken from self is marked as the pilot\'s own, a listed one is not', function () {
    var _a;
    var _b, _c, _d, _e;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([WT_A, WT_B]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a),
        sessions: JSON.stringify([session({ sessionId: 'sB', cwd: WT_B })]),
        self: JSON.stringify(session({ sessionId: 'pilot', cwd: WT_A })),
    });
    (0, testing_1.expect)((_c = (_b = tickets.find(function (t) { return t.slug === 'a'; })) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.isPilot).toBe(true);
    (0, testing_1.expect)((_e = (_d = tickets.find(function (t) { return t.slug === 'b'; })) === null || _d === void 0 ? void 0 : _d.session) === null || _e === void 0 ? void 0 : _e.isPilot).not.toBe(true);
});
(0, testing_1.test)('open-session AC1 — with self missing or unreadable, no session is marked', function () {
    var _a;
    var _b, _c;
    var input = {
        worktrees: porcelain([WT_A]),
        files: (_a = {}, _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'ready' }) }, _a),
        sessions: JSON.stringify([session({ sessionId: 'sA', cwd: WT_A })]),
    };
    for (var _i = 0, _d = [undefined, '', 'Error: no such session', '{"oops":']; _i < _d.length; _i++) {
        var self_2 = _d[_i];
        var tickets = (0, tickets_1.listTickets)(__assign(__assign({}, input), { self: self_2 }));
        (0, testing_1.expect)((_c = (_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.isPilot).not.toBe(true);
    }
});
(0, testing_1.test)('hide-done AC1 — a detached worktree with no session yields no ticket, except its shipped specs with a branch', function () {
    var _a;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: detachedPorcelain([
            { path: WT_A, detached: true },
            { path: WT_B },
            { path: WT_C, detached: true },
        ]),
        files: (_a = {},
            _a[WT_A] = {
                'a-draft.md': spec({ title: 'A draft', status: 'draft' }),
                'a-shipped.md': spec({
                    title: 'A shipped',
                    status: 'shipped',
                    branch: 'feat/a',
                }),
                'a-shipped-no-branch.md': spec({
                    title: 'A shipped no branch',
                    status: 'shipped',
                    noBranch: true,
                }),
                'a-reviewed.md': spec({ title: 'A reviewed', status: 'reviewed' }),
            },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'ready' }) },
            _a[WT_C] = { 'c.md': spec({ title: 'C', status: 'draft' }) },
            _a),
        sessions: '[]',
    });
    (0, testing_1.expect)(tickets.map(function (t) { return t.slug; }).sort()).toEqual(['a-shipped', 'b']);
    (0, testing_1.expect)(tickets.find(function (t) { return t.slug === 'a-shipped'; })).toMatchObject({
        worktree: WT_A,
        status: 'shipped',
        branch: 'feat/a',
    });
});
(0, testing_1.test)('hide-done AC1 — a detached worktree with a matched session keeps its tickets', function () {
    var _a;
    var _b, _c;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: detachedPorcelain([
            { path: WT_A, detached: true },
            { path: WT_B, detached: true },
        ]),
        files: (_a = {},
            _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'red' }) },
            _a[WT_B] = { 'b.md': spec({ title: 'B', status: 'red' }) },
            _a),
        sessions: JSON.stringify([
            session({ sessionId: 'sA', cwd: WT_A, isRunning: true }),
        ]),
    });
    (0, testing_1.expect)(tickets).toHaveLength(1);
    (0, testing_1.expect)(tickets[0]).toMatchObject({ worktree: WT_A, slug: 'a' });
    (0, testing_1.expect)((_c = (_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.sessionId).toBe('sA');
});
(0, testing_1.test)('AC3 — a review history gives its rounds, last verdict, fixes and the cap', function () {
    var review = [
        '## Round 1 — KO — 2e88aea',
        '### Blocking',
        '- [code] something',
        '',
        '## Decision — 2026-11-18',
        '- a decision',
        '',
        '## Fix 1 — review round 1',
        'red: 1111111',
        '',
        '## Round 2 — KO — e6f83ac',
        '',
        '## Fix 2 — review round 2',
        '',
        '## Round 3 — OK — fa79378',
    ].join('\n');
    (0, testing_1.expect)((0, tickets_1.parseReview)(review)).toEqual({
        rounds: 3,
        verdict: 'OK',
        fixes: 2,
        cap: 3,
    });
    (0, testing_1.expect)((0, tickets_1.parseReview)('## Round 1 — KO — 2e88aea\n## Fix 1 — x\n')).toMatchObject({ rounds: 1, verdict: 'KO', fixes: 1, cap: 3 });
});
(0, testing_1.test)('AC3 — no review file gives no review', function () {
    (0, testing_1.expect)((0, tickets_1.parseReview)(undefined)).toBeUndefined();
});
var ticket = function (status, run) { return ({
    worktree: WT_A,
    slug: status ? 'a' : undefined,
    title: status ? 'A' : undefined,
    status: status,
    session: run === undefined
        ? undefined
        : { sessionId: 's1', isRunning: run, link: 'claude://x/s1' },
}); };
var asked = { sessionId: 's1', question: 'Which one?', at: 1 };
var review = { rounds: 2, verdict: 'KO', fixes: 1, cap: 3 };
(0, testing_1.test)('AC4 — a pending question on a running session is awaiting answer, before anything else', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('draft', true), { questions: [asked] })).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' });
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('shipped', true), { questions: [asked] })).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' });
});
(0, testing_1.test)('AC4 — a question of a stopped session is ignored', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('draft', false), { questions: [asked] })).toMatchObject({ kind: 'awaiting-plan-validation' });
    var stopped = (0, tickets_1.deriveState)(ticket('red', false), { questions: [asked] });
    (0, testing_1.expect)(stopped.kind).toBe('awaiting-answer');
    (0, testing_1.expect)(stopped.question).toBeUndefined();
});
(0, testing_1.test)('open-session AC2 — a question published by another session of the same worktree is ignored', function () {
    var other = __assign(__assign({}, asked), { sessionId: 'local_other' });
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('ready', true), { questions: [other] })).toEqual((0, tickets_1.deriveState)(ticket('ready', true), {}));
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('draft', true), { questions: [other] })).toEqual((0, tickets_1.deriveState)(ticket('draft', true), {}));
});
(0, testing_1.test)('open-session AC3 — a question published by the ticket\'s own session is awaiting answer with it', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('ready', true), { questions: [asked] })).toMatchObject({ kind: 'awaiting-answer', question: 'Which one?' });
});
(0, testing_1.test)('open-session AC3 — a question with no session id is ignored', function () {
    var anonymous = { question: 'Which one?', at: 1 };
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('ready', true), { questions: [anonymous] })).toEqual((0, tickets_1.deriveState)(ticket('ready', true), {}));
});
(0, testing_1.test)('AC4 — no session, whatever the status', function () {
    for (var _i = 0, _a = ['draft', 'ready', undefined]; _i < _a.length; _i++) {
        var status_1 = _a[_i];
        (0, testing_1.expect)((0, tickets_1.deriveState)(ticket(status_1), {}).kind).toBe('no-session');
    }
});
(0, testing_1.test)('hide-done AC2 — a shipped ticket with no session is shipped, not no session', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('shipped'), {}).kind).toBe('shipped');
});
(0, testing_1.test)('AC4 — shipped', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('shipped', false), {}).kind).toBe('shipped');
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('shipped', true), {}).kind).toBe('shipped');
});
(0, testing_1.test)('AC4 — a draft waits for plan validation when stopped, is planning when running', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('draft', false), {}).kind).toBe('awaiting-plan-validation');
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('draft', true), {}).kind).toBe('planning');
});
(0, testing_1.test)('AC4 — a build or ship that stopped is awaiting answer without a question', function () {
    for (var _i = 0, _a = ['ready', 'red', 'green', 'reviewed']; _i < _a.length; _i++) {
        var status_2 = _a[_i];
        var state = (0, tickets_1.deriveState)(ticket(status_2, false), { review: review });
        (0, testing_1.expect)(state.kind).toBe('awaiting-answer');
        (0, testing_1.expect)(state.question).toBeUndefined();
    }
});
(0, testing_1.test)('AC4 — green with a review is in review, with its rounds, verdict, fixes and cap', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('green', true), { review: review })).toMatchObject({
        kind: 'review',
        rounds: 2,
        verdict: 'KO',
        fixes: 1,
        cap: 3,
    });
});
(0, testing_1.test)('AC4 — ready, red, or green without a review is in dev, with its status', function () {
    for (var _i = 0, _a = ['ready', 'red', 'green']; _i < _a.length; _i++) {
        var status_3 = _a[_i];
        (0, testing_1.expect)((0, tickets_1.deriveState)(ticket(status_3, true), {})).toMatchObject({
            kind: 'in-dev',
            status: status_3,
        });
    }
});
(0, testing_1.test)('AC4 — reviewed and running is shipping', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket('reviewed', true), { review: review }).kind).toBe('shipping');
});
(0, testing_1.test)('AC4 — a ticket with a session and no spec is no spec', function () {
    (0, testing_1.expect)((0, tickets_1.deriveState)(ticket(undefined, true), {}).kind).toBe('no-spec');
});
var rollup = function (checks, extra) {
    if (extra === void 0) { extra = {}; }
    return ({
        exitCode: 0,
        stdout: JSON.stringify(__assign({ state: 'OPEN', url: 'https://github.com/o/r/pull/7', statusCheckRollup: checks }, extra)),
    });
};
var run = function (conclusion) { return ({
    __typename: 'CheckRun',
    status: 'COMPLETED',
    conclusion: conclusion,
}); };
var running = { __typename: 'CheckRun', status: 'IN_PROGRESS', conclusion: '' };
(0, testing_1.test)('AC6 — the PR state and url', function () {
    for (var _i = 0, _a = ['OPEN', 'MERGED', 'CLOSED']; _i < _a.length; _i++) {
        var state = _a[_i];
        (0, testing_1.expect)((0, tickets_1.parsePr)(rollup([], { state: state }))).toMatchObject({
            state: state,
            url: 'https://github.com/o/r/pull/7',
        });
    }
});
(0, testing_1.test)('AC6 — the CI summary: failing, then pending, then passing, none without a check', function () {
    var ci = function (checks) { var _a; return (_a = (0, tickets_1.parsePr)(rollup(checks))) === null || _a === void 0 ? void 0 : _a.ci; };
    (0, testing_1.expect)(ci([run('SUCCESS'), run('FAILURE')])).toBe('failing');
    (0, testing_1.expect)(ci([run('CANCELLED')])).toBe('failing');
    (0, testing_1.expect)(ci([run('TIMED_OUT')])).toBe('failing');
    (0, testing_1.expect)(ci([run('FAILURE'), running])).toBe('failing');
    (0, testing_1.expect)(ci([run('SUCCESS'), running])).toBe('pending');
    (0, testing_1.expect)(ci([run('SUCCESS'), run('SKIPPED')])).toBe('passing');
    (0, testing_1.expect)(ci([])).toBe('none');
});
(0, testing_1.test)('AC6 — gh failing leaves the PR unknown', function () {
    (0, testing_1.expect)((0, tickets_1.parsePr)({ exitCode: 1, stdout: '' })).toBeUndefined();
});
// ---- pilot-v2-ui ----
(0, testing_1.test)('pilot-v2-ui AC1 — the ticket id is taken out of the title, whatever its shape', function () {
    var cases = [
        ['Dashboard (SPOTIME-192)', 'Dashboard'],
        ['Export CSV — SPOTIME-279', 'Export CSV'],
        ['Export CSV - SPOTIME-279', 'Export CSV'],
        ['Export CSV · SPOTIME-279', 'Export CSV'],
        ['SPOTIME-301: Export CSV', 'Export CSV'],
        ['SPOTIME-301 - Export CSV', 'Export CSV'],
        ['[SPOTIME-188] Login magic link', 'Login magic link'],
    ];
    var ids = ['SPOTIME-192', 'SPOTIME-279', 'SPOTIME-279', 'SPOTIME-279', 'SPOTIME-301', 'SPOTIME-301', 'SPOTIME-188'];
    for (var _i = 0, _a = cases.entries(); _i < _a.length; _i++) {
        var _b = _a[_i], i = _b[0], _c = _b[1], title = _c[0], name_1 = _c[1];
        var found = (0, tickets_1.ticketId)(title, 'slug');
        (0, testing_1.expect)(found.id).toBe(ids[i]);
        (0, testing_1.expect)(found.name).toBe(name_1);
    }
});
(0, testing_1.test)('pilot-v2-ui AC1 — a title with no id keeps its name, no title falls back to the slug', function () {
    var plain = (0, tickets_1.ticketId)('Alpha feature', 'alpha');
    (0, testing_1.expect)(plain.id).toBeUndefined();
    (0, testing_1.expect)(plain.name).toBe('Alpha feature');
    var none = (0, tickets_1.ticketId)(undefined, 'alpha');
    (0, testing_1.expect)(none.id).toBeUndefined();
    (0, testing_1.expect)(none.name).toBe('alpha');
});
var rowOf = function (slug, kind, since) { return ({
    slug: slug,
    state: { kind: kind },
    since: since,
}); };
(0, testing_1.test)('pilot-v2-ui AC2 — states are grouped in toi, running and pr, in that order, with their counts', function () {
    var rows = [
        rowOf('pr1', 'shipped'),
        rowOf('run1', 'planning'),
        rowOf('toi1', 'awaiting-answer', 100),
        rowOf('run2', 'in-dev'),
        rowOf('toi2', 'awaiting-plan-validation', 200),
        rowOf('run3', 'review'),
        rowOf('toi3', 'no-session'),
        rowOf('run4', 'shipping'),
        rowOf('run5', 'no-spec'),
    ];
    var grouped = (0, tickets_1.sections)(rows);
    (0, testing_1.expect)(grouped.map(function (s) { return s.id; })).toEqual(['toi', 'running', 'pr']);
    (0, testing_1.expect)(grouped.map(function (s) { return s.count; })).toEqual([3, 5, 1]);
    (0, testing_1.expect)(grouped[0].rows.map(function (r) { return r.slug; }).sort()).toEqual(['toi1', 'toi2', 'toi3']);
    (0, testing_1.expect)(grouped[1].rows.map(function (r) { return r.slug; }).sort()).toEqual(['run1', 'run2', 'run3', 'run4', 'run5']);
    (0, testing_1.expect)(grouped[2].rows.map(function (r) { return r.slug; })).toEqual(['pr1']);
});
(0, testing_1.test)('pilot-v2-ui AC2 — in toi the row waiting longest comes first, a row with no wait time last', function () {
    var grouped = (0, tickets_1.sections)([
        rowOf('none', 'no-session'),
        rowOf('recent', 'awaiting-answer', 3000),
        rowOf('oldest', 'awaiting-plan-validation', 1000),
        rowOf('middle', 'awaiting-answer', 2000),
    ]);
    (0, testing_1.expect)(grouped[0].id).toBe('toi');
    (0, testing_1.expect)(grouped[0].rows.map(function (r) { return r.slug; })).toEqual(['oldest', 'middle', 'recent', 'none']);
});
(0, testing_1.test)('pilot-v2-ui AC3 — the step of a status out of 5', function () {
    (0, testing_1.expect)((0, tickets_1.stepOf)('draft')).toBe(1);
    (0, testing_1.expect)((0, tickets_1.stepOf)(undefined)).toBe(1);
    (0, testing_1.expect)((0, tickets_1.stepOf)('ready')).toBe(2);
    (0, testing_1.expect)((0, tickets_1.stepOf)('red')).toBe(3);
    (0, testing_1.expect)((0, tickets_1.stepOf)('green')).toBe(4);
    (0, testing_1.expect)((0, tickets_1.stepOf)('reviewed')).toBe(5);
    (0, testing_1.expect)((0, tickets_1.stepOf)('shipped')).toBe(5);
});
var STOPPED_AT = '2026-11-18T10:00:00.000Z';
var stoppedSession = {
    sessionId: 's1',
    isRunning: false,
    link: 'claude://x/s1',
    lastActivityAt: STOPPED_AT,
};
(0, testing_1.test)('pilot-v2-ui AC4 — the wait of a pending question starts at its `at`', function () {
    (0, testing_1.expect)((0, tickets_1.waitingSince)({
        state: { kind: 'awaiting-answer', question: 'Which one?', at: 5000 },
        session: __assign(__assign({}, stoppedSession), { isRunning: true }),
    })).toBe(5000);
    // deriveState carries the question's `at` on the state it builds.
    var state = (0, tickets_1.deriveState)(ticket('red', true), {
        questions: [__assign(__assign({}, asked), { at: 7000 })],
    });
    (0, testing_1.expect)((0, tickets_1.waitingSince)({ state: state, session: __assign(__assign({}, stoppedSession), { isRunning: true }) })).toBe(7000);
});
(0, testing_1.test)('pilot-v2-ui AC4 — without a question the wait starts at the stopped session last activity', function () {
    var since = Date.parse(STOPPED_AT);
    (0, testing_1.expect)((0, tickets_1.waitingSince)({ state: { kind: 'awaiting-plan-validation' }, session: stoppedSession })).toBe(since);
    (0, testing_1.expect)((0, tickets_1.waitingSince)({ state: { kind: 'awaiting-answer' }, session: stoppedSession })).toBe(since);
});
(0, testing_1.test)('pilot-v2-ui AC4 — a row with no session, or outside toi, has no wait start', function () {
    (0, testing_1.expect)((0, tickets_1.waitingSince)({ state: { kind: 'no-session' } })).toBeUndefined();
    for (var _i = 0, _a = ['planning', 'in-dev', 'review', 'shipping', 'no-spec', 'shipped']; _i < _a.length; _i++) {
        var kind = _a[_i];
        (0, testing_1.expect)((0, tickets_1.waitingSince)({ state: { kind: kind }, session: stoppedSession })).toBeUndefined();
    }
});
(0, testing_1.test)('pilot-v2-ui AC4 — the elapsed time is floored to minutes, hours, then days', function () {
    var MIN = 60000;
    var H = 60 * MIN;
    var D = 24 * H;
    var at = function (ms) { return (0, tickets_1.elapsed)(1000000, 1000000 + ms); };
    (0, testing_1.expect)(at(0)).toEqual({ n: 0, unit: 'min' });
    (0, testing_1.expect)(at(59999)).toEqual({ n: 0, unit: 'min' });
    (0, testing_1.expect)(at(MIN)).toEqual({ n: 1, unit: 'min' });
    (0, testing_1.expect)(at(12 * MIN + 30000)).toEqual({ n: 12, unit: 'min' });
    (0, testing_1.expect)(at(H - 1)).toEqual({ n: 59, unit: 'min' });
    (0, testing_1.expect)(at(H)).toEqual({ n: 1, unit: 'h' });
    (0, testing_1.expect)(at(5 * H + 59 * MIN)).toEqual({ n: 5, unit: 'h' });
    (0, testing_1.expect)(at(D - 1)).toEqual({ n: 23, unit: 'h' });
    (0, testing_1.expect)(at(D)).toEqual({ n: 1, unit: 'd' });
    (0, testing_1.expect)(at(3 * D + 20 * H)).toEqual({ n: 3, unit: 'd' });
});
(0, testing_1.test)('pilot-v2-ui AC5 — the review line gives rounds, cap and what runs now', function () {
    // KO with fewer fixes than KO rounds: the fix runs.
    (0, testing_1.expect)((0, tickets_1.reviewLine)({ rounds: 1, verdict: 'KO', fixes: 0, cap: 3 })).toEqual({
        rounds: 1,
        cap: 3,
        running: 'fix',
    });
    (0, testing_1.expect)((0, tickets_1.reviewLine)({ rounds: 2, verdict: 'KO', fixes: 1, cap: 3 })).toEqual({
        rounds: 2,
        cap: 3,
        running: 'fix',
    });
    // KO with as many fixes as KO rounds: the next round runs.
    (0, testing_1.expect)((0, tickets_1.reviewLine)({ rounds: 2, verdict: 'KO', fixes: 2, cap: 3 })).toEqual({
        rounds: 2,
        cap: 3,
        running: 'round',
    });
    // OK: nothing runs.
    var ok = (0, tickets_1.reviewLine)({ rounds: 3, verdict: 'OK', fixes: 2, cap: 3 });
    (0, testing_1.expect)(ok).toMatchObject({ rounds: 3, cap: 3 });
    (0, testing_1.expect)(ok.running).toBeUndefined();
});
(0, testing_1.test)('pilot-v2-ui AC6 — the main checkout with a session and no spec yields no row, another worktree still does', function () {
    var _a;
    var _b, _c, _d, _e;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([MAIN, WT_A]),
        files: (_a = {}, _a[MAIN] = {}, _a[WT_A] = {}, _a),
        sessions: JSON.stringify([
            session({ sessionId: 'sMain', cwd: MAIN }),
            session({ sessionId: 'sA', cwd: WT_A }),
        ]),
    });
    (0, testing_1.expect)(tickets).toHaveLength(1);
    (0, testing_1.expect)((_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.worktree).toBe(WT_A);
    (0, testing_1.expect)((_c = tickets[0]) === null || _c === void 0 ? void 0 : _c.slug).toBeUndefined();
    (0, testing_1.expect)((_e = (_d = tickets[0]) === null || _d === void 0 ? void 0 : _d.session) === null || _e === void 0 ? void 0 : _e.sessionId).toBe('sA');
});
(0, testing_1.test)('pilot-v2-ui AC4 — a ticket\'s session keeps its last activity', function () {
    var _a;
    var _b, _c;
    var tickets = (0, tickets_1.listTickets)({
        worktrees: porcelain([MAIN, WT_A]),
        files: (_a = {}, _a[MAIN] = {}, _a[WT_A] = { 'a.md': spec({ title: 'A', status: 'draft' }) }, _a),
        sessions: JSON.stringify([
            session({ sessionId: 'sA', cwd: WT_A, lastActivityAt: STOPPED_AT }),
        ]),
    });
    (0, testing_1.expect)((_c = (_b = tickets[0]) === null || _b === void 0 ? void 0 : _b.session) === null || _c === void 0 ? void 0 : _c.lastActivityAt).toBe(STOPPED_AT);
});
var SPEC_TEXT = [
    '---',
    'status: draft',
    '---',
    '',
    '# Title of the feature',
    '',
    '## User story',
    'As a user, I want STORY-BODY.',
    '',
    '## Acceptance criteria',
    '- [ ] AC1 — CRITERIA-BODY',
    '',
    '### A sub heading',
    'SUB-BODY',
    '',
    '## Out of scope',
    '- OUT-BODY',
    '',
    '## Technical plan',
    'PLAN-BODY',
].join('\n');
(0, testing_1.test)('pilot-v2-ui AC7 — the plan summary is the user story then the acceptance criteria, headings included, nothing else', function () {
    var summary = (0, tickets_1.planSummary)(SPEC_TEXT);
    (0, testing_1.expect)(summary.startsWith('## User story')).toBe(true);
    (0, testing_1.expect)(summary).toContain('STORY-BODY');
    (0, testing_1.expect)(summary).toContain('## Acceptance criteria');
    (0, testing_1.expect)(summary).toContain('CRITERIA-BODY');
    (0, testing_1.expect)(summary).toContain('SUB-BODY');
    (0, testing_1.expect)(summary.indexOf('## Acceptance criteria')).toBeGreaterThan(summary.indexOf('STORY-BODY'));
    for (var _i = 0, _a = ['status: draft', 'Title of the feature', '## Out of scope', 'OUT-BODY', 'PLAN-BODY']; _i < _a.length; _i++) {
        var other = _a[_i];
        (0, testing_1.expect)(summary).not.toContain(other);
    }
});
(0, testing_1.test)('pilot-v2-ui AC7 — the two sections come in that order whatever their order in the spec', function () {
    var reversed = [
        '# T',
        '## Acceptance criteria',
        '- CRITERIA-BODY',
        '## User story',
        'STORY-BODY',
        '## Technical plan',
        'PLAN-BODY',
    ].join('\n');
    var summary = (0, tickets_1.planSummary)(reversed);
    (0, testing_1.expect)(summary.indexOf('## User story')).toBeLessThan(summary.indexOf('## Acceptance criteria'));
    (0, testing_1.expect)(summary).toContain('STORY-BODY');
    (0, testing_1.expect)(summary).toContain('CRITERIA-BODY');
    (0, testing_1.expect)(summary).not.toContain('PLAN-BODY');
});
(0, testing_1.test)('pilot-v2-ui AC7 — a spec missing one section gives the other, missing both gives none', function () {
    var onlyStory = (0, tickets_1.planSummary)('# T\n\n## User story\nSTORY-BODY\n\n## Technical plan\nPLAN-BODY\n');
    (0, testing_1.expect)(onlyStory).toContain('## User story');
    (0, testing_1.expect)(onlyStory).toContain('STORY-BODY');
    (0, testing_1.expect)(onlyStory).not.toContain('PLAN-BODY');
    var onlyCriteria = (0, tickets_1.planSummary)('# T\n\n## Acceptance criteria\n- CRITERIA-BODY\n\n## Technical plan\nPLAN-BODY\n');
    (0, testing_1.expect)(onlyCriteria).toContain('## Acceptance criteria');
    (0, testing_1.expect)(onlyCriteria).toContain('CRITERIA-BODY');
    (0, testing_1.expect)(onlyCriteria).not.toContain('PLAN-BODY');
    (0, testing_1.expect)((0, tickets_1.planSummary)('# T\n\n## Technical plan\nPLAN-BODY\n')).toBeUndefined();
});
// ---- pilot-gitlab ----
(0, testing_1.test)('pilot-gitlab AC1 — the https, scp-like and ssh origins of gitlab.com give gitlab', function () {
    (0, testing_1.expect)((0, tickets_1.forgeOf)('https://gitlab.com/o/r.git')).toBe('gitlab');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('git@gitlab.com:o/r.git')).toBe('gitlab');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('ssh://git@gitlab.com/o/r.git')).toBe('gitlab');
});
(0, testing_1.test)('pilot-gitlab AC1 — github.com, any other host, an unreadable URL or no origin give github', function () {
    (0, testing_1.expect)((0, tickets_1.forgeOf)('https://github.com/o/r.git')).toBe('github');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('git@github.com:o/r.git')).toBe('github');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('https://gitlab.example.com/o/r.git')).toBe('github');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('not a url')).toBe('github');
    (0, testing_1.expect)((0, tickets_1.forgeOf)('')).toBe('github');
    (0, testing_1.expect)((0, tickets_1.forgeOf)(undefined)).toBe('github');
});
var mr = function (extra, pipeline) {
    if (extra === void 0) { extra = {}; }
    return ({
        exitCode: 0,
        stdout: JSON.stringify(__assign(__assign({ iid: 42, state: 'opened', web_url: 'https://gitlab.com/o/r/-/merge_requests/42' }, (pipeline === null ? {} : { head_pipeline: { status: pipeline !== null && pipeline !== void 0 ? pipeline : 'success' } })), extra)),
    });
};
(0, testing_1.test)('pilot-gitlab AC2 — the MR state, number and url, marked as a merge request', function () {
    var cases = [
        ['opened', 'OPEN'],
        ['locked', 'OPEN'],
        ['merged', 'MERGED'],
        ['closed', 'CLOSED'],
    ];
    for (var _i = 0, cases_1 = cases; _i < cases_1.length; _i++) {
        var _a = cases_1[_i], state = _a[0], expected = _a[1];
        (0, testing_1.expect)((0, tickets_1.parseMr)(mr({ state: state }))).toMatchObject({
            state: expected,
            number: 42,
            url: 'https://gitlab.com/o/r/-/merge_requests/42',
            kind: 'mr',
        });
    }
});
(0, testing_1.test)('pilot-gitlab AC2 — the pipeline status gives the CI summary', function () {
    var ci = function (status) { var _a; return (_a = (0, tickets_1.parseMr)(mr({}, status))) === null || _a === void 0 ? void 0 : _a.ci; };
    (0, testing_1.expect)(ci('success')).toBe('passing');
    for (var _i = 0, _a = ['failed', 'canceled']; _i < _a.length; _i++) {
        var status_4 = _a[_i];
        (0, testing_1.expect)(ci(status_4)).toBe('failing');
    }
    for (var _b = 0, _c = [
        'running',
        'pending',
        'created',
        'preparing',
        'waiting_for_resource',
        'scheduled',
    ]; _b < _c.length; _b++) {
        var status_5 = _c[_b];
        (0, testing_1.expect)(ci(status_5)).toBe('pending');
    }
    (0, testing_1.expect)(ci('skipped')).toBe('none');
    (0, testing_1.expect)(ci('manual')).toBe('none');
    (0, testing_1.expect)(ci(null)).toBe('none');
});
(0, testing_1.test)('pilot-gitlab AC2 — a non-zero exit, unparsable output or an unknown state gives no MR', function () {
    (0, testing_1.expect)((0, tickets_1.parseMr)({ exitCode: 1, stdout: '' })).toBeUndefined();
    (0, testing_1.expect)((0, tickets_1.parseMr)({ exitCode: 1, stdout: mr().stdout })).toBeUndefined();
    (0, testing_1.expect)((0, tickets_1.parseMr)({ exitCode: 0, stdout: 'not json' })).toBeUndefined();
    (0, testing_1.expect)((0, tickets_1.parseMr)(mr({ state: 'draft' }))).toBeUndefined();
});
// pilot-v3-ui AC1
var counted = function (kind) { return ({ section: (0, tickets_1.sectionOf)(kind), state: { kind: kind } }); };
(0, testing_1.test)('pilot-v3-ui AC1 — counters: toi, review, dev (the other running rows) and pr', function () {
    var rows = [
        'awaiting-answer',
        'awaiting-answer',
        'awaiting-plan-validation',
        'no-session',
        'planning',
        'in-dev',
        'in-dev',
        'shipping',
        'no-spec',
        'review',
        'review',
        'shipped',
    ].map(counted);
    (0, testing_1.expect)((0, tickets_1.counters)(rows)).toEqual({ toi: 4, review: 2, dev: 5, pr: 1 });
    (0, testing_1.expect)((0, tickets_1.counters)([])).toEqual({ toi: 0, review: 0, dev: 0, pr: 0 });
});
// pilot-v3-ui AC2
(0, testing_1.test)('pilot-v3-ui AC2 — planFacts counts the AC lines, ticked or not, and the files under ### Files only', function () {
    var spec = [
        '---',
        'status: ready',
        '---',
        '',
        '# Feature',
        '',
        '## Out of scope',
        '- not a file',
        '',
        '## Acceptance criteria',
        '- [ ] AC1 — one',
        '- [x] AC2 — two',
        '  - [ ] AC9 — indented, not a criterion line',
        '- [ ] a checkbox that is no criterion',
        '- AC3 — no checkbox',
        '- [ ] AC3 — three',
        '',
        '## Technical plan',
        '',
        '### Files',
        '- modified: `a.ts` — one',
        '- new: `b.ts` — two',
        '- modified: `c.ts` — three',
        '  continued on an indented line',
        '',
        '### Tasks (ordered)',
        '- not a file either',
    ].join('\n');
    (0, testing_1.expect)((0, tickets_1.planFacts)(spec)).toEqual({ criteria: 3, files: 3 });
});
(0, testing_1.test)('pilot-v3-ui AC2 — planFacts gives 0 for a spec with neither', function () {
    (0, testing_1.expect)((0, tickets_1.planFacts)('# Feature\n\nJust a title.\n')).toEqual({ criteria: 0, files: 0 });
});
// pilot-v3-ui AC3
var NAMES = ['plan', 'red', 'green', 'review', 'ship'];
var _loop_1 = function (step, states) {
    (0, testing_1.test)("pilot-v3-ui AC3 \u2014 segments at step ".concat(step, ": before done, its own current, after todo"), function () {
        (0, testing_1.expect)((0, tickets_1.segments)(step)).toEqual(NAMES.map(function (name, i) { return ({ name: name, state: states[i] }); }));
    });
};
for (var _i = 0, _a = [
    [1, ['current', 'todo', 'todo', 'todo', 'todo']],
    [3, ['done', 'done', 'current', 'todo', 'todo']],
    [5, ['done', 'done', 'done', 'done', 'current']],
]; _i < _a.length; _i++) {
    var _b = _a[_i], step = _b[0], states = _b[1];
    _loop_1(step, states);
}
