///<reference path="..\typings\globals\node\index.d.ts" />
"use strict";
var ContractsModule = require("../Library/Contracts");
var Util = require("../Library/Util");
var AutoCollectExceptions = (function () {
    function AutoCollectExceptions(client) {
        if (!!AutoCollectExceptions.INSTANCE) {
            throw new Error("Exception tracking should be configured from the applicationInsights object");
        }
        AutoCollectExceptions.INSTANCE = this;
        this._client = client;
    }
    AutoCollectExceptions.prototype.isInitialized = function () {
        return this._isInitialized;
    };
    AutoCollectExceptions.prototype.enable = function (isEnabled) {
        var _this = this;
        if (isEnabled) {
            this._isInitialized = true;
            var self = this;
            if (!this._exceptionListenerHandle) {
                var handle = function (reThrow, error) {
                    var data = AutoCollectExceptions.getExceptionData(error, false);
                    var envelope = _this._client.getEnvelope(data);
                    _this._client.channel.handleCrash(envelope);
                    if (reThrow) {
                        throw error;
                    }
                };
                this._exceptionListenerHandle = handle.bind(this, true);
                this._rejectionListenerHandle = handle.bind(this, false);
                process.on("uncaughtException", this._exceptionListenerHandle);
                process.on("unhandledRejection", this._rejectionListenerHandle);
            }
        }
        else {
            if (this._exceptionListenerHandle) {
                process.removeListener("uncaughtException", this._exceptionListenerHandle);
                process.removeListener("unhandledRejection", this._rejectionListenerHandle);
                this._exceptionListenerHandle = undefined;
                this._rejectionListenerHandle = undefined;
                delete this._exceptionListenerHandle;
                delete this._rejectionListenerHandle;
            }
        }
    };
    /**
     * Track an exception
     * @param error the exception to track
     * @param handledAt where this exception was handled (leave null for unhandled)
     * @param properties additional properties
     * @param measurements metrics associated with this event, displayed in Metrics Explorer on the portal. Defaults to empty.
     */
    AutoCollectExceptions.getExceptionData = function (error, isHandled, properties, measurements) {
        var exception = new ContractsModule.Contracts.ExceptionData();
        exception.properties = properties;
        exception.severityLevel = ContractsModule.Contracts.SeverityLevel.Error;
        exception.measurements = measurements;
        exception.exceptions = [];
        var stack = error["stack"];
        var exceptionDetails = new ContractsModule.Contracts.ExceptionDetails();
        exceptionDetails.message = error.message;
        exceptionDetails.typeName = error.name;
        exceptionDetails.parsedStack = this.parseStack(stack);
        exceptionDetails.hasFullStack = Util.isArray(exceptionDetails.parsedStack) && exceptionDetails.parsedStack.length > 0;
        exception.exceptions.push(exceptionDetails);
        var data = new ContractsModule.Contracts.Data();
        data.baseType = "Microsoft.ApplicationInsights.ExceptionData";
        data.baseData = exception;
        return data;
    };
    AutoCollectExceptions.parseStack = function (stack) {
        var parsedStack = undefined;
        if (typeof stack === "string") {
            var frames = stack.split("\n");
            parsedStack = [];
            var level = 0;
            var totalSizeInBytes = 0;
            for (var i = 0; i <= frames.length; i++) {
                var frame = frames[i];
                if (_StackFrame.regex.test(frame)) {
                    var parsedFrame = new _StackFrame(frames[i], level++);
                    totalSizeInBytes += parsedFrame.sizeInBytes;
                    parsedStack.push(parsedFrame);
                }
            }
            // DP Constraint - exception parsed stack must be < 32KB
            // remove frames from the middle to meet the threshold
            var exceptionParsedStackThreshold = 32 * 1024;
            if (totalSizeInBytes > exceptionParsedStackThreshold) {
                var left = 0;
                var right = parsedStack.length - 1;
                var size = 0;
                var acceptedLeft = left;
                var acceptedRight = right;
                while (left < right) {
                    // check size
                    var lSize = parsedStack[left].sizeInBytes;
                    var rSize = parsedStack[right].sizeInBytes;
                    size += lSize + rSize;
                    if (size > exceptionParsedStackThreshold) {
                        // remove extra frames from the middle
                        var howMany = acceptedRight - acceptedLeft + 1;
                        parsedStack.splice(acceptedLeft, howMany);
                        break;
                    }
                    // update pointers
                    acceptedLeft = left;
                    acceptedRight = right;
                    left++;
                    right--;
                }
            }
        }
        return parsedStack;
    };
    AutoCollectExceptions.prototype.dispose = function () {
        AutoCollectExceptions.INSTANCE = null;
        this._isInitialized = false;
    };
    AutoCollectExceptions.INSTANCE = null;
    return AutoCollectExceptions;
}());
var _StackFrame = (function () {
    function _StackFrame(frame, level) {
        this.sizeInBytes = 0;
        this.level = level;
        this.method = "<no_method>";
        this.assembly = Util.trim(frame);
        var matches = frame.match(_StackFrame.regex);
        if (matches && matches.length >= 5) {
            this.method = Util.trim(matches[2]) || this.method;
            this.fileName = Util.trim(matches[4]) || "<no_filename>";
            this.line = parseInt(matches[5]) || 0;
        }
        this.sizeInBytes += this.method.length;
        this.sizeInBytes += this.fileName.length;
        this.sizeInBytes += this.assembly.length;
        // todo: these might need to be removed depending on how the back-end settles on their size calculation
        this.sizeInBytes += _StackFrame.baseSize;
        this.sizeInBytes += this.level.toString().length;
        this.sizeInBytes += this.line.toString().length;
    }
    // regex to match stack frames from ie/chrome/ff
    // methodName=$2, fileName=$4, lineNo=$5, column=$6
    _StackFrame.regex = /^([\s]+at)?(.*?)(\@|\s\(|\s)([^\(\@\n]+):([0-9]+):([0-9]+)(\)?)$/;
    _StackFrame.baseSize = 58; //'{"method":"","level":,"assembly":"","fileName":"","line":}'.length
    return _StackFrame;
}());
module.exports = AutoCollectExceptions;
