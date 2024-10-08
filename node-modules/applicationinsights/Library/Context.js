///<reference path="..\typings\globals\node\index.d.ts" />
"use strict";
var os = require("os");
var ContractsModule = require("../Library/Contracts");
var Logging = require("./Logging");
var Context = (function () {
    function Context(packageJsonPath) {
        this.keys = new ContractsModule.Contracts.ContextTagKeys();
        this.tags = {};
        this._loadApplicationContext();
        this._loadDeviceContext();
        this._loadInternalContext();
    }
    Context.prototype._loadApplicationContext = function (packageJsonPath) {
        var version = "unknown";
        var description = undefined;
        try {
            // note: this should return the host package.json
            var packageJson = require(packageJsonPath || "../../../package.json");
            if (packageJson) {
                if (typeof packageJson.version === "string") {
                    version = packageJson.version;
                }
                if (typeof packageJson.description === "string") {
                    description = packageJson.description;
                }
            }
        }
        catch (exception) {
            Logging.info("unable to read app version: ", exception);
        }
        this.tags[this.keys.applicationVersion] = version;
        // TODO: consider sending it as a custom property
        //if(description) {
        //    this.tags[this.keys.applicationBuild] = description;
        //}
    };
    Context.prototype._loadDeviceContext = function () {
        this.tags[this.keys.deviceId] = "";
        this.tags[this.keys.cloudRoleInstance] = os && os.hostname();
        this.tags[this.keys.deviceOSVersion] = os && os.type() + " " + os && os.release();
        // not yet supported tags
        this.tags["ai.device.osArchitecture"] = os && os.arch();
        this.tags["ai.device.osPlatform"] = os && os.platform();
    };
    Context.prototype._loadInternalContext = function () {
        var version = "unknown";
        try {
            // note: this should return the appInsights package.json
            var packageJson = require("../package.json");
            if (packageJson && typeof packageJson.version === "string") {
                version = packageJson.version;
            }
        }
        catch (exception) {
            Logging.info("unable to read SDK version: " + exception);
        }
        this.tags[this.keys.internalSdkVersion] = "node:" + version || "unknown";
    };
    return Context;
}());
module.exports = Context;
