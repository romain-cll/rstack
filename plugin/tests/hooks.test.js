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
var _a, _b, _c;
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
        // pilot-next: what the app answers to any other tool; undefined falls to the default.
        otherTool: function (_e) { return undefined; },
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
        var other = app.otherTool(e);
        if (other !== undefined)
            return other;
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
for (var _i = 0, _d = ['answered', 'refused', 'failed']; _i < _d.length; _i++) {
    var outcome = _d[_i];
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
for (var _f = 0, _g = Object.entries(SELF_FAILURES); _f < _g.length; _f++) {
    var _h = _g[_f], failure = _h[0], answer = _h[1];
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
for (var _j = 0, _k = ['refused', 'an error result']; _j < _k.length; _j++) {
    var failure = _k[_j];
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
for (var _l = 0, ACTIONS_1 = ACTIONS; _l < ACTIONS_1.length; _l++) {
    var _m = ACTIONS_1[_l], label = _m.label, state = _m.state;
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
for (var _o = 0, _p = SHIPPED_CASES.entries(); _o < _p.length; _o++) {
    var _q = _p[_o], i = _q[0], c = _q[1];
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
for (var _r = 0, _s = LATER_CASES.entries(); _r < _s.length; _r++) {
    var _t = _s[_r], i = _t[0], c = _t[1];
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
for (var _u = 0, _v = GITLAB_CASES.entries(); _u < _v.length; _u++) {
    var _w = _v[_u], i = _w[0], c = _w[1];
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
// pilot-next: the next tickets to launch, read from Plane.
//
// Contract these tests fix beyond the spec:
// - `rstack.next` is the array stored under the key `next` of `$.state`; each
//   row has { id, name, summary?, unblocks, workitemId, updatedAt };
// - the polling pane reads `<main checkout>/.rstack/pilot.json` through `$.fs`
//   (`.rs/` when `.rstack/` does not exist), the main checkout being the first
//   worktree of `git worktree list --porcelain`;
// - Plane tools take `{ tool, action: 'list', ... }`, answer a JSON text, and
//   `workitem_relation list` answers `{ dependencies: { blocking, blocked_by } }`;
// - the `Lancer` Buttons come in the order of `rstack.next`.
var PLANE_PROJECT = 'mcp__plane__project';
var PLANE_STATE = 'mcp__plane__state';
var PLANE_ITEMS = 'mcp__plane__workitem';
var PLANE_RELATIONS = 'mcp__plane__workitem_relation';
var START_SESSION = 'mcp__ccd_session__start_session';
var MAIN = '/work/main';
var PLANE_CONFIG = JSON.stringify({ plane: { project: 'SPOTIME' } });
var CONFIGURED = { files: (_a = {}, _a["".concat(MAIN, "/.rstack/pilot.json")] = PLANE_CONFIG, _a) };
var USAGE = {
    input_tokens: 1,
    output_tokens: 1,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
};
var SUMMARY = 'Un résumé en une ligne.';
var ANSWERED = function () { return ({ isAnswered: true, text: SUMMARY, usage: USAGE }); };
var planeItem = function (seq, over) {
    if (over === void 0) { over = {}; }
    return (__assign({ id: "w".concat(seq), name: "Ticket ".concat(seq), sequence_id: seq, priority: 'none', state: { group: 'unstarted' }, is_draft: false, updated_at: '2026-11-20T10:00:00Z', description_stripped: "Description of ticket ".concat(seq, "."), type_id: null }, over));
};
var PLANE_STATES = [
    { id: 's-backlog', group: 'backlog' },
    { id: 's-unstarted', group: 'unstarted' },
    { id: 's-started', group: 'started' },
    { id: 's-done', group: 'completed' },
    { id: 's-cancel', group: 'cancelled' },
];
function planeWorld(on_1) {
    return __awaiter(this, arguments, void 0, function (on, o) {
        var w, files, dirs, state, writes, version, plane, ok, listed, model, submits;
        var _a, _b, _c;
        if (o === void 0) { o = {}; }
        return __generator(this, function (_d) {
            w = world(on);
            files = (_a = o.files) !== null && _a !== void 0 ? _a : {};
            dirs = (_b = o.dirs) !== null && _b !== void 0 ? _b : ["".concat(MAIN, "/.rstack")];
            state = new Map();
            writes = [];
            version = 0;
            on('state.get', function (_, e) { return ({ value: { value: state.get(e.key), version: version } }); });
            on('state.set', function (_, e) {
                state.set(e.key, JSON.parse(JSON.stringify(e.value)));
                writes.push(e.key);
                version += 1;
                return { value: { isSet: true, version: version } };
            });
            on('fs.exists', function (_, e) { return ({
                value: dirs.includes(e.path) ||
                    e.path in files ||
                    Object.keys(files).some(function (f) { return f.startsWith("".concat(e.path, "/")); }),
            }); });
            on('fs.list', function () { return ({ value: [] }); });
            on('fs.read', function (_, e) {
                if (e.path in files)
                    return { value: files[e.path] };
                throw new Error("ENOENT ".concat(e.path));
            });
            w.app.processAnswer = function (argv) {
                return argv[0] === 'git'
                    ? __assign(__assign({}, PROCESS_OK), { stdout: [MAIN, '/work/a']
                            .map(function (p) { return "worktree ".concat(p, "\nHEAD ").concat('0'.repeat(40), "\nbranch refs/heads/").concat(p.slice(1), "\n"); })
                            .join('\n') }) : PROCESS_OK;
            };
            plane = {
                items: (_c = o.items) !== null && _c !== void 0 ? _c : [planeItem(1), planeItem(2)],
                pages: undefined,
                relations: {},
                calls: [],
                // An answer to put in place of Plane's, for the call asked.
                fail: function (_e) { return undefined; },
                start: function (_e) { return ({ result: {}, text: '{}' }); },
            };
            ok = function (body) { return ({ result: {}, text: JSON.stringify(body) }); };
            listed = function (body) { return ok({ result: body }); };
            w.app.otherTool = function (e) {
                var _a;
                if (e.tool === START_SESSION)
                    return plane.start(e);
                if (!String(e.tool).startsWith('mcp__plane__'))
                    return undefined;
                plane.calls.push(e);
                var failed = plane.fail(e);
                if (failed !== undefined)
                    return failed;
                if (e.tool === PLANE_PROJECT)
                    return listed({
                        results: [
                            { id: 'proj-0', identifier: 'OTHER', name: 'Other' },
                            { id: 'proj-1', identifier: 'SPOTIME', name: 'Spotime' },
                        ],
                        next_page_results: false,
                    });
                if (e.tool === PLANE_STATE)
                    return listed({ results: PLANE_STATES, next_page_results: false });
                if (e.tool === PLANE_ITEMS) {
                    // Pages: the first answers with `next_cursor`, and each cursor is `cur-<n>`.
                    var pages = plane.pages;
                    if (!pages)
                        return listed({ results: plane.items, next_page_results: false });
                    var at = e.cursor ? Number(String(e.cursor).slice(4)) : 0;
                    var more = at + 1 < pages.length;
                    return listed(__assign({ results: pages[at], next_page_results: more }, (more ? { next_cursor: "cur-".concat(at + 1) } : {})));
                }
                if (e.tool === PLANE_RELATIONS)
                    return ok({
                        dependencies: (_a = plane.relations[e.workitem_id]) !== null && _a !== void 0 ? _a : { blocking: [], blocked_by: [] },
                    });
                return undefined;
            };
            model = { calls: [], answer: function (_e) { return ANSWERED(); } };
            on('model.complete', function (_, e) {
                model.calls.push(e);
                return { value: model.answer(e) };
            });
            submits = [];
            on('prompt.submit', function (_, e) {
                submits.push(e);
                return { text: e.text };
            });
            return [2 /*return*/, __assign(__assign({}, w), { plane: plane, model: model, submits: submits, state: state, writes: writes, nextRows: function () { var _a; return ((_a = state.get('next')) !== null && _a !== void 0 ? _a : []); }, nextIds: function () { var _a; return ((_a = state.get('next')) !== null && _a !== void 0 ? _a : []).map(function (r) { return r.id; }); }, started: function () { return w.seen.tools.filter(function (e) { return e.tool === START_SESSION; }); }, listed: function (tool) {
                        return plane.calls.filter(function (e) { return e.tool === tool && e.action === 'list'; });
                    }, related: function (id) {
                        return plane.calls.filter(function (e) { return e.tool === PLANE_RELATIONS && e.action === 'list' && e.workitem_id === id; });
                    } })];
        });
    });
}
function loadPilot($, w) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, slash($, 'pilot')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, w.clock.settle()];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function mountNext($, w) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, $.ui.mount({
                    plugin: 'rstack',
                    surface: 'desktop',
                    component: 'Pane',
                    requestId: w.seen.opened[0],
                    props: PILOT_PANE_PROPS,
                })];
        });
    });
}
function pressLabelled(ui, label) {
    return __awaiter(this, void 0, void 0, function () {
        var buttons, button;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, ui.findAll({ type: 'Button' })];
                case 1:
                    buttons = _a.sent();
                    button = buttons.find(function (b) { return JSON.stringify(b).includes(label); });
                    (0, testing_1.expect)(button).toBeDefined();
                    return [4 /*yield*/, ui.press({ key: button.key })];
                case 2:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
var NO_CONFIG_CASES = [
    { name: 'no pilot.json', files: {}, dirs: ["".concat(MAIN, "/.rstack")] },
    { name: 'neither .rstack/ nor .rs/', files: {}, dirs: [] },
    {
        name: 'a pilot.json with no plane.project',
        files: (_b = {}, _b["".concat(MAIN, "/.rstack/pilot.json")] = '{}', _b),
        dirs: ["".concat(MAIN, "/.rstack")],
    },
    {
        name: 'only a .rs/pilot.json while .rstack/ exists',
        files: (_c = {}, _c["".concat(MAIN, "/.rs/pilot.json")] = PLANE_CONFIG, _c),
        dirs: ["".concat(MAIN, "/.rstack")],
    },
    {
        name: 'a pilot.json in another worktree than the main checkout',
        files: { '/work/a/.rstack/pilot.json': PLANE_CONFIG },
        dirs: ["".concat(MAIN, "/.rstack"), '/work/a/.rstack'],
    },
];
var _loop_8 = function (c) {
    (0, testing_1.test)("pilot-next AC1 \u2014 ".concat(c.name, ": no Plane tool is called and rstack.next is empty"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var w;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, planeWorld(on, { files: __assign({}, c.files), dirs: __spreadArray([], c.dirs, true) })];
                case 1:
                    w = _a.sent();
                    return [4 /*yield*/, loadPilot($, w)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, w.clock.advance(120000)];
                case 3:
                    _a.sent();
                    (0, testing_1.expect)(w.seen.polls).toBeGreaterThan(0);
                    (0, testing_1.expect)(w.writes).toContain('tickets');
                    (0, testing_1.expect)(w.plane.calls).toHaveLength(0);
                    (0, testing_1.expect)(w.nextRows()).toEqual([]);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _x = 0, NO_CONFIG_CASES_1 = NO_CONFIG_CASES; _x < NO_CONFIG_CASES_1.length; _x++) {
    var c = NO_CONFIG_CASES_1[_x];
    _loop_8(c);
}
(0, testing_1.test)('pilot-next AC1 — with .rs/pilot.json and no .rstack/, the config is read and Plane is asked', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, planeWorld(on, {
                    files: (_a = {}, _a["".concat(MAIN, "/.rs/pilot.json")] = PLANE_CONFIG, _a),
                    dirs: [],
                })];
            case 1:
                w = _b.sent();
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _b.sent();
                (0, testing_1.expect)(w.listed(PLANE_ITEMS).length).toBeGreaterThan(0);
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-1', 'SPOTIME-2']);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC2 — the work items read leaves epics out: its PQL filter holds NOT isEpic()', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, reads, _i, reads_1, read;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, CONFIGURED)];
            case 1:
                w = _a.sent();
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                reads = w.listed(PLANE_ITEMS);
                (0, testing_1.expect)(reads.length).toBeGreaterThan(0);
                for (_i = 0, reads_1 = reads; _i < reads_1.length; _i++) {
                    read = reads_1[_i];
                    (0, testing_1.expect)(read.pql).toContain('NOT isEpic()');
                }
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC5 — a summary is asked from haiku once per (id, updated_at): not again for the same one, again for a changed one', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: [planeItem(1)] }))];
            case 1:
                w = _c.sent();
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _c.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(1);
                (0, testing_1.expect)(w.model.calls[0]).toMatchObject({ model: 'haiku' });
                (0, testing_1.expect)(w.model.calls[0].prompt).toContain('Ticket 1');
                (0, testing_1.expect)(w.model.calls[0].prompt).toContain('Description of ticket 1.');
                (0, testing_1.expect)((_a = w.nextRows()[0]) === null || _a === void 0 ? void 0 : _a.summary).toBe(SUMMARY);
                return [4 /*yield*/, w.clock.advance(50000)];
            case 3:
                _c.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(1);
                w.plane.items = [planeItem(1, { updated_at: '2026-11-21T10:00:00Z' })];
                return [4 /*yield*/, w.clock.advance(30000)];
            case 4:
                _c.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(2);
                return [4 /*yield*/, w.clock.advance(30000)];
            case 5:
                _c.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(2);
                (0, testing_1.expect)((_b = w.nextRows()[0]) === null || _b === void 0 ? void 0 : _b.summary).toBe(SUMMARY);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC5 — a call that is not answered leaves the row without a summary and is made again at the next poll', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: [planeItem(1)] }))];
            case 1:
                w = _d.sent();
                w.model.answer = function () { return ({
                    isAnswered: false,
                    reason: 'api-error',
                    status: 529,
                    error: 'overloaded',
                    usage: USAGE,
                }); };
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _d.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(1);
                (0, testing_1.expect)(w.nextRows()).toHaveLength(1);
                (0, testing_1.expect)((_a = w.nextRows()[0]) === null || _a === void 0 ? void 0 : _a.summary).toBeUndefined();
                return [4 /*yield*/, w.clock.advance(10000)];
            case 3:
                _d.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(2);
                (0, testing_1.expect)((_b = w.nextRows()[0]) === null || _b === void 0 ? void 0 : _b.summary).toBeUndefined();
                w.model.answer = ANSWERED;
                return [4 /*yield*/, w.clock.advance(10000)];
            case 4:
                _d.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(3);
                (0, testing_1.expect)((_c = w.nextRows()[0]) === null || _c === void 0 ? void 0 : _c.summary).toBe(SUMMARY);
                return [4 /*yield*/, w.clock.advance(10000)];
            case 5:
                _d.sent();
                (0, testing_1.expect)(w.model.calls).toHaveLength(3);
                return [2 /*return*/];
        }
    });
}); });
var SIX = [1, 2, 3, 4, 5, 6].map(function (n) { return planeItem(n); });
(0, testing_1.test)('pilot-next AC6 — pressing Lancer starts the session once with the ticket, and the row leaves for the next candidate', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, ui, started;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: SIX }))];
            case 1:
                w = _a.sent();
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-1', 'SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5']);
                return [4 /*yield*/, mountNext($, w)];
            case 3:
                ui = _a.sent();
                return [4 /*yield*/, pressLabelled(ui, 'Lancer')];
            case 4:
                _a.sent();
                return [4 /*yield*/, w.clock.settle()];
            case 5:
                _a.sent();
                started = w.started();
                (0, testing_1.expect)(started).toHaveLength(1);
                (0, testing_1.expect)(started[0]).toMatchObject({
                    initiation: 'user_asked',
                    context: 'fresh',
                    use_worktree: true,
                    branch_name: 'spotime-1',
                    title: 'SPOTIME-1 — Ticket 1',
                });
                (0, testing_1.expect)(started[0].prompt.startsWith('/rs-plan SPOTIME-1 — Ticket 1')).toBe(true);
                (0, testing_1.expect)(started[0].prompt).toContain('Description of ticket 1.');
                (0, testing_1.expect)(started[0].background.length).toBeGreaterThanOrEqual(80);
                (0, testing_1.expect)(w.submits).toHaveLength(0);
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6']);
                // Plane still lists it unstarted: the pane remembers it was launched.
                return [4 /*yield*/, w.clock.advance(120000)];
            case 6:
                // Plane still lists it unstarted: the pane remembers it was launched.
                _a.sent();
                (0, testing_1.expect)(w.nextIds()).not.toContain('SPOTIME-1');
                (0, testing_1.expect)(w.started()).toHaveLength(1);
                return [4 /*yield*/, ui.unmount()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC6 — a start_session still pending: the row has already left rstack.next and a second press on it starts nothing more', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, release, gate, ui, buttons, lancer, first, second;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: SIX }))];
            case 1:
                w = _a.sent();
                release = function () { };
                gate = new Promise(function (resolve) { return (release = resolve); });
                w.plane.start = function () { return gate.then(function () { return ({ result: {}, text: '{}' }); }); };
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                return [4 /*yield*/, mountNext($, w)];
            case 3:
                ui = _a.sent();
                return [4 /*yield*/, ui.findAll({ type: 'Button' })];
            case 4:
                buttons = _a.sent();
                lancer = buttons.find(function (b) { return JSON.stringify(b).includes('Lancer'); });
                (0, testing_1.expect)(lancer).toBeDefined();
                first = ui.press({ key: lancer.key }).catch(function () { return undefined; });
                return [4 /*yield*/, w.clock.settle()];
            case 5:
                _a.sent();
                (0, testing_1.expect)(w.started()).toHaveLength(1);
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6']);
                second = ui.press({ key: lancer.key }).catch(function () { return undefined; });
                return [4 /*yield*/, w.clock.settle()];
            case 6:
                _a.sent();
                (0, testing_1.expect)(w.started()).toHaveLength(1);
                release();
                return [4 /*yield*/, Promise.all([first, second])];
            case 7:
                _a.sent();
                return [4 /*yield*/, w.clock.settle()];
            case 8:
                _a.sent();
                (0, testing_1.expect)(w.started()).toHaveLength(1);
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6']);
                return [4 /*yield*/, ui.unmount()];
            case 9:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC2 — every page of the work items is read, the cursor sent back, and every read carries the id of the configured project', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, reads, projectReads, _i, projectReads_1, read, _a, _b, id;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, planeWorld(on, CONFIGURED)];
            case 1:
                w = _c.sent();
                w.plane.pages = [[planeItem(1), planeItem(2)], [planeItem(3)]];
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _c.sent();
                reads = w.listed(PLANE_ITEMS);
                (0, testing_1.expect)(reads).toHaveLength(2);
                (0, testing_1.expect)(reads[0].cursor || undefined).toBeUndefined();
                (0, testing_1.expect)(reads[1].cursor).toBe('cur-1');
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-1', 'SPOTIME-2', 'SPOTIME-3']);
                projectReads = w.plane.calls.filter(function (e) { return e.tool !== PLANE_PROJECT; });
                (0, testing_1.expect)(projectReads.length).toBeGreaterThan(0);
                for (_i = 0, projectReads_1 = projectReads; _i < projectReads_1.length; _i++) {
                    read = projectReads_1[_i];
                    (0, testing_1.expect)(read.project_id).toBe('proj-1');
                }
                // One relations read per item of both pages.
                for (_a = 0, _b = ['w1', 'w2', 'w3']; _a < _b.length; _a++) {
                    id = _b[_a];
                    (0, testing_1.expect)(w.related(id)).toHaveLength(1);
                }
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC8 — a relations read failing after a good poll: rstack.next stays and the item blocked by an open one is not listed', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, before, polled;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: [planeItem(1), planeItem(2)] }))];
            case 1:
                w = _a.sent();
                w.plane.relations = {
                    w1: { blocking: [{ id: 'w2', sequence_id: 2, project_id: 'proj-1', state_id: 's-unstarted' }], blocked_by: [] },
                    w2: { blocking: [], blocked_by: [{ id: 'w1', sequence_id: 1, project_id: 'proj-1', state_id: 's-unstarted' }] },
                };
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                before = w.nextRows();
                (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-1']);
                polled = w.writes.filter(function (k) { return k === 'polledAt'; }).length;
                w.plane.fail = function (e) {
                    return e.tool === PLANE_RELATIONS && e.workitem_id === 'w2'
                        ? { result: 'error', text: 'boom', isError: true }
                        : undefined;
                };
                // Past the 5 minutes its relations are kept.
                return [4 /*yield*/, w.clock.advance(320000)];
            case 3:
                // Past the 5 minutes its relations are kept.
                _a.sent();
                (0, testing_1.expect)(w.related('w2').length).toBeGreaterThan(1);
                (0, testing_1.expect)(w.nextRows()).toEqual(before);
                (0, testing_1.expect)(w.nextIds()).not.toContain('SPOTIME-2');
                (0, testing_1.expect)(w.writes.filter(function (k) { return k === 'polledAt'; }).length).toBeGreaterThan(polled);
                return [2 /*return*/];
        }
    });
}); });
var REFUSALS = [
    { name: 'denied', answer: { deny: 'Not allowed from a pane' }, reason: 'Not allowed from a pane' },
    {
        name: 'answering an error',
        answer: { result: 'error', text: 'start_session blew up', isError: true },
        reason: 'start_session blew up',
    },
];
var _loop_9 = function (refusal) {
    (0, testing_1.test)("pilot-next AC7 \u2014 start_session ".concat(refusal.name, ": the pilot session is asked to start it with the same prompt and told the refusal, and the row leaves"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var w, ui, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: SIX }))];
                case 1:
                    w = _a.sent();
                    w.plane.start = function () { return refusal.answer; };
                    return [4 /*yield*/, loadPilot($, w)];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, mountNext($, w)];
                case 3:
                    ui = _a.sent();
                    return [4 /*yield*/, pressLabelled(ui, 'Lancer')];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, w.clock.settle()];
                case 5:
                    _a.sent();
                    (0, testing_1.expect)(w.started()).toHaveLength(1);
                    (0, testing_1.expect)(w.submits).toHaveLength(1);
                    text = w.submits[0].text;
                    (0, testing_1.expect)(text).toContain('/rs-plan SPOTIME-1 — Ticket 1');
                    (0, testing_1.expect)(text).toContain('Description of ticket 1.');
                    (0, testing_1.expect)(text).toContain(refusal.reason);
                    (0, testing_1.expect)(w.nextIds()).toEqual(['SPOTIME-2', 'SPOTIME-3', 'SPOTIME-4', 'SPOTIME-5', 'SPOTIME-6']);
                    return [4 /*yield*/, ui.unmount()];
                case 6:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _y = 0, REFUSALS_1 = REFUSALS; _y < REFUSALS_1.length; _y++) {
    var refusal = REFUSALS_1[_y];
    _loop_9(refusal);
}
var PLANE_FAILURES = [
    { name: 'denied', answer: { deny: 'no' } },
    { name: 'an error', answer: { result: 'error', text: 'boom', isError: true } },
    { name: 'an unparsable answer', answer: { result: {}, text: '<html>not json</html>' } },
];
var _loop_10 = function (failure) {
    (0, testing_1.test)("pilot-next AC8 \u2014 the work items read ".concat(failure.name, ": the last list stays in rstack.next and the poll goes on"), function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
        var w, before, polled;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, planeWorld(on, __assign(__assign({}, CONFIGURED), { items: SIX }))];
                case 1:
                    w = _a.sent();
                    return [4 /*yield*/, loadPilot($, w)];
                case 2:
                    _a.sent();
                    before = w.nextRows();
                    (0, testing_1.expect)(before).toHaveLength(5);
                    polled = w.writes.filter(function (k) { return k === 'polledAt'; }).length;
                    w.plane.fail = function (e) {
                        return e.tool === PLANE_ITEMS && e.action === 'list' ? failure.answer : undefined;
                    };
                    return [4 /*yield*/, w.clock.advance(70000)];
                case 3:
                    _a.sent();
                    (0, testing_1.expect)(w.listed(PLANE_ITEMS).length).toBeGreaterThan(1);
                    (0, testing_1.expect)(w.nextRows()).toEqual(before);
                    (0, testing_1.expect)(w.writes.filter(function (k) { return k === 'polledAt'; }).length).toBeGreaterThan(polled);
                    return [2 /*return*/];
            }
        });
    }); });
};
for (var _z = 0, PLANE_FAILURES_1 = PLANE_FAILURES; _z < PLANE_FAILURES_1.length; _z++) {
    var failure = PLANE_FAILURES_1[_z];
    _loop_10(failure);
}
(0, testing_1.test)('pilot-next AC9 — work items are read at most every 60 s, the states once, the relations of an item at most every 5 minutes', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, reads;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, CONFIGURED)];
            case 1:
                w = _a.sent();
                reads = function () { return ({
                    items: w.listed(PLANE_ITEMS).length,
                    states: w.listed(PLANE_STATE).length,
                    first: w.related('w1').length,
                    second: w.related('w2').length,
                }); };
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                (0, testing_1.expect)(reads()).toEqual({ items: 1, states: 1, first: 1, second: 1 });
                return [4 /*yield*/, w.clock.advance(50000)];
            case 3:
                _a.sent();
                (0, testing_1.expect)(reads()).toEqual({ items: 1, states: 1, first: 1, second: 1 });
                return [4 /*yield*/, w.clock.advance(20000)];
            case 4:
                _a.sent();
                (0, testing_1.expect)(reads()).toEqual({ items: 2, states: 1, first: 1, second: 1 });
                return [4 /*yield*/, w.clock.advance(220000)];
            case 5:
                _a.sent();
                (0, testing_1.expect)(reads().states).toBe(1);
                (0, testing_1.expect)(reads().first).toBe(1);
                (0, testing_1.expect)(reads().second).toBe(1);
                return [4 /*yield*/, w.clock.advance(30000)];
            case 6:
                _a.sent();
                (0, testing_1.expect)(reads().states).toBe(1);
                (0, testing_1.expect)(reads().first).toBe(2);
                (0, testing_1.expect)(reads().second).toBe(2);
                return [2 /*return*/];
        }
    });
}); });
(0, testing_1.test)('pilot-next AC9 — Actualiser reads the work items, the states and every relation again at once', function ($, on) { return __awaiter(void 0, void 0, void 0, function () {
    var w, ui;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, planeWorld(on, CONFIGURED)];
            case 1:
                w = _a.sent();
                return [4 /*yield*/, loadPilot($, w)];
            case 2:
                _a.sent();
                return [4 /*yield*/, mountNext($, w)];
            case 3:
                ui = _a.sent();
                return [4 /*yield*/, w.clock.set(3000)];
            case 4:
                _a.sent();
                return [4 /*yield*/, pressLabelled(ui, 'Actualiser')];
            case 5:
                _a.sent();
                return [4 /*yield*/, w.clock.settle()];
            case 6:
                _a.sent();
                (0, testing_1.expect)(w.listed(PLANE_ITEMS)).toHaveLength(2);
                (0, testing_1.expect)(w.listed(PLANE_STATE)).toHaveLength(2);
                (0, testing_1.expect)(w.related('w1')).toHaveLength(2);
                (0, testing_1.expect)(w.related('w2')).toHaveLength(2);
                return [4 /*yield*/, ui.unmount()];
            case 7:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
