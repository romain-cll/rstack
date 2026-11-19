"use strict";
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
exports.QUESTION_PREFIX = exports.GET_SESSION = exports.LIST_SESSIONS = void 0;
exports.readWorktrees = readWorktrees;
exports.readFiles = readFiles;
exports.readSessions = readSessions;
exports.readSelf = readSelf;
exports.readQuestions = readQuestions;
exports.readPr = readPr;
var tickets_1 = require("./tickets");
exports.LIST_SESSIONS = 'mcp__ccd_session_mgmt__list_sessions';
exports.GET_SESSION = 'mcp__ccd_session_mgmt__get_session';
exports.QUESTION_PREFIX = 'question:';
function readWorktrees($) {
    return __awaiter(this, void 0, void 0, function () {
        var git;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.process.run(['git', 'worktree', 'list', '--porcelain'])];
                case 1:
                    git = _a.sent();
                    return [2 /*return*/, git.exitCode === 0 ? git.stdout : ''];
            }
        });
    });
}
// `.rstack/features/`, or `.rs/features/` when `.rstack/` is absent.
function readFeatures($, worktree) {
    return __awaiter(this, void 0, void 0, function () {
        var root, dir, files, entries, _i, entries_1, entry, text;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.fs.exists("".concat(worktree, "/.rstack"))];
                case 1:
                    root = (_a.sent()) ? '.rstack' : '.rs';
                    dir = "".concat(worktree, "/").concat(root, "/features");
                    files = {};
                    return [4 /*yield*/, $.fs.list(dir).catch(function () { return []; })];
                case 2:
                    entries = _a.sent();
                    _i = 0, entries_1 = entries;
                    _a.label = 3;
                case 3:
                    if (!(_i < entries_1.length)) return [3 /*break*/, 6];
                    entry = entries_1[_i];
                    if (entry.kind !== 'file' || !entry.name.endsWith('.md'))
                        return [3 /*break*/, 5];
                    return [4 /*yield*/, $.fs.read("".concat(dir, "/").concat(entry.name))];
                case 4:
                    text = _a.sent();
                    if (typeof text === 'string')
                        files[entry.name] = text;
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6: return [2 /*return*/, files];
            }
        });
    });
}
function readFiles($, worktrees) {
    return __awaiter(this, void 0, void 0, function () {
        var files, _i, worktrees_1, worktree, _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    files = {};
                    _i = 0, worktrees_1 = worktrees;
                    _c.label = 1;
                case 1:
                    if (!(_i < worktrees_1.length)) return [3 /*break*/, 4];
                    worktree = worktrees_1[_i];
                    _a = files;
                    _b = worktree;
                    return [4 /*yield*/, readFeatures($, worktree)];
                case 2:
                    _a[_b] = _c.sent();
                    _c.label = 3;
                case 3:
                    _i++;
                    return [3 /*break*/, 1];
                case 4: return [2 /*return*/, files];
            }
        });
    });
}
function readSessions($) {
    return __awaiter(this, void 0, void 0, function () {
        var listed;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, $.tool.call({ tool: exports.LIST_SESSIONS, limit: 100 })];
                case 1:
                    listed = _b.sent();
                    return [2 /*return*/, listed.deny === undefined && listed.isError !== true
                            ? ((_a = listed.text) !== null && _a !== void 0 ? _a : '[]')
                            : '[]'];
            }
        });
    });
}
// `list_sessions` leaves out the calling session: the pilot reads its own.
function readSelf($) {
    return __awaiter(this, void 0, void 0, function () {
        var own;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.tool
                        .call({ tool: exports.GET_SESSION, session_id: 'self' })
                        .catch(function () { return undefined; })];
                case 1:
                    own = _a.sent();
                    return [2 /*return*/, own && own.deny === undefined && own.isError !== true ? own.text : undefined];
            }
        });
    });
}
function readQuestions($) {
    return __awaiter(this, void 0, void 0, function () {
        var questions, _i, _a, key, value;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    questions = [];
                    _i = 0;
                    return [4 /*yield*/, $.store.keys()];
                case 1:
                    _a = _b.sent();
                    _b.label = 2;
                case 2:
                    if (!(_i < _a.length)) return [3 /*break*/, 5];
                    key = _a[_i];
                    if (!key.startsWith(exports.QUESTION_PREFIX))
                        return [3 /*break*/, 4];
                    return [4 /*yield*/, $.store.get(key)];
                case 3:
                    value = (_b.sent());
                    if (value)
                        questions.push(value);
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [2 /*return*/, questions];
            }
        });
    });
}
var FAILED_READ = { exitCode: 1, stdout: '' };
// The pull request or merge request of a branch, read with the tool of the
// forge the worktree's `origin` is on, and the parser of its answer.
function readPr($, worktree, branch) {
    return __awaiter(this, void 0, void 0, function () {
        var origin, gitlab, argv, result;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, $.process
                        .run(['git', 'remote', 'get-url', 'origin'], { cwd: worktree })
                        .catch(function () { return FAILED_READ; })];
                case 1:
                    origin = _a.sent();
                    gitlab = origin.exitCode === 0 && (0, tickets_1.forgeOf)(origin.stdout) === 'gitlab';
                    argv = gitlab
                        ? ['glab', 'mr', 'view', branch, '-F', 'json']
                        : ['gh', 'pr', 'view', branch, '--json', 'state,url,statusCheckRollup,number'];
                    return [4 /*yield*/, $.process.run(argv, { cwd: worktree }).catch(function () { return FAILED_READ; })];
                case 2:
                    result = _a.sent();
                    return [2 /*return*/, { result: result, parse: gitlab ? tickets_1.parseMr : tickets_1.parsePr }];
            }
        });
    });
}
