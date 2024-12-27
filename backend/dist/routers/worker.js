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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const middleware_1 = require("../middleware");
const db_1 = require("../db");
const types_1 = require("./types");
const router = (0, express_1.Router)();
const prismaClient = new client_1.PrismaClient();
prismaClient.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
    // Code running in a transaction...
}), {
    maxWait: 5000, // default: 2000
    timeout: 10000, // default: 5000
});
const TOTAL_SUMISSIONS = 100;
//@ts-ignore
router.post("/payout", middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    //lock this row , so that until this transaction is complete no further requests can manipulate this row.
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    });
    if (!worker) {
        res.status(411).json({
            message: "Worker not found"
        });
    }
    const address = worker === null || worker === void 0 ? void 0 : worker.address;
    //create a signature for the payout between worker and user who created the task
    // use @solana/web3.create()  -> come to this later.
    //{ to address: dynamic, from address: fixed(user who created the task) }
    //this is recieved after the above signature has been created for the solana transaction
    const transactionId = "01x7381a";
    //update database , put pending amount to locked amount , create payout db with signature , id and status as processing.
    yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        //lock table so that, in case the user makes multiple requests the pending_amount does not go below zero.
        //note that the below code only updates the "worker" table in the db and not the "worker object" recieved above
        yield tx.worker.update({
            where: {
                id: Number(userId)
            },
            data: {
                pending_amount: {
                    decrement: worker === null || worker === void 0 ? void 0 : worker.pending_amount
                },
                locked_amount: {
                    increment: worker === null || worker === void 0 ? void 0 : worker.pending_amount
                }
            }
        });
        yield tx.payouts.create({
            data: {
                user_id: Number(userId),
                signature: transactionId,
                status: "Processing",
                amount: (_a = worker === null || worker === void 0 ? void 0 : worker.pending_amount) !== null && _a !== void 0 ? _a : -1
            }
        });
    }));
    // *IMPORTANT* write logic for solana blockchain , to update transaction into the blockchain or constantly check for "success" message in payouts.
    res.json({
        message: "Processing payout",
        amount: worker === null || worker === void 0 ? void 0 : worker.pending_amount
    });
}));
//@ts-ignore
router.post("/balance", middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield prismaClient.worker.findFirst({
        where: {
            id: Number(userId)
        }
    });
    res.json({
        pendingAmount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
        lockedAmount: worker === null || worker === void 0 ? void 0 : worker.locked_amount
    });
}));
//@ts-ignore
router.post("/submission", middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parseData = types_1.createSubmissionInput.safeParse(body);
    if (!parseData.success) {
        res.status(411).json({
            message: "Submission Input is not in the correct format"
        });
    }
    //get current task
    const task = yield (0, db_1.getNextTask)(Number(userId));
    if (!task || task.id !== Number((_a = parseData.data) === null || _a === void 0 ? void 0 : _a.task_id)) {
        res.status(411).json({
            message: "Task not submitted, incorrect task id"
        });
    }
    const amount = Number(task === null || task === void 0 ? void 0 : task.amount) / TOTAL_SUMISSIONS;
    //submit the option chosen for task along with the amount made by worker for submitting the task.
    const submission = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        const submission = yield tx.submission.create({
            data: {
                worker_id: userId,
                option_id: Number((_a = parseData.data) === null || _a === void 0 ? void 0 : _a.option_id),
                task_id: Number((_b = parseData.data) === null || _b === void 0 ? void 0 : _b.task_id),
                amount
            }
        });
        //update the amount made by the worker 
        yield tx.worker.update({
            where: {
                id: userId
            },
            data: {
                pending_amount: {
                    increment: amount
                }
            }
        });
        return submission;
    }));
    const nextTask = yield (0, db_1.getNextTask)(Number(userId));
    res.json({
        nextTask,
        amount
    });
}));
//@ts-ignore
router.get("/nextTask", middleware_1.workerAuthMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const task = yield (0, db_1.getNextTask)(Number(userId));
    if (!task) {
        res.status(411).json({
            message: "No more tasks left for you to review"
        });
    }
    res.json({ task });
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //logic to be added
    const hardcodedWalletAddress = "zHgdjue647uiejdi2IIj";
    const existingUser = yield prismaClient.worker.findFirst({
        where: {
            address: hardcodedWalletAddress,
        }
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id
        }, config_1.WORKER_JWT_SECRET);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.worker.create({
            data: {
                address: hardcodedWalletAddress,
                pending_amount: 0,
                locked_amount: 0
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id
        }, config_1.WORKER_JWT_SECRET);
        res.json({ token });
    }
}));
exports.default = router;
