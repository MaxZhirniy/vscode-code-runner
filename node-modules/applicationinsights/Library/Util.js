"use strict";
var url = require("url");
var Logging = require("./Logging");
var Util = (function () {
    function Util() {
    }
    /**
     * helper method to access userId and sessionId cookie
     */
    Util.getCookie = function (name, cookie) {
        var value = "";
        if (name && name.length && typeof cookie === "string") {
            var cookieName = name + "=";
            var cookies = cookie.split(";");
            for (var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i];
                cookie = Util.trim(cookie);
                if (cookie && cookie.indexOf(cookieName) === 0) {
                    value = cookie.substring(cookieName.length, cookies[i].length);
                    break;
                }
            }
        }
        return value;
    };
    /**
     * helper method to trim strings (IE8 does not implement String.prototype.trim)
     */
    Util.trim = function (str) {
        if (typeof str === "string") {
            return str.replace(/^\s+|\s+$/g, "");
        }
        else {
            return "";
        }
    };
    /**
     * Convert an array of int32 to Base64 (no '==' at the end).
     * MSB first.
     */
    Util.int32ArrayToBase64 = function (array) {
        var toChar = function (v, i) {
            return String.fromCharCode((v >> i) & 0xFF);
        };
        var int32AsString = function (v) {
            return toChar(v, 24) + toChar(v, 16) + toChar(v, 8) + toChar(v, 0);
        };
        var x = array.map(int32AsString).join("");
        var s = new Buffer(x, "binary").toString("base64");
        return s.substr(0, s.indexOf("="));
    };
    /**
     * generate a random 32bit number (-0x80000000..0x7FFFFFFF).
     */
    Util.random32 = function () {
        return (0x100000000 * Math.random()) | 0;
    };
    /**
     * generate GUID
     */
    Util.newGuid = function () {
        var hexValues = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        // c.f. rfc4122 (UUID version 4 = xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx)
        var oct = "", tmp;
        for (var a = 0; a < 4; a++) {
            tmp = Util.random32();
            oct +=
                hexValues[tmp & 0xF] +
                    hexValues[tmp >> 4 & 0xF] +
                    hexValues[tmp >> 8 & 0xF] +
                    hexValues[tmp >> 12 & 0xF] +
                    hexValues[tmp >> 16 & 0xF] +
                    hexValues[tmp >> 20 & 0xF] +
                    hexValues[tmp >> 24 & 0xF] +
                    hexValues[tmp >> 28 & 0xF];
        }
        // "Set the two most significant bits (bits 6 and 7) of the clock_seq_hi_and_reserved to zero and one, respectively"
        var clockSequenceHi = hexValues[8 + (Math.random() * 4) | 0];
        return oct.substr(0, 8) + "-" + oct.substr(9, 4) + "-4" + oct.substr(13, 3) + "-" + clockSequenceHi + oct.substr(16, 3) + "-" + oct.substr(19, 12);
    };
    /**
     * Check if an object is of type Array
     */
    Util.isArray = function (obj) {
        return Object.prototype.toString.call(obj) === "[object Array]";
    };
    /**
     * Check if an object is of type Error
     */
    Util.isError = function (obj) {
        return obj instanceof Error;
    };
    /**
     * Check if an object is of type Date
     */
    Util.isDate = function (obj) {
        return Object.prototype.toString.call(obj) === "[object Date]";
    };
    /**
     * Convert ms to c# time span format
     */
    Util.msToTimeSpan = function (totalms) {
        if (isNaN(totalms) || totalms < 0) {
            totalms = 0;
        }
        var ms = "" + totalms % 1000;
        var sec = "" + Math.floor(totalms / 1000) % 60;
        var min = "" + Math.floor(totalms / (1000 * 60)) % 60;
        var hour = "" + Math.floor(totalms / (1000 * 60 * 60)) % 24;
        var days = Math.floor(totalms / (1000 * 60 * 60 * 24));
        ms = ms.length === 1 ? "00" + ms : ms.length === 2 ? "0" + ms : ms;
        sec = sec.length < 2 ? "0" + sec : sec;
        min = min.length < 2 ? "0" + min : min;
        hour = hour.length < 2 ? "0" + hour : hour;
        var daysText = days > 0 ? days + "." : "";
        return daysText + hour + ":" + min + ":" + sec + "." + ms;
    };
    /**
     * Validate that an object is of type { [key: string]: string }
     */
    Util.validateStringMap = function (obj) {
        var map;
        if (typeof obj === "object") {
            map = {};
            for (var field in obj) {
                var property = obj[field];
                var propertyType = typeof property;
                if (propertyType !== "string") {
                    if (property != null && typeof property.toString === "function") {
                        property = property.toString();
                    }
                    else {
                        Logging.info("key: " + field + ", invalid property type: " + propertyType);
                        continue;
                    }
                }
                map[field] = property.trim(0, Util.MAX_PROPERTY_LENGTH);
            }
        }
        else {
            Logging.info("Invalid properties dropped from payload");
        }
        return map;
    };
    /**
     * Checks if a request url is not on a excluded domain list
     * and if it is safe to add correlation headers (x-ms-request-source-ikey, x-ms-request-target-ikey)
     */
    Util.canIncludeCorrelationHeader = function (client, requestUrl) {
        var excludedDomains = client && client.config && client.config.correlationHeaderExcludedDomains;
        if (!excludedDomains || excludedDomains.length == 0 || !requestUrl) {
            return true;
        }
        for (var i = 0; i < excludedDomains.length; i++) {
            var regex = new RegExp(excludedDomains[i].replace(/\./g, "\.").replace(/\*/g, ".*"));
            if (regex.test(url.parse(requestUrl).hostname)) {
                return false;
            }
        }
        return true;
    };
    Util.MAX_PROPERTY_LENGTH = 1024;
    Util.document = typeof document !== "undefined" ? document : {};
    return Util;
}());
module.exports = Util;
