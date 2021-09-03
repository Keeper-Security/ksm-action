require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 109:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
const fs = __importStar(__nccwpck_require__(747));
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
        const inputParts = input.replace(/\s/g, '').split('>');
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
    const fileData = yield secrets_manager_core_1.downloadFile(file);
    fs.writeFileSync(destination, fileData);
});
const run = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const config = core.getInput('keeper-secret-config');
        core.debug(config);
        const inputs = exports.parseSecretsInputs(core.getMultilineInput('secrets'));
        const secrets = yield secrets_manager_core_1.getSecrets({ storage: secrets_manager_core_1.loadJsonConfig(config) }, exports.getRecordUids(inputs));
        for (const input of inputs) {
            const secret = secrets_manager_core_1.getValue(secrets, input.notation);
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
        core.setFailed(error.message);
    }
});
run();


/***/ }),

/***/ 351:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
const os = __importStar(__nccwpck_require__(87));
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
exports.getState = exports.saveState = exports.group = exports.endGroup = exports.startGroup = exports.info = exports.warning = exports.error = exports.debug = exports.isDebug = exports.setFailed = exports.setCommandEcho = exports.setOutput = exports.getBooleanInput = exports.getMultilineInput = exports.getInput = exports.addPath = exports.setSecret = exports.exportVariable = exports.ExitCode = void 0;
const command_1 = __nccwpck_require__(351);
const file_command_1 = __nccwpck_require__(717);
const utils_1 = __nccwpck_require__(278);
const os = __importStar(__nccwpck_require__(87));
const path = __importStar(__nccwpck_require__(622));
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
 */
function error(message) {
    command_1.issue('error', message instanceof Error ? message.toString() : message);
}
exports.error = error;
/**
 * Adds an warning issue
 * @param message warning issue message. Errors will be converted to string via toString()
 */
function warning(message) {
    command_1.issue('warning', message instanceof Error ? message.toString() : message);
}
exports.warning = warning;
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
//# sourceMappingURL=core.js.map

/***/ }),

/***/ 717:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


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
const fs = __importStar(__nccwpck_require__(747));
const os = __importStar(__nccwpck_require__(87));
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

/***/ 278:
/***/ ((__unused_webpack_module, exports) => {


// We use any as a valid input type
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toCommandValue = void 0;
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
//# sourceMappingURL=utils.js.map

/***/ }),

/***/ 13:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {

/* Version: 16.0.16 - September 3, 2021 19:26:00 */


Object.defineProperty(exports, "__esModule", ({ value: true }));

var https = __nccwpck_require__(211);
var crypto = __nccwpck_require__(417);
var fs = __nccwpck_require__(747);

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
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
    return inMemoryStorage(JSON.parse(config));
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
const sign = (data, keyId, storage) => __awaiter(void 0, void 0, void 0, function* () {
    const privateKeyDer = yield loadKey(keyId, storage);
    const key = crypto.createPrivateKey({
        key: Buffer.from(privateKeyDer),
        format: 'der',
        type: 'pkcs8',
    });
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
    cleanKeyCache: cleanKeyCache
};

let packageVersion = '16.0.16';
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
const initializeStorage = (storage, clientKey, hostName) => __awaiter(void 0, void 0, void 0, function* () {
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
    yield storage.saveString(KEY_HOSTNAME, hostName);
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
exports.generateTransmissionKey = generateTransmissionKey;
exports.getClientId = getClientId;
exports.getSecrets = getSecrets;
exports.getValue = getValue;
exports.inMemoryStorage = inMemoryStorage;
exports.initialize = initialize;
exports.initializeStorage = initializeStorage;
exports.loadJsonConfig = loadJsonConfig;
exports.localConfigStorage = localConfigStorage;
exports.updateSecret = updateSecret;
//# sourceMappingURL=index.cjs.js.map


/***/ }),

/***/ 417:
/***/ ((module) => {

module.exports = require("crypto");

/***/ }),

/***/ 747:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 211:
/***/ ((module) => {

module.exports = require("https");

/***/ }),

/***/ 87:
/***/ ((module) => {

module.exports = require("os");

/***/ }),

/***/ 622:
/***/ ((module) => {

module.exports = require("path");

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