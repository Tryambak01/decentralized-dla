"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSubmissionInput = exports.createTaskInput = void 0;
const zod_1 = __importDefault(require("zod"));
exports.createTaskInput = zod_1.default.object({
    options: zod_1.default.array(zod_1.default.object({
        image_url: zod_1.default.string()
    })).min(2),
    title: zod_1.default.string().optional(),
    signature: zod_1.default.string(),
});
exports.createSubmissionInput = zod_1.default.object({
    task_id: zod_1.default.string(),
    option_id: zod_1.default.string(),
});
