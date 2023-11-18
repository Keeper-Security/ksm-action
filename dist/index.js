require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 109:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
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
const splitInput = (text) => {
    const n = text.lastIndexOf('>');
    if (n < 0)
        return [text, ''];
    const notation = text.substring(0, n);
    const destination = text.substring(n + 1);
    return [notation.trimEnd(), destination.trimStart()];
};
const parseSecretsInputs = (inputs) => {
    const results = [];
    for (const input of inputs) {
        core.debug(`inputParts=[${input}]`);
        const inputParts = splitInput(input);
        let [uid, selector] = ['', ''];
        try {
            const notation = (0, secrets_manager_core_1.parseNotation)(inputParts[0]);
            uid = notation[1].text ? notation[1].text[0] : '';
            selector = notation[2].text ? notation[2].text[0] : '';
        }
        catch (error) {
            core.error(`Failed to parse KSM Notation: ${error instanceof Error ? error.message : ''}`);
        }
        let destinationType = DestinationType.output;
        let destination = inputParts[1];
        core.debug(`destination=[${destination}]`);
        if (destination.startsWith('env:')) {
            destinationType = DestinationType.environment;
            destination = destination.slice(4);
        }
        else if (destination.startsWith('file:')) {
            destinationType = DestinationType.file;
            destination = destination.slice(5);
        }
        if (selector === 'file') {
            destinationType = DestinationType.file;
        }
        core.debug(`notation=[${inputParts[0]}], destinationType=[${destinationType}], destination=[${destination}], secret=[${uid}]`);
        results.push({
            uid,
            selector,
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
        set.add(input.uid);
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
        if (!config) {
            core.error('Configuration string is empty. Looks like secret was not located in your environment. Did you forget include "environment" to the job?');
            core.setFailed('Configuration string is empty');
            return;
        }
        const inputs = (0, exports.parseSecretsInputs)(core.getMultilineInput('secrets'));
        core.debug('Retrieving Secrets from KSM...');
        const options = { storage: (0, secrets_manager_core_1.loadJsonConfig)(config) };
        const rxUid = new RegExp('^[A-Za-z0-9_-]{22}$');
        const recordUids = (0, exports.getRecordUids)(inputs);
        const hasTitles = recordUids.some(function (e) {
            return !rxUid.test(e);
        });
        let uidFilter = recordUids && !hasTitles ? recordUids : undefined;
        let secrets = yield (0, secrets_manager_core_1.getSecrets)(options, uidFilter);
        // there's a slight chance a valid title to match a recordUID (22 url-safe base64 chars)
        // or a missing record or record not shared to the KSM App - we need to pull all records
        if (uidFilter && secrets.records.length < recordUids.length) {
            uidFilter = undefined;
            core.debug(`KSM Didn't get expected num records - requesting all (search by title or missing UID /not shared to the app/)`);
            secrets = yield (0, secrets_manager_core_1.getSecrets)(options, uidFilter);
        }
        core.debug(`Retrieved [${secrets.records.length}] secrets`);
        if (secrets.warnings) {
            // Print warnings if the backend find issues with the requested records
            for (const warningMessage of secrets.warnings) {
                core.warning(warningMessage);
            }
        }
        for (const input of inputs) {
            core.debug(`Retrieving secret value using notation [${input.notation}]`);
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
            core.error(error.stack || 'No stack');
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
        return file_command_1.issueFileCommand('ENV', file_command_1.prepareKeyValueMessage(name, val));
    }
    command_1.issueCommand('set-env', { name }, convertedVal);
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
        file_command_1.issueFileCommand('PATH', inputPath);
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
    if (options && options.trimWhitespace === false) {
        return inputs;
    }
    return inputs.map(input => input.trim());
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
    const filePath = process.env['GITHUB_OUTPUT'] || '';
    if (filePath) {
        return file_command_1.issueFileCommand('OUTPUT', file_command_1.prepareKeyValueMessage(name, value));
    }
    process.stdout.write(os.EOL);
    command_1.issueCommand('set-output', { name }, utils_1.toCommandValue(value));
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
    const filePath = process.env['GITHUB_STATE'] || '';
    if (filePath) {
        return file_command_1.issueFileCommand('STATE', file_command_1.prepareKeyValueMessage(name, value));
    }
    command_1.issueCommand('save-state', { name }, utils_1.toCommandValue(value));
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
/**
 * Summary exports
 */
var summary_1 = __nccwpck_require__(327);
Object.defineProperty(exports, "summary", ({ enumerable: true, get: function () { return summary_1.summary; } }));
/**
 * @deprecated use core.summary
 */
var summary_2 = __nccwpck_require__(327);
Object.defineProperty(exports, "markdownSummary", ({ enumerable: true, get: function () { return summary_2.markdownSummary; } }));
/**
 * Path exports
 */
var path_utils_1 = __nccwpck_require__(981);
Object.defineProperty(exports, "toPosixPath", ({ enumerable: true, get: function () { return path_utils_1.toPosixPath; } }));
Object.defineProperty(exports, "toWin32Path", ({ enumerable: true, get: function () { return path_utils_1.toWin32Path; } }));
Object.defineProperty(exports, "toPlatformPath", ({ enumerable: true, get: function () { return path_utils_1.toPlatformPath; } }));
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
exports.prepareKeyValueMessage = exports.issueFileCommand = void 0;
// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
const fs = __importStar(__nccwpck_require__(147));
const os = __importStar(__nccwpck_require__(37));
const uuid_1 = __nccwpck_require__(840);
const utils_1 = __nccwpck_require__(278);
function issueFileCommand(command, message) {
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
exports.issueFileCommand = issueFileCommand;
function prepareKeyValueMessage(key, value) {
    const delimiter = `ghadelimiter_${uuid_1.v4()}`;
    const convertedValue = utils_1.toCommandValue(value);
    // These should realistically never happen, but just in case someone finds a
    // way to exploit uuid generation let's not allow keys or values that contain
    // the delimiter.
    if (key.includes(delimiter)) {
        throw new Error(`Unexpected input: name should not contain the delimiter "${delimiter}"`);
    }
    if (convertedValue.includes(delimiter)) {
        throw new Error(`Unexpected input: value should not contain the delimiter "${delimiter}"`);
    }
    return `${key}<<${delimiter}${os.EOL}${convertedValue}${os.EOL}${delimiter}`;
}
exports.prepareKeyValueMessage = prepareKeyValueMessage;
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
const http_client_1 = __nccwpck_require__(255);
const auth_1 = __nccwpck_require__(526);
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

/***/ 981:
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
exports.toPlatformPath = exports.toWin32Path = exports.toPosixPath = void 0;
const path = __importStar(__nccwpck_require__(17));
/**
 * toPosixPath converts the given path to the posix form. On Windows, \\ will be
 * replaced with /.
 *
 * @param pth. Path to transform.
 * @return string Posix path.
 */
function toPosixPath(pth) {
    return pth.replace(/[\\]/g, '/');
}
exports.toPosixPath = toPosixPath;
/**
 * toWin32Path converts the given path to the win32 form. On Linux, / will be
 * replaced with \\.
 *
 * @param pth. Path to transform.
 * @return string Win32 path.
 */
function toWin32Path(pth) {
    return pth.replace(/[/]/g, '\\');
}
exports.toWin32Path = toWin32Path;
/**
 * toPlatformPath converts the given path to a platform-specific path. It does
 * this by replacing instances of / and \ with the platform-specific path
 * separator.
 *
 * @param pth The path to platformize.
 * @return string The platform-specific path.
 */
function toPlatformPath(pth) {
    return pth.replace(/[/\\]/g, path.sep);
}
exports.toPlatformPath = toPlatformPath;
//# sourceMappingURL=path-utils.js.map

/***/ }),

/***/ 327:
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
exports.summary = exports.markdownSummary = exports.SUMMARY_DOCS_URL = exports.SUMMARY_ENV_VAR = void 0;
const os_1 = __nccwpck_require__(37);
const fs_1 = __nccwpck_require__(147);
const { access, appendFile, writeFile } = fs_1.promises;
exports.SUMMARY_ENV_VAR = 'GITHUB_STEP_SUMMARY';
exports.SUMMARY_DOCS_URL = 'https://docs.github.com/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary';
class Summary {
    constructor() {
        this._buffer = '';
    }
    /**
     * Finds the summary file path from the environment, rejects if env var is not found or file does not exist
     * Also checks r/w permissions.
     *
     * @returns step summary file path
     */
    filePath() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._filePath) {
                return this._filePath;
            }
            const pathFromEnv = process.env[exports.SUMMARY_ENV_VAR];
            if (!pathFromEnv) {
                throw new Error(`Unable to find environment variable for $${exports.SUMMARY_ENV_VAR}. Check if your runtime environment supports job summaries.`);
            }
            try {
                yield access(pathFromEnv, fs_1.constants.R_OK | fs_1.constants.W_OK);
            }
            catch (_a) {
                throw new Error(`Unable to access summary file: '${pathFromEnv}'. Check if the file has correct read/write permissions.`);
            }
            this._filePath = pathFromEnv;
            return this._filePath;
        });
    }
    /**
     * Wraps content in an HTML tag, adding any HTML attributes
     *
     * @param {string} tag HTML tag to wrap
     * @param {string | null} content content within the tag
     * @param {[attribute: string]: string} attrs key-value list of HTML attributes to add
     *
     * @returns {string} content wrapped in HTML element
     */
    wrap(tag, content, attrs = {}) {
        const htmlAttrs = Object.entries(attrs)
            .map(([key, value]) => ` ${key}="${value}"`)
            .join('');
        if (!content) {
            return `<${tag}${htmlAttrs}>`;
        }
        return `<${tag}${htmlAttrs}>${content}</${tag}>`;
    }
    /**
     * Writes text in the buffer to the summary buffer file and empties buffer. Will append by default.
     *
     * @param {SummaryWriteOptions} [options] (optional) options for write operation
     *
     * @returns {Promise<Summary>} summary instance
     */
    write(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const overwrite = !!(options === null || options === void 0 ? void 0 : options.overwrite);
            const filePath = yield this.filePath();
            const writeFunc = overwrite ? writeFile : appendFile;
            yield writeFunc(filePath, this._buffer, { encoding: 'utf8' });
            return this.emptyBuffer();
        });
    }
    /**
     * Clears the summary buffer and wipes the summary file
     *
     * @returns {Summary} summary instance
     */
    clear() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.emptyBuffer().write({ overwrite: true });
        });
    }
    /**
     * Returns the current summary buffer as a string
     *
     * @returns {string} string of summary buffer
     */
    stringify() {
        return this._buffer;
    }
    /**
     * If the summary buffer is empty
     *
     * @returns {boolen} true if the buffer is empty
     */
    isEmptyBuffer() {
        return this._buffer.length === 0;
    }
    /**
     * Resets the summary buffer without writing to summary file
     *
     * @returns {Summary} summary instance
     */
    emptyBuffer() {
        this._buffer = '';
        return this;
    }
    /**
     * Adds raw text to the summary buffer
     *
     * @param {string} text content to add
     * @param {boolean} [addEOL=false] (optional) append an EOL to the raw text (default: false)
     *
     * @returns {Summary} summary instance
     */
    addRaw(text, addEOL = false) {
        this._buffer += text;
        return addEOL ? this.addEOL() : this;
    }
    /**
     * Adds the operating system-specific end-of-line marker to the buffer
     *
     * @returns {Summary} summary instance
     */
    addEOL() {
        return this.addRaw(os_1.EOL);
    }
    /**
     * Adds an HTML codeblock to the summary buffer
     *
     * @param {string} code content to render within fenced code block
     * @param {string} lang (optional) language to syntax highlight code
     *
     * @returns {Summary} summary instance
     */
    addCodeBlock(code, lang) {
        const attrs = Object.assign({}, (lang && { lang }));
        const element = this.wrap('pre', this.wrap('code', code), attrs);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML list to the summary buffer
     *
     * @param {string[]} items list of items to render
     * @param {boolean} [ordered=false] (optional) if the rendered list should be ordered or not (default: false)
     *
     * @returns {Summary} summary instance
     */
    addList(items, ordered = false) {
        const tag = ordered ? 'ol' : 'ul';
        const listItems = items.map(item => this.wrap('li', item)).join('');
        const element = this.wrap(tag, listItems);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML table to the summary buffer
     *
     * @param {SummaryTableCell[]} rows table rows
     *
     * @returns {Summary} summary instance
     */
    addTable(rows) {
        const tableBody = rows
            .map(row => {
            const cells = row
                .map(cell => {
                if (typeof cell === 'string') {
                    return this.wrap('td', cell);
                }
                const { header, data, colspan, rowspan } = cell;
                const tag = header ? 'th' : 'td';
                const attrs = Object.assign(Object.assign({}, (colspan && { colspan })), (rowspan && { rowspan }));
                return this.wrap(tag, data, attrs);
            })
                .join('');
            return this.wrap('tr', cells);
        })
            .join('');
        const element = this.wrap('table', tableBody);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds a collapsable HTML details element to the summary buffer
     *
     * @param {string} label text for the closed state
     * @param {string} content collapsable content
     *
     * @returns {Summary} summary instance
     */
    addDetails(label, content) {
        const element = this.wrap('details', this.wrap('summary', label) + content);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML image tag to the summary buffer
     *
     * @param {string} src path to the image you to embed
     * @param {string} alt text description of the image
     * @param {SummaryImageOptions} options (optional) addition image attributes
     *
     * @returns {Summary} summary instance
     */
    addImage(src, alt, options) {
        const { width, height } = options || {};
        const attrs = Object.assign(Object.assign({}, (width && { width })), (height && { height }));
        const element = this.wrap('img', null, Object.assign({ src, alt }, attrs));
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML section heading element
     *
     * @param {string} text heading text
     * @param {number | string} [level=1] (optional) the heading level, default: 1
     *
     * @returns {Summary} summary instance
     */
    addHeading(text, level) {
        const tag = `h${level}`;
        const allowedTag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)
            ? tag
            : 'h1';
        const element = this.wrap(allowedTag, text);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML thematic break (<hr>) to the summary buffer
     *
     * @returns {Summary} summary instance
     */
    addSeparator() {
        const element = this.wrap('hr', null);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML line break (<br>) to the summary buffer
     *
     * @returns {Summary} summary instance
     */
    addBreak() {
        const element = this.wrap('br', null);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML blockquote to the summary buffer
     *
     * @param {string} text quote text
     * @param {string} cite (optional) citation url
     *
     * @returns {Summary} summary instance
     */
    addQuote(text, cite) {
        const attrs = Object.assign({}, (cite && { cite }));
        const element = this.wrap('blockquote', text, attrs);
        return this.addRaw(element).addEOL();
    }
    /**
     * Adds an HTML anchor tag to the summary buffer
     *
     * @param {string} text link text/content
     * @param {string} href hyperlink
     *
     * @returns {Summary} summary instance
     */
    addLink(text, href) {
        const element = this.wrap('a', text, { href });
        return this.addRaw(element).addEOL();
    }
}
const _summary = new Summary();
/**
 * @deprecated use `core.summary`
 */
exports.markdownSummary = _summary;
exports.summary = _summary;
//# sourceMappingURL=summary.js.map

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

/***/ 526:
/***/ (function(__unused_webpack_module, exports) {

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
exports.PersonalAccessTokenCredentialHandler = exports.BearerCredentialHandler = exports.BasicCredentialHandler = void 0;
class BasicCredentialHandler {
    constructor(username, password) {
        this.username = username;
        this.password = password;
    }
    prepareRequest(options) {
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
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
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Bearer ${this.token}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
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
        if (!options.headers) {
            throw Error('The request has no headers');
        }
        options.headers['Authorization'] = `Basic ${Buffer.from(`PAT:${this.token}`).toString('base64')}`;
    }
    // This handler cannot handle 401
    canHandleAuthentication() {
        return false;
    }
    handleAuthentication() {
        return __awaiter(this, void 0, void 0, function* () {
            throw new Error('not implemented');
        });
    }
}
exports.PersonalAccessTokenCredentialHandler = PersonalAccessTokenCredentialHandler;
//# sourceMappingURL=auth.js.map

/***/ }),

/***/ 255:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {

"use strict";

/* eslint-disable @typescript-eslint/no-explicit-any */
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
exports.HttpClient = exports.isHttps = exports.HttpClientResponse = exports.HttpClientError = exports.getProxyUrl = exports.MediaTypes = exports.Headers = exports.HttpCodes = void 0;
const http = __importStar(__nccwpck_require__(685));
const https = __importStar(__nccwpck_require__(687));
const pm = __importStar(__nccwpck_require__(835));
const tunnel = __importStar(__nccwpck_require__(294));
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
    const proxyUrl = pm.getProxyUrl(new URL(serverUrl));
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
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                let output = Buffer.alloc(0);
                this.message.on('data', (chunk) => {
                    output = Buffer.concat([output, chunk]);
                });
                this.message.on('end', () => {
                    resolve(output.toString());
                });
            }));
        });
    }
}
exports.HttpClientResponse = HttpClientResponse;
function isHttps(requestUrl) {
    const parsedUrl = new URL(requestUrl);
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
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('OPTIONS', requestUrl, null, additionalHeaders || {});
        });
    }
    get(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('GET', requestUrl, null, additionalHeaders || {});
        });
    }
    del(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('DELETE', requestUrl, null, additionalHeaders || {});
        });
    }
    post(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('POST', requestUrl, data, additionalHeaders || {});
        });
    }
    patch(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('PATCH', requestUrl, data, additionalHeaders || {});
        });
    }
    put(requestUrl, data, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('PUT', requestUrl, data, additionalHeaders || {});
        });
    }
    head(requestUrl, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request('HEAD', requestUrl, null, additionalHeaders || {});
        });
    }
    sendStream(verb, requestUrl, stream, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.request(verb, requestUrl, stream, additionalHeaders);
        });
    }
    /**
     * Gets a typed object from an endpoint
     * Be aware that not found returns a null.  Other errors (4xx, 5xx) reject the promise
     */
    getJson(requestUrl, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            const res = yield this.get(requestUrl, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    postJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.post(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    putJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.put(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    patchJson(requestUrl, obj, additionalHeaders = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = JSON.stringify(obj, null, 2);
            additionalHeaders[Headers.Accept] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.Accept, MediaTypes.ApplicationJson);
            additionalHeaders[Headers.ContentType] = this._getExistingOrDefaultHeader(additionalHeaders, Headers.ContentType, MediaTypes.ApplicationJson);
            const res = yield this.patch(requestUrl, data, additionalHeaders);
            return this._processResponse(res, this.requestOptions);
        });
    }
    /**
     * Makes a raw http request.
     * All other methods such as get, post, patch, and request ultimately call this.
     * Prefer get, del, post and patch
     */
    request(verb, requestUrl, data, headers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this._disposed) {
                throw new Error('Client has already been disposed.');
            }
            const parsedUrl = new URL(requestUrl);
            let info = this._prepareRequest(verb, parsedUrl, headers);
            // Only perform retries on reads since writes may not be idempotent.
            const maxTries = this._allowRetries && RetryableHttpVerbs.includes(verb)
                ? this._maxRetries + 1
                : 1;
            let numTries = 0;
            let response;
            do {
                response = yield this.requestRaw(info, data);
                // Check if it's an authentication challenge
                if (response &&
                    response.message &&
                    response.message.statusCode === HttpCodes.Unauthorized) {
                    let authenticationHandler;
                    for (const handler of this.handlers) {
                        if (handler.canHandleAuthentication(response)) {
                            authenticationHandler = handler;
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
                while (response.message.statusCode &&
                    HttpRedirectCodes.includes(response.message.statusCode) &&
                    this._allowRedirects &&
                    redirectsRemaining > 0) {
                    const redirectUrl = response.message.headers['location'];
                    if (!redirectUrl) {
                        // if there's no location to redirect to, we won't
                        break;
                    }
                    const parsedRedirectUrl = new URL(redirectUrl);
                    if (parsedUrl.protocol === 'https:' &&
                        parsedUrl.protocol !== parsedRedirectUrl.protocol &&
                        !this._allowRedirectDowngrade) {
                        throw new Error('Redirect from HTTPS to HTTP protocol. This downgrade is not allowed for security reasons. If you want to allow this behavior, set the allowRedirectDowngrade option to true.');
                    }
                    // we need to finish reading the response before reassigning response
                    // which will leak the open socket.
                    yield response.readBody();
                    // strip authorization header if redirected to a different hostname
                    if (parsedRedirectUrl.hostname !== parsedUrl.hostname) {
                        for (const header in headers) {
                            // header names are case insensitive
                            if (header.toLowerCase() === 'authorization') {
                                delete headers[header];
                            }
                        }
                    }
                    // let's make the request with the new redirectUrl
                    info = this._prepareRequest(verb, parsedRedirectUrl, headers);
                    response = yield this.requestRaw(info, data);
                    redirectsRemaining--;
                }
                if (!response.message.statusCode ||
                    !HttpResponseRetryCodes.includes(response.message.statusCode)) {
                    // If not a retry code, return immediately instead of retrying
                    return response;
                }
                numTries += 1;
                if (numTries < maxTries) {
                    yield response.readBody();
                    yield this._performExponentialBackoff(numTries);
                }
            } while (numTries < maxTries);
            return response;
        });
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
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                function callbackForResult(err, res) {
                    if (err) {
                        reject(err);
                    }
                    else if (!res) {
                        // If `err` is not passed, then `res` must be passed.
                        reject(new Error('Unknown error'));
                    }
                    else {
                        resolve(res);
                    }
                }
                this.requestRawWithCallback(info, data, callbackForResult);
            });
        });
    }
    /**
     * Raw request with callback.
     * @param info
     * @param data
     * @param onResult
     */
    requestRawWithCallback(info, data, onResult) {
        if (typeof data === 'string') {
            if (!info.options.headers) {
                info.options.headers = {};
            }
            info.options.headers['Content-Length'] = Buffer.byteLength(data, 'utf8');
        }
        let callbackCalled = false;
        function handleResult(err, res) {
            if (!callbackCalled) {
                callbackCalled = true;
                onResult(err, res);
            }
        }
        const req = info.httpModule.request(info.options, (msg) => {
            const res = new HttpClientResponse(msg);
            handleResult(undefined, res);
        });
        let socket;
        req.on('socket', sock => {
            socket = sock;
        });
        // If we ever get disconnected, we want the socket to timeout eventually
        req.setTimeout(this._socketTimeout || 3 * 60000, () => {
            if (socket) {
                socket.end();
            }
            handleResult(new Error(`Request timeout: ${info.options.path}`));
        });
        req.on('error', function (err) {
            // err has statusCode property
            // res should have headers
            handleResult(err);
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
        const parsedUrl = new URL(serverUrl);
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
            for (const handler of this.handlers) {
                handler.prepareRequest(info.options);
            }
        }
        return info;
    }
    _mergeHeaders(headers) {
        if (this.requestOptions && this.requestOptions.headers) {
            return Object.assign({}, lowercaseKeys(this.requestOptions.headers), lowercaseKeys(headers || {}));
        }
        return lowercaseKeys(headers || {});
    }
    _getExistingOrDefaultHeader(additionalHeaders, header, _default) {
        let clientHeader;
        if (this.requestOptions && this.requestOptions.headers) {
            clientHeader = lowercaseKeys(this.requestOptions.headers)[header];
        }
        return additionalHeaders[header] || clientHeader || _default;
    }
    _getAgent(parsedUrl) {
        let agent;
        const proxyUrl = pm.getProxyUrl(parsedUrl);
        const useProxy = proxyUrl && proxyUrl.hostname;
        if (this._keepAlive && useProxy) {
            agent = this._proxyAgent;
        }
        if (this._keepAlive && !useProxy) {
            agent = this._agent;
        }
        // if agent is already assigned use that agent.
        if (agent) {
            return agent;
        }
        const usingSsl = parsedUrl.protocol === 'https:';
        let maxSockets = 100;
        if (this.requestOptions) {
            maxSockets = this.requestOptions.maxSockets || http.globalAgent.maxSockets;
        }
        // This is `useProxy` again, but we need to check `proxyURl` directly for TypeScripts's flow analysis.
        if (proxyUrl && proxyUrl.hostname) {
            const agentOptions = {
                maxSockets,
                keepAlive: this._keepAlive,
                proxy: Object.assign(Object.assign({}, ((proxyUrl.username || proxyUrl.password) && {
                    proxyAuth: `${proxyUrl.username}:${proxyUrl.password}`
                })), { host: proxyUrl.hostname, port: proxyUrl.port })
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
            const options = { keepAlive: this._keepAlive, maxSockets };
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
        return __awaiter(this, void 0, void 0, function* () {
            retryNumber = Math.min(ExponentialBackoffCeiling, retryNumber);
            const ms = ExponentialBackoffTimeSlice * Math.pow(2, retryNumber);
            return new Promise(resolve => setTimeout(() => resolve(), ms));
        });
    }
    _processResponse(res, options) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                const statusCode = res.message.statusCode || 0;
                const response = {
                    statusCode,
                    result: null,
                    headers: {}
                };
                // not found leads to null obj returned
                if (statusCode === HttpCodes.NotFound) {
                    resolve(response);
                }
                // get the result from the body
                function dateTimeDeserializer(key, value) {
                    if (typeof value === 'string') {
                        const a = new Date(value);
                        if (!isNaN(a.valueOf())) {
                            return a;
                        }
                    }
                    return value;
                }
                let obj;
                let contents;
                try {
                    contents = yield res.readBody();
                    if (contents && contents.length > 0) {
                        if (options && options.deserializeDates) {
                            obj = JSON.parse(contents, dateTimeDeserializer);
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
                        msg = `Failed request: (${statusCode})`;
                    }
                    const err = new HttpClientError(msg, statusCode);
                    err.result = response.result;
                    reject(err);
                }
                else {
                    resolve(response);
                }
            }));
        });
    }
}
exports.HttpClient = HttpClient;
const lowercaseKeys = (obj) => Object.keys(obj).reduce((c, k) => ((c[k.toLowerCase()] = obj[k]), c), {});
//# sourceMappingURL=index.js.map

/***/ }),

/***/ 835:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.checkBypass = exports.getProxyUrl = void 0;
function getProxyUrl(reqUrl) {
    const usingSsl = reqUrl.protocol === 'https:';
    if (checkBypass(reqUrl)) {
        return undefined;
    }
    const proxyVar = (() => {
        if (usingSsl) {
            return process.env['https_proxy'] || process.env['HTTPS_PROXY'];
        }
        else {
            return process.env['http_proxy'] || process.env['HTTP_PROXY'];
        }
    })();
    if (proxyVar) {
        return new URL(proxyVar);
    }
    else {
        return undefined;
    }
}
exports.getProxyUrl = getProxyUrl;
function checkBypass(reqUrl) {
    if (!reqUrl.hostname) {
        return false;
    }
    const noProxy = process.env['no_proxy'] || process.env['NO_PROXY'] || '';
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
    const upperReqHosts = [reqUrl.hostname.toUpperCase()];
    if (typeof reqPort === 'number') {
        upperReqHosts.push(`${upperReqHosts[0]}:${reqPort}`);
    }
    // Compare request host against noproxy
    for (const upperNoProxyItem of noProxy
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
//# sourceMappingURL=proxy.js.map

/***/ }),

/***/ 13:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";
/* Version: 16.6.1 - July 25, 2023 18:30:06 */


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

var https__namespace = /*#__PURE__*/_interopNamespace(https);
var fs__namespace = /*#__PURE__*/_interopNamespace(fs);

/******************************************************************************
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
    /* encodes a string to base32 and returns the encoded string */
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
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
    let digits = ((isNaN(+strDigits) || !Boolean(strDigits)) ? 6 : parseInt(strDigits));
    digits = digits == 0 ? 6 : digits;
    const strPeriod = (totpUrl.searchParams.get('period') || '').trim();
    let period = ((isNaN(+strPeriod) || !Boolean(strPeriod)) ? 30 : parseInt(strPeriod));
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
        codeStr = '0' + codeStr;
    const elapsed = Math.floor(tmBase % period); // time elapsed in current period in seconds
    const ttl = period - elapsed; // time to live in seconds
    return { code: codeStr, timeLeft: ttl, period: period };
});
// password generation
const defaultPasswordLength = 32;
const asciiSpecialCharacters = '"!@#$%()+;<>=?[]{}^.,';
const asciiLowercase = 'abcdefghijklmnopqrstuvwxyz';
const asciiUppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const asciiDigits = '0123456789';
const shuffle = (text) => __awaiter(void 0, void 0, void 0, function* () {
    // Fisher-Yates shuffle
    let result = text;
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
const randomSample = (length, charset) => __awaiter(void 0, void 0, void 0, function* () {
    let result = '';
    length = Math.abs(length);
    for (let i = 0; i < length; i++)
        result += yield exports.platform.getRandomCharacterInCharset(charset);
    return result;
});
/**
 * Generates a new password of specified minimum length
 * using provided number of uppercase, lowercase, digits and special characters.
 *
 * Note: If all character groups are unspecified or all have exact zero length
 * then password characters are chosen from all groups uniformly at random.
 *
 * Note: If all charset lengths are negative or 0 but can't reach min_length
 * then all exact/negative charset lengths will be treated as minimum number of characters instead.
 *
 * @param {number} minLength - Minimum password length - default: 32
 * @param {number|null} lowercase - Minimum number of lowercase characters if positive, exact if 0 or negative
 * @param {number|null} uppercase - Minimum number of uppercase characters if positive, exact if 0 or negative
 * @param {number|null} digits - Minimum number of digits if positive, exact if 0 or negative
 * @param {number|null} specialCharacters - Minimum number of special characters if positive, exact if 0 or negative
 * @param {number} specialCharacterSet - String containing custom set of special characters to pick from
 * @returns {string} Generated password string
 */
const generatePassword = (minLength = defaultPasswordLength, lowercase = null, uppercase = null, digits = null, specialCharacters = null, specialCharacterSet = asciiSpecialCharacters) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const counts = [lowercase, uppercase, digits, specialCharacters];
    const sumCategories = (_a = counts.reduce((sum, x) => sum + Math.abs(x !== null && x !== void 0 ? x : 0), 0)) !== null && _a !== void 0 ? _a : 0;
    // If all lengths are exact/negative but don't reach minLength - convert to minimum/positive lengths
    const numExactCounts = (_b = counts.reduce((sum, x) => sum + (((x !== null && x !== void 0 ? x : 1) <= 0) ? 1 : 0), 0)) !== null && _b !== void 0 ? _b : 0;
    if (counts.length == numExactCounts && sumCategories < minLength) {
        if ((lowercase !== null && lowercase !== void 0 ? lowercase : 0) < 0)
            lowercase = Math.abs(lowercase !== null && lowercase !== void 0 ? lowercase : 0);
        if ((uppercase !== null && uppercase !== void 0 ? uppercase : 0) < 0)
            uppercase = Math.abs(uppercase !== null && uppercase !== void 0 ? uppercase : 0);
        if ((digits !== null && digits !== void 0 ? digits : 0) < 0)
            digits = Math.abs(digits !== null && digits !== void 0 ? digits : 0);
        if ((specialCharacters !== null && specialCharacters !== void 0 ? specialCharacters : 0) < 0)
            specialCharacters = Math.abs(specialCharacters !== null && specialCharacters !== void 0 ? specialCharacters : 0);
    }
    let extraChars = '';
    let extraCount = 0;
    if (minLength > sumCategories)
        extraCount = minLength - sumCategories;
    if ((lowercase !== null && lowercase !== void 0 ? lowercase : 1) > 0)
        extraChars += asciiLowercase;
    if ((uppercase !== null && uppercase !== void 0 ? uppercase : 1) > 0)
        extraChars += asciiUppercase;
    if ((digits !== null && digits !== void 0 ? digits : 1) > 0)
        extraChars += asciiDigits;
    if ((specialCharacters !== null && specialCharacters !== void 0 ? specialCharacters : 1) > 0)
        extraChars += specialCharacterSet;
    if (extraCount > 0 && !extraChars)
        extraChars = asciiLowercase + asciiUppercase + asciiDigits + specialCharacterSet;
    const categoryMap = [
        { count: Math.abs(lowercase !== null && lowercase !== void 0 ? lowercase : 0), chars: asciiLowercase },
        { count: Math.abs(uppercase !== null && uppercase !== void 0 ? uppercase : 0), chars: asciiUppercase },
        { count: Math.abs(digits !== null && digits !== void 0 ? digits : 0), chars: asciiDigits },
        { count: Math.abs(specialCharacters !== null && specialCharacters !== void 0 ? specialCharacters : 0), chars: specialCharacterSet },
        { count: extraCount, chars: extraChars }
    ];
    let passwordCharacters = '';
    for (let i = 0; i < categoryMap.length; i++)
        if (categoryMap[i].count > 0)
            passwordCharacters += yield randomSample(categoryMap[i].count, categoryMap[i].chars);
    const password = yield shuffle(passwordCharacters);
    return password;
});
/**
 * Try to parse an integer value from a string. Returns the number if successful, otherwise return a default value.
 * @param value The string with an integer to parse.
 * @param defaultValue Default value to return if parsing fails.
 */
function tryParseInt(value, defaultValue = 0) {
    let parsedValue = parseInt(value, 10);
    if (isNaN(parsedValue))
        return defaultValue; // Failed to parse. Return the default value.
    else
        return parsedValue; // Return the parsed value.
}

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
const encrypt = (data, keyId, storage, useCBC) => __awaiter(void 0, void 0, void 0, function* () {
    const key = yield loadKey(keyId, storage);
    return _encrypt(data, key, useCBC);
});
const _encrypt = (data, key, useCBC) => {
    if (useCBC) {
        return _encryptCBC(data, key);
    }
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    const result = Buffer.concat([iv, encrypted, tag]);
    return Promise.resolve(result);
};
const _encryptCBC = (data, key) => __awaiter(void 0, void 0, void 0, function* () {
    let iv = crypto.randomBytes(16);
    let cipher = crypto.createCipheriv("aes-256-cbc", key, iv).setAutoPadding(true);
    let encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, encrypted]);
});
const _decrypt = (data, key, useCBC) => {
    if (useCBC) {
        return _decryptCBC(data, key);
    }
    const iv = data.subarray(0, 12);
    const encrypted = data.subarray(12, data.length - 16);
    const tag = data.subarray(data.length - 16);
    const cipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    cipher.setAuthTag(tag);
    return Promise.resolve(Buffer.concat([cipher.update(encrypted), cipher.final()]));
};
const _decryptCBC = (data, key) => __awaiter(void 0, void 0, void 0, function* () {
    let iv = data.subarray(0, 16);
    let encrypted = data.subarray(16);
    let cipher = crypto.createDecipheriv("aes-256-cbc", key, iv).setAutoPadding(true);
    return Buffer.concat([cipher.update(encrypted), cipher.final()]);
});
const unwrap = (key, keyId, unwrappingKeyId, storage, memoryOnly, useCBC) => __awaiter(void 0, void 0, void 0, function* () {
    const unwrappingKey = yield loadKey(unwrappingKeyId, storage);
    const unwrappedKey = yield _decrypt(key, unwrappingKey, useCBC);
    keyCache[keyId] = unwrappedKey;
    if (memoryOnly) {
        return;
    }
    if (storage) {
        yield storage.saveBytes(keyId, unwrappedKey);
    }
});
const decrypt = (data, keyId, storage, useCBC) => __awaiter(void 0, void 0, void 0, function* () {
    const key = yield loadKey(keyId, storage);
    return _decrypt(data, key, useCBC);
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
const fileUpload = (url, uploadParameters, data) => new Promise((resolve, reject) => {
    const boundary = `----------${Date.now()}`;
    const boundaryBytes = stringToBytes(`\r\n--${boundary}`);
    let post = https__namespace.request(url, {
        method: "post",
        headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
        }
    });
    post.on('response', function (res) {
        resolve({
            headers: res.headers,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage
        });
    });
    post.on('error', reject);
    for (const key in uploadParameters) {
        post.write(boundaryBytes);
        post.write(stringToBytes(`\r\nContent-Disposition: form-data; name=\"${key}\"\r\n\r\n${uploadParameters[key]}`));
    }
    post.write(boundaryBytes);
    post.write(stringToBytes(`\r\nContent-Disposition: form-data; name=\"file\"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    post.write(data);
    post.write(boundaryBytes);
    post.write(stringToBytes(`--\r\n`));
    post.end();
});
const cleanKeyCache = () => {
    for (const key in keyCache) {
        delete keyCache[key];
    }
};
const hasKeysCached = () => {
    return Object.keys(keyCache).length > 0;
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
    fileUpload: fileUpload,
    cleanKeyCache: cleanKeyCache,
    hasKeysCached: hasKeysCached,
    getHmacDigest: getHmacDigest,
    getRandomNumber: getRandomNumber,
    getRandomCharacterInCharset: getRandomCharacterInCharset
};

function getValue(secrets, notation) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const parsedNotation = parseNotation(notation, true); // prefix, record, selector, footer
    if (parsedNotation.length < 3)
        throw Error(`Invalid notation ${notation}`);
    if (parsedNotation[2].text == null)
        throw Error(`Invalid notation ${notation}`);
    const selector = parsedNotation[2].text[0]; // type|title|notes or file|field|custom_field
    if (parsedNotation[1].text == null)
        throw Error(`Invalid notation ${notation}`);
    const recordToken = parsedNotation[1].text[0]; // UID or Title
    const record = secrets.records.find(x => x.recordUid === recordToken || x.data.title === recordToken);
    if (!record)
        throw Error(`Record '${recordToken}' not found`);
    const parameter = (_c = (_b = (_a = parsedNotation[2]) === null || _a === void 0 ? void 0 : _a.parameter) === null || _b === void 0 ? void 0 : _b.at(0)) !== null && _c !== void 0 ? _c : null;
    const index1 = (_f = (_e = (_d = parsedNotation[2]) === null || _d === void 0 ? void 0 : _d.index1) === null || _e === void 0 ? void 0 : _e.at(0)) !== null && _f !== void 0 ? _f : null;
    const index2 = (_j = (_h = (_g = parsedNotation[2]) === null || _g === void 0 ? void 0 : _g.index2) === null || _h === void 0 ? void 0 : _h.at(0)) !== null && _j !== void 0 ? _j : null;
    switch (selector.toLowerCase()) {
        case 'type': return (_k = record.data.type) !== null && _k !== void 0 ? _k : '';
        case 'title': return (_l = record.data.title) !== null && _l !== void 0 ? _l : '';
        case 'notes': return (_m = record.data.notes) !== null && _m !== void 0 ? _m : '';
        case 'file': {
            if (parameter == null)
                throw Error(`Notation error - Missing required parameter: filename or file UID for files in record '${recordToken}'`);
            if (((_p = (_o = record === null || record === void 0 ? void 0 : record.files) === null || _o === void 0 ? void 0 : _o.length) !== null && _p !== void 0 ? _p : 0) < 1)
                throw Error(`Notation error - Record ${recordToken} has no file attachments.`);
            let files = (_q = record.files) !== null && _q !== void 0 ? _q : [];
            files = files.filter(x => { var _a, _b; return parameter == ((_a = x.data) === null || _a === void 0 ? void 0 : _a.name) || parameter == ((_b = x.data) === null || _b === void 0 ? void 0 : _b.title) || parameter == x.fileUid; });
            // file searches do not use indexes and rely on unique file names or fileUid
            if (((_r = files === null || files === void 0 ? void 0 : files.length) !== null && _r !== void 0 ? _r : 0) < 1)
                throw Error(`Notation error - Record ${recordToken} has no files matching the search criteria '${parameter}'`);
            // legacy compat. mode
            return files[0];
            // if ((files?.length ?? 0) > 1)
            //     throw Error(`Notation error - Record ${recordToken} has multiple files matching the search criteria '${parameter}'`)
            // try {
            //     const contents = await downloadFile(files[0])
            //     const text = webSafe64FromBytes(contents)
            //     return text
            // } catch (e) { throw Error(`Notation error - download failed for Record: ${recordToken}, File: ${parameter}, FileUID: ${files[0].fileUid}, Message: ${e}`)}
        }
        case 'field':
        case 'custom_field': {
            if (parameter == null)
                throw Error(`Notation error - Missing required parameter for the field (type or label): ex. /field/type or /custom_field/MyLabel`);
            const fields = (selector.toLowerCase() == 'field' ? record.data.fields :
                selector.toLowerCase() == 'custom_field' ? record.data.custom : null);
            if (!fields)
                throw new Error(`Notation error - Expected /field or /custom_field but found /${selector}`);
            // legacy compat mode - find first field only
            const field = fields.find(x => parameter === x.type || parameter === x.label);
            if (!field)
                throw new Error(`Field ${parameter} not found in the record ${record.recordUid}`);
            // /<type|label>[index1][index2], ex. /url == /url[] == /url[][] == full value
            const idx = tryParseInt(index1 || '', -1); // -1 = full value
            // valid only if [] or missing - ex. /field/phone or /field/phone[]
            if (idx == -1 && !(parsedNotation[2].index1 == null || parsedNotation[2].index1[1] == '' || parsedNotation[2].index1[1] == '[]'))
                throw new Error(`Notation error - Invalid field index ${idx}.`);
            let values = ((field === null || field === void 0 ? void 0 : field.value) != null ? field.value : []);
            if (idx >= values.length)
                throw new Error(`Notation error - Field index out of bounds ${idx} >= ${values.length} for field '${parameter}' in record '${record.recordUid}'`);
            if (idx >= 0) // single index
                values = [values[idx]];
            const fullObjValue = (parsedNotation[2].index2 == null || parsedNotation[2].index2[1] == '' || parsedNotation[2].index2[1] == '[]');
            let objPropertyName = '';
            if (parsedNotation[2].index2 != null)
                objPropertyName = parsedNotation[2].index2[0];
            // legacy compatibility mode - no indexes, ex. /url returns value[0]
            if ((parsedNotation[2].index1 == null || parsedNotation[2].index1[1] == '') &&
                (parsedNotation[2].index2 == null || parsedNotation[2].index2[1] == ''))
                return values[0]; // legacy compatibility
            // return (typeof values[0] === 'string' ? values[0] as string : JSON.stringify(values[0]))
            // legacy compatibility mode - empty index, ex. /url[] returns ["value"]
            if ('[]' == ((_u = (_t = (_s = parsedNotation[2]) === null || _s === void 0 ? void 0 : _s.index1) === null || _t === void 0 ? void 0 : _t.at(1)) !== null && _u !== void 0 ? _u : '') && (index2 == null || index2 == ''))
                return values; // legacy compatibility
            // return JSON.stringify(values)
            // should be handled by parseNotation w/ legacyMode=true converts /name[middle] to name[][middle]
            // legacy compatibility mode - index2 only, ex. /name[first] returns value[0][first]
            if ((index1 !== null && index1 !== void 0 ? index1 : '') == '' && (index2 !== null && index2 !== void 0 ? index2 : '') != '')
                return values[0][index2 !== null && index2 !== void 0 ? index2 : '']; // legacy compatibility
            // return values[0].getProperty(objPropertyName)
            if (fullObjValue) {
                return idx >= 0 ? values[0] : values; // legacy compatibility
            }
            else if (values[0] != null) {
                if (objPropertyName in values[0]) {
                    let propKey = objPropertyName;
                    const propValue = values[0][propKey];
                    return propValue; // legacy compatibility
                }
                else
                    throw Error(`Notation error - value object has no property '${objPropertyName}'`);
            }
            else
                throw Error(`Notation error - Cannot extract property '${objPropertyName}' from null value.`);
        }
        default: throw Error(`Invalid notation ${notation}`);
    }
}
class NotationSection {
    constructor(sectionName) {
        this.section = sectionName;
        this.isPresent = false;
        this.startPos = -1;
        this.endPos = -1;
        this.text = null;
        this.parameter = null;
        this.index1 = null;
        this.index2 = null;
    }
}
const EscapeChar = '\\'.charCodeAt(0);
const EscapeChars = '/[]\\'; // /[]\ -> \/ ,\[, \], \\
// Escape the characters in plaintext sections only - title, label or filename
function parseSubsection(text, pos, delimiters, escaped = false) {
    // raw string excludes start delimiter (if '/') but includes end delimiter or both (if '[',']')
    if (!text || pos < 0 || pos >= text.length)
        return null;
    if (!delimiters || delimiters.length > 2)
        throw new Error(`Notation parser: Internal error - Incorrect delimiters count. Delimiters: '${delimiters}'`);
    let token = '';
    let raw = '';
    while (pos < text.length) {
        if (escaped && EscapeChar == text.charCodeAt(pos)) {
            // notation cannot end in single char incomplete escape sequence
            // and only escape_chars should be escaped
            if (((pos + 1) >= text.length) || !EscapeChars.includes(text[pos + 1]))
                throw new Error(`Notation parser: Incorrect escape sequence at position ${pos}`);
            // copy the properly escaped character
            token += text[pos + 1];
            raw += text[pos] + text[pos + 1];
            pos += 2;
        }
        else { // escaped == false || EscapeChar != text.charCodeAt(pos)
            raw += text[pos]; // delimiter is included in raw text
            if (delimiters.length == 1) {
                if (text[pos] == delimiters[0])
                    break;
                else
                    token += text[pos];
            }
            else { // 2 delimiters
                if (raw[0] != delimiters[0])
                    throw new Error(`Notation parser: Index sections must start with '['`);
                if (raw.length > 1 && text[pos] == delimiters[0])
                    throw new Error(`Notation parser: Index sections do not allow extra '[' inside.`);
                if (!delimiters.includes(text[pos]))
                    token += text[pos];
                else if (text[pos] == delimiters[1])
                    break;
            }
            pos++;
        }
    }
    //pos = (pos < text.length) ? pos : text.length - 1
    if (delimiters.length == 2 && ((raw.length < 2 || raw[0] != delimiters[0] || raw[raw.length - 1] != delimiters[1]) ||
        (escaped && raw.charCodeAt(raw.length - 2) == EscapeChar)))
        throw new Error(`Notation parser: Index sections must be enclosed in '[' and ']'`);
    const result = [token, raw];
    return result;
}
function parseSection(notation, section, pos) {
    if (!notation)
        throw new Error(`Keeper notation parsing error - missing notation URI`);
    const sectionName = section.toLowerCase();
    const sections = ['prefix', 'record', 'selector', 'footer'];
    if (!sections.includes(sectionName))
        throw new Error(`Keeper notation parsing error - unknown section: '${sectionName}'`);
    const result = new NotationSection(section);
    result.startPos = pos;
    switch (sectionName) {
        case 'prefix': {
            // prefix 'keeper://' is not mandatory
            const uriPrefix = 'keeper://';
            if (notation.toLowerCase().startsWith(uriPrefix)) {
                result.isPresent = true;
                result.startPos = 0;
                result.endPos = uriPrefix.length - 1;
                result.text = [notation.substring(0, uriPrefix.length), notation.substring(0, uriPrefix.length)];
            }
            break;
        }
        case 'footer': {
            // footer should not be present - used only for verification
            result.isPresent = (pos < notation.length);
            if (result.isPresent) {
                result.startPos = pos;
                result.endPos = notation.length - 1;
                result.text = [notation.substring(pos), notation.substring(pos)];
            }
            break;
        }
        case 'record': {
            // record is always present - either UID or title
            result.isPresent = (pos < notation.length);
            if (result.isPresent) {
                const parsed = parseSubsection(notation, pos, '/', true);
                if (parsed != null) {
                    result.startPos = pos;
                    result.endPos = pos + parsed[1].length - 1;
                    result.text = parsed;
                }
            }
            break;
        }
        case 'selector': {
            // selector is always present - type|title|notes | field|custom_field|file
            result.isPresent = (pos < notation.length);
            if (result.isPresent) {
                let parsed = parseSubsection(notation, pos, '/', false);
                if (parsed != null) {
                    result.startPos = pos;
                    result.endPos = pos + parsed[1].length - 1;
                    result.text = parsed;
                    // selector.parameter - <field type>|<field label> | <file name>
                    // field/name[0][middle], custom_field/my label[0][middle], file/my file[0]
                    const longSelectors = ['field', 'custom_field', 'file'];
                    if (longSelectors.includes(parsed[0].toLowerCase())) {
                        // TODO: File metadata extraction: ex. filename[1][size] - that requires filename to be escaped
                        parsed = parseSubsection(notation, result.endPos + 1, '[', true);
                        if (parsed != null) {
                            result.parameter = parsed; // <field type>|<field label> | <filename>
                            const plen = parsed[1].length - (parsed[1].endsWith('[') && !parsed[1].endsWith('\\[') ? 1 : 0);
                            result.endPos += plen;
                            parsed = parseSubsection(notation, result.endPos + 1, '[]', true);
                            if (parsed != null) {
                                result.index1 = parsed; // selector.index1 [int] or []
                                result.endPos += parsed[1].length;
                                parsed = parseSubsection(notation, result.endPos + 1, '[]', true);
                                if (parsed != null) {
                                    result.index2 = parsed; // selector.index2 [str]
                                    result.endPos += parsed[1].length;
                                }
                            }
                        }
                    }
                }
            }
            break;
        }
        default: throw new Error(`Keeper notation parsing error - unknown section: ${sectionName}`);
    }
    return result;
}
function parseNotation(notation, legacyMode = false) {
    if (!notation)
        throw new Error('Keeper notation is missing or invalid.');
    // Notation is either plaintext keeper URI format or URL safe base64 string (UTF8)
    // auto detect format - '/' is not part of base64 URL safe alphabet
    if (!notation.includes('/')) {
        try {
            var bytes = webSafe64ToBytes(notation);
            var plaintext = new TextDecoder('utf-8').decode(bytes);
            notation = plaintext;
        }
        catch (Exception) {
            throw new Error('Keeper notation is in invalid format - plaintext URI or URL safe base64 string expected.');
        }
    }
    const prefix = parseSection(notation, 'prefix', 0); // keeper://
    let pos = (prefix.isPresent ? prefix.endPos + 1 : 0); // prefix is optional
    const record = parseSection(notation, 'record', pos); // <UID> or <Title>
    pos = (record.isPresent ? record.endPos + 1 : notation.length); // record is required
    const selector = parseSection(notation, 'selector', pos); // type|title|notes | field|custom_field|file
    pos = (selector.isPresent ? selector.endPos + 1 : notation.length); // selector is required, indexes are optional
    const footer = parseSection(notation, 'footer', pos); // Any text after the last section
    // verify parsed query
    // prefix is optional, record UID/Title and selector are mandatory
    const shortSelectors = ['type', 'title', 'notes'];
    const fullSelectors = ['field', 'custom_field', 'file'];
    const selectors = ['type', 'title', 'notes', 'field', 'custom_field', 'file'];
    if (!record.isPresent || !selector.isPresent)
        throw new Error('Keeper notation URI missing information about the uid, file, field type, or field key.');
    if (footer.isPresent)
        throw new Error('Keeper notation is invalid - extra characters after last section.');
    if (selector.text == null || !selectors.includes(selector.text[0].toLowerCase()))
        throw new Error('Keeper notation is invalid - bad selector, must be one of (type, title, notes, field, custom_field, file).');
    if (selector.text != null && shortSelectors.includes(selector.text[0].toLowerCase()) && selector.parameter != null)
        throw new Error('Keeper notation is invalid - selectors (type, title, notes) do not have parameters.');
    if (selector.text != null && fullSelectors.includes(selector.text[0].toLowerCase())) {
        if (selector.parameter == null)
            throw new Error('Keeper notation is invalid - selectors (field, custom_field, file) require parameters.');
        if ('file' == selector.text[0].toLowerCase() && (selector.index1 != null || selector.index2 != null))
            throw new Error('Keeper notation is invalid - file selectors don\'t accept indexes.');
        if ('file' != selector.text[0].toLowerCase() && selector.index1 == null && selector.index2 != null)
            throw new Error('Keeper notation is invalid - two indexes required.');
        if (selector.index1 != null && !/^\[\d*\]$/.test(selector.index1[1])) {
            if (!legacyMode)
                throw new Error('Keeper notation is invalid - first index must be numeric: [n] or [].');
            if (selector.index2 == null) { // in legacy mode convert /name[middle] to name[][middle]
                selector.index2 = selector.index1;
                selector.index1 = ['', '[]'];
            }
        }
    }
    const result = [prefix, record, selector, footer];
    return result;
}

let packageVersion = '16.6.1';
const KEY_HOSTNAME = 'hostname'; // base url for the Secrets Manager service
const KEY_SERVER_PUBLIC_KEY_ID = 'serverPublicKeyId';
const KEY_CLIENT_ID = 'clientId';
const KEY_CLIENT_KEY = 'clientKey'; // The key that is used to identify the client before public key
const KEY_APP_KEY = 'appKey'; // The application key with which all secrets are encrypted
const KEY_OWNER_PUBLIC_KEY = 'appOwnerPublicKey'; // The application owner public key, to create records
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
const prepareGetPayload = (storage, queryOptions) => __awaiter(void 0, void 0, void 0, function* () {
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
    if (queryOptions === null || queryOptions === void 0 ? void 0 : queryOptions.recordsFilter) {
        payload.requestedRecords = queryOptions.recordsFilter;
    }
    if (queryOptions === null || queryOptions === void 0 ? void 0 : queryOptions.foldersFilter) {
        payload.requestedFolders = queryOptions.foldersFilter;
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
const prepareDeletePayload = (storage, recordUids) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        recordUids: recordUids
    };
});
const prepareDeleteFolderPayload = (storage, folderUids, forceDeletion = false) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        folderUids: folderUids,
        forceDeletion: forceDeletion
    };
});
const prepareCreatePayload = (storage, createOptions, recordData) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const ownerPublicKey = yield storage.getBytes(KEY_OWNER_PUBLIC_KEY);
    if (!ownerPublicKey) {
        throw new Error('Application owner public key is missing from the configuration');
    }
    const recordBytes = exports.platform.stringToBytes(JSON.stringify(recordData));
    const recordKey = exports.platform.getRandomBytes(32);
    const recordUid = exports.platform.getRandomBytes(16);
    const encryptedRecord = yield exports.platform.encryptWithKey(recordBytes, recordKey);
    const encryptedRecordKey = yield exports.platform.publicEncrypt(recordKey, ownerPublicKey);
    const encryptedFolderKey = yield exports.platform.encrypt(recordKey, createOptions.folderUid);
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        recordUid: webSafe64FromBytes(recordUid),
        recordKey: exports.platform.bytesToBase64(encryptedRecordKey),
        folderUid: createOptions.folderUid,
        folderKey: exports.platform.bytesToBase64(encryptedFolderKey),
        data: webSafe64FromBytes(encryptedRecord),
        subFolderUid: createOptions.subFolderUid
    };
});
const prepareCreateFolderPayload = (storage, createOptions, folderName) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const folderDataBytes = exports.platform.stringToBytes(JSON.stringify({
        name: folderName
    }));
    const folderKey = exports.platform.getRandomBytes(32);
    const folderUid = exports.platform.getRandomBytes(16);
    const encryptedFolderData = yield exports.platform.encryptWithKey(folderDataBytes, folderKey, true);
    const encryptedFolderKey = yield exports.platform.encrypt(folderKey, createOptions.folderUid, undefined, true);
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        folderUid: webSafe64FromBytes(folderUid),
        sharedFolderUid: createOptions.folderUid,
        sharedFolderKey: webSafe64FromBytes(encryptedFolderKey),
        data: webSafe64FromBytes(encryptedFolderData),
        parentUid: createOptions.subFolderUid
    };
});
const prepareUpdateFolderPayload = (storage, folderUid, folderName) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const folderDataBytes = exports.platform.stringToBytes(JSON.stringify({
        name: folderName
    }));
    const encryptedFolderData = yield exports.platform.encrypt(folderDataBytes, folderUid, undefined, true);
    return {
        clientVersion: 'ms' + packageVersion,
        clientId: clientId,
        folderUid: folderUid,
        data: webSafe64FromBytes(encryptedFolderData)
    };
});
const prepareFileUploadPayload = (storage, ownerRecord, file) => __awaiter(void 0, void 0, void 0, function* () {
    const clientId = yield storage.getString(KEY_CLIENT_ID);
    if (!clientId) {
        throw new Error('Client Id is missing from the configuration');
    }
    const ownerPublicKey = yield storage.getBytes(KEY_OWNER_PUBLIC_KEY);
    if (!ownerPublicKey) {
        throw new Error('Application owner public key is missing from the configuration');
    }
    const fileData = {
        name: file.name,
        size: file.data.length,
        title: file.title,
        lastModified: new Date().getTime(),
        type: file.type
    };
    const fileRecordBytes = exports.platform.stringToBytes(JSON.stringify(fileData));
    const fileRecordKey = exports.platform.getRandomBytes(32);
    const fileRecordUid = webSafe64FromBytes(exports.platform.getRandomBytes(16));
    const encryptedFileRecord = yield exports.platform.encryptWithKey(fileRecordBytes, fileRecordKey);
    const encryptedFileRecordKey = yield exports.platform.publicEncrypt(fileRecordKey, ownerPublicKey);
    const encryptedLinkKey = yield exports.platform.encrypt(fileRecordKey, ownerRecord.recordUid);
    const encryptedFileData = yield exports.platform.encryptWithKey(file.data, fileRecordKey);
    let fileRef = ownerRecord.data.fields.find(x => x.type == 'fileRef');
    if (fileRef) {
        fileRef.value.push(fileRecordUid);
    }
    else {
        fileRef = { type: 'fileRef', value: [fileRecordUid] };
        ownerRecord.data.fields.push(fileRef);
    }
    const ownerRecordBytes = exports.platform.stringToBytes(JSON.stringify(ownerRecord.data));
    const encryptedOwnerRecord = yield exports.platform.encrypt(ownerRecordBytes, ownerRecord.recordUid);
    return {
        payload: {
            clientVersion: 'ms' + packageVersion,
            clientId: clientId,
            fileRecordUid: fileRecordUid,
            fileRecordKey: exports.platform.bytesToBase64(encryptedFileRecordKey),
            fileRecordData: webSafe64FromBytes(encryptedFileRecord),
            ownerRecordUid: ownerRecord.recordUid,
            ownerRecordData: webSafe64FromBytes(encryptedOwnerRecord),
            linkKey: exports.platform.bytesToBase64(encryptedLinkKey),
            fileSize: encryptedFileData.length
        },
        encryptedFileData
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
    const keyNumberString = yield storage.getString(KEY_SERVER_PUBLIC_KEY_ID);
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
            let errorMessage;
            if (response.data) {
                errorMessage = exports.platform.bytesToString(response.data.slice(0, 1000));
                try {
                    const errorObj = JSON.parse(errorMessage);
                    if (errorObj.error === 'key') {
                        yield options.storage.saveString(KEY_SERVER_PUBLIC_KEY_ID, errorObj.key_id.toString());
                        continue;
                    }
                }
                catch (_a) {
                }
            }
            else {
                errorMessage = `unknown ksm error, code ${response.statusCode}`;
            }
            throw new Error(errorMessage);
        }
        return response.data
            ? exports.platform.decryptWithKey(response.data, transmissionKey.key)
            : new Uint8Array();
    }
});
const decryptRecord = (record, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const decryptedRecord = yield exports.platform.decrypt(exports.platform.base64ToBytes(record.data), record.recordUid || KEY_APP_KEY, storage);
    const keeperRecord = {
        recordUid: record.recordUid,
        data: JSON.parse(exports.platform.bytesToString(decryptedRecord)),
        revision: record.revision,
    };
    if (record.innerFolderUid) {
        keeperRecord.innerFolderUid = record.innerFolderUid;
    }
    if (record.files) {
        keeperRecord.files = [];
        for (const file of record.files) {
            yield exports.platform.unwrap(exports.platform.base64ToBytes(file.fileKey), file.fileUid, record.recordUid || KEY_APP_KEY);
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
const fetchAndDecryptSecrets = (options, queryOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const storage = options.storage;
    const payload = yield prepareGetPayload(storage, queryOptions);
    const responseData = yield postQuery(options, 'get_secret', payload);
    const response = JSON.parse(exports.platform.bytesToString(responseData));
    const records = [];
    let justBound = false;
    if (response.encryptedAppKey) {
        justBound = true;
        yield exports.platform.unwrap(exports.platform.base64ToBytes(response.encryptedAppKey), KEY_APP_KEY, KEY_CLIENT_KEY, storage);
        yield storage.delete(KEY_CLIENT_KEY);
        yield storage.saveString(KEY_OWNER_PUBLIC_KEY, response.appOwnerPublicKey);
    }
    if (response.records) {
        for (const record of response.records) {
            if (record.recordKey) {
                yield exports.platform.unwrap(exports.platform.base64ToBytes(record.recordKey), record.recordUid, KEY_APP_KEY, storage, true);
            }
            const decryptedRecord = yield decryptRecord(record, storage);
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
    let appData;
    if (response.appData) {
        appData = JSON.parse(exports.platform.bytesToString(yield exports.platform.decrypt(webSafe64ToBytes(response.appData), KEY_APP_KEY, storage)));
    }
    const secrets = {
        appData: appData,
        expiresOn: response.expiresOn > 0 ? new Date(response.expiresOn) : undefined,
        records: records
    };
    if (response.warnings && response.warnings.length > 0) {
        secrets.warnings = response.warnings;
    }
    if (response.extra && Object.keys(response.extra).length > 0) {
        secrets.extra = response.extra;
    }
    return { secrets, justBound };
});
const getSharedFolderUid = (folders, parent) => {
    while (true) {
        const parentFolder = folders.find(x => x.folderUid === parent);
        if (!parentFolder) {
            return undefined;
        }
        if (parentFolder.parent) {
            parent = parentFolder.parent;
        }
        else {
            return parent;
        }
    }
};
const fetchAndDecryptFolders = (options) => __awaiter(void 0, void 0, void 0, function* () {
    const storage = options.storage;
    const payload = yield prepareGetPayload(storage);
    const responseData = yield postQuery(options, 'get_folders', payload);
    const response = JSON.parse(exports.platform.bytesToString(responseData));
    const folders = [];
    if (response.folders) {
        for (const folder of response.folders) {
            let decryptedData;
            const decryptedFolder = {
                folderUid: folder.folderUid
            };
            if (folder.parent) {
                decryptedFolder.parentUid = folder.parent;
                const sharedFolderUid = getSharedFolderUid(response.folders, folder.parent);
                if (!sharedFolderUid) {
                    throw new Error('Folder data inconsistent - unable to locate shared folder');
                }
                yield exports.platform.unwrap(exports.platform.base64ToBytes(folder.folderKey), folder.folderUid, sharedFolderUid, storage, true, true);
                decryptedData = yield exports.platform.decrypt(exports.platform.base64ToBytes(folder.data), folder.folderUid, storage, true);
            }
            else {
                yield exports.platform.unwrap(exports.platform.base64ToBytes(folder.folderKey), folder.folderUid, KEY_APP_KEY, storage, true);
                decryptedData = yield exports.platform.decrypt(exports.platform.base64ToBytes(folder.data), folder.folderUid, storage, true);
            }
            decryptedFolder.name = JSON.parse(exports.platform.bytesToString(decryptedData))['name'];
            folders.push(decryptedFolder);
        }
    }
    return folders;
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
            AU: 'keepersecurity.com.au',
            GOV: 'govcloud.keepersecurity.us',
            JP: 'keepersecurity.jp',
            CA: 'keepersecurity.ca'
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
    const queryOptions = recordsFilter
        ? { recordsFilter: recordsFilter }
        : undefined;
    return getSecrets2(options, queryOptions);
});
const getSecrets2 = (options, queryOptions) => __awaiter(void 0, void 0, void 0, function* () {
    exports.platform.cleanKeyCache();
    const { secrets, justBound } = yield fetchAndDecryptSecrets(options, queryOptions);
    if (justBound) {
        try {
            yield fetchAndDecryptSecrets(options, queryOptions);
        }
        catch (e) {
            console.error(e);
        }
    }
    return secrets;
});
const getFolders = (options) => __awaiter(void 0, void 0, void 0, function* () {
    exports.platform.cleanKeyCache();
    return yield fetchAndDecryptFolders(options);
});
// tryGetNotationResults returns a string list with all values specified by the notation or empty list on error.
// It simply logs any errors and continue returning an empty string list on error.
const tryGetNotationResults = (options, notation) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        return yield getNotationResults(options, notation);
    }
    catch (e) {
        console.error(e);
    }
    return [];
});
// Notation:
// keeper://<uid|title>/<field|custom_field>/<type|label>[INDEX][PROPERTY]
// keeper://<uid|title>/file/<filename|fileUID>
// Record title, field label, filename sections need to escape the delimiters /[]\ -> \/ \[ \] \\
//
// GetNotationResults returns selection of the value(s) from a single field as a string list.
// Multiple records or multiple fields found results in error.
// Use record UID or unique record titles and field labels so that notation finds a single record/field.
//
// If field has multiple values use indexes - numeric INDEX specifies the position in the value list
// and PROPERTY specifies a single JSON object property to extract (see examples below for usage)
// If no indexes are provided - whole value list is returned (same as [])
// If PROPERTY is provided then INDEX must be provided too - even if it's empty [] which means all
//
// Extracting two or more but not all field values simultaneously is not supported - use multiple notation requests.
//
// Files are returned as URL safe base64 encoded string of the binary content
//
// Note: Integrations and plugins usually return single string value - result[0] or ''
//
// Examples:
//  RECORD_UID/file/filename.ext             => ['URL Safe Base64 encoded binary content']
//  RECORD_UID/field/url                     => ['127.0.0.1', '127.0.0.2'] or [] if empty
//  RECORD_UID/field/url[]                   => ['127.0.0.1', '127.0.0.2'] or [] if empty
//  RECORD_UID/field/url[0]                  => ['127.0.0.1'] or error if empty
//  RECORD_UID/custom_field/name[first]      => Error, numeric index is required to access field property
//  RECORD_UID/custom_field/name[][last]     => ['Smith', 'Johnson']
//  RECORD_UID/custom_field/name[0][last]    => ['Smith']
//  RECORD_UID/custom_field/phone[0][number] => '555-5555555'
//  RECORD_UID/custom_field/phone[1][number] => '777-7777777'
//  RECORD_UID/custom_field/phone[]          => ['{\'number\': \'555-555...\'}', '{\'number\': \'777...\'}']
//  RECORD_UID/custom_field/phone[0]         => ['{\'number\': \'555-555...\'}']
// getNotationResults returns a string list with all values specified by the notation or throws an error.
// Use tryGetNotationResults() to just log errors and continue returning an empty string list on error.
const getNotationResults = (options, notation) => __awaiter(void 0, void 0, void 0, function* () {
    var _b, _c, _d, _e;
    let result = [];
    const parsedNotation = parseNotation(notation); // prefix, record, selector, footer
    if (parsedNotation.length < 3)
        throw new Error(`Invalid notation ${notation}`);
    if (parsedNotation[1].text == null)
        throw new Error(`Invalid notation ${notation}`);
    const recordToken = parsedNotation[1].text[0]; // UID or Title
    if (parsedNotation[2].text == null)
        throw new Error(`Invalid notation ${notation}`);
    const selector = parsedNotation[2].text[0]; // type|title|notes or file|field|custom_field
    // to minimize traffic - if it looks like a Record UID try to pull a single record
    let records = [];
    if (/^[A-Za-z0-9_-]{22}$/.test(recordToken)) {
        const secrets = yield getSecrets(options, [recordToken]);
        records = secrets.records;
        if (records.length > 1)
            throw new Error(`Notation error - found multiple records with same UID '${recordToken}'`);
    }
    // If RecordUID is not found - pull all records and search by title
    if (records.length < 1) {
        const secrets = yield getSecrets(options);
        if ((secrets === null || secrets === void 0 ? void 0 : secrets.records) != null)
            records = yield findSecretsByTitle(secrets.records, recordToken);
    }
    if (records.length > 1)
        throw new Error(`Notation error - multiple records match record '${recordToken}'`);
    if (records.length < 1)
        throw new Error(`Notation error - no records match record '${recordToken}'`);
    const record = records[0];
    const parameter = parsedNotation[2].parameter != null ? parsedNotation[2].parameter[0] : '';
    const index1 = parsedNotation[2].index1 != null ? parsedNotation[2].index1[0] : '';
    parsedNotation[2].index2 != null ? parsedNotation[2].index2[0] : '';
    switch (selector.toLowerCase()) {
        case 'type': {
            if (((_b = record === null || record === void 0 ? void 0 : record.data) === null || _b === void 0 ? void 0 : _b.type) != null)
                result.push(record.data.type);
            break;
        }
        case 'title': {
            if (((_c = record === null || record === void 0 ? void 0 : record.data) === null || _c === void 0 ? void 0 : _c.title) != null)
                result.push(record.data.title);
            break;
        }
        case 'notes': {
            if (((_d = record === null || record === void 0 ? void 0 : record.data) === null || _d === void 0 ? void 0 : _d.notes) != null)
                result.push(record.data.notes);
            break;
        }
        case 'file': {
            if (parameter == null)
                throw new Error(`Notation error - Missing required parameter: filename or file UID for files in record '${recordToken}'`);
            if ((((_e = record === null || record === void 0 ? void 0 : record.files) === null || _e === void 0 ? void 0 : _e.length) || 0) < 1)
                throw new Error(`Notation error - Record ${recordToken} has no file attachments.`);
            let files = record.files.filter(x => { var _a; return parameter == ((_a = x === null || x === void 0 ? void 0 : x.data) === null || _a === void 0 ? void 0 : _a.name) || parameter == x.fileUid; });
            // file searches do not use indexes and rely on unique file names or fileUid
            const numFiles = (files == null ? 0 : files.length);
            if (numFiles > 1)
                throw new Error(`Notation error - Record ${recordToken} has multiple files matching the search criteria '${parameter}'`);
            if (numFiles < 1)
                throw new Error(`Notation error - Record ${recordToken} has no files matching the search criteria '${parameter}'`);
            const contents = yield downloadFile(files[0]);
            const text = webSafe64FromBytes(contents);
            result.push(text);
            break;
        }
        case 'field':
        case 'custom_field': {
            if (parsedNotation[2].parameter == null)
                throw new Error('Notation error - Missing required parameter for the field (type or label): ex. /field/type or /custom_field/MyLabel');
            const fields = (selector.toLowerCase() == 'field' ? record.data.fields :
                selector.toLowerCase() == 'custom_field' ? record.data.custom : null);
            if (!fields)
                throw new Error(`Notation error - Expected /field or /custom_field but found /${selector}`);
            const flds = fields.filter(x => parameter == x.type || parameter == x.label);
            if (((flds === null || flds === void 0 ? void 0 : flds.length) || 0) > 1)
                throw new Error(`Notation error - Record ${recordToken} has multiple fields matching the search criteria '${parameter}'`);
            if (((flds === null || flds === void 0 ? void 0 : flds.length) || 0) < 1)
                throw new Error(`Notation error - Record ${recordToken} has no fields matching the search criteria '${parameter}'`);
            const field = flds[0];
            //const fieldType = field?.type || ''
            const idx = tryParseInt(index1, -1); // -1 = full value
            // valid only if [] or missing - ex. /field/phone or /field/phone[]
            if (idx == -1 && !(parsedNotation[2].index1 == null || parsedNotation[2].index1[1] == '' || parsedNotation[2].index1[1] == '[]'))
                throw new Error(`Notation error - Invalid field index ${idx}.`);
            let values = ((field === null || field === void 0 ? void 0 : field.value) != null ? field.value : []);
            if (idx >= values.length)
                throw new Error(`Notation error - Field index out of bounds ${idx} >= ${values.length} for field ${parameter}`);
            if (idx >= 0) // single index
                values = [values[idx]];
            const fullObjValue = (parsedNotation[2].index2 == null || parsedNotation[2].index2[1] == '' || parsedNotation[2].index2[1] == '[]');
            let objPropertyName = '';
            if (parsedNotation[2].index2 != null)
                objPropertyName = parsedNotation[2].index2[0];
            const res = [];
            for (let i = 0; i < values.length; i++) {
                const fldValue = values[i];
                // Do not throw here to allow for ex. field/name[][middle] to pull [middle] only where present
                // NB! Not all properties of a value are always required even when the field is marked as required
                // ex. On a required `name` field only 'first' and 'last' properties are required but not 'middle'
                // so missing property in a field value is not always an error
                if (fldValue == null)
                    console.log('Notation error - Empty field value for field ', parameter); // throw?
                if (fullObjValue) {
                    res.push(typeof fldValue === 'string' ? fldValue : JSON.stringify(fldValue));
                }
                else if (fldValue != null) {
                    if (objPropertyName in fldValue) {
                        let propKey = objPropertyName;
                        const propValue = fldValue[propKey];
                        res.push(typeof propValue === 'string' ? propValue : JSON.stringify(propValue));
                    }
                    else
                        console.log(`Notation error - value object has no property '${objPropertyName}'`); // skip
                }
                else
                    console.log(`Notation error - Cannot extract property '${objPropertyName}' from null value.`);
            }
            if (res.length != values.length)
                console.log(`Notation warning - extracted ${res.length} out of ${values.length} values for '${objPropertyName}' property.`);
            if (res.length > 0)
                result.push.apply(result, res);
            break;
        }
        default: {
            throw new Error(`Invalid notation ${notation}`);
        }
    }
    return result;
});
const findSecretsByTitle = (records, recordTitle) => __awaiter(void 0, void 0, void 0, function* () {
    return records.filter(record => record.data.title === recordTitle);
});
const findSecretByTitle = (records, recordTitle) => __awaiter(void 0, void 0, void 0, function* () {
    return records.find(record => record.data.title === recordTitle);
});
const getSecretsByTitle = (options, recordTitle) => __awaiter(void 0, void 0, void 0, function* () {
    const secrets = yield getSecrets(options);
    return secrets.records.filter(record => record.data.title === recordTitle);
});
const getSecretByTitle = (options, recordTitle) => __awaiter(void 0, void 0, void 0, function* () {
    const secrets = yield getSecrets(options);
    return secrets.records.find(record => record.data.title === recordTitle);
});
const updateSecret = (options, record) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield prepareUpdatePayload(options.storage, record);
    yield postQuery(options, 'update_secret', payload);
});
const deleteSecret = (options, recordUids) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield prepareDeletePayload(options.storage, recordUids);
    const responseData = yield postQuery(options, 'delete_secret', payload);
    return JSON.parse(exports.platform.bytesToString(responseData));
});
const deleteFolder = (options, folderUids, forceDeletion) => __awaiter(void 0, void 0, void 0, function* () {
    const payload = yield prepareDeleteFolderPayload(options.storage, folderUids, forceDeletion);
    const responseData = yield postQuery(options, 'delete_folder', payload);
    return JSON.parse(exports.platform.bytesToString(responseData));
});
const createSecret = (options, folderUid, recordData) => __awaiter(void 0, void 0, void 0, function* () {
    if (!exports.platform.hasKeysCached()) {
        yield getSecrets(options); // need to warm up keys cache before posting a record
    }
    const payload = yield prepareCreatePayload(options.storage, { folderUid: folderUid }, recordData);
    yield postQuery(options, 'create_secret', payload);
    return payload.recordUid;
});
const createSecret2 = (options, createOptions, recordData) => __awaiter(void 0, void 0, void 0, function* () {
    if (!exports.platform.hasKeysCached()) {
        yield getFolders(options); // need to warm up keys cache before posting a record
    }
    const payload = yield prepareCreatePayload(options.storage, createOptions, recordData);
    yield postQuery(options, 'create_secret', payload);
    return payload.recordUid;
});
const createFolder = (options, createOptions, folderName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!exports.platform.hasKeysCached()) {
        yield getSecrets(options); // need to warm up keys cache before posting a record
    }
    const payload = yield prepareCreateFolderPayload(options.storage, createOptions, folderName);
    yield postQuery(options, 'create_folder', payload);
    return payload.folderUid;
});
const updateFolder = (options, folderUid, folderName) => __awaiter(void 0, void 0, void 0, function* () {
    if (!exports.platform.hasKeysCached()) {
        yield getSecrets(options); // need to warm up keys cache before posting a record
    }
    const payload = yield prepareUpdateFolderPayload(options.storage, folderUid, folderName);
    yield postQuery(options, 'update_folder', payload);
});
const downloadFile = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const fileResponse = yield exports.platform.get(file.url, {});
    return exports.platform.decrypt(fileResponse.data, file.fileUid);
});
const downloadThumbnail = (file) => __awaiter(void 0, void 0, void 0, function* () {
    const fileResponse = yield exports.platform.get(file.thumbnailUrl, {});
    return exports.platform.decrypt(fileResponse.data, file.fileUid);
});
const uploadFile = (options, ownerRecord, file) => __awaiter(void 0, void 0, void 0, function* () {
    const { payload, encryptedFileData } = yield prepareFileUploadPayload(options.storage, ownerRecord, file);
    const responseData = yield postQuery(options, 'add_file', payload);
    const response = JSON.parse(exports.platform.bytesToString(responseData));
    const uploadResult = yield exports.platform.fileUpload(response.url, JSON.parse(response.parameters), encryptedFileData);
    if (uploadResult.statusCode !== response.successStatusCode) {
        throw new Error(`Upload failed (${uploadResult.statusMessage}), code ${uploadResult.statusCode}`);
    }
    return payload.fileRecordUid;
});
const addCustomField = (record, field) => {
    if (record.data.custom == null || record.data.custom == undefined)
        record.data.custom = [];
    record.data.custom.push(field);
};
class KeeperRecordField {
    constructor() {
        this.type = '';
    }
}
class LoginField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'login';
        this.value = [value];
    }
}
class PasswordField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'password';
        this.value = [value];
    }
}
class UrlField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'url';
        this.value = [value];
    }
}
class FileRefField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'fileRef';
        this.value = [value];
    }
}
class OneTimeCodeField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'oneTimeCode';
        this.value = [value];
    }
}
class NameField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'name';
        this.value = [value];
    }
}
class BirthDateField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'birthDate';
        this.value = [value];
    }
}
class DateField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'date';
        this.value = [value];
    }
}
class ExpirationDateField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'expirationDate';
        this.value = [value];
    }
}
class TextField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'text';
        this.value = [value];
    }
}
class SecurityQuestionField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'securityQuestion';
        this.value = [value];
    }
}
class MultilineField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'multiline';
        this.value = [value];
    }
}
class EmailField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'email';
        this.value = [value];
    }
}
class CardRefField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'cardRef';
        this.value = [value];
    }
}
class AddressRefField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'addressRef';
        this.value = [value];
    }
}
class PinCodeField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'pinCode';
        this.value = [value];
    }
}
class PhoneField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'phone';
        this.value = [value];
    }
}
class SecretField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'secret';
        this.value = [value];
    }
}
class SecureNoteField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'note';
        this.value = [value];
    }
}
class AccountNumberField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'accountNumber';
        this.value = [value];
    }
}
class PaymentCardField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'paymentCard';
        this.value = [value];
    }
}
class BankAccountField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'bankAccount';
        this.value = [value];
    }
}
class KeyPairField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'keyPair';
        this.value = [value];
    }
}
class HostField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'host';
        this.value = [value];
    }
}
class AddressField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'address';
        this.value = [value];
    }
}
class LicenseNumberField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'licenseNumber';
        this.value = [value];
    }
}
class RecordRefField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'recordRef';
        this.value = [value];
    }
}
class ScheduleField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'schedule';
        this.value = [value];
    }
}
class ScriptField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'script';
        this.value = [value];
    }
}
class DirectoryTypeField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'directoryType';
        this.value = [value];
    }
}
class DatabaseTypeField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'databaseType';
        this.value = [value];
    }
}
class PamHostnameField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'pamHostname';
        this.value = [value];
    }
}
class PamResourceField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'pamResources';
        this.value = [value];
    }
}
class CheckboxField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'checkbox';
        this.value = [value];
    }
}
class PasskeyField extends KeeperRecordField {
    constructor(value) {
        super();
        this.type = 'passkey';
        this.value = [value];
    }
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

exports.AccountNumberField = AccountNumberField;
exports.AddressField = AddressField;
exports.AddressRefField = AddressRefField;
exports.BankAccountField = BankAccountField;
exports.BirthDateField = BirthDateField;
exports.CardRefField = CardRefField;
exports.CheckboxField = CheckboxField;
exports.DatabaseTypeField = DatabaseTypeField;
exports.DateField = DateField;
exports.DirectoryTypeField = DirectoryTypeField;
exports.EmailField = EmailField;
exports.ExpirationDateField = ExpirationDateField;
exports.FileRefField = FileRefField;
exports.HostField = HostField;
exports.KeeperRecordField = KeeperRecordField;
exports.KeyPairField = KeyPairField;
exports.LicenseNumberField = LicenseNumberField;
exports.LoginField = LoginField;
exports.MultilineField = MultilineField;
exports.NameField = NameField;
exports.OneTimeCodeField = OneTimeCodeField;
exports.PamHostnameField = PamHostnameField;
exports.PamResourceField = PamResourceField;
exports.PasskeyField = PasskeyField;
exports.PasswordField = PasswordField;
exports.PaymentCardField = PaymentCardField;
exports.PhoneField = PhoneField;
exports.PinCodeField = PinCodeField;
exports.RecordRefField = RecordRefField;
exports.ScheduleField = ScheduleField;
exports.ScriptField = ScriptField;
exports.SecretField = SecretField;
exports.SecureNoteField = SecureNoteField;
exports.SecurityQuestionField = SecurityQuestionField;
exports.TextField = TextField;
exports.UrlField = UrlField;
exports.addCustomField = addCustomField;
exports.cachingPostFunction = cachingPostFunction;
exports.connectPlatform = connectPlatform;
exports.createFolder = createFolder;
exports.createSecret = createSecret;
exports.createSecret2 = createSecret2;
exports.deleteFolder = deleteFolder;
exports.deleteSecret = deleteSecret;
exports.downloadFile = downloadFile;
exports.downloadThumbnail = downloadThumbnail;
exports.findSecretByTitle = findSecretByTitle;
exports.findSecretsByTitle = findSecretsByTitle;
exports.generatePassword = generatePassword;
exports.generateTransmissionKey = generateTransmissionKey;
exports.getClientId = getClientId;
exports.getFolders = getFolders;
exports.getNotationResults = getNotationResults;
exports.getSecretByTitle = getSecretByTitle;
exports.getSecrets = getSecrets;
exports.getSecrets2 = getSecrets2;
exports.getSecretsByTitle = getSecretsByTitle;
exports.getTotpCode = getTotpCode;
exports.getValue = getValue;
exports.inMemoryStorage = inMemoryStorage;
exports.initialize = initialize;
exports.initializeStorage = initializeStorage;
exports.loadJsonConfig = loadJsonConfig;
exports.localConfigStorage = localConfigStorage;
exports.parseNotation = parseNotation;
exports.tryGetNotationResults = tryGetNotationResults;
exports.updateFolder = updateFolder;
exports.updateSecret = updateSecret;
exports.uploadFile = uploadFile;
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

/***/ 840:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
Object.defineProperty(exports, "v1", ({
  enumerable: true,
  get: function () {
    return _v.default;
  }
}));
Object.defineProperty(exports, "v3", ({
  enumerable: true,
  get: function () {
    return _v2.default;
  }
}));
Object.defineProperty(exports, "v4", ({
  enumerable: true,
  get: function () {
    return _v3.default;
  }
}));
Object.defineProperty(exports, "v5", ({
  enumerable: true,
  get: function () {
    return _v4.default;
  }
}));
Object.defineProperty(exports, "NIL", ({
  enumerable: true,
  get: function () {
    return _nil.default;
  }
}));
Object.defineProperty(exports, "version", ({
  enumerable: true,
  get: function () {
    return _version.default;
  }
}));
Object.defineProperty(exports, "validate", ({
  enumerable: true,
  get: function () {
    return _validate.default;
  }
}));
Object.defineProperty(exports, "stringify", ({
  enumerable: true,
  get: function () {
    return _stringify.default;
  }
}));
Object.defineProperty(exports, "parse", ({
  enumerable: true,
  get: function () {
    return _parse.default;
  }
}));

var _v = _interopRequireDefault(__nccwpck_require__(628));

var _v2 = _interopRequireDefault(__nccwpck_require__(409));

var _v3 = _interopRequireDefault(__nccwpck_require__(122));

var _v4 = _interopRequireDefault(__nccwpck_require__(120));

var _nil = _interopRequireDefault(__nccwpck_require__(332));

var _version = _interopRequireDefault(__nccwpck_require__(595));

var _validate = _interopRequireDefault(__nccwpck_require__(900));

var _stringify = _interopRequireDefault(__nccwpck_require__(950));

var _parse = _interopRequireDefault(__nccwpck_require__(746));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/***/ }),

/***/ 569:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _crypto = _interopRequireDefault(__nccwpck_require__(113));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function md5(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === 'string') {
    bytes = Buffer.from(bytes, 'utf8');
  }

  return _crypto.default.createHash('md5').update(bytes).digest();
}

var _default = md5;
exports["default"] = _default;

/***/ }),

/***/ 332:
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = '00000000-0000-0000-0000-000000000000';
exports["default"] = _default;

/***/ }),

/***/ 746:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__nccwpck_require__(900));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  let v;
  const arr = new Uint8Array(16); // Parse ########-....-....-....-............

  arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
  arr[1] = v >>> 16 & 0xff;
  arr[2] = v >>> 8 & 0xff;
  arr[3] = v & 0xff; // Parse ........-####-....-....-............

  arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
  arr[5] = v & 0xff; // Parse ........-....-####-....-............

  arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
  arr[7] = v & 0xff; // Parse ........-....-....-####-............

  arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
  arr[9] = v & 0xff; // Parse ........-....-....-....-############
  // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)

  arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
  arr[11] = v / 0x100000000 & 0xff;
  arr[12] = v >>> 24 & 0xff;
  arr[13] = v >>> 16 & 0xff;
  arr[14] = v >>> 8 & 0xff;
  arr[15] = v & 0xff;
  return arr;
}

var _default = parse;
exports["default"] = _default;

/***/ }),

/***/ 814:
/***/ ((__unused_webpack_module, exports) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;
var _default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i;
exports["default"] = _default;

/***/ }),

/***/ 807:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = rng;

var _crypto = _interopRequireDefault(__nccwpck_require__(113));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate

let poolPtr = rnds8Pool.length;

function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    _crypto.default.randomFillSync(rnds8Pool);

    poolPtr = 0;
  }

  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

/***/ }),

/***/ 274:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _crypto = _interopRequireDefault(__nccwpck_require__(113));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function sha1(bytes) {
  if (Array.isArray(bytes)) {
    bytes = Buffer.from(bytes);
  } else if (typeof bytes === 'string') {
    bytes = Buffer.from(bytes, 'utf8');
  }

  return _crypto.default.createHash('sha1').update(bytes).digest();
}

var _default = sha1;
exports["default"] = _default;

/***/ }),

/***/ 950:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__nccwpck_require__(900));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];

for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 0x100).toString(16).substr(1));
}

function stringify(arr, offset = 0) {
  // Note: Be careful editing this code!  It's been tuned for performance
  // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
  const uuid = (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase(); // Consistency check for valid UUID.  If this throws, it's likely due to one
  // of the following:
  // - One or more input array values don't map to a hex octet (leading to
  // "undefined" in the uuid)
  // - Invalid input values for the RFC `version` or `variant` fields

  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Stringified UUID is invalid');
  }

  return uuid;
}

var _default = stringify;
exports["default"] = _default;

/***/ }),

/***/ 628:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _rng = _interopRequireDefault(__nccwpck_require__(807));

var _stringify = _interopRequireDefault(__nccwpck_require__(950));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;

let _clockseq; // Previous uuid creation time


let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details

function v1(options, buf, offset) {
  let i = buf && offset || 0;
  const b = buf || new Array(16);
  options = options || {};
  let node = options.node || _nodeId;
  let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
  // specified.  We do this lazily to minimize issues related to insufficient
  // system entropy.  See #189

  if (node == null || clockseq == null) {
    const seedBytes = options.random || (options.rng || _rng.default)();

    if (node == null) {
      // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
      node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
    }

    if (clockseq == null) {
      // Per 4.2.2, randomize (14 bit) clockseq
      clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
    }
  } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
  // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
  // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
  // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.


  let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
  // cycle to simulate higher resolution clock

  let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)

  const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression

  if (dt < 0 && options.clockseq === undefined) {
    clockseq = clockseq + 1 & 0x3fff;
  } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
  // time interval


  if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
    nsecs = 0;
  } // Per 4.2.1.2 Throw error if too many uuids are requested


  if (nsecs >= 10000) {
    throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
  }

  _lastMSecs = msecs;
  _lastNSecs = nsecs;
  _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch

  msecs += 12219292800000; // `time_low`

  const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
  b[i++] = tl >>> 24 & 0xff;
  b[i++] = tl >>> 16 & 0xff;
  b[i++] = tl >>> 8 & 0xff;
  b[i++] = tl & 0xff; // `time_mid`

  const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
  b[i++] = tmh >>> 8 & 0xff;
  b[i++] = tmh & 0xff; // `time_high_and_version`

  b[i++] = tmh >>> 24 & 0xf | 0x10; // include version

  b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)

  b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`

  b[i++] = clockseq & 0xff; // `node`

  for (let n = 0; n < 6; ++n) {
    b[i + n] = node[n];
  }

  return buf || (0, _stringify.default)(b);
}

var _default = v1;
exports["default"] = _default;

/***/ }),

/***/ 409:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__nccwpck_require__(998));

var _md = _interopRequireDefault(__nccwpck_require__(569));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v3 = (0, _v.default)('v3', 0x30, _md.default);
var _default = v3;
exports["default"] = _default;

/***/ }),

/***/ 998:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = _default;
exports.URL = exports.DNS = void 0;

var _stringify = _interopRequireDefault(__nccwpck_require__(950));

var _parse = _interopRequireDefault(__nccwpck_require__(746));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function stringToBytes(str) {
  str = unescape(encodeURIComponent(str)); // UTF8 escape

  const bytes = [];

  for (let i = 0; i < str.length; ++i) {
    bytes.push(str.charCodeAt(i));
  }

  return bytes;
}

const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
exports.DNS = DNS;
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
exports.URL = URL;

function _default(name, version, hashfunc) {
  function generateUUID(value, namespace, buf, offset) {
    if (typeof value === 'string') {
      value = stringToBytes(value);
    }

    if (typeof namespace === 'string') {
      namespace = (0, _parse.default)(namespace);
    }

    if (namespace.length !== 16) {
      throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
    } // Compute hash of namespace and value, Per 4.3
    // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
    // hashfunc([...namespace, ... value])`


    let bytes = new Uint8Array(16 + value.length);
    bytes.set(namespace);
    bytes.set(value, namespace.length);
    bytes = hashfunc(bytes);
    bytes[6] = bytes[6] & 0x0f | version;
    bytes[8] = bytes[8] & 0x3f | 0x80;

    if (buf) {
      offset = offset || 0;

      for (let i = 0; i < 16; ++i) {
        buf[offset + i] = bytes[i];
      }

      return buf;
    }

    return (0, _stringify.default)(bytes);
  } // Function#name is not settable on some platforms (#270)


  try {
    generateUUID.name = name; // eslint-disable-next-line no-empty
  } catch (err) {} // For CommonJS default export support


  generateUUID.DNS = DNS;
  generateUUID.URL = URL;
  return generateUUID;
}

/***/ }),

/***/ 122:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _rng = _interopRequireDefault(__nccwpck_require__(807));

var _stringify = _interopRequireDefault(__nccwpck_require__(950));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function v4(options, buf, offset) {
  options = options || {};

  const rnds = options.random || (options.rng || _rng.default)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`


  rnds[6] = rnds[6] & 0x0f | 0x40;
  rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided

  if (buf) {
    offset = offset || 0;

    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }

    return buf;
  }

  return (0, _stringify.default)(rnds);
}

var _default = v4;
exports["default"] = _default;

/***/ }),

/***/ 120:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _v = _interopRequireDefault(__nccwpck_require__(998));

var _sha = _interopRequireDefault(__nccwpck_require__(274));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const v5 = (0, _v.default)('v5', 0x50, _sha.default);
var _default = v5;
exports["default"] = _default;

/***/ }),

/***/ 900:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _regex = _interopRequireDefault(__nccwpck_require__(814));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function validate(uuid) {
  return typeof uuid === 'string' && _regex.default.test(uuid);
}

var _default = validate;
exports["default"] = _default;

/***/ }),

/***/ 595:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

"use strict";


Object.defineProperty(exports, "__esModule", ({
  value: true
}));
exports["default"] = void 0;

var _validate = _interopRequireDefault(__nccwpck_require__(900));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function version(uuid) {
  if (!(0, _validate.default)(uuid)) {
    throw TypeError('Invalid UUID');
  }

  return parseInt(uuid.substr(14, 1), 16);
}

var _default = version;
exports["default"] = _default;

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