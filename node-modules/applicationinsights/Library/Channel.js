"use strict";
var Logging = require("./Logging");
var Channel = (function () {
    function Channel(isDisabled, getBatchSize, getBatchIntervalMs, sender) {
        this._buffer = [];
        this._lastSend = 0;
        this._isDisabled = isDisabled;
        this._getBatchSize = getBatchSize;
        this._getBatchIntervalMs = getBatchIntervalMs;
        this._sender = sender;
    }
    /**
     * Enable or disable offline mode
     */
    Channel.prototype.setOfflineMode = function (value, resendInterval) {
        this._sender.setOfflineMode(value, resendInterval);
    };
    /**
     * Add a telemetry item to the send buffer
     */
    Channel.prototype.send = function (envelope) {
        var _this = this;
        // if master off switch is set, don't send any data
        if (this._isDisabled()) {
            // Do not send/save data
            return;
        }
        // validate input
        if (!envelope) {
            Logging.warn("Cannot send null/undefined telemetry");
            return;
        }
        // check if the incoming payload is too large, truncate if necessary
        var payload = this._stringify(envelope);
        if (typeof payload !== "string") {
            return;
        }
        // enqueue the payload
        this._buffer.push(payload);
        // flush if we would exceed the max-size limit by adding this item
        if (this._buffer.length >= this._getBatchSize()) {
            this.triggerSend(false);
            return;
        }
        // ensure an invocation timeout is set if anything is in the buffer
        if (!this._timeoutHandle && this._buffer.length > 0) {
            this._timeoutHandle = setTimeout(function () {
                _this._timeoutHandle = null;
                _this.triggerSend(false);
            }, this._getBatchIntervalMs());
        }
    };
    Channel.prototype.handleCrash = function (envelope) {
        if (envelope) {
            var payload = this._stringify(envelope);
            if (typeof payload === "string") {
                this._buffer.push(payload);
                this.triggerSend(true);
            }
            else {
                Logging.warn("Could not send crash", envelope);
            }
        }
        else {
            Logging.warn("handleCrash was called with empty payload", envelope);
        }
    };
    /**
     * Immediately send buffered data
     */
    Channel.prototype.triggerSend = function (isNodeCrashing, callback) {
        var bufferIsEmpty = this._buffer.length < 1;
        if (!bufferIsEmpty) {
            // compose an array of payloads
            var batch = this._buffer.join("\n");
            // invoke send
            if (isNodeCrashing) {
                this._sender.saveOnCrash(batch);
                if (typeof callback === "function") {
                    callback("data saved on crash");
                }
            }
            else {
                this._sender.send(new Buffer(batch), callback);
            }
        }
        // update lastSend time to enable throttling
        this._lastSend = +new Date;
        // clear buffer
        this._buffer.length = 0;
        clearTimeout(this._timeoutHandle);
        this._timeoutHandle = null;
        if (bufferIsEmpty && typeof callback === "function") {
            callback("no data to send");
        }
    };
    Channel.prototype._stringify = function (envelope) {
        try {
            return JSON.stringify(envelope);
        }
        catch (error) {
            Logging.warn("Failed to serialize payload", error, envelope);
        }
    };
    return Channel;
}());
module.exports = Channel;
