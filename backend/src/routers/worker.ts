import { PrismaClient, TransactionStatus } from "@prisma/client";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { WORKER_JWT_SECRET } from "../config";
import { workerAuthMiddleware } from "../middleware";
import { getNextTask } from "../db";
import { createSubmissionInput } from "./types";

const router = Router();

const prismaClient  = new PrismaClient();

prismaClient.$transaction(
    async (prisma) => {
      // Code running in a transaction...
    },
    {
      maxWait: 5000, // default: 2000
      timeout: 10000, // default: 5000
    }
)

const TOTAL_SUMISSIONS = 100;

//@ts-ignore
router.post("/payout", workerAuthMiddleware, async (req, res) => {
    //@ts-ignore
    const userId : string = req.userId;

    //lock this row , so that until this transaction is complete no further requests can manipulate this row.
    const worker = await prismaClient.worker.findFirst({
        where : {
            id : Number(userId)
        }
    });

    if(!worker){
        res.status(411).json({
            message : "Worker not found"
        });
    } 

    const address = worker?.address;

    //create a signature for the payout between worker and user who created the task
    // use @solana/web3.create()  -> come to this later.
    //{ to address: dynamic, from address: fixed(user who created the task) }

    //this is recieved after the above signature has been created for the solana transaction
    const transactionId = "01x7381a";

    //update database , put pending amount to locked amount , create payout db with signature , id and status as processing.
    await prismaClient.$transaction( async tx => {

        //lock table so that, in case the user makes multiple requests the pending_amount does not go below zero.
        //note that the below code only updates the "worker" table in the db and not the "worker object" recieved above
        await tx.worker.update({
            where : {
                id : Number(userId)
            },
            data : {
                pending_amount : {
                    decrement : worker?.pending_amount
                },
                locked_amount : {
                    increment : worker?.pending_amount
                }
            }
        });

        await tx.payouts.create({
            data : {
                user_id : Number(userId),
                signature : transactionId,
                status : "Processing",
                amount : worker?.pending_amount ?? -1
            }
        });
    });

    // *IMPORTANT* write logic for solana blockchain , to update transaction into the blockchain or constantly check for "success" message in payouts.

    res.json({
           message : "Processing payout",
           amount : worker?.pending_amount
    });
});

//@ts-ignore
router.post("/balance", workerAuthMiddleware, async(req, res) => {
    //@ts-ignore
    const userId: string = req.userId;

    const worker = await prismaClient.worker.findFirst({
        where : {
            id : Number(userId)
        }
    });

    res.json({
        pendingAmount : worker?.pending_amount,
        lockedAmount : worker?.locked_amount
    });
});

//@ts-ignore
router.post("/submission", workerAuthMiddleware, async(req, res) => {
    //@ts-ignore
    const userId = req.userId;
    const body = req.body;

    const parseData = createSubmissionInput.safeParse(body);

    if(!parseData.success){
        res.status(411).json({
            message : "Submission Input is not in the correct format" 
        });
    }

    //get current task
    const task = await getNextTask(Number(userId));

    if(!task || task.id !== Number(parseData.data?.task_id)){
        res.status(411).json({
            message : "Task not submitted, incorrect task id" 
        });
    }

    const amount = Number(task?.amount)/TOTAL_SUMISSIONS;

    //submit the option chosen for task along with the amount made by worker for submitting the task.
    const submission = await prismaClient.$transaction(async (tx) => {
        const submission = await tx.submission.create({
            data : {
                worker_id : userId,
                option_id : Number(parseData.data?.option_id),
                task_id : Number(parseData.data?.task_id),
                amount
            }
        });

        //update the amount made by the worker 
        await tx.worker.update({
            where : {
                id : userId
            },
            data : {
                pending_amount : {
                    increment : amount
                }
            }
        });

        return submission;
    });

    const nextTask = await getNextTask(Number(userId));

    res.json({
        nextTask,
        amount
    });        
});

//@ts-ignore
router.get("/nextTask", workerAuthMiddleware, async (req, res) => {
    //@ts-ignore
    const userId: string = req.userId;

    const task = await getNextTask(Number(userId));

    if(!task){
        res.status(411).json({
            message : "No more tasks left for you to review"
        });
    }

    res.json({task});
});

router.post("/signin", async (req, res) => {
    //logic to be added
    const hardcodedWalletAddress = "zHgdjue647uiejdi2IIj"

    const existingUser = await prismaClient.worker.findFirst({
        where : {
            address : hardcodedWalletAddress,
        }
    });

    if(existingUser){
        const token = jwt.sign({
            userId : existingUser.id
        }, WORKER_JWT_SECRET);

        res.json({token});
    } else {
        const user = await prismaClient.worker.create({
            data : {
                address : hardcodedWalletAddress,
                pending_amount : 0,
                locked_amount : 0
            }
        });
        const token = jwt.sign({
            userId : user.id
        }, WORKER_JWT_SECRET);

        res.json({token});
    }
});

export default router;