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
exports.worktreePaths = worktreePaths;
exports.selfId = selfId;
exports.listTickets = listTickets;
exports.parseReview = parseReview;
exports.deriveState = deriveState;
exports.parsePr = parsePr;
exports.forgeOf = forgeOf;
exports.parseMr = parseMr;
exports.ticketId = ticketId;
exports.sectionOf = sectionOf;
exports.sections = sections;
exports.stepOf = stepOf;
exports.waitingSince = waitingSince;
exports.elapsed = elapsed;
exports.reviewLine = reviewLine;
exports.planSummary = planSummary;
exports.counters = counters;
exports.planFacts = planFacts;
exports.segments = segments;
var REVIEW_CAP = 3;
function worktreePaths(porcelain) {
    return porcelain
        .split('\n')
        .filter(function (line) { return line.startsWith('worktree '); })
        .map(function (line) { return line.slice('worktree '.length); });
}
// The worktrees HEAD is detached in: the app keeps an archived session's
// worktree in a reuse pool that way.
function detachedPaths(porcelain) {
    return new Set(porcelain
        .split(/\n\s*\n/)
        .filter(function (block) { return block.split('\n').includes('detached'); })
        .flatMap(worktreePaths));
}
function frontmatter(text) {
    var _a;
    var lines = text.split('\n');
    var fields = {};
    if (((_a = lines[0]) === null || _a === void 0 ? void 0 : _a.trim()) !== '---')
        return fields;
    for (var _i = 0, _b = lines.slice(1); _i < _b.length; _i++) {
        var line = _b[_i];
        if (line.trim() === '---')
            break;
        var colon = line.indexOf(':');
        if (colon > 0)
            fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
    }
    return fields;
}
function title(text) {
    var _a;
    return (_a = text
        .split('\n')
        .find(function (line) { return line.startsWith('# '); })) === null || _a === void 0 ? void 0 : _a.slice(2).trim();
}
function sessionsOf(json) {
    try {
        var parsed = JSON.parse(json);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (_a) {
        return [];
    }
}
function selfOf(json) {
    try {
        var parsed = JSON.parse(json !== null && json !== void 0 ? json : '');
        return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
            ? [parsed]
            : [];
    }
    catch (_a) {
        return [];
    }
}
// The app session id of a `get_session` answer, if it names one.
function selfId(json) {
    var _a;
    var id = (_a = selfOf(json)[0]) === null || _a === void 0 ? void 0 : _a.sessionId;
    return typeof id === 'string' ? id : undefined;
}
function sessionOf(worktree, sessions, selfSessionId) {
    var found = sessions
        .filter(function (s) { return s.cwd === worktree && s.isArchived !== true; })
        .sort(function (a, b) {
        return Date.parse(String(b.lastActivityAt)) -
            Date.parse(String(a.lastActivityAt));
    })[0];
    return found
        ? __assign(__assign({ sessionId: String(found.sessionId), isRunning: found.isRunning === true, link: String(found.link) }, (typeof found.lastActivityAt === 'string'
            ? { lastActivityAt: found.lastActivityAt }
            : {})), (selfSessionId !== undefined && String(found.sessionId) === selfSessionId
            ? { isPilot: true }
            : {})) : undefined;
}
function listTickets(input) {
    var sessions = __spreadArray(__spreadArray([], sessionsOf(input.sessions), true), selfOf(input.self), true);
    var own = selfId(input.self);
    var detached = detachedPaths(input.worktrees);
    var main = worktreePaths(input.worktrees)[0];
    return worktreePaths(input.worktrees).flatMap(function (worktree) {
        var _a;
        var session = sessionOf(worktree, sessions, own);
        var pooled = !session && detached.has(worktree);
        var files = (_a = input.files[worktree]) !== null && _a !== void 0 ? _a : {};
        var specs = Object.keys(files)
            .filter(function (name) { return name.endsWith('.md') && !name.endsWith('.review.md'); })
            .sort();
        if (specs.length === 0) {
            // The main checkout's session is the user's own, not a ticket's.
            return session && worktree !== main ? [{ worktree: worktree, session: session }] : [];
        }
        return specs.flatMap(function (name) {
            var _a;
            var text = (_a = files[name]) !== null && _a !== void 0 ? _a : '';
            var meta = frontmatter(text);
            // A pool worktree keeps its shipped specs with a branch: the PR decides.
            if (pooled && !(meta.status === 'shipped' && meta.branch))
                return [];
            return [{
                    worktree: worktree,
                    slug: name.slice(0, -'.md'.length),
                    title: title(text),
                    status: meta.status,
                    branch: meta.branch,
                    red: meta.red,
                    session: session,
                }];
        });
    });
}
function parseReview(text) {
    if (text === undefined)
        return undefined;
    var rounds = __spreadArray([], text.matchAll(/^## Round \d+ — (OK|KO) — /gm), true);
    var last = rounds[rounds.length - 1];
    if (!(last === null || last === void 0 ? void 0 : last[1]))
        return undefined;
    return {
        rounds: rounds.length,
        verdict: last[1],
        fixes: __spreadArray([], text.matchAll(/^## Fix \d+/gm), true).length,
        cap: REVIEW_CAP,
    };
}
var BUILDING = ['ready', 'red', 'green', 'reviewed'];
function deriveState(ticket, context) {
    var _a;
    var status = ticket.status, session = ticket.session;
    var asked = ((_a = context.questions) !== null && _a !== void 0 ? _a : [])
        .filter(function (q) { return q.sessionId !== undefined && q.sessionId === (session === null || session === void 0 ? void 0 : session.sessionId); })
        .sort(function (a, b) { return b.at - a.at; })[0];
    if (asked && (session === null || session === void 0 ? void 0 : session.isRunning)) {
        return { kind: 'awaiting-answer', question: asked.question, at: asked.at };
    }
    if (status === 'shipped')
        return { kind: 'shipped' };
    if (!session)
        return { kind: 'no-session' };
    if (status === 'draft' && !session.isRunning) {
        return { kind: 'awaiting-plan-validation' };
    }
    if (status && BUILDING.includes(status) && !session.isRunning) {
        return { kind: 'awaiting-answer' };
    }
    if (status === 'draft')
        return { kind: 'planning' };
    if (status === 'green' && context.review)
        return __assign({ kind: 'review' }, context.review);
    if (status === 'ready' || status === 'red' || status === 'green') {
        return { kind: 'in-dev', status: status };
    }
    if (status === 'reviewed')
        return { kind: 'shipping' };
    return { kind: 'no-spec' };
}
var FAILED = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR'];
function parsePr(result) {
    var _a;
    if (result.exitCode !== 0)
        return undefined;
    try {
        var pr = JSON.parse(result.stdout);
        if (!['OPEN', 'MERGED', 'CLOSED'].includes(pr.state))
            return undefined;
        var checks = (_a = pr.statusCheckRollup) !== null && _a !== void 0 ? _a : [];
        var concluded_1 = function (c) { return c.conclusion || c.state || ''; };
        var ci = checks.some(function (c) { return FAILED.includes(concluded_1(c)); })
            ? 'failing'
            : checks.some(function (c) { return c.status !== 'COMPLETED' && c.state !== 'SUCCESS'; })
                ? 'pending'
                : checks.length > 0
                    ? 'passing'
                    : 'none';
        return __assign({ state: pr.state, url: String(pr.url), ci: ci }, (typeof pr.number === 'number' ? { number: pr.number } : {}));
    }
    catch (_b) {
        return undefined;
    }
}
var ORIGIN_HOST = /^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:[^@/]*@)?([^/:]+)[:/]/i;
// The forge of an `origin` URL: gitlab.com is gitlab, anything else github.
function forgeOf(url) {
    var _a, _b;
    return ((_b = (_a = url === null || url === void 0 ? void 0 : url.trim().match(ORIGIN_HOST)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.toLowerCase()) === 'gitlab.com'
        ? 'gitlab'
        : 'github';
}
var MR_STATES = {
    opened: 'OPEN',
    locked: 'OPEN',
    merged: 'MERGED',
    closed: 'CLOSED',
};
var MR_CI = {
    success: 'passing',
    failed: 'failing',
    canceled: 'failing',
    running: 'pending',
    pending: 'pending',
    created: 'pending',
    preparing: 'pending',
    waiting_for_resource: 'pending',
    scheduled: 'pending',
};
// The result of `glab mr view <branch> -F json`.
function parseMr(result) {
    var _a, _b;
    if (result.exitCode !== 0)
        return undefined;
    try {
        var mr = JSON.parse(result.stdout);
        var state = MR_STATES[mr.state];
        if (!state)
            return undefined;
        return __assign(__assign({ state: state, url: String(mr.web_url), ci: (_b = MR_CI[(_a = mr.head_pipeline) === null || _a === void 0 ? void 0 : _a.status]) !== null && _b !== void 0 ? _b : 'none' }, (typeof mr.iid === 'number' ? { number: mr.iid } : {})), { kind: 'mr' });
    }
    catch (_c) {
        return undefined;
    }
}
var TICKET_ID = /[A-Z][A-Z0-9]+-\d+/;
var DANGLING = /^[\s—–\-:·]+|[\s—–\-:·]+$/g;
// The ticket id a spec title holds, and the title without it, its brackets
// and the separator it leaves dangling.
function ticketId(title, slug) {
    var _a;
    var id = (_a = title === null || title === void 0 ? void 0 : title.match(TICKET_ID)) === null || _a === void 0 ? void 0 : _a[0];
    if (title === undefined || title === '')
        return { name: slug };
    if (!id)
        return { name: title };
    var name = title
        .replace(id, ' ')
        .replace(/\(\s*\)|\[\s*\]/g, ' ')
        .replace(DANGLING, '')
        .replace(/\s{2,}/g, ' ');
    return { id: id, name: name || slug };
}
var SECTION_OF = {
    'awaiting-answer': 'toi',
    'awaiting-plan-validation': 'toi',
    'no-session': 'toi',
    shipped: 'pr',
};
function sectionOf(kind) {
    var _a;
    return (_a = SECTION_OF[kind]) !== null && _a !== void 0 ? _a : 'running';
}
// The rows in sections, in the order they are drawn: what waits for the user,
// longest first, then what runs, then the pull requests.
function sections(rows) {
    var ids = ['toi', 'running', 'pr'];
    return ids.map(function (id) {
        var own = rows.filter(function (row) { return sectionOf(row.state.kind) === id; });
        if (id === 'toi') {
            own.sort(function (a, b) { var _a, _b; return ((_a = a.since) !== null && _a !== void 0 ? _a : Infinity) - ((_b = b.since) !== null && _b !== void 0 ? _b : Infinity); });
        }
        return { id: id, rows: own, count: own.length };
    });
}
var STEPS = {
    ready: 2,
    red: 3,
    green: 4,
    reviewed: 5,
    shipped: 5,
};
// Where a ticket stands in plan, red, green, review, ship.
function stepOf(status) {
    return (status && STEPS[status]) || 1;
}
// When the user's turn started: the pending question's, else the stopped
// session's last activity.
function waitingSince(row) {
    var _a, _b;
    if (sectionOf(row.state.kind) !== 'toi')
        return undefined;
    if (row.state.at !== undefined)
        return row.state.at;
    var last = Date.parse((_b = (_a = row.session) === null || _a === void 0 ? void 0 : _a.lastActivityAt) !== null && _b !== void 0 ? _b : '');
    return Number.isNaN(last) ? undefined : last;
}
var MINUTE = 60000;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
function elapsed(since, now) {
    var ms = Math.max(0, now - since);
    if (ms >= DAY)
        return { n: Math.floor(ms / DAY), unit: 'd' };
    if (ms >= HOUR)
        return { n: Math.floor(ms / HOUR), unit: 'h' };
    return { n: Math.floor(ms / MINUTE), unit: 'min' };
}
// The review's rounds, its cap and what runs now: after a KO, the fix while
// one is missing, then the next round.
function reviewLine(review) {
    var rounds = review.rounds, cap = review.cap, verdict = review.verdict, fixes = review.fixes;
    if (verdict !== 'KO')
        return { rounds: rounds, cap: cap };
    return { rounds: rounds, cap: cap, running: fixes < rounds ? 'fix' : 'round' };
}
var PLAN_SECTIONS = ['User story', 'Acceptance criteria'];
// The user story then the acceptance criteria of a spec, headings included.
function planSummary(text) {
    var found = {};
    var current;
    for (var _i = 0, _a = text.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.startsWith('## ')) {
            var name_1 = line.slice(3).trim();
            current = PLAN_SECTIONS.includes(name_1) ? (found[name_1] = [line]) : undefined;
        }
        else
            current === null || current === void 0 ? void 0 : current.push(line);
    }
    var parts = PLAN_SECTIONS.flatMap(function (name) {
        var lines = found[name];
        return lines ? [lines.join('\n').trim()] : [];
    });
    return parts.length > 0 ? parts.join('\n\n') : undefined;
}
// The tiles' numbers: what waits for the user, what is in review, the rest of
// what runs, the pull requests.
function counters(rows) {
    var inSection = function (id) { return rows.filter(function (row) { return row.section === id; }); };
    var running = inSection('running');
    var review = running.filter(function (row) { return row.state.kind === 'review'; }).length;
    return {
        toi: inSection('toi').length,
        review: review,
        dev: running.length - review,
        pr: inSection('pr').length,
    };
}
// What a spec says of its plan: its acceptance criteria and its files.
function planFacts(text) {
    var criteria = 0;
    var files = 0;
    var inFiles = false;
    for (var _i = 0, _a = text.split('\n'); _i < _a.length; _i++) {
        var line = _a[_i];
        if (line.startsWith('#'))
            inFiles = /^###\s+Files\s*$/.test(line);
        else if (/^- \[[ x]\] AC\d+/.test(line))
            criteria += 1;
        else if (inFiles && line.startsWith('- '))
            files += 1;
    }
    return { criteria: criteria, files: files };
}
var SEGMENTS = ['plan', 'red', 'green', 'review', 'ship'];
// The five segments of a ticket's progress bar, from its step (1 to 5).
function segments(step) {
    return SEGMENTS.map(function (name, i) { return ({
        name: name,
        state: i + 1 < step ? 'done' : i + 1 === step ? 'current' : 'todo',
    }); });
}
