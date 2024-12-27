"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
exports.workerAuthMiddleware = workerAuthMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("./config");
const config_2 = require("./config");
function authMiddleware(req, res, next) {
    var _a;
    const authHeader = (_a = req.headers["authorization"]) !== null && _a !== void 0 ? _a : "";
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader, config_1.JWT_SECRET);
        //@ts-ignore
        if (!decoded.userId) {
            return res.status(403).json({
                message: "You are not logged in",
            });
        }
        //@ts-ignore
        req.userId = decoded.userId;
        next();
    }
    catch (err) {
        return res.status(403).json({
            message: "You are not logged in",
        });
    }
}
;
function workerAuthMiddleware(req, res, next) {
    var _a;
    const authHeader = (_a = req.headers["authorization"]) !== null && _a !== void 0 ? _a : "";
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader, config_2.WORKER_JWT_SECRET);
        //@ts-ignore
        if (!decoded.userId) {
            return res.status(403).json({
                message: "You are not logged in",
            });
        }
        //@ts-ignore
        req.userId = decoded.userId;
        next();
    }
    catch (err) {
        return res.status(403).json({
            message: "You are not logged in error",
        });
    }
}
;
