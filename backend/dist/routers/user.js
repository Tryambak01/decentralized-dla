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
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const middleware_1 = require("../middleware");
const types_1 = require("./types");
const prismaClient = new client_1.PrismaClient();
prismaClient.$transaction((prisma) => __awaiter(void 0, void 0, void 0, function* () {
    // Code running in a transaction...
}), {
    maxWait: 5000, // default: 2000
    timeout: 10000, // default: 5000
});
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const region = process.env.REGION;
if (!accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials are missing!');
}
const s3Client = new client_s3_1.S3Client({
    credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
    },
    region: region,
});
const router = (0, express_1.Router)();
const DEFAULT_TITLE = "Select the most clickable thumbnail!";
//@ts-ignore
router.get("/task", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const taskId = req.query.taskId;
    //@ts-ignore
    const userId = req.userId;
    //get task from task Id along with the options for that task
    const taskDetails = yield prismaClient.task.findFirst({
        where: {
            user_id: Number(userId),
            id: Number(taskId),
        },
        include: {
            options: true
        }
    });
    if (!taskDetails) {
        res.status(411).json({
            message: "Task not found"
        });
    }
    //get submissions for that task and include option chosen in the submission
    const responses = yield prismaClient.submission.findMany({
        where: {
            task_id: Number(taskId)
        },
        include: {
            option: true
        }
    });
    const result = {};
    taskDetails === null || taskDetails === void 0 ? void 0 : taskDetails.options.forEach(option => {
        result[option.id] = {
            count: 0,
            option: {
                image_url: option.image_url
            }
        };
    });
    responses.forEach(r => {
        result[r.option_id].count++;
    });
    res.json({
        result,
        taskDetails
    });
}));
//@ts-ignore
router.post("/task", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log("Posting task into db");
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;
    const parseData = types_1.createTaskInput.safeParse(body);
    if (!parseData.success) {
        res.status(411).json({
            message: "Input is not in the correct format"
        });
    }
    //parse the signature present inside req.body to ensure user has paid $50 and get the amount.
    //begin a transaction to update db with task and options
    console.log("Sending prisma request to update db");
    let response = yield prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        const response = yield tx.task.create({
            data: {
                title: (_b = (_a = parseData.data) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : DEFAULT_TITLE,
                amount: 1 * config_1.TOTAL_DECIMALS,
                signature: (_d = (_c = parseData.data) === null || _c === void 0 ? void 0 : _c.signature) !== null && _d !== void 0 ? _d : "",
                user_id: userId
            }
        });
        yield tx.option.createMany({
            data: ((_f = (_e = parseData.data) === null || _e === void 0 ? void 0 : _e.options) !== null && _f !== void 0 ? _f : []).map((x) => ({
                image_url: x.image_url,
                task_id: response.id
            }))
        });
        console.log("return response from post/task");
        return response;
    }));
    res.json({
        id: response.id
    });
}));
//@ts-ignore
router.get("/presignedUrl", middleware_1.authMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(s3Client, {
        Bucket: 'decentralized-dla',
        Key: `fiver-images/${userId}/${Math.random()}/image.png`,
        Conditions: [
            ['content-length-range', 0, 5 * 1024 * 1024] // 5 MB max
        ],
        Fields: {
            'Content-Type': 'image/png'
        },
        Expires: 3600
    });
    console.log({ url, fields });
    res.json({
        presignedUrl: url,
        fields
    });
}));
router.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //logic
    const hardcodedWalletAddress = "Hzejhdkqwdqhudiudhbb9028331";
    const existingUser = yield prismaClient.user.findFirst({
        where: {
            address: hardcodedWalletAddress,
        }
    });
    if (existingUser) {
        const token = jsonwebtoken_1.default.sign({
            userId: existingUser.id
        }, config_1.JWT_SECRET);
        res.json({ token });
    }
    else {
        const user = yield prismaClient.user.create({
            data: {
                address: hardcodedWalletAddress
            }
        });
        const token = jsonwebtoken_1.default.sign({
            userId: user.id
        }, config_1.JWT_SECRET);
        res.json({ token });
    }
}));
exports.default = router;
