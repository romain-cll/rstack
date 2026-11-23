"use strict";
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
exports.summaryPrompt = exports.summaryKey = void 0;
exports.planeConfig = planeConfig;
exports.candidates = candidates;
exports.rankNext = rankNext;
exports.excludedIds = excludedIds;
exports.startArgs = startArgs;
var LIMIT = 5;
var PRIORITIES = ['urgent', 'high', 'medium', 'low', 'none'];
var DONE = ['completed', 'cancelled'];
var STARTABLE = ['backlog', 'unstarted'];
var TICKET_ID = /[A-Za-z][A-Za-z0-9]*-\d+/g;
function planeConfig(json) {
    var _a, _b;
    try {
        var project = (_b = (_a = JSON.parse(json)) === null || _a === void 0 ? void 0 : _a.plane) === null || _b === void 0 ? void 0 : _b.project;
        return typeof project === 'string' && project !== '' ? { project: project } : undefined;
    }
    catch (_c) {
        return undefined;
    }
}
var isOpen = function (rel, groups) { var _a; return !DONE.includes((_a = groups[rel.state_id]) !== null && _a !== void 0 ? _a : ''); };
function candidates(items, relations, stateGroups, identifier) {
    var _a, _b, _c, _d, _e;
    var found = [];
    for (var _i = 0, items_1 = items; _i < items_1.length; _i++) {
        var item = items_1[_i];
        var group = (_b = (_a = item.state) === null || _a === void 0 ? void 0 : _a.group) !== null && _b !== void 0 ? _b : '';
        if (!STARTABLE.includes(group) || item.is_draft === true)
            continue;
        var _f = (_c = relations[item.id]) !== null && _c !== void 0 ? _c : {}, _g = _f.blocking, blocking = _g === void 0 ? [] : _g, _h = _f.blocked_by, blocked_by = _h === void 0 ? [] : _h;
        if (blocked_by.some(function (rel) { return isOpen(rel, stateGroups); }))
            continue;
        found.push({
            id: "".concat(identifier, "-").concat(item.sequence_id),
            name: item.name,
            workitemId: item.id,
            updatedAt: item.updated_at,
            priority: (_d = item.priority) !== null && _d !== void 0 ? _d : 'none',
            sequenceId: item.sequence_id,
            description: (_e = item.description_stripped) !== null && _e !== void 0 ? _e : '',
            unblocks: blocking
                .filter(function (rel) { return isOpen(rel, stateGroups); })
                .map(function (rel) { return "".concat(identifier, "-").concat(rel.sequence_id); }),
        });
    }
    return found;
}
var rankOf = function (priority) {
    var rank = PRIORITIES.indexOf(priority);
    return rank === -1 ? PRIORITIES.length - 1 : rank;
};
function rankNext(pool, excluded, limit) {
    if (limit === void 0) { limit = LIMIT; }
    return pool
        .filter(function (c) { return !excluded.has(c.id.toUpperCase()); })
        .sort(function (a, b) {
        return rankOf(a.priority) - rankOf(b.priority) ||
            b.unblocks.length - a.unblocks.length ||
            a.sequenceId - b.sequenceId;
    })
        .slice(0, limit);
}
// The ids already at work: in a spec title, a worktree path, the title of a
// session not archived, or launched from the pane.
function excludedIds(tickets, worktreePaths, sessionsJson, launched) {
    var _a, _b;
    var texts = __spreadArray(__spreadArray([], tickets.map(function (t) { var _a; return (_a = t.title) !== null && _a !== void 0 ? _a : ''; }), true), worktreePaths, true);
    try {
        var sessions = JSON.parse(sessionsJson);
        for (var _i = 0, sessions_1 = sessions; _i < sessions_1.length; _i++) {
            var session = sessions_1[_i];
            if (session.isArchived !== true)
                texts.push((_a = session.title) !== null && _a !== void 0 ? _a : '');
        }
    }
    catch (_c) {
        // no sessions known
    }
    var ids = new Set(__spreadArray([], launched, true).map(function (id) { return id.toUpperCase(); }));
    for (var _d = 0, texts_1 = texts; _d < texts_1.length; _d++) {
        var text = texts_1[_d];
        for (var _e = 0, _f = (_b = text.match(TICKET_ID)) !== null && _b !== void 0 ? _b : []; _e < _f.length; _e++) {
            var id = _f[_e];
            ids.add(id.toUpperCase());
        }
    }
    return ids;
}
function startArgs(row, description) {
    var title = "".concat(row.id, " \u2014 ").concat(row.name);
    return {
        initiation: 'user_asked',
        context: 'fresh',
        use_worktree: true,
        branch_name: row.id.toLowerCase(),
        title: title,
        prompt: "/rs-plan ".concat(title, "\n\n").concat(description),
        background: "Plane ticket ".concat(row.id, ", launched from the rstack pilot pane: run /rs-plan on it ") +
            "to turn it into a spec, then wait for the user to validate the plan.",
    };
}
var summaryKey = function (id, updatedAt) { return "summary:".concat(id, ":").concat(updatedAt); };
exports.summaryKey = summaryKey;
var summaryPrompt = function (name, description) {
    return "Summarize this ticket in one short line of French, plain text, no quotes and no prefix.\n\n" +
        "Title: ".concat(name, "\n\n").concat(description);
};
exports.summaryPrompt = summaryPrompt;
