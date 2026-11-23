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
Object.defineProperty(exports, "__esModule", { value: true });
// The pure functions of plugin/hooks/next.ts (pilot-next). The contract these
// tests fix beyond the spec:
//
//   planeConfig(json text) -> { project: string } | undefined
//   candidates(items, relations, stateGroups, identifier) -> Candidate[]
//     items:       Plane work items as `workitem list` answers them
//                  ({ id, name, sequence_id, priority, state: { group },
//                  is_draft, updated_at, description_stripped, type_id })
//     relations:   work item id -> { blocking: Rel[], blocked_by: Rel[] } (the
//                  content of `workitem_relation list`'s `dependencies`;
//                  Rel = { id, sequence_id, project_id, state_id })
//     stateGroups: state id -> state group
//     identifier:  the project identifier (`SPOTIME`): ids are `<identifier>-<sequence_id>`
//     Candidate:   { id, name, workitemId, updatedAt, priority, sequenceId,
//                    description, unblocks: string[] }
//                  (unblocks: ids of the open items it blocks)
//   rankNext(candidates, excluded: Set<string>, limit = 5) -> Candidate[]
//     excluded: upper-case ids
//   excludedIds(tickets, worktreePaths, sessionsJson, launched: Set<string>) -> Set<string>
//     tickets: [{ title? }] (what listTickets gives); sessionsJson: the JSON
//     text `list_sessions` answers ([{ title, isArchived }]); upper-case ids out
//   startArgs(row, description) -> the input of `start_session`, `tool` aside
//
// Not covered, and why: "not an epic" in AC2 (see the report).
var testing_1 = require("claude-code/testing");
var next_1 = require("../hooks/next");
var GROUPS = {
    's-backlog': 'backlog',
    's-unstarted': 'unstarted',
    's-started': 'started',
    's-done': 'completed',
    's-cancel': 'cancelled',
};
var item = function (seq, over) {
    if (over === void 0) { over = {}; }
    return (__assign({ id: "w".concat(seq), name: "Item ".concat(seq), sequence_id: seq, priority: 'none', state: { group: 'unstarted' }, is_draft: false, updated_at: '2026-11-20T10:00:00Z', description_stripped: "Description ".concat(seq), type_id: null }, over));
};
var rel = function (seq, state_id) { return ({
    id: "w".concat(seq),
    sequence_id: seq,
    project_id: 'p1',
    state_id: state_id,
}); };
var free = { blocking: [], blocked_by: [] };
(0, testing_1.test)('AC1 — planeConfig gives the project of a config, nothing when it holds none', function () {
    (0, testing_1.expect)((0, next_1.planeConfig)('{ "plane": { "project": "SPOTIME" } }')).toEqual({
        project: 'SPOTIME',
    });
    (0, testing_1.expect)((0, next_1.planeConfig)('{}')).toBeUndefined();
    (0, testing_1.expect)((0, next_1.planeConfig)('{ "plane": {} }')).toBeUndefined();
    (0, testing_1.expect)((0, next_1.planeConfig)('{ "plane": { "project": "" } }')).toBeUndefined();
    (0, testing_1.expect)((0, next_1.planeConfig)('not json')).toBeUndefined();
});
(0, testing_1.test)('AC2 — a candidate is a backlog or unstarted item, not a draft, with every blocker completed or cancelled', function () {
    var items = [
        item(1, { state: { group: 'backlog' } }),
        item(2),
        item(3, { state: { group: 'started' } }),
        item(4, { state: { group: 'completed' } }),
        item(5, { state: { group: 'cancelled' } }),
        item(6, { is_draft: true }),
        item(7), // blocked by an open item
        item(8), // blocked by a completed item
        item(9), // blocked by a cancelled item
        item(10), // one blocker done, one still open
        item(11), // blocked by a backlog item
    ];
    var relations = {
        w7: { blocking: [], blocked_by: [rel(2, 's-started')] },
        w8: { blocking: [], blocked_by: [rel(4, 's-done')] },
        w9: { blocking: [], blocked_by: [rel(5, 's-cancel')] },
        w10: { blocking: [], blocked_by: [rel(4, 's-done'), rel(3, 's-started')] },
        w11: { blocking: [], blocked_by: [rel(1, 's-backlog')] },
    };
    var found = (0, next_1.candidates)(items, Object.fromEntries(items.map(function (i) { var _a; return [i.id, (_a = relations[i.id]) !== null && _a !== void 0 ? _a : free]; })), GROUPS, 'SPOTIME');
    (0, testing_1.expect)(found.map(function (c) { return c.id; }).sort()).toEqual([
        'SPOTIME-1',
        'SPOTIME-2',
        'SPOTIME-8',
        'SPOTIME-9',
    ]);
});
(0, testing_1.test)('AC3 — a candidate lists the ids of the open items it blocks, not the done ones', function () {
    var _a;
    var items = [item(1), item(2), item(3), item(4)];
    var relations = {
        w1: {
            blocking: [rel(2, 's-unstarted'), rel(3, 's-done'), rel(4, 's-cancel')],
            blocked_by: [],
        },
        w2: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
        w3: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
        w4: { blocking: [], blocked_by: [rel(1, 's-unstarted')] },
    };
    var found = (0, next_1.candidates)(items, relations, GROUPS, 'SPOTIME');
    (0, testing_1.expect)((_a = found.find(function (c) { return c.id === 'SPOTIME-1'; })) === null || _a === void 0 ? void 0 : _a.unblocks).toEqual(['SPOTIME-2']);
});
var cand = function (seq, priority, unblocks) {
    if (unblocks === void 0) { unblocks = []; }
    return ({
        id: "SPOTIME-".concat(seq),
        name: "Item ".concat(seq),
        workitemId: "w".concat(seq),
        updatedAt: '2026-11-20T10:00:00Z',
        priority: priority,
        sequenceId: seq,
        description: "Description ".concat(seq),
        unblocks: unblocks.map(function (n) { return "SPOTIME-".concat(n); }),
    });
};
(0, testing_1.test)('AC3 — 5 rows by priority, then by open items blocked descending, then by sequence ascending', function () {
    var _a;
    var pool = [
        cand(21, 'none', [1, 2, 3, 4, 5]),
        cand(12, 'high', [1, 2, 3]),
        cand(30, 'medium', [1, 2, 3, 4]),
        cand(11, 'high', [1, 2]),
        cand(20, 'medium'),
        cand(10, 'urgent'),
        cand(22, 'low', [1]),
        cand(5, 'high', [1, 2, 3]),
    ];
    var rows = (0, next_1.rankNext)(pool, new Set());
    (0, testing_1.expect)(rows.map(function (r) { return r.id; })).toEqual([
        'SPOTIME-10',
        'SPOTIME-5',
        'SPOTIME-12',
        'SPOTIME-11',
        'SPOTIME-30',
    ]);
    (0, testing_1.expect)(rows[1]).toMatchObject({
        id: 'SPOTIME-5',
        name: 'Item 5',
        unblocks: ['SPOTIME-1', 'SPOTIME-2', 'SPOTIME-3'],
    });
    (0, testing_1.expect)((_a = rows[0]) === null || _a === void 0 ? void 0 : _a.unblocks).toEqual([]);
});
(0, testing_1.test)('AC4 — an id in a spec title, a worktree path, a non-archived session title or the launched set leaves the candidate out and the next one comes up', function () {
    var pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return cand(n, 'none'); });
    var excluded = (0, next_1.excludedIds)([{ title: 'Fix the login (SPOTIME-1)' }, { title: undefined }], ['/work/main', '/work/spotime-2-billing'], JSON.stringify([
        { sessionId: 's1', title: 'SPOTIME-3 — Export', isArchived: false },
        { sessionId: 's2', title: 'SPOTIME-4 — Archived', isArchived: true },
    ]), new Set(['SPOTIME-5']));
    var rows = (0, next_1.rankNext)(pool, excluded);
    (0, testing_1.expect)(rows.map(function (r) { return r.id; })).toEqual([
        'SPOTIME-4',
        'SPOTIME-6',
        'SPOTIME-7',
        'SPOTIME-8',
        'SPOTIME-9',
    ]);
});
(0, testing_1.test)('AC4 — the id is matched whatever its case', function () {
    var excluded = (0, next_1.excludedIds)([{ title: 'spotime-1 — lower' }], [], '[]', new Set());
    (0, testing_1.expect)((0, next_1.rankNext)([cand(1, 'none'), cand(2, 'none')], excluded).map(function (r) { return r.id; })).toEqual([
        'SPOTIME-2',
    ]);
});
(0, testing_1.test)('AC6 — the start arguments: a fresh worktree session on the lowercased id, running /rs-plan with the description', function () {
    var row = {
        id: 'SPOTIME-42',
        name: 'Export the planning',
        unblocks: [],
        workitemId: 'w42',
        updatedAt: '2026-11-20T10:00:00Z',
    };
    var args = (0, next_1.startArgs)(row, 'Plain text of the ticket.');
    (0, testing_1.expect)(args).toMatchObject({
        initiation: 'user_asked',
        context: 'fresh',
        use_worktree: true,
        branch_name: 'spotime-42',
        title: 'SPOTIME-42 — Export the planning',
    });
    (0, testing_1.expect)(args.prompt.startsWith('/rs-plan SPOTIME-42 — Export the planning')).toBe(true);
    (0, testing_1.expect)(args.prompt).toContain('Plain text of the ticket.');
    (0, testing_1.expect)(args.background.length).toBeGreaterThanOrEqual(80);
});
