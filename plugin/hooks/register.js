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
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = void 0;
var collect_1 = require("./collect");
var next_1 = require("./next");
var tickets_1 = require("./tickets");
var PANE = 'pilot';
var MARK = 'pilot';
var OPEN_SESSION = 'mcp__ccd_window__open_session_in';
var START_SESSION = 'mcp__ccd_session__start_session';
var POLL_MS = 10000;
var PR_MS = 60000;
var ITEMS_MS = 60000;
var RELATIONS_MS = 300000;
var tickets = { plugin: 'rstack', key: 'tickets' };
var polledAt = { plugin: 'rstack', key: 'polledAt' };
var main = { plugin: 'rstack', key: 'main' };
var nextKey = { plugin: 'rstack', key: 'next' };
// Per branch: the last `gh` or `glab` answer and when it was asked. A PR read MERGED or
// CLOSED is final: it is not asked again.
var prs = new Map();
var timer;
var plane = { relations: new Map() };
// The ids launched from the pane, which Plane may still list as unstarted.
var launched = new Set();
// What the last build of the list rests on, so a launch can rebuild it at once.
var known;
var planeBusy = false;
function prOf($, worktree, branch) {
    return __awaiter(this, void 0, void 0, function () {
        var now, known, finished, _a, result, parse, pr;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0: return [4 /*yield*/, $.clock.now()];
                case 1:
                    now = _d.sent();
                    known = prs.get(branch);
                    finished = ((_b = known === null || known === void 0 ? void 0 : known.pr) === null || _b === void 0 ? void 0 : _b.state) === 'MERGED' || ((_c = known === null || known === void 0 ? void 0 : known.pr) === null || _c === void 0 ? void 0 : _c.state) === 'CLOSED';
                    if (known && (finished || now - known.at < PR_MS))
                        return [2 /*return*/, known.pr];
                    return [4 /*yield*/, (0, collect_1.readPr)($, worktree, branch)];
                case 2:
                    _a = _d.sent(), result = _a.result, parse = _a.parse;
                    pr = parse(result);
                    prs.set(branch, { at: now, pr: pr });
                    return [2 /*return*/, pr];
            }
        });
    });
}
function poll($) {
    return __awaiter(this, void 0, void 0, function () {
        var collectedAt, porcelain, files, sessions, listed, _a, questions, rows, _i, listed_1, ticket, review, state, pr, _b, _c, id, name_1, spec;
        var _d;
        var _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0: return [4 /*yield*/, $.clock.now()];
                case 1:
                    collectedAt = _l.sent();
                    return [4 /*yield*/, (0, collect_1.readWorktrees)($)];
                case 2:
                    porcelain = _l.sent();
                    return [4 /*yield*/, (0, collect_1.readFiles)($, (0, tickets_1.worktreePaths)(porcelain))];
                case 3:
                    files = _l.sent();
                    return [4 /*yield*/, (0, collect_1.readSessions)($)];
                case 4:
                    sessions = _l.sent();
                    _a = tickets_1.listTickets;
                    _d = {
                        worktrees: porcelain,
                        files: files,
                        sessions: sessions
                    };
                    return [4 /*yield*/, (0, collect_1.readSelf)($)];
                case 5:
                    listed = _a.apply(void 0, [(_d.self = _l.sent(),
                            _d)]);
                    return [4 /*yield*/, (0, collect_1.readQuestions)($)];
                case 6:
                    questions = _l.sent();
                    rows = [];
                    _i = 0, listed_1 = listed;
                    _l.label = 7;
                case 7:
                    if (!(_i < listed_1.length)) return [3 /*break*/, 12];
                    ticket = listed_1[_i];
                    review = (0, tickets_1.parseReview)((_e = files[ticket.worktree]) === null || _e === void 0 ? void 0 : _e["".concat(ticket.slug, ".review.md")]);
                    state = (0, tickets_1.deriveState)(ticket, { review: review, questions: questions });
                    if (!(state.kind === 'shipped' && ticket.branch)) return [3 /*break*/, 9];
                    return [4 /*yield*/, prOf($, ticket.worktree, ticket.branch)];
                case 8:
                    _b = _l.sent();
                    return [3 /*break*/, 10];
                case 9:
                    _b = undefined;
                    _l.label = 10;
                case 10:
                    pr = _b;
                    if ((pr === null || pr === void 0 ? void 0 : pr.state) === 'MERGED' || (pr === null || pr === void 0 ? void 0 : pr.state) === 'CLOSED')
                        return [3 /*break*/, 11];
                    _c = (0, tickets_1.ticketId)(ticket.title, (_g = (_f = ticket.slug) !== null && _f !== void 0 ? _f : ticket.worktree.split('/').pop()) !== null && _g !== void 0 ? _g : ticket.worktree), id = _c.id, name_1 = _c.name;
                    spec = (_h = files[ticket.worktree]) === null || _h === void 0 ? void 0 : _h["".concat(ticket.slug, ".md")];
                    rows.push(__assign(__assign({}, ticket), { id: id, name: name_1, section: (0, tickets_1.sectionOf)(state.kind), step: (0, tickets_1.stepOf)(ticket.status), since: (0, tickets_1.waitingSince)({ state: state, session: ticket.session }), facts: spec === undefined ? undefined : (0, tickets_1.planFacts)(spec), state: state, review: review, pr: pr }));
                    _l.label = 11;
                case 11:
                    _i++;
                    return [3 /*break*/, 7];
                case 12: return [4 /*yield*/, $.state.set(main, (_k = (_j = (0, tickets_1.worktreePaths)(porcelain)[0]) === null || _j === void 0 ? void 0 : _j.split('/').pop()) !== null && _k !== void 0 ? _k : '')];
                case 13:
                    _l.sent();
                    return [4 /*yield*/, $.state.set(tickets, JSON.parse(JSON.stringify(rows)))];
                case 14:
                    _l.sent();
                    return [4 /*yield*/, $.state.set(polledAt, collectedAt)];
                case 15:
                    _l.sent();
                    return [4 /*yield*/, pollPlane($, porcelain, listed, sessions).catch(function () { return undefined; })];
                case 16:
                    _l.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// The summary of a candidate: kept per (id, updated_at), else asked from Haiku.
// A call that is not answered leaves none, and is made again at the next poll.
function summaryOf($, candidate) {
    return __awaiter(this, void 0, void 0, function () {
        var key, kept, answer, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    key = (0, next_1.summaryKey)(candidate.id, candidate.updatedAt);
                    return [4 /*yield*/, $.store.get(key)];
                case 1:
                    kept = _a.sent();
                    if (typeof kept === 'string')
                        return [2 /*return*/, kept];
                    return [4 /*yield*/, $.model.complete({
                            model: 'haiku',
                            prompt: (0, next_1.summaryPrompt)(candidate.name, candidate.description),
                            maxTokens: 200,
                        })];
                case 2:
                    answer = _a.sent();
                    text = answer.isAnswered ? answer.text.trim() : '';
                    if (text === '')
                        return [2 /*return*/, undefined];
                    return [4 /*yield*/, $.store.set(key, text)];
                case 3:
                    _a.sent();
                    return [2 /*return*/, text];
            }
        });
    });
}
// The 5 rows from the known candidates, the ids at work and the launched ones.
function publishNext($) {
    return __awaiter(this, void 0, void 0, function () {
        var excluded, rows, _i, _a, candidate, _b, _c;
        var _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    if (!known)
                        return [2 /*return*/];
                    excluded = (0, next_1.excludedIds)(known.tickets, known.paths, known.sessions, launched);
                    rows = [];
                    _i = 0, _a = (0, next_1.rankNext)(known.pool, excluded);
                    _e.label = 1;
                case 1:
                    if (!(_i < _a.length)) return [3 /*break*/, 4];
                    candidate = _a[_i];
                    _c = (_b = rows).push;
                    _d = {
                        id: candidate.id,
                        name: candidate.name
                    };
                    return [4 /*yield*/, summaryOf($, candidate).catch(function () { return undefined; })];
                case 2:
                    _c.apply(_b, [(_d.summary = _e.sent(),
                            _d.unblocks = candidate.unblocks,
                            _d.workitemId = candidate.workitemId,
                            _d.updatedAt = candidate.updatedAt,
                            _d)]);
                    _e.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [4 /*yield*/, $.state.set(nextKey, JSON.parse(JSON.stringify(rows)))];
                case 5:
                    _e.sent();
                    return [2 /*return*/];
            }
        });
    });
}
// Reads Plane at its own cadence. A read that fails leaves the last list as it
// is: what was read stays cached, the rest is asked again at the next poll.
function pollPlane($, porcelain, listed, sessions) {
    return __awaiter(this, void 0, void 0, function () {
        var paths, config, now, _a, _b, _c, _d, list, relations, _i, _e, item, kept, fresh;
        var _f, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    paths = (0, tickets_1.worktreePaths)(porcelain);
                    return [4 /*yield*/, (0, collect_1.readPlaneConfig)($, (_f = paths[0]) !== null && _f !== void 0 ? _f : '')];
                case 1:
                    config = _j.sent();
                    if (!!config) return [3 /*break*/, 3];
                    known = undefined;
                    return [4 /*yield*/, $.state.set(nextKey, [])];
                case 2:
                    _j.sent();
                    return [2 /*return*/];
                case 3:
                    if (planeBusy)
                        return [2 /*return*/];
                    planeBusy = true;
                    _j.label = 4;
                case 4:
                    _j.trys.push([4, , 20, 21]);
                    return [4 /*yield*/, $.clock.now()];
                case 5:
                    now = _j.sent();
                    if (!((_g = plane.project) !== null && _g !== void 0)) return [3 /*break*/, 6];
                    _a = _g;
                    return [3 /*break*/, 8];
                case 6:
                    _b = plane;
                    return [4 /*yield*/, (0, collect_1.readProject)($, config.project)];
                case 7:
                    _a = (_b.project = _j.sent());
                    _j.label = 8;
                case 8:
                    _a;
                    if (plane.project === undefined)
                        return [2 /*return*/];
                    if (!((_h = plane.states) !== null && _h !== void 0)) return [3 /*break*/, 9];
                    _c = _h;
                    return [3 /*break*/, 11];
                case 9:
                    _d = plane;
                    return [4 /*yield*/, (0, collect_1.readStates)($, plane.project)];
                case 10:
                    _c = (_d.states = _j.sent());
                    _j.label = 11;
                case 11:
                    _c;
                    if (plane.states === undefined)
                        return [2 /*return*/];
                    if (!(!plane.items || now - plane.items.at >= ITEMS_MS)) return [3 /*break*/, 13];
                    return [4 /*yield*/, (0, collect_1.readWorkItems)($, plane.project)];
                case 12:
                    list = _j.sent();
                    if (list === undefined)
                        return [2 /*return*/];
                    plane.items = { at: now, list: list };
                    _j.label = 13;
                case 13:
                    relations = {};
                    _i = 0, _e = plane.items.list;
                    _j.label = 14;
                case 14:
                    if (!(_i < _e.length)) return [3 /*break*/, 18];
                    item = _e[_i];
                    kept = plane.relations.get(item.id);
                    if (!(!kept || now - kept.at >= RELATIONS_MS)) return [3 /*break*/, 16];
                    return [4 /*yield*/, (0, collect_1.readRelations)($, plane.project, item.id)];
                case 15:
                    fresh = _j.sent();
                    if (fresh === undefined)
                        return [2 /*return*/];
                    kept = { at: now, relations: fresh };
                    plane.relations.set(item.id, kept);
                    _j.label = 16;
                case 16:
                    relations[item.id] = kept.relations;
                    _j.label = 17;
                case 17:
                    _i++;
                    return [3 /*break*/, 14];
                case 18:
                    known = {
                        pool: (0, next_1.candidates)(plane.items.list, relations, plane.states, config.project),
                        tickets: listed,
                        paths: paths,
                        sessions: sessions,
                    };
                    return [4 /*yield*/, publishNext($)];
                case 19:
                    _j.sent();
                    return [3 /*break*/, 21];
                case 20:
                    planeBusy = false;
                    return [7 /*endfinally*/];
                case 21: return [2 /*return*/];
            }
        });
    });
}
// Starts the session of a ticket. Refused from the pane, the pilot session is
// asked to start it, and to report the refusal as a pane defect.
function launch($, row) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, shown, description, args, starting, answer, reason;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (launched.has(row.id))
                        return [2 /*return*/];
                    launched.add(row.id);
                    return [4 /*yield*/, $.state.get(nextKey)];
                case 1:
                    _a = (_f.sent()).value, shown = _a === void 0 ? [] : _a;
                    return [4 /*yield*/, $.state.set(nextKey, shown.filter(function (r) { return r.id !== row.id; }))];
                case 2:
                    _f.sent();
                    description = (_c = (_b = known === null || known === void 0 ? void 0 : known.pool.find(function (c) { return c.workitemId === row.workitemId; })) === null || _b === void 0 ? void 0 : _b.description) !== null && _c !== void 0 ? _c : '';
                    args = (0, next_1.startArgs)(row, description);
                    starting = $.tool
                        .call(__assign({ tool: START_SESSION }, args))
                        .catch(function (error) { return ({ isError: true, text: String(error), deny: undefined }); });
                    // The next candidate takes its place while the app starts the session.
                    return [4 /*yield*/, publishNext($)];
                case 3:
                    // The next candidate takes its place while the app starts the session.
                    _f.sent();
                    return [4 /*yield*/, starting];
                case 4:
                    answer = _f.sent();
                    if (!(answer.deny !== undefined || answer.isError === true)) return [3 /*break*/, 6];
                    reason = (_e = (_d = answer.deny) !== null && _d !== void 0 ? _d : answer.text) !== null && _e !== void 0 ? _e : 'no reason given';
                    return [4 /*yield*/, $.prompt.submit({
                            text: "The rstack pilot pane could not start the session of ".concat(row.id, ": ") +
                                "`".concat(START_SESSION, "` was refused with \"").concat(reason, "\". ") +
                                "Start that session yourself with this input:\n\n".concat(JSON.stringify(args, null, 2), "\n\n") +
                                "Then report the refusal and its reason to the user as a pane defect to fix.",
                        })];
                case 5:
                    _f.sent();
                    _f.label = 6;
                case 6: return [2 /*return*/];
            }
        });
    });
}
function startPolling($, id) {
    return __awaiter(this, void 0, void 0, function () {
        var tick;
        var _this = this;
        return __generator(this, function (_a) {
            timer === null || timer === void 0 ? void 0 : timer.cancel();
            plane = { relations: new Map() };
            launched.clear();
            known = undefined;
            tick = function () { return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, $.store.get(MARK)];
                        case 1:
                            if (!((_a.sent()) !== id)) return [3 /*break*/, 3];
                            timer === null || timer === void 0 ? void 0 : timer.cancel();
                            return [4 /*yield*/, $.ui.close({ id: PANE })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                        case 3: return [4 /*yield*/, poll($)];
                        case 4:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); };
            timer = $.clock.every(POLL_MS, function () { return void tick().catch(function () { return undefined; }); });
            void tick().catch(function () { return undefined; });
            return [2 /*return*/];
        });
    });
}
function openPane($) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, $.ui.open({ id: PANE, title: 'Pilot' })];
                case 1:
                    _c.sent();
                    _a = startPolling;
                    _b = [$];
                    return [4 /*yield*/, $.session.id()];
                case 2: return [4 /*yield*/, _a.apply(void 0, _b.concat([_c.sent()]))];
                case 3:
                    _c.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function openSession($, session) {
    return __awaiter(this, void 0, void 0, function () {
        var opened;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.tool
                        .call({ tool: OPEN_SESSION, session_id: session.sessionId, target: 'focus' })
                        .catch(function () { return undefined; })];
                case 1:
                    opened = _a.sent();
                    if (!(!opened || opened.deny !== undefined || opened.isError === true)) return [3 /*break*/, 3];
                    return [4 /*yield*/, $.process.run(['open', session.link])];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3: return [2 /*return*/];
            }
        });
    });
}
var register = function (on) {
    on('session.start', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.command.register({
                        name: 'pilot',
                        description: 'Show where every rstack ticket stands in a pane',
                    })];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, $.store.get(MARK)];
                case 2:
                    _a = (_b.sent());
                    return [4 /*yield*/, $.session.id()];
                case 3:
                    if (!(_a === (_b.sent()))) return [3 /*break*/, 5];
                    return [4 /*yield*/, openPane($)];
                case 4:
                    _b.sent();
                    _b.label = 5;
                case 5: return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('command.run', { command: 'pilot' }, function ($) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _b = (_a = $.store).set;
                    _c = [MARK];
                    return [4 /*yield*/, $.session.id()];
                case 1: return [4 /*yield*/, _b.apply(_a, _c.concat([_d.sent()]))];
                case 2:
                    _d.sent();
                    return [4 /*yield*/, openPane($)];
                case 3:
                    _d.sent();
                    return [2 /*return*/, { text: 'Pilot pane opened.' }];
            }
        });
    }); });
    on('tool.call', function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        var key, _a, _b, _c, _d, _e, _f;
        var _g;
        var _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    if (e.tool !== 'AskUserQuestion')
                        return [2 /*return*/, next(e)];
                    _b = (_a = "".concat(collect_1.QUESTION_PREFIX)).concat;
                    return [4 /*yield*/, $.session.id()];
                case 1:
                    key = _b.apply(_a, [_j.sent()]);
                    _d = (_c = $.store)
                        .set;
                    _e = [key];
                    _g = {};
                    _f = tickets_1.selfId;
                    return [4 /*yield*/, (0, collect_1.readSelf)($)];
                case 2:
                    _g.sessionId = _f.apply(void 0, [_j.sent()]),
                        _g.question = (_h = e.questions[0]) === null || _h === void 0 ? void 0 : _h.question;
                    return [4 /*yield*/, $.clock.now()];
                case 3: return [4 /*yield*/, _d.apply(_c, _e.concat([(_g.at = _j.sent(),
                            _g)]))
                        .catch(function () { return undefined; })];
                case 4:
                    _j.sent();
                    _j.label = 5;
                case 5:
                    _j.trys.push([5, , 7, 9]);
                    return [4 /*yield*/, next(e)];
                case 6: return [2 /*return*/, _j.sent()];
                case 7: return [4 /*yield*/, $.store.delete(key).catch(function () { return undefined; })];
                case 8:
                    _j.sent();
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); });
    on('ui.close', { id: PANE }, function ($, e, next) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!(e.origin.kind === 'person')) return [3 /*break*/, 2];
                    timer === null || timer === void 0 ? void 0 : timer.cancel();
                    return [4 /*yield*/, $.store.delete(MARK)];
                case 1:
                    _a.sent();
                    _a.label = 2;
                case 2: return [2 /*return*/, next(e)];
            }
        });
    }); });
    on('ui.render', { component: 'Pane', requestId: PANE }, function ($, e) { return __awaiter(void 0, void 0, void 0, function () {
        var _a, Box, Text, Button, Link, _b, rows, upNext, folder, collected, now, grouped, count, first, openable, nameOf, idOf, card, tile, line, hotkey;
        var _c, _d, _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    _a = $.ui.resolve(e), Box = _a.Box, Text = _a.Text, Button = _a.Button, Link = _a.Link;
                    return [4 /*yield*/, $.state.get(tickets)
                        // Rows that are not a PilotNext (an unset key, a stub answering one value
                        // to every key) are not drawn.
                    ];
                case 1:
                    _b = (_g.sent()).value, rows = _b === void 0 ? [] : _b;
                    return [4 /*yield*/, $.state.get(nextKey)];
                case 2:
                    upNext = ((_c = (_g.sent()).value) !== null && _c !== void 0 ? _c : []).filter(function (row) { return Array.isArray(row === null || row === void 0 ? void 0 : row.unblocks); });
                    return [4 /*yield*/, $.state.get(main)];
                case 3:
                    folder = (_g.sent()).value;
                    return [4 /*yield*/, $.state.get(polledAt)];
                case 4:
                    collected = (_g.sent()).value;
                    return [4 /*yield*/, $.clock.now()];
                case 5:
                    now = _g.sent();
                    grouped = (0, tickets_1.sections)(rows);
                    count = (0, tickets_1.counters)(rows);
                    if (e.props.placement === 'widget') {
                        first = (_d = grouped.find(function (g) { return g.id === 'toi'; })) === null || _d === void 0 ? void 0 : _d.rows[0];
                        return [2 /*return*/, (<Box flexDirection="column" gap={1}>
          <Box justifyContent="space-between">
            <Text weight="semibold">Pilot</Text>
            <Text color="inverseText" backgroundColor="warning">
              {" ".concat(count.toi, " \u00E0 toi ")}
            </Text>
          </Box>
          <Box gap={1}>
            {rows.map(function (row) { return (<Text key={"".concat(row.worktree, "/").concat(row.slug)} color={edgeOf(row)}>
                ■
              </Text>); })}
          </Box>
          <Text size="caption" dimColor>
            {first
                                    ? "".concat((_e = first.id) !== null && _e !== void 0 ? _e : first.name, " ").concat((_f = WAITS[first.state.kind]) !== null && _f !== void 0 ? _f : '').trim()
                                    : "Rien ne t'attend."}
          </Text>
        </Box>)];
                    }
                    openable = function (row) {
                        return row.session && !row.session.isPilot ? row.session : undefined;
                    };
                    nameOf = function (row, key) {
                        var session = openable(row);
                        return session ? (<Button key={"".concat(key, ":name")} plain onPress={function () { return void openSession($, session); }}>
          {row.name}
        </Button>) : (<Text weight="medium" wrap="truncate-end">
          {row.name}
        </Text>);
                    };
                    idOf = function (row) {
                        return row.id && (<Text mono dimColor>
          {row.id}
        </Text>);
                    };
                    card = function (key, edge, lines) { return (<Box key={key} borderStyle="single" borderColor="inactive">
        <Box width={1} backgroundColor={edge}/>
        <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} paddingX={1}>
          {lines}
        </Box>
      </Box>); };
                    tile = function (n, label, color) { return (<Box key={label} flexDirection="column" flexGrow={1} minWidth={12} paddingX={1} borderStyle="single" borderColor={color !== null && color !== void 0 ? color : 'inactive'}>
        <Text size="heading" weight="semibold" color={color}>
          {String(n)}
        </Text>
        <Text size="caption" color={color} dimColor={color === undefined}>
          {label}
        </Text>
      </Box>); };
                    line = function (left, right) { return (<Box justifyContent="space-between" gap={1}>
        <Box gap={1} flexShrink={1} minWidth={0} overflow="hidden">
          {left.filter(Boolean)}
        </Box>
        <Box gap={1} flexShrink={0}>
          {right.filter(Boolean)}
        </Box>
      </Box>); };
                    hotkey = 0;
                    return [2 /*return*/, (<Box flexDirection="column" gap={1}>
        <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box gap={1}>
            <Text weight="semibold">Pilot</Text>
            {typeof folder === 'string' && <Text dimColor>{folder}</Text>}
          </Box>
          <Box gap={1}>
            {typeof collected === 'number' && (<Text size="caption" dimColor>
                {"collecte \u00E0 ".concat(clock(collected))}
              </Text>)}
            <Button key="refresh" onPress={function () {
                                plane = { relations: new Map() };
                                void poll($).catch(function () { return undefined; });
                            }}>
              Actualiser
            </Button>
          </Box>
        </Box>
        <Box gap={1} flexWrap="wrap">
          {tile(count.toi, "t'attendent", 'warning')}
          {tile(count.dev, 'en dev')}
          {tile(count.review, 'en review')}
          {tile(count.pr, 'PR ouvertes')}
        </Box>
        {rows.length === 0 && <Text dimColor>Aucun ticket.</Text>}
        {grouped
                                .filter(function (section) { return section.count > 0; })
                                .map(function (section) { return (<Box key={section.id} flexDirection="column" gap={1}>
              <Text size="caption" dimColor>
                {SECTION_TITLES[section.id]}
              </Text>
              {section.id === 'pr' ? (<Box flexDirection="column" borderStyle="single" borderColor="inactive" paddingX={1}>
                  {section.rows.map(function (row, i) {
                                        var key = "".concat(row.worktree, "/").concat(row.slug);
                                        var pr = row.pr;
                                        var ci = pr && CI[pr.ci];
                                        return (<Box key={key} flexDirection="column">
                        {i > 0 && (<Text dimColor wrap="clip">
                            {'─'.repeat(Math.max(0, e.props.bodyColumns - 4))}
                          </Text>)}
                        {line([
                                                (pr === null || pr === void 0 ? void 0 : pr.number) !== undefined && (<Text mono dimColor>
                                {"".concat(pr.kind === 'mr' ? '!' : '#').concat(pr.number)}
                              </Text>),
                                                nameOf(row, key),
                                            ], [
                                                ci && <Text color={ci.color}>{"".concat(ci.icon, " CI")}</Text>,
                                                pr && (<Link href={pr.url}>{pr.kind === 'mr' ? 'MR' : 'PR'}</Link>),
                                            ])}
                      </Box>);
                                    })}
                </Box>) : (section.rows.map(function (row) {
                                    var key = "".concat(row.worktree, "/").concat(row.slug);
                                    var since = row.since !== undefined ? (0, tickets_1.elapsed)(row.since, now) : undefined;
                                    if (section.id === 'toi') {
                                        var session_1 = openable(row);
                                        var plan = row.state.kind === 'awaiting-plan-validation';
                                        var press = session_1 && hotkey < 9 ? (hotkey += 1) : undefined;
                                        return card(key, 'warning', <>
                        <Box gap={1} minWidth={0} overflow="hidden">
                          <Text color="warning">{plan ? '☑' : '?'}</Text>
                          {idOf(row)}
                          {nameOf(row, key)}
                        </Box>
                        <Text dimColor>{toiLine(row)}</Text>
                        <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
                          <Text size="caption" dimColor>
                            {since
                                                ? "depuis ".concat(since.n, " ").concat(since.unit === 'd' ? 'j' : since.unit)
                                                : ''}
                          </Text>
                          {session_1 && (<Button key={"".concat(key, ":action")} variant="secondary" hotkey={press === undefined ? undefined : String(press)} onPress={function () { return void openSession($, session_1); }}>
                              {plan ? 'Voir le plan' : 'Répondre'}
                            </Button>)}
                        </Box>
                      </>);
                                    }
                                    var color = edgeOf(row);
                                    return card(key, color, <>
                      {line([idOf(row), nameOf(row, key)], [<Text color={color}>{runningStatus(row)}</Text>])}
                      <Box gap={1}>
                        {(0, tickets_1.segments)(row.step).map(function (segment) { return (<Box key={segment.name} flexGrow={1} height={1} backgroundColor={segment.state === 'done'
                                                ? 'success'
                                                : segment.state === 'current'
                                                    ? color
                                                    : 'inactive'}/>); })}
                      </Box>
                    </>);
                                }))}
              {section.id === 'running' && (<Text size="caption" dimColor>
                  plan · rouge · vert · review · ship
                </Text>)}
            </Box>); })}
        {upNext.length > 0 && (<Box flexDirection="column" gap={1}>
            <Text size="caption" dimColor>
              {SECTION_TITLES.next}
            </Text>
            {upNext.map(function (row) {
                                    return card("next:".concat(row.id), 'inactive', <>
                  <Box gap={1} minWidth={0} overflow="hidden">
                    <Text mono dimColor>
                      {row.id}
                    </Text>
                    <Text weight="medium" wrap="truncate-end">
                      {row.name}
                    </Text>
                  </Box>
                  <Box>{row.summary && <Text dimColor>{row.summary}</Text>}</Box>
                  <Box justifyContent="space-between" flexWrap="wrap" gap={1}>
                    <Text size="caption" dimColor>
                      {row.unblocks.length > 0 ? "d\u00E9bloque ".concat(row.unblocks.join(', ')) : ''}
                    </Text>
                    <Button key={"next:".concat(row.id, ":launch")} variant="secondary" onPress={function () { return void launch($, row).catch(function () { return undefined; }); }}>
                      Lancer
                    </Button>
                  </Box>
                </>);
                                })}
          </Box>)}
      </Box>)];
            }
        });
    }); });
};
exports.register = register;
var SECTION_TITLES = { toi: 'À toi', running: 'En cours', pr: 'PR', next: 'À lancer' };
var LABELS = {
    'awaiting-answer': 'Réponse attendue',
    'awaiting-plan-validation': 'Plan à valider',
    'no-session': 'Pas de session',
};
var WAITS = {
    'awaiting-answer': 'attend une réponse',
    'awaiting-plan-validation': 'attend la validation du plan',
    'no-session': "n'a pas de session",
};
var CI = {
    passing: { icon: '✓', color: 'success' },
    pending: { icon: '◷', color: 'warning' },
    failing: { icon: '✕', color: 'error' },
};
// The color of a row's edge: by who has the ball, then by its step (plan,
// red, green, review, ship).
var STEP_COLORS = ['inactive', 'error', 'success', 'suggestion', 'inactive'];
function edgeOf(row) {
    var _a;
    if (row.section === 'toi')
        return 'warning';
    if (row.section === 'pr')
        return 'success';
    return (_a = STEP_COLORS[row.step - 1]) !== null && _a !== void 0 ? _a : 'inactive';
}
var plural = function (n, word) { return "".concat(n, " ").concat(word).concat(n === 1 ? '' : 's'); };
// The local time, HH:MM.
function clock(at) {
    var date = new Date(at);
    var two = function (n) { return String(n).padStart(2, '0'); };
    return "".concat(two(date.getHours()), ":").concat(two(date.getMinutes()));
}
// The line under a toi row's title: the question, else what the plan holds,
// else the state's label.
function toiLine(row) {
    var _a;
    var _b = row.state, kind = _b.kind, question = _b.question;
    if (question)
        return question;
    if (kind === 'awaiting-plan-validation' && row.facts) {
        return "Plan pr\u00EAt \u00B7 ".concat(plural(row.facts.criteria, 'critère'), " \u00B7 ").concat(plural(row.facts.files, 'fichier'));
    }
    return (_a = LABELS[kind]) !== null && _a !== void 0 ? _a : kind;
}
// The short status on the right of an En cours row.
function runningStatus(row) {
    var _a;
    var kind = row.state.kind;
    if (kind === 'no-spec')
        return 'pas de spec';
    if (kind === 'review' && row.review) {
        return "review ".concat(row.review.rounds, "/").concat(row.review.cap, " \u00B7 ").concat(row.review.fixes, " fix");
    }
    if (row.step === 2) {
        return row.facts ? "rouge \u00B7 ".concat(plural(row.facts.criteria, 'critère')) : 'rouge';
    }
    return (_a = ['plan en cours', '', 'vert · en dev', 'review', 'ship en cours'][row.step - 1]) !== null && _a !== void 0 ? _a : '';
}
