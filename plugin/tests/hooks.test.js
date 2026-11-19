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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
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
// The hooks of plugin/hooks/register.tsx, through the plugin kit.
//
// Contract these tests fix beyond the spec:
// - the pane draws the unshaped array stored at `rstack.tickets` in `$.state`;
//   each element is a ticket of tickets.ts plus its derived `state`
//   ({ worktree, slug, title, status, session?, state, review?, pr? });
// - a poll reads `git worktree list --porcelain` through `$.process.run`;
// - `/pilot` is the command `pilot`.
var testing_1 = require("claude-code/testing");
var PILOT_PANE_PROPS = {
    title: 'Pilot',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
};
var PROCESS_OK = {
    exitCode: 0,
    stdout: '',
    stderr: '',
    isStdoutTruncated: false,
    isStderrTruncated: false,
};
var OPEN_TOOL = 'mcp__ccd_window__open_session_in';
var GET_SESSION = 'mcp__ccd_session_mgmt__get_session';
var LIST_SESSIONS = 'mcp__ccd_session_mgmt__list_sessions';
// What the engine and the world answer beneath the plugin.
function world(on, who) {
    var _this = this;
    if (who === void 0) { who = { id: 'A', cwd: '/work/a' }; }
    var clock = testing_1.mock.clock(on);
    // The store is a Map the test can read: the kit's `$` has no store noun.
    var store = new Map();
    on('store.get', function (_, e) { return ({ value: store.get(e.key) }); });
    on('store.set', function (_, e) {
        store.set(e.key, JSON.parse(JSON.stringify(e.value)));
        return { value: undefined };
    });
    on('store.delete', function (_, e) {
        store.delete(e.key);
        return { value: undefined };
    });
    on('store.keys', function () { return ({ value: __spreadArray([], store.keys(), true) }); });
    var seen = {
        opened: [],
        polls: 0,
        tools: [],
        processes: [],
        // The cwd of each process, same order as `processes`.
        cwds: [],
    };
    on('session.id', function () { return ({ value: who.id }); });
    on('session.cwd', function () { return ({ value: who.cwd }); });
    on('session.start', function (_, e) { return ({ cwd: e.cwd }); });
    on('command.run', function () { return ({ text: '' }); });
    on('command.register', function () { return ({ value: { command: 'pilot' } }); });
    on('ui.open', function (_, e) {
        seen.opened.push(e.id);
        return { value: { isPlaced: true } };
    });
    on('ui.close', function () { return ({ value: undefined }); });
    on('process.run', function (_, e) {
        var _a;
        seen.processes.push(__spreadArray([], e.argv, true));
        seen.cwds.push((_a = e.init) === null || _a === void 0 ? void 0 : _a.cwd);
        if (e.argv[0] === 'git' && e.argv.includes('worktree'))
            seen.polls += 1;
        return { value: app.processAnswer(e.argv) };
    });
    // What the app answers to the Open button: a test sets `openAnswer`.
    var app = {
        // What git and gh answer to a command, by its argv.
        processAnswer: function (_argv) { return PROCESS_OK; },
        // The JSON text `list_sessions` answers.
        sessions: '[]',
        openAnswer: function () { return ({ result: {}, text: 'ok' }); },
        askAnswer: function () { return __awaiter(_this, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, ({ result: {} })];
        }); }); },
        // What `get_session self` answers: the app's id of the calling session.
        selfAnswer: function () { return ({
            result: {},
            text: JSON.stringify({ sessionId: 'local_X' }),
        }); },
    };
    on('tool.call', function (_, e) {
        seen.tools.push(e);
        if (e.tool === OPEN_TOOL)
            return app.openAnswer();
        if (e.tool === 'AskUserQuestion')
            return app.askAnswer();
        if (e.tool === GET_SESSION)
            return app.selfAnswer();
        return { result: {}, text: e.tool === LIST_SESSIONS ? app.sessions : '[]' };
    });
    return { clock: clock, seen: seen, who: who, store: store, app: app };
}
var slash = function ($, command) {
    return $.command.run({
        command: command,
        args: '',
        origin: { kind: 'composer' },
        presentation: { isFullscreen: false, columns: 80 },
    });
};
var start = function ($, cwd) {
    return $.session.start({ cwd: cwd, surface: 'desktop', isInteractive: true });
};
function pendingQuestions(store) {
    return __spreadArray([], store.values(), true).filter(function (value) { return value && typeof value === 'object' && 'question' in value; });
}
var ASK = {
    tool: 'AskUserQuestion',
    questions: [
        {
            question: 'Which library?',
            header: 'Library',
            options: [
                { label: 'a', description: 'A' },
                { label: 'b', description: 'B' },
            ],
            multiSelect: false,
        },
        {
            question: 'Second one?',
            header: 'Other',
            options: [
                { label: 'c', description: 'C' },
                { label: 'd', description: 'D' },
            ],
            multiSelect: false,
        },
    ],
};
var _loop_1 = function (outcome) {
    (0, testing_1.test)("open-session AC4 \u2014 a pending question is published with the app session id of its session, then removed once ".concat(outcome), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, clock, store, app, seen, release, gate, call, pending;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _a = world(on), clock = _a.clock, store = _a.store, app = _a.app, seen = _a.seen;
                    release = function () { };
                    gate = new Promise(function (resolve) { return (release = resolve); });
                    app.askAnswer = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, gate];
                                case 1:
                                    _a.sent();
                                    if (outcome === 'refused')
                                        return [2 /*return*/, { deny: 'no' }];
                                    if (outcome === 'failed')
                                        throw new Error('boom');
                                    return [2 /*return*/, { result: {} }];
                            }
                        });
                    }); };
                    call = $.tool.call(ASK).catch(function () { return undefined; });
                    return [4 /*yield*/, clock.settle()];
                case 1:
                    _b.sent();
                    pending = pendingQuestions(store);
                    (0, testing_1.expect)(pending).toHaveLength(1);
                    (0, testing_1.expect)(pending[0]).toMatchObject({
                        sessionId: 'local_X',
                        question: 'Which library?',
                    });
                    (0, testing_1.expect)(pending[0]).toHaveProperty('at');
                    (0, testing_1.expect)(seen.tools.filter(function (e) { return e.tool === GET_SESSION; })[0]).toMatchObject({ session_id: 'self' });
                    release();
                    return [4 /*yield*/, call];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, clock.settle()];
                case 3:
                    _b.sent();
                    (0, testing_1.expect)(pendingQuestions(store)).toHaveLength(0);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _i = 0, _a = ['answered', 'refused', 'failed']; _i < _a.length; _i++) {
    var outcome = _a[_i];
    _loop_1(outcome);
}
var SELF_FAILURES = {
    refused: function () { return ({ deny: 'not allowed' }); },
    'an error result': function () { return ({ result: 'error', text: 'no such session', isError: true }); },
    'a throw': function () {
        throw new Error('boom');
    },
    'no session': function () { return ({ result: {}, text: '[]' }); },
};
var _loop_2 = function (failure, answer) {
    (0, testing_1.test)("open-session AC4 \u2014 get_session ".concat(failure, ": the question is published without a session id and AskUserQuestion still runs"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, clock, store, app, seen, release, gate, call, pending;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _a = world(on), clock = _a.clock, store = _a.store, app = _a.app, seen = _a.seen;
                    release = function () { };
                    gate = new Promise(function (resolve) { return (release = resolve); });
                    app.selfAnswer = answer;
                    app.askAnswer = function () { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0: return [4 /*yield*/, gate];
                                case 1:
                                    _a.sent();
                                    return [2 /*return*/, { result: {} }];
                            }
                        });
                    }); };
                    call = $.tool.call(ASK).catch(function () { return undefined; });
                    return [4 /*yield*/, clock.settle()];
                case 1:
                    _d.sent();
                    pending = pendingQuestions(store);
                    (0, testing_1.expect)(pending).toHaveLength(1);
                    (0, testing_1.expect)((_b = pending[0]) === null || _b === void 0 ? void 0 : _b.question).toBe('Which library?');
                    (0, testing_1.expect)((_c = pending[0]) === null || _c === void 0 ? void 0 : _c.sessionId).toBeUndefined();
                    (0, testing_1.expect)(seen.tools.filter(function (e) { return e.tool === 'AskUserQuestion'; })).toHaveLength(1);
                    release();
                    return [4 /*yield*/, call];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, clock.settle()];
                case 3:
                    _d.sent();
                    (0, testing_1.expect)(pendingQuestions(store)).toHaveLength(0);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _b = 0, _c = Object.entries(SELF_FAILURES); _b < _c.length; _b++) {
    var _d = _c[_b], failure = _d[0], answer = _d[1];
    _loop_2(failure, answer);
}
(0, testing_1.test)('AC7 — /pilot opens the pane and starts polling', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, seen;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = world(on), clock = _a.clock, seen = _a.seen;
                return [4 /*yield*/, slash($, 'pilot')];
            case 1:
                _b.sent();
                (0, testing_1.expect)(seen.opened).toHaveLength(1);
                return [4 /*yield*/, clock.advance(10000)];
            case 2:
                _b.sent();
                (0, testing_1.expect)(seen.polls).toBeGreaterThan(0);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('AC7 — a started session opens the pane when the store marks it, another does not', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, seen, who;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = world(on), seen = _a.seen, who = _a.who;
                return [4 /*yield*/, slash($, 'pilot')];
            case 1:
                _b.sent();
                seen.opened.length = 0;
                who.id = 'B';
                who.cwd = '/work/b';
                return [4 /*yield*/, start($, '/work/b')];
            case 2:
                _b.sent();
                (0, testing_1.expect)(seen.opened).toHaveLength(0);
                who.id = 'A';
                who.cwd = '/work/a';
                return [4 /*yield*/, start($, '/work/a')];
            case 3:
                _b.sent();
                (0, testing_1.expect)(seen.opened).toHaveLength(1);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('AC7 — in a session no one marked, no pane opens and no polling runs', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, seen;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = world(on), clock = _a.clock, seen = _a.seen;
                return [4 /*yield*/, start($, '/work/a')];
            case 1:
                _b.sent();
                return [4 /*yield*/, clock.advance(60000)];
            case 2:
                _b.sent();
                (0, testing_1.expect)(seen.opened).toHaveLength(0);
                (0, testing_1.expect)(seen.polls).toBe(0);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('AC7 — a session whose mark moved to another session stops polling', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, seen, store, before;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = world(on), clock = _a.clock, seen = _a.seen, store = _a.store;
                return [4 /*yield*/, slash($, 'pilot')];
            case 1:
                _b.sent();
                return [4 /*yield*/, clock.advance(10000)];
            case 2:
                _b.sent();
                (0, testing_1.expect)(seen.polls).toBeGreaterThan(0);
                // What `/pilot` in session B does through the shared store.
                store.set('pilot', 'B');
                return [4 /*yield*/, clock.advance(10000)];
            case 3:
                _b.sent();
                before = seen.polls;
                return [4 /*yield*/, clock.advance(60000)];
            case 4:
                _b.sent();
                (0, testing_1.expect)(seen.polls).toBe(before);
                return [2 /*return*/];
        }
    });
}); });
var SESSION = {
    sessionId: 'local_abc',
    isRunning: true,
    link: 'claude://claude.ai/epitaxy/local_abc',
};
var ticketWith = function (session) { return ({
    worktree: '/work/a',
    slug: 'alpha',
    title: 'Alpha feature',
    id: 'SPOTIME-1',
    name: 'Alpha feature',
    section: 'running',
    step: 3,
    status: 'red',
    branch: 'feat/alpha',
    session: session,
    state: session ? { kind: 'in-dev', status: 'red' } : { kind: 'no-session' },
}); };
function mountPane($, on, tickets, 
// Hooks to register beneath the plugin, before the first call of `$`.
beneath) {
    return __awaiter(this, void 0, void 0, function () {
        var w, ui;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    w = world(on);
                    on('state.get', function () { return ({ value: { value: tickets, version: 1 } }); });
                    beneath === null || beneath === void 0 ? void 0 : beneath(on);
                    return [4 /*yield*/, slash($, 'pilot')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, $.ui.mount({
                            plugin: 'rstack',
                            surface: 'desktop',
                            component: 'Pane',
                            requestId: w.seen.opened[0],
                            props: PILOT_PANE_PROPS,
                        })];
                case 2:
                    ui = _a.sent();
                    return [2 /*return*/, __assign({ ui: ui }, w)];
            }
        });
    });
}
// The row's own Button (its name is in what it draws): never the plan toggle.
function pressRow(ui) {
    return __awaiter(this, void 0, void 0, function () {
        var buttons, button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ui.findAll({ type: 'Button' })];
                case 1:
                    buttons = _a.sent();
                    button = buttons.find(function (b) {
                        return JSON.stringify(b).includes('Alpha feature') &&
                            !JSON.stringify(b).includes('Voir le plan');
                    });
                    if (!button) return [3 /*break*/, 3];
                    return [4 /*yield*/, ui.press({ key: button.key })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/, button];
            }
        });
    });
}
(0, testing_1.test)('AC9 — pressing the row focuses the ticket session in the app', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ui, seen, _b, opens;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, mountPane($, on, [ticketWith(SESSION)])];
            case 1:
                _a = _c.sent(), ui = _a.ui, seen = _a.seen;
                _b = testing_1.expect;
                return [4 /*yield*/, pressRow(ui)];
            case 2:
                _b.apply(void 0, [_c.sent()]).toBeDefined();
                opens = seen.tools.filter(function (e) { return e.tool === OPEN_TOOL; });
                (0, testing_1.expect)(opens).toHaveLength(1);
                (0, testing_1.expect)(opens[0]).toMatchObject({ session_id: 'local_abc', target: 'focus' });
                (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toHaveLength(0);
                return [4 /*yield*/, ui.unmount()];
            case 3:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
var _loop_3 = function (failure) {
    (0, testing_1.test)("AC9 \u2014 pressing the row runs `open <link>` when the app call is ".concat(failure), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, ui, seen, app, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, mountPane($, on, [ticketWith(SESSION)])];
                case 1:
                    _a = _c.sent(), ui = _a.ui, seen = _a.seen, app = _a.app;
                    app.openAnswer = function () {
                        return failure === 'refused'
                            ? { deny: 'not a session this one started' }
                            : { result: 'error', text: 'refused', isError: true };
                    };
                    _b = testing_1.expect;
                    return [4 /*yield*/, pressRow(ui)];
                case 2:
                    _b.apply(void 0, [_c.sent()]).toBeDefined();
                    (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toEqual([
                        ['open', SESSION.link],
                    ]);
                    return [4 /*yield*/, ui.unmount()];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _e = 0, _f = ['refused', 'an error result']; _e < _f.length; _e++) {
    var failure = _f[_e];
    _loop_3(failure);
}
(0, testing_1.test)('AC9 — pressing a ticket with no session calls nothing', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ui, seen;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, mountPane($, on, [ticketWith(undefined)])];
            case 1:
                _a = _b.sent(), ui = _a.ui, seen = _a.seen;
                return [4 /*yield*/, pressRow(ui)];
            case 2:
                _b.sent();
                (0, testing_1.expect)(seen.tools.filter(function (e) { return e.tool === OPEN_TOOL; })).toHaveLength(0);
                (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toHaveLength(0);
                return [4 /*yield*/, ui.unmount()];
            case 3:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
// pilot-v3-ui AC4: with no ticket, the refresh Button is the only one drawn.
(0, testing_1.test)('pilot-v3-ui AC4 — pressing refresh collects at once and stores the time of that collect in rstack.polledAt', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var stored, _a, ui, seen, clock, before, buttons;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                stored = [];
                return [4 /*yield*/, mountPane($, on, [], function (on) {
                        on('state.set', function (_, e) {
                            stored.push({ key: e.key, value: e.value });
                            return { value: { isSet: true, version: stored.length } };
                        });
                    })];
            case 1:
                _a = _c.sent(), ui = _a.ui, seen = _a.seen, clock = _a.clock;
                return [4 /*yield*/, clock.settle()
                    // Well before the next 10 s tick.
                ];
            case 2:
                _c.sent();
                // Well before the next 10 s tick.
                return [4 /*yield*/, clock.set(3000)];
            case 3:
                // Well before the next 10 s tick.
                _c.sent();
                before = seen.polls;
                return [4 /*yield*/, ui.findAll({ type: 'Button' })];
            case 4:
                buttons = _c.sent();
                (0, testing_1.expect)(buttons).toHaveLength(1);
                return [4 /*yield*/, ui.press({ key: buttons[0].key })];
            case 5:
                _c.sent();
                return [4 /*yield*/, clock.settle()];
            case 6:
                _c.sent();
                (0, testing_1.expect)(seen.polls).toBe(before + 1);
                (0, testing_1.expect)((_b = stored.filter(function (s) { return s.key === 'polledAt'; }).pop()) === null || _b === void 0 ? void 0 : _b.value).toBe(3000);
                return [4 /*yield*/, ui.unmount()];
            case 7:
                _c.sent();
                return [2 /*return*/];
        }
    });
}); });
// pilot-v3-ui AC5
var toiRow = function (state, session) { return (__assign(__assign({}, ticketWith(session)), { section: 'toi', step: 1, status: 'draft', state: state })); };
var ACTIONS = [
    { label: 'Répondre', state: { kind: 'awaiting-answer', question: 'Which library?' } },
    { label: 'Voir le plan', state: { kind: 'awaiting-plan-validation' } },
];
function actionButton(ui, label) {
    return __awaiter(this, void 0, void 0, function () {
        var buttons;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ui.findAll({ type: 'Button' })];
                case 1:
                    buttons = _a.sent();
                    return [2 /*return*/, buttons.find(function (b) { return JSON.stringify(b).includes(label); })];
            }
        });
    });
}
var _loop_4 = function (label, state) {
    (0, testing_1.test)("pilot-v3-ui AC5 \u2014 pressing the toi row's ".concat(label, " Button focuses its session in the app"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, ui, seen, button, opens;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, mountPane($, on, [toiRow(state, SESSION)])];
                case 1:
                    _a = _b.sent(), ui = _a.ui, seen = _a.seen;
                    return [4 /*yield*/, actionButton(ui, label)];
                case 2:
                    button = _b.sent();
                    (0, testing_1.expect)(button).toBeDefined();
                    return [4 /*yield*/, ui.press({ key: button.key })];
                case 3:
                    _b.sent();
                    opens = seen.tools.filter(function (e) { return e.tool === OPEN_TOOL; });
                    (0, testing_1.expect)(opens).toHaveLength(1);
                    (0, testing_1.expect)(opens[0]).toMatchObject({ session_id: 'local_abc', target: 'focus' });
                    (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toHaveLength(0);
                    return [4 /*yield*/, ui.unmount()];
                case 4:
                    _b.sent();
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _g = 0, ACTIONS_1 = ACTIONS; _g < ACTIONS_1.length; _g++) {
    var _h = ACTIONS_1[_g], label = _h.label, state = _h.state;
    _loop_4(label, state);
}
(0, testing_1.test)('pilot-v3-ui AC5 — pressing the toi row\'s action Button runs `open <link>` when the app call is refused', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ui, seen, app, button;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, mountPane($, on, [toiRow(ACTIONS[0].state, SESSION)])];
            case 1:
                _a = _b.sent(), ui = _a.ui, seen = _a.seen, app = _a.app;
                app.openAnswer = function () { return ({ deny: 'not a session this one started' }); };
                return [4 /*yield*/, actionButton(ui, 'Répondre')];
            case 2:
                button = _b.sent();
                (0, testing_1.expect)(button).toBeDefined();
                return [4 /*yield*/, ui.press({ key: button.key })];
            case 3:
                _b.sent();
                (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toEqual([
                    ['open', SESSION.link],
                ]);
                return [4 /*yield*/, ui.unmount()];
            case 4:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-v3-ui AC5 — a toi row with no session has no action Button: no Button of the pane opens anything', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, ui, seen, buttons, _i, buttons_1, button;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, mountPane($, on, [toiRow({ kind: 'no-session' })])];
            case 1:
                _a = _b.sent(), ui = _a.ui, seen = _a.seen;
                return [4 /*yield*/, ui.findAll({ type: 'Button' })
                    // The refresh Button is there; none is an action Button.
                ];
            case 2:
                buttons = _b.sent();
                // The refresh Button is there; none is an action Button.
                (0, testing_1.expect)(buttons.length).toBeGreaterThan(0);
                (0, testing_1.expect)(buttons.some(function (b) { return /Répondre|Voir le plan/.test(JSON.stringify(b)); })).toBe(false);
                _i = 0, buttons_1 = buttons;
                _b.label = 3;
            case 3:
                if (!(_i < buttons_1.length)) return [3 /*break*/, 6];
                button = buttons_1[_i];
                return [4 /*yield*/, ui.press({ key: button.key })];
            case 4:
                _b.sent();
                _b.label = 5;
            case 5:
                _i++;
                return [3 /*break*/, 3];
            case 6:
                (0, testing_1.expect)(seen.tools.filter(function (e) { return e.tool === OPEN_TOOL; })).toHaveLength(0);
                (0, testing_1.expect)(seen.processes.filter(function (argv) { return argv[0] === 'open'; })).toHaveLength(0);
                return [4 /*yield*/, ui.unmount()];
            case 7:
                _b.sent();
                return [2 /*return*/];
        }
    });
}); });
// A poll over one worktree on a branch, whose features folder holds one
// shipped spec: what `/pilot` writes to `rstack.tickets`, with `gh` answering
// `gh`. Each case has its own branch: the pilot keeps a PR a minute per branch.
function pollShipped($, on, o) {
    return __awaiter(this, void 0, void 0, function () {
        var WT, w, written;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    WT = '/work/a';
                    w = world(on);
                    written = [];
                    on('state.set', function (_, e) {
                        if (e.key === 'tickets')
                            written.push(e.value);
                        return { value: { isSet: true, version: written.length } };
                    });
                    on('fs.exists', function () { return ({ value: true }); });
                    on('fs.list', function () { return ({
                        value: [{ name: 'alpha.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
                    }); });
                    on('fs.read', function () { return ({
                        value: "---\nstatus: shipped\nbranch: ".concat(o.branch, "\n---\n\n# Alpha feature\n"),
                    }); });
                    w.app.processAnswer = function (argv) {
                        return o.origin !== undefined && argv[0] === 'git' && argv.includes('remote')
                            ? __assign(__assign({}, PROCESS_OK), { stdout: "".concat(o.origin, "\n") }) : argv[0] === 'git'
                            ? __assign(__assign({}, PROCESS_OK), { stdout: "worktree ".concat(WT, "\nHEAD ").concat('0'.repeat(40), "\nbranch refs/heads/").concat(o.branch, "\n") }) : argv[0] === 'gh'
                            ? __assign(__assign({}, PROCESS_OK), o.gh) : argv[0] === 'glab'
                            ? __assign(__assign({}, PROCESS_OK), o.glab) : PROCESS_OK;
                    };
                    if (o.withSession) {
                        w.app.sessions = JSON.stringify([
                            {
                                sessionId: 'local_abc',
                                cwd: WT,
                                isArchived: false,
                                isRunning: false,
                                lastActivityAt: '2026-11-18T10:00:00.000Z',
                                link: 'claude://claude.ai/epitaxy/local_abc',
                            },
                        ]);
                    }
                    return [4 /*yield*/, slash($, 'pilot')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, w.clock.settle()];
                case 2:
                    _a.sent();
                    return [2 /*return*/, {
                            rows: written[written.length - 1],
                            gh: w.seen.processes.filter(function (argv) { return argv[0] === 'gh'; }),
                            glab: w.seen.processes.filter(function (argv) { return argv[0] === 'glab'; }),
                            clock: w.clock,
                            glabCwds: function () {
                                return w.seen.processes.flatMap(function (argv, i) { return (argv[0] === 'glab' ? [w.seen.cwds[i]] : []); });
                            },
                            glabCalls: function () {
                                return w.seen.processes.filter(function (argv) { return argv[0] === 'glab' && argv[1] === 'mr' && argv[3] === o.branch; }).length;
                            },
                            ghCalls: function () {
                                return w.seen.processes.filter(function (argv) { return argv[0] === 'gh' && argv[1] === 'pr' && argv[3] === o.branch; }).length;
                            },
                        }];
            }
        });
    });
}
var ghPr = function (state) { return ({
    exitCode: 0,
    stdout: JSON.stringify({
        state: state,
        url: 'https://github.com/o/r/pull/7',
        statusCheckRollup: [],
    }),
}); };
var SHIPPED_CASES = [
    { name: 'MERGED, no session', pr: ghPr('MERGED'), withSession: false, kept: false },
    { name: 'CLOSED, no session', pr: ghPr('CLOSED'), withSession: false, kept: false },
    { name: 'MERGED, with a session', pr: ghPr('MERGED'), withSession: true, kept: false },
    { name: 'OPEN, no session', pr: ghPr('OPEN'), withSession: false, kept: true },
    { name: 'gh failing, no session', pr: { exitCode: 1, stdout: '' }, withSession: false, kept: true },
];
var _loop_5 = function (i, c) {
    (0, testing_1.test)("hide-done AC3 \u2014 a shipped ticket with a branch, PR ".concat(c.name, ": its PR is read, and the row is ").concat(c.kept ? 'kept' : 'left out'), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var branch, _a, rows, gh;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    branch = "feat/shipped-".concat(i);
                    return [4 /*yield*/, pollShipped($, on, {
                            branch: branch,
                            gh: c.pr,
                            withSession: c.withSession,
                        })];
                case 1:
                    _a = _b.sent(), rows = _a.rows, gh = _a.gh;
                    (0, testing_1.expect)(gh.some(function (argv) { return argv.slice(0, 3).join(' ') === 'gh pr view' && argv[3] === branch; })).toBe(true);
                    (0, testing_1.expect)(rows).toBeDefined();
                    (0, testing_1.expect)(rows.filter(function (row) { return row.slug === 'alpha'; })).toHaveLength(c.kept ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _j = 0, _k = SHIPPED_CASES.entries(); _j < _k.length; _j++) {
    var _l = _k[_j], i = _l[0], c = _l[1];
    _loop_5(i, c);
}
// pilot-v2-ui AC8: polling every 10 s, `gh` is asked again for a PR once 60 s
// have passed, except for a PR read MERGED or CLOSED, which is asked once.
var LATER_CASES = [
    { name: 'MERGED', pr: ghPr('MERGED'), asksAgain: false },
    { name: 'CLOSED', pr: ghPr('CLOSED'), asksAgain: false },
    { name: 'OPEN', pr: ghPr('OPEN'), asksAgain: true },
    { name: 'gh failing', pr: { exitCode: 1, stdout: '' }, asksAgain: true },
];
var _loop_6 = function (i, c) {
    (0, testing_1.test)("AC8 \u2014 a shipped ticket's PR read ".concat(c.name, ": when the pilot polls again past 60 s, `gh pr view` is ").concat(c.asksAgain ? 'run again' : 'not run again'), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, clock, ghCalls;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, pollShipped($, on, {
                        branch: "feat/later-".concat(i),
                        gh: c.pr,
                    })];
                case 1:
                    _a = _b.sent(), clock = _a.clock, ghCalls = _a.ghCalls;
                    (0, testing_1.expect)(ghCalls()).toBe(1);
                    return [4 /*yield*/, clock.advance(130000)];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, clock.settle()];
                case 3:
                    _b.sent();
                    if (c.asksAgain)
                        (0, testing_1.expect)(ghCalls()).toBeGreaterThan(1);
                    else
                        (0, testing_1.expect)(ghCalls()).toBe(1);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _m = 0, _o = LATER_CASES.entries(); _m < _o.length; _m++) {
    var _p = _o[_m], i = _p[0], c = _p[1];
    _loop_6(i, c);
}
// pilot-gitlab AC3: the tool is picked by the host of the worktree's `origin`.
var GITLAB = 'https://gitlab.com/o/r.git';
var glabMr = function (state) { return ({
    exitCode: 0,
    stdout: JSON.stringify({
        iid: 42,
        state: state,
        web_url: 'https://gitlab.com/o/r/-/merge_requests/42',
        head_pipeline: { status: 'success' },
    }),
}); };
var GITLAB_CASES = [
    { name: 'merged', mr: glabMr('merged'), kept: false },
    { name: 'closed', mr: glabMr('closed'), kept: false },
    { name: 'opened', mr: glabMr('opened'), kept: true },
];
var _loop_7 = function (i, c) {
    (0, testing_1.test)("pilot-gitlab AC3 \u2014 a shipped ticket on gitlab.com: `glab mr view` is run and not `gh`, an MR ".concat(c.name, " ").concat(c.kept ? 'keeps' : 'leaves out', " the row"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var branch, _a, rows, gh, glab, glabCwds;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    branch = "feat/gitlab-".concat(i);
                    return [4 /*yield*/, pollShipped($, on, {
                            branch: branch,
                            origin: GITLAB,
                            glab: c.mr,
                        })];
                case 1:
                    _a = _b.sent(), rows = _a.rows, gh = _a.gh, glab = _a.glab, glabCwds = _a.glabCwds;
                    (0, testing_1.expect)(glab).toContainEqual(['glab', 'mr', 'view', branch, '-F', 'json']);
                    (0, testing_1.expect)(glabCwds()).toEqual(glab.map(function () { return '/work/a'; }));
                    (0, testing_1.expect)(gh).toHaveLength(0);
                    (0, testing_1.expect)(rows).toBeDefined();
                    (0, testing_1.expect)(rows.filter(function (row) { return row.slug === 'alpha'; })).toHaveLength(c.kept ? 1 : 0);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _q = 0, _r = GITLAB_CASES.entries(); _q < _r.length; _q++) {
    var _s = _r[_q], i = _s[0], c = _s[1];
    _loop_7(i, c);
}
(0, testing_1.test)('pilot-gitlab AC3 — a merged MR is not read again when the pilot polls past 60 s', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, glabCalls;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, pollShipped($, on, {
                    branch: 'feat/gitlab-later-merged',
                    origin: GITLAB,
                    glab: glabMr('merged'),
                })];
            case 1:
                _a = _b.sent(), clock = _a.clock, glabCalls = _a.glabCalls;
                (0, testing_1.expect)(glabCalls()).toBe(1);
                return [4 /*yield*/, clock.advance(130000)];
            case 2:
                _b.sent();
                return [4 /*yield*/, clock.settle()];
            case 3:
                _b.sent();
                (0, testing_1.expect)(glabCalls()).toBe(1);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-gitlab AC3 — an opened MR keeps its row and is read again past 60 s', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, clock, glabCalls;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, pollShipped($, on, {
                    branch: 'feat/gitlab-later-open',
                    origin: GITLAB,
                    glab: glabMr('opened'),
                })];
            case 1:
                _a = _b.sent(), clock = _a.clock, glabCalls = _a.glabCalls;
                (0, testing_1.expect)(glabCalls()).toBe(1);
                return [4 /*yield*/, clock.advance(130000)];
            case 2:
                _b.sent();
                return [4 /*yield*/, clock.settle()];
            case 3:
                _b.sent();
                (0, testing_1.expect)(glabCalls()).toBeGreaterThan(1);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-gitlab AC3 — a shipped ticket on github.com still runs `gh pr view`, not `glab`', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var branch, _a, gh, glab;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                branch = 'feat/github-origin';
                return [4 /*yield*/, pollShipped($, on, {
                        branch: branch,
                        origin: 'https://github.com/o/r.git',
                        gh: ghPr('OPEN'),
                    })];
            case 1:
                _a = _b.sent(), gh = _a.gh, glab = _a.glab;
                (0, testing_1.expect)(gh.some(function (argv) { return argv.slice(0, 3).join(' ') === 'gh pr view' && argv[3] === branch; })).toBe(true);
                (0, testing_1.expect)(glab).toHaveLength(0);
                return [2 /*return*/];
        }
    });
}); });
