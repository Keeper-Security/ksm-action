require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 109:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getRecordUids = exports.parseSecretsInputs = void 0;
const core = __importStar(__nccwpck_require__(186));
const fs = __importStar(__nccwpck_require__(147));
const secrets_manager_core_1 = __nccwpck_require__(13);
var DestinationType;
(function (DestinationType) {
    DestinationType[DestinationType["output"] = 0] = "output";
    DestinationType[DestinationType["environment"] = 1] = "environment";
    DestinationType[DestinationType["file"] = 2] = "file";
})(DestinationType || (DestinationType = {}));
const parseSecretsInputs = (inputs) => {
    const results = [];
    for (const input of inputs) {
        const inputParts = input.split(/\s*>\s*/);
        let destinationType = DestinationType.output;
        let destination = inputParts[1];
        if (destination.startsWith('env:')) {
            destinationType = DestinationType.environment;
            destination = destination.slice(4);
        }
        else if (destination.startsWith('file:')) {
            destinationType = DestinationType.file;
            destination = destination.slice(5);
        }
        if (inputParts[0].split('/')[1] === 'file') {
            destinationType = DestinationType.file;
        }
        results.push({
            notation: inputParts[0],
            destination,
            destinationType
        });
    }
    return results;
};
exports.parseSecretsInputs = parseSecretsInputs;
const getRecordUids = (inputs) => {
    const set = new Set();
    for (const input of inputs) {
        set.add(input.notation.split('/')[0]);
    }
    return Array.from(set);
};
exports.getRecordUids = getRecordUids;
const downloadSecretFile = (file, destination) => __awaiter(void 0, void 0, void 0, function* () {
    const fileData = yield (0, secrets_manager_core_1.downloadFile)(file);
    fs.writeFileSync(destination, fileData);
});
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = core.getInput('keeper-secret-config');
        const inputs = (0, exports.parseSecretsInputs)(core.getMultilineInput('secrets'));
        const secrets = yield (0, secrets_manager_core_1.getSecrets)({ storage: (0, secrets_manager_core_1.loadJsonConfig)(config) }, (0, exports.getRecordUids)(inputs));
        for (const input of inputs) {
            const secret = (0, secrets_manager_core_1.getValue)(secrets, input.notation);
            core.setSecret(secret);
            switch (input.destinationType) {
                case DestinationType.output:
                    core.setOutput(input.destination, secret);
                    break;
                case DestinationType.environment:
                    core.exportVariable(input.destination, secret);
                    break;
                case DestinationType.file:
                    yield downloadSecretFile(secret, input.destination);
                    break;
            }
        }
    }
    catch (error) {
        let errorMessage = 'Failed getting secrets from Keeper Secrets Manager';
        if (error instanceof Error) {
            errorMessage = error.message;
        }
        core.setFailed(errorMessage);
    }
});
run();


/***/ }),

/***/ 351:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issue = exports.issueCommand = void 0;
const os = __importStar(__nccwpck_require__(37));
const utils_1 = __nccwpck_require__(278);
/**
 * Commands
 *
 * Command Format:
 *   ::name key=value,key=value::message
 *
 * Examples:
 *   ::warning::This is the message
 *   ::set-env name=MY_VAR::some value
 */
function issueCommand(command, properties, message) {
    const cmd = new Command(command, properties, message);
    process.stdout.write(cmd.toString() + os.EOL);
}
exports.issueCommand = issueCommand;
function issue(name, message = '') {
    issueCommand(name, {}, message);
}
exports.issue = issue;
const CMD_STRING = '::';
class Command {
    constructor(command, properties, message) {
        if (!command) {
            command = 'missing.command';
        }
        this.command = command;
        this.properties = properties;
        this.message = message;
    }
    toString() {
        let cmdStr = CMD_STRING + this.command;
        if (this.properties && Object.keys(this.properties).length > 0) {
            cmdStr += ' ';
            let first = true;
            for (const key in this.properties) {
                if (this.properties.hasOwnProperty(key)) {
                    const val = this.properties[key];
                    if (val) {
                        if (first) {
                            first = false;
                        }
                        else {
                            cmdStr += ',';
                        }
                        cmdStr += `${key}=${escapeProperty(val)}`;
                    }
                }
            }
        }
        cmdStr += `${CMD_STRING}${escapeData(this.message)}`;
        return cmdStr;
    }
}
function escapeData(s) {
    return utils_1.toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A');
}
function escapeProperty(s) {
    return utils_1.toCommandValue(s)
        .replace(/%/g, '%25')
        .replace(/\r/g, '%0D')
        .replace(/\n/g, '%0A')
        .replace(/:/g, '%3A')
        .replace(/,/g, '%2C');
}
//# sourceMappingURL=command.js.map

/***/ }),

/***/ 186:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getIDToken = exports.getState = exports.saveState = exports.group = exports.endGroup = exports.startGroup = exports.info = exports.notice = exports.warning = exports.error = exports.debug = exports.isDebug = exports.setFailed = exports.setCommandEcho = exports.setOutput = exports.getBooleanInput = exports.getMultilineInput = exports.getInput = exports.addPath = exports.setSecret = exports.exportVariable = exports.ExitCode = void 0;
const command_1 = __nccwpck_require__(351);
const file_command_1 = __nccwpck_require__(717);
const utils_1 = __nccwpck_require__(278);
const os = __importStar(__nccwpck_require__(37));
const path = __importStar(__nccwpck_require__(17));
const oidc_utils_1 = __nccwpck_require__(41);
/**
 * The code to exit an action
 */
var ExitCode;
(function (ExitCode) {
    /**
     * A code indicating that the action was successful
     */
    ExitCode[ExitCode["Success"] = 0] = "Success";
    /**
     * A code indicating that the action was a failure
     */
    ExitCode[ExitCode["Failure"] = 1] = "Failure";
})(ExitCode = exports.ExitCode || (exports.ExitCode = {}));
//-----------------------------------------------------------------------
// Variables
//-----------------------------------------------------------------------
/**
 * Sets env variable for this action and future actions in the job
 * @param name the name of the variable to set
 * @param val the value of the variable. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function exportVariable(name, val) {
    const convertedVal = utils_1.toCommandValue(val);
    process.env[name] = convertedVal;
    const filePath = process.env['GITHUB_ENV'] || '';
    if (filePath) {
        const delimiter = '_GitHubActionsFileCommandDelimeter_';
        const commandValue = `${name}<<${delimiter}${os.EOL}${convertedVal}${os.EOL}${delimiter}`;
        file_command_1.issueCommand('ENV', commandValue);
    }
    else {
        command_1.issueCommand('set-env', { name }, convertedVal);
    }
}
exports.exportVariable = exportVariable;
/**
 * Registers a secret which will get masked from logs
 * @param secret value of the secret
 */
function setSecret(secret) {
    command_1.issueCommand('add-mask', {}, secret);
}
exports.setSecret = setSecret;
/**
 * Prepends inputPath to the PATH (for this action and future actions)
 * @param inputPath
 */
function addPath(inputPath) {
    const filePath = process.env['GITHUB_PATH'] || '';
    if (filePath) {
        file_command_1.issueCommand('PATH', inputPath);
    }
    else {
        command_1.issueCommand('add-path', {}, inputPath);
    }
    process.env['PATH'] = `${inputPath}${path.delimiter}${process.env['PATH']}`;
}
exports.addPath = addPath;
/**
 * Gets the value of an input.
 * Unless trimWhitespace is set to false in InputOptions, the value is also trimmed.
 * Returns an empty string if the value is not defined.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string
 */
function getInput(name, options) {
    const val = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] || '';
    if (options && options.required && !val) {
        throw new Error(`Input required and not supplied: ${name}`);
    }
    if (options && options.trimWhitespace === false) {
        return val;
    }
    return val.trim();
}
exports.getInput = getInput;
/**
 * Gets the values of an multiline input.  Each value is also trimmed.
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   string[]
 *
 */
function getMultilineInput(name, options) {
    const inputs = getInput(name, options)
        .split('\n')
        .filter(x => x !== '');
    return inputs;
}
exports.getMultilineInput = getMultilineInput;
/**
 * Gets the input value of the boolean type in the YAML 1.2 "core schema" specification.
 * Support boolean input list: `true | True | TRUE | false | False | FALSE` .
 * The return value is also in boolean type.
 * ref: https://yaml.org/spec/1.2/spec.html#id2804923
 *
 * @param     name     name of the input to get
 * @param     options  optional. See InputOptions.
 * @returns   boolean
 */
function getBooleanInput(name, options) {
    const trueValue = ['true', 'True', 'TRUE'];
    const falseValue = ['false', 'False', 'FALSE'];
    const val = getInput(name, options);
    if (trueValue.includes(val))
        return true;
    if (falseValue.includes(val))
        return false;
    throw new TypeError(`Input does not meet YAML 1.2 "Core Schema" specification: ${name}\n` +
        `Support boolean input list: \`true | True | TRUE | false | False | FALSE\``);
}
exports.getBooleanInput = getBooleanInput;
/**
 * Sets the value of an output.
 *
 * @param     name     name of the output to set
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setOutput(name, value) {
    process.stdout.write(os.EOL);
    command_1.issueCommand('set-output', { name }, value);
}
exports.setOutput = setOutput;
/**
 * Enables or disables the echoing of commands into stdout for the rest of the step.
 * Echoing is disabled by default if ACTIONS_STEP_DEBUG is not set.
 *
 */
function setCommandEcho(enabled) {
    command_1.issue('echo', enabled ? 'on' : 'off');
}
exports.setCommandEcho = setCommandEcho;
//-----------------------------------------------------------------------
// Results
//-----------------------------------------------------------------------
/**
 * Sets the action status to failed.
 * When the action exits it will be with an exit code of 1
 * @param message add error issue message
 */
function setFailed(message) {
    process.exitCode = ExitCode.Failure;
    error(message);
}
exports.setFailed = setFailed;
//-----------------------------------------------------------------------
// Logging Commands
//-----------------------------------------------------------------------
/**
 * Gets whether Actions Step Debug is on or not
 */
function isDebug() {
    return process.env['RUNNER_DEBUG'] === '1';
}
exports.isDebug = isDebug;
/**
 * Writes debug message to user log
 * @param message debug message
 */
function debug(message) {
    command_1.issueCommand('debug', {}, message);
}
exports.debug = debug;
/**
 * Adds an error issue
 * @param message error issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function error(message, properties = {}) {
    command_1.issueCommand('error', utils_1.toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
exports.error = error;
/**
 * Adds a warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function warning(message, properties = {}) {
    command_1.issueCommand('warning', utils_1.toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
exports.warning = warning;
/**
 * Adds a notice issue
 * @param message notice issue message. Errors will be converted to string via toString()
 * @param properties optional properties to add to the annotation.
 */
function notice(message, properties = {}) {
    command_1.issueCommand('notice', utils_1.toCommandProperties(properties), message instanceof Error ? message.toString() : message);
}
exports.notice = notice;
/**
 * Writes info to log with console.log.
 * @param message info message
 */
function info(message) {
    process.stdout.write(message + os.EOL);
}
exports.info = info;
/**
 * Begin an output group.
 *
 * Output until the next `groupEnd` will be foldable in this group
 *
 * @param name The name of the output group
 */
function startGroup(name) {
    command_1.issue('group', name);
}
exports.startGroup = startGroup;
/**
 * End an output group.
 */
function endGroup() {
    command_1.issue('endgroup');
}
exports.endGroup = endGroup;
/**
 * Wrap an asynchronous function call in a group.
 *
 * Returns the same type as the function itself.
 *
 * @param name The name of the group
 * @param fn The function to wrap in the group
 */
function group(name, fn) {
    return __awaiter(this, void 0, void 0, function* () {
        startGroup(name);
        let result;
        try {
            result = yield fn();
        }
        finally {
            endGroup();
        }
        return result;
    });
}
exports.group = group;
//-----------------------------------------------------------------------
// Wrapper action state
//-----------------------------------------------------------------------
/**
 * Saves state for current action, the state can only be retrieved by this action's post job execution.
 *
 * @param     name     name of the state to store
 * @param     value    value to store. Non-string values will be converted to a string via JSON.stringify
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function saveState(name, value) {
    command_1.issueCommand('save-state', { name }, value);
}
exports.saveState = saveState;
/**
 * Gets the value of an state set by this action's main execution.
 *
 * @param     name     name of the state to get
 * @returns   string
 */
function getState(name) {
    return process.env[`STATE_${name}`] || '';
}
exports.getState = getState;
function getIDToken(aud) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield oidc_utils_1.OidcClient.getIDToken(aud);
    });
}
exports.getIDToken = getIDToken;
//# sourceMappingURL=core.js.map

/***/ }),

/***/ 717:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

// For internal use, subject to change.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.issueCommand = void 0;
// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = __importStar(__nccwpck_require__(147));
const os = __importStar(__nccwpck_require__(37));
const utils_1 = __nccwpck_require__(278);
function issueCommand(command, message) {
    const filePath = process.env[`GITHUB_${command}`];
    if (!filePath) {
        throw new Error(`Unable to find environment variable for file command ${command}`);
    }
    if (!fs.existsSync(filePath)) {
        throw new Error(`Missing file at path: ${filePath}`);
    }
    fs.appendFileSync(filePath, `${utils_1.toCommandValue(message)}${os.EOL}`, {
        encoding: 'utf8'
    });
}
exports.issueCommand = issueCommand;
//# sourceMappingURL=file-command.js.map

/***/ }),

/***/ 41:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.OidcClient = void 0;
const http_client_1 = __nccwpck_require__(925);
const auth_1 = __nccwpck_require__(702);
const core_1 = __nccwpck_require__(186);
class OidcClient {
    static createHttpClient(allowRetry = true, maxRetry = 10) {
        const requestOptions = {
            allowRetries: allowRetry,
            maxRetries: maxRetry
        };
        return new http_client_1.HttpClient('actions/oidc-client', [new auth_1.BearerCredentialHandler(OidcClient.getRequestToken())], requestOptions);
    }
    static getRequestToken() {
        const token = process.env['ACTIONS_ID_TOKEN_REQUEST_TOKEN'];
        if (!token) {
            throw new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_TOKEN env variable');
        }
        return token;
    }
    static getIDTokenUrl() {
        const runtimeUrl = process.env['ACTIONS_ID_TOKEN_REQUEST_URL'];
        if (!runtimeUrl) {
            throw new Error('Unable to get ACTIONS_ID_TOKEN_REQUEST_URL env variable');
        }
        return runtimeUrl;
    }
    static getCall(id_token_url) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const httpclient = OidcClient.createHttpClient();
            const res = yield httpclient
                .getJson(id_token_url)
                .catch(error => {
                throw new Error(`Failed to get ID Token. \n 
        Error Code : ${error.statusCode}\n 
        Error Message: ${error.result.message}`);
            });
            const id_token = (_a = res.result) === null || _a === void 0 ? void 0 : _a.value;
            if (!id_token) {
                throw new Error('Response json body do not have ID Token field');
            }
            return id_token;
        });
    }
    static getIDToken(audience) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // New ID Token is requested from action service
                let id_token_url = OidcClient.getIDTokenUrl();
                if (audience) {
                    const encodedAudience = encodeURIComponent(audience);
                    id_token_url = `${id_token_url}&audience=${encodedAudience}`;
                }
                core_1.debug(`ID token url is ${id_token_url}`);
                const id_token = yield OidcClient.getCall(id_token_url);
                core_1.setSecret(id_token);
                return id_token;
            }
            catch (error) {
                throw new Error(`Error message: ${error.message}`);
            }
        });
    }
}
exports.OidcClient = OidcClient;
//# sourceMappingURL=oidc-utils.js.map

/***/ }),

/***/ 278:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toCommandProperties = exports.toCommandValue = void 0;
/**
 * Sanitizes an input into a string so it can be passed into issueCommand safely
 * @param input input to sanitize into a string
 */
function toCommandValue(input) {
    if (input === null || input === undefined) {
        return '';
    }
    else if (typeof input === 'string' || input instanceof String) {
        return input;
    }
    return JSON.stringify(input);
}
exports.toCommandValue = toCommandValue;
/**
 *
 * @param annotationProperties
 * @returns The command properties to send with the actual annotation command
 * See IssueCommandProperties: https://github.com/actions/runner/blob/main/src/Runner.Worker/ActionCommandManager.cs#L646
 */
function toCommandProperties(annotationProperties) {
    if (!Object.keys(annotationProperties).length) {
        return {};
    }
    return {
        title: annotationProperties.title,
        file: annotationProperties.file,
        line: annotationProperties.startLine,
        endLine: annotationProperties.endLine,
        col: annotationProperties.startColumn,
        endColumn: annotationProperties.endColumn
    };
}
exports.toCommandProperties = toCommandProperties;
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 702:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
class BasicCredentialHandler {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }
    prepareRequest(options) {
        options.headers['Authorization'] =
            'Basic ' +
                Buffer.from(this.username + ':' + this.password).toString('base64');
    }
    // This handler cannot handle 401
    canHandleAuthentication(response) {
        return false;
    }
    handleAuthentication(httpClient, requestInfo, objs) {
        return null;
    }
}
exports.BasicCredentialHandler = BasicCredentialHandler;
class BearerCredentialHandler {
    constructor(token) {
        this.token = token;
    }
    // currently implements pre-authorization
    // TODO: support preAuth = false where it hooks on 401
    prepareRequest(options) {
        options.headers['Authorization'] = 'Bearer ' + this.token;
    }
    // This handler cannot handle 401
    canHandleAuthentication(response) {
        return false;
    }
    handleAuthentication(httpClient, requestInfo, objs) {
        return null;
    }
}
exports.BearerCredentialHandler = BearerCredentialHandler;
class PersonalAccessTokenCredentialHandler {
    constructor(token) {
        this.token = token;
    }
    // currently implements pre-authorization
    // TODO: support preAuth = false where it hooks on 401
    prepareRequest(options) {
        options.headers['Authorization'] =
            'Basic ' + Buffer.from('PAT:' + this.token).toString('base64');
    }
    // This handler cannot handle 401
    canHandleAuthentication(response) {
        return false;
    }
    handleAuthentication(httpClient, requestInfo, objs) {
        return null;
    }
}
exports.PersonalAccessTokenCredentialHandler = PersonalAccessTokenCredentialHandler;


/***/ }),

/***/ 925:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const http = __nccwpck_require__(685);
const https = __nccwpck_require__(687);
const pm = __nccwpck_require__(443);
let tunnel;
var HttpCodes;
(function (HttpCodes) {
    HttpCodes[HttpCodes["OK"] = 200] = "OK";
    HttpCodes[HttpCodes["MultipleChoices"] = 300] = "MultipleChoices";
    HttpCodes[HttpCodes["MovedPermanently"] = 301] = "MovedPermanently";
    HttpCodes[HttpCodes["ResourceMoved"] = 302] = "ResourceMoved";
    HttpCodes[HttpCodes["SeeOther"] = 303] = "SeeOther";
    HttpCodes[HttpCodes["NotModified"] = 304] = "NotModified";
    HttpCodes[HttpCodes["UseProxy"] = 305] = "UseProxy";
    HttpCodes[HttpCodes["SwitchProxy"] = 306] = "SwitchProxy";
    HttpCodes[HttpCodes["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    HttpCodes[HttpCodes["PermanentRedirect"] = 308] = "PermanentRedirect";
    HttpCodes[HttpCodes["BadRequest"] = 400] = "BadRequest";
    HttpCodes[HttpCodes["Unauthorized"] = 401] = "Unauthorized";
    HttpCodes[HttpCodes["PaymentRequired"] = 402] = "PaymentRequired";
    HttpCodes[HttpCodes["Forbidden"] = 403] = "Forbidden";
    HttpCodes[HttpCodes["NotFound"] = 404] = "NotFound";
    HttpCodes[HttpCodes["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    HttpCodes[HttpCodes["NotAcceptable"] = 406] = "NotAcceptable";
    HttpCodes[HttpCodes["ProxyAuthenticationRequired"] = 407] = "ProxyAuthenticationRequired";
    HttpCodes[HttpCodes["RequestTimeout"] = 408] = "RequestTimeout";
    HttpCodes[HttpCodes["Conflict"] = 409] = "Conflict";
    HttpCodes[HttpCodes["Gone"] = 410] = "Gone";
    HttpCodes[HttpCodes["TooManyRequests"] = 429] = "TooManyRequests";
    HttpCodes[HttpCodes["InternalServerError"] = 500] = "InternalServerError";
    HttpCodes[HttpCodes["NotImplemented"] = 501] = "NotImplemented";
    HttpCodes[HttpCodes["BadGateway"] = 502] = "BadGateway";
    HttpCodes[HttpCodes["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    HttpCodes[HttpCodes["GatewayTimeout"] = 504] = "GatewayTimeout";
})(HttpCodes = exports.HttpCodes || (exports.HttpCodes = {}));
var Headers;
(function (Headers) {
    Headers["Accept"] = "accept";
    Headers["ContentType"] = "content-type";
})(Headers = exports.Headers || (exports.Headers = {}));
var MediaTypes;
(function (MediaTypes) {
    MediaTypes["ApplicationJson"] = "application/json";
})(MediaTypes = exports.MediaTypes || (exports.MediaTypes = {}));
/**
 * Returns the proxy URL, depending upon the supplied url and proxy environment variables.
 * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
 */
function getProxyUrl(serverUrl) {
    let proxyUrl = pm.getProxyUrl(new URL(serverUrl));
    return proxyUrl ? proxyUrl.href : '';
}
exports.getProxyUrl = getProxyUrl;
const HttpRedirectCodes = [
    HttpCodes.MovedPermanently,
    HttpCodes.ResourceMoved,
    HttpCodes.SeeOther,
    HttpCodes.TemporaryRedirect,
    HttpCodes.PermanentRedirect
];
const HttpResponseRetryCodes = [
    HttpCodes.BadGateway,
    HttpCodes.ServiceUnavailable,
    HttpCodes.GatewayTimeout
];
const RetryableHttpVerbs = ['OPTIONS', 'GET', 'DELETE', 'HEAD'];
const ExponentialBackoffCeiling = 10;
const ExponentialBackoffTimeSlice = 5;
class HttpClientError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.name = 'HttpClientError';
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, HttpClientError.prototype);
    }
}
exports.HttpClientError = HttpClientError;
class HttpClientResponse {
    constructor(message) {
        this.message = message;
    }
    readBody() {
        return new Promise(async (resolve, reject) => {
            let output = Buffer.alloc(0);
            this.message.on('data', (chunk) => {
                output = Buffer.concat([output, chunk]);
            });
            this.message.on('end', () => {
                resolve(output.toString());
            });
        });
    }
}
exports.HttpClientResponse = HttpClientResponse;
function isHttps(requestUrl) {
    let parsedUrl = new URL(requestUrl);
    return parsedUrl.protocol === 'https:';
}
exports.isHttps = isHttps;
class HttpClient {
    constructor(userAgent, handlers, requestOptions) {
        this._ignoreSslError = false;
        this._allowRedirects = true;
        this._allowRedirectDowngrade = false;
        this._maxRedirects = 50;
        this._allowRetries = false;
        this._maxRetries = 1;
        this._keepAlive = false;
        this._disposed = false;
        this.userAgent = userAgent;
        this.handlers = handlers || [];
        this.requestOptions = requestOptions;
        if (requestOptions) {
            if (requestOptions.ignoreSslError != null) {
                this._ignoreSslError = requestOptions.ignoreSslError;
            }
            this._socketTimeout = requestOptions.socketTimeout;
            if (requestOptions.allowRedirects != null) {
                this._allowRedirects = requestOptions.allowRedirects;
            }
            if (requestOptions.allowRedirectDowngrade != null) {
                this._allowRedirectDowngrade = requestOptions.allowRedirectDowngrade;
            }
            if (requestOptions.maxRedirects != null) {
                this._maxRedirects = Math.max(requestOptions.maxRedirects, 0);
            }
            if (requestOptions.keepAlive != null) {
                this._keepAlive = requestOptions.keepAlive;
            }
            if (requestOptions.allowRetries != null) {
                this._allowRetries = requestOptions.allowRetries;
            }
            if (requestOptions.maxRetries != null) {
                this._maxRetries = requestOptions.maxRetries;
            }
        }
    }
    options(requestUrl, additionalHeaders) {
        return this.request('OPTIONS', requestUrl, null, additionalHeaders || {});
    }
    get(requestUrl, additionalHeaders) {
        return this.request('GET', requestUrl, null, additionalHeaders || {});
    }
    del(requestUrl, additionalHeaders) {
        return this.request('DELETE', requestUrl, null, additionalHeaders || {});
    }
    post(requestUrl, data, additionalHeaders) {
        return this.request('POST', requestUrl, data, additionalHeaders || {});
    }
    patch(requestUrl, data, additionalHeaders) {
        return this.request('PATCH', requestUrl, data, additionalHeaders || {});
    }
    put(requestUrl, data, additionalHeaders) {
        return this.request('PUT', requestUrl, data, additionalHeaders || {});
    }
    head(requestUrl, additionalHeaders) {
        return this.request('HEAD', requestUrl, null, additionalHeaders || {});
    }
    sendStream(verb, requestUrl, stream, additionalHeaders) {
        return this.request(verb, requestUrl, stream, additionalHeaders);
    }
    /**
     * Gets a typed object from an endpoint
     * Be aware that not found returns a null.  Other errors (4xx, 5xx) reject the promise
     */
    async getJson(requestUrl, additionalHeaders = {}) {
        additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
        let res = await this.get(requestUrl, additionalHeaders);
        return this._processResponse(res, this.requestOptions);
    }
    async postJson(requestUrl, obj, additionalHeaders = {}) {
        let data = JSON.stringify(obj, null, 2);
        additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
        additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
        let res = await this.post(requestUrl, data, additionalHeaders);
        return this._processResponse(res, this.requestOptions);
    }
    async putJson(requestUrl, obj, additionalHeaders = {}) {
        let data = JSON.stringify(obj, null, 2);
        additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
        additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
        let res = await this.put(requestUrl, data, additionalHeaders);
        return this._processResponse(res, this.requestOptions);
    }
    async patchJson(requestUrl, obj, additionalHeaders = {}) {
        let data = JSON.stringify(obj, null, 2);
        additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
        additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
        let res = await this.patch(requestUrl, data, additionalHeaders);
        return this._processResponse(res, this.requestOptions);
    }
    /**
     * Makes a raw http request.
     * All other methods such as get, post, patch, and request ultimately call this.
     * Prefer get, del, post and patch
     */
    async request(verb, requestUrl, data, headers) {
        if (this._disposed) {
            throw new Error('Client has already been disposed.');
        }
        let parsedUrl = new URL(requestUrl);
        let info = this._prepareRequest(verb, parsedUrl, headers);
        // Only perform retries on reads since writes may not be idempotent.
        let maxTries = this._allowRetries && RetryableHttpVerbs.indexOf(verb) != -1
            ? this._maxRetries + 1
            : 1;
        let numTries = 0;
        let response;
        while (numTries < maxTries) {
            response = await this.requestRaw(info, data);
            // Check if it's an authentication challenge
            if (response &&
                response.message &&
                response.message.statusCode === HttpCodes.Unauthorized) {
                let authenticationHandler;
                for (let i = 0; i < this.handlers.length; i++) {
                    if (this.handlers[i].canHandleAuthentication(response)) {
                        authenticationHandler = this.handlers[i];
                        break;
                    }
                }
                if (authenticationHandler) {
                    return authenticationHandler.handleAuthentication(this, info, data);
                }
                else {
                    // We have received an unauthorized response but have no handlers to handle it.
                    // Let the response return to the caller.
                    return response;
                }
            }
            let redirectsRemaining = this._maxRedirects;
            while (HttpRedirectCodes.indexOf(response.message.statusCode) != -1 &&
                this._allowRedirects &&
                redirectsRemaining > 0) {
                const redirectUrl = response.message.headers['location'];
                if (!redirectUrl) {
                    // if there's no location to redirect to, we won't
                    break;
                }
                let parsedRedirectUrl = new URL(redirectUrl);
                if (parsedUrl.protocol == 'https:' &&
                    parsedUrl.protocol != parsedRedirectUrl.protocol &&
                    !this._allowRedirectDowngrade) {
                    throw new Error('Redirect from HTTPS to HTTP protocol. This downgrade is not allowed for security reasons. If you want to allow this behavior, set the allowRedirectDowngrade option to true.');
                }
                // we need to finish reading the response before reassigning response
                // which will leak the open socket.
                await response.readBody();
                // strip authorization header if redirected to a different hostname
                if (parsedRedirectUrl.hostname !== parsedUrl.hostname) {
                    for (let header in headers) {
                        // header names are case insensitive
                        if (header.toLowerCase() === 'authorization') {
                            delete headers[header];
                        }
                    }
                }
                // let's make the request with the new redirectUrl
                info = this._prepareRequest(verb, parsedRedirectUrl, headers);
                response = await this.requestRaw(info, data);
                redirectsRemaining--;
            }
            if (HttpResponseRetryCodes.indexOf(response.message.statusCode) == -1) {
                // If not a retry code, return immediately instead of retrying
                return response;
            }
            numTries += 1;
            if (numTries < maxTries) {
                await response.readBody();
                await this._performExponentialBackoff(numTries);
            }
        }
        return response;
    }
    /**
     * Needs to be called if keepAlive is set to true in request options.
     */
    dispose() {
        if (this._agent) {
            this._agent.destroy();
        }
        this._disposed = true;
    }
    /**
     * Raw request.
     * @param info
     * @param data
     */
    requestRaw(info, data) {
        return new Promise((resolve, reject) => {
            let callbackForResult = function (err, res) {
                if (err) {
                    reject(err);
                }
                resolve(res);
            };
            this.requestRawWithCallback(info, data, callbackForResult);
        });
    }
    /**
     * Raw request with callback.
     * @param info
     * @param data
     * @param onResult
     */
    requestRawWithCallback(info, data, onResult) {
        let socket;
        if (typeof data === 'string') {
            info.options.headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
        }
        let callbackCalled = false;
        let handleResult = (err, res) => {
            if (!callbackCalled) {
                callbackCalled = true;
                onResult(err, res);
            }
        };
        let req = info.httpModule.request(info.options, (msg) => {
            let res = new HttpClientResponse(msg);
            handleResult(null, res);
        });
        req.on('socket', sock => {
            socket = sock;
        });
        // If we ever get disconnected, we want the socket to timeout eventually
        req.setTimeout(this._socketTimeout || 3 * 60000, () => {
            if (socket) {
                socket.end();
            }
            handleResult(new Error('Request timeout: ' + info.options.path), null);
        });
        req.on('error', function (err) {
            // err has statusCode property
            // res should have headers
            handleResult(err, null);
        });
        if (data && typeof data === 'string') {
            req.write(data, 'utf8');
        }
        if (data && typeof data !== 'string') {
            data.on('close', function () {
                req.end();
            });
            data.pipe(req);
        }
        else {
            req.end();
        }
    }
    /**
     * Gets an http agent. This function is useful when you need an http agent that handles
     * routing through a proxy server - depending upon the url and proxy environment variables.
     * @param serverUrl  The server URL where the request will be sent. For example, https://api.github.com
     */
    getAgent(serverUrl) {
        let parsedUrl = new URL(serverUrl);
        return this._getAgent(parsedUrl);
    }
    _prepareRequest(method, requestUrl, headers) {
        const info = {};
        info.parsedUrl = requestUrl;
        const usingSsl = info.parsedUrl.protocol === 'https:';
        info.httpModule = usingSsl ? https : http;
        const defaultPort = usingSsl ? 443 : 80;
        info.options = {};
        info.options.host = info.parsedUrl.hostname;
        info.options.port = info.parsedUrl.port
            ? parseInt(info.parsedUrl.port)
            : defaultPort;
        info.options.path =
            (info.parsedUrl.pathname || '') + (info.parsedUrl.search || '');
        info.options.method = method;
        info.options.headers = this._mergeHeaders(headers);
        if (this.userAgent != null) {
            info.options.headers['user-agent'] = this.userAgent;
        }
        info.options.agent = this._getAgent(info.parsedUrl);
        // gives handlers an opportunity to participate
        if (this.handlers) {
            this.handlers.forEach(handler => {
                handler.prepareRequest(info.options);
            });
        }
        return info;
    }
    _mergeHeaders(headers) {
        const lowercaseKeys = obj => Object.keys(obj).reduce((c, k) => ((c[k.toLowerCase()] = obj[k]), c), {});
        if (this.requestOptions && this.requestOptions.headers) {
            return Object.assign({}, lowercaseKeys(this.requestOptions.headers), lowercaseKeys(headers));
        }
        return lowercaseKeys(headers || {});
    }
    _getExistingOrDefaultHeader(additionalHeaders, header, _default) {
        const lowercaseKeys = obj => Object.keys(obj).reduce((c, k) => ((c[k.toLowerCase()] = obj[k]), c), {});
        let clientHeader;
        if (this.requestOptions && this.requestOptions.headers) {
            clientHeader = lowercaseKeys(this.requestOptions.headers)[header];
        }
        return additionalHeaders[header] || clientHeader || _default;
    }
    _getAgent(parsedUrl) {
        let agent;
        let proxyUrl = pm.getProxyUrl(parsedUrl);
        let useProxy = proxyUrl && proxyUrl.hostname;
        if (this._keepAlive && useProxy) {
            agent = this._proxyAgent;
        }
        if (this._keepAlive && !useProxy) {
            agent = this._agent;
        }
        // if agent is already assigned use that agent.
        if (!!agent) {
            return agent;
        }
        const usingSsl = parsedUrl.protocol === 'https:';
        let maxSockets = 100;
        if (!!this.requestOptions) {
            maxSockets = this.requestOptions.maxSockets || http.globalAgent.maxSockets;
        }
        if (useProxy) {
            // If using proxy, need tunnel
            if (!tunnel) {
                tunnel = __nccwpck_require__(294);
            }
            const agentOptions = {
                maxSockets: maxSockets,
                keepAlive: this._keepAlive,
                proxy: {
                    ...((proxyUrl.username || proxyUrl.password) && {
                        proxyAuth: `${proxyUrl.username}:${proxyUrl.password}`
                    }),
                    host: proxyUrl.hostname,
                    port: proxyUrl.port
                }
            };
            let tunnelAgent;
            const overHttps = proxyUrl.protocol === 'https:';
            if (usingSsl) {
                tunnelAgent = overHttps ? tunnel.httpsOverHttps : tunnel.httpsOverHttp;
            }
            else {
                tunnelAgent = overHttps ? tunnel.httpOverHttps : tunnel.httpOverHttp;
            }
            agent = tunnelAgent(agentOptions);
            this._proxyAgent = agent;
        }
        // if reusing agent across request and tunneling agent isn't assigned create a new agent
        if (this._keepAlive && !agent) {
            const options = { keepAlive: this._keepAlive, maxSockets: maxSockets };
            agent = usingSsl ? new https.Agent(options) : new http.Agent(options);
            this._agent = agent;
        }
        // if not using private agent and tunnel agent isn't setup then use global agent
        if (!agent) {
            agent = usingSsl ? https.globalAgent : http.globalAgent;
        }
        if (usingSsl && this._ignoreSslError) {
            // we don't want to set NODE_TLS_REJECT_UNAUTHORIZED=0 since that will affect request for entire process
            // http.RequestOptions doesn't expose a way to modify RequestOptions.agent.options
            // we have to cast it to any and change it directly
            agent.options = Object.assign(agent.options || {}, {
                rejectUnauthorized: false
            });
        }
        return agent;
    }
    _performExponentialBackoff(retryNumber) {
        retryNumber = Math.min(ExponentialBackoffCeiling, retryNumber);
        const ms = ExponentialBackoffTimeSlice * Math.pow(2, retryNumber);
        return new Promise(resolve => setTimeout(() => resolve(), ms));
    }
    static dateTimeDeserializer(key, value) {
        if (typeof value === 'string') {
            let a = new Date(value);
            if (!isNaN(a.valueOf())) {
                return a;
            }
        }
        return value;
    }
    async _processResponse(res, options) {
        return new Promise(async (resolve, reject) => {
            const statusCode = res.message.statusCode;
            const response = {
                statusCode: statusCode,
                result: null,
                headers: {}
            };
            // not found leads to null obj returned
            if (statusCode == HttpCodes.NotFound) {
                resolve(response);
            }
            let obj;
            let contents;
            // get the result from the body
            try {
                contents = await res.readBody();
                if (contents && contents.length > 0) {
                    if (options && options.deserializeDates) {
                        obj = JSON.parse(contents, HttpClient.dateTimeDeserializer);
                    }
                    else {
                        obj = JSON.parse(contents);
                    }
                    response.result = obj;
                }
                response.headers = res.message.headers;
            }
            catch (err) {
                // Invalid resource (contents not json);  leaving result obj null
            }
            // note that 3xx redirects are handled by the http layer.
            if (statusCode > 299) {
                let msg;
                // if exception/error in body, attempt to get better error
                if (obj && obj.message) {
                    msg = obj.message;
                }
                else if (contents && contents.length > 0) {
                    // it may be the case that the exception is in the body message as string
                    msg = contents;
                }
                else {
                    msg = 'Failed request: (' + statusCode + ')';
                }
                let err = new HttpClientError(msg, statusCode);
                err.result = response.result;
                reject(err);
            }
            else {
                resolve(response);
            }
        });
    }
}
exports.HttpClient = HttpClient;


/***/ }),

/***/ 443:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
function getProxyUrl(reqUrl) {
    let usingSsl = reqUrl.protocol === 'https:';
    let proxyUrl;
    if (checkBypass(reqUrl)) {
        return proxyUrl;
    }
    let proxyVar;
    if (usingSsl) {
        proxyVar = process.env['https_proxy'] || process.env['HTTPS_PROXY'];
    }
    else {
        proxyVar = process.env['http_proxy'] || process.env['HTTP_PROXY'];
    }
    if (proxyVar) {
        proxyUrl = new URL(proxyVar);
    }
    return proxyUrl;
}
exports.getProxyUrl = getProxyUrl;
function checkBypass(reqUrl) {
    if (!reqUrl.hostname) {
        return false;
    }
    let noProxy = process.env['no_proxy'] || process.env['NO_PROXY'] || '';
    if (!noProxy) {
        return false;
    }
    // Determine the request port
    let reqPort;
    if (reqUrl.port) {
        reqPort = Number(reqUrl.port);
    }
    else if (reqUrl.protocol === 'http:') {
        reqPort = 80;
    }
    else if (reqUrl.protocol === 'https:') {
        reqPort = 443;
    }
    // Format the request hostname and hostname with port
    let upperReqHosts = [reqUrl.hostname.toUpperCase()];
    if (typeof reqPort === 'number') {
        upperReqHosts.push(`${upperReqHosts[0]}:${reqPort}`);
    }
    // Compare request host against noproxy
    for (let upperNoProxyItem of noProxy
        .split(',')
        .map(x => x.trim().toUpperCase())
        .filter(x => x)) {
        if (upperReqHosts.some(x => x === upperNoProxyItem)) {
            return true;
        }
    }
    return false;
}
exports.checkBypass = checkBypass;


/***/ }),

/***/ 13:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";
/* Version: 16.1.2 - November 15, 2021 23:39:39 */


Object.defineProperty(exports, "__esModule", ({ value: true }));

var https = __nccwpck_require__(687);
var crypto = __nccwpck_require__(113);
var fs = __nccwpck_require__(147);

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n["default"] = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespace(fs);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

function connectPlatform(p) {
    exports.platform = p;
}
exports.platform = void 0;
const loadJsonConfig = (config) => {
    let jsonStr = config;
    try {
        const str = exports.platform.bytesToString(exports.platform.base64ToBytes(config));
        if (str.trimStart().startsWith('{') && str.trimEnd().endsWith('}'))
            jsonStr = str;
    }
    catch (e) {
        jsonStr = config;
    }
    return inMemoryStorage(JSON.parse(jsonStr));
};
const inMemoryStorage = (storage) => {
    const getValue = (key) => {
        const keyParts = key.split('/');
        let obj = storage;
        for (const part of keyParts) {
            obj = obj[part];
            if (!obj) {
                return undefined;
            }
        }
        return obj.toString();
    };
    const saveValue = (key, value) => {
        const keyParts = key.split('/');
        let obj = storage;
        for (const part of keyParts.slice(0, -1)) {
            if (!obj[part]) {
                obj[part] = {};
            }
            obj = obj[part];
        }
        obj[keyParts.slice(-1)[0]] = value;
    };
    const clearValue = (key) => {
        const keyParts = key.split('/');
        let obj = storage;
        for (const part of keyParts.slice(0, -1)) {
            if (!obj[part]) {
                obj[part] = {};
            }
            obj = obj[part];
        }
        delete obj[keyParts.slice(-1)[0]];
    };
    return {
        getString: key => Promise.resolve(getValue(key)),
        saveString: (key, value) => {
            saveValue(key, value);
            return Promise.resolve();
        },
        getBytes: key => {
            const bytesString = getValue(key);
            if (bytesString) {
                return Promise.resolve(exports.platform.base64ToBytes(bytesString));
            }
            else {
                return Promise.resolve(undefined);
            }
        },
        saveBytes: (key, value) => {
            const bytesString = exports.platform.bytesToBase64(value);
            saveValue(key, bytesString);
            return Promise.resolve();
        },
        delete: (key) => {
            clearValue(key);
            return Promise.resolve();
        }
    };
};

const webSafe64 = (source) => source.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const webSafe64ToRegular = (source) => source.replace(/-/g, '+').replace(/_/g, '/') + '=='.substring(0, (3 * source.length) % 4);
const webSafe64ToBytes = (source) => exports.platform.base64ToBytes(webSafe64ToRegular(source));
const webSafe64FromBytes = (source) => webSafe64(exports.platform.bytesToBase64(source));
// extracts public raw from private key for prime256v1 curve in der/pkcs8
// privateKey: key.slice(36, 68)
const privateDerToPublicRaw = (key) => key.slice(-65);
const b32encode = (base32Text) => {
    /* encodes a string s to base32 and returns the encoded string */
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    // private static readonly Regex rxBase32Alphabet = new Regex($"", RegexOptions.Compiled);
    // The padding specified in RFC 3548 section 2.2 is not required and should be omitted.
    const base32 = (base32Text || '').replace(/=+$/g, '').toUpperCase();
    if (!base32 || !/^[A-Z2-7]+$/.test(base32))
        return new Uint8Array();
    const bytes = Array.from(base32);
    let output = new Array();
    for (let bitIndex = 0; bitIndex < base32.length * 5; bitIndex += 8) {
        const idx = Math.floor(bitIndex / 5);
        let dualByte = alphabet.indexOf(bytes[idx]) << 10;
        if (idx + 1 < bytes.length)
            dualByte |= alphabet.indexOf(bytes[idx + 1]) << 5;
        if (idx + 2 < bytes.length)
            dualByte |= alphabet.indexOf(bytes[idx + 2]);
        dualByte = 0xff & (dualByte >> (15 - bitIndex % 5 - 8));
        output.push(dualByte);
    }
    return new Uint8Array(output);
};
const getTotpCode = (url, unixTimeSeconds = 0) => __awaiter(void 0, void 0, void 0, function* () {
    let totpUrl;
    try {
        totpUrl = new URL(url);
    }
    catch (e) {
        return null;
    }
    if (totpUrl.protocol != 'otpauth:')
        return null;
    const secret = (totpUrl.searchParams.get('secret') || '').trim();
    if (!secret)
        return null;
    let algorithm = (totpUrl.searchParams.get('algorithm') || '').trim();
    if (!algorithm)
        algorithm = 'SHA1'; // default algorithm
    const strDigits = (totpUrl.searchParams.get('digits') || '').trim();
    let digits = (isNaN(+strDigits) ? 6 : parseInt(strDigits));
    digits = digits == 0 ? 6 : digits;
    const strPeriod = (totpUrl.searchParams.get('period') || '').trim();
    let period = (isNaN(+strPeriod) ? 30 : parseInt(strPeriod));
    period = period == 0 ? 30 : period;
    const tmBase = unixTimeSeconds != 0 ? unixTimeSeconds : Math.floor(Date.now() / 1000);
    const tm = BigInt(Math.floor(tmBase / period));
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigInt64(0, tm);
    const msg = new Uint8Array(buffer);
    const secretBytes = b32encode(secret.toUpperCase());
    if (secretBytes == null || secretBytes.length < 1)
        return null;
    const digest = yield exports.platform.getHmacDigest(algorithm, secretBytes, msg);
    if (digest.length < 1)
        return null;
    const offset = digest[digest.length - 1] & 0x0f;
    const codeBytes = new Uint8Array(digest.slice(offset, offset + 4));
    codeBytes[0] &= 0x7f;
    let codeInt = new DataView(codeBytes.buffer).getInt32(0);
    codeInt %= Math.floor(Math.pow(10, digits));
    codeInt = Math.floor(codeInt);
    let codeStr = codeInt.toString(10);
    while (codeStr.length < digits)
        codeStr = "0" + codeStr;
    const elapsed = Math.floor(tmBase % period); // time elapsed in current period in seconds
    const ttl = period - elapsed; // time to live in seconds
    return { code: codeStr, timeLeft: ttl, period: period };
});
const generatePassword = (length = 64, lowercase = 0, uppercase = 0, digits = 0, specialCharacters = 0) => __awaiter(void 0, void 0, void 0, function* () {
    const asciiLowercase = 'abcdefghijklmnopqrstuvwxyz';
    const asciiUppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const asciiDigits = '0123456789';
    const asciiSpecialCharacters = '"!@#$%()+;<>=?[]{}^.,';
    length = (typeof length === 'number' && length > 0) ? length : 64;
    lowercase = (typeof lowercase === 'number' && lowercase > 0) ? lowercase : 0;
    uppercase = (typeof uppercase === 'number' && uppercase > 0) ? uppercase : 0;
    digits = (typeof digits === 'number' && digits > 0) ? digits : 0;
    specialCharacters = (typeof specialCharacters === 'number' && specialCharacters > 0) ? specialCharacters : 0;
    if (lowercase == 0 && uppercase == 0 && digits == 0 && specialCharacters == 0) {
        const increment = length / 4;
        const lastIncrement = increment + length % 4;
        lowercase = uppercase = digits = increment;
        specialCharacters = lastIncrement;
    }
    let result = '';
    for (let i = 0; i < lowercase; i++)
        result += yield exports.platform.getRandomCharacterInCharset(asciiLowercase);
    for (let i = 0; i < uppercase; i++)
        result += yield exports.platform.getRandomCharacterInCharset(asciiUppercase);
    for (let i = 0; i < digits; i++)
        result += yield exports.platform.getRandomCharacterInCharset(asciiDigits);
    for (let i = 0; i < specialCharacters; i++)
        result += yield exports.platform.getRandomCharacterInCharset(asciiSpecialCharacters);
    // Fisher-Yates shuffle
    if (result.length > 1) {
        let a = result.split('');
        for (let i = a.length - 1; i > 0; i--) {
            const j = yield exports.platform.getRandomNumber(i + 1); // 0 <= j <= i
            if (i != j) {
                const tmp = a[i];
                a[i] = a[j];
                a[j] = tmp;
            }
        }
        result = a.join('');
    }
    return result;
});

const bytesToBase64 = (data) => Buffer.from(data).toString('base64');
const base64ToBytes = (data) => Buffer.from(data, 'base64');
const bytesToString = (data) => Buffer.from(data).toString();
const stringToBytes = (data) => Buffer.from(data);
const getRandomBytes = (length) => crypto.randomBytes(length);
const keyCache = {};
const loadKey = (keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const cachedKey = keyCache[keyId];
    if (cachedKey) {
        return cachedKey;
    }
    const keyBytes = storage
        ? yield storage.getBytes(keyId)
        : undefined;
    if (!keyBytes) {
        throw new Error(`Unable to load the key ${keyId}`);
    }
    keyCache[keyId] = keyBytes;
    return keyBytes;
});
const generateKeeperKeyPair = () => __awaiter(void 0, void 0, void 0, function* () {
    return new Promise((resolve, reject) => {
        crypto.generateKeyPair('ec', {
            namedCurve: 'prime256v1'
        }, (err, publicKey, privateKey) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(privateKey.export({
                    format: 'der',
                    type: 'pkcs8'
                }));
            }
        });
    });
});
const generatePrivateKey = (keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const privateKeyDer = yield generateKeeperKeyPair();
    keyCache[keyId] = privateKeyDer;
    yield storage.saveBytes(keyId, privateKeyDer);
});
const exportPublicKey = (keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const privateKeyDer = yield loadKey(keyId, storage);
    return privateDerToPublicRaw(privateKeyDer);
});
const privateDerToPEM = (key) => {
    const rawPrivate = key.slice(36, 68);
    const rawPublic = key.slice(-65);
    const keyData1 = Buffer.of(0x30, 0x77, 0x02, 0x01, 0x01, 0x04, 0x20);
    const keyData2 = Buffer.of(0xa0, 0x0a, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0xa1, 0x44, 0x03, 0x42, 0x00);
    return `-----BEGIN EC PRIVATE KEY-----\n${bytesToBase64(Buffer.concat([keyData1, rawPrivate, keyData2, rawPublic]))}\n-----END EC PRIVATE KEY-----`;
};
const sign = (data, keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const privateKeyDer = yield loadKey(keyId, storage);
    const key = privateDerToPEM(privateKeyDer);
    // TODO revert to using createPrivateKey when node 10 interop is not needed anymore
    // const key = createPrivateKey({
    //     key: Buffer.from(privateKeyDer),
    //     format: 'der',
    //     type: 'pkcs8',
    // })
    const sign = crypto.createSign('SHA256');
    sign.update(data);
    const sig = sign.sign(key);
    return Promise.resolve(sig);
});
const importKey = (keyId, key, storage) => __awaiter(void 0, void 0, void 0, function* () {
    keyCache[keyId] = key;
    if (storage) {
        yield storage.saveBytes(keyId, key);
    }
});
const encrypt = (data, keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const key = yield loadKey(keyId, storage);
    const iv = getRandomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, tag]);
});
const _encrypt = (data, key) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    const result = Buffer.concat([iv, encrypted, tag]);
    return Promise.resolve(result);
};
const _decrypt = (data, key) => {
    const iv = data.subarray(0, 12);
    const encrypted = data.subarray(12, data.length - 16);
    const tag = data.subarray(data.length - 16);
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAuthTag(tag);
    return Promise.resolve(Buffer.concat([cipher.update(encrypted), cipher.final()]));
};
const unwrap = (key, keyId, unwrappingKeyId, storage, memoryOnly) => __awaiter(void 0, void 0, void 0, function* () {
    const unwrappingKey = yield loadKey(unwrappingKeyId, storage);
    const unwrappedKey = yield _decrypt(key, unwrappingKey);
    keyCache[keyId] = unwrappedKey;
    if (memoryOnly) {
        return;
    }
    if (storage) {
        yield storage.saveBytes(keyId, unwrappedKey);
    }
});
const decrypt = (data, keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const key = yield loadKey(keyId, storage);
    return _decrypt(data, key);
});
function hash(data) {
    const hash = crypto.createHmac('sha512', data).update('KEEPER_SECRETS_MANAGER_CLIENT_ID').digest();
    return Promise.resolve(hash);
}
const publicEncrypt = (data, key, id) => __awaiter(void 0, void 0, void 0, function* () {
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const ephemeralPublicKey = ecdh.getPublicKey();
    const sharedSecret = ecdh.computeSecret(key);
    const sharedSecretCombined = Buffer.concat([sharedSecret, id || new Uint8Array()]);
    const symmetricKey = crypto.createHash('SHA256').update(sharedSecretCombined).digest();
    const encryptedData = yield _encrypt(data, symmetricKey);
    return Buffer.concat([ephemeralPublicKey, encryptedData]);
});
const fetchData = (res, resolve) => {
    const retVal = {
        statusCode: res.statusCode,
        headers: res.headers,
        data: null
    };
    res.on('data', data => {
        retVal.data = retVal.data
            ? Buffer.concat([retVal.data, data])
            : data;
    });
    res.on('end', () => {
        resolve(retVal);
    });
};
const get = (url, headers) => new Promise((resolve, reject) => {
    const get = https.request(url, {
        method: 'get',
        headers: Object.assign({ 'User-Agent': `Node/${process.version}` }, headers)
    }, (res) => {
        fetchData(res, resolve);
    });
    get.on('error', reject);
    get.end();
});
const post = (url, payload, headers, allowUnverifiedCertificate) => new Promise((resolve, reject) => {
    const options = {
        rejectUnauthorized: !allowUnverifiedCertificate
    };
    const post = https.request(url, Object.assign(Object.assign({ method: 'post' }, options), { headers: Object.assign({ 'Content-Type': 'application/octet-stream', 'Content-Length': payload.length, 'User-Agent': `Node/${process.version}` }, headers) }), (res) => {
        fetchData(res, resolve);
    });
    post.on('error', reject);
    post.write(payload);
    post.end();
});
const cleanKeyCache = () => {
    for (const key in keyCache) {
        delete keyCache[key];
    }
};
const getHmacDigest = (algorithm, secret, message) => __awaiter(void 0, void 0, void 0, function* () {
    // although once part of Google Key Uri Format - https://github.com/google/google-authenticator/wiki/Key-Uri-Format/_history
    // removed MD5 as unreliable - only digests of length >= 20 can be used (MD5 has a digest length of 16)
    let digest = new Uint8Array();
    const algo = algorithm.toUpperCase().trim();
    if (['SHA1', 'SHA256', 'SHA512'].includes(algo))
        digest = crypto.createHmac(algo, secret).update(message).digest();
    return Promise.resolve(digest);
});
// Returns a sufficiently random number in the range [0, max) i.e. 0 <= number < max
const getRandomNumber = (n) => __awaiter(void 0, void 0, void 0, function* () {
    const uint32Max = Math.pow(2, 32) - 1;
    const limit = uint32Max - uint32Max % n;
    let values = new Uint32Array(1);
    do {
        const randomBytes = getRandomBytes(4);
        values = new Uint32Array(randomBytes.buffer);
    } while (values[0] > limit);
    return Promise.resolve(values[0] % n);
});
// Given a character set, this function will return one sufficiently random character from the charset.
const getRandomCharacterInCharset = (charset) => __awaiter(void 0, void 0, void 0, function* () {
    const count = charset.length;
    const pos = yield getRandomNumber(count);
    return Promise.resolve(charset[pos]);
});
const nodePlatform = {
    bytesToBase64: bytesToBase64,
    base64ToBytes: base64ToBytes,
    bytesToString: bytesToString,
    stringToBytes: stringToBytes,
    getRandomBytes: getRandomBytes,
    generatePrivateKey: generatePrivateKey,
    exportPublicKey: exportPublicKey,
    importKey: importKey,
    unwrap: unwrap,
    encrypt: encrypt,
    encryptWithKey: _encrypt,
    decrypt: decrypt,
    decryptWithKey: _decrypt,
    hash: hash,
    publicEncrypt: publicEncrypt,
    sign: sign,
    get: get,
    post: post,
    cleanKeyCache: cleanKeyCache,
    getHmacDigest: getHmacDigest,
    getRandomNumber: getRandomNumber,
    getRandomCharacterInCharset: getRandomCharacterInCharset
};

let packageVersion = '16.1.2';
const KEY_HOSTNAME = 'hostname'; // base url for the Secrets Manager service
const KEY_SERVER_PUBIC_KEY_ID = 'serverPublicKeyId';
const KEY_CLIENT_ID = 'clientId';
const KEY_CLIENT_KEY = 'clientKey'; // The key that is used to identify the client before public key
const KEY_APP_KEY = 'appKey'; // The application key with which all secrets are encrypted
const KEY_PRIVATE_KEY = 'privateKey'; // The client's private key
const CLIENT_ID_HASH_TAG = 'KEEPER_SECRETS_MANAGER_CLIENT_ID'; // Tag for hashing the client key to client id
let keeperPublicKeys;
const initialize = (pkgVersion) => {
    if (pkgVersion) {
        packageVersion = pkgVersion;
    }
    let keyNumber = 7;
    keeperPublicKeys = [
        'BK9w6TZFxE6nFNbMfIpULCup2a8xc6w2tUTABjxny7yFmxW0dAEojwC6j6zb5nTlmb1dAx8nwo3qF7RPYGmloRM',
        'BKnhy0obglZJK-igwthNLdknoSXRrGB-mvFRzyb_L-DKKefWjYdFD2888qN1ROczz4n3keYSfKz9Koj90Z6w_tQ',
        'BAsPQdCpLIGXdWNLdAwx-3J5lNqUtKbaOMV56hUj8VzxE2USLHuHHuKDeno0ymJt-acxWV1xPlBfNUShhRTR77g',
        'BNYIh_Sv03nRZUUJveE8d2mxKLIDXv654UbshaItHrCJhd6cT7pdZ_XwbdyxAOCWMkBb9AZ4t1XRCsM8-wkEBRg',
        'BA6uNfeYSvqagwu4TOY6wFK4JyU5C200vJna0lH4PJ-SzGVXej8l9dElyQ58_ljfPs5Rq6zVVXpdDe8A7Y3WRhk',
        'BMjTIlXfohI8TDymsHxo0DqYysCy7yZGJ80WhgOBR4QUd6LBDA6-_318a-jCGW96zxXKMm8clDTKpE8w75KG-FY',
        'BJBDU1P1H21IwIdT2brKkPqbQR0Zl0TIHf7Bz_OO9jaNgIwydMkxt4GpBmkYoprZ_DHUGOrno2faB7pmTR7HhuI',
        'BJFF8j-dH7pDEw_U347w2CBM6xYM8Dk5fPPAktjib-opOqzvvbsER-WDHM4ONCSBf9O_obAHzCyygxmtpktDuiE',
        'BDKyWBvLbyZ-jMueORl3JwJnnEpCiZdN7yUvT0vOyjwpPBCDf6zfL4RWzvSkhAAFnwOni_1tQSl8dfXHbXqXsQ8',
        'BDXyZZnrl0tc2jdC5I61JjwkjK2kr7uet9tZjt8StTiJTAQQmnVOYBgbtP08PWDbecxnHghx3kJ8QXq1XE68y8c',
        'BFX68cb97m9_sweGdOVavFM3j5ot6gveg6xT4BtGahfGhKib-zdZyO9pwvv1cBda9ahkSzo1BQ4NVXp9qRyqVGU'
    ].reduce((keys, key) => {
        keys[keyNumber++] = webSafe64ToBytes(key);
        return keys;
    }, {});
};
const prepareGetPayload = (storage, recordsFilter) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const payload = {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId
    };
    const appKey = yield storage.getBytes(KEY_APP_KEY);
    if (!appKey) {
        const publicKey = yield exports.platform.exportPublicKey(KEY_PRIVATE_KEY, storage);
        payload.publicKey = exports.platform.bytesToBase64(publicKey);
    }
    if (recordsFilter) {
        payload.requestedRecords = recordsFilter;
    }
    return payload;
});
const prepareUpdatePayload = (storage, record) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const recordBytes = exports.platform.stringToBytes(JSON.stringify(record.data));
    const encryptedRecord = yield exports.platform.encrypt(recordBytes, record.recordUid);
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        recordUid: record.recordUid,
        data: webSafe64FromBytes(encryptedRecord),
        revision: record.revision
    };
});
const postFunction = (url, transmissionKey, payload, allowUnverifiedCertificate) => __awaiter(void 0, void 0, void 0, function* () {
    return exports.platform.post(url, payload.payload, {
        PublicKeyId: transmissionKey.publicKeyId.toString(),
        TransmissionKey: exports.platform.bytesToBase64(transmissionKey.encryptedKey),
        Authorization: `Signature ${exports.platform.bytesToBase64(payload.signature)}`
    }, allowUnverifiedCertificate);
});
const generateTransmissionKey = (storage) => __awaiter(void 0, void 0, void 0, function* () {
    const transmissionKey = exports.platform.getRandomBytes(32);
    const keyNumberString = yield storage.getString(KEY_SERVER_PUBIC_KEY_ID);
    const keyNumber = keyNumberString ? Number(keyNumberString) : 7;
    const keeperPublicKey = keeperPublicKeys[keyNumber];
    if (!keeperPublicKey) {
        throw new Error(`Key number ${keyNumber} is not supported`);
    }
    const encryptedKey = yield exports.platform.publicEncrypt(transmissionKey, keeperPublicKeys[keyNumber]);
    return {
        publicKeyId: keyNumber,
        key: transmissionKey,
        encryptedKey: encryptedKey
    };
});
const encryptAndSignPayload = (storage, transmissionKey, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const payloadBytes = exports.platform.stringToBytes(JSON.stringify(payload));
    const encryptedPayload = yield exports.platform.encryptWithKey(payloadBytes, transmissionKey.key);
    const signatureBase = Uint8Array.of(...transmissionKey.encryptedKey, ...encryptedPayload);
    const signature = yield exports.platform.sign(signatureBase, KEY_PRIVATE_KEY, storage);
    return { payload: encryptedPayload, signature };
});
const postQuery = (options, path, payload) => __awaiter(void 0, void 0, void 0, function* () {
    const hostName = yield options.storage.getString(KEY_HOSTNAME);
    if (!hostName) {
        throw new Error('hostname is missing from the configuration');
    }
    const url = `https://${hostName}/api/rest/sm/v1/${path}`;
    while (true) {
        const transmissionKey = yield generateTransmissionKey(options.storage);
        const encryptedPayload = yield encryptAndSignPayload(options.storage, transmissionKey, payload);
        const response = yield (options.queryFunction || postFunction)(url, transmissionKey, encryptedPayload, options.allowUnverifiedCertificate);
        if (response.statusCode !== 200) {
            const errorMessage = exports.platform.bytesToString(response.data.slice(0, 1000));
            try {
                const errorObj = JSON.parse(errorMessage);
                if (errorObj.error === 'key') {
                    yield options.storage.saveString(KEY_SERVER_PUBIC_KEY_ID, errorObj.key_id.toString());
                    continue;
                }
            }
            catch (_a) {
            }
            throw new Error(errorMessage);
        }
        return response.data
            ? exports.platform.decryptWithKey(response.data, transmissionKey.key)
            : new Uint8Array();
    }
});
const decryptRecord = (record) => __awaiter(void 0, void 0, void 0, function* () {
    const decryptedRecord = yield exports.platform.decrypt(exports.platform.base64ToBytes(record.data), record.recordUid);
    const keeperRecord = {
        recordUid: record.recordUid,
        data: JSON.parse(exports.platform.bytesToString(decryptedRecord)),
        revision: record.revision
    };
    if (record.files) {
        keeperRecord.files = [];
        for (const file of record.files) {
            yield exports.platform.unwrap(exports.platform.base64ToBytes(file.fileKey), file.fileUid, record.recordUid);
            const decryptedFile = yield exports.platform.decrypt(exports.platform.base64ToBytes(file.data), file.fileUid);
            keeperRecord.files.push({
                fileUid: file.fileUid,
                data: JSON.parse(exports.platform.bytesToString(decryptedFile)),
                url: file.url,
                thumbnailUrl: file.thumbnailUrl
            });
        }
    }
    return keeperRecord;
});
const fetchAndDecryptSecrets = (options, recordsFilter) => __awaiter(void 0, void 0, void 0, function* () {
    const storage = options.storage;
    const payload = yield prepareGetPayload(storage, recordsFilter);
    const responseData = yield postQuery(options, 'get_secret', payload);
    const response = JSON.parse(exports.platform.bytesToString(responseData));
    const records = [];
    let justBound = false;
    if (response.encryptedAppKey) {
        justBound = true;
        yield exports.platform.unwrap(exports.platform.base64ToBytes(response.encryptedAppKey), KEY_APP_KEY, KEY_CLIENT_KEY, storage);
        yield storage.delete(KEY_CLIENT_KEY);
    }
    if (response.records) {
        for (const record of response.records) {
            yield exports.platform.unwrap(exports.platform.base64ToBytes(record.recordKey), record.recordUid, KEY_APP_KEY, storage, true);
            const decryptedRecord = yield decryptRecord(record);
            records.push(decryptedRecord);
        }
    }
    if (response.folders) {
        for (const folder of response.folders) {
            yield exports.platform.unwrap(exports.platform.base64ToBytes(folder.folderKey), folder.folderUid, KEY_APP_KEY, storage, true);
            for (const record of folder.records) {
                yield exports.platform.unwrap(exports.platform.base64ToBytes(record.recordKey), record.recordUid, folder.folderUid);
                const decryptedRecord = yield decryptRecord(record);
                decryptedRecord.folderUid = folder.folderUid;
                records.push(decryptedRecord);
            }
        }
    }
    const secrets = {
        records: records
    };
    return { secrets, justBound };
});
const getClientId = (clientKey) => __awaiter(void 0, void 0, void 0, function* () {
    const clientKeyHash = yield exports.platform.hash(webSafe64ToBytes(clientKey), CLIENT_ID_HASH_TAG);
    return exports.platform.bytesToBase64(clientKeyHash);
});
const initializeStorage = (storage, oneTimeToken, hostName) => __awaiter(void 0, void 0, void 0, function* () {
    const tokenParts = oneTimeToken.split(':');
    let host, clientKey;
    if (tokenParts.length === 1) {
        if (!hostName) {
            throw new Error('The hostname must be present in the token or as a parameter');
        }
        host = hostName;
        clientKey = oneTimeToken;
    }
    else {
        host = {
            US: 'keepersecurity.com',
            EU: 'keepersecurity.eu',
            AU: 'keepersecurity.com.au'
        }[tokenParts[0].toUpperCase()];
        if (!host) {
            host = tokenParts[0];
        }
        clientKey = tokenParts[1];
    }
    const clientKeyBytes = webSafe64ToBytes(clientKey);
    const clientKeyHash = yield exports.platform.hash(clientKeyBytes, CLIENT_ID_HASH_TAG);
    const clientId = exports.platform.bytesToBase64(clientKeyHash);
    const existingClientId = yield storage.getString(KEY_CLIENT_ID);
    if (existingClientId) {
        if (existingClientId === clientId) {
            return; // the storage is already initialized
        }
        throw new Error(`The storage is already initialized with a different client Id (${existingClientId})`);
    }
    yield storage.saveString(KEY_HOSTNAME, host);
    yield storage.saveString(KEY_CLIENT_ID, clientId);
    yield exports.platform.importKey(KEY_CLIENT_KEY, clientKeyBytes, storage);
    yield exports.platform.generatePrivateKey(KEY_PRIVATE_KEY, storage);
});
const getSecrets = (options, recordsFilter) => __awaiter(void 0, void 0, void 0, function* () {
    exports.platform.cleanKeyCache();
    const { secrets, justBound } = yield fetchAndDecryptSecrets(options, recordsFilter);
    if (justBound) {
        try {
            yield fetchAndDecryptSecrets(options, recordsFilter);
        }
        catch (e) {
            console.error(e);
        }
    }
    return secrets;
});
const updateSecret = (options, record) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield prepareUpdatePayload(options.storage, record);
    yield postQuery(options, 'update_secret', payload);
});
const downloadFile = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const fileResponse = yield exports.platform.get(file.url, {});
    return exports.platform.decrypt(fileResponse.data, file.fileUid);
});
const downloadThumbnail = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const fileResponse = yield exports.platform.get(file.thumbnailUrl, {});
    return exports.platform.decrypt(fileResponse.data, file.fileUid);
});

function getValue(secrets, notation) {
    const schemaNotation = notation.split('://');
    if (schemaNotation.length > 1) {
        if (schemaNotation[0] !== 'keeper') {
            throw Error(`Invalid notation schema: ${schemaNotation[0]}`);
        }
        notation = notation.slice(9);
    }
    const notationParts = notation.split('/');
    if (notationParts.length < 3) {
        throw Error(`Invalid notation ${notation}`);
    }
    const record = secrets.records.find(x => x.recordUid === notationParts[0]);
    if (!record) {
        throw Error(`Record ${notationParts[0]} not found`);
    }
    let fields;
    switch (notationParts[1]) {
        case 'field':
            fields = record.data.fields;
            break;
        case 'custom_field':
            fields = record.data.custom;
            break;
        case 'file':
            const fileId = notationParts[2];
            const file = (record.files || []).find(x => x.data.title === fileId || x.data.name === fileId);
            if (!file) {
                throw Error(`File ${fileId} not found in the record ${record.recordUid}`);
            }
            return file;
        default:
            throw Error(`Expected /field or /custom_field but found /${notationParts[1]}`);
    }
    const findField = (fieldName) => {
        const field = fields.find(x => x.label === fieldName || x.type === fieldName);
        if (!field) {
            throw Error(`Field ${fieldName} not found in the record ${record.recordUid}`);
        }
        return field;
    };
    if (notationParts[2].endsWith('[]')) {
        return findField(notationParts[2].slice(0, -2)).value;
    }
    const fieldParts = notationParts[2]
        .replace(/[\[\]]/g, '/')
        .split('/')
        .filter(x => x);
    const field = findField(fieldParts[0]);
    if (fieldParts.length === 1) {
        return field.value[0];
    }
    const fieldValueIdx = parseInt(fieldParts[1]);
    if (isNaN(fieldValueIdx)) {
        return field.value[0][fieldParts[1]];
    }
    if (fieldValueIdx < 0 || fieldValueIdx >= field.value.length) {
        throw Error(`The index ${fieldValueIdx} for field value of ${fieldParts[0]} in the record ${record.recordUid} is out of range (${field.value.length - 1})`);
    }
    return fieldParts.length === 2
        ? field.value[fieldValueIdx]
        : field.value[fieldValueIdx][fieldParts[2]];
}

const localConfigStorage = (configName) => {
    const readStorage = () => {
        if (!configName) {
            return {};
        }
        try {
            return JSON.parse(fs__namespace.readFileSync(configName).toString());
        }
        catch (e) {
            return {};
        }
    };
    const storageData = readStorage();
    const storage = inMemoryStorage(storageData);
    const saveStorage = (storage) => {
        if (!configName) {
            return;
        }
        fs__namespace.writeFileSync(configName, JSON.stringify(storageData, null, 2));
    };
    return {
        getString: storage.getString,
        saveString: (key, value) => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.saveString(key, value);
            saveStorage();
            return Promise.resolve();
        }),
        getBytes: storage.getBytes,
        saveBytes: (key, value) => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.saveBytes(key, value);
            saveStorage();
            return Promise.resolve();
        }),
        delete: (key) => __awaiter(void 0, void 0, void 0, function* () {
            yield storage.delete(key);
            saveStorage();
            return Promise.resolve();
        })
    };
};
const cachingPostFunction = (url, transmissionKey, payload) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield exports.platform.post(url, payload.payload, {
            PublicKeyId: transmissionKey.publicKeyId.toString(),
            TransmissionKey: exports.platform.bytesToBase64(transmissionKey.encryptedKey),
            Authorization: `Signature ${exports.platform.bytesToBase64(payload.signature)}`
        });
        if (response.statusCode == 200) {
            fs__namespace.writeFileSync('cache.dat', Buffer.concat([transmissionKey.key, response.data]));
        }
        return response;
    }
    catch (e) {
        let cachedData;
        try {
            cachedData = fs__namespace.readFileSync('cache.dat');
        }
        catch (_a) {
        }
        if (!cachedData) {
            throw new Error('Cached value does not exist');
        }
        transmissionKey.key = cachedData.slice(0, 32);
        return {
            statusCode: 200,
            data: cachedData.slice(32),
            headers: []
        };
    }
});

connectPlatform(nodePlatform);
initialize();

exports.cachingPostFunction = cachingPostFunction;
exports.connectPlatform = connectPlatform;
exports.downloadFile = downloadFile;
exports.downloadThumbnail = downloadThumbnail;
exports.generatePassword = generatePassword;
exports.generateTransmissionKey = generateTransmissionKey;
exports.getClientId = getClientId;
exports.getSecrets = getSecrets;
exports.getTotpCode = getTotpCode;
exports.getValue = getValue;
exports.inMemoryStorage = inMemoryStorage;
exports.initialize = initialize;
exports.initializeStorage = initializeStorage;
exports.loadJsonConfig = loadJsonConfig;
exports.localConfigStorage = localConfigStorage;
exports.updateSecret = updateSecret;
//# sourceMappingURL=index.cjs.js.map


/***/ }),

/***/ 294:
/***/ ((module, __unused_webpack_exports, __nccwpck_require__) => {

module.exports = __nccwpck_require__(219);


/***/ }),

/***/ 219:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


var net = __nccwpck_require__(808);
var tls = __nccwpck_require__(404);
var http = __nccwpck_require__(685);
var https = __nccwpck_require__(687);
var events = __nccwpck_require__(361);
var assert = __nccwpck_require__(491);
var util = __nccwpck_require__(837);


exports.httpOverHttp = httpOverHttp;
exports.httpsOverHttp = httpsOverHttp;
exports.httpOverHttps = httpOverHttps;
exports.httpsOverHttps = httpsOverHttps;


function httpOverHttp(options) {
  var agent = new TunnelingAgent(options);
  agent.request = http.request;
  return agent;
}

function httpsOverHttp(options) {
  var agent = new TunnelingAgent(options);
  agent.request = http.request;
  agent.createSocket = createSecureSocket;
  agent.defaultPort = 443;
  return agent;
}

function httpOverHttps(options) {
  var agent = new TunnelingAgent(options);
  agent.request = https.request;
  return agent;
}

function httpsOverHttps(options) {
  var agent = new TunnelingAgent(options);
  agent.request = https.request;
  agent.createSocket = createSecureSocket;
  agent.defaultPort = 443;
  return agent;
}


function TunnelingAgent(options) {
  var self = this;
  self.options = options || {};
  self.proxyOptions = self.options.proxy || {};
  self.maxSockets = self.options.maxSockets || http.Agent.defaultMaxSockets;
  self.requests = [];
  self.sockets = [];

  self.on('free', function onFree(socket, host, port, localAddress) {
    var options = toOptions(host, port, localAddress);
    for (var i = 0, len = self.requests.length; i < len; ++i) {
      var pending = self.requests[i];
      if (pending.host === options.host && pending.port === options.port) {
        // Detect the request to connect same origin server,
        // reuse the connection.
        self.requests.splice(i, 1);
        pending.request.onSocket(socket);
        return;
      }
    }
    socket.destroy();
    self.removeSocket(socket);
  });
}
util.inherits(TunnelingAgent, events.EventEmitter);

TunnelingAgent.prototype.addRequest = function addRequest(req, host, port, localAddress) {
  var self = this;
  var options = mergeOptions({request: req}, self.options, toOptions(host, port, localAddress));

  if (self.sockets.length >= this.maxSockets) {
    // We are over limit so we'll add it to the queue.
    self.requests.push(options);
    return;
  }

  // If we are under maxSockets create a new one.
  self.createSocket(options, function(socket) {
    socket.on('free', onFree);
    socket.on('close', onCloseOrRemove);
    socket.on('agentRemove', onCloseOrRemove);
    req.onSocket(socket);

    function onFree() {
      self.emit('free', socket, options);
    }

    function onCloseOrRemove(err) {
      self.removeSocket(socket);
      socket.removeListener('free', onFree);
      socket.removeListener('close', onCloseOrRemove);
      socket.removeListener('agentRemove', onCloseOrRemove);
    }
  });
};

TunnelingAgent.prototype.createSocket = function createSocket(options, cb) {
  var self = this;
  var placeholder = {};
  self.sockets.push(placeholder);

  var connectOptions = mergeOptions({}, self.proxyOptions, {
    method: 'CONNECT',
    path: options.host + ':' + options.port,
    agent: false,
    headers: {
      host: options.host + ':' + options.port
    }
  });
  if (options.localAddress) {
    connectOptions.localAddress = options.localAddress;
  }
  if (connectOptions.proxyAuth) {
    connectOptions.headers = connectOptions.headers || {};
    connectOptions.headers['Proxy-Authorization'] = 'Basic ' +
        new Buffer(connectOptions.proxyAuth).toString('base64');
  }

  debug('making CONNECT request');
  var connectReq = self.request(connectOptions);
  connectReq.useChunkedEncodingByDefault = false; // for v0.6
  connectReq.once('response', onResponse); // for v0.6
  connectReq.once('upgrade', onUpgrade);   // for v0.6
  connectReq.once('connect', onConnect);   // for v0.7 or later
  connectReq.once('error', onError);
  connectReq.end();

  function onResponse(res) {
    // Very hacky. This is necessary to avoid http-parser leaks.
    res.upgrade = true;
  }

  function onUpgrade(res, socket, head) {
    // Hacky.
    process.nextTick(function() {
      onConnect(res, socket, head);
    });
  }

  function onConnect(res, socket, head) {
    connectReq.removeAllListeners();
    socket.removeAllListeners();

    if (res.statusCode !== 200) {
      debug('tunneling socket could not be established, statusCode=%d',
        res.statusCode);
      socket.destroy();
      var error = new Error('tunneling socket could not be established, ' +
        'statusCode=' + res.statusCode);
      error.code = 'ECONNRESET';
      options.request.emit('error', error);
      self.removeSocket(placeholder);
      return;
    }
    if (head.length > 0) {
      debug('got illegal response body from proxy');
      socket.destroy();
      var error = new Error('got illegal response body from proxy');
      error.code = 'ECONNRESET';
      options.request.emit('error', error);
      self.removeSocket(placeholder);
      return;
    }
    debug('tunneling connection has established');
    self.sockets[self.sockets.indexOf(placeholder)] = socket;
    return cb(socket);
  }

  function onError(cause) {
    connectReq.removeAllListeners();

    debug('tunneling socket could not be established, cause=%s\n',
          cause.message, cause.stack);
    var error = new Error('tunneling socket could not be established, ' +
                          'cause=' + cause.message);
    error.code = 'ECONNRESET';
    options.request.emit('error', error);
    self.removeSocket(placeholder);
  }
};

TunnelingAgent.prototype.removeSocket = function removeSocket(socket) {
  var pos = this.sockets.indexOf(socket)
  if (pos === -1) {
    return;
  }
  this.sockets.splice(pos, 1);

  var pending = this.requests.shift();
  if (pending) {
    // If we have pending requests and a socket gets closed a new one
    // needs to be created to take over in the pool for the one that closed.
    this.createSocket(pending, function(socket) {
      pending.request.onSocket(socket);
    });
  }
};

function createSecureSocket(options, cb) {
  var self = this;
  TunnelingAgent.prototype.createSocket.call(self, options, function(socket) {
    var hostHeader = options.request.getHeader('host');
    var tlsOptions = mergeOptions({}, self.options, {
      socket: socket,
      servername: hostHeader ? hostHeader.replace(/:.*$/, '') : options.host
    });

    // 0 is dummy port for v0.6
    var secureSocket = tls.connect(0, tlsOptions);
    self.sockets[self.sockets.indexOf(socket)] = secureSocket;
    cb(secureSocket);
  });
}


function toOptions(host, port, localAddress) {
  if (typeof host === 'string') { // since v0.10
    return {
      host: host,
      port: port,
      localAddress: localAddress
    };
  }
  return host; // for v0.11 or later
}

function mergeOptions(target) {
  for (var i = 1, len = arguments.length; i < len; ++i) {
    var overrides = arguments[i];
    if (typeof overrides === 'object') {
      var keys = Object.keys(overrides);
      for (var j = 0, keyLen = keys.length; j < keyLen; ++j) {
        var k = keys[j];
        if (overrides[k] !== undefined) {
          target[k] = overrides[k];
        }
      }
    }
  }
  return target;
}


var debug;
if (process.env.NODE_DEBUG && /\btunnel\b/.test(process.env.NODE_DEBUG)) {
  debug = function() {
    var args = Array.prototype.slice.call(arguments);
    if (typeof args[0] === 'string') {
      args[0] = 'TUNNEL: ' + args[0];
    } else {
      args.unshift('TUNNEL:');
    }
    console.error.apply(console, args);
  }
} else {
  debug = function() {};
}
exports.debug = debug; // for test


/***/ }),

/***/ 491:
/***/ ((module) => {

"use strict";
module.exports = require("assert");

/***/ }),

/***/ 113:
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ 361:
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ 147:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 685:
/***/ ((module) => {

"use strict";
module.exports = require("http");

/***/ }),

/***/ 687:
/***/ ((module) => {

"use strict";
module.exports = require("https");

/***/ }),

/***/ 808:
/***/ ((module) => {

"use strict";
module.exports = require("net");

/***/ }),

/***/ 37:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 17:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ 404:
/***/ ((module) => {

"use strict";
module.exports = require("tls");

/***/ }),

/***/ 837:
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(109);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map